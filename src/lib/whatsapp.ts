import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const timestampSchema = z.string().regex(/^\d+$/).refine((value) => Number(value) > 0 && Number(value) < 253402300800);
const messageEchoSchema = z.object({
  from: z.string().min(5),
  to: z.string().min(5),
  id: z.string().min(5),
  timestamp: timestampSchema,
  type: z.string().min(1),
  text: z.object({ body: z.string().trim().min(1).max(4096) }).optional(),
  image: z.object({ id: z.string().optional(), mime_type: z.string().optional(), caption: z.string().max(4000).optional() }).optional(),
  audio: z.object({ id: z.string().optional(), mime_type: z.string().optional() }).optional(),
  video: z.object({ id: z.string().optional(), mime_type: z.string().optional(), caption: z.string().max(4000).optional() }).optional(),
  document: z.object({ id: z.string().optional(), mime_type: z.string().optional(), filename: z.string().optional(), caption: z.string().max(4000).optional() }).optional(),
}).passthrough();
const stateSyncContactSchema = z.object({
  type: z.literal("contact"),
  contact: z.object({
    full_name: z.string().trim().max(200).optional(),
    first_name: z.string().trim().max(100).optional(),
    phone_number: z.string().min(5),
  }),
  action: z.string().min(1).max(50),
  metadata: z.object({ timestamp: z.string() }).optional(),
}).passthrough();
const historyMessageSchema = messageEchoSchema.extend({
  to: z.string().min(5).optional(),
  history_context: z.object({ status: z.string().optional() }).optional(),
});
const historyChunkSchema = z.object({
  metadata: z.object({
    phase: z.number().int().min(0).optional(),
    chunk_order: z.number().int().min(0).optional(),
    progress: z.number().int().min(0).max(100).optional(),
  }).optional(),
  threads: z.array(z.object({
    id: z.string().min(5),
    messages: z.array(z.unknown()).optional(),
  })).optional(),
  errors: z.array(z.object({ code: z.number().optional(), title: z.string().optional(), message: z.string().optional() }).passthrough()).optional(),
}).passthrough();
const webhookSchema = z.object({
  object: z.literal("whatsapp_business_account"),
  entry: z.array(z.object({ id: z.string().optional(), changes: z.array(z.object({ field: z.string().optional(), value: z.object({
    metadata: z.object({ phone_number_id: z.string() }).optional(),
    contacts: z.array(z.object({ profile: z.object({ name: z.string().optional() }).optional(), wa_id: z.string() })).optional(),
    messages: z.array(z.unknown()).optional(),
    message_echoes: z.array(z.unknown()).optional(),
    state_sync: z.array(z.unknown()).optional(),
    history: z.array(z.unknown()).optional(),
    statuses: z.array(z.object({ id: z.string(), status: z.string(), timestamp: timestampSchema.optional() })).optional(),
  }).passthrough() }).passthrough()) }).passthrough()),
});

export type WhatsAppInboundText = { messageId: string; from: string; contactName?: string; body: string; timestamp: string; phoneNumberId: string; wabaId?: string; messageType?: WhatsAppMessageType; mediaId?: string; mediaMimeType?: string; mediaFilename?: string };
export type WhatsAppStatusUpdate = { messageId: string; status: string; phoneNumberId: string; timestamp?: string };
export type WhatsAppMessageType = "text" | "image" | "audio" | "video" | "document" | "location" | "contacts" | "sticker" | "template" | "interactive" | "system" | "unsupported";
export type WhatsAppMessageEcho = { messageId: string; to: string; body: string; timestamp: string; phoneNumberId: string; wabaId?: string; messageType: WhatsAppMessageType; mediaId?: string; mediaMimeType?: string; mediaFilename?: string };
export type WhatsAppSyncedContact = { whatsappId: string; fullName?: string; firstName?: string; action: string; timestamp?: string; phoneNumberId: string; wabaId?: string };
export type WhatsAppHistoryMessage = WhatsAppMessageEcho & { contactWhatsAppId: string; direction: "inbound" | "outbound"; deliveryStatus?: string };
export type WhatsAppHistoryChunk = { phoneNumberId: string; wabaId?: string; phase?: number; chunkOrder?: number; progress?: number; declined: boolean; errorCode?: number; errorMessage?: string; messages: WhatsAppHistoryMessage[] };

