-- A agenda é uma projeção dos registros comerciais: não cria reservas nem altera
-- disponibilidade, contratos, pagamentos ou o status operacional do evento.

create index if not exists quotes_negotiation_date_idx
  on public.quotes (desired_date, status)
  where desired_date is not null;

create or replace function public.get_agenda_visibility_items(
  p_start_date date,
  p_end_date date
) returns table (
  id uuid,
  source text,
  lead_id uuid,
  event_date date,
  desired_start_time time,
  desired_duration_minutes integer,
  client_name text,
  company text,
  title text,
  event_type text,
  guest_count integer,
  responsible_name text,
  next_action text,
  next_action_at date,
  proposal_created_at timestamptz,
  visual_state text
)
language sql
stable
security definer
set search_path = public
as $$
  select q.id, 'quote'::text, q.lead_id, q.desired_date, q.desired_start_time, q.desired_duration_minutes,
    l.name, l.company, q.title, q.event_type, q.guest_count, responsible.display_name,
    l.next_action, l.next_action_at, q.created_at, 'negotiation'::text
  from public.quotes q
  join public.leads l on l.id = q.lead_id
  left join public.profiles responsible on responsible.id = l.responsible_id
  where public.is_active_user()
    and q.status = 'em_negociacao'
    and q.desired_date between p_start_date and p_end_date

  union all

  select e.id, 'event'::text, e.lead_id, e.event_date, q.desired_start_time, q.desired_duration_minutes,
    l.name, l.company, e.title, e.event_type, e.guest_count, responsible.display_name,
    l.next_action, l.next_action_at, q.created_at,
    case when c.status = 'assinado' and exists (
      select 1 from public.contracted_event_payments payment
      where payment.event_id = e.id and payment.kind = 'sinal' and payment.status = 'pago'
    ) then 'confirmed' else 'formalizing' end
  from public.contracted_events e
  join public.quotes q on q.id = e.quote_id
  join public.leads l on l.id = e.lead_id
  left join public.profiles responsible on responsible.id = l.responsible_id
  left join public.contracted_event_contracts c on c.event_id = e.id
  where public.is_active_user()
    and e.status <> 'cancelado'
    and e.event_date between p_start_date and p_end_date;
$$;

grant execute on function public.get_agenda_visibility_items(date, date) to authenticated;

create or replace function public.get_quote_negotiation_conflicts(
  p_quote_id uuid
) returns table (id uuid, source text, title text, client_name text, visual_state text)
language sql
stable
security definer
set search_path = public
as $$
  select item.id, item.source, item.title, item.client_name, item.visual_state
  from public.quotes current_quote
  cross join lateral public.get_agenda_visibility_items(current_quote.desired_date, current_quote.desired_date) item
  where public.can_manage_quotes()
    and current_quote.id = p_quote_id
    and current_quote.desired_date is not null
    and item.visual_state = 'confirmed'
    and not (item.source = 'event' and item.id = p_quote_id);
$$;

grant execute on function public.get_quote_negotiation_conflicts(uuid) to authenticated;

create or replace function public.get_quote_pre_reservation_conflicts(
  p_quote_id uuid
) returns table (id uuid, title text, client_name text)
language sql
stable
security definer
set search_path = public
as $$
  select item.id, item.title, item.client_name
  from public.quotes current_quote
  cross join lateral public.get_agenda_visibility_items(current_quote.desired_date, current_quote.desired_date) item
  where public.can_manage_quotes()
    and current_quote.id = p_quote_id
    and current_quote.desired_date is not null
    and item.visual_state = 'negotiation'
    and item.id <> p_quote_id;
$$;

grant execute on function public.get_quote_pre_reservation_conflicts(uuid) to authenticated;

create or replace function public.record_quote_agenda_visibility_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_visible boolean := old.status = 'em_negociacao' and old.desired_date is not null;
  new_visible boolean := new.status = 'em_negociacao' and new.desired_date is not null;
