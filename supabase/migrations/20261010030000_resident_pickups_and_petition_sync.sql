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
    'admin',
    'asha_worker'
  ));

create table public.resident_verifications (
  user_id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null check (length(trim(full_name)) between 2 and 160),
  date_of_birth date not null check (date_of_birth <= current_date),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.resident_verifications enable row level security;
create policy "Residents manage their private verification details"
  on public.resident_verifications for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on public.resident_verifications from public, anon, authenticated;
grant select, insert, update on public.resident_verifications to authenticated;

create trigger resident_verifications_updated_at
  before update on public.resident_verifications
  for each row execute function public.set_civicsync_updated_at();

create or replace function public.has_verified_resident_profile(target_user uuid)
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
      join auth.users u on u.id = v.user_id
      where v.user_id = target_user
        and u.phone_confirmed_at is not null
    )
$$;

revoke all on function public.has_verified_resident_profile(uuid) from public, anon;
grant execute on function public.has_verified_resident_profile(uuid) to authenticated;

drop policy if exists "Only moderators submit their own petitions" on public.petitions;
drop policy if exists "Authenticated citizens can submit petitions" on public.petitions;
drop policy if exists "Authenticated users can submit their own petitions" on public.petitions;
create policy "Verified residents submit their own petitions"
  on public.petitions for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status in ('draft', 'submitted')
    and public.current_civicsync_role() in ('citizen', 'moderator', 'representative_pending', 'representative')
    and public.has_verified_resident_profile((select auth.uid()))
  );

alter table public.petitions
  add column if not exists public_work_id uuid
  references public.public_works (id) on delete set null;

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
  if next_role not in ('citizen', 'moderator', 'representative_pending', 'representative', 'department_official', 'coordinator', 'admin', 'asha_worker') then
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
    jsonb_build_object('from_role', previous_role, 'to_role', next_role, 'department_id', case when next_role = 'department_official' then next_department else null end)
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
begin
  if public.current_civicsync_role() is distinct from 'admin' then
    raise exception 'Only a CivicSync administrator can change account roles.';
  end if;
  if next_role not in ('citizen', 'moderator', 'representative_pending', 'representative', 'department_official', 'coordinator', 'admin', 'asha_worker') then
    raise exception 'The requested CivicSync role is not valid.';
  end if;
  if next_role = 'department_official' and next_department is null then
    raise exception 'A department must be assigned to a department official.';
  end if;

  select u.id into target_user
  from auth.users u
  join public.profiles p on p.id = u.id
  where lower(u.email) = lower(trim(target_email))
  for update of p;

  if not found then
    raise exception 'No signed-up CivicSync account was found for that email.';
  end if;

  perform public.change_civicsync_role(target_user, next_role, next_department);
end;
$$;

revoke all on function public.change_civicsync_role(uuid, text, uuid) from public, anon;
revoke all on function public.change_civicsync_role_by_email(text, text, uuid) from public, anon;
grant execute on function public.change_civicsync_role(uuid, text, uuid) to authenticated;
grant execute on function public.change_civicsync_role_by_email(text, text, uuid) to authenticated;