export function verifyWhatsAppSignature(rawBody: string, signature: string | null) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret || !signature?.startsWith("sha256=")) return false;
  const expected = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

export function parseWhatsAppWebhook(input: unknown) {
  const parsed = webhookSchema.parse(input);
  const messages: WhatsAppInboundText[] = [];
  const statuses: WhatsAppStatusUpdate[] = [];
  const echoes: WhatsAppMessageEcho[] = [];
  const syncedContacts: WhatsAppSyncedContact[] = [];
  const historyChunks: WhatsAppHistoryChunk[] = [];
  const accountUpdates: { wabaId?: string; event: string }[] = [];
  for (const entry of parsed.entry) for (const change of entry.changes) {
    if (change.field === "account_update" && typeof change.value.event === "string") accountUpdates.push({ wabaId: entry.id, event: change.value.event });
    const phoneNumberId = change.value.metadata?.phone_number_id;
    if (!phoneNumberId) continue;
    const contactById = new Map((change.value.contacts ?? []).map((contact) => [contact.wa_id, contact.profile?.name]));
    for (const raw of change.value.messages ?? []) {
      const message = historyMessageSchema.safeParse(raw);
      if (!message.success) continue;
      const type = normalizeMessageType(message.data.type);
      const media = message.data.image ?? message.data.audio ?? message.data.video ?? message.data.document;
      messages.push({ messageId: message.data.id, from: message.data.from, contactName: contactById.get(message.data.from), body: messageBody(type, message.data.text?.body ?? message.data.image?.caption ?? message.data.video?.caption ?? message.data.document?.caption), timestamp: message.data.timestamp, phoneNumberId, wabaId: entry.id, messageType: type, mediaId: media?.id, mediaMimeType: media?.mime_type, mediaFilename: message.data.document?.filename });
    }
    for (const status of change.value.statuses ?? []) statuses.push({ messageId: status.id, status: status.status, phoneNumberId, timestamp: status.timestamp });
    if (change.field === "smb_message_echoes") for (const raw of change.value.message_echoes ?? []) {
      const echo = messageEchoSchema.safeParse(raw);
      if (!echo.success) continue;
      const media = echo.data.image ?? echo.data.audio ?? echo.data.video ?? echo.data.document;
      const messageType = normalizeMessageType(echo.data.type);
      echoes.push({
        messageId: echo.data.id,
        to: echo.data.to,
        body: messageBody(messageType, echo.data.text?.body ?? echo.data.image?.caption ?? echo.data.video?.caption ?? echo.data.document?.caption),
        timestamp: echo.data.timestamp,
        phoneNumberId,
        wabaId: entry.id,
        messageType,
        mediaId: media?.id,
        mediaMimeType: media?.mime_type,
        mediaFilename: echo.data.document?.filename,
      });
    }
    if (change.field === "smb_app_state_sync") for (const raw of change.value.state_sync ?? []) {
      const syncedContact = stateSyncContactSchema.safeParse(raw);
      if (!syncedContact.success) continue;
      syncedContacts.push({
        whatsappId: normalizeWhatsAppId(syncedContact.data.contact.phone_number),
        fullName: syncedContact.data.contact.full_name || undefined,
        firstName: syncedContact.data.contact.first_name || undefined,
        action: syncedContact.data.action,
        timestamp: syncedContact.data.metadata?.timestamp,
        phoneNumberId,
        wabaId: entry.id,
      });
    }
    if (change.field === "history") for (const raw of change.value.history ?? []) {
      const chunk = historyChunkSchema.safeParse(raw);
      if (!chunk.success) continue;
      const historyMessages: WhatsAppHistoryMessage[] = [];
      for (const thread of chunk.data.threads ?? []) for (const rawMessage of thread.messages ?? []) {
        const message = historyMessageSchema.safeParse(rawMessage);
        if (!message.success) continue;
        const media = message.data.image ?? message.data.audio ?? message.data.video ?? message.data.document;
        const messageType = normalizeMessageType(message.data.type);
        historyMessages.push({
          messageId: message.data.id,
          to: message.data.to ?? thread.id,
          contactWhatsAppId: normalizeWhatsAppId(thread.id),
          direction: normalizeWhatsAppId(message.data.from) === normalizeWhatsAppId(thread.id) ? "inbound" : "outbound",
          body: messageBody(messageType, message.data.text?.body ?? message.data.image?.caption ?? message.data.video?.caption ?? message.data.document?.caption),
          timestamp: message.data.timestamp,
          phoneNumberId,
          wabaId: entry.id,
          messageType,
          mediaId: media?.id,
          mediaMimeType: media?.mime_type,
          mediaFilename: message.data.document?.filename,
          deliveryStatus: message.data.history_context?.status,
        });
      }
      const firstError = chunk.data.errors?.[0];
      historyChunks.push({
        phoneNumberId,
        wabaId: entry.id,
        phase: chunk.data.metadata?.phase,
        chunkOrder: chunk.data.metadata?.chunk_order,
        progress: chunk.data.metadata?.progress,
        declined: firstError?.code === 2593109,
        errorCode: firstError?.code,
        errorMessage: firstError?.message ?? firstError?.title,
        messages: historyMessages,
      });
    }
  }
  return { messages, statuses, echoes, syncedContacts, historyChunks, accountUpdates };
}

