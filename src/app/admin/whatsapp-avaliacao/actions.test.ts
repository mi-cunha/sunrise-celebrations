import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), operation: vi.fn(), send: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireUser: mocks.auth }));
vi.mock("@/lib/whatsapp-review-operation", () => ({ runReviewOperation: mocks.operation }));
vi.mock("@/lib/whatsapp-review", () => ({ sendWhatsAppReviewMessage: mocks.send, reviewError: () => "safe error" }));
import { sendReviewMessageAction } from "./actions";
beforeEach(() => { vi.resetAllMocks(); mocks.auth.mockResolvedValue({ user: { id: "00000000-0000-4000-8000-000000000001" }, permissions: ["admin_owner"] }); });
it("rejects a non-administrator without a send or database mutation", async () => {
  mocks.auth.mockResolvedValueOnce({ permissions: [], user: {} });
  expect((await sendReviewMessageAction({}, new FormData())).error).toContain("administradores");
  expect(mocks.operation).not.toHaveBeenCalled(); expect(mocks.send).not.toHaveBeenCalled();
});
it("requires a valid attempt ID and explicit recipient confirmation", async () => {
  const form = new FormData(); form.set("operationId", "00000000-0000-4000-8000-000000000001");
  expect((await sendReviewMessageAction({}, form)).error).toContain("Confirme");
  form.set("consent", "on"); form.set("operationId", "bad");
  expect((await sendReviewMessageAction({}, form)).error).toContain("Confirme");
  expect(mocks.operation).not.toHaveBeenCalled();
});
