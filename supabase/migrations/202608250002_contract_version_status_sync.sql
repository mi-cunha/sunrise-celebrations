-- Sincroniza o ciclo da versão emitida com o status operacional do contrato.
create or replace function public.set_contract_document_version_status(
  p_version_id uuid,
  p_status public.contracted_event_document_version_status,
  p_signed_at date default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  version_row public.contracted_event_contract_document_versions%rowtype;
  previous_status public.contracted_event_document_version_status;
  contract_status public.contracted_event_contract_status;
begin
  if not (public.has_permission('gerencia') or public.has_permission('admin_owner')) then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  select * into version_row
  from public.contracted_event_contract_document_versions
  where id = p_version_id
  for update;

  if version_row.id is null then
    raise exception 'contract version not found' using errcode = 'P0002';
  end if;

  previous_status := version_row.status;
  if p_status = 'enviado' and previous_status <> 'emitido' then
    raise exception 'only issued versions can be sent' using errcode = '22023';
  elsif p_status = 'assinado' and previous_status <> 'enviado' then
    raise exception 'only sent versions can be signed' using errcode = '22023';
  elsif p_status = 'assinado' and p_signed_at is null then
    raise exception 'signed date is required' using errcode = '22023';
  elsif p_status = 'cancelado' and previous_status not in ('rascunho', 'revisado', 'emitido', 'enviado') then
    raise exception 'this version cannot be cancelled' using errcode = '22023';
  elsif p_status not in ('enviado', 'assinado', 'cancelado') then
    raise exception 'invalid lifecycle status' using errcode = '22023';
  end if;

  update public.contracted_event_contract_document_versions
  set status = p_status
  where id = p_version_id;

  contract_status := case
    when p_status = 'enviado' then 'enviado'::public.contracted_event_contract_status
    when p_status = 'assinado' then 'assinado'::public.contracted_event_contract_status
    else 'cancelado'::public.contracted_event_contract_status
  end;

  insert into public.contracted_event_contracts (event_id, status, signed_at, created_by)
  values (
    version_row.event_id,
    contract_status,
    case when p_status = 'assinado' then p_signed_at else null end,
    auth.uid()
  )
  on conflict (event_id)
  do update set
    status = excluded.status,
    signed_at = excluded.signed_at;

  insert into public.contracted_event_history (event_id, actor_id, action, metadata)
  values (
    version_row.event_id,
    auth.uid(),
    'Status da versão do contrato atualizado',
    jsonb_build_object('version_id', version_row.id, 'version', version_row.version, 'from', previous_status, 'to', p_status, 'signed_at', p_signed_at)
  );

  return version_row.event_id;
end;
$$;

grant execute on function public.set_contract_document_version_status(uuid, public.contracted_event_document_version_status, date) to authenticated;
