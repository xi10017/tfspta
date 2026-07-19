import { requireSupabase } from './supabase-client.js';
import {
  PUBLISHED_TABLE_BY_TYPE,
  fetchPublishedRow,
  snapshotBeforePublishedUpdate,
} from './published-versions.js';
import {
  clubIdentityKey,
  competitionIdentityKey,
  normalizeEntryName,
} from './static-entry-supersede.js';
import { getTargetFieldForType } from './submission-workflow.js';

export { PUBLISHED_TABLE_BY_TYPE };

function identityKeyForPublishedRow(row, contentType) {
  return contentType === 'club' ? clubIdentityKey(row) : competitionIdentityKey(row);
}

const CATALOG_DEDUPE_SELECT = {
  competition: 'id, name, category, static_entry_id, published_at',
  club: 'id, name, school, static_entry_id, published_at',
};

const CATALOG_DEDUPE_SELECT_NO_STATIC = {
  competition: 'id, name, category, published_at',
  club: 'id, name, school, published_at',
};

async function fetchCatalogRowsForDedupe(supabase, contentType) {
  const withStatic = CATALOG_DEDUPE_SELECT[contentType];
  const withoutStatic = CATALOG_DEDUPE_SELECT_NO_STATIC[contentType];
  let { data: rows, error } = await supabase.from(PUBLISHED_TABLE_BY_TYPE[contentType]).select(withStatic);
  if (error && String(error.message || '').includes('static_entry_id')) {
    ({ data: rows, error } = await supabase
      .from(PUBLISHED_TABLE_BY_TYPE[contentType])
      .select(withoutStatic));
  }
  if (error) {
    throw error;
  }
  return rows || [];
}

function recordFromCompetitionPayload(payload) {
  return {
    category: payload.category || 'MISC',
    name: payload.name,
    description: payload.description || payload.body || '',
    format: payload.format || '',
    contact: payload.contact || '',
    eligibility: payload.eligibility || '',
    period: payload.period || '',
    level: payload.level || '',
    link: payload.link || '',
    image_url: payload.image_url || '',
    image_path: payload.image_path || '',
    static_entry_id: payload.static_entry_id || null,
  };
}

function recordFromClubPayload(payload) {
  return {
    school: payload.school || '',
    name: payload.name,
    description: payload.description || payload.body || '',
    contact: payload.contact || '',
    eligibility: payload.eligibility || '',
    period: payload.period || '',
    notes: payload.notes || '',
    link: payload.link || '',
    image_url: payload.image_url || '',
    image_path: payload.image_path || '',
    static_entry_id: payload.static_entry_id || null,
  };
}

export function publishedLookupRecordForSubmission(submission) {
  const { payload, content_type: type } = submission;
  if (type === 'competition') {
    return recordFromCompetitionPayload(payload);
  }
  if (type === 'club') {
    return recordFromClubPayload(payload);
  }
  return null;
}

function isMissingColumnError(error) {
  const message = String(error?.message || '');
  return message.includes('static_entry_id') && message.includes('does not exist');
}

function recordWithoutStaticColumn(record) {
  const { static_entry_id: _ignored, ...rest } = record;
  return rest;
}

async function removeDuplicatePublishedRows(supabase, contentType, keepId) {
  const table = PUBLISHED_TABLE_BY_TYPE[contentType];
  if (!table || !keepId) {
    return;
  }

  const keepRow = await fetchPublishedRow(supabase, contentType, keepId);
  if (!keepRow) {
    return;
  }

  const rows = await fetchCatalogRowsForDedupe(supabase, contentType);

  const keepKey = identityKeyForPublishedRow(keepRow, contentType);

  for (const row of rows || []) {
    if (row.id === keepId) {
      continue;
    }

    const sameStatic =
      keepRow.static_entry_id && row.static_entry_id === keepRow.static_entry_id;
    const sameIdentity = identityKeyForPublishedRow(row, contentType) === keepKey;

    if (!sameStatic && !sameIdentity) {
      continue;
    }

    const { error: deleteError } = await supabase.from(table).delete().eq('id', row.id);
    if (deleteError) {
      throw deleteError;
    }
  }
}

