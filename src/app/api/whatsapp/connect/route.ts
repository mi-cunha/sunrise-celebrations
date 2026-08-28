import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const connectSchema = z.object({
  code: z.string().min(20).max(4000),
  wabaId: z.string().regex(/^\d+$/),
  phoneNumberId: z.string().regex(/^\d+$/).optional(),
});
const tokenSchema = z.object({ access_token: z.string().min(20) });
const phoneNumbersSchema = z.object({
  data: z.array(z.object({
    id: z.string().regex(/^\d+$/),
    display_phone_number: z.string().optional(),
    platform_type: z.string().optional(),
    is_on_biz_app: z.boolean().optional(),
  })),
});

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem da solicitação inválida." }, { status: 403 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sessão expirada. Entre novamente." }, { status: 401 });
  const { data: permissions } = await supabase.from("user_permissions").select("permission").eq("user_id", user.id);
  if (!(permissions ?? []).some(({ permission }) => permission === "admin_owner")) {
    return NextResponse.json({ error: "Apenas administradores podem conectar o WhatsApp." }, { status: 403 });
  }

  let input: z.infer<typeof connectSchema>;
  try {
    input = connectSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "A Meta não retornou os identificadores esperados. Reinicie a conexão." }, { status: 400 });
  }

  try {
    const appId = process.env.NEXT_PUBLIC_META_APP_ID;
    const appSecret = process.env.WHATSAPP_APP_SECRET;
    const version = process.env.WHATSAPP_GRAPH_API_VERSION;
    if (!appId || !appSecret || !version || !/^v\d+\.\d+$/.test(version)) throw new Error("Configuração da Meta incompleta na Vercel.");

    const tokenResponse = await fetch(`https://graph.facebook.com/${version}/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: appId, client_secret: appSecret, code: input.code }),
      cache: "no-store",
    });
    const tokenPayload: unknown = await tokenResponse.json();
    const token = tokenSchema.safeParse(tokenPayload);
    if (!tokenResponse.ok || !token.success) throw new Error(graphError(tokenPayload, "A Meta recusou o código de autorização."));

    const phonesResponse = await fetch(`https://graph.facebook.com/${version}/${input.wabaId}/phone_numbers?fields=id,display_phone_number,platform_type,is_on_biz_app`, {
      headers: { Authorization: `Bearer ${token.data.access_token}` },
      cache: "no-store",
    });
    const phonesPayload: unknown = await phonesResponse.json();
    const phones = phoneNumbersSchema.safeParse(phonesPayload);
    if (!phonesResponse.ok || !phones.success) throw new Error(graphError(phonesPayload, "Não foi possível consultar o número autorizado."));

    const selectedPhone = input.phoneNumberId
      ? phones.data.data.find((phone) => phone.id === input.phoneNumberId)
      : phones.data.data.find((phone) => phone.is_on_biz_app) ?? (phones.data.data.length === 1 ? phones.data.data[0] : undefined);
    if (!selectedPhone) throw new Error("A conta possui mais de um número. A Meta não informou qual deles foi autorizado; será necessário confirmar o Phone Number ID.");

    const admin = createAdminClient();
    const { data: byPhone } = await admin.from("whatsapp_connections").select("id").eq("phone_number_id", selectedPhone.id).maybeSingle();
    const { data: byWaba } = byPhone ? { data: null } : await admin.from("whatsapp_connections").select("id").eq("waba_id", input.wabaId).order("updated_at", { ascending: false }).limit(1).maybeSingle();
    const connectionId = byPhone?.id ?? byWaba?.id;
    const values = {
      waba_id: input.wabaId,
      phone_number_id: selectedPhone.id,
      display_phone_number: selectedPhone.display_phone_number ?? null,
      mode: "coexistence",
      status: "connected",
      business_app_state: selectedPhone.is_on_biz_app ? "WhatsApp Business ativo" : selectedPhone.platform_type ?? "Cloud API",
      connected_at: new Date().toISOString(),
      last_webhook_at: new Date().toISOString(),
    };
    const result = connectionId
      ? await admin.from("whatsapp_connections").update(values).eq("id", connectionId)
      : await admin.from("whatsapp_connections").insert(values);
    if (result.error) throw new Error(`Não foi possível salvar a conexão: ${result.error.message}`);

    return NextResponse.json({ connected: true, wabaId: input.wabaId, phoneNumberId: selectedPhone.id, displayPhoneNumber: selectedPhone.display_phone_number ?? null });
  } catch (error) {
    console.error("[whatsapp:connect] failed", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível concluir a conexão." }, { status: 502 });
  }
}

function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !host) return false;
  try { return new URL(origin).host === host; } catch { return false; }
}

function graphError(payload: unknown, fallback: string) {
  const parsed = z.object({ error: z.object({ message: z.string().optional() }).optional() }).safeParse(payload);
  return parsed.success ? parsed.data.error?.message ?? fallback : fallback;
}
