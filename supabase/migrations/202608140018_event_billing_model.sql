-- Fase 3: modelo de cobrança do evento contratado.
create type public.contracted_event_billing_model as enum ('orcamento_fechado', 'consumo_aberto_pos_evento', 'pre_pago_com_consumo_aberto');

alter table public.contracted_events
  add column billing_model public.contracted_event_billing_model not null default 'orcamento_fechado',
  add column billing_notes text check (billing_notes is null or char_length(billing_notes) <= 1200);

create function public.update_contracted_event_billing_model(
  p_event_id uuid,
  p_billing_model public.contracted_event_billing_model,
  p_billing_notes text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_notes text;
begin
  if not public.can_manage_event_financials() then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  normalized_notes := nullif(trim(coalesce(p_billing_notes, '')), '');

  update public.contracted_events
  set
    billing_model = p_billing_model,
    billing_notes = normalized_notes
  where id = p_event_id;

  if not found then
    raise exception 'event not found' using errcode = 'P0002';
  end if;

  insert into public.contracted_event_history (event_id, actor_id, action, metadata)
  values (p_event_id, auth.uid(), 'Modelo de cobrança atualizado', jsonb_build_object('billing_model', p_billing_model));

  return p_event_id;
end;
$$;

grant execute on function public.update_contracted_event_billing_model(uuid, public.contracted_event_billing_model, text) to authenticated;
