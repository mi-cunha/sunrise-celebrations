-- Fase 1c: atualizações comerciais do lead a partir do atendimento.
create function public.update_lead_from_atendimento(
  p_lead_id uuid,
  p_name text,
  p_company text,
  p_phone text,
  p_source text,
  p_event_type text,
  p_desired_date date,
  p_guest_count integer,
  p_notes text,
  p_create_event boolean
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_permission('atendimento') then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  update public.leads
  set
    name = p_name,
    company = p_company,
    phone = p_phone,
    source = p_source,
    event_type = p_event_type,
    desired_date = p_desired_date,
    guest_count = p_guest_count,
    notes = p_notes
  where id = p_lead_id;

  if not found then
    raise exception 'lead not found' using errcode = 'P0002';
  end if;

  if p_create_event then
    insert into public.potential_events (lead_id, event_type, desired_date, guest_count)
    values (p_lead_id, p_event_type, p_desired_date, p_guest_count)
    on conflict (lead_id) do update
    set
      event_type = excluded.event_type,
      desired_date = excluded.desired_date,
      guest_count = excluded.guest_count;
  else
    delete from public.potential_events where lead_id = p_lead_id;
  end if;

  insert into public.lead_history (lead_id, actor_id, action, metadata)
  values (
    p_lead_id,
    auth.uid(),
    'Lead atualizado pelo atendimento',
    jsonb_build_object(
      'name', p_name,
      'company', p_company,
      'phone', p_phone,
      'source', p_source,
      'event_type', p_event_type,
      'desired_date', p_desired_date,
      'guest_count', p_guest_count
    )
  );
end;
$$;

create function public.update_lead_status_from_atendimento(
  p_lead_id uuid,
  p_status public.lead_status
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  old_status public.lead_status;
begin
  if not public.has_permission('atendimento') then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  select status into old_status from public.leads where id = p_lead_id;
  if old_status is null then
    raise exception 'lead not found' using errcode = 'P0002';
  end if;

  update public.leads
  set status = p_status
  where id = p_lead_id;

  if old_status is distinct from p_status then
    insert into public.lead_history (lead_id, actor_id, action, metadata)
    values (
      p_lead_id,
      auth.uid(),
      'Status comercial alterado',
      jsonb_build_object('from', old_status, 'to', p_status)
    );
  end if;
end;
$$;

grant execute on function public.update_lead_from_atendimento(uuid, text, text, text, text, text, date, integer, text, boolean) to authenticated;
grant execute on function public.update_lead_status_from_atendimento(uuid, public.lead_status) to authenticated;
