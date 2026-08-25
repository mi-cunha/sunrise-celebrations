-- Aprova o orçamento e cria o evento em uma única transação.
-- Se qualquer etapa falhar, nenhuma alteração é persistida.
create or replace function public.approve_quote_and_create_event(
  p_quote_id uuid,
  p_reason text,
  p_confirm_date_conflict boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  quote_row public.quotes%rowtype;
  event_id uuid;
  active_event_count integer;
  conflict_titles jsonb;
begin
  if not public.can_manage_quotes() or not public.can_manage_contracted_events() then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  select * into quote_row
  from public.quotes
  where id = p_quote_id
  for update;

  if quote_row.id is null then
    raise exception 'quote not found' using errcode = 'P0002';
  end if;

  if quote_row.desired_date is null then
    raise exception 'event date is required' using errcode = '22023';
  end if;

  select count(*)::integer into active_event_count
  from public.contracted_events
  where event_date = quote_row.desired_date
    and status <> 'cancelado'
    and quote_id <> p_quote_id;

  if active_event_count >= 3 then
    raise exception 'event date capacity reached' using errcode = '22023';
  end if;

  select coalesce(jsonb_agg(conflict.title order by conflict.title), '[]'::jsonb)
  into conflict_titles
  from (
    select title
    from public.contracted_events
    where event_date = quote_row.desired_date
      and status <> 'cancelado'
      and quote_id <> p_quote_id
    union all
    select title
    from public.calendar_entries
    where start_date <= quote_row.desired_date
      and end_date >= quote_row.desired_date
  ) conflict;

  if jsonb_array_length(conflict_titles) > 0 and not p_confirm_date_conflict then
    return jsonb_build_object(
      'requires_confirmation', true,
      'conflicts', conflict_titles,
      'event_date', quote_row.desired_date
    );
  end if;

  perform public.update_quote_status(p_quote_id, 'aprovado'::public.quote_status, p_reason);
  event_id := public.create_contracted_event_from_quote(p_quote_id);

  return jsonb_build_object(
    'requires_confirmation', false,
    'event_id', event_id,
    'event_date', quote_row.desired_date
  );
end;
$$;

grant execute on function public.approve_quote_and_create_event(uuid, text, boolean) to authenticated;
