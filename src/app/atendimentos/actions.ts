"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { canAssumeConversation, canManageAiConversation, createConversationSchema, conversationMessageSchema, handoffSchema } from "@/lib/domain/conversation";
import { leadSchema, leadStatuses } from "@/lib/domain/lead";
import { requireLeadManager, requireUser } from "@/lib/auth";
import { sendCrmWhatsAppTemplate, sendHumanWhatsApp } from "@/lib/whatsapp-outbound";

export type ConversationFormState = { error?: string; success?: string; fieldErrors?: Record<string, string[]>; values?: Record<string, string>; version?: number };
export type LeadUpdateFormValues = Record<"leadId" | "conversationId" | "name" | "company" | "phone" | "source" | "eventType" | "desiredDate" | "guestCount" | "notes", string>;
export type LeadUpdateFormState = { error?: string; success?: string; fieldErrors?: Record<string, string[]>; values?: LeadUpdateFormValues; version?: number };

const updateLeadStatusSchema = z.object({
  leadId: z.string().uuid(),
  conversationId: z.string().uuid(),
  status: z.enum(leadStatuses),
  lostReason: z.string().trim().max(500).optional(),
}).superRefine((value, context) => {
  if (value.status === "perdido" && !value.lostReason) context.addIssue({ code: "custom", path: ["lostReason"], message: "Informe o motivo da perda." });
});

const transferConversationSchema = z.object({
  conversationId: z.string().uuid(),
  assigneeId: z.string().uuid(),
});

export async function createSimulatedConversation(_: ConversationFormState, formData: FormData): Promise<ConversationFormState> {
  const raw = {
    leadId: String(formData.get("leadId") ?? ""),
    body: String(formData.get("body") ?? ""),
    needsHuman: formData.get("needsHuman") ?? "false",
    handoffReason: String(formData.get("handoffReason") ?? ""),
  };
  const parsed = createConversationSchema.safeParse(raw);
  if (!parsed.success) return { error: "Revise a conversa simulada.", fieldErrors: parsed.error.flatten().fieldErrors, values: rawValues(raw), version: Date.now() };
  const { supabase, user } = await requireLeadManager();
  const status = parsed.data.needsHuman ? "awaiting_human" : "ai";
  const { data: conversation, error } = await supabase.from("conversations").insert({ lead_id: parsed.data.leadId, status, needs_human: parsed.data.needsHuman, handoff_reason: parsed.data.handoffReason ?? null, created_by: user.id }).select("id").single();
  if (error || !conversation) return { error: error?.message ?? "Não foi possível criar o atendimento.", values: rawValues(raw), version: Date.now() };
  await promoteLeadToAtendimento(supabase, parsed.data.leadId);
  await supabase.from("conversation_messages").insert([
    { conversation_id: conversation.id, author: "cliente", body: parsed.data.body },
    { conversation_id: conversation.id, author: "ia", body: parsed.data.needsHuman ? "Recebi as informações iniciais e sinalizei para um atendente humano assumir este atendimento." : "Recebi o contato e estou fazendo a triagem inicial. Vou coletar as informações principais antes de acionar a equipe." },
  ]);
  revalidatePath("/atendimentos");
  redirect(`/atendimentos/${conversation.id}`);
}

export async function addCustomerMessage(_: ConversationFormState, formData: FormData): Promise<ConversationFormState> {
  const parsed = conversationMessageSchema.safeParse({ conversationId: formData.get("conversationId"), body: formData.get("body") });
  if (!parsed.success) return { error: "Informe uma mensagem.", fieldErrors: parsed.error.flatten().fieldErrors, values: { body: String(formData.get("body") ?? "") }, version: Date.now() };
  const { supabase } = await requireLeadManager();
  const { data: conversation } = await supabase.from("conversations").select("id,status,ai_paused,channel").eq("id", parsed.data.conversationId).single();
  if (!conversation) return { error: "Atendimento não encontrado.", version: Date.now() };
  if (conversation.channel === "whatsapp_cloud") return { error: "Simulações não podem ser inseridas em uma conversa real do WhatsApp.", version: Date.now() };
  const messages = [{ conversation_id: parsed.data.conversationId, author: "cliente", body: parsed.data.body }];
  if (!conversation.ai_paused && conversation.status === "ai") messages.push({ conversation_id: parsed.data.conversationId, author: "ia", body: "Mensagem recebida. Continuo em triagem e vou sinalizar a equipe se houver decisão sensível ou necessidade humana." });
  const { error } = await supabase.from("conversation_messages").insert(messages);
  if (error) return { error: "Não foi possível registrar a mensagem.", values: { body: parsed.data.body }, version: Date.now() };
  revalidatePath(`/atendimentos/${parsed.data.conversationId}`);
  return { success: "Mensagem registrada.", version: Date.now() };
}

