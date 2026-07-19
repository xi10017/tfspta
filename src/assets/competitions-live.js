import { ensureAuthenticatedSession } from './auth.js';
import { isSupabaseConfigured, requireSupabase } from './supabase-client.js';
import { bindPublishedChangeRequests, initContextualSubmit } from './contextual-submit.js';
import {
  categoryToId,
  publishedCompetitionToPayload,
  renderCompetitionEntry,
  submissionPayloadToCompetition,
} from './entry-render.js';
import {
  fetchPendingForLive,
  PENDING_CONTENT_CHANGED,
  PENDING_GHOST_LABELS,
  renderPendingLiveNotice,
} from './pending-live.js';
import { repartitionPendingForLive } from './published-live.js';
import { dedupePublishedCompetitions } from './static-entry-supersede.js';

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

function getCategoryList(category) {
  const id = categoryToId(category);
  return document.querySelector(`#${id} .competition-list`);
}

function clearLiveInjections() {
  document.querySelectorAll(`.competition-entry.${LIVE_INJECTED_CLASS}`).forEach((node) => node.remove());
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

  const payload = encodeURIComponent(JSON.stringify(publishedCompetitionToPayload(item)));

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

function renderPublishedCompetition(item, showChangeRequests) {
  const html = renderCompetitionEntry(
    {
      name: item.name,
      description: item.description,
      format: item.format,
      contact: item.contact,
      eligibility: item.eligibility,
      period: item.period,
      level: item.level,
      link: item.link,
      image_url: item.image_url,
      image_path: item.image_path,
    },
    { publishedId: item.id },
  );

  if (!showChangeRequests) {
    return html;
  }

  return html.replace('</article>', `${renderChangeRequestButton(item, true)}</article>`);
}

function renderPendingCompetitionGhost(submission) {
  const ghostLabel = PENDING_GHOST_LABELS[submission.intent] || 'Pending review';
  return renderCompetitionEntry(submissionPayloadToCompetition(submission.payload), {
    ghost: true,
    ghostLabel,
  });
}

async function fetchPublishedCompetitions(supabase) {
  const withStatic = await supabase
      .from('published_competitions')
      .select('id, category, name, description, format, contact, eligibility, period, level, link, image_url, image_path, published_at, static_entry_id')
    .order('published_at', { ascending: false });

  if (!withStatic.error) {
    return withStatic;
  }

  if (String(withStatic.error.message || '').includes('static_entry_id')) {
    return supabase
      .from('published_competitions')
      .select('id, category, name, description, format, contact, eligibility, period, level, link, image_url, image_path, published_at')
      .order('published_at', { ascending: false });
  }

  throw withStatic.error;
}

async function loadCompetitions(showChangeRequests = false, viewerId = null) {
  if (!isSupabaseConfigured) {
    return;
  }

  clearLiveInjections();

  const noticeEl = document.getElementById('competitions-live-notice');
  if (noticeEl) {
    noticeEl.innerHTML = '';
  }

  try {
    const supabase = requireSupabase();
    const [publishedResult, pending] = await Promise.all([
      fetchPublishedCompetitions(supabase),
      fetchPendingForLive(supabase, 'competition', viewerId),
    ]);

    if (publishedResult.error) {
      throw publishedResult.error;
    }

    const published = dedupePublishedCompetitions(publishedResult.data || []);
    const hasPending = pending.length > 0;
    const { changeByTarget, pendingCreates } = repartitionPendingForLive(pending, published, 'competition');

    if (noticeEl && hasPending) {
      noticeEl.innerHTML = renderPendingLiveNotice(true);
    }

    for (const item of published) {
      const listEl = getCategoryList(item.category);
      const node = appendLiveEntry(listEl, renderPublishedCompetition(item, showChangeRequests));
      const change = changeByTarget.get(item.id);
      if (change && node?.parentElement) {
        appendLiveEntry(node.parentElement, renderPendingCompetitionGhost(change));
      }
    }

    for (const submission of pendingCreates) {
      const category = submission.payload?.category || 'MISC';
      const listEl = getCategoryList(category);
      appendLiveEntry(listEl, renderPendingCompetitionGhost(submission));
    }
  } catch (error) {
    if (noticeEl) {
      noticeEl.innerHTML = `<p class="form-message form-message--error">${escapeHtml(error.message)}</p>`;
    }
  }
}

async function initCompetitionsPage() {
  if (isSupabaseConfigured) {
    const session = await ensureAuthenticatedSession();
    signedIn = !!session;
    submitterId = session?.user?.id || null;
  }

  await loadCompetitions(signedIn, submitterId);

  if (signedIn) {
    await initContextualSubmit({
      contentType: 'competition',
      buttonLabel: 'Propose a competition',
    });
    const pageRoot = document.querySelector('.competitions-page');
    bindPublishedChangeRequests(pageRoot, 'competition');
  }

  window.addEventListener(PENDING_CONTENT_CHANGED, () => {
    loadCompetitions(signedIn, submitterId);
  });
}

initCompetitionsPage();
