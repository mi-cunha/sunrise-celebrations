-- Fase 3: cronograma operacional do evento.
create table public.contracted_event_timeline (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.contracted_events(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 160),
  start_time time,
  end_time time,
  location text check (location is null or char_length(location) <= 160),
  assigned_to uuid references public.profiles(id) on delete set null,
  notes text check (notes is null or char_length(notes) <= 1200),
  sort_order integer not null default 100,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time is null or start_time is null or end_time >= start_time)
);

create index contracted_event_timeline_event_sort_idx on public.contracted_event_timeline (event_id, sort_order, start_time, created_at);

alter table public.contracted_event_timeline enable row level security;

create policy "active users read contracted event timeline" on public.contracted_event_timeline
  for select to authenticated using (public.is_active_user());
create policy "event managers create contracted event timeline" on public.contracted_event_timeline
  for insert to authenticated with check (public.can_manage_contracted_events() and created_by = auth.uid());
create policy "event managers update contracted event timeline" on public.contracted_event_timeline
  for update to authenticated using (public.can_manage_contracted_events()) with check (public.can_manage_contracted_events());
create policy "event managers delete contracted event timeline" on public.contracted_event_timeline
  for delete to authenticated using (public.can_manage_contracted_events());

create trigger contracted_event_timeline_touch_updated_at
  before update on public.contracted_event_timeline
  for each row execute function public.touch_updated_at();

create function public.add_contracted_event_timeline_entry(
  p_event_id uuid,
  p_title text,
  p_start_time time default null,
  p_end_time time default null,
  p_location text default null,
  p_assigned_to uuid default null,
  p_notes text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_entry_id uuid;
  next_sort_order integer;
  normalized_title text;
  normalized_location text;
  normalized_notes text;
begin
  if not public.can_manage_contracted_events() then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  if not exists (select 1 from public.contracted_events where id = p_event_id) then
    raise exception 'event not found' using errcode = 'P0002';
  end if;

  if p_end_time is not null and p_start_time is not null and p_end_time < p_start_time then
    raise exception 'end time must be after start time' using errcode = '22023';
  end if;

  normalized_title := trim(p_title);
  normalized_location := nullif(trim(coalesce(p_location, '')), '');
  normalized_notes := nullif(trim(coalesce(p_notes, '')), '');

  if char_length(normalized_title) < 2 then
    raise exception 'timeline title is too short' using errcode = '22023';
  end if;

  select coalesce(max(sort_order), 0) + 10
  into next_sort_order
  from public.contracted_event_timeline
  where event_id = p_event_id;

  insert into public.contracted_event_timeline (
    event_id,
    title,
    start_time,
    end_time,
    location,
    assigned_to,
    notes,
    sort_order,
    created_by
  ) values (
    p_event_id,
    normalized_title,
    p_start_time,
    p_end_time,
    normalized_location,
    p_assigned_to,
    normalized_notes,
    next_sort_order,
    auth.uid()
  )
  returning id into new_entry_id;

  insert into public.contracted_event_history (event_id, actor_id, action, metadata)
  values (p_event_id, auth.uid(), 'Cronograma adicionado', jsonb_build_object('entry_id', new_entry_id, 'title', normalized_title));

  return new_entry_id;
end;
$$;

create function public.update_contracted_event_timeline_entry(
  p_entry_id uuid,
  p_title text,
  p_start_time time default null,
  p_end_time time default null,
  p_location text default null,
  p_assigned_to uuid default null,
  p_notes text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_event_id uuid;
  normalized_title text;
  normalized_location text;
  normalized_notes text;
begin
  if not public.can_manage_contracted_events() then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  select event_id
  into target_event_id
  from public.contracted_event_timeline
  where id = p_entry_id;

  if target_event_id is null then
    raise exception 'timeline entry not found' using errcode = 'P0002';
  end if;

  if p_end_time is not null and p_start_time is not null and p_end_time < p_start_time then
    raise exception 'end time must be after start time' using errcode = '22023';
  end if;

  normalized_title := trim(p_title);
  normalized_location := nullif(trim(coalesce(p_location, '')), '');
  normalized_notes := nullif(trim(coalesce(p_notes, '')), '');

  if char_length(normalized_title) < 2 then
    raise exception 'timeline title is too short' using errcode = '22023';
  end if;

  update public.contracted_event_timeline
  set
    title = normalized_title,
    start_time = p_start_time,
    end_time = p_end_time,
    location = normalized_location,
    assigned_to = p_assigned_to,
    notes = normalized_notes
  where id = p_entry_id;

  insert into public.contracted_event_history (event_id, actor_id, action, metadata)
  values (target_event_id, auth.uid(), 'Cronograma atualizado', jsonb_build_object('entry_id', p_entry_id, 'title', normalized_title));

  return target_event_id;
end;
$$;

create function public.remove_contracted_event_timeline_entry(p_entry_id uuid) returns uuid
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
  from public.contracted_event_timeline
  where id = p_entry_id;

  if target_event_id is null then
    raise exception 'timeline entry not found' using errcode = 'P0002';
  end if;

  delete from public.contracted_event_timeline
  where id = p_entry_id;

  insert into public.contracted_event_history (event_id, actor_id, action, metadata)
  values (target_event_id, auth.uid(), 'Cronograma removido', jsonb_build_object('entry_id', p_entry_id, 'title', removed_title));

  return target_event_id;
end;
$$;

grant execute on function public.add_contracted_event_timeline_entry(uuid, text, time, time, text, uuid, text) to authenticated;
grant execute on function public.update_contracted_event_timeline_entry(uuid, text, time, time, text, uuid, text) to authenticated;
grant execute on function public.remove_contracted_event_timeline_entry(uuid) to authenticated;
