-- Histórico importado do WhatsApp Business App, separado do CRM operacional.

begin;

alter table public.whatsapp_connections
  add column if not exists history_sync_status text not null default 'pending'
    check (history_sync_status in ('pending', 'in_progress', 'completed', 'declined', 'error')),
  add column if not exists history_sync_phase integer,
  add column if not exists history_sync_progress integer
    check (history_sync_progress is null or history_sync_progress between 0 and 100);

create table public.whatsapp_history_messages (
  id uuid primary key default gen_random_uuid(),
  whatsapp_connection_id uuid references public.whatsapp_connections(id) on delete cascade,
  phone_number_id text not null,
  contact_whatsapp_id text not null,
  external_message_id text not null,
  direction text not null check (direction in ('inbound', 'outbound')),
  body text not null check (char_length(trim(body)) between 1 and 4000),
  message_type text not null default 'text',
  delivery_status text,
  media_id text,
  media_mime_type text,
  media_filename text,
  external_created_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (char_length(trim(phone_number_id)) > 0),
  check (char_length(trim(contact_whatsapp_id)) > 0)
);

create unique index whatsapp_history_messages_external_id_unique
  on public.whatsapp_history_messages (external_message_id);

create index whatsapp_history_messages_contact_time_idx
  on public.whatsapp_history_messages (phone_number_id, contact_whatsapp_id, external_created_at);

alter table public.whatsapp_history_messages enable row level security;

create policy "attendants read whatsapp history"
  on public.whatsapp_history_messages
  for select
  to authenticated
  using (public.has_permission('atendimento'));

commit;