begin
  if not old_visible and new_visible then
    insert into public.quote_history (quote_id, actor_id, action, metadata)
    values (new.id, auth.uid(), 'Pré-reserva criada na agenda', jsonb_build_object('event_date', new.desired_date));
    if exists (
      select 1
      from public.contracted_events e
      join public.contracted_event_contracts c on c.event_id = e.id and c.status = 'assinado'
      join public.contracted_event_payments payment on payment.event_id = e.id and payment.kind = 'sinal' and payment.status = 'pago'
      where e.event_date = new.desired_date and e.status <> 'cancelado'
    ) then
      insert into public.quote_history (quote_id, actor_id, action, metadata)
      values (new.id, auth.uid(), 'Conflito informativo detectado na agenda', jsonb_build_object('event_date', new.desired_date, 'kind', 'confirmed_event'));
    end if;
  elsif old_visible and not new_visible then
    insert into public.quote_history (quote_id, actor_id, action, metadata)
    values (new.id, auth.uid(), 'Pré-reserva removida da agenda', jsonb_build_object('event_date', old.desired_date, 'status', new.status));
  elsif new_visible and (old.desired_date is distinct from new.desired_date or old.desired_start_time is distinct from new.desired_start_time or old.desired_duration_minutes is distinct from new.desired_duration_minutes) then
    insert into public.quote_history (quote_id, actor_id, action, metadata)
    values (new.id, auth.uid(), 'Pré-reserva atualizada na agenda', jsonb_build_object('previous_event_date', old.desired_date, 'event_date', new.desired_date));
  end if;
  return new;
end;
$$;

drop trigger if exists quotes_record_agenda_visibility on public.quotes;
create trigger quotes_record_agenda_visibility
after update of status, desired_date, desired_start_time, desired_duration_minutes on public.quotes
for each row execute function public.record_quote_agenda_visibility_history();

create or replace function public.record_event_agenda_confirmation_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_event_id uuid := case when tg_op = 'DELETE' then old.event_id else new.event_id end;
  is_confirmed boolean;
  previous_state boolean := false;
begin
  select exists (
    select 1
    from public.contracted_event_contracts c
    where c.event_id = target_event_id and c.status = 'assinado'
  ) and exists (
    select 1
    from public.contracted_event_payments payment
    where payment.event_id = target_event_id and payment.kind = 'sinal' and payment.status = 'pago'
  ) into is_confirmed;

  select coalesce((metadata ->> 'confirmed')::boolean, false)
  into previous_state
  from public.contracted_event_history
  where event_id = target_event_id and action = 'Estado da agenda atualizado'
  order by created_at desc
  limit 1;

  if is_confirmed is distinct from previous_state then
    insert into public.contracted_event_history (event_id, actor_id, action, metadata)
    values (target_event_id, auth.uid(), 'Estado da agenda atualizado', jsonb_build_object('confirmed', is_confirmed));
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists contracted_event_contracts_record_agenda_confirmation on public.contracted_event_contracts;
create trigger contracted_event_contracts_record_agenda_confirmation
after insert or update or delete on public.contracted_event_contracts
for each row execute function public.record_event_agenda_confirmation_history();

drop trigger if exists contracted_event_payments_record_agenda_confirmation on public.contracted_event_payments;
create trigger contracted_event_payments_record_agenda_confirmation
after insert or update or delete on public.contracted_event_payments
for each row execute function public.record_event_agenda_confirmation_history();

create or replace function public.update_quote_status(
  p_quote_id uuid,
  p_status public.quote_status,
  p_reason text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare quote_row public.quotes%rowtype; old_status public.quote_status;
begin
  if not public.can_manage_quotes() then raise exception 'permission denied' using errcode = '42501'; end if;
  select * into quote_row from public.quotes where id = p_quote_id;
  if quote_row.id is null then raise exception 'quote not found' using errcode = 'P0002'; end if;
  old_status := quote_row.status;
  update public.quotes set status = p_status where id = p_quote_id;
  if old_status is distinct from p_status then
    insert into public.quote_history (quote_id, actor_id, action, metadata)
    values (p_quote_id, auth.uid(), 'Status do orçamento alterado', jsonb_build_object('from', old_status, 'to', p_status));
    if p_status = 'enviado' then
      update public.leads set status = 'proposta_enviada' where id = quote_row.lead_id;
      insert into public.lead_history (lead_id, actor_id, action, metadata) values (quote_row.lead_id, auth.uid(), 'Proposta enviada', jsonb_build_object('quote_id', p_quote_id));
    elsif p_status = 'aprovado' then
      update public.leads set status = 'ganho' where id = quote_row.lead_id;
      insert into public.lead_history (lead_id, actor_id, action, metadata) values (quote_row.lead_id, auth.uid(), 'Orçamento aprovado', jsonb_build_object('quote_id', p_quote_id));
    elsif p_status in ('recusado', 'cancelado') then
      update public.leads set status = 'perdido' where id = quote_row.lead_id;
      insert into public.lead_history (lead_id, actor_id, action, metadata) values (quote_row.lead_id, auth.uid(), 'Negociação encerrada', jsonb_build_object('quote_id', p_quote_id, 'status', p_status));
    end if;
  end if;
end;
$$;

grant execute on function public.update_quote_status(uuid, public.quote_status, text) to authenticated;
