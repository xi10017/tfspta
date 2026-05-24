import { getSession, getProfile, signIn, signOut, isAdmin, ensureProfile, ensureAuthenticatedSession } from './auth.js';
import { initPasswordResetRequest } from './auth-reset-request.js';
import { initChangePassword } from './auth-change-password.js';
import { showMessage, showUndoToast } from './ui-messages.js';
import { applyConfigNoticeContent } from './config-notice.js';
import { requireSupabase, isSupabaseConfigured } from './supabase-client.js';
import { INTENT_LABELS, getTargetFieldForType } from './submission-workflow.js';
import { notifyPendingContentChanged } from './pending-live.js';
import {
  cleanupPublishedCatalogDuplicates,
  PUBLISHED_TABLE_BY_TYPE,
  publishSubmission,
  submissionAlreadyOnSite,
  unpublishSubmission,
} from './submission-publish.js';
import {
  applyAdminAction,
  adminActionSuccessMessage,
  deleteSubmissionPermanently,
  loadSubmissionEventsMap,
  recordArchivedFromSite,
  recordRestoredToQueue,
  recordSubmissionEvent,
  renderEventTimeline,
} from './submission-events.js';
import {
  countVersionsByPublishedIds,
  revertPublishedToPreviousVersion,
} from './published-versions.js';
import {
  archivedOrphanMeta,
  archivedOrphanTitle,
  deleteArchivedOrphan,
  insertArchivedOrphan,
  loadArchivedOrphans,
  restoreArchivedOrphanToQueue,
} from './submission-archive.js';

const configNotice = document.getElementById('config-notice');
applyConfigNoticeContent(configNotice);
const authPanel = document.getElementById('auth-panel');
const adminPanel = document.getElementById('admin-panel');
const deniedPanel = document.getElementById('denied-panel');
const authForm = document.getElementById('auth-form');
const authMessage = document.getElementById('auth-message');
const signOutBtn = document.getElementById('sign-out-btn');
const inboxEl = document.getElementById('inbox');
const publishedAnnouncementsEl = document.getElementById('published-announcements');
const publishedEventsEl = document.getElementById('published-events');
const publishedCompetitionsEl = document.getElementById('published-competitions');
const publishedClubsEl = document.getElementById('published-clubs');
const adminUserLabel = document.getElementById('admin-user-label');
const deniedDetails = document.getElementById('denied-details');
const deniedSignOutBtn = document.getElementById('admin-sign-out-denied');
const signinBlock = document.getElementById('admin-signin-block');
const resetPanel = document.getElementById('reset-panel');
const resetForm = document.getElementById('reset-form');
const resetMessage = document.getElementById('reset-message');
const adminMessage = document.getElementById('admin-message');
const tabAdminInbox = document.getElementById('tab-admin-inbox');
const tabAdminPublished = document.getElementById('tab-admin-published');
const tabAdminRejected = document.getElementById('tab-admin-rejected');
const tabAdminArchive = document.getElementById('tab-admin-archive');
const adminInboxPanel = document.getElementById('admin-inbox-panel');
const adminPublishedPanel = document.getElementById('admin-published-panel');
const adminRejectedPanel = document.getElementById('admin-rejected-panel');
const adminArchivePanel = document.getElementById('admin-archive-panel');
const rejectedInboxEl = document.getElementById('rejected-inbox');
const archivedSubmissionsEl = document.getElementById('archived-submissions');
const archivedOrphansEl = document.getElementById('archived-orphans');

let liveSubmissionState = {
  submissionIds: new Set(),
  targetIdsByType: {
    announcement: new Set(),
    event: new Set(),
    competition: new Set(),
    club: new Set(),
  },
};

async function loadLiveSubmissionState() {
  const supabase = requireSupabase();
  const submissionIds = new Set();
  const targetIdsByType = {
    announcement: new Set(),
    event: new Set(),
    competition: new Set(),
    club: new Set(),
  };

  const results = await Promise.all(
    Object.entries(PUBLISHED_TABLE_BY_TYPE).map(async ([type, table]) => {
      const { data, error } = await supabase.from(table).select('id, submission_id');
      if (error) {
        throw error;
      }
      return { type, rows: data || [] };
    }),
  );

  for (const { type, rows } of results) {
    for (const row of rows) {
      targetIdsByType[type].add(row.id);
      if (row.submission_id) {
        submissionIds.add(row.submission_id);
      }
    }
  }

  liveSubmissionState = { submissionIds, targetIdsByType };
  return liveSubmissionState;
}

