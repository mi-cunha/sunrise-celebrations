import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), client: vi.fn() }));
vi.mock("@supabase/ssr", () => ({ createServerClient: mocks.client }));
import { proxy } from "./proxy";
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://fixture.supabase.co"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "fixture-key");
  mocks.getUser.mockResolvedValue({ data: { user: null } }); mocks.client.mockReturnValue({ auth: { getUser: mocks.getUser } });
});
afterEach(() => vi.unstubAllEnvs());
it("only bypasses Supabase auth for the exact isolated entry point, with no-store headers", async () => {
  const response = await proxy(new NextRequest("https://fixture.example/avaliacao-meta"));
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(response.headers.get("Referrer-Policy")).toBe("no-referrer"); expect(mocks.client).not.toHaveBeenCalled();
});
it.each(["/", "/admin/whatsapp-avaliacao", "/admin/opcoes", "/avaliacao-meta/admin", "/api/whatsapp/connect"])("does not accept a reviewer cookie as CRM authentication on %s", async path => {
  const response = await proxy(new NextRequest(`https://fixture.example${path}`, { headers: { cookie: "sunrise_meta_review=reviewer-session" } }));
  expect(response.status).toBe(307); expect(response.headers.get("location")).toBe("https://fixture.example/login");
  expect(mocks.getUser).toHaveBeenCalled();
});
