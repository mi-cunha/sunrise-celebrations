-- Fase 3: documentos operacionais do evento.
create type public.contracted_event_document_type as enum ('ficha_operacional', 'contrato', 'outro');

create table public.contracted_event_documents (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.contracted_events(id) on delete cascade,
  document_type public.contracted_event_document_type not null default 'ficha_operacional',
  title text not null check (char_length(title) between 2 and 160),
  content text not null check (char_length(content) <= 12000),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, document_type)
);

create index contracted_event_documents_event_type_idx on public.contracted_event_documents (event_id, document_type);

alter table public.contracted_event_documents enable row level security;

create policy "active users read contracted event documents" on public.contracted_event_documents
  for select to authenticated using (public.is_active_user());
create policy "event managers create contracted event documents" on public.contracted_event_documents
  for insert to authenticated with check (public.can_manage_contracted_events() and created_by = auth.uid());
create policy "event managers update contracted event documents" on public.contracted_event_documents
  for update to authenticated using (public.can_manage_contracted_events()) with check (public.can_manage_contracted_events());

create trigger contracted_event_documents_touch_updated_at
  before update on public.contracted_event_documents
  for each row execute function public.touch_updated_at();

create function public.generate_event_operational_brief(p_event_id uuid) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  event_row public.contracted_events%rowtype;
  lead_row public.leads%rowtype;
  quote_row public.quotes%rowtype;
  checklist_summary text;
  document_content text;
  document_id uuid;
begin
  if not public.can_manage_contracted_events() then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  select * into event_row
  from public.contracted_events
  where id = p_event_id;

  if event_row.id is null then
    raise exception 'event not found' using errcode = 'P0002';
  end if;

  select * into lead_row
  from public.leads
  where id = event_row.lead_id;

  select * into quote_row
  from public.quotes
  where id = event_row.quote_id;

  select string_agg(
    case
      when c.is_done then '- [x] ' || c.title
      else '- [ ] ' || c.title
    end ||
    coalesce(' | Prazo: ' || to_char(c.due_date, 'DD/MM/YYYY'), '') ||
    coalesce(' | Observações: ' || c.notes, ''),
    E'\n'
    order by c.sort_order, c.created_at
  )
  into checklist_summary
  from public.contracted_event_checklist c
  where c.event_id = p_event_id;

  document_content := concat_ws(
    E'\n\n',
    '# Ficha operacional - ' || event_row.title,
    'Cliente: ' || coalesce(lead_row.name, 'Não informado') || coalesce(E'\nTelefone: ' || lead_row.phone, '') || coalesce(E'\nEmpresa: ' || lead_row.company, ''),
    'Evento: ' || coalesce(event_row.event_type, 'Não informado') || coalesce(E'\nData: ' || to_char(event_row.event_date, 'DD/MM/YYYY'), E'\nData: Não definida') || coalesce(E'\nConvidados: ' || event_row.guest_count::text, E'\nConvidados: Não informado'),
    'Investimento aprovado: R$ ' || to_char(coalesce(quote_row.total_amount_cents, 0) / 100.0, 'FM999G999G999D00'),
    'Observações do evento:' || E'\n' || coalesce(event_row.notes, 'Sem observações registradas.'),
    'Checklist operacional:' || E'\n' || coalesce(checklist_summary, 'Nenhuma tarefa cadastrada.')
  );

  insert into public.contracted_event_documents (event_id, document_type, title, content, created_by)
  values (p_event_id, 'ficha_operacional', 'Ficha operacional', document_content, auth.uid())
  on conflict (event_id, document_type)
  do update set
    title = excluded.title,
    content = excluded.content,
    updated_at = now()
  returning id into document_id;

  insert into public.contracted_event_history (event_id, actor_id, action, metadata)
  values (p_event_id, auth.uid(), 'Ficha operacional gerada', jsonb_build_object('document_id', document_id));

  return document_id;
end;
$$;

grant execute on function public.generate_event_operational_brief(uuid) to authenticated;
