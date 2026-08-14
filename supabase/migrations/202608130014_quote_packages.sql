-- Fase 3: pacote escolhido no orçamento.
create table public.quote_packages (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null unique references public.quotes(id) on delete cascade,
  package_id uuid not null references public.event_package_catalog(id) on delete restrict,
  unit_price_cents integer not null check (unit_price_cents >= 0),
  guest_count integer not null check (guest_count > 0),
  total_price_cents integer not null check (total_price_cents >= 0),
  notes text check (notes is null or char_length(notes) <= 1200),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index quote_packages_package_idx on public.quote_packages (package_id);

alter table public.quote_packages enable row level security;

create policy "active users read quote packages" on public.quote_packages
  for select to authenticated using (public.is_active_user());
create policy "quote managers create quote packages" on public.quote_packages
  for insert to authenticated with check (public.can_manage_quotes() and created_by = auth.uid());
create policy "quote managers update quote packages" on public.quote_packages
  for update to authenticated using (public.can_manage_quotes()) with check (public.can_manage_quotes());
create policy "quote managers delete quote packages" on public.quote_packages
  for delete to authenticated using (public.can_manage_quotes());

create trigger quote_packages_touch_updated_at
  before update on public.quote_packages
  for each row execute function public.touch_updated_at();

create or replace function public.recalculate_quote_total(p_quote_id uuid) returns void
language sql
security definer
set search_path = public
as $$
  update public.quotes
  set total_amount_cents =
    coalesce((
      select sum(round(quantity * unit_price_cents)::integer)
      from public.quote_items
      where quote_id = p_quote_id
    ), 0)
    + coalesce((
      select sum(total_price_cents)
      from public.quote_packages
      where quote_id = p_quote_id
    ), 0)
  where id = p_quote_id;
$$;

create function public.set_quote_package(
  p_quote_id uuid,
  p_package_id uuid,
  p_unit_price_cents integer default null,
  p_notes text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  quote_row public.quotes%rowtype;
  package_row public.event_package_catalog%rowtype;
  final_unit_price_cents integer;
  final_guest_count integer;
  selected_id uuid;
begin
  if not public.can_edit_quote(p_quote_id) then
    raise exception 'quote editing is locked' using errcode = '42501';
  end if;

  select * into quote_row from public.quotes where id = p_quote_id;
  if quote_row.id is null then
    raise exception 'quote not found' using errcode = 'P0002';
  end if;

  if quote_row.guest_count is null or quote_row.guest_count <= 0 then
    raise exception 'guest count is required to apply a package' using errcode = '22023';
  end if;

  select * into package_row
  from public.event_package_catalog
  where id = p_package_id and is_active;

  if package_row.id is null then
    raise exception 'package not found' using errcode = 'P0002';
  end if;

  if quote_row.event_type is not null and package_row.event_type <> quote_row.event_type then
    raise exception 'package event type does not match quote event type' using errcode = '22023';
  end if;

  final_unit_price_cents := coalesce(p_unit_price_cents, package_row.base_price_cents, 0);
  final_guest_count := quote_row.guest_count;

  insert into public.quote_packages (
    quote_id,
    package_id,
    unit_price_cents,
    guest_count,
    total_price_cents,
    notes,
    created_by
  ) values (
    quote_row.id,
    package_row.id,
    final_unit_price_cents,
    final_guest_count,
    final_unit_price_cents * final_guest_count,
    nullif(trim(coalesce(p_notes, '')), ''),
    auth.uid()
  )
  on conflict (quote_id)
  do update set
    package_id = excluded.package_id,
    unit_price_cents = excluded.unit_price_cents,
    guest_count = excluded.guest_count,
    total_price_cents = excluded.total_price_cents,
    notes = excluded.notes
  returning id into selected_id;

  perform public.recalculate_quote_total(p_quote_id);

  insert into public.quote_history (quote_id, actor_id, action, metadata)
  values (
    p_quote_id,
    auth.uid(),
    'Pacote do orçamento selecionado',
    jsonb_build_object('package_id', p_package_id, 'package_name', package_row.name, 'unit_price_cents', final_unit_price_cents, 'guest_count', final_guest_count)
  );

  return selected_id;
end;
$$;

create function public.remove_quote_package(p_quote_id uuid) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  package_name text;
begin
  if not public.can_edit_quote(p_quote_id) then
    raise exception 'quote editing is locked' using errcode = '42501';
  end if;

  select p.name
  into package_name
  from public.quote_packages qp
  join public.event_package_catalog p on p.id = qp.package_id
  where qp.quote_id = p_quote_id;

  delete from public.quote_packages
  where quote_id = p_quote_id;

  perform public.recalculate_quote_total(p_quote_id);

  insert into public.quote_history (quote_id, actor_id, action, metadata)
  values (p_quote_id, auth.uid(), 'Pacote do orçamento removido', jsonb_build_object('package_name', package_name));

  return p_quote_id;
end;
$$;

grant execute on function public.set_quote_package(uuid, uuid, integer, text) to authenticated;
grant execute on function public.remove_quote_package(uuid) to authenticated;
