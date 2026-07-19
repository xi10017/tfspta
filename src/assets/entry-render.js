function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export const COMPETITION_CATEGORIES = [
  'Math',
  'Science',
  'Debate',
  'Robotics',
  'Chess',
  'Latin',
  'Social Sciences',
  'MISC',
];

const CATEGORY_IDS = {
  Math: 'math',
  Science: 'science',
  Debate: 'debate',
  Robotics: 'robotics',
  Chess: 'chess',
  Latin: 'latin',
  'Social Sciences': 'social-sciences',
  MISC: 'misc',
};

export function categoryToId(category) {
  return CATEGORY_IDS[category] || String(category || 'misc').toLowerCase().replace(/\s+/g, '-');
}

function renderLink(label, link) {
  if (!link) {
    return '';
  }

  const safeLink = escapeHtml(link);
  return `<p class="entry-link-wrap"><a class="entry-link" href="${safeLink}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a></p>`;
}

export function renderCompetitionEntry(item, { ghost = false, ghostLabel = 'Pending review', publishedId = '' } = {}) {
  const badge = ghost
    ? `<span class="ghost-preview-badge">${escapeHtml(ghostLabel)}</span>`
    : '<span class="entry-status-badge entry-status-badge--published">Published</span>';

  return `
    <article class="competition-entry${ghost ? ' ghost-preview-card entry-entry--pending' : ' entry-entry--published'}"${publishedId ? ` data-published-id="${escapeHtml(publishedId)}"` : ''}>
      ${badge}
      ${item.image_url ? `<img class="entry-image" src="${escapeHtml(item.image_url)}" alt="">` : ''}
      <div class="entry-header">
        <h4>${escapeHtml(item.name || 'Competition name')}</h4>
        ${item.level ? `<span class="entry-level">${escapeHtml(item.level)}</span>` : ''}
      </div>
      <p class="entry-description">${escapeHtml(item.description || '')}</p>
      <dl class="entry-details">
        <div><dt>Format</dt><dd>${escapeHtml(item.format || '—')}</dd></div>
        <div><dt>Coach / contact</dt><dd>${escapeHtml(item.contact || '—')}</dd></div>
        <div><dt>Eligibility</dt><dd>${escapeHtml(item.eligibility || '—')}</dd></div>
        <div><dt>Season</dt><dd>${escapeHtml(item.period || '—')}</dd></div>
      </dl>
      ${renderLink('Official information →', item.link)}
    </article>
  `;
}

export function renderClubEntry(item, { ghost = false, ghostLabel = 'Pending review', publishedId = '' } = {}) {
  const badge = ghost
    ? `<span class="ghost-preview-badge">${escapeHtml(ghostLabel)}</span>`
    : '<span class="entry-status-badge entry-status-badge--published">Published</span>';

  const schoolTag = item.school
    ? `<span class="info-tag">${escapeHtml(item.school)}</span>`
    : '';

  return `
    <article class="club-entry${ghost ? ' ghost-preview-card entry-entry--pending' : ' entry-entry--published'}"${publishedId ? ` data-published-id="${escapeHtml(publishedId)}"` : ''}>
      ${badge}
      ${item.image_url ? `<img class="entry-image" src="${escapeHtml(item.image_url)}" alt="">` : ''}
      ${schoolTag}
      <h4>${escapeHtml(item.name || 'Club name')}</h4>
      <p class="entry-description">${escapeHtml(item.description || '')}</p>
      <dl class="entry-details">
        <div><dt>Contact</dt><dd>${escapeHtml(item.contact || '—')}</dd></div>
        <div><dt>Eligibility</dt><dd>${escapeHtml(item.eligibility || '—')}</dd></div>
        <div><dt>Schedule</dt><dd>${escapeHtml(item.period || '—')}</dd></div>
      </dl>
      ${item.notes ? `<p class="entry-notes">${escapeHtml(item.notes)}</p>` : ''}
      ${renderLink('Learn more →', item.link)}
    </article>
  `;
}

export function publishedCompetitionToPayload(item) {
  return {
    category: item.category || 'MISC',
    name: item.name || '',
    description: item.description || '',
    format: item.format || '',
    contact: item.contact || '',
    eligibility: item.eligibility || '',
    period: item.period || '',
    level: item.level || '',
    link: item.link || '',
    image_url: item.image_url || '',
    image_path: item.image_path || '',
    ...(item.static_entry_id ? { static_entry_id: item.static_entry_id } : {}),
  };
}

export function publishedClubToPayload(item) {
  return {
    school: item.school || '',
    name: item.name || '',
    description: item.description || '',
    contact: item.contact || '',
    eligibility: item.eligibility || '',
    period: item.period || '',
    notes: item.notes || '',
    link: item.link || '',
    image_url: item.image_url || '',
    image_path: item.image_path || '',
    ...(item.static_entry_id ? { static_entry_id: item.static_entry_id } : {}),
  };
}

export function submissionPayloadToCompetition(payload) {
  return {
    category: payload.category || 'MISC',
    name: payload.name || '',
    description: payload.description || payload.body || '',
    format: payload.format || '',
    contact: payload.contact || '',
    eligibility: payload.eligibility || '',
    period: payload.period || '',
    level: payload.level || '',
    link: payload.link || '',
    image_url: payload.image_url || '',
    image_path: payload.image_path || '',
  };
}

export function submissionPayloadToClub(payload) {
  return {
    school: payload.school || '',
    name: payload.name || '',
    description: payload.description || payload.body || '',
    contact: payload.contact || '',
    eligibility: payload.eligibility || '',
    period: payload.period || '',
    notes: payload.notes || '',
    link: payload.link || '',
    image_url: payload.image_url || '',
    image_path: payload.image_path || '',
  };
}
