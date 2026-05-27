-- Fix role escalation + allow admins to promote/demote users.
-- Safe to run more than once.

-- 1. Prevent users from changing their own role via the API.
DROP POLICY IF EXISTS "Profiles: users update own name" ON public.profiles;

CREATE POLICY "Profiles: users update own name"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
  );

-- 2. Let admins read all profiles (for the user management panel).
DROP POLICY IF EXISTS "Profiles: admin read all" ON public.profiles;

CREATE POLICY "Profiles: admin read all"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- 3. Let admins update any profile's role.
DROP POLICY IF EXISTS "Profiles: admin update role" ON public.profiles;

CREATE POLICY "Profiles: admin update role"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
