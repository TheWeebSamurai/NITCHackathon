create extension if not exists pgcrypto with schema extensions;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'citizen'
    check (role in ('citizen', 'representative_pending', 'representative', 'department_official', 'coordinator', 'admin')),
  department_id uuid,
  created_at timestamptz not null default now()
);

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table public.kerala_pincodes (
  pin_code text primary key check (pin_code ~ '^(67|68|69)[0-9]{4}$'),
  districts text[] not null default '{}',
  post_offices jsonb not null default '[]'::jsonb,
  source text not null default 'api.postalpincode.in',
  verified_at timestamptz not null default now()
);

alter table public.profiles
  add constraint profiles_department_id_fkey
  foreign key (department_id) references public.departments (id) on delete set null;

create table public.public_works (
  id uuid primary key default gen_random_uuid(),
  reference_code text not null unique
    default ('CS-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  title text not null check (length(trim(title)) between 3 and 180),
  description text not null check (length(trim(description)) between 10 and 10000),
  pin_code text not null references public.kerala_pincodes (pin_code) on delete restrict,
  locality text not null check (length(trim(locality)) between 2 and 160),
  department_id uuid not null references public.departments (id) on delete restrict,
  category text not null check (category in ('Roads & transport', 'Water & drainage', 'Electricity', 'Telecommunications', 'Public safety', 'Other public works')),
  status text not null default 'under_review'
    check (status in ('draft', 'under_review', 'scheduled', 'in_progress', 'postponed', 'completed', 'cancelled')),
  start_date date not null,
  end_date date not null,
  disruption text check (disruption is null or length(disruption) <= 2000),
  is_published boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint public_works_valid_schedule check (end_date >= start_date)
);

create index public_works_pin_schedule_idx on public.public_works (pin_code, start_date, end_date);
create index public_works_department_idx on public.public_works (department_id);

create table public.project_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.public_works (id) on delete restrict,
  event_type text not null
    check (event_type in ('project_created', 'schedule_update', 'status_update', 'disruption_notice', 'work_started', 'work_completed', 'other')),
  title text not null check (length(trim(title)) between 3 and 180),
  description text not null check (length(trim(description)) between 3 and 3000),
  department_name text not null,
  is_public boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index project_events_project_date_idx on public.project_events (project_id, created_at desc);

create table public.petitions (
  id uuid primary key default gen_random_uuid(),
  reference_code text not null unique
    default ('PET-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  user_id uuid not null references auth.users (id) on delete restrict,
  title text not null check (length(trim(title)) between 5 and 180),
  category text not null check (category in ('Roads & transport', 'Water & drainage', 'Electricity', 'Public safety', 'Other public works')),
  pin_code text not null references public.kerala_pincodes (pin_code) on delete restrict,
  locality text not null check (length(trim(locality)) between 2 and 160),
  description text not null check (length(trim(description)) between 20 and 5000),
  reason text check (reason is null or length(reason) <= 2000),
  status text not null default 'submitted'
    check (status in ('draft', 'submitted', 'under_review', 'approved', 'rejected', 'revision_requested')),
  official_response text check (official_response is null or length(official_response) <= 3000),
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index petitions_owner_date_idx on public.petitions (user_id, submitted_at desc);
create index petitions_pin_status_idx on public.petitions (pin_code, status);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (length(title) between 1 and 180),
  body text not null check (length(body) between 1 and 2000),
  notification_type text not null,
  related_project_id uuid references public.public_works (id) on delete set null,
  related_petition_id uuid references public.petitions (id) on delete set null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_entity_date_idx on public.audit_logs (entity_type, entity_id, created_at desc);

create table public.kerala_pin_lookup_limits (
  ip_hash text primary key,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0,
  updated_at timestamptz not null default now()
);
create index kerala_pin_lookup_limits_updated_idx on public.kerala_pin_lookup_limits (updated_at);

create or replace function public.current_civicsync_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = (select auth.uid())
$$;

create or replace function public.can_manage_department(target_department uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and (
        p.role in ('coordinator', 'admin')
        or (p.role = 'department_official' and p.department_id = target_department)
      )
  )
$$;

create or replace function public.can_review_petitions()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.role in ('department_official', 'coordinator', 'admin')
  )
$$;

create or replace function public.consume_kerala_pin_lookup(ip_digest text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_count integer;
begin
  if length(ip_digest) <> 64 or ip_digest !~ '^[0-9a-f]{64}$' then
    return false;
  end if;

  delete from public.kerala_pin_lookup_limits
  where updated_at < now() - interval '2 days';

  insert into public.kerala_pin_lookup_limits (ip_hash, window_started_at, request_count, updated_at)
  values (ip_digest, now(), 1, now())
  on conflict (ip_hash) do update
    set window_started_at = case
          when public.kerala_pin_lookup_limits.window_started_at < now() - interval '15 minutes' then now()
          else public.kerala_pin_lookup_limits.window_started_at
        end,
        request_count = case
          when public.kerala_pin_lookup_limits.window_started_at < now() - interval '15 minutes' then 1
          else public.kerala_pin_lookup_limits.request_count + 1
        end,
        updated_at = now()
  returning request_count into current_count;

  return current_count <= 30;
end;
$$;

create or replace function public.create_civicsync_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, role)
  values (new.id, 'citizen')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created_civicsync_profile
  after insert on auth.users
  for each row execute function public.create_civicsync_profile();

insert into public.profiles (id, role)
select id, 'citizen'
from auth.users
on conflict (id) do nothing;

create or replace function public.set_civicsync_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger public_works_updated_at
  before update on public.public_works
  for each row execute function public.set_civicsync_updated_at();
create trigger petitions_updated_at
  before update on public.petitions
  for each row execute function public.set_civicsync_updated_at();

create or replace function public.audit_public_work_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_title text;
  event_type_value text;
  event_description text;
begin
  if tg_op = 'INSERT' then
    insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, details)
    values (new.created_by, 'project_created', 'public_work', new.id,
      jsonb_build_object('reference_code', new.reference_code, 'status', new.status, 'is_published', new.is_published));
    event_title := 'Project created';
    event_type_value := 'project_created';
    event_description := 'A public works record was created.';
    insert into public.project_events (project_id, event_type, title, description, department_name, is_public, created_by)
    select new.id, event_type_value, event_title, event_description, d.name, new.is_published, new.created_by
    from public.departments d where d.id = new.department_id;
    return new;
  end if;

  if row(new.start_date, new.end_date, new.pin_code, new.locality)
     is distinct from row(old.start_date, old.end_date, old.pin_code, old.locality) then
    event_title := 'Project schedule or location updated';
    event_type_value := 'schedule_update';
    event_description := 'The project schedule or affected location was revised.';
  elsif row(new.status, new.is_published) is distinct from row(old.status, old.is_published) then
    event_title := 'Project status updated';
    event_type_value := 'status_update';
    event_description := 'The official project status or publication state was updated.';
  else
    event_title := 'Project details updated';
    event_type_value := 'other';
    event_description := 'Official project details were updated.';
  end if;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, details)
  values (auth.uid(), event_type_value, 'public_work', new.id,
    jsonb_build_object('reference_code', new.reference_code, 'from_status', old.status, 'to_status', new.status, 'is_published', new.is_published));

  insert into public.project_events (project_id, event_type, title, description, department_name, is_public, created_by)
  select new.id, event_type_value, event_title, event_description, d.name, new.is_published, auth.uid()
  from public.departments d where d.id = new.department_id;
  return new;
