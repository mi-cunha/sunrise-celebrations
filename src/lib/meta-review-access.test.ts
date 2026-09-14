import { createHash } from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { newReviewerSession, readReviewerOperation, readReviewerSession, reviewerConfig, reviewerCookieOptions, reviewerOperationTicket, reviewerPasswordValid } from "./meta-review-access";

const password = "fixture-only-not-a-real-password-0123456789";
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-14T12:15:00Z"));
  vi.stubEnv("VERCEL_ENV", "preview"); vi.stubEnv("META_REVIEWER_ENABLED", "true");
  vi.stubEnv("META_REVIEWER_PASSWORD_SHA256", createHash("sha256").update(password).digest("hex"));
  vi.stubEnv("META_REVIEWER_SIGNING_KEY", "fixture-only-signing-key-not-real-01234567890123456789");
  vi.stubEnv("WHATSAPP_SYSTEM_USER_ID", "00000000-0000-4000-8000-000000000001");
  vi.stubEnv("META_REVIEWER_EXPIRES_AT", "2026-10-14T12:00:00Z");
});
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });

it("fails closed in production, disabled, expired or missing configuration", () => {
  expect(reviewerConfig()).not.toBeNull();
  vi.stubEnv("VERCEL_ENV", "production"); expect(reviewerConfig()).toBeNull();
  vi.stubEnv("VERCEL_ENV", "preview"); vi.stubEnv("META_REVIEWER_ENABLED", "false"); expect(reviewerConfig()).toBeNull();
  vi.stubEnv("META_REVIEWER_ENABLED", "true"); vi.stubEnv("META_REVIEWER_EXPIRES_AT", "2026-09-14T12:15:00Z"); expect(reviewerConfig()).toBeNull();
  vi.stubEnv("META_REVIEWER_EXPIRES_AT", "2026-10-14T12:00:00Z"); vi.stubEnv("WHATSAPP_SYSTEM_USER_ID", ""); expect(reviewerConfig()).toBeNull();
});
it("requires the exact reviewer name and a high-entropy password; handles malformed inputs", () => {
  expect(reviewerPasswordValid("meta-review", password)).toBe(true);
  for (const candidate of [null, {}, "short", "x".repeat(257), "x".repeat(43)]) expect(reviewerPasswordValid("meta-review", candidate)).toBe(false);
  expect(reviewerPasswordValid("admin", password)).toBe(false);
});
it("uses a secure path-scoped cookie and rejects expired, tampered, malformed or rotated sessions", () => {
  expect(reviewerCookieOptions).toEqual({ httpOnly: true, secure: true, sameSite: "strict", path: "/avaliacao-meta" });
  const token = newReviewerSession(); expect(token.maxAge).toBe(3600);
  expect(readReviewerSession(token.value)?.scope).toBe("whatsapp-test-only");
  for (const value of [null, "", "x".repeat(2049), `${token.value}x`, token.value.split(".")[0]]) expect(readReviewerSession(value)).toBeNull();
  vi.stubEnv("META_REVIEWER_PASSWORD_SHA256", "a".repeat(64)); expect(readReviewerSession(token.value)).toBeNull();
  vi.stubEnv("META_REVIEWER_PASSWORD_SHA256", createHash("sha256").update(password).digest("hex"));
  vi.advanceTimersByTime(3600_000); expect(readReviewerSession(token.value)).toBeNull();
});
it("caps session lifetime at the configured shutdown time", () => {
  vi.stubEnv("META_REVIEWER_EXPIRES_AT", "2026-09-14T12:16:00Z");
  expect(newReviewerSession().maxAge).toBe(60);
});
it("shares one durable operation per kind/hour across fresh logins but binds tickets to each session", () => {
  const first = readReviewerSession(newReviewerSession().value)!;
  const second = readReviewerSession(newReviewerSession().value)!;
  const ticket = reviewerOperationTicket("send", first);
  const id = readReviewerOperation(ticket, "send", first);
  expect(id).toMatch(/^[a-f0-9-]{36}$/);
  expect(readReviewerOperation(reviewerOperationTicket("send", second), "send", second)).toBe(id);
  expect(readReviewerOperation(reviewerOperationTicket("template", first), "template", first)).not.toBe(id);
  expect(readReviewerOperation(ticket, "template", first)).toBeNull();
  expect(readReviewerOperation(ticket, "send", second)).toBeNull();
  expect(readReviewerOperation(newReviewerSession().value, "send", first)).toBeNull();
  expect(readReviewerSession(ticket)).toBeNull();
  expect(readReviewerOperation(`${ticket}x`, "send", first)).toBeNull();
  vi.setSystemTime(new Date("2026-09-14T13:00:00Z"));
  expect(readReviewerOperation(ticket, "send", first)).toBeNull();
  expect(readReviewerOperation(reviewerOperationTicket("send", first), "send", first)).not.toBe(id);
});