function isSubmissionLive(item, state = liveSubmissionState) {
  if (item.status !== 'approved') {
    return null;
  }

  if (item.intent === 'edit_published') {
    const targetField = getTargetFieldForType(item.content_type);
    const targetId = targetField ? item[targetField] : null;
    if (!targetId) {
      return false;
    }
    return state.targetIdsByType[item.content_type]?.has(targetId) ?? false;
  }

  return state.submissionIds.has(item.id);
}

async function enforceApprovedPublishedSync() {
  const supabase = requireSupabase();
  await loadLiveSubmissionState();

  const { data: approved, error: approvedError } = await supabase
    .from('submissions')
    .select('*')
    .eq('status', 'approved');

  if (approvedError) {
    throw approvedError;
  }

  let changed = false;
  const now = new Date().toISOString();

  for (const submission of approved || []) {
    if (isSubmissionLive(submission)) {
      continue;
    }

    if (
      submission.intent !== 'edit_published' &&
      (submission.content_type === 'competition' || submission.content_type === 'club') &&
      ((await submissionAlreadyOnSite(submission)) || submission.intent === 'create')
    ) {
      continue;
    }

    changed = true;

    if (submission.intent === 'edit_published') {
      await supabase
        .from('submissions')
        .update({
          status: 'pending',
          review_notes: 'The live item this change targeted is no longer on the site.',
          updated_at: now,
        })
        .eq('id', submission.id);
      continue;
    }

    try {
      await publishSubmission(submission);
    } catch (publishError) {
      await supabase
        .from('submissions')
        .update({
          status: 'pending',
          review_notes: `Could not publish: ${publishError.message}`,
          updated_at: now,
        })
        .eq('id', submission.id);
    }
  }

  const linkedIds = [...liveSubmissionState.submissionIds];
  if (linkedIds.length) {
    const { data: linkedSubmissions, error: linkedError } = await supabase
      .from('submissions')
      .select('id, status')
      .in('id', linkedIds);

    if (linkedError) {
      throw linkedError;
    }

    const staleToApprove = [];
    const staleToUnpublish = [];

    for (const submission of linkedSubmissions || []) {
      if (submission.status === 'approved') {
        continue;
      }
      if (submission.status === 'archived' || submission.status === 'rejected') {
        staleToUnpublish.push(submission.id);
        continue;
      }
      if (submission.status === 'pending') {
        staleToApprove.push(submission.id);
      }
    }

    if (staleToUnpublish.length) {
      changed = true;
      const { data: fullRows, error: fullError } = await supabase
        .from('submissions')
        .select('*')
        .in('id', staleToUnpublish);

      if (fullError) {
        throw fullError;
      }

      for (const row of fullRows || []) {
        await unpublishSubmission(row);
      }
    }

    if (staleToApprove.length) {
      changed = true;
      const { error: fixError } = await supabase
        .from('submissions')
        .update({
          status: 'approved',
          review_notes: null,
          updated_at: now,
        })
        .in('id', staleToApprove);

      if (fixError) {
        throw fixError;
      }
    }
  }

  await cleanupPublishedCatalogDuplicates();
  await loadLiveSubmissionState();
}

async function reloadAdminData() {
  await enforceApprovedPublishedSync();
  const tasks = [loadInbox({ skipSync: true }), loadPublishedContent()];
  if (adminRejectedPanel && !adminRejectedPanel.hidden) {
    tasks.push(loadRejectedContent());
  }
  if (adminArchivePanel && !adminArchivePanel.hidden) {
    tasks.push(loadArchiveContent());
  }
  await Promise.all(tasks);
  notifyPendingContentChanged();
}

function setAdminTab(mode) {
  const isPublished = mode === 'published';
  const isRejected = mode === 'rejected';
  const isArchive = mode === 'archive';
  const isInbox = !isPublished && !isRejected && !isArchive;

  tabAdminInbox?.classList.toggle('is-active', isInbox);
  tabAdminPublished?.classList.toggle('is-active', isPublished);
  tabAdminRejected?.classList.toggle('is-active', isRejected);
  tabAdminArchive?.classList.toggle('is-active', isArchive);
  tabAdminInbox?.setAttribute('aria-selected', String(isInbox));
  tabAdminPublished?.setAttribute('aria-selected', String(isPublished));
  tabAdminRejected?.setAttribute('aria-selected', String(isRejected));
  tabAdminArchive?.setAttribute('aria-selected', String(isArchive));

  if (adminInboxPanel) {
    adminInboxPanel.hidden = !isInbox;
  }
  if (adminPublishedPanel) {
    adminPublishedPanel.hidden = !isPublished;
  }
  if (adminRejectedPanel) {
    adminRejectedPanel.hidden = !isRejected;
  }
  if (adminArchivePanel) {
    adminArchivePanel.hidden = !isArchive;
  }

  if (isPublished) {
    loadPublishedContent().catch((error) => showMessage(null, error.message, 'error'));
  }
  if (isRejected) {
    loadRejectedContent().catch((error) => showMessage(null, error.message, 'error'));
  }
  if (isArchive) {
    loadArchiveContent().catch((error) => showMessage(null, error.message, 'error'));
  }
}

