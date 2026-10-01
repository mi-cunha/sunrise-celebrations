"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { canManageAiConversation } from "@/lib/domain/conversation";

const knowledgeSchema = z.object({ id: z.string().uuid().optional(), category: z.enum(["apresentacao", "institucional", "faq", "mini_wedding", "transicao_humano"]), title: z.string().trim().min(2).max(140), body: z.string().trim().min(2).max(6000), active: z.boolean() });

export async function saveAiKnowledge(formData: FormData) {
  const parsed = knowledgeSchema.safeParse({ id: String(formData.get("id") ?? "") || undefined, category: formData.get("category"), title: formData.get("title"), body: formData.get("body"), active: formData.get("active") === "on" });
  if (!parsed.success) return;
  const { supabase, user, permissions } = await requireUser();
  if (!canManageAiConversation(permissions)) return;
  const values = { category: parsed.data.category, title: parsed.data.title, body: parsed.data.body, is_active: parsed.data.active, updated_by: user.id };
  if (parsed.data.id) await supabase.from("ai_knowledge_entries").update(values).eq("id", parsed.data.id);
  else await supabase.from("ai_knowledge_entries").insert({ ...values, created_by: user.id });
  revalidatePath("/admin/ia");
}
