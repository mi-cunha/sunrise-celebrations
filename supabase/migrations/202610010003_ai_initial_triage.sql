-- Atendimento inicial automatizado, auditável e limitado a conteúdo autorizado.
-- A IA nunca inicia conversas: esta estrutura só é acionada após uma mensagem inbound já persistida.

alter type public.conversation_status rename value 'ia_triagem' to 'ai';
alter type public.conversation_status rename value 'aguardando_humano' to 'awaiting_human';
alter type public.conversation_status rename value 'humano_assumiu' to 'human';
alter type public.conversation_status rename value 'encerrado' to 'closed';
alter type public.conversation_status add value if not exists 'paused_ai' before 'closed';

alter table public.conversations
  add column if not exists ai_started_at timestamptz,
  add column if not exists ai_transferred_at timestamptz,
  add column if not exists ai_paused_at timestamptz,
  add column if not exists ai_closed_at timestamptz;

update public.conversations
set ai_started_at = coalesce(ai_started_at, created_at)
where status = 'ai';

create table public.ai_knowledge_entries (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('apresentacao', 'institucional', 'faq', 'mini_wedding', 'transicao_humano')),
  title text not null check (char_length(title) between 2 and 140),
  body text not null check (char_length(body) between 2 and 6000),
  is_active boolean not null default true,
  version integer not null default 1 check (version > 0),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ai_knowledge_entry_history (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.ai_knowledge_entries(id) on delete cascade,
  version integer not null,
  title text not null,
  body text not null,
  is_active boolean not null,
  changed_by uuid references public.profiles(id) on delete set null,
  changed_at timestamptz not null default now()
);

create index ai_knowledge_entries_active_idx on public.ai_knowledge_entries (is_active, category, updated_at desc);
create index ai_knowledge_history_entry_idx on public.ai_knowledge_entry_history (entry_id, version desc);

create function public.touch_ai_knowledge_entry() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.title is distinct from old.title or new.body is distinct from old.body or new.is_active is distinct from old.is_active then
    new.version = old.version + 1;
  end if;
  new.updated_at = now();
  return new;
end;
$$;

create function public.capture_ai_knowledge_history() returns trigger
language plpgsql set search_path = public as $$
begin
  insert into public.ai_knowledge_entry_history(entry_id, version, title, body, is_active, changed_by)
  values (new.id, new.version, new.title, new.body, new.is_active, new.updated_by);
  return new;
end;
$$;

create trigger ai_knowledge_entries_touch before update on public.ai_knowledge_entries
for each row execute function public.touch_ai_knowledge_entry();
create trigger ai_knowledge_entries_history after insert or update on public.ai_knowledge_entries
for each row execute function public.capture_ai_knowledge_history();

alter table public.ai_knowledge_entries enable row level security;
alter table public.ai_knowledge_entry_history enable row level security;

create function public.can_manage_ai_knowledge() returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_permission('gerencia') or public.has_permission('admin_owner');
$$;

grant execute on function public.can_manage_ai_knowledge() to authenticated;

create policy "active users read active AI knowledge" on public.ai_knowledge_entries
for select to authenticated using (public.is_active_user());
create policy "AI managers create knowledge" on public.ai_knowledge_entries
for insert to authenticated with check (public.can_manage_ai_knowledge() and created_by = auth.uid() and updated_by = auth.uid());
create policy "AI managers update knowledge" on public.ai_knowledge_entries
for update to authenticated using (public.can_manage_ai_knowledge()) with check (public.can_manage_ai_knowledge() and updated_by = auth.uid());
create policy "AI managers read knowledge history" on public.ai_knowledge_entry_history
for select to authenticated using (public.can_manage_ai_knowledge());