export async function addHumanMessage(_: ConversationFormState, formData: FormData): Promise<ConversationFormState> {
  const parsed = conversationMessageSchema.safeParse({ conversationId: formData.get("conversationId"), body: formData.get("body") });
  if (!parsed.success) return { error: "Informe uma resposta.", fieldErrors: parsed.error.flatten().fieldErrors, values: { body: String(formData.get("body") ?? "") }, version: Date.now() };

  const { supabase, user } = await requireConversationAttendant();
  const { data: conversation } = await supabase.from("conversations").select("id,status,lead_id,channel,external_contact_id,external_phone_number_id").eq("id", parsed.data.conversationId).single();
  if (!conversation) return { error: "Atendimento não encontrado.", version: Date.now() };
  if (conversation.status === "closed") return { error: "Este atendimento já foi encerrado.", values: { body: parsed.data.body }, version: Date.now() };

  const { error: updateError } = await supabase
    .from("conversations")
    .update({ status: "human", ai_paused: true, ai_paused_at: new Date().toISOString(), assigned_to: user.id, needs_human: false })
    .eq("id", parsed.data.conversationId);
  if (updateError) return { error: "Não foi possível assumir o atendimento antes de responder.", values: { body: parsed.data.body }, version: Date.now() };
  await promoteLeadToAtendimento(supabase, conversation.lead_id);

  if (conversation.channel === "whatsapp_cloud") {
    if (!conversation.external_contact_id || !conversation.external_phone_number_id) return { error: "Este atendimento não possui os identificadores necessários para envio pelo WhatsApp.", values: { body: parsed.data.body }, version: Date.now() };
    const requestId = z.string().uuid().safeParse(formData.get("requestId"));
    if (!requestId.success) return { error: "Recarregue a página para identificar esta tentativa de envio.", version: Date.now() };
    try {
      await sendHumanWhatsApp({ requestId: requestId.data, conversationId: conversation.id, actorId: user.id, body: parsed.data.body, phoneNumberId: conversation.external_phone_number_id, to: conversation.external_contact_id });
    } catch (error) {
      revalidatePath(`/atendimentos/${conversation.id}`);
      return { error: error instanceof Error ? error.message : "Não foi possível confirmar o envio pelo WhatsApp.", values: { body: parsed.data.body, requestId: requestId.data }, version: Date.now() };
    }
  } else {
    const { error } = await supabase
    .from("conversation_messages")
    .insert({ conversation_id: parsed.data.conversationId, author: "humano", actor_id: user.id, body: parsed.data.body });
    if (error) return { error: "Não foi possível registrar a resposta.", values: { body: parsed.data.body }, version: Date.now() };
  }

  revalidatePath("/atendimentos");
  revalidatePath(`/atendimentos/${parsed.data.conversationId}`);
  return { success: "Resposta enviada.", version: Date.now() };
}

export async function updateLeadFromConversation(_: LeadUpdateFormState, formData: FormData): Promise<LeadUpdateFormState> {
  const raw = leadUpdateFormValues(formData);
  const ids = z.object({ leadId: z.string().uuid(), conversationId: z.string().uuid() }).safeParse(raw);
  if (!ids.success) return { error: "Não foi possível identificar o lead deste atendimento.", values: raw, version: Date.now() };

  const parsed = leadSchema.omit({ responsibleId: true }).safeParse(raw);
  if (!parsed.success) return { error: "Revise os dados do lead.", fieldErrors: parsed.error.flatten().fieldErrors, values: raw, version: Date.now() };

  const { supabase } = await requireLeadManager();
  const input = parsed.data;
  const { error } = await supabase.rpc("update_lead_from_atendimento", {
    p_lead_id: ids.data.leadId,
    p_name: input.name,
    p_company: input.company ?? null,
    p_phone: input.phone,
    p_source: input.source ?? null,
    p_event_type: input.eventType ?? null,
    p_desired_date: input.desiredDate ?? null,
    p_guest_count: input.guestCount ?? null,
    p_notes: input.notes ?? null,
    p_create_event: Boolean(input.eventType || input.desiredDate || input.guestCount),
  });
  if (error) return { error: error.message, values: raw, version: Date.now() };

  revalidatePath("/painel");
  revalidatePath("/atendimentos");
  revalidatePath(`/leads/${ids.data.leadId}`);
  revalidatePath(`/atendimentos/${ids.data.conversationId}`);
  return { success: "Dados do lead atualizados.", version: Date.now() };
}

