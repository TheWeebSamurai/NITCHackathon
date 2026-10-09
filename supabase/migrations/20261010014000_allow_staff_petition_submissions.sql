drop policy if exists "Authenticated citizens can submit petitions" on public.petitions;

create policy "Authenticated users can submit their own petitions"
  on public.petitions for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status in ('draft', 'submitted')
  );
