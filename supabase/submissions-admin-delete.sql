-- Admin can permanently delete submissions (e.g. from Archive cleanup).
-- Safe to run more than once.

drop policy if exists "Submissions: admin delete" on public.submissions;
create policy "Submissions: admin delete"
  on public.submissions for delete
  to authenticated
  using (public.is_admin());