export async function updateLeadStatusFromConversation(_: LeadUpdateFormState, formData: FormData): Promise<LeadUpdateFormState> {
  const parsed = updateLeadStatusSchema.safeParse({
    leadId: formData.get("leadId"),
    conversationId: formData.get("conversationId"),
    status: formData.get("status"),
    lostReason: formData.get("lostReason"),
  });
  if (!parsed.success) return { error: "Selecione um status válido.", version: Date.now() };

  const { supabase } = await requireLeadManager();
  const { error } = await supabase.rpc("update_lead_status_from_atendimento", {
    p_lead_id: parsed.data.leadId,
    p_status: parsed.data.status,
    p_lost_reason: parsed.data.lostReason ?? null,
  });
  if (error) return { error: error.message, version: Date.now() };

  if (parsed.data.status === "ganho" || parsed.data.status === "perdido") {
    await supabase.from("conversation_messages").insert({
      conversation_id: parsed.data.conversationId,
      author: "sistema",
      body: `Status comercial marcado como ${parsed.data.status}. Se o atendimento estiver concluído, encerre a conversa.`,
    });
  }

  revalidatePath("/painel");
  revalidatePath("/atendimentos");
  revalidatePath(`/leads/${parsed.data.leadId}`);
  revalidatePath(`/atendimentos/${parsed.data.conversationId}`);
  return { success: "Status comercial atualizado.", version: Date.now() };
}

export async function transferConversation(formData: FormData) {
  const parsed = transferConversationSchema.safeParse({
    conversationId: formData.get("conversationId"),
    assigneeId: formData.get("assigneeId"),
  });
  if (!parsed.success) redirect("/atendimentos?error=invalid_transfer");

  const { supabase, user } = await requireConversationAttendant();
  const { data: assignee } = await supabase.from("profiles").select("id,display_name,is_active").eq("id", parsed.data.assigneeId).single();
  if (!assignee?.is_active) redirect(`/atendimentos/${parsed.data.conversationId}?error=transfer`);

  const { error: updateError } = await supabase
    .from("conversations")
    .update({ status: "human", ai_paused: true, ai_paused_at: new Date().toISOString(), assigned_to: parsed.data.assigneeId, needs_human: false })
    .eq("id", parsed.data.conversationId)
    .neq("status", "closed");
  if (updateError) redirect(`/atendimentos/${parsed.data.conversationId}?error=transfer`);

  const targetName = assignee.display_name ?? "outro atendente";
  await supabase.from("conversation_messages").insert({
    conversation_id: parsed.data.conversationId,
    author: "sistema",
    actor_id: user.id,
    body: `Atendimento transferido para ${targetName}.`,
  });

  revalidatePath("/atendimentos");
  revalidatePath(`/atendimentos/${parsed.data.conversationId}`);
  redirect(`/atendimentos/${parsed.data.conversationId}`);
}

export async function requestHumanHandoff(formData: FormData) {
  const parsed = parseHandoffForm(formData);
  if (!parsed.success) redirect("/atendimentos?error=invalid_action");
  const { supabase } = await requireLeadManager();
  const { error: updateError } = await supabase.from("conversations").update({ status: "awaiting_human", needs_human: true, handoff_reason: parsed.data.reason ?? "IA sinalizou necessidade de humano.", ai_transferred_at: new Date().toISOString() }).eq("id", parsed.data.conversationId).eq("status", "ai");
  if (updateError) redirect(`/atendimentos/${parsed.data.conversationId}?error=handoff`);
  const { error: messageError } = await supabase.from("conversation_messages").insert({ conversation_id: parsed.data.conversationId, author: "sistema", body: "IA sinalizou que este atendimento precisa de uma pessoa da equipe." });
  if (messageError) redirect(`/atendimentos/${parsed.data.conversationId}?error=handoff_message`);
  revalidatePath("/atendimentos");
  revalidatePath(`/atendimentos/${parsed.data.conversationId}`);
  redirect(`/atendimentos/${parsed.data.conversationId}`);
}

