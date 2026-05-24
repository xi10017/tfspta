import { ensureAuthenticatedSession } from './auth.js';
import { isSupabaseConfigured, requireSupabase } from './supabase-client.js';
import { bindPublishedChangeRequests, initContextualSubmit } from './contextual-submit.js';
import { publishedItemToPayload } from './submission-workflow.js';
import {
  buildTimelineEntries,
  changesForTier,
  fetchPendingForLive,
  partitionPendingSubmissions,
  PENDING_CONTENT_CHANGED,
  renderPendingGhost,
  renderPendingLiveNotice,
} from './pending-live.js';

const liveRoot = document.getElementById('announcements-live');
const staticFallback = document.getElementById('announcements-static-fallback');

const tierOrder = [
  { key: 'Middle School', label: 'Middle School' },
  { key: 'High School', label: 'High School' },
  { key: '', label: 'District-wide' },
];

let signedIn = false;
let submitterId = null;

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDisplayDate(value) {
  if (!value) {
    return '';
  }
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function renderChangeRequestButton(item, showChangeRequests) {
  if (!showChangeRequests || !item.id) {
    return '';
  }

  const payload = encodeURIComponent(JSON.stringify(publishedItemToPayload(item, 'announcement')));

  return `
    <div class="published-item-actions">
      <button
        type="button"
        class="text-link published-change-link"
        data-action="request-change"
        data-published-id="${escapeHtml(item.id)}"
        data-title="${escapeHtml(item.title || '')}"
        data-payload="${payload}"
      >Request a change</button>
    </div>
  `;
}

function renderAnnouncement(item, showChangeRequests) {
  const schoolTag = item.school
    ? `<span class="info-tag">${escapeHtml(item.school)}</span>`
    : '';
  const date = formatDisplayDate(item.announcement_date);

  return `
    <article class="announcement-card" data-published-id="${escapeHtml(item.id || '')}">
      ${schoolTag}
      ${date ? `<time class="announcement-date">${escapeHtml(date)}</time>` : ''}
      <h4>${escapeHtml(item.title)}</h4>
      <p>${escapeHtml(item.body)}</p>
      ${renderChangeRequestButton(item, showChangeRequests)}
    </article>
  `;
}

function renderTierTimeline(label, entries, changeByTarget, showChangeRequests) {
  if (!entries.length) {
    return '';
  }

  const html = entries
    .map((entry) => {
      if (entry.kind === 'ghost') {
        return renderPendingGhost(entry.submission, 'announcement');
      }

      const publishedHtml = renderAnnouncement(entry.item, showChangeRequests);
      const change = changeByTarget.get(entry.item.id);
      if (!change) {
        return publishedHtml;
      }

      return `${publishedHtml}${renderPendingGhost(change, 'announcement')}`;
    })
    .join('');

  return `
    <div class="school-tier">
      <h3 class="school-tier-title">${escapeHtml(label)}</h3>
      <div class="announcements-list">
        ${html}
      </div>
    </div>
  `;
}

function groupByTier(items, getSchool) {
  const grouped = Object.fromEntries(tierOrder.map((tier) => [tier.key, []]));

  for (const item of items) {
    const key = getSchool(item) || '';
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(item);
  }

  return grouped;
}

async function loadAnnouncements(showChangeRequests = false, viewerId = null) {
  if (!liveRoot) {
    return;
  }

  if (!isSupabaseConfigured) {
    liveRoot.innerHTML = '';
    if (staticFallback) {
      staticFallback.hidden = false;
    }
    return;
  }

  try {
    const supabase = requireSupabase();
    const [publishedResult, pending] = await Promise.all([
      supabase
        .from('published_announcements')
        .select('id, school, title, body, announcement_date, published_at')
        .order('announcement_date', { ascending: false, nullsFirst: false })
        .order('published_at', { ascending: false }),
      fetchPendingForLive(supabase, 'announcement', viewerId),
    ]);

    if (publishedResult.error) {
      throw publishedResult.error;
    }

    const published = publishedResult.data || [];
    const hasPending = pending.length > 0;
    const { changeByTarget, pendingCreates } = partitionPendingSubmissions(pending, 'announcement');

    if (!published.length && !hasPending) {
      liveRoot.innerHTML = '<p class="empty-live">No published announcements yet. Check back soon.</p>';
      if (staticFallback) {
        staticFallback.hidden = false;
      }
      return;
    }

    const publishedByTier = groupByTier(published, (item) => item.school);
    const pendingCreatesByTier = groupByTier(pendingCreates, (item) => item.payload?.school);

    const tierHtml = tierOrder
      .map((tier) => {
        const tierPublished = publishedByTier[tier.key] || [];
        const tierCreates = pendingCreatesByTier[tier.key] || [];
        const tierChanges = changesForTier(changeByTarget, tierPublished);
        const entries = buildTimelineEntries(tierPublished, tierCreates, 'announcement');
        return renderTierTimeline(tier.label, entries, tierChanges, showChangeRequests);
      })
      .filter(Boolean)
      .join('');

    liveRoot.innerHTML = `${renderPendingLiveNotice(hasPending)}${tierHtml || '<p class="empty-live">No announcements in this view yet.</p>'}`;

    if (staticFallback) {
      staticFallback.hidden = true;
    }
  } catch (error) {
    liveRoot.innerHTML = `<p class="form-message form-message--error">${escapeHtml(error.message)}</p>`;
    if (staticFallback) {
      staticFallback.hidden = false;
    }
  }
}

async function initAnnouncementsPage() {
  if (isSupabaseConfigured) {
    const session = await ensureAuthenticatedSession();
    signedIn = !!session;
    submitterId = session?.user?.id || null;
  }

  await loadAnnouncements(signedIn, submitterId);

  if (signedIn) {
    await initContextualSubmit({
      contentType: 'announcement',
      buttonLabel: 'Propose an announcement',
    });
    bindPublishedChangeRequests(liveRoot, 'announcement');
  }

  window.addEventListener(PENDING_CONTENT_CHANGED, () => {
    loadAnnouncements(signedIn, submitterId);
  });
}

initAnnouncementsPage();
