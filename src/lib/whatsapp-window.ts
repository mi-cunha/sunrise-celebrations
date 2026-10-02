export type WhatsAppWindowState = "active" | "closing" | "expired" | "not_started";

export type WhatsAppWindow = { state: WhatsAppWindowState; lastInboundAt: string | null; expiresAt: string | null; remainingMs: number };

const WINDOW_MS = 24 * 60 * 60 * 1000;
const CLOSING_MS = 2 * 60 * 60 * 1000;

export function getWhatsAppWindow(lastInboundAt: string | null, now = Date.now()): WhatsAppWindow {
  if (!lastInboundAt) return { state: "not_started", lastInboundAt: null, expiresAt: null, remainingMs: 0 };
  const last = Date.parse(lastInboundAt);
  const remainingMs = Number.isFinite(last) ? last + WINDOW_MS - now : 0;
  const expiresAt = Number.isFinite(last) ? new Date(last + WINDOW_MS).toISOString() : null;
  if (remainingMs <= 0) return { state: "expired", lastInboundAt, expiresAt, remainingMs: 0 };
  return { state: remainingMs < CLOSING_MS ? "closing" : "active", lastInboundAt, expiresAt, remainingMs };
}

export function canSendFreeWhatsApp(window: WhatsAppWindow) { return window.state === "active" || window.state === "closing"; }

export function whatsappWindowLabel(window: WhatsAppWindow) {
  if (window.state === "active") return "Janela de atendimento ativa";
  if (window.state === "closing") return "Janela de atendimento próxima de encerrar";
  if (window.state === "expired") return "Janela de atendimento encerrada";
  return "Conversa ainda não iniciada";
}
