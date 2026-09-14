"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getReviewerSession } from "@/lib/meta-review-session";
import { newReviewerSession, reviewerCookie, reviewerCookieOptions, reviewerPasswordValid, reviewerPath, reviewerConfig, readReviewerOperation } from "@/lib/meta-review-access";
import { runReviewOperation } from "@/lib/whatsapp-review-operation";
import { createWhatsAppReviewTemplate, getWhatsAppReviewStatus, reviewError, reviewTemplateSchema, sendWhatsAppReviewMessage } from "@/lib/whatsapp-review";
import type { ReviewSendState } from "../admin/whatsapp-avaliacao/actions";
import type { WhatsAppTemplateFormState } from "../admin/opcoes/whatsapp-template-actions";

export async function reviewerLoginAction(_state: { error?: string }, form: FormData): Promise<{ error?: string }> {
  if (!reviewerPasswordValid(form.get("username"), form.get("password"))) return { error: "Credencial inválida, expirada ou acesso desativado." };
  const session = newReviewerSession();
  (await cookies()).set(reviewerCookie, session.value, { ...reviewerCookieOptions, maxAge: session.maxAge });
  redirect(reviewerPath);
}
export async function reviewerLogoutAction() {
  (await cookies()).set(reviewerCookie, "", { ...reviewerCookieOptions, maxAge: 0 });
  redirect(reviewerPath);
}
async function authorize(form: FormData, kind: "send" | "template") {
  const session = await getReviewerSession();
  const config = reviewerConfig();
  if (!session || !config) return null;
  const id = readReviewerOperation(form.get("operationId"), kind, session);
  return id ? { id, actorId: config.actorId } : null;
}
export async function reviewerSendAction(_state: ReviewSendState, form: FormData): Promise<ReviewSendState> {
  const grant = await authorize(form, "send");
  if (!grant) return { error: "Sessão ou autorização inválida. Entre novamente na avaliação." };
  if (!z.literal("on").safeParse(form.get("consent")).success) return { error: "Confirme o envio ao destinatário de teste autorizado." };
  try {
    await getWhatsAppReviewStatus(); // Don't consume the attempt while a token is expired.
    const result = await runReviewOperation(grant.id, grant.actorId, "send", sendWhatsAppReviewMessage);
    return result.error ? { error: `${result.error} A avaliação permite uma tentativa de envio por hora.` } : { messageId: result.metaId, warning: result.warning };
  } catch (error) { return { error: reviewError(error) }; }
}
export async function reviewerTemplateAction(_state: WhatsAppTemplateFormState, form: FormData): Promise<WhatsAppTemplateFormState> {
  const grant = await authorize(form, "template");
  if (!grant) return { error: "Sessão ou autorização inválida. Entre novamente na avaliação." };
  const input = reviewTemplateSchema.safeParse({ name: form.get("name"), body: form.get("body") });
  if (!input.success) return { error: "Revise o nome e o conteúdo do modelo.", fieldErrors: input.error.flatten().fieldErrors };
  try {
    await getWhatsAppReviewStatus();
    const result = await runReviewOperation(grant.id, grant.actorId, "template", async () => (await createWhatsAppReviewTemplate(input.data)).id);
    if (result.error) return { error: `${result.error} A avaliação permite uma tentativa de criação por hora.` };
    revalidatePath(reviewerPath);
    return { success: `Modelo criado na Meta. ID: ${result.metaId}. ${result.warning ?? "Confira o estado na lista abaixo."}` };
  } catch (error) { return { error: reviewError(error) }; }
}
