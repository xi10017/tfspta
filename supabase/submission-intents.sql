-- Add submission intents for edits, resubmits, and published change requests.
-- Safe to run more than once on an existing project.

do $$ begin
  create type public.submission_intent as enum ('create', 'update_pending', 'resubmit', 'edit_published');
exception
  when duplicate_object then null;
end $$;

alter table public.submissions
  add column if not exists intent public.submission_intent not null default 'create';

alter table public.submissions
  add column if not exists target_submission_id uuid references public.submissions (id) on delete set null;

alter table public.submissions
  add column if not exists target_published_announcement_id uuid references public.published_announcements (id) on delete set null;

alter table public.submissions
  add column if not exists target_published_event_id uuid references public.published_events (id) on delete set null;

drop policy if exists "Submissions: submitter update own draft" on public.submissions;
create policy "Submissions: submitter update own draft"
  on public.submissions for update
  to authenticated
  using (auth.uid() = submitter_id and status in ('pending', 'rejected'))
  with check (auth.uid() = submitter_id and status = 'pending');

grant update on public.submissions to authenticated;
