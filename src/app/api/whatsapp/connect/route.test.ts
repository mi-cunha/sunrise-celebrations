import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), origin: vi.fn(), meta: vi.fn(), admin: vi.fn() }));
vi.mock("@/lib/whatsapp-auth", () => ({ whatsappAdministrator: mocks.auth, sameOrigin: mocks.origin }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));
vi.mock("@/lib/whatsapp-meta", async (original) => ({ ...await original<object>(), metaRequest: mocks.meta }));
import { POST } from "./route";

beforeEach(() => { vi.resetAllMocks(); mocks.auth.mockResolvedValue(null); mocks.origin.mockReturnValue(true); });

describe("connection boundary", () => {
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