function formatDate(value) {
  if (!value) {
    return '—';
  }
  return new Date(value).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function renderPayload(payload, type) {
  if (type === 'competition') {
    const rows = [
      ['Category', payload.category || 'MISC'],
      ['Name', payload.name],
      ['Description', payload.description || payload.body],
      ['Format', payload.format || '—'],
      ['Contact', payload.contact || '—'],
      ['Eligibility', payload.eligibility || '—'],
      ['Season', payload.period || '—'],
      ['Level', payload.level || '—'],
      ['Link', payload.link || '—'],
    ];
    return rows
      .map(([label, value]) => `<dt>${label}</dt><dd>${escapeHtml(String(value || ''))}</dd>`)
      .join('');
  }

  if (type === 'club') {
    const rows = [
      ['Campus', payload.school || 'District-wide'],
      ['Name', payload.name],
      ['Description', payload.description || payload.body],
      ['Contact', payload.contact || '—'],
      ['Eligibility', payload.eligibility || '—'],
      ['Schedule', payload.period || '—'],
      ['Notes', payload.notes || '—'],
      ['Link', payload.link || '—'],
    ];
    return rows
      .map(([label, value]) => `<dt>${label}</dt><dd>${escapeHtml(String(value || ''))}</dd>`)
      .join('');
  }

  const rows = [
    ['Campus', payload.school || 'District-wide'],
    ['Title', payload.title],
    ['Date', payload.date || '—'],
  ];
  if (type === 'event') {
    rows.push(['Location', payload.location || '—']);
  }
  rows.push(['Details', payload.body]);

  return rows
    .map(([label, value]) => `<dt>${label}</dt><dd>${escapeHtml(String(value || ''))}</dd>`)
    .join('');
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function fetchPublishedRow(type, id) {
  const table = PUBLISHED_TABLE_BY_TYPE[type];
  if (!table) {
    throw new Error(`Unknown published type: ${type}`);
  }

  const supabase = requireSupabase();
  const { data, error } = await supabase.from(table).select('*').eq('id', id).single();
  if (error) {
    throw error;
  }

  return data;
}

async function deletePublished(type, id) {
  const snapshot = await fetchPublishedRow(type, id);
  const supabase = requireSupabase();
  const table = PUBLISHED_TABLE_BY_TYPE[type];
  const { error } = await supabase.from(table).delete().eq('id', id);

  if (error) {
    throw error;
  }

  notifyPendingContentChanged();
  return snapshot;
}

async function archivePublishedAndSync(type, id) {
  const snapshot = await fetchPublishedRow(type, id);
  await deletePublished(type, id);

  const session = await getSession();
  const actorId = session?.user?.id;
  if (!actorId) {
    throw new Error('Sign in required.');
  }

  let orphanArchiveId = null;
  if (snapshot?.submission_id) {
    await recordArchivedFromSite(snapshot.submission_id, actorId);
  } else {
    orphanArchiveId = await insertArchivedOrphan(type, snapshot, actorId);
  }

  return { snapshot, type, orphanArchiveId };
}

function inboxStatusLabel(status) {
  if (status === 'approved') {
    return 'published';
  }
  return status;
}

async function loadInbox({ skipSync = false } = {}) {
  return loadSubmissionsByStatus(inboxEl, 'pending', 'pending', { skipSync });
}

async function loadRejectedContent({ skipSync = false } = {}) {
  return loadSubmissionsByStatus(rejectedInboxEl, 'rejected', 'rejected', { skipSync });
}

async function loadSubmissionsByStatus(el, status, mode, { skipSync = false } = {}) {
  if (!el) {
    return;
  }

  if (!skipSync) {
    try {
      await enforceApprovedPublishedSync();
    } catch (error) {
      el.innerHTML = `<p class="form-message form-message--error">${escapeHtml(error.message)}</p>`;
      return;
    }
  }

  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('submissions')
    .select(
      'id, content_type, payload, status, review_notes, created_at, intent, target_published_announcement_id, target_published_event_id, target_published_competition_id, target_published_club_id, submitter:profiles!submitter_id(full_name, email)',
    )
    .eq('status', status)
    .order('created_at', { ascending: false });

  if (error) {
    el.innerHTML = `<p class="form-message form-message--error">${escapeHtml(error.message)}</p>`;
    return;
  }

  const items = data || [];
  let eventsBySubmission = new Map();

  if (items.length) {
    try {
      eventsBySubmission = await loadSubmissionEventsMap(items.map((item) => item.id));
    } catch (eventsError) {
      if (!eventsError.message?.includes('submission_events')) {
        el.innerHTML = `<p class="form-message form-message--error">${escapeHtml(eventsError.message)}</p>`;
        return;
      }
    }
  }

  renderSubmissionCards(el, items, eventsBySubmission, mode);
}

function renderSubmissionCards(el, items, eventsBySubmission = new Map(), mode = 'pending') {
  if (!el) {
    return;
  }

  const emptyMessage =
    mode === 'pending'
      ? 'No submissions in the queue.'
      : mode === 'rejected'
        ? 'No rejected submissions.'
        : 'Nothing here.';

  if (!items.length) {
    el.innerHTML = `<p class="empty-inbox">${emptyMessage}</p>`;
    return;
  }

  el.innerHTML = items
    .map((item) => {
      const timeline = renderEventTimeline(eventsBySubmission.get(item.id) || []);
      const submitter = item.submitter?.full_name || item.submitter?.email || 'Unknown parent';
      const intentLabel = item.intent && item.intent !== 'create' ? INTENT_LABELS[item.intent] : '';
      const approveLabel = item.intent === 'edit_published' ? 'Approve change' : 'Approve & publish';
      const notesId = `notes-${item.id}`;

      let actions = '';
      if (mode === 'pending') {
        actions = `
          <div class="inbox-actions">
            <label class="visually-hidden" for="${notesId}">Review notes</label>
            <input id="${notesId}" type="text" placeholder="Optional note to parent" maxlength="500">
            <button type="button" class="btn btn-primary" data-action="approve">${escapeHtml(approveLabel)}</button>
            <button type="button" class="btn btn-secondary" data-action="reject">Reject</button>
          </div>`;
      } else if (mode === 'rejected') {
        actions = `
          <div class="inbox-actions inbox-actions--secondary">
            <label class="visually-hidden" for="${notesId}">Review notes</label>
            <input id="${notesId}" type="text" placeholder="Optional note to parent" maxlength="500">
            <button type="button" class="btn btn-primary btn-sm" data-action="approve">${escapeHtml(approveLabel)}</button>
            <button type="button" class="btn btn-secondary btn-sm" data-action="return-to-queue">Return to queue</button>
            <button type="button" class="btn btn-secondary btn-sm" data-action="archive">Move to archive</button>
          </div>`;
      }

      return `
        <article class="inbox-card" data-id="${item.id}">
          <div class="inbox-card-header">
            <div>
              <span class="inbox-type">${escapeHtml(item.content_type)}</span>
              <span class="inbox-status inbox-status--${item.status}">${escapeHtml(inboxStatusLabel(item.status))}</span>
              ${intentLabel ? `<span class="submission-intent">${escapeHtml(intentLabel)}</span>` : ''}
            </div>
            <time datetime="${item.created_at}">${formatDate(item.created_at)}</time>
          </div>
          <p class="inbox-meta">Submitted by ${escapeHtml(submitter)}</p>
          <dl class="inbox-payload">${renderPayload(item.payload, item.content_type)}</dl>
          ${timeline}
          ${item.review_notes ? `<p class="inbox-review-notes"><strong>Latest note:</strong> ${escapeHtml(item.review_notes)}</p>` : ''}
          ${actions}
        </article>
      `;
    })
    .join('');
}

function renderPublishedCardActions(itemId, versionCounts) {
  const hasPrevious = (versionCounts.get(itemId) || 0) > 0;
  const revertButton = hasPrevious
    ? '<button type="button" class="btn btn-secondary btn-sm" data-action="revert-published">Revert to previous</button>'
    : '';

  return `
    <div class="published-card-actions">
      ${revertButton}
      <button type="button" class="btn btn-danger btn-sm" data-action="archive-published">Archive</button>
    </div>
  `;
}

function renderPublishedList(el, items, type, versionCounts = new Map()) {
  if (!el) {
    return;
  }

  if (!items.length) {
    el.innerHTML = '<p class="empty-inbox">Nothing published yet.</p>';
    return;
  }

  el.innerHTML = items
    .map((item) => {
      const actions = renderPublishedCardActions(item.id, versionCounts);

      if (type === 'competition') {
        const meta = `${item.category || 'MISC'} · ${item.level || '—'}`;
        return `
        <article class="published-card" data-type="${type}" data-id="${item.id}">
          <div class="published-card-content">
            <h4>${escapeHtml(item.name)}</h4>
            <p class="published-card-meta">${escapeHtml(meta)}</p>
            ${item.description ? `<p class="published-card-text">${escapeHtml(item.description)}</p>` : ''}
          </div>
          ${actions}
        </article>
      `;
      }

      if (type === 'club') {
        const campus = item.school || 'District-wide';
        const meta = `${campus} · ${item.period || '—'}`;
        return `
        <article class="published-card" data-type="${type}" data-id="${item.id}">
          <div class="published-card-content">
            <h4>${escapeHtml(item.name)}</h4>
            <p class="published-card-meta">${escapeHtml(meta)}</p>
            ${item.description ? `<p class="published-card-text">${escapeHtml(item.description)}</p>` : ''}
          </div>
          ${actions}
        </article>
      `;
      }

      const dateLabel = type === 'event' ? item.event_date : item.announcement_date;
      const campus = item.school || 'District-wide';
      const meta =
        type === 'event'
          ? `${campus} · ${dateLabel || '—'} · ${item.location || '—'}`
          : `${campus} · ${dateLabel || '—'}`;

      return `
        <article class="published-card" data-type="${type}" data-id="${item.id}">
          <div class="published-card-content">
            <h4>${escapeHtml(item.title)}</h4>
            <p class="published-card-meta">${escapeHtml(meta)}</p>
            ${item.body ? `<p class="published-card-text">${escapeHtml(item.body)}</p>` : ''}
          </div>
          ${actions}
        </article>
      `;
    })
    .join('');
}

async function loadPublishedContent() {
  const supabase = requireSupabase();

  const [announcementsResult, eventsResult, competitionsResult, clubsResult] = await Promise.all([
    supabase
      .from('published_announcements')
      .select('id, school, title, body, announcement_date')
      .order('announcement_date', { ascending: false, nullsFirst: false }),
    supabase
      .from('published_events')
      .select('id, school, title, body, location, event_date')
      .order('event_date', { ascending: false, nullsFirst: false }),
    supabase
      .from('published_competitions')
      .select('id, category, name, description, level')
      .order('published_at', { ascending: false }),
    supabase
      .from('published_clubs')
      .select('id, school, name, description, period')
      .order('published_at', { ascending: false }),
  ]);

  if (announcementsResult.error) {
    publishedAnnouncementsEl.innerHTML = `<p class="form-message form-message--error">${escapeHtml(announcementsResult.error.message)}</p>`;
  } else {
    const items = announcementsResult.data || [];
    const versionCounts = await countVersionsByPublishedIds(
      supabase,
      'announcement',
      items.map((item) => item.id),
    );
    renderPublishedList(publishedAnnouncementsEl, items, 'announcement', versionCounts);
  }

  if (eventsResult.error) {
    publishedEventsEl.innerHTML = `<p class="form-message form-message--error">${escapeHtml(eventsResult.error.message)}</p>`;
  } else {
    const items = eventsResult.data || [];
    const versionCounts = await countVersionsByPublishedIds(
      supabase,
      'event',
      items.map((item) => item.id),
    );
    renderPublishedList(publishedEventsEl, items, 'event', versionCounts);
  }

  if (competitionsResult.error) {
    if (publishedCompetitionsEl) {
      publishedCompetitionsEl.innerHTML = `<p class="form-message form-message--error">${escapeHtml(competitionsResult.error.message)}</p>`;
    }
  } else {
    const items = competitionsResult.data || [];
    const versionCounts = await countVersionsByPublishedIds(
      supabase,
      'competition',
      items.map((item) => item.id),
    );
    renderPublishedList(publishedCompetitionsEl, items, 'competition', versionCounts);
  }

  if (clubsResult.error) {
    if (publishedClubsEl) {
      publishedClubsEl.innerHTML = `<p class="form-message form-message--error">${escapeHtml(clubsResult.error.message)}</p>`;
    }
  } else {
    const items = clubsResult.data || [];
    const versionCounts = await countVersionsByPublishedIds(
      supabase,
      'club',
      items.map((item) => item.id),
    );
    renderPublishedList(publishedClubsEl, items, 'club', versionCounts);
  }
}

function renderArchivedSubmissions(items, eventsBySubmission = new Map()) {
  if (!archivedSubmissionsEl) {
    return;
  }

  if (!items.length) {
    archivedSubmissionsEl.innerHTML = '<p class="empty-inbox">No archived submissions.</p>';
    return;
  }

  archivedSubmissionsEl.innerHTML = items
    .map((item) => {
      const timeline = renderEventTimeline(eventsBySubmission.get(item.id) || []);
      const submitter = item.submitter?.full_name || item.submitter?.email || 'Unknown parent';
      const restoreLabel = 'Return to queue';
      return `
        <article class="inbox-card" data-id="${item.id}">
          <div class="inbox-card-header">
            <div>
              <span class="inbox-type">${escapeHtml(item.content_type)}</span>
              <span class="inbox-status inbox-status--archived">archived</span>
              ${item.intent && item.intent !== 'create' ? `<span class="submission-intent">${escapeHtml(INTENT_LABELS[item.intent] || item.intent)}</span>` : ''}
            </div>
            <time datetime="${item.created_at}">${formatDate(item.created_at)}</time>
          </div>
          <p class="inbox-meta">Submitted by ${escapeHtml(submitter)}</p>
          <dl class="inbox-payload">${renderPayload(item.payload, item.content_type)}</dl>
          ${timeline}
          ${item.review_notes ? `<p class="inbox-review-notes"><strong>Archive note:</strong> ${escapeHtml(item.review_notes)}</p>` : ''}
          <div class="inbox-actions">
            <button type="button" class="btn btn-primary btn-sm" data-action="restore-submission">${escapeHtml(restoreLabel)}</button>
            <button type="button" class="btn btn-danger btn-sm" data-action="delete-submission">Delete permanently</button>
          </div>
        </article>
      `;
    })
    .join('');
}

function renderArchivedOrphans(items) {
  if (!archivedOrphansEl) {
    return;
  }

  if (!items.length) {
    archivedOrphansEl.innerHTML = '<p class="empty-inbox">No other archived items.</p>';
    return;
  }

  archivedOrphansEl.innerHTML = items
    .map((item) => {
      const archiver = item.archiver?.full_name || item.archiver?.email || 'Admin';
      return `
        <article class="published-card archived-card" data-archive-id="${item.id}">
          <div class="published-card-content">
            <h4>${escapeHtml(archivedOrphanTitle(item))}</h4>
            <p class="published-card-meta">${escapeHtml(archivedOrphanMeta(item))} · ${escapeHtml(item.content_type)}</p>
            <p class="published-card-text">Archived by ${escapeHtml(archiver)} · ${formatDate(item.archived_at)}</p>
            ${item.notes ? `<p class="published-card-text">${escapeHtml(item.notes)}</p>` : ''}
          </div>
          <button type="button" class="btn btn-primary btn-sm" data-action="restore-orphan">Return to queue</button>
          <button type="button" class="btn btn-danger btn-sm" data-action="delete-orphan">Delete permanently</button>
        </article>
      `;
    })
    .join('');
}

async function loadArchiveContent() {
  if (!archivedSubmissionsEl && !archivedOrphansEl) {
    return;
  }

  const supabase = requireSupabase();

  const submissionsPromise = supabase
    .from('submissions')
    .select(
      'id, content_type, payload, status, review_notes, created_at, intent, submitter:profiles!submitter_id(full_name, email)',
    )
    .eq('status', 'archived')
    .order('updated_at', { ascending: false });

  const orphansPromise = loadArchivedOrphans().catch((error) => {
    if (error.message?.includes('archived_published_items')) {
      return [];
    }
    throw error;
  });

  const [{ data: submissions, error: submissionsError }, orphans] = await Promise.all([
    submissionsPromise,
    orphansPromise,
  ]);

  if (submissionsError) {
    if (archivedSubmissionsEl) {
      archivedSubmissionsEl.innerHTML = `<p class="form-message form-message--error">${escapeHtml(submissionsError.message)}</p>`;
    }
    return;
  }

  const items = submissions || [];
  let eventsBySubmission = new Map();
  if (items.length) {
    try {
      eventsBySubmission = await loadSubmissionEventsMap(items.map((item) => item.id));
    } catch (eventsError) {
      if (!eventsError.message?.includes('submission_events') && archivedSubmissionsEl) {
        archivedSubmissionsEl.innerHTML = `<p class="form-message form-message--error">${escapeHtml(eventsError.message)}</p>`;
        return;
      }
    }
  }

  renderArchivedSubmissions(items, eventsBySubmission);
  renderArchivedOrphans(orphans);
}

async function refreshUI() {
  if (!isSupabaseConfigured) {
    configNotice.hidden = false;
    authPanel.hidden = true;
    adminPanel.hidden = true;
    deniedPanel.hidden = true;
    return;
  }

  configNotice.hidden = true;
  const session = await ensureAuthenticatedSession();

  if (!session) {
    authPanel.hidden = false;
    adminPanel.hidden = true;
    deniedPanel.hidden = true;
    return;
  }

  let profile = null;
  let profileError = null;

  try {
    profile = await ensureProfile(session);
  } catch (error) {
    profileError = error;
  }

  if (!isAdmin(profile)) {
    authPanel.hidden = true;
    adminPanel.hidden = true;
    deniedPanel.hidden = false;

    if (deniedDetails) {
      const lines = [
        `Signed in as: ${session.user.email}`,
        `User id: ${session.user.id}`,
      ];
      if (profileError) {
        lines.push(`Profile error: ${profileError.message}`);
      } else if (profile) {
        lines.push(`Current role: ${profile.role}`);
      } else {
        lines.push('No profile row found for this account.');
      }
      deniedDetails.textContent = lines.join(' · ');
    }
    return;
  }

  authPanel.hidden = true;
  deniedPanel.hidden = true;
  adminPanel.hidden = false;
  adminUserLabel.textContent = profile.full_name || profile.email;
  setAdminTab('inbox');
  await reloadAdminData();
}

initPasswordResetRequest({
  signinBlock,
  resetPanel,
  resetForm,
  resetMessage,
  forgotBtn: document.getElementById('forgot-password-btn'),
  backBtn: document.getElementById('reset-back-btn'),
  getEmailFallback: () => authForm?.querySelector('#email')?.value.trim(),
  showMessage,
});

initChangePassword({
  toggleBtn: document.getElementById('change-password-toggle'),
  panel: document.getElementById('change-password-panel'),
  form: document.getElementById('change-password-form'),
  messageEl: document.getElementById('change-password-message'),
  showMessage,
});

authForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  showMessage(authMessage, '');

  const formData = new FormData(authForm);
  try {
    const { error } = await signIn(formData.get('email').trim(), formData.get('password'));
    if (error) {
      throw error;
    }
    await ensureProfile((await getSession()));
    await refreshUI();
  } catch (error) {
    showMessage(authMessage, error.message, 'error');
  }
});

