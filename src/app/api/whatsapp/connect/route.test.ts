import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), origin: vi.fn(), meta: vi.fn(), admin: vi.fn() }));
vi.mock("@/lib/whatsapp-auth", () => ({ whatsappAdministrator: mocks.auth, sameOrigin: mocks.origin }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));
vi.mock("@/lib/whatsapp-meta", async (original) => ({ ...await original<object>(), metaRequest: mocks.meta }));
import { POST } from "./route";

beforeEach(() => { vi.resetAllMocks(); mocks.auth.mockResolvedValue(null); mocks.origin.mockReturnValue(true); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("connection boundary", () => {
  it("validates allowlisted assets without postMessage and preserves the old sync window", async () => {
    const vars = { NEXT_PUBLIC_META_APP_ID: "11111", NEXT_PUBLIC_WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID: "22222", WHATSAPP_APP_SECRET: "fixture", WHATSAPP_GRAPH_API_VERSION: "v26.0", WHATSAPP_ALLOWED_WABA_ID: "33333", WHATSAPP_ALLOWED_PHONE_NUMBER_ID: "44444", WHATSAPP_CREDENTIAL_ENCRYPTION_KEY: "ab".repeat(32) };
    for (const [key, value] of Object.entries(vars)) vi.stubEnv(key, value);
    const existing = { id: "fixture-id", onboarding_id: "fixture-onboarding", connected_at: null, created_at: "2026-01-01T00:00:00.000Z" };
    const query = { select: vi.fn(), limit: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(), update: vi.fn(), single: vi.fn(), upsert: vi.fn() };
    query.select.mockReturnValue(query); query.limit.mockResolvedValue({ error: null }); query.eq.mockReturnValue(query);
    query.maybeSingle.mockResolvedValue({ data: existing, error: null }); query.update.mockReturnValue(query);
    query.single.mockResolvedValue({ data: { id: existing.id }, error: null }); query.upsert.mockResolvedValue({ error: null });
    mocks.admin.mockReturnValue({ from: vi.fn().mockReturnValue(query) });
    const exchange = vi.fn().mockResolvedValue(Response.json({ access_token: "fixture-access-token-long-enough" }));
    vi.stubGlobal("fetch", exchange);
    mocks.meta.mockResolvedValueOnce({ data: { app_id: "11111", is_valid: true, scopes: ["whatsapp_business_management", "whatsapp_business_messaging"] } })
      .mockResolvedValueOnce({ data: [{ id: "44444", is_on_biz_app: true, platform_type: "CLOUD_API" }] })
      .mockResolvedValueOnce({ data: [{ whatsapp_business_api_data: { id: "11111" } }] });
    const result = await POST(new Request("https://fixture.example/api/whatsapp/connect", { method: "POST", body: JSON.stringify({ code: "fixture-code-1234567890" }) }));
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual({ connected: true, phoneNumberId: "44444" });
    expect(mocks.meta.mock.calls[1][0]).toContain("33333/phone_numbers");
    expect(query.update).toHaveBeenLastCalledWith({ status: "connected", connected_at: existing.created_at });
    expect(query.update.mock.calls[0][0].onboarding_id).toBe(existing.onboarding_id);
    expect(mocks.meta.mock.calls.some(([path]) => String(path).includes("/register"))).toBe(false);
    expect(exchange).toHaveBeenCalledTimes(1);
  });
  it("rejects foreign origins before authentication or token exchange", async () => {
    mocks.origin.mockReturnValue(false);
    expect((await POST(new Request("https://fixture.example/api/whatsapp/connect", { method: "POST" }))).status).toBe(403);
    expect(mocks.auth).not.toHaveBeenCalled(); expect(mocks.meta).not.toHaveBeenCalled();
  });
  it("rejects missing administrator authorization", async () => {
    mocks.auth.mockResolvedValue(new Response(null, { status: 401 }));
    expect((await POST(new Request("https://fixture.example/api/whatsapp/connect", { method: "POST" }))).status).toBe(401);
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it("rejects malformed bodies without calling Meta", async () => {
    const request = new Request("https://fixture.example/api/whatsapp/connect", { method: "POST", body: "not json" });
    expect((await POST(request)).status).toBe(400);
    expect(mocks.meta).not.toHaveBeenCalled(); expect(mocks.admin).not.toHaveBeenCalled();
  });
  it("does not accept a client-supplied arbitrary WABA or phone", async () => {
    const vars = { NEXT_PUBLIC_META_APP_ID: "11111", NEXT_PUBLIC_WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID: "22222", WHATSAPP_APP_SECRET: "fixture", WHATSAPP_GRAPH_API_VERSION: "v26.0", WHATSAPP_ALLOWED_WABA_ID: "33333", WHATSAPP_ALLOWED_PHONE_NUMBER_ID: "44444", WHATSAPP_CREDENTIAL_ENCRYPTION_KEY: "ab".repeat(32) };
    for (const [key, value] of Object.entries(vars)) vi.stubEnv(key, value);
    try {
      const request = new Request("https://fixture.example/api/whatsapp/connect", { method: "POST", body: JSON.stringify({ code: "fixture-code-1234567890", wabaId: "99999" }) });
      expect((await POST(request)).status).toBe(403);
      expect(mocks.admin).not.toHaveBeenCalled(); expect(mocks.meta).not.toHaveBeenCalled();
    } finally { vi.unstubAllEnvs(); }
  });
});
