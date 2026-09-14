import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";

export const reviewerCookie = "sunrise_meta_review";
export const reviewerPath = "/avaliacao-meta";
export const reviewerCookieOptions = { httpOnly: true, secure: true, sameSite: "strict" as const, path: reviewerPath };
const hour = 3600;
const configSchema = z.object({
  enabled: z.literal("true"), environment: z.literal("preview"),
  passwordHash: z.string().regex(/^[a-f0-9]{64}$/),
  signingKey: z.string().min(43), actorId: z.uuid(), expiresAt: z.iso.datetime(),
});
const sessionSchema = z.object({ scope: z.literal("whatsapp-test-only"), id: z.uuid(), exp: z.number().int().positive(), credential: z.string() });
export type ReviewerSession = z.infer<typeof sessionSchema>;

export function reviewerConfig(now = Date.now()) {
  const config = configSchema.safeParse({ enabled: process.env.META_REVIEWER_ENABLED, environment: process.env.VERCEL_ENV,
    passwordHash: process.env.META_REVIEWER_PASSWORD_SHA256, signingKey: process.env.META_REVIEWER_SIGNING_KEY,
    actorId: process.env.WHATSAPP_SYSTEM_USER_ID, expiresAt: process.env.META_REVIEWER_EXPIRES_AT });
  return config.success && Date.parse(config.data.expiresAt) > now ? config.data : null;
}

function equal(a: string, b: string) {
  const left = Buffer.from(a); const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
export function reviewerPasswordValid(username: unknown, password: unknown) {
  const config = reviewerConfig();
  if (!config || username !== "meta-review" || typeof password !== "string" || password.length < 32 || password.length > 256) return false;
  return equal(createHash("sha256").update(password).digest("hex"), config.passwordHash);
}
function sign(payload: object, purpose: string) {
  const config = reviewerConfig();
  if (!config) throw new Error("Acesso de avaliação indisponível.");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${createHmac("sha256", config.signingKey).update(`${purpose}:${body}`).digest("base64url")}`;
}
function decode(value: unknown, purpose: string): unknown {
  const config = reviewerConfig();
  if (!config || typeof value !== "string" || value.length > 2048) return null;
  const parts = value.split(".");
  if (parts.length !== 2 || !equal(parts[1], createHmac("sha256", config.signingKey).update(`${purpose}:${parts[0]}`).digest("base64url"))) return null;
  try { return JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8")); } catch { return null; }
}
export function newReviewerSession() {
  const config = reviewerConfig();
  if (!config) throw new Error("Acesso de avaliação indisponível.");
  const session: ReviewerSession = { scope: "whatsapp-test-only", id: randomUUID(), credential: config.passwordHash,
    exp: Math.min(Math.floor(Date.now() / 1000) + hour, Math.floor(Date.parse(config.expiresAt) / 1000)) };
  return { value: sign(session, "session"), maxAge: session.exp - Math.floor(Date.now() / 1000) };
}
export function readReviewerSession(value: unknown): ReviewerSession | null {
  const config = reviewerConfig();
  const parsed = sessionSchema.safeParse(decode(value, "session"));
  return config && parsed.success && parsed.data.exp > Date.now() / 1000 && parsed.data.credential === config.passwordHash ? parsed.data : null;
}

// One durable operation per kind/hour/credential, shared across login sessions.
// The existing DB primary key enforces this across concurrent Vercel instances.
export function reviewerOperationTicket(kind: "send" | "template", session: ReviewerSession) {
  const window = Math.floor(Date.now() / 1000 / hour);
  const digest = createHash("sha256").update(`${session.credential}:${kind}:${window}`).digest("hex");
  const id = `${digest.slice(0, 8)}-${digest.slice(8, 12)}-4${digest.slice(13, 16)}-a${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
  return sign({ id, kind, sessionId: session.id, exp: Math.min(session.exp, (window + 1) * hour) }, "operation");
}
export function readReviewerOperation(value: unknown, kind: "send" | "template", session: ReviewerSession) {
  const parsed = z.object({ id: z.uuid(), kind: z.literal(kind), sessionId: z.literal(session.id), exp: z.number().int() }).safeParse(decode(value, "operation"));
  return parsed.success && parsed.data.exp > Date.now() / 1000 && parsed.data.exp <= session.exp ? parsed.data.id : null;
}