async function findExistingPublishedRow(supabase, table, submission, record) {
  const { payload } = submission;

  if (table === 'published_competitions' && submission.target_published_competition_id) {
    return submission.target_published_competition_id;
  }
  if (table === 'published_clubs' && submission.target_published_club_id) {
    return submission.target_published_club_id;
  }

  const { data: bySubmission, error: submissionLookupError } = await supabase
    .from(table)
    .select('id')
    .eq('submission_id', submission.id)
    .maybeSingle();

  if (submissionLookupError) {
    throw submissionLookupError;
  }
  if (bySubmission?.id) {
    return bySubmission.id;
  }

  if (payload.static_entry_id) {
    const { data: byStatic, error: staticLookupError } = await supabase
      .from(table)
      .select('id')
      .eq('static_entry_id', payload.static_entry_id)
      .maybeSingle();

    if (staticLookupError && !isMissingColumnError(staticLookupError)) {
      throw staticLookupError;
    }
    if (byStatic?.id) {
      return byStatic.id;
    }
  }

  if (table === 'published_competitions' && payload.name) {
    const { data: rows, error: nameLookupError } = await supabase
      .from(table)
      .select('id, name')
      .eq('category', payload.category || 'MISC');

    if (nameLookupError) {
      throw nameLookupError;
    }

    const normalized = normalizeEntryName(payload.name);
    const match = (rows || []).find((row) => normalizeEntryName(row.name) === normalized);
    if (match?.id) {
      return match.id;
    }
  }

  if (table === 'published_clubs' && payload.name) {
    let query = supabase.from(table).select('id, name, school');
    if (payload.school) {
      query = query.eq('school', payload.school);
    }
    const { data: rows, error: nameLookupError } = await query;
    if (nameLookupError) {
      throw nameLookupError;
    }

    const normalized = normalizeEntryName(payload.name);
    const match = (rows || []).find((row) => normalizeEntryName(row.name) === normalized);
    if (match?.id) {
      return match.id;
    }
  }

  return null;
}

async function updatePublishedRow(supabase, table, id, record) {
  let { error } = await supabase.from(table).update(record).eq('id', id);
  if (error && isMissingColumnError(error)) {
    ({ error } = await supabase.from(table).update(recordWithoutStaticColumn(record)).eq('id', id));
  }
  if (error) {
    throw error;
  }
}

async function insertPublishedRow(supabase, table, submissionId, record) {
  let { error } = await supabase.from(table).insert({
    ...record,
    submission_id: submissionId,
  });
  if (error && isMissingColumnError(error)) {
    ({ error } = await supabase.from(table).insert({
      ...recordWithoutStaticColumn(record),
      submission_id: submissionId,
    }));
  }
  if (error) {
    throw error;
  }
}

async function withStaticEntryId(supabase, contentType, publishedId, record, payload) {
  if (contentType !== 'competition' && contentType !== 'club') {
    return record;
  }

  if (payload.static_entry_id) {
    return record;
  }

  const existing = await fetchPublishedRow(supabase, contentType, publishedId);
  if (!existing?.static_entry_id) {
    return record;
  }

  return { ...record, static_entry_id: existing.static_entry_id };
}

async function updateWithVersionSnapshot(
  supabase,
  contentType,
  publishedId,
  record,
  { submissionId = null, actorId = null, payload = null } = {},
) {
  await snapshotBeforePublishedUpdate(supabase, contentType, publishedId, {
    submissionId,
    actorId,
  });

  const table = PUBLISHED_TABLE_BY_TYPE[contentType];
  const finalRecord = payload
    ? await withStaticEntryId(supabase, contentType, publishedId, record, payload)
    : record;
  await updatePublishedRow(supabase, table, publishedId, finalRecord);
}

export async function upsertPublishedCreate(submission, table, record, { actorId = null } = {}) {
  const supabase = requireSupabase();
  const contentType = Object.entries(PUBLISHED_TABLE_BY_TYPE).find(([, t]) => t === table)?.[0];
  const existingId = await findExistingPublishedRow(supabase, table, submission, record);

  if (existingId) {
    if (contentType) {
      await updateWithVersionSnapshot(supabase, contentType, existingId, record, {
        submissionId: submission.id,
        actorId,
        payload: submission.payload,
      });
      if (contentType === 'competition' || contentType === 'club') {
        await removeDuplicatePublishedRows(supabase, contentType, existingId);
      }
    } else {
      await updatePublishedRow(supabase, table, existingId, record);
    }
    return existingId;
  }

  await insertPublishedRow(supabase, table, submission.id, record);
  return null;
}

export async function cleanupPublishedCatalogDuplicates() {
  const supabase = requireSupabase();

  for (const contentType of ['competition', 'club']) {
    const table = PUBLISHED_TABLE_BY_TYPE[contentType];
    if (!table) {
      continue;
    }

    const rows = await fetchCatalogRowsForDedupe(supabase, contentType);
    const keepByKey = new Map();

    for (const row of rows) {
      const key = identityKeyForPublishedRow(row, contentType);
      const existing = keepByKey.get(key);
      if (!existing) {
        keepByKey.set(key, row);
        continue;
      }

      const keep =
        new Date(row.published_at) > new Date(existing.published_at) ? row : existing;
      const drop = keep.id === row.id ? existing : row;
      keepByKey.set(key, keep);

      const { error: deleteError } = await supabase.from(table).delete().eq('id', drop.id);
      if (deleteError) {
        throw deleteError;
      }
    }
  }
}