signOutBtn?.addEventListener('click', async () => {
  await signOut();
  await refreshUI();
});

deniedSignOutBtn?.addEventListener('click', async () => {
  await signOut();
  await refreshUI();
});

tabAdminInbox?.addEventListener('click', () => setAdminTab('inbox'));
tabAdminPublished?.addEventListener('click', () => setAdminTab('published'));
tabAdminRejected?.addEventListener('click', () => setAdminTab('rejected'));
tabAdminArchive?.addEventListener('click', () => setAdminTab('archive'));

async function handleSubmissionCardClick(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) {
    return;
  }

  const card = button.closest('.inbox-card');
  const id = card?.dataset.id;
  if (!id) {
    return;
  }

  const supabase = requireSupabase();
  const { data: submission, error } = await supabase
    .from('submissions')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !submission) {
    return;
  }

  const notesInput = card.querySelector('input[type="text"]');
  const notes = notesInput?.value.trim() || '';
  const action = button.dataset.action;

  button.disabled = true;
  try {
    const adminAction =
      action === 'reject-approved' ? 'reject' : action === 'approve' ? 'approve' : action;

    if (
      adminAction === 'return-to-queue' ||
      adminAction === 'reject' ||
      adminAction === 'approve' ||
      adminAction === 'restore' ||
      adminAction === 'archive'
    ) {
      await applyAdminAction(submission, adminAction, notes);
      await reloadAdminData();
      showMessage(
        adminMessage,
        adminActionSuccessMessage(adminAction, submission),
        adminAction === 'approve' || adminAction === 'restore' ? 'success' : adminAction === 'reject' ? 'info' : 'success',
      );
      return;
    }
  } catch (err) {
    showMessage(null, err.message, 'error');
    button.disabled = false;
  }
}

