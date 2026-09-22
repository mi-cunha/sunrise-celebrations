-- Completa a camada comercial sem acoplar o CRM ao transporte do WhatsApp.
-- As mensagens continuam sendo fonte de verdade em conversation_messages.

alter type public.lead_status add value if not exists 'visita_agendada' after 'qualificado';

alter table public.leads
  add column if not exists budget_range text check (budget_range is null or char_length(trim(budget_range)) between 2 and 120),
  add column if not exists lost_reason text check (lost_reason is null or char_length(trim(lost_reason)) between 2 and 500),
  add column if not exists last_contact_at timestamptz;

create index if not exists leads_status_created_idx on public.leads (status, created_at desc);
create index if not exists leads_last_contact_idx on public.leads (last_contact_at desc nulls last);

create or replace function public.touch_lead_last_contact_from_message() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.leads
  set last_contact_at = coalesce(new.external_created_at, new.created_at)
  where id = (select lead_id from public.conversations where id = new.conversation_id);
  return new;
end;
$$;

drop trigger if exists conversation_messages_touch_lead_last_contact on public.conversation_messages;
create trigger conversation_messages_touch_lead_last_contact
after insert on public.conversation_messages
for each row execute function public.touch_lead_last_contact_from_message();

-- Mantém a assinatura existente e passa a exigir motivo somente na mudança manual para perdido.
create or replace function public.update_lead_status_from_atendimento(
  p_lead_id uuid,
  p_status public.lead_status,
  p_lost_reason text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare old_status public.lead_status;
declare normalized_reason text := nullif(trim(p_lost_reason), '');
begin
  if not public.has_permission('atendimento') then raise exception 'permission denied' using errcode = '42501'; end if;
  select status into old_status from public.leads where id = p_lead_id for update;
  if old_status is null then raise exception 'lead not found' using errcode = 'P0002'; end if;
  if p_status = 'perdido' and old_status is distinct from 'perdido' and (normalized_reason is null or char_length(normalized_reason) not between 2 and 500) then
    raise exception 'lost reason is required' using errcode = '22023';
  end if;
  update public.leads
  set status = p_status,
      lost_reason = case when p_status = 'perdido' then coalesce(normalized_reason, lost_reason) else null end
  where id = p_lead_id;
  if old_status is distinct from p_status then
    insert into public.lead_history (lead_id, actor_id, action, metadata)
    values (p_lead_id, auth.uid(), 'Status comercial alterado', jsonb_build_object('from', old_status, 'to', p_status, 'lost_reason', case when p_status = 'perdido' then normalized_reason else null end));
  end if;
end;
$$;

create or replace function public.update_lead_crm_details(
  p_lead_id uuid, p_name text, p_company text, p_phone text, p_source text,
  p_event_type text, p_desired_date date, p_guest_count integer, p_budget_range text,
  p_notes text, p_responsible_id uuid
) returns void
language plpgsql security definer set search_path = public as $$
declare normalized_budget text := nullif(trim(p_budget_range), '');
declare previous_responsible uuid;
begin
  if not public.has_permission('atendimento') then raise exception 'permission denied' using errcode = '42501'; end if;
  if normalized_budget is not null and char_length(normalized_budget) not between 2 and 120 then raise exception 'invalid budget range' using errcode = '22023'; end if;
  if p_responsible_id is not null and not exists (select 1 from public.profiles where id = p_responsible_id and is_active) then raise exception 'responsible is not active' using errcode = '22023'; end if;
  select responsible_id into previous_responsible from public.leads where id = p_lead_id for update;
  if not found then raise exception 'lead not found' using errcode = 'P0002'; end if;
  update public.leads set name = p_name, company = p_company, phone = p_phone, source = p_source,
    event_type = p_event_type, desired_date = p_desired_date, guest_count = p_guest_count,
    budget_range = normalized_budget, notes = p_notes, responsible_id = p_responsible_id
  where id = p_lead_id;
  insert into public.lead_history (lead_id, actor_id, action, metadata)
  values (p_lead_id, auth.uid(), 'Dados comerciais atualizados', jsonb_build_object('budget_range', normalized_budget, 'responsible_id', p_responsible_id, 'previous_responsible_id', previous_responsible));
end;
$$;

create or replace function public.get_lead_timeline(p_lead_id uuid)
returns table (id text, entry_type text, title text, body text, author_name text, occurred_at timestamptz, metadata jsonb)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.has_permission('atendimento') or public.has_permission('gerencia')) then raise exception 'permission denied' using errcode = '42501'; end if;
  if not exists (select 1 from public.leads where id = p_lead_id) then raise exception 'lead not found' using errcode = 'P0002'; end if;
  return query
  select 'history-' || history.id::text, 'history', history.action, null::text, profile.display_name, history.created_at, history.metadata
  from public.lead_history history left join public.profiles profile on profile.id = history.actor_id where history.lead_id = p_lead_id
  union all
  select 'message-' || message.id::text, 'message', case message.author when 'cliente' then 'Mensagem do cliente' when 'ia' then 'Mensagem da IA' when 'humano' then 'Mensagem da equipe' else 'Mensagem do sistema' end,
    message.body, profile.display_name, coalesce(message.external_created_at, message.created_at), jsonb_build_object('author', message.author, 'conversation_id', conversation.id)
  from public.conversation_messages message join public.conversations conversation on conversation.id = message.conversation_id
  left join public.profiles profile on profile.id = message.actor_id where conversation.lead_id = p_lead_id;
end;
$$;

grant execute on function public.update_lead_status_from_atendimento(uuid, public.lead_status, text) to authenticated;
grant execute on function public.update_lead_crm_details(uuid, text, text, text, text, text, date, integer, text, text, uuid) to authenticated;
grant execute on function public.get_lead_timeline(uuid) to authenticated;
