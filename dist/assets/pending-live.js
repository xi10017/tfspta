import { renderSubmissionPreview } from './submission-form.js';
import { getTargetFieldForType } from './submission-workflow.js';

export const PENDING_GHOST_LABELS = {
  create: 'Pending review',
  update_pending: 'Pending review',
  resubmit: 'Pending review',
  edit_published: 'Proposed update — pending review',
};

export const PENDING_CONTENT_CHANGED = 'pending-content-changed';

export function notifyPendingContentChanged() {
  window.dispatchEvent(new CustomEvent(PENDING_CONTENT_CHANGED));
}

const PENDING_SELECT_BY_TYPE = {
  announcement: 'id, payload, intent, target_published_announcement_id, created_at',
  event: 'id, payload, intent, target_published_event_id, created_at',
  competition: 'id, payload, intent, target_published_competition_id, created_at',
  club: 'id, payload, intent, target_published_club_id, created_at',
};

export async function fetchPendingForLive(supabase, contentType, submitterId) {
  if (!submitterId) {
    return [];
  }

  const selectColumns = PENDING_SELECT_BY_TYPE[contentType] || 'id, payload, intent, created_at';

  const { data, error } = await supabase
    .from('submissions')
    .select(selectColumns)
    .eq('status', 'pending')
    .eq('content_type', contentType)
    .eq('submitter_id', submitterId)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data || [];
}

export function renderPendingGhost(submission, contentType) {
  const ghostLabel = PENDING_GHOST_LABELS[submission.intent] || 'Pending review';
  return renderSubmissionPreview(contentType, submission.payload, { ghost: true, ghostLabel });
}

export function partitionPendingSubmissions(pending, contentType) {
  const targetField = getTargetFieldForType(contentType);
  const changeByTarget = new Map();
  const pendingCreates = [];

  for (const submission of pending) {
    const targetId = targetField ? submission[targetField] : null;
    if (targetId) {
      if (!changeByTarget.has(targetId)) {
        changeByTarget.set(targetId, submission);
      }
    } else {
      pendingCreates.push(submission);
    }
  }

  return { changeByTarget, pendingCreates };
}

function entryDate(entry, contentType) {
  if (entry.kind === 'published') {
    return contentType === 'event'
      ? entry.item.event_date || ''
      : entry.item.announcement_date || '';
  }

  return entry.submission.payload?.date || '';
}

function entryTime(entry) {
  if (entry.kind === 'published') {
    return entry.item.published_at || '';
  }

  return entry.submission.created_at || '';
}

export function buildTimelineEntries(publishedItems, pendingCreates, contentType) {
  const entries = pendingCreates.map((submission) => ({
    kind: 'ghost',
    submission,
  }));

  for (const item of publishedItems) {
    entries.push({ kind: 'published', item });
  }

  const descending = contentType === 'announcement';
  entries.sort((a, b) => {
    const dateCompare = entryDate(a, contentType).localeCompare(entryDate(b, contentType));
    if (dateCompare !== 0) {
      return descending ? -dateCompare : dateCompare;
    }

    const timeCompare = entryTime(a).localeCompare(entryTime(b));
    return descending ? -timeCompare : timeCompare;
  });

  return entries;
}

export function changesForTier(changeByTarget, publishedItems) {
  const publishedIds = new Set(publishedItems.map((item) => item.id));
  return new Map(
    [...changeByTarget.entries()].filter(([targetId]) => publishedIds.has(targetId)),
  );
}

export function renderPendingLiveNotice(hasPending) {
  if (!hasPending) {
    return '';
  }

  return `
    <p class="pending-live-notice" role="status">
      Your dashed items below are awaiting PTA review and are not yet official.
    </p>
  `;
}