inboxEl?.addEventListener('click', handleSubmissionCardClick);
rejectedInboxEl?.addEventListener('click', handleSubmissionCardClick);

archivedSubmissionsEl?.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) {
    return;
  }

  const card = button.closest('.inbox-card');
  const id = card?.dataset.id;
  if (!id) {
    return;
  }

  const action = button.dataset.action;
  button.disabled = true;

  try {
    if (action === 'delete-submission') {
      if (!window.confirm('Delete this archived submission permanently? This cannot be undone.')) {
        button.disabled = false;
        return;
      }
      await deleteSubmissionPermanently(id);
      await reloadAdminData();
      showMessage(adminMessage, 'Deleted permanently.', 'info');
      return;
    }

    if (action === 'restore-submission') {
      const supabase = requireSupabase();
      const { data: submission, error } = await supabase.from('submissions').select('*').eq('id', id).single();
      if (error || !submission) {
        return;
      }
      await applyAdminAction(submission, 'restore');
      await reloadAdminData();
      showMessage(adminMessage, adminActionSuccessMessage('restore', submission), 'success');
    }
  } catch (err) {
    showMessage(null, err.message, 'error');
    button.disabled = false;
  }
});

archivedOrphansEl?.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) {
    return;
  }

  const card = button.closest('.archived-card');
  const archiveId = card?.dataset.archiveId;
  if (!archiveId) {
    return;
  }

  const action = button.dataset.action;
  button.disabled = true;

  try {
    if (action === 'delete-orphan') {
      if (!window.confirm('Delete this archived item permanently? This cannot be undone.')) {
        button.disabled = false;
        return;
      }
      await deleteArchivedOrphan(archiveId);
      await reloadAdminData();
      showMessage(adminMessage, 'Deleted permanently.', 'info');
      return;
    }

    if (action === 'restore-orphan') {
      const session = await getSession();
      const actorId = session?.user?.id;
      if (!actorId) {
        throw new Error('Sign in required.');
      }
      await restoreArchivedOrphanToQueue(archiveId, actorId);
      await reloadAdminData();
      showMessage(adminMessage, 'Returned to the review queue.', 'success');
    }
  } catch (err) {
    showMessage(null, err.message, 'error');
    button.disabled = false;
  }
});

