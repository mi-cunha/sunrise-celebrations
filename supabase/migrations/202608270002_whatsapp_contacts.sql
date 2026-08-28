-- Contatos sincronizados pelo WhatsApp Business App.
-- Permanecem separados dos contatos comerciais até existir atendimento.

begin;

create table public.whatsapp_contacts (
  id uuid primary key default gen_random_uuid(),
  whatsapp_connection_id uuid references public.whatsapp_connections(id) on delete cascade,
  phone_number_id text not null,
  whatsapp_id text not null,
  full_name text,
  first_name text,
  sync_action text not null default 'upsert',
  last_synced_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(trim(phone_number_id)) > 0),
  check (char_length(trim(whatsapp_id)) > 0),
  check (full_name is null or char_length(full_name) <= 200),
  check (first_name is null or char_length(first_name) <= 100)
);

create unique index whatsapp_contacts_number_unique
  on public.whatsapp_contacts (phone_number_id, whatsapp_id);

create index whatsapp_contacts_name_idx
  on public.whatsapp_contacts (full_name, first_name);

alter table public.whatsapp_contacts enable row level security;

create policy "attendants read whatsapp contacts"
  on public.whatsapp_contacts
  for select
  to authenticated
  using (public.has_permission('atendimento'));

create trigger whatsapp_contacts_touch_updated_at
  before update on public.whatsapp_contacts
  for each row execute function public.touch_updated_at();

commit;
