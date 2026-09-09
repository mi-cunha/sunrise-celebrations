-- CRM operacional: acompanhamento manual por lead.
-- Não automatiza mensagens nem depende do adaptador do WhatsApp.

alter table public.leads
  add column if not exists next_action text,
  add column if not exists next_action_at date,
  add column if not exists next_action_assignee_id uuid references public.profiles(id) on delete set null;

alter table public.leads
  drop constraint if exists leads_next_action_complete;

alter table public.leads
  add constraint leads_next_action_complete check (
    (next_action is null and next_action_at is null and next_action_assignee_id is null)
    or (
      char_length(trim(next_action)) between 2 and 240
      and next_action_at is not null
      and next_action_assignee_id is not null
    )
  );

create index if not exists leads_next_action_queue_idx
  on public.leads (next_action_at, next_action_assignee_id, updated_at desc)
  where next_action_at is not null;

create or replace function public.get_active_operational_profiles()
returns table (id uuid, display_name text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.has_permission('atendimento') then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  return query
  select profile.id, profile.display_name
  from public.profiles profile
  where profile.is_active
  order by profile.display_name, profile.id;
end;
$$;

grant execute on function public.get_active_operational_profiles() to authenticated;

create or replace function public.schedule_lead_follow_up(
  p_lead_id uuid,
  p_next_action text,
  p_next_action_at date,
  p_next_action_assignee_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_action text := nullif(trim(p_next_action), '');
  assignee_name text;
  previous_action text;
  previous_due_date date;
  previous_assignee_id uuid;
begin
  if not public.has_permission('atendimento') then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  if normalized_action is null or char_length(normalized_action) not between 2 and 240 or p_next_action_at is null or p_next_action_assignee_id is null then
    raise exception 'invalid follow up' using errcode = '22023';
  end if;

  select display_name into assignee_name
  from public.profiles
  where id = p_next_action_assignee_id and is_active;

  if assignee_name is null then
    raise exception 'follow up assignee is not active' using errcode = '22023';
  end if;

  select next_action, next_action_at, next_action_assignee_id
  into previous_action, previous_due_date, previous_assignee_id
  from public.leads
  where id = p_lead_id
  for update;

  if not found then
    raise exception 'lead not found' using errcode = 'P0002';
  end if;

  update public.leads
  set
    next_action = normalized_action,
    next_action_at = p_next_action_at,
    next_action_assignee_id = p_next_action_assignee_id
  where id = p_lead_id;

  insert into public.lead_history (lead_id, actor_id, action, metadata)
  values (
    p_lead_id,
    auth.uid(),
    case when previous_action is null then 'Próxima ação definida' else 'Próxima ação atualizada' end,
    jsonb_build_object(
      'next_action', normalized_action,
      'next_action_at', p_next_action_at,
      'next_action_assignee_id', p_next_action_assignee_id,
      'next_action_assignee_name', assignee_name,
      'previous_next_action', previous_action,
      'previous_next_action_at', previous_due_date,
      'previous_next_action_assignee_id', previous_assignee_id
    )
  );
end;
$$;

create or replace function public.complete_lead_follow_up(p_lead_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_action text;
  current_due_date date;
  current_assignee_id uuid;
begin
  if not public.has_permission('atendimento') then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  select next_action, next_action_at, next_action_assignee_id
  into current_action, current_due_date, current_assignee_id
  from public.leads
  where id = p_lead_id
  for update;

  if not found then
    raise exception 'lead not found' using errcode = 'P0002';
  end if;

  if current_action is null then
    raise exception 'follow up not found' using errcode = '22023';
  end if;

  update public.leads
  set next_action = null, next_action_at = null, next_action_assignee_id = null
  where id = p_lead_id;

  insert into public.lead_history (lead_id, actor_id, action, metadata)
  values (
    p_lead_id,
    auth.uid(),
    'Próxima ação concluída',
    jsonb_build_object(
      'next_action', current_action,
      'next_action_at', current_due_date,
      'next_action_assignee_id', current_assignee_id
    )
  );
end;
$$;

grant execute on function public.schedule_lead_follow_up(uuid, text, date, uuid) to authenticated;
grant execute on function public.complete_lead_follow_up(uuid) to authenticated;

drop function if exists public.get_crm_pipeline();

create function public.get_crm_pipeline()
returns table (
  id uuid,
  name text,
  company text,
  phone text,
  source text,
  event_type text,
  desired_date date,
  guest_count integer,
  status public.lead_status,
  responsible_id uuid,
  responsible_name text,
  next_action text,
  next_action_at date,
  next_action_assignee_id uuid,
  next_action_assignee_name text,
  updated_at timestamptz,
  quote_count bigint,
  latest_quote_id uuid,
  latest_quote_status public.quote_status,
  latest_quote_total_cents integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not (public.has_permission('atendimento') or public.has_permission('gerencia')) then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  return query
  select
    lead.id, lead.name, lead.company, lead.phone, lead.source, lead.event_type,
    lead.desired_date, lead.guest_count, lead.status, lead.responsible_id,
    responsible.display_name, lead.next_action, lead.next_action_at,
    lead.next_action_assignee_id, next_assignee.display_name, lead.updated_at,
    (select count(*) from public.quotes quote_count_row where quote_count_row.lead_id = lead.id),
    latest_quote.id, latest_quote.status, latest_quote.total_amount_cents
  from public.leads lead
  left join public.profiles responsible on responsible.id = lead.responsible_id
  left join public.profiles next_assignee on next_assignee.id = lead.next_action_assignee_id
  left join lateral (
    select quote.id, quote.status, quote.total_amount_cents
    from public.quotes quote
    where quote.lead_id = lead.id
    order by quote.created_at desc
    limit 1
  ) latest_quote on true
  order by lead.next_action_at nulls last, lead.updated_at desc;
end;
$$;

grant execute on function public.get_crm_pipeline() to authenticated;
