-- Fase 3: catálogo de pacotes por tipo de evento.
create table public.event_package_catalog (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  name text not null check (char_length(name) between 2 and 120),
  description text check (description is null or char_length(description) <= 1200),
  base_price_cents integer check (base_price_cents is null or base_price_cents >= 0),
  proposal_notes text check (proposal_notes is null or char_length(proposal_notes) <= 1600),
  operation_notes text check (operation_notes is null or char_length(operation_notes) <= 1600),
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_type, name)
);

create table public.event_package_items (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.event_package_catalog(id) on delete cascade,
  category text not null default 'comida' check (category in ('comida', 'bebida', 'servico', 'estrutura', 'observacao', 'outro')),
  name text not null check (char_length(name) between 2 and 160),
  description text check (description is null or char_length(description) <= 800),
  show_in_proposal boolean not null default true,
  show_in_operational_brief boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index event_package_catalog_event_type_idx on public.event_package_catalog (event_type, is_active, sort_order, name);
create index event_package_items_package_sort_idx on public.event_package_items (package_id, sort_order, created_at);

alter table public.event_package_catalog enable row level security;
alter table public.event_package_items enable row level security;

create policy "active users read event packages" on public.event_package_catalog
  for select to authenticated using (public.is_active_user());
create policy "admins create event packages" on public.event_package_catalog
  for insert to authenticated with check (public.has_permission('admin_owner'));
create policy "admins update event packages" on public.event_package_catalog
  for update to authenticated using (public.has_permission('admin_owner')) with check (public.has_permission('admin_owner'));

create policy "active users read event package items" on public.event_package_items
  for select to authenticated using (public.is_active_user());
create policy "admins create event package items" on public.event_package_items
  for insert to authenticated with check (public.has_permission('admin_owner'));
create policy "admins update event package items" on public.event_package_items
  for update to authenticated using (public.has_permission('admin_owner')) with check (public.has_permission('admin_owner'));
create policy "admins delete event package items" on public.event_package_items
  for delete to authenticated using (public.has_permission('admin_owner'));

create trigger event_package_catalog_touch_updated_at
  before update on public.event_package_catalog
  for each row execute function public.touch_updated_at();

create trigger event_package_items_touch_updated_at
  before update on public.event_package_items
  for each row execute function public.touch_updated_at();

create or replace function public.next_event_package_item_sort_order(p_package_id uuid) returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(max(sort_order), 0) + 10
  from public.event_package_items
  where package_id = p_package_id;
$$;

grant execute on function public.next_event_package_item_sort_order(uuid) to authenticated;

create or replace function public.generate_event_operational_brief(p_event_id uuid) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  event_row public.contracted_events%rowtype;
  lead_row public.leads%rowtype;
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
