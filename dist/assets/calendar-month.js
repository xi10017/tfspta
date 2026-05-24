const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const CAMPUS_FILTERS = [
  { value: '', label: 'All campuses' },
  { value: 'Middle School', label: 'Middle School' },
  { value: 'High School', label: 'High School' },
  { value: 'district', label: 'Both campuses' },
];

export function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function toDateKey(value) {
  if (!value) {
    return null;
  }

  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDisplayDate(value) {
  const key = toDateKey(value);
  if (!key) {
    return 'Date TBA';
  }

  return new Date(`${key}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function formatMonthYear(year, month) {
  return new Date(year, month, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
}

export function campusClass(school) {
  if (school === 'Middle School') {
    return 'campus-ms';
  }
  if (school === 'High School') {
    return 'campus-hs';
  }
  return 'campus-district';
}

export function campusLabel(school) {
  if (school === 'Middle School') {
    return 'Middle School';
  }
  if (school === 'High School') {
    return 'High School';
  }
  return 'Both campuses';
}

export function matchesCampusFilter(event, filter) {
  if (!filter) {
    return true;
  }
  if (filter === 'district') {
    return !event.school;
  }
  return event.school === filter;
}

export function buildMonthCells(year, month) {
  const firstOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingBlanks = firstOfMonth.getDay();
  const cells = [];

  for (let i = 0; i < leadingBlanks; i += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(year, month, day));
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
}

export function groupEventsByDate(events) {
  const byDate = new Map();
  const undated = [];

  for (const event of events) {
    const key = toDateKey(event.date);
    if (!key) {
      undated.push(event);
      continue;
    }

    if (!byDate.has(key)) {
      byDate.set(key, []);
    }
    byDate.get(key).push(event);
  }

  return { byDate, undated };
}

export function renderCalendarControls({ year, month, campusFilter }) {
  const filterOptions = CAMPUS_FILTERS.map(
    (option) =>
      `<option value="${escapeHtml(option.value)}"${option.value === campusFilter ? ' selected' : ''}>${escapeHtml(option.label)}</option>`,
  ).join('');

  return `
    <div class="calendar-controls">
      <div class="calendar-controls-nav">
        <button type="button" class="btn btn-secondary btn-sm calendar-nav-btn" data-action="cal-prev-month" aria-label="Previous month">‹</button>
        <h2 class="calendar-month-label">${escapeHtml(formatMonthYear(year, month))}</h2>
        <button type="button" class="btn btn-secondary btn-sm calendar-nav-btn" data-action="cal-next-month" aria-label="Next month">›</button>
        <button type="button" class="btn btn-secondary btn-sm" data-action="cal-today">Today</button>
      </div>
      <div class="calendar-controls-filter">
        <label class="visually-hidden" for="calendar-campus-filter">Filter by campus</label>
        <select id="calendar-campus-filter" class="calendar-campus-filter" data-action="cal-campus-filter">
          ${filterOptions}
        </select>
      </div>
    </div>
  `;
}

export function renderMonthGrid({ year, month, byDate, selectedDate }) {
  const todayKey = toDateKey(new Date());
  const cells = buildMonthCells(year, month);

  const weekdayHeader = WEEKDAY_LABELS.map(
    (label) => `<div class="calendar-weekday">${escapeHtml(label)}</div>`,
  ).join('');

  const dayCells = cells
    .map((date) => {
      if (!date) {
        return '<div class="calendar-day calendar-day--blank" aria-hidden="true"></div>';
      }

      const dateKey = toDateKey(date);
      const events = byDate.get(dateKey) || [];
      const isToday = dateKey === todayKey;
      const isSelected = dateKey === selectedDate;
      const hasEvents = events.length > 0;

      const dots = events
        .slice(0, 3)
        .map(
          (event) =>
            `<span class="calendar-event-dot ${campusClass(event.school)}${event.ghost ? ' calendar-event-dot--pending' : ' calendar-event-dot--published'}" title="${escapeHtml(event.title)}${event.ghost ? ' (pending review)' : ''}"></span>`,
        )
        .join('');

      const publishedCount = events.filter((event) => !event.ghost).length;
      const pendingCount = events.filter((event) => event.ghost).length;
      const ariaParts = [];
      if (publishedCount) {
        ariaParts.push(`${publishedCount} published event${publishedCount === 1 ? '' : 's'}`);
      }
      if (pendingCount) {
        ariaParts.push(`${pendingCount} pending event${pendingCount === 1 ? '' : 's'}`);
      }
      const eventAria = ariaParts.length ? `, ${ariaParts.join(', ')}` : '';
      const overflow =
        events.length > 3
          ? `<span class="calendar-event-overflow">+${events.length - 3}</span>`
          : '';

      return `
        <button
          type="button"
          class="calendar-day${isToday ? ' calendar-day--today' : ''}${isSelected ? ' calendar-day--selected' : ''}${hasEvents ? ' calendar-day--has-events' : ''}${publishedCount ? ' calendar-day--has-published' : ''}${pendingCount ? ' calendar-day--has-pending' : ''}"
          data-action="cal-select-day"
          data-date="${dateKey}"
          aria-label="${escapeHtml(formatDisplayDate(dateKey))}${eventAria}"
          aria-pressed="${isSelected ? 'true' : 'false'}"
        >
          <span class="calendar-day-number">${date.getDate()}</span>
          ${hasEvents ? `<span class="calendar-day-dots">${dots}${overflow}</span>` : ''}
        </button>
      `;
    })
    .join('');

  return `
    <div class="calendar-month" role="grid" aria-label="${escapeHtml(formatMonthYear(year, month))}">
      <div class="calendar-weekdays">${weekdayHeader}</div>
      <div class="calendar-days">${dayCells}</div>
    </div>
  `;
}

export function renderCampusLegend() {
  return `
    <ul class="calendar-legend" aria-label="Calendar legend">
      <li class="calendar-legend-group">
        <span class="calendar-legend-heading">Campus</span>
        <ul class="calendar-legend-sublist">
          <li><span class="calendar-legend-dot campus-ms calendar-event-dot--published"></span> Middle School</li>
          <li><span class="calendar-legend-dot campus-hs calendar-event-dot--published"></span> High School</li>
          <li><span class="calendar-legend-dot campus-district calendar-event-dot--published"></span> Both campuses</li>
        </ul>
      </li>
      <li class="calendar-legend-group">
        <span class="calendar-legend-heading">Status</span>
        <ul class="calendar-legend-sublist">
          <li><span class="calendar-legend-dot campus-ms calendar-event-dot--published"></span> Published</li>
          <li><span class="calendar-legend-dot campus-ms calendar-event-dot--pending"></span> Your pending review</li>
        </ul>
      </li>
    </ul>
  `;
}

export { CAMPUS_FILTERS };
