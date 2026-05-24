-- Archive workflow: soft-delete off site with admin archive tab.
-- Run in Supabase SQL Editor after submission-events.sql.

alter type public.submission_status add value if not exists 'archived';

alter type public.submission_event_action add value if not exists 'archived';

create table if not exists public.archived_published_items (
  id uuid primary key default gen_random_uuid(),
  content_type public.content_type not null,
  snapshot jsonb not null,
  submission_id uuid references public.submissions (id) on delete set null,
  archived_by uuid references public.profiles (id) on delete set null,
  notes text,
  archived_at timestamptz not null default now()
);

create index if not exists archived_published_items_archived_at_idx
  on public.archived_published_items (archived_at desc);

alter table public.archived_published_items enable row level security;

drop policy if exists "Archived published: admin all" on public.archived_published_items;
create policy "Archived published: admin all"
  on public.archived_published_items for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant all on public.archived_published_items to service_role;
grant select, insert, delete on public.archived_published_items to authenticated;
