-- Fase 3a: versões e revisão humana dos contratos e termos.
do $$
begin
  create type public.contracted_event_document_version_status as enum (
    'rascunho', 'revisado', 'emitido', 'enviado', 'assinado', 'cancelado'
  );
exception
  when duplicate_object then null;
end;
$$;

create table if not exists public.contracted_event_contract_document_versions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.contracted_events(id) on delete cascade,
  version integer not null check (version > 0),
  document_kind text not null check (document_kind in ('contrato_completo', 'termo_simplificado', 'aceite_proposta')),
  status public.contracted_event_document_version_status not null default 'rascunho',
  title text not null check (char_length(title) between 2 and 160),
  content text not null check (char_length(content) <= 30000),
  created_by uuid not null references public.profiles(id) on delete restrict,
  reviewed_by uuid references public.profiles(id) on delete restrict,
  reviewed_at timestamptz,
  issued_by uuid references public.profiles(id) on delete restrict,
  issued_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, version)
);

create index if not exists contracted_event_contract_versions_event_idx
  on public.contracted_event_contract_document_versions (event_id, version desc);

alter table public.contracted_event_contract_document_versions enable row level security;

drop policy if exists "active users read contract document versions" on public.contracted_event_contract_document_versions;
create policy "active users read contract document versions"
  on public.contracted_event_contract_document_versions
  for select to authenticated using (public.is_active_user());

drop trigger if exists contracted_event_contract_versions_touch_updated_at on public.contracted_event_contract_document_versions;
create trigger contracted_event_contract_versions_touch_updated_at
  before update on public.contracted_event_contract_document_versions
  for each row execute function public.touch_updated_at();

insert into public.contracted_event_contract_document_versions (
  event_id, version, document_kind, status, title, content, created_by, reviewed_by, reviewed_at, issued_by, issued_at, created_at, updated_at
)
select event_id, 1, 'contrato_completo', 'emitido', title, content, created_by, created_by, updated_at, created_by, updated_at, created_at, updated_at
from public.contracted_event_documents
where document_type = 'contrato'
on conflict (event_id, version) do nothing;

create or replace function public.create_contract_document_version(
  p_event_id uuid,
  p_document_kind text,
  p_title text,
  p_content text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  next_version integer;
  version_id uuid;
begin
  if not (public.has_permission('gerencia') or public.has_permission('admin_owner')) then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  if p_document_kind not in ('contrato_completo', 'termo_simplificado', 'aceite_proposta') then
    raise exception 'invalid document kind' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_event_id::text || ':contrato', 0));

  select coalesce(max(version), 0) + 1 into next_version
  from public.contracted_event_contract_document_versions
  where event_id = p_event_id;

  insert into public.contracted_event_contract_document_versions (
    event_id, version, document_kind, title, content, created_by
  ) values (
    p_event_id, next_version, p_document_kind, p_title, p_content, auth.uid()
  ) returning id into version_id;

  insert into public.contracted_event_documents (event_id, document_type, title, content, created_by)
  values (p_event_id, 'contrato', p_title, p_content, auth.uid())
  on conflict (event_id, document_type)
  do update set title = excluded.title, content = excluded.content, created_by = excluded.created_by, updated_at = now();

  insert into public.contracted_event_history (event_id, actor_id, action, metadata)
  values (p_event_id, auth.uid(), 'Versão do contrato gerada', jsonb_build_object('version_id', version_id, 'version', next_version, 'document_kind', p_document_kind));

  return version_id;
end;
$$;

create or replace function public.review_contract_document_version(p_version_id uuid) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  version_row public.contracted_event_contract_document_versions%rowtype;
begin
  if not (public.has_permission('gerencia') or public.has_permission('admin_owner')) then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  update public.contracted_event_contract_document_versions
  set status = 'revisado', reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_version_id and status = 'rascunho'
  returning * into version_row;

  if version_row.id is null then
    raise exception 'only draft versions can be reviewed' using errcode = '22023';
  end if;

  insert into public.contracted_event_history (event_id, actor_id, action, metadata)
  values (version_row.event_id, auth.uid(), 'Versão do contrato revisada', jsonb_build_object('version_id', version_row.id, 'version', version_row.version));
  return version_row.event_id;
end;
$$;

create or replace function public.issue_contract_document_version(p_version_id uuid) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  version_row public.contracted_event_contract_document_versions%rowtype;
begin
  if not (public.has_permission('gerencia') or public.has_permission('admin_owner')) then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  update public.contracted_event_contract_document_versions
  set status = 'emitido', issued_by = auth.uid(), issued_at = now()
  where id = p_version_id and status = 'revisado'
  returning * into version_row;

  if version_row.id is null then
    raise exception 'only reviewed versions can be issued' using errcode = '22023';
  end if;

  insert into public.contracted_event_history (event_id, actor_id, action, metadata)
  values (version_row.event_id, auth.uid(), 'Versão final do contrato emitida', jsonb_build_object('version_id', version_row.id, 'version', version_row.version));
  return version_row.event_id;
end;
$$;

grant execute on function public.create_contract_document_version(uuid, text, text, text) to authenticated;
grant execute on function public.review_contract_document_version(uuid) to authenticated;
grant execute on function public.issue_contract_document_version(uuid) to authenticated;
