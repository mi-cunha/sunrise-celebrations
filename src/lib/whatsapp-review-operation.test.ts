import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ insert: vi.fn(), update: vi.fn(), eq: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: () => ({ insert: mocks.insert, update: mocks.update }) }) }));
import { runReviewOperation } from "./whatsapp-review-operation";
const id = "00000000-0000-4000-8000-000000000001";
beforeEach(() => { vi.resetAllMocks(); mocks.insert.mockResolvedValue({ error: null }); mocks.update.mockReturnValue({ eq: mocks.eq }); mocks.eq.mockResolvedValue({ error: null }); });
it("claims the operation before calling Meta and refuses repeated IDs", async () => {
  const send = vi.fn().mockResolvedValue("wamid.fixture");
  expect(await runReviewOperation(id, id, "send", send)).toEqual({ metaId: "wamid.fixture", warning: undefined });
  expect(mocks.insert.mock.invocationCallOrder[0]).toBeLessThan(send.mock.invocationCallOrder[0]);
  mocks.insert.mockResolvedValueOnce({ error: { code: "23505" } });
  expect((await runReviewOperation(id, id, "send", send)).error).toContain("nenhum reenvio"); expect(send).toHaveBeenCalledTimes(1);
});
it("does not send if the database claim fails", async () => {
  mocks.insert.mockResolvedValueOnce({ error: { code: "db-down" } }); const send = vi.fn();
  expect((await runReviewOperation(id, id, "send", send)).error).toContain("nada foi enviado"); expect(send).not.toHaveBeenCalled();
});
it("retains an unconfirmed operation after a timeout", async () => {
  await expect(runReviewOperation(id, id, "send", async () => { throw new Error("timeout"); })).rejects.toThrow("timeout");
  expect(mocks.update).toHaveBeenCalledWith({ status: "unconfirmed" });
});
