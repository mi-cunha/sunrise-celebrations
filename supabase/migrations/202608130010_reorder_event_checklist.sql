-- Fase 3: reordenacao do checklist operacional.
create function public.move_contracted_event_checklist_item(
  p_item_id uuid,
  p_direction text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_item public.contracted_event_checklist%rowtype;
  neighbor_item public.contracted_event_checklist%rowtype;
begin
  if not public.can_manage_contracted_events() then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  if p_direction not in ('up', 'down') then
    raise exception 'invalid direction' using errcode = '22023';
  end if;

  select *
  into current_item
  from public.contracted_event_checklist
  where id = p_item_id;

  if current_item.id is null then
    raise exception 'checklist item not found' using errcode = 'P0002';
  end if;

  if p_direction = 'up' then
    select *
    into neighbor_item
    from public.contracted_event_checklist
    where event_id = current_item.event_id
      and (
        sort_order < current_item.sort_order
        or (sort_order = current_item.sort_order and created_at < current_item.created_at)
      )
    order by sort_order desc, created_at desc
    limit 1;
  else
    select *
    into neighbor_item
    from public.contracted_event_checklist
    where event_id = current_item.event_id
      and (
        sort_order > current_item.sort_order
        or (sort_order = current_item.sort_order and created_at > current_item.created_at)
      )
    order by sort_order asc, created_at asc
    limit 1;
  end if;

  if neighbor_item.id is null then
    return current_item.event_id;
  end if;

  update public.contracted_event_checklist
  set sort_order = neighbor_item.sort_order
  where id = current_item.id;

  update public.contracted_event_checklist
  set sort_order = current_item.sort_order
  where id = neighbor_item.id;

  insert into public.contracted_event_history (event_id, actor_id, action, metadata)
  values (
    current_item.event_id,
    auth.uid(),
    'Ordem do checklist alterada',
    jsonb_build_object('item_id', current_item.id, 'direction', p_direction, 'title', current_item.title)
  );

  return current_item.event_id;
end;
$$;

grant execute on function public.move_contracted_event_checklist_item(uuid, text) to authenticated;
