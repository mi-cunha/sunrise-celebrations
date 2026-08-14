-- Fase 3: eventos contratados e operação inicial.
create type public.contracted_event_status as enum ('planejamento', 'confirmado', 'em_execucao', 'realizado', 'cancelado');

create table public.contracted_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete restrict,
  quote_id uuid not null unique references public.quotes(id) on delete restrict,
  title text not null check (char_length(title) between 2 and 160),
  status public.contracted_event_status not null default 'planejamento',
  event_type text,
  event_date date,
  guest_count integer check (guest_count is null or guest_count > 0),
  notes text check (notes is null or char_length(notes) <= 4000),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.contracted_event_checklist (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.contracted_events(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 160),
  is_done boolean not null default false,
  sort_order integer not null default 100,
  completed_at timestamptz,
  completed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.contracted_event_history (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.contracted_events(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index contracted_events_status_date_idx on public.contracted_events (status, event_date);
create index contracted_events_lead_created_idx on public.contracted_events (lead_id, created_at desc);
create index contracted_event_checklist_event_sort_idx on public.contracted_event_checklist (event_id, sort_order, created_at);
create index contracted_event_history_event_created_idx on public.contracted_event_history (event_id, created_at desc);

alter table public.contracted_events enable row level security;
alter table public.contracted_event_checklist enable row level security;
alter table public.contracted_event_history enable row level security;

create function public.can_manage_contracted_events() returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_permission('atendimento') or public.has_permission('gerencia') or public.has_permission('admin_owner');
$$;

grant execute on function public.can_manage_contracted_events() to authenticated;

create policy "active users read contracted events" on public.contracted_events
  for select to authenticated using (public.is_active_user());
create policy "event managers create contracted events" on public.contracted_events
  for insert to authenticated with check (public.can_manage_contracted_events() and created_by = auth.uid());
create policy "event managers update contracted events" on public.contracted_events
  for update to authenticated using (public.can_manage_contracted_events()) with check (public.can_manage_contracted_events());

create policy "active users read contracted event checklist" on public.contracted_event_checklist
  for select to authenticated using (public.is_active_user());
create policy "event managers update contracted event checklist" on public.contracted_event_checklist
  for update to authenticated using (public.can_manage_contracted_events()) with check (public.can_manage_contracted_events());

create policy "active users read contracted event history" on public.contracted_event_history
  for select to authenticated using (public.is_active_user());

create trigger contracted_events_touch_updated_at before update on public.contracted_events for each row execute function public.touch_updated_at();

create function public.create_contracted_event_from_quote(p_quote_id uuid) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  quote_row public.quotes%rowtype;
  lead_row public.leads%rowtype;
  existing_event_id uuid;
  new_event_id uuid;
begin
  if not public.can_manage_contracted_events() then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  select id into existing_event_id
  from public.contracted_events
  where quote_id = p_quote_id;

  if existing_event_id is not null then
    return existing_event_id;
  end if;

  select * into quote_row
  from public.quotes
  where id = p_quote_id;

  if quote_row.id is null then
    raise exception 'quote not found' using errcode = 'P0002';
  end if;

  if quote_row.status <> 'aprovado' then
    raise exception 'only approved quotes can become contracted events' using errcode = '22023';
  end if;

  select * into lead_row
  from public.leads
  where id = quote_row.lead_id;

  insert into public.contracted_events (
    lead_id,
    quote_id,
    title,
    status,
    event_type,
    event_date,
    guest_count,
    notes,
    created_by
  ) values (
    quote_row.lead_id,
    quote_row.id,
    'Evento - ' || coalesce(lead_row.name, quote_row.title),
    'planejamento',
    quote_row.event_type,
    quote_row.desired_date,
    quote_row.guest_count,
    quote_row.notes,
    auth.uid()
  )
  returning id into new_event_id;

  insert into public.contracted_event_checklist (event_id, title, sort_order)
  values
    (new_event_id, 'Contrato conferido', 10),
    (new_event_id, 'Pagamento e condições alinhados', 20),
    (new_event_id, 'Equipe operacional definida', 30),
    (new_event_id, 'Fornecedores confirmados', 40),
    (new_event_id, 'Cronograma do evento definido', 50),
    (new_event_id, 'Checklist final do evento', 60);

  insert into public.contracted_event_history (event_id, actor_id, action, metadata)
  values (new_event_id, auth.uid(), 'Evento contratado criado', jsonb_build_object('quote_id', p_quote_id, 'lead_id', quote_row.lead_id));

  insert into public.quote_history (quote_id, actor_id, action, metadata)
  values (p_quote_id, auth.uid(), 'Evento contratado criado', jsonb_build_object('event_id', new_event_id));

  insert into public.lead_history (lead_id, actor_id, action, metadata)
  values (quote_row.lead_id, auth.uid(), 'Evento contratado criado', jsonb_build_object('event_id', new_event_id, 'quote_id', p_quote_id));

  return new_event_id;
end;
$$;

create function public.update_contracted_event_status(
  p_event_id uuid,
  p_status public.contracted_event_status
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  old_status public.contracted_event_status;
begin
  if not public.can_manage_contracted_events() then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  select status into old_status
  from public.contracted_events
  where id = p_event_id;

  if old_status is null then
    raise exception 'event not found' using errcode = 'P0002';
  end if;

  update public.contracted_events
  set status = p_status
  where id = p_event_id;

  if old_status is distinct from p_status then
    insert into public.contracted_event_history (event_id, actor_id, action, metadata)
    values (p_event_id, auth.uid(), 'Status do evento alterado', jsonb_build_object('from', old_status, 'to', p_status));
  end if;
end;
$$;

create function public.toggle_contracted_event_checklist_item(
  p_item_id uuid,
  p_is_done boolean
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_event_id uuid;
  item_title text;
begin
  if not public.can_manage_contracted_events() then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  select event_id, title
  into target_event_id, item_title
  from public.contracted_event_checklist
  where id = p_item_id;

  if target_event_id is null then
    raise exception 'checklist item not found' using errcode = 'P0002';
  end if;

  update public.contracted_event_checklist
  set
    is_done = p_is_done,
    completed_at = case when p_is_done then now() else null end,
    completed_by = case when p_is_done then auth.uid() else null end
  where id = p_item_id;

  insert into public.contracted_event_history (event_id, actor_id, action, metadata)
  values (
    target_event_id,
    auth.uid(),
    case when p_is_done then 'Checklist concluído' else 'Checklist reaberto' end,
    jsonb_build_object('item_id', p_item_id, 'title', item_title)
  );

  return target_event_id;
end;
$$;

grant execute on function public.create_contracted_event_from_quote(uuid) to authenticated;
grant execute on function public.update_contracted_event_status(uuid, public.contracted_event_status) to authenticated;
grant execute on function public.toggle_contracted_event_checklist_item(uuid, boolean) to authenticated;
