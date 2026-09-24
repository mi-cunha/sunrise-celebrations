-- Permite alterar os itens reutilizáveis de um pacote sem deixar cópias órfãs.
create or replace function public.update_event_package_rule(
  p_rule_id uuid,
  p_title text,
  p_selection_min integer,
  p_selection_max integer,
  p_is_required boolean,
  p_item_ids uuid[]
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_rule public.event_package_rules%rowtype;
  removed_rule_item_ids uuid[];
begin
  if not public.has_permission('admin_owner') then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  select * into target_rule from public.event_package_rules where id = p_rule_id;
  if target_rule.id is null then
    raise exception 'package rule not found' using errcode = 'P0002';
  end if;

  if coalesce(array_length(p_item_ids, 1), 0) = 0 then
    raise exception 'select at least one item' using errcode = '22023';
  end if;
  if p_selection_min < 0 or p_selection_max < 0 or (p_selection_min > 0 and p_selection_max = 0) or p_selection_min > p_selection_max or p_selection_max > array_length(p_item_ids, 1) then
    raise exception 'invalid selection limits' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.event_package_item_catalog
    where id = any(p_item_ids) and subcategory_id <> target_rule.subcategory_id
  ) or (select count(*) from public.event_package_item_catalog where id = any(p_item_ids)) <> array_length(p_item_ids, 1) then
    raise exception 'items must belong to the rule subcategory' using errcode = '22023';
  end if;

  select coalesce(array_agg(id), '{}'::uuid[]) into removed_rule_item_ids
  from public.event_package_rule_items
  where package_rule_id = p_rule_id and item_catalog_id <> all(p_item_ids);

  if exists (
    select 1
    from public.quote_package_item_choices choice
    join public.event_package_items item on item.id = choice.package_item_id
    where item.source_rule_item_id = any(removed_rule_item_ids)
  ) or exists (
    select 1 from public.quote_package_rule_choices
    where package_rule_id = p_rule_id and item_catalog_id = any(
      select item_catalog_id from public.event_package_rule_items where id = any(removed_rule_item_ids)
    )
  ) then
    raise exception 'one or more items are already used in a quote and cannot be removed' using errcode = '23503';
  end if;

  delete from public.event_package_items where source_rule_item_id = any(removed_rule_item_ids);
  delete from public.event_package_rule_items where id = any(removed_rule_item_ids);

  update public.event_package_rules
  set title = nullif(btrim(p_title), ''),
      selection_min = p_selection_min,
      selection_max = p_selection_max,
      is_required = p_is_required
  where id = p_rule_id;

  insert into public.event_package_rule_items (package_rule_id, item_catalog_id)
  select p_rule_id, item_id
  from unnest(p_item_ids) as selected(item_id)
  where not exists (
    select 1 from public.event_package_rule_items
    where package_rule_id = p_rule_id and item_catalog_id = selected.item_id
  );
end;
$$;

create or replace function public.remove_event_package_rule(p_rule_id uuid) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  rule_item_ids uuid[];
begin
  if not public.has_permission('admin_owner') then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  select coalesce(array_agg(id), '{}'::uuid[]) into rule_item_ids
  from public.event_package_rule_items where package_rule_id = p_rule_id;

  if not exists (select 1 from public.event_package_rules where id = p_rule_id) then
    raise exception 'package rule not found' using errcode = 'P0002';
  end if;
  if exists (
    select 1
    from public.quote_package_item_choices choice
    join public.event_package_items item on item.id = choice.package_item_id
    where item.source_rule_item_id = any(rule_item_ids)
  ) or exists (select 1 from public.quote_package_rule_choices where package_rule_id = p_rule_id) then
    raise exception 'this group is already used in a quote and cannot be removed' using errcode = '23503';
  end if;

  delete from public.event_package_items where source_rule_item_id = any(rule_item_ids);
  delete from public.event_package_rule_items where id = any(rule_item_ids);
  delete from public.event_package_rules where id = p_rule_id;
end;
$$;

revoke all on function public.update_event_package_rule(uuid, text, integer, integer, boolean, uuid[]) from public;
revoke all on function public.remove_event_package_rule(uuid) from public;
grant execute on function public.update_event_package_rule(uuid, text, integer, integer, boolean, uuid[]) to authenticated;
grant execute on function public.remove_event_package_rule(uuid) to authenticated;
