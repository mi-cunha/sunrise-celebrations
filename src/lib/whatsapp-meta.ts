import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptWhatsAppToken } from "@/lib/whatsapp-credentials";

export function metaConfiguration() {
  const appId = process.env.NEXT_PUBLIC_META_APP_ID?.trim();
  const configId = process.env.NEXT_PUBLIC_WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID?.trim();
  const appSecret = process.env.WHATSAPP_APP_SECRET?.trim();
  const version = process.env.WHATSAPP_GRAPH_API_VERSION?.trim();
  const wabaId = process.env.WHATSAPP_ALLOWED_WABA_ID?.trim();
  const phoneNumberId = process.env.WHATSAPP_ALLOWED_PHONE_NUMBER_ID?.trim();
  if (!appId || !configId || !appSecret || !version || !/^v\d+\.\d+$/.test(version) || !wabaId || !phoneNumberId) {
    throw new Error("Configuração incompleta: informe app/configuração, segredo, versão Graph e WABA/Phone ID autorizados para este CRM.");
  }
  if (![appId, configId, wabaId, phoneNumberId].every((id) => /^\d+$/.test(id))) throw new Error("Identificadores da Meta inválidos.");
  return { appId, configId, appSecret, version, wabaId, phoneNumberId };
}

export class MetaRequestError extends Error {
  constructor(public code: number | undefined, public uncertain: boolean) {
    super(uncertain ? "A Meta não confirmou o resultado. Não repita a operação antes de verificar o estado." : `A Meta recusou a operação${code ? ` (código ${code})` : ""}. Consulte as permissões e a configuração do aplicativo.`);
  }
}

// No URLs, raw Graph errors, authorization codes or tokens in logs/errors.
export async function metaRequest(path: string, token: string, body?: Record<string, unknown>): Promise<unknown> {
  const { version } = metaConfiguration();
  let response: Response;
  try {
    response = await fetch(`https://graph.facebook.com/${version}/${path}`, {
      method: body ? "POST" : "GET",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
      cache: "no-store", signal: AbortSignal.timeout(15000),
    });
  } catch { throw new MetaRequestError(undefined, true); }
  let payload: unknown;
  try { payload = await response.json(); } catch { throw new MetaRequestError(undefined, true); }
  if (!response.ok) {
    const parsed = z.object({ error: z.object({ code: z.number().optional() }) }).safeParse(payload);
    throw new MetaRequestError(parsed.success ? parsed.data.error.code : undefined, response.status >= 500);
  }
  return payload;
}

export function isCoexistencePhone(phone: { is_on_biz_app?: boolean; platform_type?: string }) {
  return phone.is_on_biz_app === true && phone.platform_type === "CLOUD_API";
}

export async function connectionCredential(phoneNumberId: string) {
  const config = metaConfiguration();
  if (phoneNumberId !== config.phoneNumberId) throw new Error("Este número não está autorizado neste CRM.");
  const admin = createAdminClient();
  const { data: connection, error } = await admin.from("whatsapp_connections").select("id,status,waba_id").eq("phone_number_id", phoneNumberId).single();
  if (error || !connection || connection.status !== "connected" || connection.waba_id !== config.wabaId) throw new Error("Confirme a coexistência nas opções antes de enviar mensagens.");
  const { data: credential, error: credentialError } = await admin.from("whatsapp_connection_credentials").select("encrypted_token,app_id,expires_at").eq("connection_id", connection.id).single();
  if (credentialError || !credential || credential.app_id !== config.appId) throw new Error("A conexão não possui credencial válida para este aplicativo. Reconecte o WhatsApp.");
  if (credential.expires_at && Date.parse(credential.expires_at) <= Date.now()) throw new Error("A autorização expirou. Reconecte o WhatsApp.");
  return { connectionId: connection.id as string, token: decryptWhatsAppToken(credential.encrypted_token, `${config.appId}:${phoneNumberId}`), config };
}
