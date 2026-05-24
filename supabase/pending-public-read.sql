-- Ghost previews on live pages are submitter-only (existing "read own or admin" RLS).
-- Run this if you previously applied the public pending-read policy.
-- Safe to run more than once.

drop policy if exists "Submissions: public read pending live content" on public.submissions;

revoke select on public.submissions from anon;
