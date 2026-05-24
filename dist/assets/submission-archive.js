import { requireSupabase } from './supabase-client.js';
import { notifyPendingContentChanged } from './pending-live.js';
import { applyAdminAction, recordSubmissionEvent } from './submission-events.js';

export function publishedSnapshotToPayload(contentType, snapshot) {
  if (contentType === 'event') {
    return {
      school: snapshot.school || '',
      title: snapshot.title || '',
      body: snapshot.body || '',
      location: snapshot.location || '',
      date: snapshot.event_date || null,
    };
  }

  if (contentType === 'competition') {
    return {
      category: snapshot.category || 'MISC',
      name: snapshot.name || '',
      description: snapshot.description || '',
      format: snapshot.format || '',
      contact: snapshot.contact || '',
      eligibility: snapshot.eligibility || '',
      period: snapshot.period || '',
      level: snapshot.level || '',
      link: snapshot.link || '',
    };
  }

  if (contentType === 'club') {
    return {
      school: snapshot.school || '',
      name: snapshot.name || '',
      description: snapshot.description || '',
      contact: snapshot.contact || '',
      eligibility: snapshot.eligibility || '',
      period: snapshot.period || '',
      notes: snapshot.notes || '',
      link: snapshot.link || '',
    };
  }

  return {
    school: snapshot.school || '',
    title: snapshot.title || '',
    body: snapshot.body || '',
    date: snapshot.announcement_date || null,
  };
}

export async function insertArchivedOrphan(contentType, snapshot, actorId, notes = null) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('archived_published_items')
    .insert({
      content_type: contentType,
      snapshot,
      submission_id: snapshot.submission_id || null,
      archived_by: actorId,
      notes: notes || 'Archived and removed from the website.',
    })
    .select('id')
    .single();

  if (error) {
    throw error;
  }

  notifyPendingContentChanged();
  return data.id;
}

export async function loadArchivedOrphans() {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('archived_published_items')
    .select('id, content_type, snapshot, submission_id, notes, archived_at, archiver:profiles!archived_by(full_name, email)')
    .order('archived_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data || [];
}

export async function restoreArchivedOrphanToQueue(archiveId, actorId) {
  const supabase = requireSupabase();
  const { data: row, error: fetchError } = await supabase
    .from('archived_published_items')
    .select('*')
    .eq('id', archiveId)
    .single();

  if (fetchError || !row) {
    throw fetchError || new Error('Archived item not found.');
  }

  const { error: deleteError } = await supabase.from('archived_published_items').delete().eq('id', archiveId);
  if (deleteError) {
    throw deleteError;
  }

  const restoreNote = 'Restored from archive for review.';

  if (row.submission_id) {
    const { data: submission, error: submissionError } = await supabase
      .from('submissions')
      .select('*')
      .eq('id', row.submission_id)
      .single();

    if (submissionError || !submission) {
      throw submissionError || new Error('Linked submission not found.');
    }

    await applyAdminAction(submission, 'restore');
    notifyPendingContentChanged();
    return row;
  }

  const payload = publishedSnapshotToPayload(row.content_type, row.snapshot);
  const { data: created, error: insertError } = await supabase
    .from('submissions')
    .insert({
      content_type: row.content_type,
      payload,
      status: 'pending',
      intent: 'create',
      review_notes: restoreNote,
    })
    .select('id')
    .single();

  if (insertError) {
    throw insertError;
  }

  await recordSubmissionEvent(created.id, 'returned_to_queue', actorId, restoreNote);
  notifyPendingContentChanged();
  return row;
}

export async function deleteArchivedOrphan(archiveId) {
  const supabase = requireSupabase();
  const { error } = await supabase.from('archived_published_items').delete().eq('id', archiveId);
  if (error) {
    throw error;
  }
  notifyPendingContentChanged();
}

export function archivedOrphanTitle(row) {
  const snapshot = row.snapshot || {};
  return snapshot.title || snapshot.name || 'Untitled';
}

export function archivedOrphanMeta(row) {
  const snapshot = row.snapshot || {};
  if (row.content_type === 'competition') {
    return `${snapshot.category || 'MISC'} · ${snapshot.level || '—'}`;
  }
  if (row.content_type === 'club') {
    return `${snapshot.school || 'District-wide'} · ${snapshot.period || '—'}`;
  }
  if (row.content_type === 'event') {
    return `${snapshot.school || 'District-wide'} · ${snapshot.event_date || '—'}`;
  }
  return `${snapshot.school || 'District-wide'} · ${snapshot.announcement_date || '—'}`;
}
