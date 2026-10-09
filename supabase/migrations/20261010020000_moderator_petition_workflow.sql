alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in (
    'citizen',
    'moderator',
    'representative_pending',
    'representative',
    'department_official',
    'coordinator',
    'admin'
  ));

drop policy if exists "Authenticated citizens can submit petitions" on public.petitions;
drop policy if exists "Authenticated users can submit their own petitions" on public.petitions;

create policy "Only moderators submit their own petitions"
  on public.petitions for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status in ('draft', 'submitted')
    and public.current_civicsync_role() = 'moderator'
  );

drop policy if exists "Authorized reviewers update petitions" on public.petitions;

create policy "Administrators review petitions not their own"
  on public.petitions for update to authenticated
  using (
    public.current_civicsync_role() = 'admin'
    and user_id <> (select auth.uid())
  )
  with check (
    public.current_civicsync_role() = 'admin'
    and user_id <> (select auth.uid())
  );

create or replace function public.change_civicsync_role(
  target_user uuid,
  next_role text,
  next_department uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_role text;
begin
  if public.current_civicsync_role() is distinct from 'admin' then
    raise exception 'Only a CivicSync administrator can change account roles.';
  end if;

  if next_role not in ('citizen', 'moderator', 'representative_pending', 'representative', 'department_official', 'coordinator', 'admin') then
    raise exception 'The requested CivicSync role is not valid.';
  end if;
  if next_role = 'department_official' and next_department is null then
    raise exception 'A department must be assigned to a department official.';
  end if;

  select role into previous_role
  from public.profiles
  where id = target_user
  for update;

  if not found then
    raise exception 'The target account does not have a CivicSync profile.';
  end if;

  update public.profiles
  set role = next_role,
      department_id = case when next_role = 'department_official' then next_department else null end
  where id = target_user;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, details)
  values (
    (select auth.uid()),
    'permission_changed',
    'profile',
    target_user,
    jsonb_build_object(
      'from_role', previous_role,
      'to_role', next_role,
      'department_id', case when next_role = 'department_official' then next_department else null end
    )
  );
end;
$$;

create or replace function public.change_civicsync_role_by_email(
  target_email text,
  next_role text,
  next_department uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_user uuid;
  previous_role text;
begin
  if public.current_civicsync_role() is distinct from 'admin' then
    raise exception 'Only a CivicSync administrator can change account roles.';
  end if;

  if next_role not in ('citizen', 'moderator', 'representative_pending', 'representative', 'department_official', 'coordinator', 'admin') then
    raise exception 'The requested CivicSync role is not valid.';
  end if;
  if next_role = 'department_official' and next_department is null then
    raise exception 'A department must be assigned to a department official.';
  end if;

  select u.id, p.role
  into target_user, previous_role
  from auth.users u
  join public.profiles p on p.id = u.id
  where lower(u.email) = lower(trim(target_email))
  for update of p;

  if not found then
    raise exception 'No signed-up CivicSync account was found for that email.';
  end if;

  update public.profiles
  set role = next_role,
      department_id = case when next_role = 'department_official' then next_department else null end
  where id = target_user;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, details)
  values (
    (select auth.uid()),
    'permission_changed',
    'profile',
    target_user,
    jsonb_build_object(
      'from_role', previous_role,
      'to_role', next_role,
      'department_id', case when next_role = 'department_official' then next_department else null end
    )
  );
end;
$$;

revoke all on function public.change_civicsync_role(uuid, text, uuid) from public, anon;
revoke all on function public.change_civicsync_role_by_email(text, text, uuid) from public, anon;
grant execute on function public.change_civicsync_role(uuid, text, uuid) to authenticated;
grant execute on function public.change_civicsync_role_by_email(text, text, uuid) to authenticated;
