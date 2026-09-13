import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { decryptWhatsAppToken, encryptWhatsAppToken } from "./whatsapp-credentials";
import { isCoexistencePhone, metaRequest } from "./whatsapp-meta";

beforeEach(() => {
  vi.stubEnv("WHATSAPP_CREDENTIAL_ENCRYPTION_KEY", "ab".repeat(32));
  vi.stubEnv("NEXT_PUBLIC_META_APP_ID", "12345");
  vi.stubEnv("NEXT_PUBLIC_WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID", "54321");
  vi.stubEnv("WHATSAPP_APP_SECRET", "fixture-secret");
  vi.stubEnv("WHATSAPP_GRAPH_API_VERSION", "v26.0");
  vi.stubEnv("WHATSAPP_ALLOWED_WABA_ID", "33333");
  vi.stubEnv("WHATSAPP_ALLOWED_PHONE_NUMBER_ID", "44444");
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("coexistence credentials", () => {
  it("encrypts with a random IV and binds to app/phone", () => {
    const encrypted = encryptWhatsAppToken("fixture-token", "app:phone");
    expect(encrypted).not.toContain("fixture-token");
    expect(encrypted).not.toEqual(encryptWhatsAppToken("fixture-token", "app:phone"));
    expect(decryptWhatsAppToken(encrypted, "app:phone")).toBe("fixture-token");
    expect(() => decryptWhatsAppToken(encrypted, "other:phone")).toThrow();
    expect(() => decryptWhatsAppToken(encrypted.slice(0, -2) + "ff", "app:phone")).toThrow();
  });
  it("refuses missing or malformed encryption keys", () => {
    vi.stubEnv("WHATSAPP_CREDENTIAL_ENCRYPTION_KEY", "short");
    expect(() => encryptWhatsAppToken("token", "app:phone")).toThrow();
  });
  it("requires both Business App and CLOUD_API, not ON_PREMISE", () => {
    expect(isCoexistencePhone({ is_on_biz_app: true, platform_type: "ON_PREMISE" })).toBe(false);
    expect(isCoexistencePhone({ is_on_biz_app: false, platform_type: "CLOUD_API" })).toBe(false);
    expect(isCoexistencePhone({ is_on_biz_app: true, platform_type: "CLOUD_API" })).toBe(true);
  });
  it("never includes raw Graph error content in an error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 190, message: "secret-token fixture-pii" } }), { status: 400 })));
    await expect(metaRequest("12345", "secret")).rejects.toThrow("190");
    await expect(metaRequest("12345", "secret")).rejects.not.toThrow("secret-token");
  });
  it("marks transport failure as an unknown outcome without retrying", async () => {
    const fetch = vi.fn().mockRejectedValue(new Error("network"));
    vi.stubGlobal("fetch", fetch);
    await expect(metaRequest("12345/messages", "secret", {})).rejects.toMatchObject({ uncertain: true });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
