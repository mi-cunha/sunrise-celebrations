-- CRM: início de conversa, entregas de documentos, alertas e comissões.
-- Esta migration apenas amplia as fontes de verdade existentes.

create table if not exists public.crm_message_templates (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('primeiro_contato', 'retorno_cadastro', 'convite_visita', 'retorno_orcamento', 'proposta_whatsapp', 'contrato_whatsapp', 'proposta_email', 'contrato_email')),
  channel text not null check (channel in ('whatsapp', 'email')),
  title text not null check (char_length(trim(title)) between 2 and 120),
  body text not null check (char_length(trim(body)) between 2 and 4000),
  whatsapp_template_name text check (whatsapp_template_name is null or whatsapp_template_name ~ '^[a-z0-9_]{1,512}$'),
  whatsapp_template_language text not null default 'pt_BR' check (whatsapp_template_language ~ '^[a-z]{2}_[A-Z]{2}$'),
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (kind, channel)
);

create table if not exists public.crm_document_deliveries (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete restrict,
  quote_id uuid references public.quotes(id) on delete restrict,
  event_id uuid references public.contracted_events(id) on delete restrict,
  document_type text not null check (document_type in ('proposta', 'contrato')),
  channel text not null check (channel in ('whatsapp', 'email')),
  recipient text not null check (char_length(trim(recipient)) between 3 and 320),
  subject text,
  body text not null check (char_length(trim(body)) between 2 and 4000),
  document_url text not null check (char_length(trim(document_url)) between 3 and 2000),
  document_version text not null check (char_length(trim(document_version)) between 1 and 120),
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'not_configured')),
  external_message_id text,
  failure_reason text,
  sent_by uuid references public.profiles(id) on delete set null,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.conversation_read_receipts (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create table if not exists public.user_notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  sound_enabled boolean not null default true,
  browser_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.company_settings
  add column if not exists management_commission_recipient_id uuid references public.profiles(id) on delete set null;

alter table public.contracted_event_costs
  add column if not exists commission_kind text check (commission_kind is null or commission_kind in ('comercial', 'gerencia')),
  add column if not exists beneficiary_id uuid references public.profiles(id) on delete set null,
  add column if not exists commission_rate_basis_points integer check (commission_rate_basis_points is null or commission_rate_basis_points between 0 and 10000),
  add column if not exists commission_base_amount_cents integer check (commission_base_amount_cents is null or commission_base_amount_cents >= 0),
  add column if not exists commission_locked_at timestamptz,
  add column if not exists commission_approved_at timestamptz;

alter type public.contracted_event_cost_status add value if not exists 'provisionada';

create unique index if not exists contracted_event_costs_unique_commission_kind
  on public.contracted_event_costs (event_id, commission_kind)
  where commission_kind is not null;

create index if not exists crm_document_deliveries_lead_created_idx on public.crm_document_deliveries (lead_id, created_at desc);
create index if not exists conversation_read_receipts_user_idx on public.conversation_read_receipts (user_id, last_read_at desc);

alter table public.crm_message_templates enable row level security;
alter table public.crm_document_deliveries enable row level security;
alter table public.conversation_read_receipts enable row level security;
alter table public.user_notification_preferences enable row level security;

create policy "active users read crm message templates" on public.crm_message_templates for select to authenticated using (public.is_active_user());
create policy "owners manage crm message templates" on public.crm_message_templates for all to authenticated using (public.has_permission('admin_owner')) with check (public.has_permission('admin_owner'));
create policy "active users read document deliveries" on public.crm_document_deliveries for select to authenticated using (public.is_active_user());
create policy "lead managers create document deliveries" on public.crm_document_deliveries for insert to authenticated with check (public.has_permission('atendimento') or public.has_permission('financeiro') or public.has_permission('gerencia') or public.has_permission('direcao') or public.has_permission('admin_owner'));
create policy "delivery managers update document deliveries" on public.crm_document_deliveries for update to authenticated using (public.has_permission('atendimento') or public.has_permission('financeiro') or public.has_permission('gerencia') or public.has_permission('direcao') or public.has_permission('admin_owner')) with check (public.has_permission('atendimento') or public.has_permission('financeiro') or public.has_permission('gerencia') or public.has_permission('direcao') or public.has_permission('admin_owner'));
create policy "users manage own read receipts" on public.conversation_read_receipts for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users manage own notification preferences" on public.user_notification_preferences for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.touch_crm_commercial_rows() returns trigger language plpgsql security definer set search_path = public as $$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists crm_message_templates_touch_updated_at on public.crm_message_templates;
create trigger crm_message_templates_touch_updated_at before update on public.crm_message_templates for each row execute function public.touch_crm_commercial_rows();
drop trigger if exists user_notification_preferences_touch_updated_at on public.user_notification_preferences;
create trigger user_notification_preferences_touch_updated_at before update on public.user_notification_preferences for each row execute function public.touch_crm_commercial_rows();

insert into public.crm_message_templates (kind, channel, title, body, whatsapp_template_name, sort_order)
values
  ('primeiro_contato', 'whatsapp', 'Primeiro contato', 'Olá, {{nome}}! Sou da equipe Sunrise Celebrations. Recebemos seu contato e será um prazer ajudar com o seu evento.', null, 10),
  ('retorno_cadastro', 'whatsapp', 'Retorno após cadastro', 'Olá, {{nome}}! Recebemos suas informações e nossa equipe dará continuidade ao seu atendimento por aqui.', null, 20),
  ('convite_visita', 'whatsapp', 'Convite para visita', 'Olá, {{nome}}! Gostaríamos de convidar você para conhecer o Sunrise Celebrations. Qual dia e horário funcionam melhor?', null, 30),
  ('retorno_orcamento', 'whatsapp', 'Retorno sobre orçamento', 'Olá, {{nome}}! Estamos preparando o retorno sobre sua solicitação de orçamento. Podemos seguir por aqui?', null, 40),
  ('proposta_whatsapp', 'whatsapp', 'Envio de proposta', 'Olá, {{nome}}! Sua proposta está pronta. Segue o documento para sua avaliação.', null, 50),
  ('contrato_whatsapp', 'whatsapp', 'Envio de contrato', 'Olá, {{nome}}! Segue a versão do contrato para sua avaliação.', null, 60),
  ('proposta_email', 'email', 'Envio de proposta por e-mail', 'Olá, {{nome}},\n\nSegue anexa a proposta para seu evento. Ficamos à disposição para esclarecer qualquer ponto.\n\nEquipe Sunrise Celebrations', null, 70),
  ('contrato_email', 'email', 'Envio de contrato por e-mail', 'Olá, {{nome}},\n\nSegue anexa a versão do contrato para sua avaliação.\n\nEquipe Sunrise Celebrations', null, 80)
on conflict (kind, channel) do nothing;

create or replace function public.create_outbound_conversation(
  p_lead_id uuid,
  p_template_id uuid,
  p_body text
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_conversation_id uuid; v_template public.crm_message_templates%rowtype; v_lead public.leads%rowtype;
begin
  if not public.has_permission('atendimento') then raise exception 'permission denied' using errcode = '42501'; end if;
  select * into v_lead from public.leads where id = p_lead_id;
  if v_lead.id is null then raise exception 'lead not found' using errcode = 'P0002'; end if;
  if nullif(regexp_replace(coalesce(v_lead.phone, ''), '\\D', '', 'g'), '') is null then raise exception 'invalid phone' using errcode = '22023'; end if;
  select * into v_template from public.crm_message_templates where id = p_template_id and channel = 'whatsapp' and is_active;
  if v_template.id is null then raise exception 'invalid outbound template' using errcode = '22023'; end if;
  insert into public.conversations (lead_id, channel, status, ai_paused, assigned_to, needs_human, created_by, external_contact_id, external_phone_number_id, whatsapp_connection_id)
  select v_lead.id, 'whatsapp_cloud', 'humano_assumiu', true, coalesce(v_lead.responsible_id, auth.uid()), false, auth.uid(), coalesce(v_lead.whatsapp_id, regexp_replace(v_lead.phone, '\\D', '', 'g')), c.phone_number_id, c.id
  from public.whatsapp_connections c where c.status = 'connected' order by c.connected_at desc nulls last limit 1
  returning id into v_conversation_id;
  if v_conversation_id is null then raise exception 'whatsapp connection unavailable' using errcode = 'P0002'; end if;
  insert into public.conversation_messages (conversation_id, author, actor_id, body, direction, message_origin, message_type, delivery_status)
  values (v_conversation_id, 'humano', auth.uid(), p_body, 'outbound', 'sunrise', 'template', 'pending');
  insert into public.lead_history (lead_id, actor_id, action, metadata) values (p_lead_id, auth.uid(), 'Conversa iniciada pelo CRM', jsonb_build_object('conversation_id', v_conversation_id, 'template_id', p_template_id));
  return v_conversation_id;
end; $$;

create or replace function public.sync_event_commissions(p_event_id uuid) returns void language plpgsql security definer set search_path = public as $$
declare v_quote_total integer; v_salesperson uuid; v_manager uuid; v_creator uuid; v_amount integer;
begin
  select q.total_amount_cents, l.responsible_id, s.management_commission_recipient_id, e.created_by into v_quote_total, v_salesperson, v_manager, v_creator
  from public.contracted_events e join public.quotes q on q.id = e.quote_id join public.leads l on l.id = e.lead_id cross join public.company_settings s
  where e.id = p_event_id;
  if v_quote_total is null then raise exception 'event not found' using errcode = 'P0002'; end if;
  v_amount := round(v_quote_total * 0.025);
  insert into public.contracted_event_costs (event_id, category, status, description, estimated_amount_cents, beneficiary_id, commission_kind, commission_rate_basis_points, commission_base_amount_cents, created_by)
  values (p_event_id, 'comissao', 'provisionada', 'Comissão comercial (2,5%)', v_amount, v_salesperson, 'comercial', 250, v_quote_total, v_creator)
  on conflict (event_id, commission_kind) where commission_kind is not null do update
    set estimated_amount_cents = excluded.estimated_amount_cents, commission_base_amount_cents = excluded.commission_base_amount_cents, beneficiary_id = excluded.beneficiary_id
    where public.contracted_event_costs.commission_locked_at is null and public.contracted_event_costs.status not in ('confirmado', 'pago');
  insert into public.contracted_event_costs (event_id, category, status, description, estimated_amount_cents, beneficiary_id, commission_kind, commission_rate_basis_points, commission_base_amount_cents, created_by)
  values (p_event_id, 'comissao', 'provisionada', 'Comissão de gerência (2,5%)', v_amount, v_manager, 'gerencia', 250, v_quote_total, v_creator)
  on conflict (event_id, commission_kind) where commission_kind is not null do update
    set estimated_amount_cents = excluded.estimated_amount_cents, commission_base_amount_cents = excluded.commission_base_amount_cents, beneficiary_id = excluded.beneficiary_id
    where public.contracted_event_costs.commission_locked_at is null and public.contracted_event_costs.status not in ('confirmado', 'pago');
end; $$;

create or replace function public.sync_event_commissions_on_event() returns trigger language plpgsql security definer set search_path = public as $$ begin perform public.sync_event_commissions(new.id); return new; end; $$;
drop trigger if exists contracted_events_create_commissions on public.contracted_events;
create trigger contracted_events_create_commissions after insert on public.contracted_events for each row execute function public.sync_event_commissions_on_event();

create or replace function public.sync_event_commissions_on_quote_total() returns trigger language plpgsql security definer set search_path = public as $$ begin if new.total_amount_cents is distinct from old.total_amount_cents then perform public.sync_event_commissions(e.id) from public.contracted_events e where e.quote_id = new.id; end if; return new; end; $$;
drop trigger if exists quotes_sync_event_commissions on public.quotes;
create trigger quotes_sync_event_commissions after update of total_amount_cents on public.quotes for each row execute function public.sync_event_commissions_on_quote_total();

create or replace function public.lock_event_commission_when_final() returns trigger language plpgsql security definer set search_path = public as $$ begin if new.commission_kind is not null and new.status in ('confirmado', 'pago') and old.status is distinct from new.status then new.commission_locked_at := coalesce(new.commission_locked_at, now()); if new.status = 'confirmado' then new.commission_approved_at := coalesce(new.commission_approved_at, now()); end if; end if; return new; end; $$;
drop trigger if exists contracted_event_costs_lock_commission on public.contracted_event_costs;
create trigger contracted_event_costs_lock_commission before update on public.contracted_event_costs for each row execute function public.lock_event_commission_when_final();

grant select, insert, update on public.crm_message_templates, public.crm_document_deliveries, public.conversation_read_receipts, public.user_notification_preferences to authenticated;
grant execute on function public.create_outbound_conversation(uuid, uuid, text) to authenticated;
grant execute on function public.sync_event_commissions(uuid) to authenticated;
