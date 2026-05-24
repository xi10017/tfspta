-- Run this in Supabase SQL Editor if you see "permission denied for table profiles"
-- Safe to run more than once

-- 1. Let the Data API read/write these tables (needed when auto-expose is OFF)
grant usage on schema public to postgres, anon, authenticated, service_role;

grant all on public.profiles to service_role;
grant all on public.submissions to service_role;
grant all on public.published_announcements to service_role;
grant all on public.published_events to service_role;
grant all on public.published_competitions to service_role;
grant all on public.published_clubs to service_role;
grant all on public.submission_events to service_role;
grant all on public.archived_published_items to service_role;
grant all on public.published_item_versions to service_role;

grant select, insert, update on public.profiles to authenticated;
grant select, insert on public.submission_events to authenticated;
grant select, insert, delete on public.archived_published_items to authenticated;
grant select, insert, delete on public.published_item_versions to authenticated;
grant select, insert, update, delete on public.submissions to authenticated;
grant select, insert, update, delete on public.published_announcements to authenticated;
grant select, insert, update, delete on public.published_events to authenticated;
grant select, insert, update, delete on public.published_competitions to authenticated;
grant select, insert, update, delete on public.published_clubs to authenticated;

grant select on public.published_announcements to anon;
grant select on public.published_events to anon;
grant select on public.published_competitions to anon;
grant select on public.published_clubs to anon;

-- 2. Allow users to create their own profile row if the signup trigger missed them
drop policy if exists "Profiles: users insert own" on public.profiles;
create policy "Profiles: users insert own"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

-- 3. Backfill profiles for accounts created before the trigger existed
insert into public.profiles (id, email, full_name, role)
select
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data ->> 'full_name', ''),
  'parent'
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

-- 4. Safer admin check (avoids some RLS edge cases)
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
