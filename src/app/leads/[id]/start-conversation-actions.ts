"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireLeadManager } from "@/lib/auth";
import { sendCrmWhatsAppTemplate } from "@/lib/whatsapp-outbound";

export type StartConversationState = { error?: string; success?: string; conversationId?: string; values?: Record<string, string>; fieldErrors?: Record<string, string[]>; version?: number };

const schema = z.object({
  leadId: z.string().uuid(),
  templateId: z.string().uuid("Selecione uma mensagem-modelo."),
  body: z.string().trim().min(2, "A mensagem está vazia.").max(4000),
  confirmed: z.literal("on", { error: "Confirme a revisão antes de enviar." }),
});

export async function startConversationFromLead(_: StartConversationState, formData: FormData): Promise<StartConversationState> {
  const raw = { leadId: String(formData.get("leadId") ?? ""), templateId: String(formData.get("templateId") ?? ""), body: String(formData.get("body") ?? ""), confirmed: String(formData.get("confirmed") ?? "") };
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { error: "Revise a mensagem antes de enviar.", fieldErrors: parsed.error.flatten().fieldErrors, values: raw, version: Date.now() };

  const { supabase, user } = await requireLeadManager();
  const { data: template } = await supabase.from("crm_message_templates").select("id,whatsapp_template_name,whatsapp_template_language,is_active").eq("id", parsed.data.templateId).eq("channel", "whatsapp").maybeSingle();
  if (!template?.is_active) return { error: "A mensagem-modelo não está disponível.", values: raw, version: Date.now() };
  if (!template.whatsapp_template_name) return { error: "Este texto ainda não possui o nome técnico de um template aprovado na Meta. Configure-o antes de enviar.", values: raw, version: Date.now() };

  const { data: conversationId, error: createError } = await supabase.rpc("create_outbound_conversation", { p_lead_id: parsed.data.leadId, p_template_id: parsed.data.templateId, p_body: parsed.data.body });
  if (createError || !conversationId) return { error: translateError(createError?.message), values: raw, version: Date.now() };

  const [{ data: conversation }, { data: message }] = await Promise.all([
    supabase.from("conversations").select("external_contact_id,external_phone_number_id").eq("id", conversationId).single(),
    supabase.from("conversation_messages").select("id").eq("conversation_id", conversationId).eq("actor_id", user.id).eq("delivery_status", "pending").order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (!conversation?.external_contact_id || !conversation.external_phone_number_id || !message) return { error: "A conversa foi criada, mas não foi possível preparar o envio. Confira a conexão do WhatsApp.", conversationId, version: Date.now() };

  try {
    await sendCrmWhatsAppTemplate({ messageId: message.id, conversationId, actorId: user.id, body: parsed.data.body, phoneNumberId: conversation.external_phone_number_id, to: conversation.external_contact_id, templateName: template.whatsapp_template_name, language: template.whatsapp_template_language });
  } catch (error) {
    revalidatePath(`/atendimentos/${conversationId}`);
    return { error: error instanceof Error ? error.message : "Não foi possível confirmar o envio pelo WhatsApp.", conversationId, values: raw, version: Date.now() };
  }

  revalidatePath("/atendimentos");
  revalidatePath(`/atendimentos/${conversationId}`);
  revalidatePath(`/leads/${parsed.data.leadId}`);
  return { success: "Mensagem-modelo enviada e atendimento criado na Inbox.", conversationId, version: Date.now() };
}

function translateError(message?: string) {
  if (message?.includes("invalid phone")) return "O telefone do contato não é válido para o WhatsApp.";
  if (message?.includes("whatsapp connection unavailable")) return "Não há uma conexão ativa do WhatsApp oficial.";
  return "Não foi possível iniciar a conversa.";
}
