import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  try { return !!origin && new URL(origin).origin === new URL(request.url).origin; } catch { return false; }
}

export async function whatsappAdministrator() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Entre novamente." }, { status: 401 });
  const [{ data: profile }, { data: permissions }] = await Promise.all([
    supabase.from("profiles").select("is_active").eq("id", user.id).single(),
    supabase.from("user_permissions").select("permission").eq("user_id", user.id),
  ]);
  if (!profile?.is_active || !permissions?.some((item) => item.permission === "admin_owner")) return NextResponse.json({ error: "Apenas administradores ativos podem configurar o WhatsApp." }, { status: 403 });
  return null;
}
