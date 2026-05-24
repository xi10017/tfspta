import { ensureAuthenticatedSession } from './auth.js';
import { isSupabaseConfigured, requireSupabase } from './supabase-client.js';
import { bindPublishedChangeRequests, initContextualSubmit } from './contextual-submit.js';
import { publishedItemToPayload } from './submission-workflow.js';
import {
  fetchPendingForLive,
  partitionPendingSubmissions,
  PENDING_CONTENT_CHANGED,
  renderPendingGhost,
  renderPendingLiveNotice,
} from './pending-live.js';
import {
  campusLabel,
  escapeHtml,
  formatDisplayDate,
  groupEventsByDate,
  matchesCampusFilter,
  renderCalendarControls,
  renderCampusLegend,
  renderMonthGrid,
  toDateKey,
} from './calendar-month.js';

const liveRoot = document.getElementById('calendar-live');
const staticFallback = document.getElementById('calendar-static-fallback');

let signedIn = false;
let submitterId = null;
let allEvents = [];
let viewYear = new Date().getFullYear();
let viewMonth = new Date().getMonth();
let selectedDate = toDateKey(new Date());
let campusFilter = '';
let hasPendingGhosts = false;
let hasInitializedView = false;

function normalizePublishedEvent(item) {
  return {
    id: item.id,
    title: item.title,
    school: item.school || '',
    location: item.location || '',
    body: item.body || '',
    date: item.event_date,
    ghost: false,
    changeRequest: null,
    source: item,
  };
}

function normalizePendingEvent(submission) {
  return {
    id: submission.id,
    title: submission.payload?.title || 'Untitled',
    school: submission.payload?.school || '',
    location: submission.payload?.location || '',
    body: submission.payload?.body || '',
    date: submission.payload?.date || null,
    ghost: true,
    intent: submission.intent,
    changeRequest: null,
    source: submission,
  };
}

function buildEventList(published, pending) {
  const { changeByTarget, pendingCreates } = partitionPendingSubmissions(pending, 'event');
  const events = [];

  for (const item of published) {
    events.push(normalizePublishedEvent(item));
    const change = changeByTarget.get(item.id);
    if (change) {
      events.push({
        ...normalizePendingEvent(change),
        changeRequest: item.id,
      });
    }
  }

  for (const submission of pendingCreates) {
    events.push(normalizePendingEvent(submission));
  }

  return events;
}

function getFilteredEvents() {
  return allEvents.filter((event) => matchesCampusFilter(event, campusFilter));
}

