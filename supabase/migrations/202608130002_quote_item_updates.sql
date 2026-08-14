create or replace function public.update_quote_item(
  p_item_id uuid,
  p_description text,
  p_quantity numeric,
  p_unit_price_cents integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_quote_id uuid;
begin
  if not public.can_manage_quotes() then
    raise exception 'not allowed';
  end if;

  select quote_id
  into target_quote_id
  from public.quote_items
  where id = p_item_id;

  if target_quote_id is null then
    raise exception 'quote item not found';
  end if;

  update public.quote_items
  set
    description = trim(p_description),
    quantity = p_quantity,
    unit_price_cents = p_unit_price_cents
  where id = p_item_id;

  perform public.recalculate_quote_total(target_quote_id);

  insert into public.quote_history (quote_id, actor_id, action, metadata)
  values (
    target_quote_id,
    auth.uid(),
    'Item atualizado',
    jsonb_build_object('item_id', p_item_id, 'description', trim(p_description))
  );

  return target_quote_id;
end;
$$;

create or replace function public.remove_quote_item(p_item_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_quote_id uuid;
  removed_description text;
begin
  if not public.can_manage_quotes() then
    raise exception 'not allowed';
  end if;

  select quote_id, description
  into target_quote_id, removed_description
  from public.quote_items
  where id = p_item_id;

  if target_quote_id is null then
    raise exception 'quote item not found';
  end if;

  delete from public.quote_items
  where id = p_item_id;

  perform public.recalculate_quote_total(target_quote_id);

  insert into public.quote_history (quote_id, actor_id, action, metadata)
  values (
    target_quote_id,
    auth.uid(),
    'Item removido',
    jsonb_build_object('item_id', p_item_id, 'description', removed_description)
  );

  return target_quote_id;
end;
$$;

grant execute on function public.update_quote_item(uuid, text, numeric, integer) to authenticated;
grant execute on function public.remove_quote_item(uuid) to authenticated;
