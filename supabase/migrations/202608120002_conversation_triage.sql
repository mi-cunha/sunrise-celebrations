create type public.conversation_status as enum ('ia_triagem', 'aguardando_humano', 'humano_assumiu', 'encerrado');
create type public.conversation_message_author as enum ('cliente', 'ia', 'humano', 'sistema');

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  channel text not null default 'whatsapp_simulado',
  status public.conversation_status not null default 'ia_triagem',
  ai_paused boolean not null default false,
  needs_human boolean not null default false,
  handoff_reason text check (handoff_reason is null or char_length(handoff_reason) <= 500),
  assigned_to uuid references public.profiles(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  author public.conversation_message_author not null,
  actor_id uuid references public.profiles(id) on delete set null,
  body text not null check (char_length(trim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index conversations_status_created_at_idx on public.conversations (status, created_at desc);
create index conversations_lead_id_idx on public.conversations (lead_id);
create index conversation_messages_conversation_created_at_idx on public.conversation_messages (conversation_id, created_at);

alter table public.conversations enable row level security;
alter table public.conversation_messages enable row level security;

create policy "active users read conversations" on public.conversations for select to authenticated using (public.is_active_user());
create policy "lead managers create conversations" on public.conversations for insert to authenticated with check (public.has_permission('atendimento') and created_by = auth.uid());
create policy "lead managers update conversations" on public.conversations for update to authenticated using (public.has_permission('atendimento')) with check (public.has_permission('atendimento'));

create policy "active users read conversation messages" on public.conversation_messages for select to authenticated using (public.is_active_user());
create policy "lead managers create conversation messages" on public.conversation_messages for insert to authenticated with check (public.has_permission('atendimento') and (actor_id is null or actor_id = auth.uid()));

create trigger conversations_touch_updated_at before update on public.conversations for each row execute function public.touch_updated_at();
