-- Fase 2: orçamentos.
create type public.quote_status as enum ('rascunho', 'em_elaboracao', 'enviado', 'aprovado', 'recusado', 'expirado');

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 160),
  status public.quote_status not null default 'rascunho',
  event_type text,
  desired_date date,
  guest_count integer check (guest_count is null or guest_count > 0),
  notes text check (notes is null or char_length(notes) <= 4000),
  total_amount_cents integer not null default 0 check (total_amount_cents >= 0),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  description text not null check (char_length(description) between 2 and 300),
  quantity numeric(10,2) not null default 1 check (quantity > 0),
  unit_price_cents integer not null default 0 check (unit_price_cents >= 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.quote_history (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index quotes_lead_created_at_idx on public.quotes (lead_id, created_at desc);
create index quotes_status_created_at_idx on public.quotes (status, created_at desc);
create index quote_items_quote_sort_idx on public.quote_items (quote_id, sort_order, created_at);
create index quote_history_quote_created_idx on public.quote_history (quote_id, created_at desc);

alter table public.quotes enable row level security;
alter table public.quote_items enable row level security;
alter table public.quote_history enable row level security;

create function public.can_manage_quotes() returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_permission('atendimento') or public.has_permission('financeiro');
$$;

grant execute on function public.can_manage_quotes() to authenticated;

create policy "active users read quotes" on public.quotes
  for select to authenticated using (public.is_active_user());
create policy "quote managers create quotes" on public.quotes
  for insert to authenticated with check (public.can_manage_quotes() and created_by = auth.uid());
create policy "quote managers update quotes" on public.quotes
  for update to authenticated using (public.can_manage_quotes()) with check (public.can_manage_quotes());

create policy "active users read quote items" on public.quote_items
  for select to authenticated using (public.is_active_user());
create policy "quote managers create quote items" on public.quote_items
  for insert to authenticated with check (public.can_manage_quotes() and exists (select 1 from public.quotes q where q.id = quote_id));
create policy "quote managers update quote items" on public.quote_items
  for update to authenticated using (public.can_manage_quotes()) with check (public.can_manage_quotes());

create policy "active users read quote history" on public.quote_history
  for select to authenticated using (public.is_active_user());

create trigger quotes_touch_updated_at before update on public.quotes for each row execute function public.touch_updated_at();

create function public.recalculate_quote_total(p_quote_id uuid) returns void
language sql
security definer
set search_path = public
as $$
  update public.quotes
  set total_amount_cents = coalesce((
    select sum(round(quantity * unit_price_cents)::integer)
    from public.quote_items
    where quote_id = p_quote_id
  ), 0)
  where id = p_quote_id;
$$;

create function public.create_quote_from_lead(p_lead_id uuid) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  lead_row public.leads%rowtype;
  new_quote_id uuid;
begin
  if not public.can_manage_quotes() then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  select * into lead_row from public.leads where id = p_lead_id;
  if lead_row.id is null then
    raise exception 'lead not found' using errcode = 'P0002';
  end if;

  insert into public.quotes (
    lead_id,
    title,
    status,
    event_type,
    desired_date,
    guest_count,
    notes,
    created_by
  ) values (
    lead_row.id,
    'Orçamento - ' || lead_row.name,
    'em_elaboracao',
    lead_row.event_type,
    lead_row.desired_date,
    lead_row.guest_count,
    lead_row.notes,
    auth.uid()
  )
  returning id into new_quote_id;

  insert into public.quote_history (quote_id, actor_id, action, metadata)
  values (new_quote_id, auth.uid(), 'Orçamento criado', jsonb_build_object('lead_id', p_lead_id));

  insert into public.lead_history (lead_id, actor_id, action, metadata)
  values (p_lead_id, auth.uid(), 'Orçamento criado', jsonb_build_object('quote_id', new_quote_id));

  if lead_row.status in ('novo', 'em_atendimento', 'qualificado') then
    update public.leads set status = 'orcamento_em_elaboracao' where id = p_lead_id;
  end if;

  return new_quote_id;
end;
$$;

create function public.add_quote_item(
  p_quote_id uuid,
  p_description text,
  p_quantity numeric,
  p_unit_price_cents integer
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_item_id uuid;
begin
  if not public.can_manage_quotes() then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  if not exists (select 1 from public.quotes where id = p_quote_id) then
    raise exception 'quote not found' using errcode = 'P0002';
  end if;

  insert into public.quote_items (quote_id, description, quantity, unit_price_cents)
  values (p_quote_id, p_description, p_quantity, p_unit_price_cents)
  returning id into new_item_id;

  perform public.recalculate_quote_total(p_quote_id);

  insert into public.quote_history (quote_id, actor_id, action, metadata)
  values (p_quote_id, auth.uid(), 'Item adicionado', jsonb_build_object('item_id', new_item_id, 'description', p_description));

  return new_item_id;
end;
$$;

create function public.update_quote_status(
  p_quote_id uuid,
  p_status public.quote_status
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  quote_row public.quotes%rowtype;
  old_status public.quote_status;
begin
  if not public.can_manage_quotes() then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  select * into quote_row from public.quotes where id = p_quote_id;
  if quote_row.id is null then
    raise exception 'quote not found' using errcode = 'P0002';
  end if;

  old_status := quote_row.status;
  update public.quotes set status = p_status where id = p_quote_id;

  if old_status is distinct from p_status then
    insert into public.quote_history (quote_id, actor_id, action, metadata)
    values (p_quote_id, auth.uid(), 'Status do orçamento alterado', jsonb_build_object('from', old_status, 'to', p_status));

    if p_status = 'enviado' then
      update public.leads set status = 'proposta_enviada' where id = quote_row.lead_id;
      insert into public.lead_history (lead_id, actor_id, action, metadata)
      values (quote_row.lead_id, auth.uid(), 'Proposta enviada', jsonb_build_object('quote_id', p_quote_id));
    elsif p_status = 'aprovado' then
      update public.leads set status = 'ganho' where id = quote_row.lead_id;
      insert into public.lead_history (lead_id, actor_id, action, metadata)
      values (quote_row.lead_id, auth.uid(), 'Orçamento aprovado', jsonb_build_object('quote_id', p_quote_id));
    elsif p_status = 'recusado' then
      update public.leads set status = 'perdido' where id = quote_row.lead_id;
      insert into public.lead_history (lead_id, actor_id, action, metadata)
      values (quote_row.lead_id, auth.uid(), 'Orçamento recusado', jsonb_build_object('quote_id', p_quote_id));
    end if;
  end if;
end;
$$;

grant execute on function public.recalculate_quote_total(uuid) to authenticated;
grant execute on function public.create_quote_from_lead(uuid) to authenticated;
grant execute on function public.add_quote_item(uuid, text, numeric, integer) to authenticated;
grant execute on function public.update_quote_status(uuid, public.quote_status) to authenticated;
