import { requireSupabase } from './supabase-client.js';
import { notifyPendingContentChanged } from './pending-live.js';

export const PUBLISHED_TABLE_BY_TYPE = {
  announcement: 'published_announcements',
  event: 'published_events',
  competition: 'published_competitions',
  club: 'published_clubs',
};

function isMissingVersionsTable(error) {
  const message = String(error?.message || '');
  return message.includes('published_item_versions');
}

export function rowToSnapshot(row) {
  if (!row) {
    return null;
  }

  const { id: _id, ...snapshot } = row;
  return snapshot;
}

export async function fetchPublishedRow(supabase, contentType, publishedId) {
  const table = PUBLISHED_TABLE_BY_TYPE[contentType];
  if (!table) {
    return null;
  }

  const { data, error } = await supabase.from(table).select('*').eq('id', publishedId).maybeSingle();
  if (error) {
    throw error;
  }

  return data;
}

export async function snapshotBeforePublishedUpdate(
  supabase,
  contentType,
  publishedId,
  { submissionId = null, actorId = null } = {},
) {
  const row = await fetchPublishedRow(supabase, contentType, publishedId);
  if (!row) {
    return;
  }

  const snapshot = rowToSnapshot(row);
  const { error } = await supabase.from('published_item_versions').insert({
    content_type: contentType,
    published_id: publishedId,
    snapshot,
    submission_id: submissionId,
    created_by: actorId,
  });

  if (error && !isMissingVersionsTable(error)) {
    throw error;
  }
}

export async function countVersionsByPublishedIds(supabase, contentType, publishedIds) {
  const counts = new Map();
  if (!publishedIds.length) {
    return counts;
  }

  const { data, error } = await supabase
    .from('published_item_versions')
    .select('published_id')
    .eq('content_type', contentType)
    .in('published_id', publishedIds);

  if (error) {
    if (isMissingVersionsTable(error)) {
      return counts;
    }
    throw error;
  }

  for (const row of data || []) {
    counts.set(row.published_id, (counts.get(row.published_id) || 0) + 1);
  }

  return counts;
}

export async function revertPublishedToPreviousVersion(contentType, publishedId, actorId) {
  const supabase = requireSupabase();
  const table = PUBLISHED_TABLE_BY_TYPE[contentType];
  if (!table) {
    throw new Error(`Cannot revert content type "${contentType}".`);
  }

  const { data: version, error: versionError } = await supabase
    .from('published_item_versions')
    .select('id, snapshot, submission_id')
    .eq('content_type', contentType)
    .eq('published_id', publishedId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (versionError) {
    if (isMissingVersionsTable(versionError)) {
      throw new Error('Version history is not set up yet. Run supabase/published-item-versions.sql.');
    }
    throw versionError;
  }

  if (!version?.snapshot) {
    throw new Error('There is no previous version to restore.');
  }

  const current = await fetchPublishedRow(supabase, contentType, publishedId);
  if (!current) {
    throw new Error('This live item was not found.');
  }

  const { error: saveCurrentError } = await supabase.from('published_item_versions').insert({
    content_type: contentType,
    published_id: publishedId,
    snapshot: rowToSnapshot(current),
    submission_id: current.submission_id || null,
    created_by: actorId,
  });

  if (saveCurrentError) {
    throw saveCurrentError;
  }

  let { error: updateError } = await supabase.from(table).update(version.snapshot).eq('id', publishedId);
  if (
    updateError &&
    String(updateError.message || '').includes('static_entry_id') &&
    String(updateError.message || '').includes('does not exist')
  ) {
    const { static_entry_id: _ignored, ...rest } = version.snapshot;
    ({ error: updateError } = await supabase.from(table).update(rest).eq('id', publishedId));
  }
  if (updateError) {
    throw updateError;
  }

  const { error: deleteError } = await supabase
    .from('published_item_versions')
    .delete()
    .eq('id', version.id);

  if (deleteError) {
    throw deleteError;
  }

  notifyPendingContentChanged();
  return {
    restoredSubmissionId: version.submission_id || current.submission_id || null,
  };
}