export async function assumeConversation(formData: FormData) {
  const parsed = parseHandoffForm(formData);
  if (!parsed.success) redirect("/atendimentos?error=invalid_action");
  const { supabase, user } = await requireConversationAttendant();
  const { data: conversation } = await supabase.from("conversations").select("lead_id,status").eq("id", parsed.data.conversationId).single();
  const { error: updateError } = await supabase.from("conversations").update({ status: "human", ai_paused: true, ai_paused_at: new Date().toISOString(), assigned_to: user.id, needs_human: false, handoff_reason: parsed.data.reason ?? null }).eq("id", parsed.data.conversationId).neq("status", "closed");
  if (updateError) redirect(`/atendimentos/${parsed.data.conversationId}?error=assume`);
  if (conversation?.lead_id) await promoteLeadToAtendimento(supabase, conversation.lead_id);
  const { error: messageError } = await supabase.from("conversation_messages").insert({ conversation_id: parsed.data.conversationId, author: "sistema", actor_id: user.id, body: `Atendimento assumido por humano. Estado anterior: ${conversation?.status ?? "não informado"}. Respostas automáticas da IA pausadas para esta conversa.` });
  if (messageError) redirect(`/atendimentos/${parsed.data.conversationId}?error=assume_message`);
  revalidatePath("/atendimentos");
  revalidatePath(`/atendimentos/${parsed.data.conversationId}`);
  redirect(`/atendimentos/${parsed.data.conversationId}`);
}

export async function closeConversation(formData: FormData) {
  const parsed = parseHandoffForm(formData);
  if (!parsed.success) redirect("/atendimentos?error=invalid_action");
  const { supabase, user } = await requireLeadManager();
  const { error: updateError } = await supabase.from("conversations").update({ status: "closed", ai_paused: true, ai_closed_at: new Date().toISOString(), assigned_to: user.id, needs_human: false }).eq("id", parsed.data.conversationId);
  if (updateError) redirect(`/atendimentos/${parsed.data.conversationId}?error=close`);
  const { error: messageError } = await supabase.from("conversation_messages").insert({ conversation_id: parsed.data.conversationId, author: "sistema", actor_id: user.id, body: "Atendimento encerrado." });
  if (messageError) redirect(`/atendimentos/${parsed.data.conversationId}?error=close_message`);
  revalidatePath("/atendimentos");
  revalidatePath(`/atendimentos/${parsed.data.conversationId}`);
  redirect(`/atendimentos/${parsed.data.conversationId}`);
}

const templateMessageSchema = z.object({ conversationId: z.string().uuid(), templateId: z.string().uuid(), requestId: z.string().uuid() });

export async function sendConversationTemplate(_: ConversationFormState, formData: FormData): Promise<ConversationFormState> {
  const parsed = templateMessageSchema.safeParse({ conversationId: formData.get("conversationId"), templateId: formData.get("templateId"), requestId: formData.get("requestId") });
  if (!parsed.success) return { error: "Recarregue a página antes de enviar o template.", version: Date.now() };
  const { supabase, user } = await requireConversationAttendant();
  const [{ data: conversation }, { data: template }] = await Promise.all([
    supabase.from("conversations").select("id,lead_id,status,external_contact_id,external_phone_number_id").eq("id", parsed.data.conversationId).maybeSingle(),
    supabase.from("crm_message_templates").select("id,title,body,whatsapp_template_name,whatsapp_template_language,is_active").eq("id", parsed.data.templateId).eq("channel", "whatsapp").maybeSingle(),
  ]);
  if (!conversation || conversation.status === "closed") return { error: "Este atendimento não está disponível para envio.", version: Date.now() };
  if (!conversation.external_contact_id || !conversation.external_phone_number_id) return { error: "Este atendimento não possui conexão oficial do WhatsApp.", version: Date.now() };
  if (!template?.is_active || !template.whatsapp_template_name) return { error: "O template aprovado selecionado não está configurado.", version: Date.now() };
  const { data: lead } = await supabase.from("leads").select("name").eq("id", conversation.lead_id).maybeSingle();
  const body = template.body.replaceAll("{{nome}}", lead?.name ?? "");
  const { error: reserveError } = await supabase.from("conversation_messages").insert({ id: parsed.data.requestId, conversation_id: conversation.id, author: "humano", actor_id: user.id, body, direction: "outbound", message_origin: "sunrise", message_type: "template", delivery_status: "pending" });
  if (reserveError) return { error: "Não foi possível registrar o envio do template.", version: Date.now() };
  try {
    await sendCrmWhatsAppTemplate({ messageId: parsed.data.requestId, conversationId: conversation.id, actorId: user.id, body, phoneNumberId: conversation.external_phone_number_id, to: conversation.external_contact_id, templateName: template.whatsapp_template_name, language: template.whatsapp_template_language ?? "pt_BR" });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível enviar o template.", version: Date.now() };
  }
  revalidatePath("/atendimentos"); revalidatePath(`/atendimentos/${conversation.id}`);
  return { success: "Template aprovado enviado. Aguarde a resposta do cliente para retomar mensagens livres.", version: Date.now() };
}