create or replace function public.review_civicsync_petition(
  target_petition uuid,
  next_status text,
  response_text text,
  project_department uuid default null,
  project_category text default null,
  project_start date default null,
  project_end date default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  petition_row public.petitions%rowtype;
  linked_project uuid;
begin
  if public.current_civicsync_role() is distinct from 'admin' then
    raise exception 'Only an administrator can review petitions.';
  end if;

  if next_status not in ('submitted', 'under_review', 'approved', 'rejected', 'revision_requested') then
    raise exception 'The requested petition status is not valid.';
  end if;

  select * into petition_row
  from public.petitions
  where id = target_petition
  for update;

  if not found then
    raise exception 'The petition could not be found.';
  end if;
  if petition_row.user_id = (select auth.uid()) then
    raise exception 'Administrators cannot review petitions submitted by their own account.';
  end if;

  if next_status = 'approved' then
    if petition_row.public_work_id is null then
      if project_department is null or project_category is null or project_start is null or project_end is null then
        raise exception 'Choose a department, project category, and date range to create the draft public-work record.';
      end if;
      if project_end < project_start then
        raise exception 'The project end date must be on or after the start date.';
      end if;
      if not exists (
        select 1 from public.project_categories
        where name = project_category and for_projects = true and is_active = true
      ) then
        raise exception 'Choose an active category that is enabled for public works.';
      end if;

      insert into public.public_works (
        title,
        description,
        pin_code,
        locality,
        department_id,
        category,
        status,
        start_date,
        end_date,
        is_published,
        created_by
      )
      values (
        petition_row.title,
        petition_row.description,
        petition_row.pin_code,
        petition_row.locality,
        project_department,
        project_category,
        'draft',
        project_start,
        project_end,
        false,
        (select auth.uid())
      )
      returning id into linked_project;
    else
      linked_project := petition_row.public_work_id;
    end if;
  end if;

  update public.petitions
  set status = next_status,
      official_response = nullif(trim(response_text), ''),
      public_work_id = coalesce(linked_project, public_work_id)
  where id = target_petition;

  return coalesce(linked_project, petition_row.public_work_id);
end;
$$;

revoke all on function public.review_civicsync_petition(uuid, text, text, uuid, text, date, date) from public, anon;
grant execute on function public.review_civicsync_petition(uuid, text, text, uuid, text, date, date) to authenticated;

drop policy if exists "Authorized users append project events" on public.project_events;
create policy "Authorized users append private project checkpoints"
  on public.project_events for insert to authenticated
  with check (
    is_public = false
    and created_by = (select auth.uid())
    and exists (
      select 1 from public.public_works w
      where w.id = project_id and public.can_manage_department(w.department_id)
    )
  );

create policy "Staff can read checkpoints for managed projects"
  on public.project_events for select to authenticated
  using (
    exists (
      select 1 from public.public_works w
      where w.id = project_id and public.can_manage_department(w.department_id)
    )
  );

alter table public.project_events
  add column if not exists is_checkpoint boolean not null default false;

create or replace function public.save_project_checkpoint(
  target_project uuid,
  checkpoint_title text,
  checkpoint_description text,
  publish_checkpoint boolean default false,
  target_event uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_role text;
  event_id uuid;
  project_department uuid;
  project_published boolean;
begin
  actor_role := public.current_civicsync_role();
  if actor_role not in ('department_official', 'coordinator', 'admin') then
    raise exception 'You are not authorized to manage project checkpoints.';
  end if;
  if length(trim(checkpoint_title)) not between 3 and 180
     or length(trim(checkpoint_description)) not between 3 and 3000 then
    raise exception 'Checkpoint title or description is outside the allowed length.';
  end if;

  select department_id, is_published
  into project_department, project_published
  from public.public_works
  where id = target_project;
  if not found or not public.can_manage_department(project_department) then
    raise exception 'You cannot manage checkpoints for this project.';
  end if;

  if publish_checkpoint and (actor_role not in ('coordinator', 'admin') or not project_published) then
    raise exception 'Only an administrator or coordinator can publish a checkpoint for a published project.';
  end if;

  if target_event is null then
    insert into public.project_events (
      project_id,
      event_type,
      title,
      description,
      department_name,
      is_public,
      is_checkpoint,
      created_by
    )
    select
      target_project,
      'other',
      trim(checkpoint_title),
      trim(checkpoint_description),
      d.name,
      publish_checkpoint,
      true,
      (select auth.uid())
    from public.departments d
    where d.id = project_department
    returning id into event_id;
  else
    update public.project_events
    set title = trim(checkpoint_title),
        description = trim(checkpoint_description),
        is_public = publish_checkpoint
    where id = target_event
      and project_id = target_project
      and is_checkpoint = true
      and (not is_public or actor_role in ('coordinator', 'admin'))
    returning id into event_id;
    if event_id is null then
      raise exception 'The checkpoint could not be updated or you are not authorized to publish it.';
    end if;
  end if;

  return event_id;
end;
$$;

revoke all on function public.save_project_checkpoint(uuid, text, text, boolean, uuid) from public, anon;
grant execute on function public.save_project_checkpoint(uuid, text, text, boolean, uuid) to authenticated;

create table public.waste_pickups (
  id uuid primary key default gen_random_uuid(),
  reference_code text not null unique
    default ('WP-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  resident_id uuid not null references auth.users (id) on delete restrict,
  assigned_worker_id uuid references auth.users (id) on delete set null,
  pin_code text not null references public.kerala_pincodes (pin_code) on delete restrict,
  locality text not null check (length(trim(locality)) between 2 and 160),
  address text not null check (length(trim(address)) between 5 and 500),
  bag_count integer not null default 1 check (bag_count between 1 and 20),
  instructions text check (instructions is null or length(instructions) <= 1000),
  status text not null default 'requested'
    check (status in ('requested', 'assigned', 'on_the_way', 'at_door', 'bag_collected', 'completed', 'unable_to_collect')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index waste_pickups_resident_date_idx on public.waste_pickups (resident_id, created_at desc);
create index waste_pickups_worker_status_idx on public.waste_pickups (assigned_worker_id, status, created_at);

alter table public.waste_pickups enable row level security;
create policy "Verified residents request household pickups"
  on public.waste_pickups for insert to authenticated
  with check (
    resident_id = (select auth.uid())
    and assigned_worker_id is null
    and status = 'requested'
    and public.current_civicsync_role() = 'citizen'
    and public.has_verified_resident_profile((select auth.uid()))
  );
create policy "Residents workers and admins read permitted pickups"
  on public.waste_pickups for select to authenticated
  using (
    resident_id = (select auth.uid())
    or assigned_worker_id = (select auth.uid())
    or public.current_civicsync_role() = 'admin'
  );

revoke all on public.waste_pickups from public, anon, authenticated;
grant select, insert on public.waste_pickups to authenticated;

create trigger waste_pickups_updated_at
  before update on public.waste_pickups
  for each row execute function public.set_civicsync_updated_at();

create or replace function public.list_civicsync_asha_workers()
returns table(worker_id uuid, full_name text, email text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if public.current_civicsync_role() is distinct from 'admin' then
    raise exception 'Only administrators can list ASHA Workers.';
  end if;

  return query
  select p.id, coalesce(v.full_name, ''), u.email::text
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.resident_verifications v on v.user_id = p.id
  where p.role = 'asha_worker'
  order by coalesce(v.full_name, u.email::text);
end;
$$;

create or replace function public.assign_civicsync_waste_pickup(
  target_pickup uuid,
  target_worker uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.current_civicsync_role() is distinct from 'admin' then
    raise exception 'Only administrators can assign a pickup.';
  end if;
  if not exists (select 1 from public.profiles where id = target_worker and role = 'asha_worker') then
    raise exception 'The selected account is not an ASHA Worker.';
  end if;

  update public.waste_pickups
  set assigned_worker_id = target_worker,
      status = 'assigned'
  where id = target_pickup
    and status not in ('completed', 'bag_collected');

  if not found then
    raise exception 'The pickup could not be assigned or is already complete.';
  end if;
end;
$$;

create or replace function public.update_civicsync_waste_pickup_status(
  target_pickup uuid,
  next_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_status text;
begin
  if public.current_civicsync_role() is distinct from 'asha_worker' then
    raise exception 'Only an assigned ASHA Worker can update pickup status.';
  end if;

  select status into current_status
  from public.waste_pickups
  where id = target_pickup and assigned_worker_id = (select auth.uid())
  for update;
  if not found then
    raise exception 'This pickup is not assigned to your account.';
  end if;

  if not (
    (current_status = 'assigned' and next_status = 'on_the_way')
    or (current_status = 'on_the_way' and next_status = 'at_door')
    or (current_status = 'at_door' and next_status in ('bag_collected', 'unable_to_collect'))
    or (current_status = 'bag_collected' and next_status = 'completed')
  ) then
    raise exception 'That pickup status change is not allowed from the current step.';
  end if;

  update public.waste_pickups set status = next_status where id = target_pickup;
end;
$$;

revoke all on function public.list_civicsync_asha_workers() from public, anon;
revoke all on function public.assign_civicsync_waste_pickup(uuid, uuid) from public, anon;
revoke all on function public.update_civicsync_waste_pickup_status(uuid, text) from public, anon;
grant execute on function public.list_civicsync_asha_workers() to authenticated;
grant execute on function public.assign_civicsync_waste_pickup(uuid, uuid) to authenticated;
grant execute on function public.update_civicsync_waste_pickup_status(uuid, text) to authenticated;

do $$
declare
  table_name text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach table_name in array array['waste_pickups', 'project_events', 'public_works', 'petitions']
    loop
      if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = table_name
      ) then
        execute format('alter publication supabase_realtime add table public.%I', table_name);
      end if;
    end loop;
  end if;
end;
$$;
