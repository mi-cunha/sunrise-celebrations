import { redirect } from "next/navigation";
import { canManageLeads, type Permission } from "@/lib/domain/lead";
import { createClient } from "@/lib/supabase/server";

export async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("id, display_name, is_active").eq("id", user.id).single();
  if (!profile) redirect("/login?error=missing_profile");
  if (!profile.is_active) redirect("/login?error=inactive");
  const { data: permissionRows } = await supabase.from("user_permissions").select("permission").eq("user_id", user.id);
  return { supabase, user, profile, permissions: (permissionRows ?? []).map(row => row.permission as Permission) };
}

export async function requireLeadManager() {
  const context = await requireUser();
  if (!canManageLeads(context.permissions)) redirect("/painel?error=forbidden");
  return context;
}
