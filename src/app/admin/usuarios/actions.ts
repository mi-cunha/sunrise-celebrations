"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { permissions } from "@/lib/domain/lead";
import { requireUser } from "@/lib/auth";

const userAccessSchema = z.object({
  userId: z.string().uuid("Informe o UUID do usuário Auth."),
  displayName: z.string().trim().min(2, "Informe o nome.").max(120, "Nome muito longo."),
  isActive: z.preprocess((value) => value === "on" || value === "true", z.boolean()),
  permissions: z.array(z.enum(permissions)).min(1, "Selecione ao menos uma permissão."),
});

export type UserAccessFormState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string[]>;
  values?: Record<string, string>;
  version?: number;
};

export async function updateUserAccess(_: UserAccessFormState, formData: FormData): Promise<UserAccessFormState> {
  const raw = {
    userId: String(formData.get("userId") ?? ""),
    displayName: String(formData.get("displayName") ?? ""),
    isActive: formData.get("isActive") ?? "false",
    permissions: formData.getAll("permissions"),
  };
  const parsed = userAccessSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      error: "Revise os dados do usuário.",
      fieldErrors: parsed.error.flatten().fieldErrors,
      values: { userId: raw.userId, displayName: raw.displayName },
      version: Date.now(),
    };
  }

  const { supabase, permissions: currentPermissions } = await requireUser();
  if (!currentPermissions.includes("admin_owner")) return { error: "Apenas administradores podem gerenciar usuários.", version: Date.now() };

  const { error } = await supabase.rpc("admin_update_user_access", {
    p_user_id: parsed.data.userId,
    p_display_name: parsed.data.displayName,
    p_is_active: parsed.data.isActive,
    p_permissions: parsed.data.permissions,
  });
  if (error) return { error: error.message, values: { userId: raw.userId, displayName: raw.displayName }, version: Date.now() };

  revalidatePath("/admin/usuarios");
  return { success: "Usuário atualizado.", version: Date.now() };
}
