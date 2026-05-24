-- Allow parents to withdraw their own pending submissions (run in SQL Editor if already deployed)

drop policy if exists "Submissions: delete own pending" on public.submissions;
create policy "Submissions: delete own pending"
  on public.submissions for delete
  to authenticated
  using (auth.uid() = submitter_id and status = 'pending');

grant delete on public.submissions to authenticated;
