-- Fundação para WhatsApp Coexistence.
-- Mantém credenciais fora do banco e prepara estado da conexão, histórico,
-- ecos do WhatsApp Business e processamento idempotente de webhooks.

begin;

create table public.whatsapp_connections (
  id uuid primary key default gen_random_uuid(),
  waba_id text,
  phone_number_id text,
  display_phone_number text,
  mode text not null default 'coexistence'
    check (mode in ('cloud_api', 'coexistence')),
  status text not null default 'pending'
    check (status in ('pending', 'connected', 'disconnected', 'error')),
  business_app_state text,
  last_webhook_at timestamptz,
  last_history_sync_at timestamptz,
  connected_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (waba_id is null or char_length(trim(waba_id)) > 0),
  check (phone_number_id is null or char_length(trim(phone_number_id)) > 0)
);

create unique index whatsapp_connections_phone_number_id_unique
  on public.whatsapp_connections (phone_number_id)
  where phone_number_id is not null;

create index whatsapp_connections_status_idx
  on public.whatsapp_connections (status, updated_at desc);

alter table public.whatsapp_connections enable row level security;

create policy "managers read whatsapp connections"
  on public.whatsapp_connections
  for select
  to authenticated
  using (public.has_permission('gerencia'));

create trigger whatsapp_connections_touch_updated_at
  before update on public.whatsapp_connections
  for each row execute function public.touch_updated_at();

alter table public.conversations
  add column if not exists whatsapp_connection_id uuid
    references public.whatsapp_connections(id) on delete set null;

create index if not exists conversations_whatsapp_connection_idx
  on public.conversations (whatsapp_connection_id, updated_at desc)
  where whatsapp_connection_id is not null;

alter table public.conversation_messages
  add column if not exists direction text not null default 'internal'
    check (direction in ('inbound', 'outbound', 'internal')),
  add column if not exists message_origin text not null default 'sunrise'
    check (message_origin in ('whatsapp_cloud', 'whatsapp_business_app', 'history', 'sunrise')),
  add column if not exists message_type text not null default 'text'
    check (message_type in (
      'text', 'image', 'audio', 'video', 'document', 'location',
      'contacts', 'sticker', 'template', 'interactive', 'system', 'unsupported'
    )),
  add column if not exists is_history boolean not null default false,
  add column if not exists reply_to_external_message_id text,
  add column if not exists media_id text,
  add column if not exists media_mime_type text,
  add column if not exists media_filename text,
  add column if not exists sent_at timestamptz,
  add column if not exists delivered_at timestamptz,
  add column if not exists read_at timestamptz,
  add column if not exists failed_at timestamptz,
  add column if not exists failure_reason text;

update public.conversation_messages
set
  direction = case
    when author = 'cliente' then 'inbound'
    when author in ('ia', 'humano') then 'outbound'
    else 'internal'
  end,
  message_origin = case
    when author = 'cliente' and external_message_id is not null then 'whatsapp_cloud'
    else 'sunrise'
  end,
  message_type = case when author = 'sistema' then 'system' else 'text' end,
  sent_at = case
    when author in ('ia', 'humano') then coalesce(external_created_at, created_at)
    else sent_at
  end;

create index conversation_messages_direction_time_idx
  on public.conversation_messages (
    conversation_id,
    direction,
    coalesce(external_created_at, created_at)
  );

create index conversation_messages_origin_idx
  on public.conversation_messages (message_origin, is_history, created_at desc);

create table public.whatsapp_webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null,
  event_type text not null,
  processing_status text not null default 'pending'
    check (processing_status in ('pending', 'processed', 'ignored', 'failed')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(trim(event_key)) > 0),
  check (char_length(trim(event_type)) > 0)
);

create unique index whatsapp_webhook_events_event_key_unique
  on public.whatsapp_webhook_events (event_key);

create index whatsapp_webhook_events_processing_idx
  on public.whatsapp_webhook_events (processing_status, received_at desc);

alter table public.whatsapp_webhook_events enable row level security;

create policy "managers read whatsapp webhook events"
  on public.whatsapp_webhook_events
  for select
  to authenticated
  using (public.has_permission('gerencia'));

create trigger whatsapp_webhook_events_touch_updated_at
  before update on public.whatsapp_webhook_events
  for each row execute function public.touch_updated_at();

commit;
