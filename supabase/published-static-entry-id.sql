-- Link published competitions/clubs back to spreadsheet HTML entries they replace.
-- Run in Supabase SQL Editor after published-competitions-clubs.sql.

alter table public.published_competitions
  add column if not exists static_entry_id text;

alter table public.published_clubs
  add column if not exists static_entry_id text;

create unique index if not exists published_competitions_static_entry_id_idx
  on public.published_competitions (static_entry_id)
  where static_entry_id is not null;

create unique index if not exists published_clubs_static_entry_id_idx
  on public.published_clubs (static_entry_id)
  where static_entry_id is not null;
