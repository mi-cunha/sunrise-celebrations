-- Reparo de acentuação para instalações que aplicaram a migration da Fase 3 antes da correção de encoding.
update public.contracted_event_checklist
set title = replace(replace(replace(replace(title, 'Pagamento e condiÃ§Ãµes alinhados', 'Pagamento e condições alinhados'), 'Cronograma do evento definido', 'Cronograma do evento definido'), 'Checklist final do evento', 'Checklist final do evento'), 'Equipe operacional definida', 'Equipe operacional definida')
where title like '%Ã%' or title like '%Â%' or title like '%â%';

update public.contracted_event_history
set
  action = replace(action, 'Checklist concluÃ­do', 'Checklist concluído'),
  metadata = case
    when metadata ? 'title' then jsonb_set(metadata, '{title}', to_jsonb(replace(metadata->>'title', 'Pagamento e condiÃ§Ãµes alinhados', 'Pagamento e condições alinhados')))
    else metadata
  end
where action like '%Ã%' or metadata::text like '%Ã%';

create or replace function public.create_contracted_event_from_quote(p_quote_id uuid) returns uuid
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

create or replace function public.toggle_contracted_event_checklist_item(
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
