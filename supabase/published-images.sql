-- Published image support for announcements, events, competitions, and clubs.
-- Safe to run more than once.

alter table public.published_announcements
  add column if not exists image_url text not null default '';

alter table public.published_announcements
  add column if not exists image_path text not null default '';

alter table public.published_events
  add column if not exists image_url text not null default '';

alter table public.published_events
  add column if not exists image_path text not null default '';

alter table public.published_competitions
  add column if not exists image_url text not null default '';

alter table public.published_competitions
  add column if not exists image_path text not null default '';

alter table public.published_clubs
  add column if not exists image_url text not null default '';

alter table public.published_clubs
  add column if not exists image_path text not null default '';
