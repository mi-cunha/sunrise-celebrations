begin;
set local lock_timeout = '5s';

-- Real inbound messages and routing identifiers may only be created by the backend.
create policy "real whatsapp conversations server only" on public.conversations
  as restrictive for insert to authenticated with check(channel <> 'whatsapp_cloud');
create policy "real whatsapp messages cannot be forged" on public.conversation_messages
  as restrictive for insert to authenticated with check (
    not exists(select 1 from public.conversations c where c.id = conversation_id and c.channel = 'whatsapp_cloud')
    or (author in ('humano','sistema') and external_created_at is null
      and direction = 'internal' and message_origin = 'sunrise'
      and ((external_message_id is null and delivery_status is null)
        -- Compatibility with the deployed sender: it saves the accepted wamid
        -- using the attendant session, without direction/origin metadata.
        or (author = 'humano' and actor_id = auth.uid() and external_message_id is not null and delivery_status = 'sent')))
  );
create function public.protect_whatsapp_routing() returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user in ('anon','authenticated') and
    (new.channel is distinct from old.channel or new.external_phone_number_id is distinct from old.external_phone_number_id
      or new.external_contact_id is distinct from old.external_contact_id or new.whatsapp_connection_id is distinct from old.whatsapp_connection_id) then
    raise exception 'WhatsApp routing is server managed';
  end if;
  return new;
end;
$$;
create trigger protect_whatsapp_routing before update on public.conversations for each row execute function public.protect_whatsapp_routing();

