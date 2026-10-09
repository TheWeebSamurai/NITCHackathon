insert into public.departments (name)
values
  ('Local Self Government Department'),
  ('Kerala Public Works Department'),
  ('Kerala Water Authority'),
  ('Kerala State Electricity Board'),
  ('Kerala Police')
on conflict (name) do nothing;
