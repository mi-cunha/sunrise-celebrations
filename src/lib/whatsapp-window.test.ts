import { describe, expect, it } from "vitest";
import { canSendFreeWhatsApp, getWhatsAppWindow } from "./whatsapp-window";

const now = Date.parse("2026-10-02T12:00:00.000Z");
describe("WhatsApp customer-service window", () => {
  it("keeps the composer open within 24 hours", () => expect(canSendFreeWhatsApp(getWhatsAppWindow("2026-10-01T13:00:01.000Z", now))).toBe(true));
  it("warns when less than two hours remain", () => expect(getWhatsAppWindow("2026-10-01T13:30:00.000Z", now).state).toBe("closing"));
  it("blocks free messages after 24 hours", () => expect(getWhatsAppWindow("2026-10-01T12:00:00.000Z", now).state).toBe("expired"));
  it("a new customer message reopens the window", () => expect(canSendFreeWhatsApp(getWhatsAppWindow("2026-10-02T11:59:00.000Z", now))).toBe(true));
  it("does not treat an outbound timestamp as an inbound window", () => expect(getWhatsAppWindow(null, now).state).toBe("not_started"));
  it("requires a started WhatsApp conversation before free messages", () => expect(canSendFreeWhatsApp(getWhatsAppWindow(null, now))).toBe(false));
});
