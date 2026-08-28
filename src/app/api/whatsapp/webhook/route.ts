import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseWhatsAppWebhook, sendWhatsAppText, verifyWhatsAppSignature, type WhatsAppHistoryChunk, type WhatsAppInboundText, type WhatsAppMessageEcho, type WhatsAppSyncedContact } from "@/lib/whatsapp";

export const runtime = "nodejs";

export function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (mode === "subscribe" && token && token === process.env.WHATSAPP_VERIFY_TOKEN && challenge) return new Response(challenge, { status: 200 });
  return new Response("Forbidden", { status: 403 });
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!verifyWhatsAppSignature(rawBody, request.headers.get("x-hub-signature-256"))) {
    console.warn("[whatsapp:webhook] rejected_invalid_signature");
    return new Response("Invalid signature", { status: 401 });
  }
  try {
    const payload = parseWhatsAppWebhook(JSON.parse(rawBody));
    console.info("[whatsapp:webhook] accepted", { messages: payload.messages.length, statuses: payload.statuses.length, echoes: payload.echoes.length, syncedContacts: payload.syncedContacts.length, historyChunks: payload.historyChunks.length });
    const supabase = createAdminClient();
    for (const status of payload.statuses) {
      const statusTime = new Date().toISOString();
      const timestamps = status.status === "delivered" ? { delivered_at: statusTime } : status.status === "read" ? { read_at: statusTime } : status.status === "failed" ? { failed_at: statusTime } : {};
      const { error } = await supabase.from("conversation_messages").update({ delivery_status: status.status, ...timestamps }).eq("external_message_id", status.messageId);
      if (error) throw new Error(`Falha ao atualizar status de entrega: ${error.message}`);
    }
    const outcomes = [];
    for (const message of payload.messages) outcomes.push(await receiveMessage(message));
    const echoOutcomes = [];
    for (const echo of payload.echoes) echoOutcomes.push(await receiveEcho(echo));
    const contactOutcomes = [];
    for (const contact of payload.syncedContacts) contactOutcomes.push(await syncContact(contact));
    let importedHistoryMessages = 0;
    for (const chunk of payload.historyChunks) importedHistoryMessages += await syncHistoryChunk(chunk);
    console.info("[whatsapp:webhook] completed", {
      messages: payload.messages.length,
      statuses: payload.statuses.length,
      echoes: payload.echoes.length,
      syncedContacts: payload.syncedContacts.length,
      historyChunks: payload.historyChunks.length,
      importedHistoryMessages,
      created: outcomes.filter((outcome) => outcome === "created").length,
      appended: outcomes.filter((outcome) => outcome === "appended").length,
      duplicates: [...outcomes, ...echoOutcomes].filter((outcome) => outcome === "duplicate").length,
      mirrored: echoOutcomes.filter((outcome) => outcome === "mirrored").length,
      contactsUpserted: contactOutcomes.filter((outcome) => outcome === "upserted").length,
      contactsRemoved: contactOutcomes.filter((outcome) => outcome === "removed").length,
    });
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[whatsapp:webhook] processing_failed", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ received: false }, { status: 500 });
  }
}

async function receiveMessage(message: WhatsAppInboundText) {
  const supabase = createAdminClient();
  const systemUserId = process.env.WHATSAPP_SYSTEM_USER_ID;
  if (!systemUserId) throw new Error("WHATSAPP_SYSTEM_USER_ID não configurado.");
  const { data: duplicate } = await supabase.from("conversation_messages").select("id").eq("external_message_id", message.messageId).maybeSingle();
  if (duplicate) return "duplicate" as const;
  const { data: existingLead } = await supabase.from("leads").select("id,status").eq("whatsapp_id", message.from).maybeSingle();
  let leadId = existingLead?.id;
  if (!leadId) {
    const { data: lead, error } = await supabase.from("leads").insert({ name: message.contactName?.trim() || "Contato WhatsApp", phone: `+${message.from}`, whatsapp_id: message.from, source: "WhatsApp", status: "novo", created_by: systemUserId }).select("id").single();
    if (error || !lead) throw new Error(error?.message ?? "Não foi possível criar o contato do WhatsApp.");
    leadId = lead.id;
  }
  const { data: latest } = await supabase.from("conversations").select("id,status,ai_paused").eq("channel", "whatsapp_cloud").eq("external_contact_id", message.from).order("updated_at", { ascending: false }).limit(1).maybeSingle();
  let conversation = latest;
  let createdConversation = false;
  if (!conversation || conversation.status === "encerrado") {
    const { data: created, error } = await supabase.from("conversations").insert({ lead_id: leadId, channel: "whatsapp_cloud", status: "ia_triagem", ai_paused: false, external_contact_id: message.from, external_phone_number_id: message.phoneNumberId, created_by: systemUserId }).select("id,status,ai_paused").single();
    if (error || !created) throw new Error(error?.message ?? "Não foi possível criar o atendimento.");
    conversation = created;
    createdConversation = true;
  }
  const createdAt = new Date(Number(message.timestamp) * 1000).toISOString();
  const { error: messageError } = await supabase.from("conversation_messages").insert({ conversation_id: conversation.id, author: "cliente", body: message.body, external_message_id: message.messageId, external_created_at: createdAt, delivery_status: "received", direction: "inbound", message_origin: "whatsapp_cloud", message_type: "text" });
  if (messageError) throw new Error(messageError.message);
  await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversation.id);
  if (createdConversation && !conversation.ai_paused && conversation.status === "ia_triagem") {
    const reply = "Olá! Sou a assistente virtual da Sunrise Celebrations. Vou coletar algumas informações iniciais para que nossa equipe possa preparar seu atendimento. Qual tipo de evento você está planejando?";
    try {
      const externalId = await sendWhatsAppText({ body: reply, phoneNumberId: message.phoneNumberId, to: message.from });
      const { error: replyError } = await supabase.from("conversation_messages").insert({ conversation_id: conversation.id, author: "ia", body: reply, external_message_id: externalId, delivery_status: "sent", direction: "outbound", message_origin: "sunrise", message_type: "text", sent_at: new Date().toISOString() });
      if (replyError) throw new Error(replyError.message);
    } catch (error) {
      console.warn("[whatsapp:webhook] auto_reply_failed", error instanceof Error ? error.message : "Unknown error");
      await supabase.from("conversations").update({ status: "aguardando_humano", needs_human: true, handoff_reason: "A resposta automática do WhatsApp não pôde ser enviada." }).eq("id", conversation.id);
      await supabase.from("conversation_messages").insert({ conversation_id: conversation.id, author: "sistema", body: "A mensagem do cliente foi recebida, mas a resposta automática não pôde ser enviada. Atendimento humano sinalizado." });
    }
  }
  return createdConversation ? "created" as const : "appended" as const;
}

