import { getSession } from './auth.js';
import { requireSupabase } from './supabase-client.js';
import { notifyPendingContentChanged } from './pending-live.js';
import { publishSubmission, unpublishSubmission } from './submission-publish.js';

export const EVENT_VERB = {
  submitted: 'submitted',
  approved: 'approved',
  rejected: 'rejected',
  returned_to_queue: 'returned to queue',
  removed_from_site: 'removed from site',
  restored_to_site: 'restored on site',
  archived: 'archived',
  reverted: 'reverted',
};

export const PARENT_EVENT_VERB = {
  submitted: 'You submitted',
  approved: 'PTA approved',
  rejected: 'PTA rejected',
  returned_to_queue: 'Returned to review queue',
  removed_from_site: 'Removed from site',
  restored_to_site: 'Restored on site',
  archived: 'Archived (off site)',
  reverted: 'Reverted to previous version',
};

function actorLabel(actor) {
  if (!actor) {
    return 'Someone';
  }
  return actor.full_name || actor.email || 'Admin';
}

export function formatEventLine(event, { forParent = false } = {}) {
  const verbs = forParent ? PARENT_EVENT_VERB : EVENT_VERB;
  const verb = verbs[event.action] || event.action;
  const when = new Date(event.created_at).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  const note =
    event.notes &&
    (forParent ||
      event.action === 'rejected' ||
      event.action === 'removed_from_site' ||
      event.action === 'archived')
      ? ` — ${event.notes}`
      : '';
  return `${forParent ? verb : `${actorLabel(event.actor)} ${verb}`}${note} · ${when}`;
}

export async function recordSubmissionEvent(submissionId, action, actorId, notes = null) {
  const supabase = requireSupabase();
  const { error } = await supabase.from('submission_events').insert({
    submission_id: submissionId,
    action,
    actor_id: actorId,
    notes: notes || null,
  });

  if (error) {
    throw error;
  }
}

export async function loadSubmissionEventsMap(submissionIds) {
  const map = new Map();
  if (!submissionIds.length) {
    return map;
  }

  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('submission_events')
    .select('submission_id, action, notes, created_at, actor:profiles!actor_id(full_name, email)')
    .in('submission_id', submissionIds)
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  for (const event of data || []) {
    const list = map.get(event.submission_id) || [];
    list.push(event);
    map.set(event.submission_id, list);
  }

  return map;
}

export function renderEventTimeline(events, { forParent = false } = {}) {
  if (!events?.length) {
    return '';
  }

  const items = events
    .map((event) => {
      const line = formatEventLine(event, { forParent });
      return `<li><time datetime="${event.created_at}">${escapeHtml(line)}</time></li>`;
    })
    .join('');

  return `<ol class="submission-timeline" aria-label="Activity">${items}</ol>`;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function updateSubmissionRecord(submissionId, { status, reviewNotes, reviewerId }) {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from('submissions')
    .update({
      status,
      review_notes: reviewNotes,
      reviewer_id: reviewerId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', submissionId);

  if (error) {
    throw error;
  }
}

/**
 * Central admin workflow: publish/unpublish side effects, status update, audit event.
 * @param {'approve'|'reject'|'return-to-queue'|'archive'|'restore'} action
 */
export async function applyAdminAction(submission, action, notes = '') {
  const session = await getSession();
  if (!session?.user?.id) {
    throw new Error('Sign in required.');
  }

  const actorId = session.user.id;
  const trimmedNotes = notes.trim();

  if (action === 'approve') {
    await publishSubmission(submission, { actorId });
    await updateSubmissionRecord(submission.id, {
      status: 'approved',
      reviewNotes: trimmedNotes || null,
      reviewerId: actorId,
    });
    await recordSubmissionEvent(submission.id, 'approved', actorId, trimmedNotes || null);
  } else if (action === 'reject') {
    if (submission.status === 'approved') {
      await unpublishSubmission(submission);
    }
    await updateSubmissionRecord(submission.id, {
      status: 'rejected',
      reviewNotes: trimmedNotes || submission.review_notes || null,
      reviewerId: actorId,
    });
    await recordSubmissionEvent(submission.id, 'rejected', actorId, trimmedNotes || null);
  } else if (action === 'return-to-queue') {
    if (submission.status === 'approved') {
      await unpublishSubmission(submission);
    }
    await updateSubmissionRecord(submission.id, {
      status: 'pending',
      reviewNotes: null,
      reviewerId: actorId,
    });
    await recordSubmissionEvent(
      submission.id,
      'returned_to_queue',
      actorId,
      trimmedNotes || null,
    );
  } else if (action === 'archive') {
    if (submission.status === 'approved') {
      await unpublishSubmission(submission);
    }
    await updateSubmissionRecord(submission.id, {
      status: 'archived',
      reviewNotes: trimmedNotes || 'Archived and removed from the website.',
      reviewerId: actorId,
    });
    await recordSubmissionEvent(
      submission.id,
      'archived',
      actorId,
      trimmedNotes || 'Archived and removed from the website.',
    );
  } else if (action === 'restore') {
    const restoreNote = trimmedNotes || 'Restored from archive for review.';
    await updateSubmissionRecord(submission.id, {
      status: 'pending',
      reviewNotes: restoreNote,
      reviewerId: actorId,
    });
    await recordSubmissionEvent(submission.id, 'returned_to_queue', actorId, restoreNote);
  } else {
    throw new Error(`Unknown admin action: ${action}`);
  }

  notifyPendingContentChanged();
}

export async function recordArchivedFromSite(submissionId, actorId, notes = null) {
  const message = notes || 'Archived and removed from the website.';
  await updateSubmissionRecord(submissionId, {
    status: 'archived',
    reviewNotes: message,
    reviewerId: actorId,
  });
  await recordSubmissionEvent(submissionId, 'archived', actorId, message);
  notifyPendingContentChanged();
}

/** @deprecated Use recordArchivedFromSite */
export async function recordRemovedFromSite(submissionId, actorId, notes = null) {
  return recordArchivedFromSite(submissionId, actorId, notes);
}

export async function deleteSubmissionPermanently(submissionId) {
  const supabase = requireSupabase();
  const { error } = await supabase.from('submissions').delete().eq('id', submissionId);
  if (error) {
    throw error;
  }
  notifyPendingContentChanged();
}

export async function recordRestoredToQueue(submissionId, actorId) {
  const message = 'Restored from archive for review.';
  await updateSubmissionRecord(submissionId, {
    status: 'pending',
    reviewNotes: message,
    reviewerId: actorId,
  });
  await recordSubmissionEvent(submissionId, 'returned_to_queue', actorId, message);
  notifyPendingContentChanged();
}

/** @deprecated Restores to queue, not live */
export async function recordRestoredToSite(submissionId, actorId) {
  return recordRestoredToQueue(submissionId, actorId);
}

export function adminActionSuccessMessage(action, submission) {
  if (action === 'restore') {
    return 'Returned to the review queue.';
  }
  if (action === 'archive') {
    return 'Archived and removed from the website.';
  }
  if (action === 'return-to-queue') {
    return 'Returned to the review queue.';
  }
  if (action === 'reject') {
    if (submission.status === 'approved' && submission.intent === 'edit_published') {
      return 'Submission rejected. The live item was left as-is because this was a change request.';
    }
    if (submission.status === 'approved') {
      return 'Submission rejected and removed from the site.';
    }
    return 'Submission rejected.';
  }
  if (action === 'approve') {
    return submission.intent === 'edit_published'
      ? 'Change request approved and the live item was updated.'
      : 'Submission approved and published.';
  }
  return 'Done.';
}
