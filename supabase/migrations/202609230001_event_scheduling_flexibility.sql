-- Permite registrar intenção comercial sem inventar uma data/hora exata.
alter table public.leads
  add column if not exists desired_date_mode text not null default 'exact'
    check (desired_date_mode in ('exact', 'month_year', 'weekday', 'undefined')),
  add column if not exists desired_date_note text
    check (desired_date_note is null or char_length(trim(desired_date_note)) between 2 and 80),
  add column if not exists desired_start_time time,
  add column if not exists desired_duration_minutes integer
    check (desired_duration_minutes is null or desired_duration_minutes between 30 and 1440);

alter table public.quotes
  add column if not exists desired_date_mode text not null default 'exact'
    check (desired_date_mode in ('exact', 'month_year', 'weekday', 'undefined')),
  add column if not exists desired_date_note text
    check (desired_date_note is null or char_length(trim(desired_date_note)) between 2 and 80),
  add column if not exists desired_start_time time,
  add column if not exists desired_duration_minutes integer
    check (desired_duration_minutes is null or desired_duration_minutes between 30 and 1440);

alter table public.contracted_events
  add column if not exists event_start_time time,
  add column if not exists event_duration_minutes integer
    check (event_duration_minutes is null or event_duration_minutes between 30 and 1440);

update public.leads
set desired_date_mode = case when desired_date is null then 'undefined' else 'exact' end
where desired_date_mode = 'exact' and desired_date is null;

update public.quotes
set desired_date_mode = case when desired_date is null then 'undefined' else 'exact' end
where desired_date_mode = 'exact' and desired_date is null;

