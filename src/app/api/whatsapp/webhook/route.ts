import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseWhatsAppWebhook, sendWhatsAppText, verifyWhatsAppSignature, type WhatsAppInboundText, type WhatsAppMessageEcho } from "@/lib/whatsapp";

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
    console.info("[whatsapp:webhook] accepted", { messages: payload.messages.length, statuses: payload.statuses.length, echoes: payload.echoes.length });
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
    console.info("[whatsapp:webhook] completed", {
      messages: payload.messages.length,
      statuses: payload.statuses.length,
      echoes: payload.echoes.length,
      created: outcomes.filter((outcome) => outcome === "created").length,
      appended: outcomes.filter((outcome) => outcome === "appended").length,
      duplicates: [...outcomes, ...echoOutcomes].filter((outcome) => outcome === "duplicate").length,
      mirrored: echoOutcomes.filter((outcome) => outcome === "mirrored").length,
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

  const { data: connection } = await supabase.from("whatsapp_connections").select("id").eq("phone_number_id", echo.phoneNumberId).maybeSingle();
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
      whatsapp_connection_id: connection?.id ?? null,
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
      whatsapp_connection_id: connection?.id ?? null,
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
