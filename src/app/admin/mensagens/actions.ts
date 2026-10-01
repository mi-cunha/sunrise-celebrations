"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";

const schema = z.object({ id: z.string().uuid(), title: z.string().trim().min(2).max(120), body: z.string().trim().min(2).max(4000), templateName: z.string().trim().regex(/^$|^[a-z0-9_]{1,512}$/, "Use apenas letras minúsculas, números e _."), active: z.preprocess((value) => value === "on", z.boolean()) });

export async function updateCrmMessageTemplate(formData: FormData) {
  const parsed = schema.safeParse({ id: formData.get("id"), title: formData.get("title"), body: formData.get("body"), templateName: formData.get("templateName"), active: formData.get("active") });
  if (!parsed.success) return;
  const { supabase, permissions } = await requireUser();
  if (!permissions.includes("admin_owner")) return;
  await supabase.from("crm_message_templates").update({ title: parsed.data.title, body: parsed.data.body, whatsapp_template_name: parsed.data.templateName || null, is_active: parsed.data.active }).eq("id", parsed.data.id);
  revalidatePath("/admin/mensagens");
  revalidatePath("/leads");
}

export async function setManagementCommissionRecipient(formData: FormData) {
  const recipient = z.string().uuid().nullable().safeParse(formData.get("recipientId") || null);
  if (!recipient.success) return;
  const { supabase, permissions } = await requireUser();
  if (!permissions.includes("admin_owner")) return;
  await supabase.from("company_settings").update({ management_commission_recipient_id: recipient.data }).eq("id", true);
  revalidatePath("/admin/mensagens");
}
