import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const textMessageSchema = z.object({
  from: z.string().min(5), id: z.string().min(5), timestamp: z.string(), type: z.literal("text"),
  text: z.object({ body: z.string().trim().min(1).max(4000) }),
});
const messageEchoSchema = z.object({
  from: z.string().min(5),
  to: z.string().min(5),
  id: z.string().min(5),
  timestamp: z.string(),
  type: z.string().min(1),
  text: z.object({ body: z.string().trim().min(1).max(4000) }).optional(),
  image: z.object({ id: z.string().optional(), mime_type: z.string().optional(), caption: z.string().max(4000).optional() }).optional(),
  audio: z.object({ id: z.string().optional(), mime_type: z.string().optional() }).optional(),
  video: z.object({ id: z.string().optional(), mime_type: z.string().optional(), caption: z.string().max(4000).optional() }).optional(),
  document: z.object({ id: z.string().optional(), mime_type: z.string().optional(), filename: z.string().optional(), caption: z.string().max(4000).optional() }).optional(),
}).passthrough();
const webhookSchema = z.object({
  object: z.literal("whatsapp_business_account"),
  entry: z.array(z.object({ id: z.string().optional(), changes: z.array(z.object({ field: z.string().optional(), value: z.object({
    metadata: z.object({ phone_number_id: z.string() }),
    contacts: z.array(z.object({ profile: z.object({ name: z.string().optional() }).optional(), wa_id: z.string() })).optional(),
    messages: z.array(z.unknown()).optional(),
    message_echoes: z.array(z.unknown()).optional(),
    statuses: z.array(z.object({ id: z.string(), status: z.string() })).optional(),
  }).passthrough() }).passthrough()) }).passthrough()),
});

export type WhatsAppInboundText = { messageId: string; from: string; contactName?: string; body: string; timestamp: string; phoneNumberId: string };
export type WhatsAppStatusUpdate = { messageId: string; status: string };
export type WhatsAppMessageType = "text" | "image" | "audio" | "video" | "document" | "location" | "contacts" | "sticker" | "template" | "interactive" | "system" | "unsupported";
export type WhatsAppMessageEcho = { messageId: string; to: string; body: string; timestamp: string; phoneNumberId: string; wabaId?: string; messageType: WhatsAppMessageType; mediaId?: string; mediaMimeType?: string; mediaFilename?: string };

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
  for (const entry of parsed.entry) for (const change of entry.changes) {
    const contactById = new Map((change.value.contacts ?? []).map((contact) => [contact.wa_id, contact.profile?.name]));
    for (const raw of change.value.messages ?? []) {
      const message = textMessageSchema.safeParse(raw);
      if (message.success) messages.push({ messageId: message.data.id, from: message.data.from, contactName: contactById.get(message.data.from), body: message.data.text.body, timestamp: message.data.timestamp, phoneNumberId: change.value.metadata.phone_number_id });
    }
    for (const status of change.value.statuses ?? []) statuses.push({ messageId: status.id, status: status.status });
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
        phoneNumberId: change.value.metadata.phone_number_id,
        wabaId: entry.id,
        messageType,
        mediaId: media?.id,
        mediaMimeType: media?.mime_type,
        mediaFilename: echo.data.document?.filename,
      });
    }
  }
  return { messages, statuses, echoes };
}

function normalizeMessageType(type: string): WhatsAppMessageType {
  const supported: WhatsAppMessageType[] = ["text", "image", "audio", "video", "document", "location", "contacts", "sticker", "template", "interactive", "system"];
  return supported.includes(type as WhatsAppMessageType) ? type as WhatsAppMessageType : "unsupported";
}

function messageBody(type: WhatsAppMessageType, caption?: string) {
  if (caption?.trim()) return caption.trim();
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
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const version = process.env.WHATSAPP_GRAPH_API_VERSION;
  if (!token) throw new Error("WHATSAPP_ACCESS_TOKEN não configurado.");
  if (!version || !/^v\d+\.\d+$/.test(version)) throw new Error("WHATSAPP_GRAPH_API_VERSION não configurada.");
  const response = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}/messages`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to, type: "text", text: { preview_url: false, body } }) });
  const result = await response.json() as { messages?: { id: string }[]; error?: { message?: string } };
  if (!response.ok || !result.messages?.[0]?.id) throw new Error(result.error?.message ?? "A Meta recusou o envio da mensagem.");
  return result.messages[0].id;
}