function handlePublishedClick(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) {
    return;
  }

  const action = button.dataset.action;
  if (action !== 'archive-published' && action !== 'revert-published') {
    return;
  }

  const card = button.closest('.published-card');
  const id = card?.dataset.id;
  const type = card?.dataset.type;
  if (!id || !type) {
    return;
  }

  const label = card.querySelector('h4')?.textContent || 'this item';

  if (action === 'revert-published') {
    if (
      !window.confirm(
        `Revert "${label}" to the previous version? The current live text will be saved so you can revert again.`,
      )
    ) {
      return;
    }

    button.disabled = true;
    getSession()
      .then(async (session) => {
        const actorId = session?.user?.id;
        if (!actorId) {
          throw new Error('Sign in required.');
        }
        const { restoredSubmissionId } = await revertPublishedToPreviousVersion(type, id, actorId);
        if (restoredSubmissionId) {
          await recordSubmissionEvent(
            restoredSubmissionId,
            'reverted',
            actorId,
            'Reverted to previous version on the live site.',
          );
        }
        await reloadAdminData();
        showMessage(adminMessage, 'Reverted to the previous version on the live site.', 'success');
      })
      .catch((err) => {
        showMessage(null, err.message, 'error');
        button.disabled = false;
      });
    return;
  }

  if (!window.confirm(`Archive "${label}"? It will be removed from the live website but kept in the archive.`)) {
    return;
  }

  button.disabled = true;
  archivePublishedAndSync(type, id)
    .then(({ snapshot, type: contentType, orphanArchiveId }) => {
      reloadAdminData();
      showUndoToast('Archived and removed from the website.', async () => {
        try {
          if (snapshot?.submission_id) {
            const session = await getSession();
            if (session?.user?.id) {
              await recordRestoredToQueue(snapshot.submission_id, session.user.id);
            }
          } else if (orphanArchiveId) {
            showMessage(
              null,
              'Undo for items without a submission link is not available. Use Return to queue from the Archive tab.',
              'info',
            );
            return;
          }
          await reloadAdminData();
          showMessage(adminMessage, 'Returned to the review queue.', 'success');
        } catch (undoError) {
          showMessage(null, undoError.message, 'error');
        }
      });
    })
    .catch((err) => {
      showMessage(null, err.message, 'error');
      button.disabled = false;
    });
}

publishedAnnouncementsEl?.addEventListener('click', handlePublishedClick);
publishedEventsEl?.addEventListener('click', handlePublishedClick);
publishedCompetitionsEl?.addEventListener('click', handlePublishedClick);
publishedClubsEl?.addEventListener('click', handlePublishedClick);

refreshUI();

if (isSupabaseConfigured) {
  requireSupabase().auth.onAuthStateChange(() => {
    refreshUI();
  });
}