end;
$$;

create or replace function public.enforce_publication_authority()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.is_published
     and public.current_civicsync_role() is distinct from 'coordinator'
     and public.current_civicsync_role() is distinct from 'admin' then
    raise exception 'Only a coordinator or administrator can publish an official public work.';
  end if;
  if tg_op = 'UPDATE' and new.is_published and not old.is_published
     and public.current_civicsync_role() is distinct from 'coordinator'
     and public.current_civicsync_role() is distinct from 'admin' then
    raise exception 'Only a coordinator or administrator can publish an official public work.';
  end if;
  return new;
end;
$$;

create trigger enforce_public_work_publication
  before insert or update of is_published on public.public_works
  for each row execute function public.enforce_publication_authority();

create trigger audit_public_works
  after insert or update on public.public_works
  for each row execute function public.audit_public_work_change();

create or replace function public.audit_petition_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, details)
    values (new.user_id, 'petition_submitted', 'petition', new.id,
      jsonb_build_object('reference_code', new.reference_code, 'status', new.status));
    return new;
  end if;

  if old.status is distinct from new.status or old.official_response is distinct from new.official_response then
    insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, details)
    values (auth.uid(), 'petition_decision_updated', 'petition', new.id,
      jsonb_build_object('reference_code', new.reference_code, 'from_status', old.status, 'to_status', new.status));
  end if;
  return new;
end;
$$;

