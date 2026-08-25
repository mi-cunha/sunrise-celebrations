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
});
