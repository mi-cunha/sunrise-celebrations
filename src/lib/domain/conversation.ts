import { z } from "zod";

export const conversationStatuses = ["ia_triagem", "aguardando_humano", "humano_assumiu", "encerrado"] as const;
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
    ia_triagem: "IA em triagem",
    aguardando_humano: "Aguardando humano",
    humano_assumiu: "Humano assumiu",
    encerrado: "Encerrado",
  };
  return labels[status] ?? status;
}
