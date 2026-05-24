import { ensureAuthenticatedSession } from './auth.js';
import { isSupabaseConfigured, requireSupabase } from './supabase-client.js';
import { bindPublishedChangeRequests, initContextualSubmit } from './contextual-submit.js';
import {
  publishedClubToPayload,
  renderClubEntry,
  submissionPayloadToClub,
} from './entry-render.js';
import {
  fetchPendingForLive,
  PENDING_CONTENT_CHANGED,
  PENDING_GHOST_LABELS,
  renderPendingLiveNotice,
} from './pending-live.js';
import { repartitionPendingForLive } from './published-live.js';
import { dedupePublishedClubs } from './static-entry-supersede.js';

const LIVE_INJECTED_CLASS = 'live-injected';

let signedIn = false;
let submitterId = null;

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getClubList() {
  return document.querySelector('.clubs-page .club-list');
}

function clearLiveInjections() {
  document.querySelectorAll(`.club-entry.${LIVE_INJECTED_CLASS}`).forEach((node) => node.remove());
}

function appendLiveEntry(listEl, html) {
  if (!listEl) {
    return null;
  }

  const temp = document.createElement('div');
  temp.innerHTML = html.trim();
  const node = temp.firstElementChild;
  if (!node) {
    return null;
  }

  node.classList.add(LIVE_INJECTED_CLASS);
  listEl.appendChild(node);
  return node;
}

function renderChangeRequestButton(item, showChangeRequests) {
  if (!showChangeRequests || !item.id) {
    return '';
  }

  const payload = encodeURIComponent(JSON.stringify(publishedClubToPayload(item)));

  return `
    <div class="published-item-actions">
      <button
        type="button"
        class="text-link published-change-link"
        data-action="request-change"
        data-published-id="${escapeHtml(item.id)}"
        data-title="${escapeHtml(item.name || '')}"
        data-payload="${payload}"
      >Request a change</button>
    </div>
  `;
}

function renderPublishedClub(item, showChangeRequests) {
  const html = renderClubEntry(
    {
      school: item.school,
      name: item.name,
      description: item.description,
      contact: item.contact,
      eligibility: item.eligibility,
      period: item.period,
      notes: item.notes,
      link: item.link,
    },
    { publishedId: item.id },
  );

  if (!showChangeRequests) {
    return html;
  }

  return html.replace('</article>', `${renderChangeRequestButton(item, true)}</article>`);
}

function renderPendingClubGhost(submission) {
  const ghostLabel = PENDING_GHOST_LABELS[submission.intent] || 'Pending review';
  return renderClubEntry(submissionPayloadToClub(submission.payload), {
    ghost: true,
    ghostLabel,
  });
}

async function fetchPublishedClubs(supabase) {
  const withStatic = await supabase
    .from('published_clubs')
    .select('id, school, name, description, contact, eligibility, period, notes, link, published_at, static_entry_id')
    .order('published_at', { ascending: false });

  if (!withStatic.error) {
    return withStatic;
  }

  if (String(withStatic.error.message || '').includes('static_entry_id')) {
    return supabase
      .from('published_clubs')
      .select('id, school, name, description, contact, eligibility, period, notes, link, published_at')
      .order('published_at', { ascending: false });
  }

  throw withStatic.error;
}

async function loadClubs(showChangeRequests = false, viewerId = null) {
  if (!isSupabaseConfigured) {
    return;
  }

  clearLiveInjections();

  const noticeEl = document.getElementById('clubs-live-notice');
  if (noticeEl) {
    noticeEl.innerHTML = '';
  }

  const listEl = getClubList();
  if (!listEl) {
    return;
  }

  try {
    const supabase = requireSupabase();
    const [publishedResult, pending] = await Promise.all([
      fetchPublishedClubs(supabase),
      fetchPendingForLive(supabase, 'club', viewerId),
    ]);

    if (publishedResult.error) {
      throw publishedResult.error;
    }

    const published = dedupePublishedClubs(publishedResult.data || []);
    const hasPending = pending.length > 0;
    const { changeByTarget, pendingCreates } = repartitionPendingForLive(pending, published, 'club');

    if (noticeEl && hasPending) {
      noticeEl.innerHTML = renderPendingLiveNotice(true);
    }

    for (const item of published) {
      const node = appendLiveEntry(listEl, renderPublishedClub(item, showChangeRequests));
      const change = changeByTarget.get(item.id);
      if (change && node?.parentElement) {
        appendLiveEntry(node.parentElement, renderPendingClubGhost(change));
      }
    }

    for (const submission of pendingCreates) {
      appendLiveEntry(listEl, renderPendingClubGhost(submission));
    }
  } catch (error) {
    if (noticeEl) {
      noticeEl.innerHTML = `<p class="form-message form-message--error">${escapeHtml(error.message)}</p>`;
    }
  }
}

async function initClubsPage() {
  if (isSupabaseConfigured) {
    const session = await ensureAuthenticatedSession();
    signedIn = !!session;
    submitterId = session?.user?.id || null;
  }

  await loadClubs(signedIn, submitterId);

  if (signedIn) {
    await initContextualSubmit({
      contentType: 'club',
      buttonLabel: 'Propose a club',
    });
    const pageRoot = document.querySelector('.clubs-page');
    bindPublishedChangeRequests(pageRoot, 'club');
  }

  window.addEventListener(PENDING_CONTENT_CHANGED, () => {
    loadClubs(signedIn, submitterId);
  });
}

initClubsPage();