create or replace function public.create_quote_from_lead(p_lead_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare lead_row public.leads%rowtype; new_quote_id uuid;
begin
  if not public.can_manage_quotes() then raise exception 'permission denied' using errcode = '42501'; end if;
  select * into lead_row from public.leads where id = p_lead_id;
  if lead_row.id is null then raise exception 'lead not found' using errcode = 'P0002'; end if;
  insert into public.quotes (lead_id,title,status,event_type,desired_date,desired_date_mode,desired_date_note,desired_start_time,desired_duration_minutes,guest_count,notes,created_by)
  values (lead_row.id,'Orçamento - ' || lead_row.name,'em_elaboracao',lead_row.event_type,lead_row.desired_date,lead_row.desired_date_mode,lead_row.desired_date_note,lead_row.desired_start_time,lead_row.desired_duration_minutes,lead_row.guest_count,lead_row.notes,auth.uid())
  returning id into new_quote_id;
  insert into public.quote_history (quote_id,actor_id,action,metadata) values (new_quote_id,auth.uid(),'Orçamento criado',jsonb_build_object('lead_id',p_lead_id));
  insert into public.lead_history (lead_id,actor_id,action,metadata) values (p_lead_id,auth.uid(),'Orçamento criado',jsonb_build_object('quote_id',new_quote_id));
  if lead_row.status in ('novo','em_atendimento','qualificado') then update public.leads set status = 'orcamento_em_elaboracao' where id = p_lead_id; end if;
  return new_quote_id;
end;
$$;

create or replace function public.update_lead_crm_details(
  p_lead_id uuid, p_name text, p_company text, p_phone text, p_source text, p_event_type text,
  p_desired_date date, p_guest_count integer, p_budget_range text, p_notes text, p_responsible_id uuid,
  p_desired_date_mode text default 'exact', p_desired_date_note text default null,
  p_desired_start_time time default null, p_desired_duration_minutes integer default null
) returns void language plpgsql security definer set search_path = public as $$
declare normalized_budget text := nullif(trim(p_budget_range), ''); normalized_note text := nullif(trim(p_desired_date_note), ''); previous_responsible uuid;
begin
  if not public.has_permission('atendimento') then raise exception 'permission denied' using errcode = '42501'; end if;
  if p_desired_date_mode not in ('exact','month_year','weekday','undefined') then raise exception 'invalid desired date mode' using errcode = '22023'; end if;
  if p_desired_date_mode = 'exact' and p_desired_date is null then raise exception 'exact date is required' using errcode = '22023'; end if;
  if p_desired_date_mode in ('month_year','weekday') and normalized_note is null then raise exception 'date detail is required' using errcode = '22023'; end if;
  if normalized_note is not null and char_length(normalized_note) not between 2 and 80 then raise exception 'invalid date detail' using errcode = '22023'; end if;
  if p_desired_duration_minutes is not null and p_desired_duration_minutes not between 30 and 1440 then raise exception 'invalid duration' using errcode = '22023'; end if;
  if normalized_budget is not null and char_length(normalized_budget) not between 2 and 120 then raise exception 'invalid budget range' using errcode = '22023'; end if;
  if p_responsible_id is not null and not exists (select 1 from public.profiles where id = p_responsible_id and is_active) then raise exception 'responsible is not active' using errcode = '22023'; end if;
  select responsible_id into previous_responsible from public.leads where id = p_lead_id for update;
  if not found then raise exception 'lead not found' using errcode = 'P0002'; end if;
  update public.leads set name=p_name,company=p_company,phone=p_phone,source=p_source,event_type=p_event_type,
    desired_date=case when p_desired_date_mode='exact' then p_desired_date else null end,
    desired_date_mode=p_desired_date_mode,desired_date_note=case when p_desired_date_mode in ('month_year','weekday') then normalized_note else null end,
    desired_start_time=p_desired_start_time,desired_duration_minutes=p_desired_duration_minutes,guest_count=p_guest_count,budget_range=normalized_budget,notes=p_notes,responsible_id=p_responsible_id
  where id=p_lead_id;
  insert into public.lead_history (lead_id,actor_id,action,metadata) values (p_lead_id,auth.uid(),'Dados comerciais atualizados',jsonb_build_object('budget_range',normalized_budget,'responsible_id',p_responsible_id,'previous_responsible_id',previous_responsible));
end;
$$;

create or replace function public.update_quote_event_schedule(
  p_quote_id uuid, p_desired_date_mode text, p_desired_date date, p_desired_date_note text,
  p_desired_start_time time, p_desired_duration_minutes integer
) returns void language plpgsql security definer set search_path = public as $$
declare normalized_note text := nullif(trim(p_desired_date_note), '');
begin
  if not public.can_manage_quotes() then raise exception 'permission denied' using errcode = '42501'; end if;
  if p_desired_date_mode not in ('exact','month_year','weekday','undefined') then raise exception 'invalid desired date mode' using errcode = '22023'; end if;
  if p_desired_date_mode = 'exact' and p_desired_date is null then raise exception 'exact date is required' using errcode = '22023'; end if;
  if p_desired_date_mode in ('month_year','weekday') and normalized_note is null then raise exception 'date detail is required' using errcode = '22023'; end if;
  if normalized_note is not null and char_length(normalized_note) not between 2 and 80 then raise exception 'invalid date detail' using errcode = '22023'; end if;
  if p_desired_duration_minutes is not null and p_desired_duration_minutes not between 30 and 1440 then raise exception 'invalid duration' using errcode = '22023'; end if;
  update public.quotes set desired_date=case when p_desired_date_mode='exact' then p_desired_date else null end,
    desired_date_mode=p_desired_date_mode,desired_date_note=case when p_desired_date_mode in ('month_year','weekday') then normalized_note else null end,
    desired_start_time=p_desired_start_time,desired_duration_minutes=p_desired_duration_minutes
  where id=p_quote_id;
  if not found then raise exception 'quote not found' using errcode = 'P0002'; end if;
  insert into public.quote_history (quote_id,actor_id,action,metadata) values (p_quote_id,auth.uid(),'Data e horário atualizados','{}');
end;
$$;

create or replace function public.copy_quote_schedule_to_event() returns trigger language plpgsql security definer set search_path = public as $$
begin
  select desired_start_time, desired_duration_minutes into new.event_start_time, new.event_duration_minutes from public.quotes where id = new.quote_id;
  return new;
end;
$$;
drop trigger if exists contracted_events_copy_quote_schedule on public.contracted_events;
create trigger contracted_events_copy_quote_schedule before insert on public.contracted_events for each row execute function public.copy_quote_schedule_to_event();

grant execute on function public.update_lead_crm_details(uuid,text,text,text,text,text,date,integer,text,text,uuid,text,text,time,integer) to authenticated;
grant execute on function public.update_quote_event_schedule(uuid,text,date,text,time,integer) to authenticated;
