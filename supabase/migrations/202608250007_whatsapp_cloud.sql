-- Fase 4: metadados idempotentes para WhatsApp Business Platform (Cloud API).
alter table public.leads add column if not exists whatsapp_id text;
create unique index if not exists leads_whatsapp_id_unique on public.leads (whatsapp_id) where whatsapp_id is not null;

alter table public.conversations add column if not exists external_contact_id text;
alter table public.conversations add column if not exists external_phone_number_id text;
create index if not exists conversations_whatsapp_contact_idx on public.conversations (channel, external_contact_id, updated_at desc);

alter table public.conversation_messages add column if not exists external_message_id text;
alter table public.conversation_messages add column if not exists delivery_status text;
alter table public.conversation_messages add column if not exists external_created_at timestamptz;
create unique index if not exists conversation_messages_external_id_unique on public.conversation_messages (external_message_id) where external_message_id is not null;
