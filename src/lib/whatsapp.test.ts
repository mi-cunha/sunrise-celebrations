import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { parseWhatsAppWebhook, verifyWhatsAppSignature } from "./whatsapp";

afterEach(() => { delete process.env.WHATSAPP_APP_SECRET; });

describe("WhatsApp webhook", () => {
  it("valida a assinatura HMAC da Meta", () => {
    process.env.WHATSAPP_APP_SECRET = "test-secret";
    const body = '{"object":"whatsapp_business_account"}';
    const signature = `sha256=${createHmac("sha256", "test-secret").update(body).digest("hex")}`;
    expect(verifyWhatsAppSignature(body, signature)).toBe(true);
    expect(verifyWhatsAppSignature(`${body}x`, signature)).toBe(false);
  });

  it("extrai mensagens de texto e atualizações de entrega", () => {
    const result = parseWhatsAppWebhook({ object: "whatsapp_business_account", entry: [{ changes: [{ value: { metadata: { phone_number_id: "12345" }, contacts: [{ profile: { name: "Noemi" }, wa_id: "5585999999999" }], messages: [{ from: "5585999999999", id: "wamid.message", timestamp: "1787680000", type: "text", text: { body: "Olá" } }], statuses: [{ id: "wamid.sent", status: "delivered" }] } }] }] });
    expect(result.messages[0]).toMatchObject({ from: "5585999999999", contactName: "Noemi", body: "Olá", phoneNumberId: "12345" });
    expect(result.statuses[0]).toEqual({ messageId: "wamid.sent", status: "delivered" });
  });

  it("extrai mensagens enviadas pelo aplicativo no modo coexistence", () => {
    const result = parseWhatsAppWebhook({
      object: "whatsapp_business_account",
      entry: [{
        id: "waba-123",
        changes: [{
          field: "smb_message_echoes",
          value: {
            metadata: { phone_number_id: "phone-123" },
            message_echoes: [{
              from: "5585999990000",
              to: "5585999999999",
              id: "wamid.echo",
              timestamp: "1787680000",
              type: "text",
              text: { body: "Mensagem enviada pelo celular" },
            }],
          },
        }],
      }],
    });

    expect(result.echoes).toEqual([{
      messageId: "wamid.echo",
      to: "5585999999999",
      body: "Mensagem enviada pelo celular",
      timestamp: "1787680000",
      phoneNumberId: "phone-123",
      wabaId: "waba-123",
      messageType: "text",
      mediaId: undefined,
      mediaMimeType: undefined,
      mediaFilename: undefined,
    }]);
    expect(result.messages).toHaveLength(0);
  });

  it("representa mídias ecoadas sem depender de legenda", () => {
    const result = parseWhatsAppWebhook({
      object: "whatsapp_business_account",
      entry: [{ changes: [{ field: "smb_message_echoes", value: {
        metadata: { phone_number_id: "phone-123" },
        message_echoes: [{ from: "5585999990000", to: "5585999999999", id: "wamid.audio", timestamp: "1787680000", type: "audio", audio: { id: "media-1", mime_type: "audio/ogg" } }],
      } }] }],
    });

    expect(result.echoes[0]).toMatchObject({ body: "Áudio enviado pelo WhatsApp Business", messageType: "audio", mediaId: "media-1", mediaMimeType: "audio/ogg" });
  });

  it("extrai contatos sincronizados sem transformá-los em mensagens", () => {
    const result = parseWhatsAppWebhook({
      object: "whatsapp_business_account",
      entry: [{ id: "waba-123", changes: [{ field: "smb_app_state_sync", value: {
        metadata: { phone_number_id: "phone-123" },
        state_sync: [{
          type: "contact",
          contact: { full_name: "Maria da Silva", first_name: "Maria", phone_number: "+55 (85) 99999-9999" },
          action: "upsert",
          metadata: { timestamp: "1787680000" },
        }],
      } }] }],
    });

    expect(result.syncedContacts).toEqual([{
      whatsappId: "5585999999999",
      fullName: "Maria da Silva",
      firstName: "Maria",
      action: "upsert",
      timestamp: "1787680000",
      phoneNumberId: "phone-123",
      wabaId: "waba-123",
    }]);
    expect(result.messages).toHaveLength(0);
    expect(result.echoes).toHaveLength(0);
  });

  it("extrai o histórico preservando direção, status e progresso", () => {
    const result = parseWhatsAppWebhook({
      object: "whatsapp_business_account",
      entry: [{ id: "waba-123", changes: [{ field: "history", value: {
        metadata: { phone_number_id: "phone-123" },
        history: [{
          metadata: { phase: 1, chunk_order: 2, progress: 55 },
          threads: [{ id: "5585999999999", messages: [
            { from: "5585999999999", to: "5585999990000", id: "wamid.inbound", timestamp: "1787680000", type: "text", text: { body: "Olá" }, history_context: { status: "read" } },
            { from: "5585999990000", to: "5585999999999", id: "wamid.outbound", timestamp: "1787680100", type: "text", text: { body: "Como podemos ajudar?" }, history_context: { status: "delivered" } },
          ] }],
        }],
      } }] }],
    });

    expect(result.historyChunks[0]).toMatchObject({ phoneNumberId: "phone-123", wabaId: "waba-123", phase: 1, chunkOrder: 2, progress: 55, declined: false });
    expect(result.historyChunks[0].messages).toEqual([
      expect.objectContaining({ messageId: "wamid.inbound", contactWhatsAppId: "5585999999999", direction: "inbound", body: "Olá", deliveryStatus: "read" }),
      expect.objectContaining({ messageId: "wamid.outbound", contactWhatsAppId: "5585999999999", direction: "outbound", body: "Como podemos ajudar?", deliveryStatus: "delivered" }),
    ]);
  });

  it("identifica quando o compartilhamento do histórico foi recusado", () => {
    const result = parseWhatsAppWebhook({
      object: "whatsapp_business_account",
      entry: [{ changes: [{ field: "history", value: {
        metadata: { phone_number_id: "phone-123" },
        history: [{ errors: [{ code: 2593109, title: "History sync is turned off", message: "History sharing is turned off by the business" }] }],
      } }] }],
    });

    expect(result.historyChunks[0]).toMatchObject({ declined: true, errorMessage: "History sharing is turned off by the business", messages: [] });
  });
});