create or replace function public.change_civicsync_role(target_user uuid, next_role text, next_department uuid default null)
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
  if next_role not in ('citizen', 'representative_pending', 'representative', 'department_official', 'coordinator', 'admin') then
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
  values ((select auth.uid()), 'permission_changed', 'profile', target_user,
    jsonb_build_object('from_role', previous_role, 'to_role', next_role, 'department_id', case when next_role = 'department_official' then next_department else null end));
end;
$$;

create trigger audit_petition_changes
  after insert or update on public.petitions
  for each row execute function public.audit_petition_change();

alter table public.profiles enable row level security;
alter table public.departments enable row level security;
alter table public.kerala_pincodes enable row level security;
alter table public.public_works enable row level security;
alter table public.project_events enable row level security;
alter table public.petitions enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;
alter table public.kerala_pin_lookup_limits enable row level security;

create policy "Users can read own profile"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.current_civicsync_role() = 'admin');

create policy "Departments are public"
  on public.departments for select to anon, authenticated
  using (true);
create policy "Verified Kerala PIN records are public"
  on public.kerala_pincodes for select to anon, authenticated
  using (true);
create policy "Administrators manage departments"
  on public.departments for all to authenticated
  using (public.current_civicsync_role() = 'admin')
  with check (public.current_civicsync_role() = 'admin');

create policy "Published works are public"
  on public.public_works for select to anon, authenticated
  using (is_published = true and status in ('scheduled', 'in_progress', 'postponed', 'completed', 'cancelled'));
create policy "Authorized staff view assigned works"
  on public.public_works for select to authenticated
  using (public.can_manage_department(department_id));
create policy "Authorized users create works"
  on public.public_works for insert to authenticated
  with check (
    public.can_manage_department(department_id)
    and created_by = (select auth.uid())
  );
create policy "Authorized users update works"
  on public.public_works for update to authenticated
  using (public.can_manage_department(department_id))
  with check (public.can_manage_department(department_id));

create policy "Public events for published works"
  on public.project_events for select to anon, authenticated
  using (
    is_public = true
    and exists (
      select 1 from public.public_works w
      where w.id = project_id and w.is_published = true
    )
  );
create policy "Authorized users append project events"
  on public.project_events for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and exists (
      select 1 from public.public_works w
      where w.id = project_id and public.can_manage_department(w.department_id)
    )
  );

create policy "Petition owners and reviewers can read"
  on public.petitions for select to authenticated
  using (user_id = (select auth.uid()) or public.can_review_petitions());
create policy "Authenticated citizens can submit petitions"
  on public.petitions for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status in ('draft', 'submitted')
    and public.current_civicsync_role() in ('citizen', 'representative_pending', 'representative')
  );
create policy "Authorized reviewers update petitions"
  on public.petitions for update to authenticated
  using (public.can_review_petitions())
  with check (public.can_review_petitions());

create policy "Users can read own notifications"
  on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Users can mark own notifications read"
  on public.notifications for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Coordinators and administrators read audit logs"
  on public.audit_logs for select to authenticated
  using (public.current_civicsync_role() in ('coordinator', 'admin'));

revoke all on all tables in schema public from anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select on public.departments, public.kerala_pincodes, public.public_works, public.project_events to anon, authenticated;
grant insert, update, delete on public.departments to authenticated;
grant select on public.profiles, public.petitions, public.notifications, public.audit_logs to authenticated;
grant insert, update on public.public_works to authenticated;
grant insert on public.project_events to authenticated;
grant insert on public.petitions to authenticated;
grant update (status, official_response) on public.petitions to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant execute on function public.current_civicsync_role() to authenticated;
grant execute on function public.can_manage_department(uuid) to authenticated;
grant execute on function public.can_review_petitions() to authenticated;
grant execute on function public.change_civicsync_role(uuid, text, uuid) to authenticated;
revoke all on function public.consume_kerala_pin_lookup(text) from public, anon, authenticated;
grant execute on function public.consume_kerala_pin_lookup(text) to service_role;
revoke all on function public.create_civicsync_profile() from public, anon, authenticated;
revoke all on function public.set_civicsync_updated_at() from public, anon, authenticated;
revoke all on function public.audit_public_work_change() from public, anon, authenticated;
revoke all on function public.audit_petition_change() from public, anon, authenticated;
revoke all on function public.enforce_publication_authority() from public, anon, authenticated;
revoke all on function public.change_civicsync_role(uuid, text, uuid) from public, anon;
revoke all on public.kerala_pin_lookup_limits from anon, authenticated;
