-- Reconcilia contratos atualizados pelo formulário antigo com sua versão documental mais recente.
with latest_versions as (
  select distinct on (event_id) id, event_id
  from public.contracted_event_contract_document_versions
  order by event_id, version desc
)
update public.contracted_event_contract_document_versions version
set status = case contract.status
  when 'enviado' then 'enviado'::public.contracted_event_document_version_status
  when 'assinado' then 'assinado'::public.contracted_event_document_version_status
  when 'cancelado' then 'cancelado'::public.contracted_event_document_version_status
  else version.status
end
from latest_versions latest
join public.contracted_event_contracts contract on contract.event_id = latest.event_id
where version.id = latest.id
  and contract.status in ('enviado', 'assinado', 'cancelado')
  and version.status <> 'assinado';
