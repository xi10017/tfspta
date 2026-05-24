-- Frazer PTA content workflow (run in Supabase SQL Editor)
-- After signup, promote admins manually:
--   update public.profiles set role = 'admin' where email = 'you@example.com';

create extension if not exists "pgcrypto";

create type public.submission_status as enum ('pending', 'approved', 'rejected', 'archived');
create type public.content_type as enum ('announcement', 'event', 'competition', 'club', 'other');
create type public.submission_intent as enum ('create', 'update_pending', 'resubmit', 'edit_published');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'parent' check (role in ('parent', 'admin')),
  created_at timestamptz not null default now()
);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  content_type public.content_type not null,
  payload jsonb not null,
  status public.submission_status not null default 'pending',
  intent public.submission_intent not null default 'create',
  target_submission_id uuid references public.submissions (id) on delete set null,
  target_published_announcement_id uuid references public.published_announcements (id) on delete set null,
  target_published_event_id uuid references public.published_events (id) on delete set null,
  submitter_id uuid references public.profiles (id) on delete set null,
  reviewer_id uuid references public.profiles (id) on delete set null,
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.published_announcements (
  id uuid primary key default gen_random_uuid(),
  school text not null default '',
  title text not null,
  body text not null,
  announcement_date date,
  submission_id uuid references public.submissions (id) on delete set null,
  published_at timestamptz not null default now()
);

create table public.published_events (
  id uuid primary key default gen_random_uuid(),
  school text not null default '',
  title text not null,
  location text not null default '',
  body text not null default '',
  event_date date,
  submission_id uuid references public.submissions (id) on delete set null,
  published_at timestamptz not null default now()
);

create table public.published_competitions (
  id uuid primary key default gen_random_uuid(),
  category text not null default 'MISC',
  name text not null,
  description text not null default '',
  format text not null default '',
  contact text not null default '',
  eligibility text not null default '',
  period text not null default '',
  level text not null default '',
  link text not null default '',
  submission_id uuid references public.submissions (id) on delete set null,
  published_at timestamptz not null default now()
);

create table public.published_clubs (
  id uuid primary key default gen_random_uuid(),
  school text not null default '',
  name text not null,
  description text not null default '',
  contact text not null default '',
  eligibility text not null default '',
  period text not null default '',
  notes text not null default '',
  link text not null default '',
  submission_id uuid references public.submissions (id) on delete set null,
  published_at timestamptz not null default now()
);

create index submissions_status_idx on public.submissions (status, created_at desc);

create type public.submission_event_action as enum (
  'submitted',
  'approved',
  'rejected',
  'returned_to_queue',
  'removed_from_site',
  'restored_to_site',
  'archived'
);

create table public.submission_events (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions (id) on delete cascade,
  action public.submission_event_action not null,
  actor_id uuid references public.profiles (id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

create index submission_events_submission_idx on public.submission_events (submission_id, created_at asc);

create table public.archived_published_items (
  id uuid primary key default gen_random_uuid(),
  content_type public.content_type not null,
  snapshot jsonb not null,
  submission_id uuid references public.submissions (id) on delete set null,
  archived_by uuid references public.profiles (id) on delete set null,
  notes text,
  archived_at timestamptz not null default now()
);

create index archived_published_items_archived_at_idx
  on public.archived_published_items (archived_at desc);

create index published_announcements_date_idx on public.published_announcements (announcement_date desc nulls last);
create index published_events_date_idx on public.published_events (event_date asc nulls last);
create index published_competitions_category_idx on public.published_competitions (category, published_at desc);
create index published_clubs_school_idx on public.published_clubs (school, published_at desc);

alter table public.submissions
  add column if not exists target_published_competition_id uuid references public.published_competitions (id) on delete set null;

alter table public.submissions
  add column if not exists target_published_club_id uuid references public.published_clubs (id) on delete set null;

alter table public.profiles enable row level security;
alter table public.submissions enable row level security;
alter table public.published_announcements enable row level security;
alter table public.published_events enable row level security;
alter table public.published_competitions enable row level security;
alter table public.published_clubs enable row level security;
alter table public.submission_events enable row level security;
alter table public.archived_published_items enable row level security;

create or replace function public.is_admin()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    'parent'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Profiles
create policy "Profiles: users read own"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id or public.is_admin());

create policy "Profiles: users insert own"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

create policy "Profiles: users update own name"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Submissions
create policy "Submissions: authenticated insert"
  on public.submissions for insert
  to authenticated
  with check (auth.uid() = submitter_id);

create policy "Submissions: read own or admin"
  on public.submissions for select
  to authenticated
  using (auth.uid() = submitter_id or public.is_admin());

create policy "Submissions: admin update"
  on public.submissions for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Submissions: delete own pending"
  on public.submissions for delete
  to authenticated
  using (auth.uid() = submitter_id and status = 'pending');

create policy "Submissions: admin delete"
  on public.submissions for delete
  to authenticated
  using (public.is_admin());

create policy "Submissions: submitter update own draft"
  on public.submissions for update
  to authenticated
  using (auth.uid() = submitter_id and status in ('pending', 'rejected'))
  with check (auth.uid() = submitter_id and status = 'pending');

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

create policy "Archived published: admin all"
  on public.archived_published_items for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Published content (public read)
create policy "Announcements: public read"
  on public.published_announcements for select
  using (true);

create policy "Events: public read"
  on public.published_events for select
  using (true);

create policy "Announcements: admin write"
  on public.published_announcements for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Events: admin write"
  on public.published_events for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Competitions: public read"
  on public.published_competitions for select
  using (true);

create policy "Competitions: admin write"
  on public.published_competitions for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Clubs: public read"
  on public.published_clubs for select
  using (true);

create policy "Clubs: admin write"
  on public.published_clubs for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- API role grants (required if "Automatically expose new tables" is disabled)
grant usage on schema public to postgres, anon, authenticated, service_role;

grant all on public.profiles to service_role;
grant all on public.submissions to service_role;
grant all on public.published_announcements to service_role;
grant all on public.published_events to service_role;
grant all on public.published_competitions to service_role;
grant all on public.published_clubs to service_role;
grant all on public.submission_events to service_role;
grant all on public.archived_published_items to service_role;

grant select, insert, update on public.profiles to authenticated;
grant select, insert on public.submission_events to authenticated;
grant select, insert, delete on public.archived_published_items to authenticated;
grant select, insert, update, delete on public.submissions to authenticated;
grant select, insert, update, delete on public.published_announcements to authenticated;
grant select, insert, update, delete on public.published_events to authenticated;
grant select, insert, update, delete on public.published_competitions to authenticated;
grant select, insert, update, delete on public.published_clubs to authenticated;

grant select on public.published_announcements to anon;
grant select on public.published_events to anon;
grant select on public.published_competitions to anon;
grant select on public.published_clubs to anon;
