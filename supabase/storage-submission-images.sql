-- Public Storage bucket for optional submission images.
-- Safe to run more than once.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'submission-images',
  'submission-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Submission images public read" on storage.objects;
create policy "Submission images public read"
  on storage.objects for select
  using (bucket_id = 'submission-images');

drop policy if exists "Submission images authenticated upload" on storage.objects;
create policy "Submission images authenticated upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'submission-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
