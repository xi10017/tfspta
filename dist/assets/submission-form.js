import {
  COMPETITION_CATEGORIES,
  renderClubEntry,
  renderCompetitionEntry,
  submissionPayloadToClub,
  submissionPayloadToCompetition,
} from './entry-render.js';

export const schoolOptions = `
  <option value="">District-wide</option>
  <option value="Middle School">Middle School</option>
  <option value="High School">High School</option>
`;

export function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function formatDisplayDate(value) {
  if (!value) {
    return '';
  }
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function fieldId(idPrefix, name) {
  return idPrefix ? `${idPrefix}${name}` : name;
}

function detailField(fid, label, name, { required = false, type = 'text', rows = null, maxlength = 200 } = {}) {
  if (rows) {
    return `
      <div class="form-field">
        <label for="${fid(name)}">${label}</label>
        <textarea id="${fid(name)}" name="${name}" rows="${rows}"${required ? ' required' : ''} maxlength="${maxlength}"></textarea>
      </div>
    `;
  }

  return `
    <div class="form-field">
      <label for="${fid(name)}">${label}</label>
      <input id="${fid(name)}" name="${name}" type="${type}"${required ? ' required' : ''} maxlength="${maxlength}">
    </div>
  `;
}

export function getSubmissionFormHtml(type, { idPrefix = 'ctx-' } = {}) {
  const fid = (name) => fieldId(idPrefix, name);

  if (type === 'event') {
    return `
      <div class="form-field">
        <label for="${fid('school')}">Campus</label>
        <select id="${fid('school')}" name="school">${schoolOptions}</select>
      </div>
      <div class="form-field">
        <label for="${fid('title')}">Event title</label>
        <input id="${fid('title')}" name="title" type="text" required maxlength="200">
      </div>
      <div class="form-field">
        <label for="${fid('event-date')}">Event date (optional)</label>
        <input id="${fid('event-date')}" name="event-date" type="date">
      </div>
      <div class="form-field">
        <label for="${fid('location')}">Location</label>
        <input id="${fid('location')}" name="location" type="text" maxlength="200">
      </div>
      <div class="form-field">
        <label for="${fid('body')}">Description</label>
        <textarea id="${fid('body')}" name="body" rows="5" required maxlength="5000"></textarea>
      </div>
    `;
  }

  if (type === 'competition') {
    const categoryOptions = COMPETITION_CATEGORIES.map(
      (category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`,
    ).join('');

    return `
      <div class="form-field">
        <label for="${fid('category')}">Category</label>
        <select id="${fid('category')}" name="category" required>${categoryOptions}</select>
      </div>
      ${detailField(fid, 'Competition name', 'name', { required: true })}
      ${detailField(fid, 'Description', 'description', { required: true, rows: 4, maxlength: 5000 })}
      ${detailField(fid, 'Format', 'format', { maxlength: 500 })}
      ${detailField(fid, 'Coach / contact', 'contact', { maxlength: 300 })}
      ${detailField(fid, 'Eligibility', 'eligibility', { maxlength: 300 })}
      ${detailField(fid, 'Season / timing', 'period', { maxlength: 300 })}
      ${detailField(fid, 'Competition level', 'level', { maxlength: 200 })}
      ${detailField(fid, 'Official link (optional)', 'link', { maxlength: 500 })}
    `;
  }

  if (type === 'club') {
    return `
      <div class="form-field">
        <label for="${fid('school')}">Campus</label>
        <select id="${fid('school')}" name="school">${schoolOptions}</select>
      </div>
      ${detailField(fid, 'Club name', 'name', { required: true })}
      ${detailField(fid, 'Description', 'description', { required: true, rows: 4, maxlength: 5000 })}
      ${detailField(fid, 'Contact', 'contact', { maxlength: 300 })}
      ${detailField(fid, 'Eligibility', 'eligibility', { maxlength: 300 })}
      ${detailField(fid, 'Schedule', 'period', { maxlength: 300 })}
      ${detailField(fid, 'Notes (optional)', 'notes', { rows: 3, maxlength: 2000 })}
      ${detailField(fid, 'Link (optional)', 'link', { maxlength: 500 })}
    `;
  }

  return `
    <div class="form-field">
      <label for="${fid('school')}">Campus</label>
      <select id="${fid('school')}" name="school">${schoolOptions}</select>
    </div>
    <div class="form-field">
      <label for="${fid('title')}">Title</label>
      <input id="${fid('title')}" name="title" type="text" required maxlength="200">
    </div>
    <div class="form-field">
      <label for="${fid('date')}">Date (optional)</label>
      <input id="${fid('date')}" name="date" type="date">
    </div>
    <div class="form-field">
      <label for="${fid('body')}">Announcement</label>
      <textarea id="${fid('body')}" name="body" rows="5" required maxlength="5000"></textarea>
    </div>
  `;
}

function trimField(formData, name) {
  return String(formData.get(name) || '').trim();
}

export function buildSubmissionPayload(formData, type) {
  if (type === 'event') {
    return {
      school: formData.get('school') || '',
      title: trimField(formData, 'title'),
      date: formData.get('event-date') || null,
      location: trimField(formData, 'location'),
      body: trimField(formData, 'body'),
    };
  }

  if (type === 'competition') {
    return {
      category: formData.get('category') || 'MISC',
      name: trimField(formData, 'name'),
      description: trimField(formData, 'description'),
      format: trimField(formData, 'format'),
      contact: trimField(formData, 'contact'),
      eligibility: trimField(formData, 'eligibility'),
      period: trimField(formData, 'period'),
      level: trimField(formData, 'level'),
      link: trimField(formData, 'link'),
    };
  }

  if (type === 'club') {
    return {
      school: formData.get('school') || '',
      name: trimField(formData, 'name'),
      description: trimField(formData, 'description'),
      contact: trimField(formData, 'contact'),
      eligibility: trimField(formData, 'eligibility'),
      period: trimField(formData, 'period'),
      notes: trimField(formData, 'notes'),
      link: trimField(formData, 'link'),
    };
  }

  return {
    school: formData.get('school') || '',
    title: trimField(formData, 'title'),
    date: formData.get('date') || null,
    body: trimField(formData, 'body'),
  };
}

export function readPreviewValues(form, type) {
  return buildSubmissionPayload(new FormData(form), type);
}

export function renderAnnouncementPreview(payload, { ghost = false, ghostLabel = 'Preview — pending review' } = {}) {
  const schoolTag = payload.school
    ? `<span class="info-tag">${escapeHtml(payload.school)}</span>`
    : '';
  const date = formatDisplayDate(payload.date);
  const title = payload.title || 'Your title';
  const body = payload.body || 'Your announcement text will appear here.';

  return `
    <article class="announcement-card${ghost ? ' ghost-preview-card' : ''}">
      ${ghost ? `<span class="ghost-preview-badge">${escapeHtml(ghostLabel)}</span>` : ''}
      ${schoolTag}
      ${date ? `<time class="announcement-date">${escapeHtml(date)}</time>` : ''}
      <h4>${escapeHtml(title)}</h4>
      <p>${escapeHtml(body)}</p>
    </article>
  `;
}

export function renderEventPreview(payload, { ghost = false, ghostLabel = 'Preview — pending review' } = {}) {
  const schoolTag = payload.school
    ? `<span class="event-school-tag">${escapeHtml(payload.school)}</span>`
    : '';
  const dateLabel = payload.date ? formatDisplayDate(payload.date) : 'Date TBA';
  const title = payload.title || 'Your event title';
  const body = payload.body || 'Your event description will appear here.';
  const location = payload.location || 'Location (optional)';

  return `
    <article class="event-card${ghost ? ' ghost-preview-card' : ''}">
      ${ghost ? `<span class="ghost-preview-badge">${escapeHtml(ghostLabel)}</span>` : ''}
      ${schoolTag}
      <time class="event-date">${escapeHtml(dateLabel)}</time>
      <h4>${escapeHtml(title)}</h4>
      <p class="event-location">${escapeHtml(location)}</p>
      <p>${escapeHtml(body)}</p>
    </article>
  `;
}

export function renderSubmissionPreview(type, payload, options) {
  if (type === 'event') {
    return renderEventPreview(payload, options);
  }
  if (type === 'competition') {
    return renderCompetitionEntry(submissionPayloadToCompetition(payload), options);
  }
  if (type === 'club') {
    return renderClubEntry(submissionPayloadToClub(payload), options);
  }
  return renderAnnouncementPreview(payload, options);
}
