import { z } from "zod";
import { metaConfiguration, metaRequest, MetaRequestError } from "@/lib/whatsapp-meta";

const id = z.string().regex(/^\d+$/);
const configurationSchema = z.object({
  enabled: z.literal("true"), token: z.string().min(20), wabaId: id, phoneNumberId: id,
  recipient: z.string().regex(/^[1-9]\d{9,14}$/),
});
export const reviewTemplateSchema = z.object({
  name: z.string().trim().min(3).max(120).regex(/^[a-z0-9_]+$/),
  body: z.string().trim().min(10).max(1024),
});
const templateSchema = z.object({ id: z.string(), name: z.string(), status: z.string(), category: z.string(), language: z.string(), components: z.array(z.object({ type: z.string(), text: z.string().optional() })).optional() });
export type WhatsAppTemplateSummary = z.infer<typeof templateSchema>;
export type WhatsAppReviewStatus = { sender: string; recipient: string; tokenExpiresAt: string | null; templates: WhatsAppTemplateSummary[] };

function reviewConfiguration() {
  const result = configurationSchema.safeParse({
    enabled: process.env.WHATSAPP_REVIEW_ENABLED, token: process.env.WHATSAPP_REVIEW_ACCESS_TOKEN?.trim(),
    wabaId: process.env.WHATSAPP_REVIEW_WABA_ID?.trim(), phoneNumberId: process.env.WHATSAPP_REVIEW_PHONE_NUMBER_ID?.trim(),
    recipient: process.env.WHATSAPP_REVIEW_RECIPIENT?.trim(),
  });
  if (!result.success) throw new Error("Demonstração desativada ou incompleta: configure a credencial de teste e o destinatário autorizado no servidor.");
  if (result.data.phoneNumberId === process.env.WHATSAPP_ALLOWED_PHONE_NUMBER_ID?.trim() || result.data.wabaId === process.env.WHATSAPP_ALLOWED_WABA_ID?.trim()) {
    throw new Error("O ambiente de avaliação não pode usar o número ou a conta corporativa.");
  }
  return result.data;
}

export function hasWhatsAppReviewConfig() {
  try { reviewConfiguration(); return true; } catch { return false; }
}

// Every mutation rechecks the token's app/scopes and the SANDBOX phone's ownership.
// No connection row is created and no corporate phone is registered or changed.
export async function validateWhatsAppReview() {
  const config = reviewConfiguration();
  const app = metaConfiguration();
  const debug = z.object({ data: z.object({ app_id: z.string(), is_valid: z.boolean(), scopes: z.array(z.string()), expires_at: z.number().optional(), data_access_expires_at: z.number().optional() }) }).parse(
    await metaRequest(`debug_token?input_token=${encodeURIComponent(config.token)}`, `${app.appId}|${app.appSecret}`),
  ).data;
  const now = Date.now() / 1000;
  if (!debug.is_valid || debug.app_id !== app.appId || !["whatsapp_business_messaging", "whatsapp_business_management"].every(scope => debug.scopes.includes(scope)) || [debug.expires_at, debug.data_access_expires_at].some(expiry => expiry && expiry <= now)) {
    throw new Error("A credencial de teste expirou, pertence a outro app ou não possui as duas permissões do WhatsApp. Gere um token no crm-sun.");
  }
  const phones = z.object({ data: z.array(z.object({ id, account_mode: z.string(), display_phone_number: z.string() })) }).parse(
    await metaRequest(`${config.wabaId}/phone_numbers?fields=id,account_mode,display_phone_number&limit=100`, config.token),
  );
  const phone = phones.data.find(phone => phone.id === config.phoneNumberId && phone.account_mode === "SANDBOX");
  if (!phone) throw new Error("A Meta não confirmou um remetente SANDBOX nessa conta de teste. Nenhuma mensagem foi enviada.");
  return { config, sender: phone.display_phone_number, tokenExpiresAt: debug.expires_at ? new Date(debug.expires_at * 1000).toISOString() : null };
}

async function templatesFor(config: ReturnType<typeof reviewConfiguration>) {
  return z.object({ data: z.array(templateSchema) }).parse(await metaRequest(`${config.wabaId}/message_templates?fields=id,name,status,category,language,components&limit=100`, config.token)).data;
}

export async function getWhatsAppReviewStatus(): Promise<WhatsAppReviewStatus> {
  const { config, sender, tokenExpiresAt } = await validateWhatsAppReview();
  return { sender, recipient: config.recipient, tokenExpiresAt, templates: await templatesFor(config) };
}

export async function listWhatsAppReviewTemplates() {
  return (await getWhatsAppReviewStatus()).templates;
}

export function reviewHelloWorld(templates: WhatsAppTemplateSummary[]) {
  return templates.find(t => t.name === "hello_world" && t.language === "en_US" && t.status === "APPROVED");
}

export async function sendWhatsAppReviewMessage() {
  const { config } = await validateWhatsAppReview();
  if (!reviewHelloWorld(await templatesFor(config))) throw new Error("O modelo hello_world (en_US) não está aprovado na conta de teste. Nenhuma mensagem foi enviada.");
  const response = await metaRequest(`${config.phoneNumberId}/messages`, config.token, {
    messaging_product: "whatsapp", to: config.recipient, type: "template",
    template: { name: "hello_world", language: { code: "en_US" } },
  });
  const parsed = z.object({ messages: z.array(z.object({ id: z.string().min(1) })).min(1) }).safeParse(response);
  if (!parsed.success) throw new MetaRequestError(undefined, true);
  return parsed.data.messages[0].id;
}

export async function createWhatsAppReviewTemplate(input: { body: string; name: string }) {
  const { name, body } = reviewTemplateSchema.parse(input);
  const { config } = await validateWhatsAppReview();
  const response = await metaRequest(`${config.wabaId}/message_templates`, config.token, {
    name, language: "pt_BR", category: "UTILITY", components: [{ type: "BODY", text: body }],
  });
  const parsed = z.object({ id: z.string(), status: z.string().optional() }).safeParse(response);
  if (!parsed.success) throw new MetaRequestError(undefined, true);
  return parsed.data;
}

export function reviewError(error: unknown) {
  if (error instanceof z.ZodError) return "A Meta retornou dados inesperados. Confira o WhatsApp antes de repetir a operação.";
  if (error instanceof MetaRequestError || error instanceof Error && /^(Demonstração|O ambiente|A credencial|A Meta não confirmou|O modelo)/.test(error.message)) return error.message;
  return "Não foi possível concluir a demonstração. Confira o WhatsApp antes de tentar novamente.";
}