function normalizeWhatsAppId(value: string) {
  return value.replace(/\D/g, "");
}

function normalizeMessageType(type: string): WhatsAppMessageType {
  const supported: WhatsAppMessageType[] = ["text", "image", "audio", "video", "document", "location", "contacts", "sticker", "template", "interactive", "system"];
  return supported.includes(type as WhatsAppMessageType) ? type as WhatsAppMessageType : "unsupported";
}

function messageBody(type: WhatsAppMessageType, caption?: string) {
  if (caption?.trim()) return caption.trim().length > 4000 ? `${caption.trim().slice(0, 3999)}…` : caption.trim();
  const labels: Record<WhatsAppMessageType, string> = {
    text: "Mensagem enviada pelo WhatsApp Business",
    image: "Imagem enviada pelo WhatsApp Business",
    audio: "Áudio enviado pelo WhatsApp Business",
    video: "Vídeo enviado pelo WhatsApp Business",
    document: "Documento enviado pelo WhatsApp Business",
    location: "Localização enviada pelo WhatsApp Business",
    contacts: "Contato enviado pelo WhatsApp Business",
    sticker: "Figurinha enviada pelo WhatsApp Business",
    template: "Modelo enviado pelo WhatsApp Business",
    interactive: "Mensagem interativa enviada pelo WhatsApp Business",
    system: "Atualização do WhatsApp Business",
    unsupported: "Mensagem não compatível enviada pelo WhatsApp Business",
  };
  return labels[type];
}

export async function sendWhatsAppText({ body, phoneNumberId, to }: { body: string; phoneNumberId: string; to: string }) {
  const { connectionCredential, metaRequest, MetaRequestError } = await import("@/lib/whatsapp-meta");
  const { token } = await connectionCredential(phoneNumberId);
  const result = z.object({ messages: z.array(z.object({ id: z.string().min(1) })).min(1) }).safeParse(await metaRequest(`${phoneNumberId}/messages`, token, { messaging_product: "whatsapp", recipient_type: "individual", to, type: "text", text: { preview_url: false, body } }));
  if (!result.success) throw new MetaRequestError(undefined, true);
  return result.data.messages[0].id;
}