-- Credentials are encrypted by the server and inaccessible even to CRM administrators.
create table public.whatsapp_connection_credentials (
  connection_id uuid primary key references public.whatsapp_connections(id) on delete cascade,
  app_id text not null,
  encrypted_token text not null,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.whatsapp_connection_credentials enable row level security;
revoke all on public.whatsapp_connection_credentials from anon, authenticated;
grant all on public.whatsapp_connection_credentials to service_role;

-- A reservation is durable before the one-shot request. Unknown outcomes are NOT retried.
alter table public.whatsapp_connections add column onboarding_id uuid not null default gen_random_uuid();
create table public.whatsapp_sync_requests (
  connection_id uuid not null references public.whatsapp_connections(id) on delete cascade,
  onboarding_id uuid not null,
  sync_type text not null check (sync_type in ('smb_app_state_sync', 'history')),
  status text not null check (status in ('requesting', 'accepted', 'failed', 'unknown')),
  request_id text,
  requested_at timestamptz not null default now(),
  error_code integer,
  primary key (connection_id, onboarding_id, sync_type)
);
alter table public.whatsapp_sync_requests enable row level security;
revoke all on public.whatsapp_sync_requests from anon, authenticated;
grant all on public.whatsapp_sync_requests to service_role;

-- Receipt and message creation are one transaction. Serialize by customer to avoid
-- duplicate leads and parallel open conversations on Meta webhook retries.
create function public.ingest_whatsapp_message(p_message jsonb, p_actor uuid)
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
    and external_contact_id = v_contact and status <> 'encerrado'
    order by updated_at desc limit 1;
  if v_conversation is null then
    insert into public.conversations(lead_id,channel,status,ai_paused,needs_human,external_contact_id,external_phone_number_id,whatsapp_connection_id,created_by)
    values(v_lead,'whatsapp_cloud','aguardando_humano',true,true,v_contact,v_phone,v_connection,p_actor)
    returning id into v_conversation;
  end if;
  insert into public.conversation_messages(conversation_id,author,body,external_message_id,external_created_at,delivery_status,direction,message_origin,message_type,media_id,media_mime_type,media_filename,sent_at)
  values(v_conversation,case when v_echo then 'humano'::public.conversation_message_author else 'cliente'::public.conversation_message_author end,
    p_message->>'body',p_message->>'id',to_timestamp((p_message->>'timestamp')::double precision),
    case when v_echo then 'sent' else 'received' end,case when v_echo then 'outbound' else 'inbound' end,
    case when v_echo then 'whatsapp_business_app' else 'whatsapp_cloud' end,
    coalesce(p_message->>'type','text'),p_message->>'mediaId',p_message->>'mimeType',p_message->>'filename',
    case when v_echo then to_timestamp((p_message->>'timestamp')::double precision) else null end);
  update public.conversations set ai_paused = true, updated_at = now(), whatsapp_connection_id = v_connection,
    status = case when v_echo then 'humano_assumiu'::public.conversation_status else status end,
    needs_human = case when v_echo then false else needs_human end
    where id = v_conversation;
  return case when v_echo then 'mirrored' else 'appended' end;
end;
$$;
revoke all on function public.ingest_whatsapp_message(jsonb,uuid) from public, anon, authenticated;
grant execute on function public.ingest_whatsapp_message(jsonb,uuid) to service_role;

create table public.whatsapp_delivery_events (
  message_id text not null,
  phone_number_id text not null,
  status text not null check(status in ('sent','delivered','read','failed')),
  occurred_at timestamptz not null,
  primary key(message_id,phone_number_id,status)
);
alter table public.whatsapp_delivery_events enable row level security;
revoke all on public.whatsapp_delivery_events from anon, authenticated;
grant all on public.whatsapp_delivery_events to service_role;

-- Also retains callbacks arriving before the sending request has saved its wamid.
create function public.apply_whatsapp_status(p_id text, p_phone text, p_status text, p_at timestamptz)
returns void language plpgsql set search_path = '' as $$
begin
  if p_status not in ('sent','delivered','read','failed') then return; end if;
  perform pg_advisory_xact_lock(hashtextextended('wa-status:' || p_id, 0));
  insert into public.whatsapp_delivery_events values(p_id,p_phone,p_status,p_at) on conflict do nothing;
  select status into p_status from public.whatsapp_delivery_events where message_id = p_id and phone_number_id = p_phone
    order by case status when 'read' then 4 when 'delivered' then 3 when 'failed' then 2 else 1 end desc limit 1;
  select occurred_at into p_at from public.whatsapp_delivery_events where message_id = p_id and phone_number_id = p_phone and status = p_status;
  update public.conversation_messages m set
    delivery_status = case
      when m.delivery_status = 'read' then 'read'
      when m.delivery_status = 'delivered' and p_status <> 'read' then 'delivered'
      when m.delivery_status = 'failed' and p_status = 'sent' then 'failed'
      else p_status end,
    sent_at = coalesce(m.sent_at,(select occurred_at from public.whatsapp_delivery_events where message_id=p_id and phone_number_id=p_phone and status='sent')),
    delivered_at = coalesce(m.delivered_at,(select occurred_at from public.whatsapp_delivery_events where message_id=p_id and phone_number_id=p_phone and status='delivered')),
    read_at = coalesce(m.read_at,(select occurred_at from public.whatsapp_delivery_events where message_id=p_id and phone_number_id=p_phone and status='read')),
    failed_at = coalesce(m.failed_at,(select occurred_at from public.whatsapp_delivery_events where message_id=p_id and phone_number_id=p_phone and status='failed'))
  from public.conversations c where c.id = m.conversation_id
    and c.external_phone_number_id = p_phone and m.external_message_id = p_id;
end;
$$;
revoke all on function public.apply_whatsapp_status(text,text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.apply_whatsapp_status(text,text,text,timestamptz) to service_role;

create function public.advance_whatsapp_history(p_connection uuid, p_phase integer, p_progress integer)
returns void language sql set search_path = '' as $$
  update public.whatsapp_connections set
    history_sync_status = case when greatest(history_sync_progress,p_progress) = 100 then 'completed' else 'in_progress' end,
    history_sync_phase = greatest(history_sync_phase,p_phase),
    history_sync_progress = greatest(history_sync_progress,p_progress),
    last_history_sync_at = now()
  where id = p_connection;
$$;
revoke all on function public.advance_whatsapp_history(uuid,integer,integer) from public, anon, authenticated;
grant execute on function public.advance_whatsapp_history(uuid,integer,integer) to service_role;

commit;
