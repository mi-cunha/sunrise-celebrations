import { createHash } from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ session: vi.fn(), operation: vi.fn(), status: vi.fn(), send: vi.fn(), template: vi.fn(), setCookie: vi.fn(), redirect: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/lib/meta-review-session", () => ({ getReviewerSession: mocks.session }));
vi.mock("@/lib/whatsapp-review-operation", () => ({ runReviewOperation: mocks.operation }));
vi.mock("next/headers", () => ({ cookies: async () => ({ set: mocks.setCookie }) }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/lib/whatsapp-review", async importOriginal => ({ ...await importOriginal<object>(), getWhatsAppReviewStatus: mocks.status, sendWhatsAppReviewMessage: mocks.send, createWhatsAppReviewTemplate: mocks.template, reviewError: () => "Safe failure" }));
import { newReviewerSession, readReviewerSession, reviewerOperationTicket } from "@/lib/meta-review-access";
import { reviewerLoginAction, reviewerLogoutAction, reviewerSendAction, reviewerTemplateAction } from "./actions";
const password = "fixture-only-not-a-real-password-0123456789";
beforeEach(() => {
  vi.resetAllMocks(); vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-14T12:15:00Z"));
  vi.stubEnv("VERCEL_ENV", "preview"); vi.stubEnv("META_REVIEWER_ENABLED", "true");
  vi.stubEnv("META_REVIEWER_PASSWORD_SHA256", createHash("sha256").update(password).digest("hex"));
  vi.stubEnv("META_REVIEWER_SIGNING_KEY", "fixture-only-signing-key-not-real-01234567890123456789");
  vi.stubEnv("WHATSAPP_SYSTEM_USER_ID", "00000000-0000-4000-8000-000000000001");
  vi.stubEnv("META_REVIEWER_EXPIRES_AT", "2026-10-14T12:00:00Z");
  mocks.session.mockResolvedValue(readReviewerSession(newReviewerSession().value));
  mocks.operation.mockResolvedValue({ metaId: "fixture-meta-id" });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });
async function formFor(kind: "send" | "template") {
  const form = new FormData(); form.set("operationId", reviewerOperationTicket(kind, await mocks.session()));
  form.set("consent", "on"); form.set("name", "sunrise_confirmacao_fixture"); form.set("body", "Recebemos sua solicitação de orçamento. Nossa equipe dará continuidade ao atendimento."); return form;
}
it("rejects anonymous and forged operations before Meta or database access", async () => {
  const form = await formFor("send"); mocks.session.mockResolvedValue(null);
  expect((await reviewerSendAction({}, form)).error).toContain("inválida");
  expect((await reviewerTemplateAction({}, form)).error).toContain("inválida");
  mocks.session.mockResolvedValue(readReviewerSession(newReviewerSession().value));
  form.set("operationId", "00000000-0000-4000-8000-000000000001");
  expect((await reviewerSendAction({}, form)).error).toContain("inválida");
  expect(mocks.status).not.toHaveBeenCalled(); expect(mocks.operation).not.toHaveBeenCalled();
});
it("requires consent and valid template content before mutations", async () => {
  const send = await formFor("send"); send.delete("consent");
  expect((await reviewerSendAction({}, send)).error).toContain("Confirme");
  const template = await formFor("template"); template.set("name", "INVALID NAME");
  expect((await reviewerTemplateAction({}, template)).fieldErrors?.name).toBeDefined();
  expect(mocks.operation).not.toHaveBeenCalled();
});
it("expired Meta token does not consume the durable attempt or send anything", async () => {
  mocks.status.mockRejectedValue(new Error("private upstream failure"));
  expect((await reviewerSendAction({}, await formFor("send"))).error).toBe("Safe failure");
  expect(mocks.operation).not.toHaveBeenCalled(); expect(mocks.send).not.toHaveBeenCalled();
});
it("uses the existing test-only send backend and ignores caller-supplied recipients", async () => {
  const form = await formFor("send"); form.set("recipient", "not-authorized");
  expect((await reviewerSendAction({}, form)).messageId).toBe("fixture-meta-id");
  expect(mocks.operation).toHaveBeenCalledWith(expect.any(String), process.env.WHATSAPP_SYSTEM_USER_ID, "send", mocks.send);
});
it("creates only a validated test template and invalidates only the evaluation route", async () => {
  mocks.template.mockResolvedValue({ id: "fixture-template-id" });
  mocks.operation.mockImplementation(async (_id, _actor, _kind, operation) => ({ metaId: await operation() }));
  expect((await reviewerTemplateAction({}, await formFor("template"))).success).toContain("fixture-template-id");
  expect(mocks.template).toHaveBeenCalledWith({ name: "sunrise_confirmacao_fixture", body: expect.any(String) });
  expect(mocks.revalidate).toHaveBeenCalledWith("/avaliacao-meta");
});
it("reports the duplicate quota without running another send", async () => {
  mocks.operation.mockResolvedValue({ error: "Already attempted." });
  expect((await reviewerSendAction({}, await formFor("send"))).error).toContain("por hora");
  expect(mocks.send).not.toHaveBeenCalled();
});
it("creates only an isolated cookie after valid login and clears it on logout", async () => {
  const form = new FormData(); form.set("username", "meta-review"); form.set("password", "wrong");
  expect((await reviewerLoginAction({}, form)).error).toBeDefined(); expect(mocks.setCookie).not.toHaveBeenCalled();
  form.set("password", password); await reviewerLoginAction({}, form);
  expect(mocks.setCookie).toHaveBeenCalledWith("sunrise_meta_review", expect.any(String), expect.objectContaining({ path: "/avaliacao-meta", secure: true, httpOnly: true, maxAge: 3600 }));
  await reviewerLogoutAction();
  expect(mocks.setCookie).toHaveBeenLastCalledWith("sunrise_meta_review", "", expect.objectContaining({ maxAge: 0 }));
  expect(mocks.operation).not.toHaveBeenCalled();
});
