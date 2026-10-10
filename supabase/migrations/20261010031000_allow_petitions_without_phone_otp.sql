create or replace function public.has_resident_petition_profile(target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target_user = (select auth.uid())
    and exists (
      select 1
      from public.resident_verifications v
      where v.user_id = target_user
    )
$$;

revoke all on function public.has_resident_petition_profile(uuid) from public, anon;
grant execute on function public.has_resident_petition_profile(uuid) to authenticated;

drop policy if exists "Verified residents submit their own petitions" on public.petitions;
create policy "Residents with a private profile submit their own petitions"
  on public.petitions for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status in ('draft', 'submitted')
    and public.current_civicsync_role() in ('citizen', 'moderator', 'representative_pending', 'representative')
    and public.has_resident_petition_profile((select auth.uid()))
  );
