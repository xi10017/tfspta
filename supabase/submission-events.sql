-- Audit log for submission workflow (run in Supabase SQL Editor)

create type public.submission_event_action as enum (
  'submitted',
  'approved',
  'rejected',
  'returned_to_queue',
  'removed_from_site',
  'restored_to_site'
);

create table if not exists public.submission_events (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions (id) on delete cascade,
  action public.submission_event_action not null,
  actor_id uuid references public.profiles (id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists submission_events_submission_idx
  on public.submission_events (submission_id, created_at asc);

alter table public.submission_events enable row level security;

drop policy if exists "Submission events: read own or admin" on public.submission_events;
create policy "Submission events: read own or admin"
  on public.submission_events for select
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.submissions s
      where s.id = submission_id and s.submitter_id = auth.uid()
    )
  );

drop policy if exists "Submission events: insert" on public.submission_events;
create policy "Submission events: insert"
  on public.submission_events for insert
  to authenticated
  with check (
    public.is_admin()
    or (
      action = 'submitted'
      and actor_id = auth.uid()
      and exists (
        select 1 from public.submissions s
        where s.id = submission_id and s.submitter_id = auth.uid()
      )
    )
  );

grant all on public.submission_events to service_role;
grant select, insert on public.submission_events to authenticated;
