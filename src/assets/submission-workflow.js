import { publishedClubToPayload, publishedCompetitionToPayload } from './entry-render.js';

export const INTENT_LABELS = {
  create: 'New submission',
  update_pending: 'Edit while in review',
  resubmit: 'Resubmit after rejection',
  edit_published: 'Change request (live item)',
};

const TARGET_FIELD_BY_TYPE = {
  announcement: 'target_published_announcement_id',
  event: 'target_published_event_id',
  competition: 'target_published_competition_id',
  club: 'target_published_club_id',
};

function setField(form, name, value) {
  const field = form.querySelector(`[name="${name}"]`);
  if (field) {
    field.value = value ?? '';
  }
}

export function fillFormFromPayload(form, type, payload) {
  if (!form || !payload) {
    return;
  }

  if (type === 'competition') {
    setField(form, 'category', payload.category || 'MISC');
    setField(form, 'name', payload.name || '');
    setField(form, 'description', payload.description || payload.body || '');
    setField(form, 'format', payload.format || '');
    setField(form, 'contact', payload.contact || '');
    setField(form, 'eligibility', payload.eligibility || '');
    setField(form, 'period', payload.period || '');
    setField(form, 'level', payload.level || '');
    setField(form, 'link', payload.link || '');
    return;
  }

  if (type === 'club') {
    setField(form, 'school', payload.school || '');
    setField(form, 'name', payload.name || '');
    setField(form, 'description', payload.description || payload.body || '');
    setField(form, 'contact', payload.contact || '');
    setField(form, 'eligibility', payload.eligibility || '');
    setField(form, 'period', payload.period || '');
    setField(form, 'notes', payload.notes || '');
    setField(form, 'link', payload.link || '');
    return;
  }

  setField(form, 'school', payload.school || '');
  setField(form, 'title', payload.title || payload.name || '');
  setField(form, 'body', payload.body || payload.description || '');

  if (type === 'event') {
    setField(form, 'event-date', payload.date || '');
    setField(form, 'location', payload.location || '');
  } else {
    setField(form, 'date', payload.date || '');
  }
}

export function publishedItemToPayload(item, type) {
  if (type === 'event') {
    return {
      school: item.school || '',
      title: item.title || '',
      date: item.event_date || null,
      location: item.location || '',
      body: item.body || '',
    };
  }

  if (type === 'competition') {
    return publishedCompetitionToPayload(item);
  }

  if (type === 'club') {
    return publishedClubToPayload(item);
  }

  return {
    school: item.school || '',
    title: item.title || '',
    date: item.announcement_date || null,
    body: item.body || '',
  };
}

export function getTargetFieldForType(contentType) {
  return TARGET_FIELD_BY_TYPE[contentType] || null;
}

export function targetPublishedIdForType(contentType, publishedId) {
  return {
    targetPublishedAnnouncementId: contentType === 'announcement' ? publishedId : null,
    targetPublishedEventId: contentType === 'event' ? publishedId : null,
    targetPublishedCompetitionId: contentType === 'competition' ? publishedId : null,
    targetPublishedClubId: contentType === 'club' ? publishedId : null,
  };
}

export function buildSubmissionInsertRecord({
  contentType,
  payload,
  submitterId,
  intent = 'create',
  targetSubmissionId = null,
  targetPublishedAnnouncementId = null,
  targetPublishedEventId = null,
  targetPublishedCompetitionId = null,
  targetPublishedClubId = null,
}) {
  return {
    content_type: contentType,
    payload,
    submitter_id: submitterId,
    status: 'pending',
    intent,
    target_submission_id: targetSubmissionId,
    target_published_announcement_id: targetPublishedAnnouncementId,
    target_published_event_id: targetPublishedEventId,
    target_published_competition_id: targetPublishedCompetitionId,
    target_published_club_id: targetPublishedClubId,
  };
}