create table public.conversation_ai_triage (
  conversation_id uuid primary key references public.conversations(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  identified_event_type text,
  desired_period text,
  guest_count integer check (guest_count is null or guest_count > 0),
  observations text,
  intent text,
  missing_data text[] not null default '{}',
  conversation_summary text,
  suggested_next_action text,
  confidence numeric(4,3) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  handoff_reason text,
  ai_status public.conversation_status not null default 'ai',
  started_at timestamptz not null default now(),
  transferred_at timestamptz,
  paused_at timestamptz,
  closed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.conversation_ai_turns (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  inbound_message_id uuid not null unique references public.conversation_messages(id) on delete cascade,
  provider text not null,
  model text,
  instruction_version text not null,
  decision text not null check (decision in ('respond', 'handoff', 'skipped', 'failed')),
  confidence numeric(4,3) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  response_body text,
  extracted_data jsonb not null default '{}'::jsonb,
  handoff_reason text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.conversation_messages add column if not exists automation_key text;
create unique index if not exists conversation_messages_automation_key_unique
on public.conversation_messages (automation_key) where automation_key is not null;

alter table public.conversation_ai_triage enable row level security;
alter table public.conversation_ai_turns enable row level security;
create policy "active users read AI triage" on public.conversation_ai_triage
for select to authenticated using (public.is_active_user());
create policy "AI managers read turn audit" on public.conversation_ai_turns
for select to authenticated using (public.can_manage_ai_knowledge());

insert into public.ai_knowledge_entries(category, title, body)
values
  ('apresentacao', 'Apresentação da assistente', 'Você está falando com a assistente virtual da Sunrise Celebrations. Posso registrar as informações iniciais do evento e encaminhar o atendimento para a equipe quando necessário.'),
  ('institucional', 'Atuação da Sunrise', 'A Sunrise Celebrations realiza experiências e celebrações. Informações sobre preço, disponibilidade, estrutura, equipe e condições são confirmadas exclusivamente por uma pessoa da equipe.'),
  ('mini_wedding', 'Mini Wedding', 'O Mini Wedding é uma experiência intimista para até 50 convidados, em dias e horários selecionados, com a Sunrise funcionando normalmente. A equipe confirma os detalhes aplicáveis a cada caso.'),
  ('transicao_humano', 'Transferência segura', 'Perfeito, já registrei suas informações. Vou encaminhar seu atendimento para nossa equipe, que dará continuidade por aqui.')
on conflict do nothing;

-- A mensagem inbound é registrada antes deste ponto. Conversas novas entram em IA;
-- conversas existentes nunca são reativadas automaticamente.
create or replace function public.ingest_whatsapp_message(p_message jsonb, p_actor uuid)
returns text language plpgsql set search_path = '' as $$
declare
  v_lead uuid; v_conversation uuid; v_connection uuid;
  v_contact text := p_message->>'contact';
  v_phone text := p_message->>'phone';
  v_echo boolean := coalesce((p_message->>'echo')::boolean, false);
begin
  perform pg_advisory_xact_lock(hashtextextended('whatsapp:' || v_contact, 0));
  if exists (select 1 from public.conversation_messages where external_message_id = p_message->>'id') then return 'duplicate'; end if;
  if not exists(select 1 from public.profiles where id = p_actor and is_active) then raise exception 'Inactive system profile'; end if;
  select id into v_connection from public.whatsapp_connections where phone_number_id = v_phone;
  if v_connection is null then raise exception 'Unknown WhatsApp connection'; end if;
  select id into v_lead from public.leads where whatsapp_id = v_contact;
  if v_lead is null then
    insert into public.leads(name,phone,whatsapp_id,source,status,created_by)
    values(case when length(trim(p_message->>'name')) >= 2 then left(trim(p_message->>'name'),120) else 'Contato WhatsApp' end, '+' || v_contact,v_contact,'WhatsApp','novo',p_actor)
    returning id into v_lead;
  end if;
  select id into v_conversation from public.conversations
    where channel = 'whatsapp_cloud' and external_phone_number_id = v_phone
    and external_contact_id = v_contact and status <> 'closed'
    order by updated_at desc limit 1;
  if v_conversation is null then
    insert into public.conversations(lead_id,channel,status,ai_paused,needs_human,ai_started_at,external_contact_id,external_phone_number_id,whatsapp_connection_id,created_by)
    values(v_lead,'whatsapp_cloud','ai',false,false,now(),v_contact,v_phone,v_connection,p_actor)
    returning id into v_conversation;
    insert into public.conversation_ai_triage(conversation_id,lead_id,ai_status) values(v_conversation,v_lead,'ai');
  end if;
  insert into public.conversation_messages(conversation_id,author,body,external_message_id,external_created_at,delivery_status,direction,message_origin,message_type,media_id,media_mime_type,media_filename,sent_at)
  values(v_conversation,case when v_echo then 'humano'::public.conversation_message_author else 'cliente'::public.conversation_message_author end,
    p_message->>'body',p_message->>'id',to_timestamp((p_message->>'timestamp')::double precision),
    case when v_echo then 'sent' else 'received' end,case when v_echo then 'outbound' else 'inbound' end,
    case when v_echo then 'whatsapp_business_app' else 'whatsapp_cloud' end,
    coalesce(p_message->>'type','text'),p_message->>'mediaId',p_message->>'mimeType',p_message->>'filename',
    case when v_echo then to_timestamp((p_message->>'timestamp')::double precision) else null end);
  if v_echo then
    update public.conversations set ai_paused = true, ai_paused_at = now(), status = 'human', needs_human = false,
      whatsapp_connection_id = v_connection, updated_at = now() where id = v_conversation;
    update public.conversation_ai_triage set ai_status = 'human', paused_at = coalesce(paused_at, now()), updated_at = now() where conversation_id = v_conversation;
  else
    update public.conversations set whatsapp_connection_id = v_connection, updated_at = now() where id = v_conversation;
  end if;
  return case when v_echo then 'mirrored' else 'appended' end;
end;
$$;

revoke all on function public.ingest_whatsapp_message(jsonb,uuid) from public, anon, authenticated;
grant execute on function public.ingest_whatsapp_message(jsonb,uuid) to service_role;
