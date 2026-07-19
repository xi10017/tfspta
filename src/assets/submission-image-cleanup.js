import { requireSupabase } from './supabase-client.js';
import { SUBMISSION_IMAGE_BUCKET } from './submission-images.js';

const PUBLISHED_IMAGE_TABLES = [
  'published_announcements',
  'published_events',
  'published_competitions',
  'published_clubs',
];

function normalizePaths(paths) {
  return [...new Set((paths || []).map((value) => String(value || '').trim()).filter(Boolean))];
}

async function loadSubmissionImagePaths(supabase, ignoreSubmissionId = null) {
  let query = supabase.from('submissions').select('id, payload');
  if (ignoreSubmissionId) {
    query = query.neq('id', ignoreSubmissionId);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return new Set(
    (data || [])
      .map((row) => row?.payload?.image_path || '')
      .filter(Boolean),
  );
}

async function loadPublishedImagePaths(supabase) {
  const pathSet = new Set();

  for (const table of PUBLISHED_IMAGE_TABLES) {
    const { data, error } = await supabase.from(table).select('image_path');
    if (error) {
      throw error;
    }

    for (const row of data || []) {
      if (row?.image_path) {
        pathSet.add(row.image_path);
      }
    }
  }

  return pathSet;
}

async function loadArchivedImagePaths(supabase, ignoreArchiveId = null) {
  let query = supabase.from('archived_published_items').select('id, snapshot');
  if (ignoreArchiveId) {
    query = query.neq('id', ignoreArchiveId);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return new Set(
    (data || [])
      .map((row) => row?.snapshot?.image_path || '')
      .filter(Boolean),
  );
}

async function findUnusedImagePaths(paths, { ignoreSubmissionId = null, ignoreArchiveId = null } = {}) {
  const normalized = normalizePaths(paths);
  if (!normalized.length) {
    return [];
  }

  const supabase = requireSupabase();
  const [submissionPaths, publishedPaths, archivedPaths] = await Promise.all([
    loadSubmissionImagePaths(supabase, ignoreSubmissionId),
    loadPublishedImagePaths(supabase),
    loadArchivedImagePaths(supabase, ignoreArchiveId),
  ]);

  return normalized.filter(
    (path) =>
      !submissionPaths.has(path) &&
      !publishedPaths.has(path) &&
      !archivedPaths.has(path),
  );
}

export async function deleteSubmissionImagesIfUnused(
  paths,
  { ignoreSubmissionId = null, ignoreArchiveId = null } = {},
) {
  const unusedPaths = await findUnusedImagePaths(paths, { ignoreSubmissionId, ignoreArchiveId });
  if (!unusedPaths.length) {
    return [];
  }

  const supabase = requireSupabase();
  const { error } = await supabase.storage.from(SUBMISSION_IMAGE_BUCKET).remove(unusedPaths);
  if (error) {
    throw new Error(`Image cleanup failed: ${error.message}`);
  }

  return unusedPaths;
}