export async function submissionAlreadyOnSite(submission) {
  const table = PUBLISHED_TABLE_BY_TYPE[submission.content_type];
  const record = publishedLookupRecordForSubmission(submission);
  if (!table || !record) {
    return false;
  }

  const supabase = requireSupabase();
  const existingId = await findExistingPublishedRow(supabase, table, submission, record);
  if (existingId) {
    return true;
  }

  const contentType = submission.content_type;
  if (contentType !== 'competition' && contentType !== 'club') {
    return false;
  }

  const rows = await fetchCatalogRowsForDedupe(supabase, contentType);
  const payloadKey = identityKeyForPublishedRow(record, contentType);
  return rows.some((row) => identityKeyForPublishedRow(row, contentType) === payloadKey);
}

async function publishCatalogItem(submission, contentType, { actorId = null } = {}) {
  const supabase = requireSupabase();
  const { payload } = submission;
  const table = PUBLISHED_TABLE_BY_TYPE[contentType];
  const record =
    contentType === 'competition'
      ? recordFromCompetitionPayload(payload)
      : recordFromClubPayload(payload);

  const targetField = getTargetFieldForType(contentType);
  let targetId = targetField ? submission[targetField] : null;
  if (!targetId) {
    targetId = await findExistingPublishedRow(supabase, table, submission, record);
  }
  if (!targetId) {
    if (submission.intent === 'edit_published') {
      return null;
    }
    await insertPublishedRow(supabase, table, submission.id, record);
    return null;
  }

  await updateWithVersionSnapshot(
    supabase,
    contentType,
    targetId,
    { ...record, submission_id: submission.id },
    { submissionId: submission.id, actorId, payload },
  );
  await removeDuplicatePublishedRows(supabase, contentType, targetId);
  return targetId;
}

export async function publishSubmission(submission, { actorId = null } = {}) {
  const supabase = requireSupabase();
  const { payload, content_type: type, intent } = submission;

  if (intent === 'edit_published') {
    if (type === 'announcement') {
      const targetId = submission.target_published_announcement_id;
      if (!targetId) {
        throw new Error('This change request is missing the target announcement.');
      }

      await updateWithVersionSnapshot(
        supabase,
        'announcement',
        targetId,
        {
          school: payload.school || '',
          title: payload.title,
          body: payload.body,
          announcement_date: payload.date || null,
          image_url: payload.image_url || '',
          image_path: payload.image_path || '',
          submission_id: submission.id,
        },
        { submissionId: submission.id, actorId },
      );
      return;
    }

    if (type === 'event') {
      const targetId = submission.target_published_event_id;
      if (!targetId) {
        throw new Error('This change request is missing the target event.');
      }

      await updateWithVersionSnapshot(
        supabase,
        'event',
        targetId,
        {
          school: payload.school || '',
          title: payload.title,
          location: payload.location || '',
          body: payload.body || '',
          event_date: payload.date || null,
          image_url: payload.image_url || '',
          image_path: payload.image_path || '',
          submission_id: submission.id,
        },
        { submissionId: submission.id, actorId },
      );
      return;
    }

    if (type === 'competition' || type === 'club') {
      const targetId = await publishCatalogItem(submission, type, { actorId });
      if (!targetId && intent === 'edit_published') {
        throw new Error(
          type === 'competition'
            ? 'This change request is missing the target competition.'
            : 'This change request is missing the target club.',
        );
      }
      return;
    }
  }

  if (type === 'announcement') {
    await upsertPublishedCreate(
      submission,
      'published_announcements',
      {
        school: payload.school || '',
        title: payload.title,
        body: payload.body,
        announcement_date: payload.date || null,
        image_url: payload.image_url || '',
        image_path: payload.image_path || '',
      },
      { actorId },
    );
  } else if (type === 'event') {
    await upsertPublishedCreate(
      submission,
      'published_events',
      {
        school: payload.school || '',
        title: payload.title,
        location: payload.location || '',
        body: payload.body || '',
        event_date: payload.date || null,
        image_url: payload.image_url || '',
        image_path: payload.image_path || '',
      },
      { actorId },
    );
  } else if (type === 'competition' || type === 'club') {
    await publishCatalogItem(submission, type, { actorId });
  } else {
    throw new Error(`Publishing for "${type}" is not implemented yet.`);
  }
}

export async function unpublishSubmission(submission) {
  if (submission.intent === 'edit_published') {
    return;
  }

  const table = PUBLISHED_TABLE_BY_TYPE[submission.content_type];
  if (!table) {
    return;
  }

  const supabase = requireSupabase();
  const { error } = await supabase.from(table).delete().eq('submission_id', submission.id);
  if (error) {
    throw error;
  }
}
