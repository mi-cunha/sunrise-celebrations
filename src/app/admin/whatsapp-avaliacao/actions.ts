"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { sendWhatsAppReviewMessage, reviewError } from "@/lib/whatsapp-review";
import { runReviewOperation } from "@/lib/whatsapp-review-operation";

export type ReviewSendState = { error?: string; messageId?: string; warning?: string };
export async function sendReviewMessageAction(_state: ReviewSendState, form: FormData): Promise<ReviewSendState> {
  const { user, permissions } = await requireUser();
  if (!permissions.includes("admin_owner")) return { error: "Apenas administradores podem executar a demonstração." };
  const input = z.object({ operationId: z.uuid(), consent: z.literal("on") }).safeParse({ operationId: form.get("operationId"), consent: form.get("consent") });
  if (!input.success) return { error: "Confirme o destinatário e atualize a página antes de enviar." };
  try {
    const result = await runReviewOperation(input.data.operationId, user.id, "send", sendWhatsAppReviewMessage);
    return result.error ? { error: result.error } : { messageId: result.metaId, warning: result.warning };
  } catch (error) { return { error: reviewError(error) }; }
}
