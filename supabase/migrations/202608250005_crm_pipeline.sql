-- Direção herda as capacidades de supervisão, comercial e financeiro da gerência.
create or replace function public.has_permission(required public.app_permission) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles profile
    join public.user_permissions user_permission on user_permission.user_id = profile.id
    where profile.id = auth.uid()
      and profile.is_active
      and (
        user_permission.permission = required
        or user_permission.permission = 'admin_owner'
        or (
          user_permission.permission = 'direcao'
          and required in ('atendimento', 'financeiro', 'gerencia')
        )
      )
  );
$$;

grant execute on function public.has_permission(public.app_permission) to authenticated;

-- Leitura comercial dedicada ao CRM, separada das permissões exclusivamente financeiras.
create or replace function public.get_crm_pipeline()
returns table (
  id uuid,
  name text,
  company text,
  phone text,
  source text,
  event_type text,
  desired_date date,
  guest_count integer,
  status public.lead_status,
  responsible_id uuid,
  responsible_name text,
  created_at timestamptz,
  updated_at timestamptz,
  quote_count bigint,
  latest_quote_id uuid,
  latest_quote_status public.quote_status,
  latest_quote_total_cents integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not (public.has_permission('atendimento') or public.has_permission('gerencia')) then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  return query
  select
    lead.id, lead.name, lead.company, lead.phone, lead.source, lead.event_type,
    lead.desired_date, lead.guest_count, lead.status, lead.responsible_id,
    responsible.display_name, lead.created_at, lead.updated_at,
    (select count(*) from public.quotes quote_count_row where quote_count_row.lead_id = lead.id),
    latest_quote.id, latest_quote.status, latest_quote.total_amount_cents
  from public.leads lead
  left join public.profiles responsible on responsible.id = lead.responsible_id
  left join lateral (
    select quote.id, quote.status, quote.total_amount_cents
    from public.quotes quote
    where quote.lead_id = lead.id
    order by quote.created_at desc
    limit 1
  ) latest_quote on true
  order by lead.updated_at desc;
end;
$$;

grant execute on function public.get_crm_pipeline() to authenticated;
