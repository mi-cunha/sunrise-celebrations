-- Garante que área, data e horário sejam gravados apenas quando o orçamento
-- puder ser efetivamente editado pelo usuário autenticado.
create or replace function public.update_quote_event_area(
  p_quote_id uuid,
  p_event_area text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_event_area not in ('lado_esquerdo', 'lado_direito', 'praia', 'casa_completa') then
    raise exception 'invalid event area' using errcode = '22023';
  end if;

  if not public.can_edit_quote(p_quote_id) then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  update public.quotes
  set event_area = p_event_area
  where id = p_quote_id;

  if not found then
    raise exception 'quote not found' using errcode = 'P0002';
  end if;

  insert into public.quote_history (quote_id, actor_id, action, metadata)
  values (p_quote_id, auth.uid(), 'Área do evento atualizada', jsonb_build_object('event_area', p_event_area));
end;
$$;

create or replace function public.update_quote_event_schedule(
  p_quote_id uuid,
  p_desired_date_mode text,
  p_desired_date date,
  p_desired_date_note text,
  p_desired_start_time time,
  p_desired_duration_minutes integer
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_note text := nullif(trim(p_desired_date_note), '');
begin
  if not public.can_edit_quote(p_quote_id) then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  if p_desired_date_mode not in ('exact', 'month_year', 'weekday', 'undefined') then
    raise exception 'invalid desired date mode' using errcode = '22023';
  end if;
  if p_desired_date_mode = 'exact' and p_desired_date is null then
    raise exception 'exact date is required' using errcode = '22023';
  end if;
  if p_desired_date_mode in ('month_year', 'weekday') and normalized_note is null then
    raise exception 'date detail is required' using errcode = '22023';
  end if;
  if normalized_note is not null and char_length(normalized_note) not between 2 and 80 then
    raise exception 'invalid date detail' using errcode = '22023';
  end if;
  if p_desired_duration_minutes is not null and p_desired_duration_minutes not between 30 and 1440 then
    raise exception 'invalid duration' using errcode = '22023';
  end if;

  update public.quotes
  set desired_date = case when p_desired_date_mode = 'exact' then p_desired_date else null end,
      desired_date_mode = p_desired_date_mode,
      desired_date_note = case when p_desired_date_mode in ('month_year', 'weekday') then normalized_note else null end,
      desired_start_time = p_desired_start_time,
      desired_duration_minutes = p_desired_duration_minutes
  where id = p_quote_id;

  if not found then
    raise exception 'quote not found' using errcode = 'P0002';
  end if;

  insert into public.quote_history (quote_id, actor_id, action, metadata)
  values (p_quote_id, auth.uid(), 'Data e horário atualizados', '{}');
end;
$$;

grant execute on function public.update_quote_event_area(uuid, text) to authenticated;
grant execute on function public.update_quote_event_schedule(uuid, text, date, text, time, integer) to authenticated;
