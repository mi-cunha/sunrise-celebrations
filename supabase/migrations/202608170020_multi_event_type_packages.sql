-- Permite que um mesmo pacote seja usado em diferentes tipos de evento.
alter table public.event_package_catalog
  add column if not exists event_types text[] not null default '{}';

update public.event_package_catalog
set event_types = array[event_type]
where coalesce(array_length(event_types, 1), 0) = 0
  and event_type is not null;

create index if not exists event_package_catalog_event_types_idx
  on public.event_package_catalog using gin (event_types);

create or replace function public.set_quote_package(
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

  if quote_row.event_type is not null
    and not (
      package_row.event_type = quote_row.event_type
      or quote_row.event_type = any(coalesce(package_row.event_types, array[]::text[]))
    )
  then
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
