import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWhatsAppReviewTemplate, getWhatsAppReviewStatus, hasWhatsAppReviewConfig, reviewError, sendWhatsAppReviewMessage } from "./whatsapp-review";

const fetchMock = vi.fn();
const debug = { data: { app_id: "111", is_valid: true, scopes: ["whatsapp_business_management", "whatsapp_business_messaging"], expires_at: 0 } };
const phones = { data: [{ id: "444", account_mode: "SANDBOX", display_phone_number: "+1 555 0100" }] };
const templates = { data: [{ id: "999", name: "hello_world", language: "en_US", status: "APPROVED", category: "UTILITY" }] };
function response(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status }); }
function validated() { fetchMock.mockResolvedValueOnce(response(debug)).mockResolvedValueOnce(response(phones)); }
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock); fetchMock.mockReset();
  for (const [key, value] of Object.entries({ NEXT_PUBLIC_META_APP_ID: "111", NEXT_PUBLIC_WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID: "222", WHATSAPP_APP_SECRET: "fixture-secret", WHATSAPP_GRAPH_API_VERSION: "v26.0", WHATSAPP_ALLOWED_WABA_ID: "777", WHATSAPP_ALLOWED_PHONE_NUMBER_ID: "888", WHATSAPP_REVIEW_ENABLED: "true", WHATSAPP_REVIEW_ACCESS_TOKEN: "fixture-token-never-disclose", WHATSAPP_REVIEW_WABA_ID: "333", WHATSAPP_REVIEW_PHONE_NUMBER_ID: "444", WHATSAPP_REVIEW_RECIPIENT: "550000000001" })) vi.stubEnv(key, value);
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("isolated Meta review demo", () => {
  it("fails closed when disabled or recipient is missing", async () => {
    vi.stubEnv("WHATSAPP_REVIEW_ENABLED", "false");
    expect(hasWhatsAppReviewConfig()).toBe(false);
    await expect(sendWhatsAppReviewMessage()).rejects.toThrow("Demonstração");
    vi.stubEnv("WHATSAPP_REVIEW_ENABLED", "true"); vi.stubEnv("WHATSAPP_REVIEW_RECIPIENT", "");
    expect(hasWhatsAppReviewConfig()).toBe(false); expect(fetchMock).not.toHaveBeenCalled();
  });
  it("refuses corporate assets without making API calls", async () => {
    vi.stubEnv("WHATSAPP_REVIEW_PHONE_NUMBER_ID", "888");
    await expect(sendWhatsAppReviewMessage()).rejects.toThrow("corporativa");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("refuses a token from another app", async () => {
    fetchMock.mockResolvedValueOnce(response({ data: { ...debug.data, app_id: "other" } }));
    await expect(sendWhatsAppReviewMessage()).rejects.toThrow("outro app"); expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("refuses a LIVE sender even when it belongs to the review WABA", async () => {
    fetchMock.mockResolvedValueOnce(response(debug)).mockResolvedValueOnce(response({ data: [{ ...phones.data[0], account_mode: "LIVE" }] }));
    await expect(sendWhatsAppReviewMessage()).rejects.toThrow("SANDBOX"); expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it("sends only approved hello_world to the server-configured recipient", async () => {
    validated(); fetchMock.mockResolvedValueOnce(response(templates)).mockResolvedValueOnce(response({ messages: [{ id: "wamid.fixture" }] }));
    expect(await sendWhatsAppReviewMessage()).toBe("wamid.fixture");
    const [url, request] = fetchMock.mock.calls[3];
    expect(url).toBe("https://graph.facebook.com/v26.0/444/messages");
    expect(JSON.parse(request.body)).toEqual({ messaging_product: "whatsapp", to: "550000000001", type: "template", template: { name: "hello_world", language: { code: "en_US" } } });
    expect(request.signal).toBeInstanceOf(AbortSignal);
  });
  it("does not send without the approved model", async () => {
    validated(); fetchMock.mockResolvedValueOnce(response({ data: [] }));
    await expect(sendWhatsAppReviewMessage()).rejects.toThrow("não está aprovado"); expect(fetchMock).toHaveBeenCalledTimes(3);
  });
  it("creates a real template only in the validated test WABA", async () => {
    validated(); fetchMock.mockResolvedValueOnce(response({ id: "model-fixture", status: "PENDING" }));
    expect(await createWhatsAppReviewTemplate({ name: "fixture_model", body: "Your fixture request was received." })).toEqual({ id: "model-fixture", status: "PENDING" });
    expect(fetchMock.mock.calls[2][0]).toBe("https://graph.facebook.com/v26.0/333/message_templates");
  });
  it("never returns a token to the client", async () => {
    validated(); fetchMock.mockResolvedValueOnce(response(templates));
    const status = await getWhatsAppReviewStatus();
    expect(JSON.stringify(status)).not.toContain("fixture-token"); expect(status.recipient).toBe("550000000001");
  });
  it("sanitizes errors and never retries uncertain sends", async () => {
    validated(); fetchMock.mockResolvedValueOnce(response(templates)).mockRejectedValueOnce(new Error("secret-details"));
    try { await sendWhatsAppReviewMessage(); throw new Error("unexpected success"); }
    catch (error) { expect(reviewError(error)).toContain("Não repita"); expect(reviewError(error)).not.toContain("secret-details"); }
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(reviewError(new Error("fixture-token-never-disclose"))).not.toContain("fixture-token");
  });
});