function renderChangeRequestButton(item, showChangeRequests) {
  if (!showChangeRequests || !item.id || item.ghost) {
    return '';
  }

  const payload = encodeURIComponent(JSON.stringify(publishedItemToPayload(item.source, 'event')));

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

function renderEventCard(event, showChangeRequests) {
  if (event.ghost) {
    return renderPendingGhost(event.source, 'event');
  }

  const schoolTag = event.school
    ? `<span class="event-school-tag">${escapeHtml(campusLabel(event.school))}</span>`
    : `<span class="event-school-tag">${escapeHtml(campusLabel(event.school))}</span>`;

  return `
    <article class="event-card event-card--published" data-published-id="${escapeHtml(event.id || '')}">
      <span class="event-status-badge event-status-badge--published">Published</span>
      ${schoolTag}
      <time class="event-date" datetime="${escapeHtml(event.date || '')}">${escapeHtml(formatDisplayDate(event.date))}</time>
      <h4>${escapeHtml(event.title)}</h4>
      ${event.location ? `<p class="event-location">${escapeHtml(event.location)}</p>` : ''}
      ${event.body ? `<p>${escapeHtml(event.body)}</p>` : ''}
      ${renderChangeRequestButton(event, showChangeRequests)}
    </article>
  `;
}

function renderDayDetail(events, showChangeRequests) {
  if (!selectedDate) {
    return `
      <section class="calendar-day-detail calendar-day-detail--empty" aria-live="polite">
        <h3 class="calendar-day-detail-title">Select a day</h3>
        <p class="calendar-day-detail-empty">Choose a date on the calendar to see events.</p>
      </section>
    `;
  }

  const dayEvents = events.filter((event) => toDateKey(event.date) === selectedDate);
  const publishedEvents = dayEvents.filter((event) => !event.ghost);
  const pendingEvents = dayEvents.filter((event) => event.ghost);

  if (!dayEvents.length) {
    return `
      <section class="calendar-day-detail" aria-live="polite">
        <h3 class="calendar-day-detail-title">${escapeHtml(formatDisplayDate(selectedDate))}</h3>
        <p class="calendar-day-detail-empty">No events scheduled for this day.</p>
      </section>
    `;
  }

  function renderEventGroup(title, items, className) {
    if (!items.length) {
      return '';
    }

    return `
      <div class="calendar-day-detail-group${className ? ` ${className}` : ''}">
        <h4 class="calendar-day-detail-group-title">${escapeHtml(title)}</h4>
        <div class="calendar-day-detail-list">
          ${items.map((event) => renderEventCard(event, showChangeRequests)).join('')}
        </div>
      </div>
    `;
  }

  return `
    <section class="calendar-day-detail" aria-live="polite">
      <h3 class="calendar-day-detail-title">${escapeHtml(formatDisplayDate(selectedDate))}</h3>
      ${renderEventGroup('Published', publishedEvents, 'calendar-day-detail-group--published')}
      ${renderEventGroup('Your pending review', pendingEvents, 'calendar-day-detail-group--pending')}
    </section>
  `;
}

function renderUndatedSection(events, showChangeRequests) {
  const undated = events.filter((event) => !toDateKey(event.date));
  if (!undated.length) {
    return '';
  }

  const published = undated.filter((event) => !event.ghost);
  const pending = undated.filter((event) => event.ghost);

  function renderGroup(title, items, className) {
    if (!items.length) {
      return '';
    }

    return `
      <div class="calendar-undated-group${className ? ` ${className}` : ''}">
        <h4 class="calendar-day-detail-group-title">${escapeHtml(title)}</h4>
        <div class="events-grid">
          ${items.map((event) => renderEventCard(event, showChangeRequests)).join('')}
        </div>
      </div>
    `;
  }

  return `
    <section class="calendar-undated">
      <h3 class="school-tier-title">Date TBA</h3>
      ${renderGroup('Published', published, 'calendar-day-detail-group--published')}
      ${renderGroup('Your pending review', pending, 'calendar-day-detail-group--pending')}
    </section>
  `;
}

function renderCalendarView(showChangeRequests) {
  const filtered = getFilteredEvents();
  const { byDate, undated } = groupEventsByDate(filtered);

  return `
    ${renderCalendarControls({ year: viewYear, month: viewMonth, campusFilter })}
    ${renderCampusLegend()}
    <div class="calendar-layout">
      ${renderMonthGrid({ year: viewYear, month: viewMonth, byDate, selectedDate })}
      ${renderDayDetail(filtered, showChangeRequests)}
    </div>
    ${undated.length ? renderUndatedSection(filtered, showChangeRequests) : ''}
  `;
}

function renderPage(showChangeRequests, hasPending) {
  liveRoot.innerHTML = `${renderPendingLiveNotice(hasPending)}${renderCalendarView(showChangeRequests)}`;
}

function pickInitialSelection(events) {
  if (hasInitializedView) {
    return;
  }

  const today = toDateKey(new Date());
  const dated = events.filter((event) => toDateKey(event.date));
  const hasToday = dated.some((event) => toDateKey(event.date) === today);

  if (hasToday) {
    selectedDate = today;
    return;
  }

  const upcoming = dated
    .map((event) => toDateKey(event.date))
    .filter(Boolean)
    .sort()
    .find((key) => key >= today);

  if (upcoming) {
    selectedDate = upcoming;
    const [year, month] = upcoming.split('-').map(Number);
    viewYear = year;
    viewMonth = month - 1;
    return;
  }

  if (dated.length) {
    const last = dated.map((event) => toDateKey(event.date)).sort().at(-1);
    selectedDate = last;
    const [year, month] = last.split('-').map(Number);
    viewYear = year;
    viewMonth = month - 1;
    return;
  }

  selectedDate = today;
  hasInitializedView = true;
}

function handleCalendarInteraction(event) {
  const target = event.target.closest('[data-action]');
  if (!target || !liveRoot.contains(target)) {
    return;
  }

  const action = target.dataset.action;

  if (action === 'cal-prev-month') {
    viewMonth -= 1;
    if (viewMonth < 0) {
      viewMonth = 11;
      viewYear -= 1;
    }
    renderPage(signedIn, hasPendingGhosts);
    return;
  }

  if (action === 'cal-next-month') {
    viewMonth += 1;
    if (viewMonth > 11) {
      viewMonth = 0;
      viewYear += 1;
    }
    renderPage(signedIn, hasPendingGhosts);
    return;
  }

  if (action === 'cal-today') {
    const now = new Date();
    viewYear = now.getFullYear();
    viewMonth = now.getMonth();
    selectedDate = toDateKey(now);
    renderPage(signedIn, hasPendingGhosts);
    return;
  }

  if (action === 'cal-select-day') {
    selectedDate = target.dataset.date || null;
    renderPage(signedIn, hasPendingGhosts);
    return;
  }

  if (action === 'cal-campus-filter' && target instanceof HTMLSelectElement) {
    campusFilter = target.value;
    renderPage(signedIn, hasPendingGhosts);
  }
}

async function loadEvents(showChangeRequests = false, viewerId = null) {
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
        .from('published_events')
        .select('id, school, title, location, body, event_date, published_at')
        .order('event_date', { ascending: true, nullsFirst: false })
        .order('published_at', { ascending: false }),
      fetchPendingForLive(supabase, 'event', viewerId),
    ]);

    if (publishedResult.error) {
      throw publishedResult.error;
    }

    const published = publishedResult.data || [];
    const hasPending = pending.length > 0;
    hasPendingGhosts = hasPending;
    allEvents = buildEventList(published, pending);

    if (!allEvents.length) {
      hasInitializedView = false;
      liveRoot.innerHTML = '<p class="empty-live">No published calendar events yet.</p>';
      if (staticFallback) {
        staticFallback.hidden = false;
      }
      return;
    }

    pickInitialSelection(allEvents);
    renderPage(showChangeRequests, hasPending);

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

async function initCalendarPage() {
  if (isSupabaseConfigured) {
    const session = await ensureAuthenticatedSession();
    signedIn = !!session;
    submitterId = session?.user?.id || null;
  }

  liveRoot?.addEventListener('click', handleCalendarInteraction);
  liveRoot?.addEventListener('change', handleCalendarInteraction);

  await loadEvents(signedIn, submitterId);

  if (signedIn) {
    await initContextualSubmit({
      contentType: 'event',
      buttonLabel: 'Propose an event',
    });
    bindPublishedChangeRequests(liveRoot, 'event');
  }

  window.addEventListener(PENDING_CONTENT_CHANGED, () => {
    loadEvents(signedIn, submitterId);
  });
}

initCalendarPage();
