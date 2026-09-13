import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseWhatsAppWebhook, verifyWhatsAppSignature, type WhatsAppHistoryChunk, type WhatsAppInboundText, type WhatsAppMessageEcho, type WhatsAppSyncedContact } from "@/lib/whatsapp";

export const runtime = "nodejs";
export const maxDuration = 60;

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
  if (!verifyWhatsAppSignature(rawBody, request.headers.get("x-hub-signature-256"))) return new Response("Invalid signature", { status: 401 });
  const eventKey = createHash("sha256").update(rawBody).digest("hex");
  const supabase = createAdminClient();
  try {
    const allowedPhone = process.env.WHATSAPP_ALLOWED_PHONE_NUMBER_ID;
    const allowedWaba = process.env.WHATSAPP_ALLOWED_WABA_ID;
    if (!allowedPhone || !allowedWaba) throw new Error("WhatsApp allowlist missing");
    const payload = parseWhatsAppWebhook(JSON.parse(rawBody));
    const { error: receiptError } = await supabase.from("whatsapp_webhook_events").upsert({ event_key: eventKey, event_type: "whatsapp_payload" }, { onConflict: "event_key", ignoreDuplicates: true });
    if (receiptError) throw new Error("Receipt persistence failed");
    const { data: receipt, error: lookupError } = await supabase.from("whatsapp_webhook_events").select("processing_status").eq("event_key", eventKey).single();
    if (lookupError) throw new Error("Receipt lookup failed");
    if (receipt?.processing_status === "processed") return NextResponse.json({ received: true, duplicate: true });
    const allowed = (item: { phoneNumberId: string; wabaId?: string }) => item.phoneNumberId === allowedPhone && item.wabaId === allowedWaba;
    for (const message of payload.messages.filter(allowed)) await receiveMessage(message);
    for (const echo of payload.echoes.filter(allowed)) await receiveEcho(echo);
    for (const status of payload.statuses.filter((item) => item.phoneNumberId === allowedPhone)) {
      const { error } = await supabase.rpc("apply_whatsapp_status", { p_id: status.messageId, p_phone: status.phoneNumberId, p_status: status.status, p_at: status.timestamp ? new Date(Number(status.timestamp) * 1000).toISOString() : new Date().toISOString() });
      if (error) throw new Error("Delivery status update failed");
    }
    for (const contact of payload.syncedContacts.filter(allowed)) await syncContact(contact);
    for (const chunk of payload.historyChunks.filter(allowed)) await syncHistoryChunk(chunk);
    for (const update of payload.accountUpdates) {
      if (update.wabaId !== allowedWaba || !["PARTNER_REMOVED", "ACCOUNT_OFFBOARDED"].includes(update.event)) continue;
      const { error } = await supabase.from("whatsapp_connections").update({ status: "disconnected", business_app_state: update.event, last_webhook_at: new Date().toISOString() }).eq("waba_id", allowedWaba);
      if (error) throw new Error("Account update failed");
    }
    const { error } = await supabase.from("whatsapp_webhook_events").update({ processing_status: "processed", processed_at: new Date().toISOString(), last_error: null }).eq("event_key", eventKey);
    if (error) throw new Error("Receipt completion failed");
    return NextResponse.json({ received: true });
  } catch {
    // Do not persist raw payloads, customer data, tokens or Graph errors in telemetry.
    await supabase.from("whatsapp_webhook_events").update({ processing_status: "failed", last_error: "processing_failed" }).eq("event_key", eventKey);
    console.error("[whatsapp:webhook] processing_failed", { eventKey });
    // Meta retries; ingestion is transactional and imports are idempotent.
    return NextResponse.json({ received: false }, { status: 500 });
  }
}

async function receiveMessage(message: WhatsAppInboundText) {
  await ensureWhatsAppConnection(message.phoneNumberId, message.wabaId);
  return ingestMessage({
    contact: message.from, phone: message.phoneNumberId, id: message.messageId,
    name: message.contactName, body: message.body, timestamp: message.timestamp, echo: false,
    type: message.messageType ?? "text", mediaId: message.mediaId,
    mimeType: message.mediaMimeType, filename: message.mediaFilename,
  });
}

async function receiveEcho(echo: WhatsAppMessageEcho) {
  await ensureWhatsAppConnection(echo.phoneNumberId, echo.wabaId);
  return ingestMessage({
    contact: echo.to, phone: echo.phoneNumberId, id: echo.messageId,
    body: echo.body, timestamp: echo.timestamp, echo: true, type: echo.messageType,
    mediaId: echo.mediaId, mimeType: echo.mediaMimeType, filename: echo.mediaFilename,
  });
}

async function ingestMessage(message: Record<string, unknown>) {
  const systemUserId = process.env.WHATSAPP_SYSTEM_USER_ID;
  if (!systemUserId) throw new Error("System profile missing");
  const { data, error } = await createAdminClient().rpc("ingest_whatsapp_message", { p_message: message, p_actor: systemUserId });
  if (error) throw new Error("Atomic message ingestion failed");
  return data;
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
    const connectionUpdate = wabaId ? { waba_id: wabaId, last_webhook_at: now } : { last_webhook_at: now };
    const { error } = await supabase.from("whatsapp_connections").update(connectionUpdate).eq("id", existing.id);
    if (error) throw new Error(`Falha ao atualizar conexão do WhatsApp: ${error.message}`);
    return existing.id;
  }
  const { data: created, error } = await supabase.from("whatsapp_connections").insert({ waba_id: wabaId ?? null, phone_number_id: phoneNumberId, mode: "coexistence", status: "pending", last_webhook_at: now }).select("id").single();
  if (error?.code === "23505") return ensureWhatsAppConnection(phoneNumberId, wabaId);
  if (error || !created) throw new Error("Falha ao registrar conexão do WhatsApp.");
  return created.id;
}

async function syncHistoryChunk(chunk: WhatsAppHistoryChunk) {
  const supabase = createAdminClient();
  const connectionId = await ensureWhatsAppConnection(chunk.phoneNumberId, chunk.wabaId);
  const now = new Date().toISOString();

  if (chunk.declined || chunk.errorCode || chunk.errorMessage) {
    const { error } = await supabase.from("whatsapp_connections").update({
      history_sync_status: chunk.declined ? "declined" : "error",
      last_history_sync_at: now,
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
  for (let offset = 0; offset < rows.length; offset += 200) {
    const { error } = await supabase.from("whatsapp_history_messages").upsert(rows.slice(offset, offset + 200), { onConflict: "external_message_id", ignoreDuplicates: true });
    if (error) throw new Error(`Falha ao importar histórico do WhatsApp: ${error.message}`);
  }

  const { error: progressError } = await supabase.rpc("advance_whatsapp_history", { p_connection: connectionId, p_phase: chunk.phase ?? null, p_progress: chunk.progress ?? null });
  if (progressError) throw new Error("History progress update failed");
  return rows.length;
}