async function receiveEcho(echo: WhatsAppMessageEcho) {
  const supabase = createAdminClient();
  const systemUserId = process.env.WHATSAPP_SYSTEM_USER_ID;
  if (!systemUserId) throw new Error("WHATSAPP_SYSTEM_USER_ID não configurado.");

  const { data: duplicate, error: duplicateError } = await supabase.from("conversation_messages").select("id").eq("external_message_id", echo.messageId).maybeSingle();
  if (duplicateError) throw new Error(duplicateError.message);
  if (duplicate) return "duplicate" as const;

  const { data: existingLead, error: leadLookupError } = await supabase.from("leads").select("id").eq("whatsapp_id", echo.to).maybeSingle();
  if (leadLookupError) throw new Error(leadLookupError.message);
  let leadId = existingLead?.id;
  if (!leadId) {
    const { data: lead, error } = await supabase.from("leads").insert({ name: "Contato WhatsApp", phone: `+${echo.to}`, whatsapp_id: echo.to, source: "WhatsApp", status: "em_atendimento", created_by: systemUserId }).select("id").single();
    if (error || !lead) throw new Error(error?.message ?? "Não foi possível criar o contato do WhatsApp Business.");
    leadId = lead.id;
  }

  const connectionId = await ensureWhatsAppConnection(echo.phoneNumberId, echo.wabaId);
  const { data: latest, error: conversationLookupError } = await supabase.from("conversations").select("id,status").eq("channel", "whatsapp_cloud").eq("external_contact_id", echo.to).order("updated_at", { ascending: false }).limit(1).maybeSingle();
  if (conversationLookupError) throw new Error(conversationLookupError.message);

  let conversationId = latest?.id;
  if (!conversationId || latest?.status === "encerrado") {
    const { data: created, error } = await supabase.from("conversations").insert({
      lead_id: leadId,
      channel: "whatsapp_cloud",
      status: "humano_assumiu",
      ai_paused: true,
      needs_human: false,
      external_contact_id: echo.to,
      external_phone_number_id: echo.phoneNumberId,
      whatsapp_connection_id: connectionId,
      created_by: systemUserId,
    }).select("id").single();
    if (error || !created) throw new Error(error?.message ?? "Não foi possível criar o atendimento iniciado no WhatsApp Business.");
    conversationId = created.id;
  } else {
    const { error } = await supabase.from("conversations").update({
      status: "humano_assumiu",
      ai_paused: true,
      needs_human: false,
      external_phone_number_id: echo.phoneNumberId,
      whatsapp_connection_id: connectionId,
      updated_at: new Date().toISOString(),
    }).eq("id", conversationId);
    if (error) throw new Error(error.message);
  }

  const createdAt = new Date(Number(echo.timestamp) * 1000).toISOString();
  const { error: messageError } = await supabase.from("conversation_messages").insert({
    conversation_id: conversationId,
    author: "humano",
    actor_id: null,
    body: echo.body,
    external_message_id: echo.messageId,
    external_created_at: createdAt,
    delivery_status: "sent",
    direction: "outbound",
    message_origin: "whatsapp_business_app",
    message_type: echo.messageType,
    media_id: echo.mediaId ?? null,
    media_mime_type: echo.mediaMimeType ?? null,
    media_filename: echo.mediaFilename ?? null,
    sent_at: createdAt,
  });
  if (messageError) throw new Error(messageError.message);
  return "mirrored" as const;
}

