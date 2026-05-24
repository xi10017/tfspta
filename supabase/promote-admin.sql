-- Promote a user to admin (run in Supabase SQL Editor)
-- Replace the email below, then click Run

-- Step 1: See your account + profile (run this first)
select
  u.id as user_id,
  u.email as auth_email,
  p.email as profile_email,
  p.role
from auth.users u
left join public.profiles p on p.id = u.id
where u.email = '100172368xi@gmail.com';

-- Step 2: Promote by auth user id (works even if profile.email is empty)
update public.profiles p
set role = 'admin'
from auth.users u
where p.id = u.id
  and u.email = '100172368xi@gmail.com';

-- Step 3: If Step 2 says 0 rows, create the missing profile as admin
insert into public.profiles (id, email, full_name, role)
select
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data ->> 'full_name', ''),
  'admin'
from auth.users u
where u.email = '100172368xi@gmail.com'
  and not exists (
    select 1 from public.profiles p where p.id = u.id
  );

-- Step 4: Confirm
select u.email, p.role
from auth.users u
join public.profiles p on p.id = u.id
where u.email = '100172368xi@gmail.com';
