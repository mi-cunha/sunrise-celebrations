import { z } from "zod";

export const conversationStatuses = ["ai", "awaiting_human", "human", "paused_ai", "closed"] as const;
export type ConversationStatus = (typeof conversationStatuses)[number];

export const conversationMessageAuthors = ["cliente", "ia", "humano", "sistema"] as const;
export type ConversationMessageAuthor = (typeof conversationMessageAuthors)[number];

export const conversationMessageSchema = z.object({
  conversationId: z.string().uuid(),
  body: z.string().trim().min(1, "Informe a mensagem.").max(4000),
});

export const createConversationSchema = z.object({
  leadId: z.string().uuid("Selecione um lead."),
  body: z.string().trim().min(1, "Informe a mensagem inicial.").max(4000),
  needsHuman: z.preprocess(value => value === "on" || value === "true", z.boolean()),
  handoffReason: z.string().trim().max(500).optional().transform(value => value || undefined),
});

export const handoffSchema = z.object({
  conversationId: z.string().uuid(),
  reason: z.string().trim().max(500).optional().transform(value => value || undefined),
});

export function conversationStatusLabel(status: string) {
  const labels: Record<string, string> = {
    ai: "IA atendendo",
    awaiting_human: "Aguardando humano",
    human: "Humano assumiu",
    paused_ai: "IA pausada",
    closed: "Encerrado",
  };
  return labels[status] ?? status;
}

export function canAssumeConversation(userPermissions: readonly string[]) {
  return userPermissions.includes("atendimento") || userPermissions.includes("gerencia") || userPermissions.includes("admin_owner");
}

export function canManageAiConversation(userPermissions: readonly string[]) {
  return userPermissions.includes("gerencia") || userPermissions.includes("admin_owner");
}
