alter table public.company_settings
  drop constraint if exists company_settings_logo_url_check;

alter table public.company_settings
  add constraint company_settings_logo_url_check
  check (logo_url is null or char_length(trim(logo_url)) <= 500000);

create table public.quote_item_catalog (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 120),
  description text check (description is null or char_length(trim(description)) <= 300),
  default_unit_price_cents integer check (default_unit_price_cents is null or default_unit_price_cents > 0),
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now()
);

create unique index quote_item_catalog_name_idx on public.quote_item_catalog (lower(name));

alter table public.quote_item_catalog enable row level security;

create policy "active users read quote item catalog" on public.quote_item_catalog
  for select to authenticated using (public.is_active_user());
create policy "owners insert quote item catalog" on public.quote_item_catalog
  for insert to authenticated with check (public.has_permission('admin_owner'));
create policy "owners update quote item catalog" on public.quote_item_catalog
  for update to authenticated using (public.has_permission('admin_owner')) with check (public.has_permission('admin_owner'));

create function public.add_quote_item_catalog_option(
  p_name text,
  p_description text,
  p_default_unit_price_cents integer
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_option_id uuid;
begin
  if not public.has_permission('admin_owner') then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  insert into public.quote_item_catalog (name, description, default_unit_price_cents)
  values (trim(p_name), nullif(trim(p_description), ''), p_default_unit_price_cents)
  returning id into new_option_id;

  return new_option_id;
end;
$$;

grant execute on function public.add_quote_item_catalog_option(text, text, integer) to authenticated;

insert into public.quote_item_catalog (name, sort_order) values
  ('Buffet completo', 10),
  ('DJ', 20),
  ('Bar de drinks', 30),
  ('Decoração', 40),
  ('Cerimonial', 50),
  ('Mobiliário', 60),
  ('Fotografia', 70),
  ('Outro item manual', 100)
on conflict do nothing;
