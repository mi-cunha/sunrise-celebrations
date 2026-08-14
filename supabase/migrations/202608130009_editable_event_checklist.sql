-- Fase 3: checklist operacional editável.
alter table public.contracted_event_checklist
  add column if not exists assigned_to uuid references public.profiles(id) on delete set null,
  add column if not exists due_date date,
  add column if not exists notes text check (notes is null or char_length(notes) <= 1200),
  add column if not exists updated_at timestamptz not null default now();

create trigger contracted_event_checklist_touch_updated_at
  before update on public.contracted_event_checklist
  for each row execute function public.touch_updated_at();

create function public.add_contracted_event_checklist_item(
  p_event_id uuid,
  p_title text,
  p_assigned_to uuid default null,
  p_due_date date default null,
  p_notes text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_item_id uuid;
  next_sort_order integer;
  normalized_title text;
  normalized_notes text;
begin
  if not public.can_manage_contracted_events() then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  if not exists (select 1 from public.contracted_events where id = p_event_id) then
    raise exception 'event not found' using errcode = 'P0002';
  end if;

  normalized_title := trim(p_title);
  normalized_notes := nullif(trim(coalesce(p_notes, '')), '');

  if char_length(normalized_title) < 2 then
    raise exception 'checklist title is too short' using errcode = '22023';
  end if;

  select coalesce(max(sort_order), 0) + 10
  into next_sort_order
  from public.contracted_event_checklist
  where event_id = p_event_id;

  insert into public.contracted_event_checklist (event_id, title, assigned_to, due_date, notes, sort_order)
  values (p_event_id, normalized_title, p_assigned_to, p_due_date, normalized_notes, next_sort_order)
  returning id into new_item_id;

  insert into public.contracted_event_history (event_id, actor_id, action, metadata)
  values (p_event_id, auth.uid(), 'Tarefa do checklist adicionada', jsonb_build_object('item_id', new_item_id, 'title', normalized_title));

  return new_item_id;
end;
$$;

create function public.update_contracted_event_checklist_item(
  p_item_id uuid,
  p_title text,
  p_assigned_to uuid default null,
  p_due_date date default null,
  p_notes text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_event_id uuid;
  normalized_title text;
  normalized_notes text;
begin
  if not public.can_manage_contracted_events() then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  select event_id
  into target_event_id
  from public.contracted_event_checklist
  where id = p_item_id;

  if target_event_id is null then
    raise exception 'checklist item not found' using errcode = 'P0002';
  end if;

  normalized_title := trim(p_title);
  normalized_notes := nullif(trim(coalesce(p_notes, '')), '');

  if char_length(normalized_title) < 2 then
    raise exception 'checklist title is too short' using errcode = '22023';
  end if;

  update public.contracted_event_checklist
  set
    title = normalized_title,
    assigned_to = p_assigned_to,
    due_date = p_due_date,
    notes = normalized_notes
  where id = p_item_id;

  insert into public.contracted_event_history (event_id, actor_id, action, metadata)
  values (target_event_id, auth.uid(), 'Tarefa do checklist atualizada', jsonb_build_object('item_id', p_item_id, 'title', normalized_title));

  return target_event_id;
end;
$$;

create function public.remove_contracted_event_checklist_item(p_item_id uuid) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_event_id uuid;
  removed_title text;
begin
  if not public.can_manage_contracted_events() then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  select event_id, title
  into target_event_id, removed_title
  from public.contracted_event_checklist
  where id = p_item_id;

  if target_event_id is null then
    raise exception 'checklist item not found' using errcode = 'P0002';
  end if;

  delete from public.contracted_event_checklist
  where id = p_item_id;

  insert into public.contracted_event_history (event_id, actor_id, action, metadata)
  values (target_event_id, auth.uid(), 'Tarefa do checklist removida', jsonb_build_object('item_id', p_item_id, 'title', removed_title));

  return target_event_id;
end;
$$;

grant execute on function public.add_contracted_event_checklist_item(uuid, text, uuid, date, text) to authenticated;
grant execute on function public.update_contracted_event_checklist_item(uuid, text, uuid, date, text) to authenticated;
grant execute on function public.remove_contracted_event_checklist_item(uuid) to authenticated;
