-- Fase 3: contrato e pagamentos do evento.
create type public.contracted_event_contract_status as enum ('pendente', 'enviado', 'assinado', 'cancelado');
create type public.contracted_event_payment_kind as enum ('sinal', 'parcela', 'saldo', 'outro');
create type public.contracted_event_payment_status as enum ('previsto', 'pago', 'atrasado', 'cancelado');

create table public.contracted_event_contracts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique references public.contracted_events(id) on delete cascade,
  status public.contracted_event_contract_status not null default 'pendente',
  signed_at date,
  notes text check (notes is null or char_length(notes) <= 1200),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.contracted_event_payments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.contracted_events(id) on delete cascade,
  kind public.contracted_event_payment_kind not null default 'parcela',
  status public.contracted_event_payment_status not null default 'previsto',
  amount_cents integer not null check (amount_cents > 0),
  due_date date,
  paid_at date,
  payment_method text check (payment_method is null or char_length(payment_method) <= 80),
  notes text check (notes is null or char_length(notes) <= 1200),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index contracted_event_payments_event_due_idx on public.contracted_event_payments (event_id, due_date, status);

alter table public.contracted_event_contracts enable row level security;
alter table public.contracted_event_payments enable row level security;

create function public.can_manage_event_financials() returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_permission('financeiro') or public.has_permission('gerencia') or public.has_permission('admin_owner');
$$;

grant execute on function public.can_manage_event_financials() to authenticated;

create policy "financial users read event contracts" on public.contracted_event_contracts
  for select to authenticated using (public.is_active_user() and public.can_manage_event_financials());
create policy "financial users create event contracts" on public.contracted_event_contracts
  for insert to authenticated with check (public.can_manage_event_financials() and created_by = auth.uid());
create policy "financial users update event contracts" on public.contracted_event_contracts
  for update to authenticated using (public.can_manage_event_financials()) with check (public.can_manage_event_financials());

create policy "financial users read event payments" on public.contracted_event_payments
  for select to authenticated using (public.is_active_user() and public.can_manage_event_financials());
create policy "financial users create event payments" on public.contracted_event_payments
  for insert to authenticated with check (public.can_manage_event_financials() and created_by = auth.uid());
create policy "financial users update event payments" on public.contracted_event_payments
  for update to authenticated using (public.can_manage_event_financials()) with check (public.can_manage_event_financials());
create policy "financial users delete event payments" on public.contracted_event_payments
  for delete to authenticated using (public.can_manage_event_financials());

create trigger contracted_event_contracts_touch_updated_at
  before update on public.contracted_event_contracts
  for each row execute function public.touch_updated_at();

create trigger contracted_event_payments_touch_updated_at
  before update on public.contracted_event_payments
  for each row execute function public.touch_updated_at();

create function public.set_contracted_event_contract(
  p_event_id uuid,
  p_status public.contracted_event_contract_status,
  p_signed_at date default null,
  p_notes text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  contract_id uuid;
  normalized_notes text;
begin
  if not public.can_manage_event_financials() then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  if not exists (select 1 from public.contracted_events where id = p_event_id) then
    raise exception 'event not found' using errcode = 'P0002';
  end if;

  normalized_notes := nullif(trim(coalesce(p_notes, '')), '');

  insert into public.contracted_event_contracts (event_id, status, signed_at, notes, created_by)
  values (p_event_id, p_status, p_signed_at, normalized_notes, auth.uid())
  on conflict (event_id)
  do update set
    status = excluded.status,
    signed_at = excluded.signed_at,
    notes = excluded.notes
  returning id into contract_id;

  insert into public.contracted_event_history (event_id, actor_id, action, metadata)
  values (p_event_id, auth.uid(), 'Contrato atualizado', jsonb_build_object('status', p_status, 'signed_at', p_signed_at));

  return contract_id;
end;
$$;

create function public.add_contracted_event_payment(
  p_event_id uuid,
  p_kind public.contracted_event_payment_kind,
  p_status public.contracted_event_payment_status,
  p_amount_cents integer,
  p_due_date date default null,
  p_paid_at date default null,
  p_payment_method text default null,
  p_notes text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  payment_id uuid;
begin
  if not public.can_manage_event_financials() then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  if not exists (select 1 from public.contracted_events where id = p_event_id) then
    raise exception 'event not found' using errcode = 'P0002';
  end if;

  insert into public.contracted_event_payments (
    event_id,
    kind,
    status,
    amount_cents,
    due_date,
    paid_at,
    payment_method,
    notes,
    created_by
  ) values (
    p_event_id,
    p_kind,
    p_status,
    p_amount_cents,
    p_due_date,
    p_paid_at,
    nullif(trim(coalesce(p_payment_method, '')), ''),
    nullif(trim(coalesce(p_notes, '')), ''),
    auth.uid()
  )
  returning id into payment_id;

  insert into public.contracted_event_history (event_id, actor_id, action, metadata)
  values (p_event_id, auth.uid(), 'Pagamento adicionado', jsonb_build_object('payment_id', payment_id, 'kind', p_kind, 'status', p_status, 'amount_cents', p_amount_cents));

  return payment_id;
end;
$$;

create function public.update_contracted_event_payment(
  p_payment_id uuid,
  p_kind public.contracted_event_payment_kind,
  p_status public.contracted_event_payment_status,
  p_amount_cents integer,
  p_due_date date default null,
  p_paid_at date default null,
  p_payment_method text default null,
  p_notes text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_event_id uuid;
begin
  if not public.can_manage_event_financials() then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  select event_id into target_event_id
  from public.contracted_event_payments
  where id = p_payment_id;

  if target_event_id is null then
    raise exception 'payment not found' using errcode = 'P0002';
  end if;

  update public.contracted_event_payments
  set
    kind = p_kind,
    status = p_status,
    amount_cents = p_amount_cents,
    due_date = p_due_date,
    paid_at = p_paid_at,
    payment_method = nullif(trim(coalesce(p_payment_method, '')), ''),
    notes = nullif(trim(coalesce(p_notes, '')), '')
  where id = p_payment_id;

  insert into public.contracted_event_history (event_id, actor_id, action, metadata)
  values (target_event_id, auth.uid(), 'Pagamento atualizado', jsonb_build_object('payment_id', p_payment_id, 'kind', p_kind, 'status', p_status, 'amount_cents', p_amount_cents));

  return target_event_id;
end;
$$;

create function public.remove_contracted_event_payment(p_payment_id uuid) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_event_id uuid;
  removed_amount integer;
begin
  if not public.can_manage_event_financials() then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  select event_id, amount_cents
  into target_event_id, removed_amount
  from public.contracted_event_payments
  where id = p_payment_id;

  if target_event_id is null then
    raise exception 'payment not found' using errcode = 'P0002';
  end if;

  delete from public.contracted_event_payments
  where id = p_payment_id;

  insert into public.contracted_event_history (event_id, actor_id, action, metadata)
  values (target_event_id, auth.uid(), 'Pagamento removido', jsonb_build_object('payment_id', p_payment_id, 'amount_cents', removed_amount));

  return target_event_id;
end;
$$;

grant execute on function public.set_contracted_event_contract(uuid, public.contracted_event_contract_status, date, text) to authenticated;
grant execute on function public.add_contracted_event_payment(uuid, public.contracted_event_payment_kind, public.contracted_event_payment_status, integer, date, date, text, text) to authenticated;
grant execute on function public.update_contracted_event_payment(uuid, public.contracted_event_payment_kind, public.contracted_event_payment_status, integer, date, date, text, text) to authenticated;
grant execute on function public.remove_contracted_event_payment(uuid) to authenticated;
