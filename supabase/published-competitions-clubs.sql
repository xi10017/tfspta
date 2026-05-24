-- Published competitions and clubs + change-request targets.
-- Run this in Supabase SQL Editor if you see:
--   column submissions.target_published_competition_id does not exist
-- Safe to run more than once on an existing project.

-- Allow competition/club submissions (no-op if values already exist).
alter type public.content_type add value if not exists 'competition';
alter type public.content_type add value if not exists 'club';

create table if not exists public.published_competitions (
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

create table if not exists public.published_clubs (
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

create index if not exists published_competitions_category_idx
  on public.published_competitions (category, published_at desc);

create index if not exists published_clubs_school_idx
  on public.published_clubs (school, published_at desc);

alter table public.published_competitions enable row level security;
alter table public.published_clubs enable row level security;

alter table public.submissions
  add column if not exists target_published_competition_id uuid references public.published_competitions (id) on delete set null;

alter table public.submissions
  add column if not exists target_published_club_id uuid references public.published_clubs (id) on delete set null;

drop policy if exists "Competitions: public read" on public.published_competitions;
create policy "Competitions: public read"
  on public.published_competitions for select
  using (true);

drop policy if exists "Competitions: admin write" on public.published_competitions;
create policy "Competitions: admin write"
  on public.published_competitions for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Clubs: public read" on public.published_clubs;
create policy "Clubs: public read"
  on public.published_clubs for select
  using (true);

drop policy if exists "Clubs: admin write" on public.published_clubs;
create policy "Clubs: admin write"
  on public.published_clubs for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select on public.published_competitions to anon;
grant select on public.published_clubs to anon;
grant select, insert, update, delete on public.published_competitions to authenticated;
grant select, insert, update, delete on public.published_clubs to authenticated;
grant all on public.published_competitions to service_role;
grant all on public.published_clubs to service_role;
