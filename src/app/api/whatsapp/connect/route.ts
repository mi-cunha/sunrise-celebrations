import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { whatsappAdministrator, sameOrigin } from "@/lib/whatsapp-auth";
import { encryptWhatsAppToken, validateCredentialEncryption } from "@/lib/whatsapp-credentials";
import { isCoexistencePhone, metaConfiguration, metaRequest } from "@/lib/whatsapp-meta";

export const runtime = "nodejs";
export const maxDuration = 60;
const connectSchema = z.object({ code: z.string().min(20).max(4000), wabaId: z.string().regex(/^\d+$/).optional(), phoneNumberId: z.string().regex(/^\d+$/).optional() });
const phoneSchema = z.object({ id: z.string(), display_phone_number: z.string().optional(), platform_type: z.string().optional(), is_on_biz_app: z.boolean().optional() });

// Check dependencies before consuming a one-use authorization code.
export async function GET() {
  const denied = await whatsappAdministrator();
  if (denied) return denied;
  try {
    const config = metaConfiguration();
    validateCredentialEncryption();
    const admin = createAdminClient();
    const { error } = await admin.from("whatsapp_connection_credentials").select("connection_id").limit(0);
    const { error: syncError } = await admin.from("whatsapp_sync_requests").select("connection_id").limit(0);
    if (error || syncError) throw new Error("Aplique a migração de validação da coexistência antes de conectar.");
    await metaRequest(`${config.appId}?fields=id,name`, `${config.appId}|${config.appSecret}`);
    return NextResponse.json({ ready: true, appId: config.appId, configId: config.configId }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  const denied = await whatsappAdministrator();
  if (denied) return denied;
  const input = connectSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: "A Meta não retornou os identificadores esperados. Reinicie a conexão." }, { status: 400 });
  try {
    const config = metaConfiguration();
    validateCredentialEncryption();
    // Session postMessage may be missing. Never trust client asset IDs: the
    // exchanged token must still access the server-allowlisted WABA and phone.
    if ((input.data.wabaId && input.data.wabaId !== config.wabaId) || (input.data.phoneNumberId && input.data.phoneNumberId !== config.phoneNumberId)) return NextResponse.json({ error: "Selecione a conta e o número autorizados para este CRM." }, { status: 403 });
    const admin = createAdminClient();
    const { error: schemaError } = await admin.from("whatsapp_connection_credentials").select("connection_id").limit(0);
    if (schemaError) throw new Error("Migração de credenciais não aplicada. O código não foi utilizado.");
    const response = await fetch(`https://graph.facebook.com/${config.version}/oauth/access_token`, {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: config.appId, client_secret: config.appSecret, code: input.data.code }),
      cache: "no-store", signal: AbortSignal.timeout(15000),
    });
    const token = z.object({ access_token: z.string().min(20), expires_in: z.number().optional() }).safeParse(await response.json());
    if (!response.ok || !token.success) throw new Error("A Meta recusou o código. Confirme que App ID, configuração de login e App Secret pertencem ao mesmo aplicativo e reinicie o cadastro.");
    const debug = z.object({ data: z.object({ app_id: z.string(), is_valid: z.boolean(), scopes: z.array(z.string()).optional() }) }).parse(
      await metaRequest(`debug_token?input_token=${encodeURIComponent(token.data.access_token)}`, `${config.appId}|${config.appSecret}`),
    ).data;
    if (!debug.is_valid || debug.app_id !== config.appId || !["whatsapp_business_management", "whatsapp_business_messaging"].every((scope) => debug.scopes?.includes(scope))) throw new Error("A autorização não pertence a este aplicativo ou faltam permissões do WhatsApp.");
    const phones = z.object({ data: z.array(phoneSchema) }).parse(await metaRequest(`${config.wabaId}/phone_numbers?fields=id,display_phone_number,platform_type,is_on_biz_app&limit=100`, token.data.access_token));
    const phone = phones.data.find((item) => item.id === config.phoneNumberId);
    if (!phone) throw new Error("O número autorizado não pertence à WABA selecionada.");
    // Never call /register: that is not the Business App coexistence flow.
    const coexists = isCoexistencePhone(phone);
    const { data: existing, error: lookupError } = await admin.from("whatsapp_connections").select("id,onboarding_id,connected_at,created_at").eq("phone_number_id", phone.id).maybeSingle();
    if (lookupError) throw new Error("Não foi possível consultar a conexão.");
    // Reauthorizing does not prove a new Meta onboarding or reopen its 24h window.
    const connectedAt = existing?.connected_at ?? existing?.created_at ?? new Date().toISOString();
    const values = { waba_id: config.wabaId, phone_number_id: phone.id, display_phone_number: phone.display_phone_number ?? null, mode: "coexistence", status: "pending", onboarding_id: existing?.onboarding_id ?? randomUUID(), business_app_state: `${phone.is_on_biz_app ? "Business App ativo" : "Business App não confirmado"} · ${phone.platform_type ?? "plataforma desconhecida"}` };
    const saved = existing
      ? await admin.from("whatsapp_connections").update(values).eq("id", existing.id).select("id").single()
      : await admin.from("whatsapp_connections").insert(values).select("id").single();
    if (saved.error || !saved.data) throw new Error("Não foi possível salvar a conexão.");
    const { error: credentialError } = await admin.from("whatsapp_connection_credentials").upsert({ connection_id: saved.data.id, app_id: config.appId, encrypted_token: encryptWhatsAppToken(token.data.access_token, `${config.appId}:${phone.id}`), expires_at: token.data.expires_in ? new Date(Date.now() + token.data.expires_in * 1000).toISOString() : null, updated_at: new Date().toISOString() });
    if (credentialError) throw new Error("Não foi possível guardar a autorização com segurança. Reconecte após corrigir o banco.");
    if (!coexists) return NextResponse.json({ connected: false, error: "Autorização salva, mas a Meta ainda não confirma coexistência: is_on_biz_app precisa ser true e platform_type CLOUD_API. Nenhuma migração ou registro do número foi realizado." }, { status: 409 });
    const subscriptionSchema = z.object({ data: z.array(z.object({ whatsapp_business_api_data: z.object({ id: z.string() }) })) });
    let subscriptions = subscriptionSchema.parse(await metaRequest(`${config.wabaId}/subscribed_apps`, token.data.access_token));
    if (!subscriptions.data.some((item) => item.whatsapp_business_api_data.id === config.appId)) {
      await metaRequest(`${config.wabaId}/subscribed_apps`, token.data.access_token, {});
      subscriptions = subscriptionSchema.parse(await metaRequest(`${config.wabaId}/subscribed_apps`, token.data.access_token));
    }
    if (!subscriptions.data.some((item) => item.whatsapp_business_api_data.id === config.appId)) throw new Error("O aplicativo ainda não está inscrito nos eventos desta WABA.");
    const { error: connectedError } = await admin.from("whatsapp_connections").update({ status: "connected", connected_at: connectedAt }).eq("id", saved.data.id);
    if (connectedError) throw new Error("A Meta confirmou, mas o CRM não conseguiu salvar o estado final.");
    return NextResponse.json({ connected: true, phoneNumberId: phone.id });
  } catch (error) { return failure(error); }
}

function failure(error: unknown) {
  const message = error instanceof Error && !(error instanceof z.ZodError) ? error.message : "A Meta retornou um formato inesperado. Verifique o cadastro antes de repetir.";
  return NextResponse.json({ error: message }, { status: 502 });
}
