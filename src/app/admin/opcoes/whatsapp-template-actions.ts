"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createWhatsAppReviewTemplate } from "@/lib/whatsapp";

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
  const { permissions } = await requireUser();
  if (!permissions.includes("admin_owner")) return { error: "Apenas administradores podem gerenciar modelos do WhatsApp." };

  const parsed = templateSchema.safeParse({ name: formData.get("name"), body: formData.get("body") });
  if (!parsed.success) return { error: "Revise os campos indicados.", fieldErrors: parsed.error.flatten().fieldErrors };

  try {
    const result = await createWhatsAppReviewTemplate(parsed.data);
    revalidatePath("/admin/opcoes");
    return { success: `Modelo enviado à Meta${result.status ? ` com status ${result.status}` : ""}.` };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível criar o modelo." };
  }
}