export async function pauseAiConversation(formData: FormData) {
  const parsed = parseHandoffForm(formData);
  if (!parsed.success) redirect("/atendimentos?error=invalid_action");
  const { supabase, user } = await requireConversationAttendant();
  const { error } = await supabase.from("conversations").update({ status: "paused_ai", ai_paused: true, ai_paused_at: new Date().toISOString(), needs_human: false }).eq("id", parsed.data.conversationId).eq("status", "ai");
  if (error) redirect(`/atendimentos/${parsed.data.conversationId}?error=pause`);
  await supabase.from("conversation_messages").insert({ conversation_id: parsed.data.conversationId, author: "sistema", actor_id: user.id, body: "IA pausada manualmente." });
  revalidatePath("/atendimentos");
  revalidatePath(`/atendimentos/${parsed.data.conversationId}`);
  redirect(`/atendimentos/${parsed.data.conversationId}`);
}

export async function resumeAiConversation(formData: FormData) {
  const parsed = parseHandoffForm(formData);
  if (!parsed.success) redirect("/atendimentos?error=invalid_action");
  const { supabase, user } = await requireAiManager();
  const { error } = await supabase.from("conversations").update({ status: "ai", ai_paused: false, needs_human: false, assigned_to: null, handoff_reason: null, ai_started_at: new Date().toISOString() }).eq("id", parsed.data.conversationId).eq("status", "paused_ai");
  if (error) redirect(`/atendimentos/${parsed.data.conversationId}?error=resume`);
  await supabase.from("conversation_messages").insert({ conversation_id: parsed.data.conversationId, author: "sistema", actor_id: user.id, body: "IA retomada por gestão. A próxima mensagem do cliente seguirá a triagem inicial." });
  revalidatePath("/atendimentos");
  revalidatePath(`/atendimentos/${parsed.data.conversationId}`);
  redirect(`/atendimentos/${parsed.data.conversationId}`);
}

function rawValues(values: { leadId: string; body: string; handoffReason?: string }) {
  return { leadId: values.leadId, body: values.body, handoffReason: values.handoffReason ?? "" };
}

function leadUpdateFormValues(formData: FormData): LeadUpdateFormValues {
  return {
    leadId: String(formData.get("leadId") ?? ""),
    conversationId: String(formData.get("conversationId") ?? ""),
    name: String(formData.get("name") ?? ""),
    company: String(formData.get("company") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    source: String(formData.get("source") ?? ""),
    eventType: String(formData.get("eventType") ?? ""),
    desiredDate: String(formData.get("desiredDate") ?? ""),
    guestCount: String(formData.get("guestCount") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  };
}

function parseHandoffForm(formData: FormData) {
  return handoffSchema.safeParse({
    conversationId: String(formData.get("conversationId") ?? ""),
    reason: String(formData.get("reason") ?? ""),
  });
}

async function promoteLeadToAtendimento(supabase: Awaited<ReturnType<typeof requireLeadManager>>["supabase"], leadId: string) {
  const { data: lead } = await supabase.from("leads").select("status").eq("id", leadId).single();
  if (lead?.status !== "novo") return;
  await supabase.rpc("update_lead_status_from_atendimento", {
    p_lead_id: leadId,
    p_status: "em_atendimento",
  });
}

async function requireConversationAttendant() {
  const context = await requireUser();
  if (!canAssumeConversation(context.permissions)) redirect("/painel?error=forbidden");
  return context;
}

async function requireAiManager() {
  const context = await requireUser();
  if (!canManageAiConversation(context.permissions)) redirect("/painel?error=forbidden");
  return context;
}
