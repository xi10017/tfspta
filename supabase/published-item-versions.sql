-- Previous published snapshots (revert one step). Run after published-competitions-clubs.sql.

create table if not exists public.published_item_versions (
  id uuid primary key default gen_random_uuid(),
  content_type public.content_type not null,
  published_id uuid not null,
  snapshot jsonb not null,
  submission_id uuid references public.submissions (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists published_item_versions_published_idx
  on public.published_item_versions (content_type, published_id, created_at desc);

alter table public.published_item_versions enable row level security;

drop policy if exists "Published versions: admin all" on public.published_item_versions;
create policy "Published versions: admin all"
  on public.published_item_versions for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant all on public.published_item_versions to service_role;
grant select, insert, delete on public.published_item_versions to authenticated;

alter type public.submission_event_action add value if not exists 'reverted';
