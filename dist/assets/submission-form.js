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

function imageFields(fid) {
  return `
      <input type="hidden" id="${fid('image-url')}" name="image-url">
      <input type="hidden" id="${fid('image-path')}" name="image-path">
      <input type="hidden" id="${fid('image-preview-url')}" name="image-preview-url">
      <input type="hidden" id="${fid('image-crop-x')}" name="image-crop-x" value="0">
      <input type="hidden" id="${fid('image-crop-y')}" name="image-crop-y" value="0">
      <input type="hidden" id="${fid('image-crop-zoom')}" name="image-crop-zoom" value="1">
      <input type="hidden" id="${fid('remove-image')}" name="remove-image" value="false">
      <div class="form-field">
        <label for="${fid('image-file')}">Image (optional)</label>
        <div class="submission-image-panel" data-submission-image-field>
          <div class="submission-image-picker">
            <input class="submission-image-input" id="${fid('image-file')}" name="image-file" type="file" accept="image/jpeg,image/png,image/webp">
            <label class="btn btn-secondary submission-image-picker-button" for="${fid('image-file')}">
              <span>Choose image</span>
            </label>
            <span class="submission-image-picker-name" data-role="file-name">No file selected</span>
            <button class="btn submission-image-remove" type="button" data-role="remove-image" hidden>Remove image</button>
          </div>
          <p class="field-hint">Upload a JPG, PNG, or WebP, then crop it to fit. Final images are standardized to 16:9 and compressed before upload.</p>
          <div class="submission-image-current" data-role="current" hidden>
            <div class="submission-image-current-header">
              <p class="submission-image-label">Current image</p>
            </div>
            <img class="submission-image-current-preview" data-role="current-preview" alt="">
          </div>

          <div class="submission-image-editor" data-role="editor" hidden>
            <div class="submission-image-editor-topline">
              <p class="submission-image-label">Crop your image</p>
              <button class="btn submission-image-reset" type="button" data-role="reset-crop">Reset crop</button>
            </div>
            <div class="submission-image-frame" data-role="frame">
              <img class="submission-image-editor-preview" data-role="editor-image" alt="">
            </div>
            <div class="submission-image-controls">
              <label class="submission-image-control">
                <span>Zoom</span>
                <input type="range" name="image-crop-zoom-slider" min="1" max="3" step="0.01" value="1" data-role="zoom">
              </label>
              <label class="submission-image-control">
                <span>Left / right</span>
                <input type="range" name="image-crop-x-slider" min="-1" max="1" step="0.01" value="0" data-role="pan-x">
              </label>
              <label class="submission-image-control">
                <span>Up / down</span>
                <input type="range" name="image-crop-y-slider" min="-1" max="1" step="0.01" value="0" data-role="pan-y">
              </label>
            </div>
            <p class="field-hint">Drag the image or use the sliders to frame it the way you want.</p>
          </div>
        </div>
      </div>
  `;
}

export function getSubmissionFormHtml(type, { idPrefix = 'ctx-' } = {}) {
  const fid = (name) => fieldId(idPrefix, name);

  if (type === 'event') {
    return `
      ${imageFields(fid)}
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
      ${imageFields(fid)}
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
      ${imageFields(fid)}
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
    ${imageFields(fid)}
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
      image_preview_url: trimField(formData, 'image-preview-url'),
      image_url: trimField(formData, 'image-url'),
      image_path: trimField(formData, 'image-path'),
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
      image_preview_url: trimField(formData, 'image-preview-url'),
      image_url: trimField(formData, 'image-url'),
      image_path: trimField(formData, 'image-path'),
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
      image_preview_url: trimField(formData, 'image-preview-url'),
      image_url: trimField(formData, 'image-url'),
      image_path: trimField(formData, 'image-path'),
    };
  }

  return {
    school: formData.get('school') || '',
    title: trimField(formData, 'title'),
    date: formData.get('date') || null,
    body: trimField(formData, 'body'),
    image_preview_url: trimField(formData, 'image-preview-url'),
    image_url: trimField(formData, 'image-url'),
    image_path: trimField(formData, 'image-path'),
  };
}

export function readPreviewValues(form, type) {
  const payload = buildSubmissionPayload(new FormData(form), type);
  payload.image_url = payload.image_preview_url || payload.image_url;
  if (form?.querySelector('input[name="remove-image"]')?.value === 'true') {
    payload.image_url = '';
    payload.image_path = '';
  }
  return payload;
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
      ${payload.image_url ? `<img class="announcement-image" src="${escapeHtml(payload.image_url)}" alt="">` : ''}
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
      ${payload.image_url ? `<img class="event-image" src="${escapeHtml(payload.image_url)}" alt="">` : ''}
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
