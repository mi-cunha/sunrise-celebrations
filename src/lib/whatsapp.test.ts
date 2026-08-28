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
});
