create table public.project_categories (
  name text primary key check (length(trim(name)) between 2 and 80),
  for_projects boolean not null default true,
  for_petitions boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.project_categories (name, for_projects, for_petitions)
values
  ('Roads & transport', true, true),
  ('Water & drainage', true, true),
  ('Electricity', true, true),
  ('Telecommunications', true, false),
  ('Public safety', true, true),
  ('Other public works', true, true);

alter table public.public_works drop constraint public_works_category_check;
alter table public.public_works
  add constraint public_works_category_fkey
  foreign key (category) references public.project_categories (name)
  on update cascade on delete restrict;

alter table public.petitions drop constraint petitions_category_check;
alter table public.petitions
  add constraint petitions_category_fkey
  foreign key (category) references public.project_categories (name)
  on update cascade on delete restrict;

alter table public.project_categories enable row level security;

create policy "Categories are publicly readable"
  on public.project_categories for select to anon, authenticated
  using (true);
create policy "Administrators manage categories"
  on public.project_categories for all to authenticated
  using (public.current_civicsync_role() = 'admin')
  with check (public.current_civicsync_role() = 'admin');

grant select on public.project_categories to anon, authenticated;
grant insert, update, delete on public.project_categories to authenticated;