async function syncContact(contact: WhatsAppSyncedContact) {
  const supabase = createAdminClient();
  const connectionId = await ensureWhatsAppConnection(contact.phoneNumberId, contact.wabaId);
  const action = contact.action.toLowerCase();

  if (action.includes("delete") || action.includes("remove")) {
    const { error } = await supabase.from("whatsapp_contacts").delete().eq("phone_number_id", contact.phoneNumberId).eq("whatsapp_id", contact.whatsappId);
    if (error) throw new Error(`Falha ao remover contato sincronizado: ${error.message}`);
    return "removed" as const;
  }

  const syncedAt = contact.timestamp && /^\d+$/.test(contact.timestamp)
    ? new Date(Number(contact.timestamp) * 1000).toISOString()
    : new Date().toISOString();
  const { error } = await supabase.from("whatsapp_contacts").upsert({
    whatsapp_connection_id: connectionId,
    phone_number_id: contact.phoneNumberId,
    whatsapp_id: contact.whatsappId,
    full_name: contact.fullName ?? null,
    first_name: contact.firstName ?? null,
    sync_action: contact.action,
    last_synced_at: syncedAt,
  }, { onConflict: "phone_number_id,whatsapp_id" });
  if (error) throw new Error(`Falha ao salvar contato sincronizado: ${error.message}`);

  if (contact.fullName) {
    const { error: leadError } = await supabase.from("leads").update({ name: contact.fullName }).eq("whatsapp_id", contact.whatsappId).eq("name", "Contato WhatsApp");
    if (leadError) throw new Error(`Falha ao identificar contato comercial: ${leadError.message}`);
  }
  return "upserted" as const;
}

async function ensureWhatsAppConnection(phoneNumberId: string, wabaId?: string) {
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const { data: existing, error: lookupError } = await supabase.from("whatsapp_connections").select("id").eq("phone_number_id", phoneNumberId).maybeSingle();
  if (lookupError) throw new Error(`Falha ao localizar conexão do WhatsApp: ${lookupError.message}`);
  if (existing) {
    const connectionUpdate = wabaId ? { waba_id: wabaId, status: "connected", last_webhook_at: now } : { status: "connected", last_webhook_at: now };
    const { error } = await supabase.from("whatsapp_connections").update(connectionUpdate).eq("id", existing.id);
    if (error) throw new Error(`Falha ao atualizar conexão do WhatsApp: ${error.message}`);
    return existing.id;
  }
  const { data: created, error } = await supabase.from("whatsapp_connections").insert({ waba_id: wabaId ?? null, phone_number_id: phoneNumberId, mode: "coexistence", status: "connected", last_webhook_at: now, connected_at: now }).select("id").single();
  if (error || !created) throw new Error(error?.message ?? "Falha ao registrar conexão do WhatsApp.");
  return created.id;
}

async function syncHistoryChunk(chunk: WhatsAppHistoryChunk) {
  const supabase = createAdminClient();
  const connectionId = await ensureWhatsAppConnection(chunk.phoneNumberId, chunk.wabaId);
  const now = new Date().toISOString();

  if (chunk.declined) {
    const { error } = await supabase.from("whatsapp_connections").update({
      history_sync_status: "declined",
      last_history_sync_at: now,
      metadata: { history_error: chunk.errorMessage ?? "Compartilhamento de histórico desativado no WhatsApp Business." },
    }).eq("id", connectionId);
    if (error) throw new Error(`Falha ao registrar recusa do histórico: ${error.message}`);
    return 0;
  }

  const rows = chunk.messages.flatMap((message) => {
    const timestamp = Number(message.timestamp);
    if (!Number.isFinite(timestamp)) return [];
    return [{
      whatsapp_connection_id: connectionId,
      phone_number_id: chunk.phoneNumberId,
      contact_whatsapp_id: message.contactWhatsAppId,
      external_message_id: message.messageId,
      direction: message.direction,
      body: message.body,
      message_type: message.messageType,
      delivery_status: message.deliveryStatus ?? null,
      media_id: message.mediaId ?? null,
      media_mime_type: message.mediaMimeType ?? null,
      media_filename: message.mediaFilename ?? null,
      external_created_at: new Date(timestamp * 1000).toISOString(),
    }];
  });
  if (rows.length) {
    const { error } = await supabase.from("whatsapp_history_messages").upsert(rows, { onConflict: "external_message_id", ignoreDuplicates: true });
    if (error) throw new Error(`Falha ao importar histórico do WhatsApp: ${error.message}`);
  }

  const completed = chunk.progress === 100;
  const { error: progressError } = await supabase.from("whatsapp_connections").update({
    history_sync_status: completed ? "completed" : "in_progress",
    history_sync_phase: chunk.phase ?? null,
    history_sync_progress: chunk.progress ?? null,
    last_history_sync_at: now,
  }).eq("id", connectionId);
  if (progressError) throw new Error(`Falha ao atualizar progresso do histórico: ${progressError.message}`);
  return rows.length;
}
