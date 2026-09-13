"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createWhatsAppReviewTemplate, reviewError } from "@/lib/whatsapp-review";
import { runReviewOperation } from "@/lib/whatsapp-review-operation";

const templateSchema = z.object({
  name: z.string().trim().min(3, "Informe um nome com ao menos 3 caracteres.").max(120).regex(/^[a-z0-9_]+$/, "Use apenas letras minúsculas, números e sublinhado."),
  body: z.string().trim().min(10, "Informe uma mensagem com ao menos 10 caracteres.").max(1024, "Use até 1.024 caracteres."),
});

export type WhatsAppTemplateFormState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string[]>;
};

export async function createWhatsAppTemplateAction(_state: WhatsAppTemplateFormState, formData: FormData): Promise<WhatsAppTemplateFormState> {
  const { permissions, user } = await requireUser();
  if (!permissions.includes("admin_owner")) return { error: "Apenas administradores podem gerenciar modelos do WhatsApp." };

  const parsed = templateSchema.safeParse({ name: formData.get("name"), body: formData.get("body") });
  if (!parsed.success) return { error: "Revise os campos indicados.", fieldErrors: parsed.error.flatten().fieldErrors };
  const operationId = z.uuid().safeParse(formData.get("operationId"));
  if (!operationId.success) return { error: "Atualize a página antes de criar o modelo." };

  try {
    const result = await runReviewOperation(operationId.data, user.id, "template", async () => (await createWhatsAppReviewTemplate(parsed.data)).id);
    if (result.error) return { error: result.error };
    revalidatePath("/admin/opcoes");
    revalidatePath("/admin/whatsapp-avaliacao");
    return { success: `Modelo criado na Meta. ID: ${result.metaId}. ${result.warning ?? "O status de aprovação aparece na lista abaixo."}` };
  } catch (error) {
    return { error: reviewError(error) };
  }
}
