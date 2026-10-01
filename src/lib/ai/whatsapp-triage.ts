import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsAppText } from "@/lib/whatsapp";
import { MetaRequestError } from "@/lib/whatsapp-meta";
import { analyzeInitialTriage, configuredModel, openAiProvider, type AiTriageResult, type AuthorizedKnowledge } from "./triage";

type ConversationRow = { id: string; lead_id: string; status: string; ai_paused: boolean; external_contact_id: string | null; external_phone_number_id: string | null };

export async function processInboundWhatsAppAi(externalMessageId: string) {
  const admin = createAdminClient();
  const { data: inbound } = await admin.from("conversation_messages").select("id,body,conversation_id").eq("external_message_id", externalMessageId).eq("direction", "inbound").maybeSingle();
  if (!inbound) return;
  const { data: conversation } = await admin.from("conversations").select("id,lead_id,status,ai_paused,external_contact_id,external_phone_number_id").eq("id", inbound.conversation_id).maybeSingle();
  if (!conversation) return;
  const current = conversation as ConversationRow;

  const { data: turn, error: claimError } = await admin.from("conversation_ai_turns").insert({
    conversation_id: current.id,
    inbound_message_id: inbound.id,
    provider: process.env.SUNRISE_AI_API_KEY?.trim() ? "openai" : "unconfigured",
    model: process.env.SUNRISE_AI_API_KEY?.trim() ? configuredModel() : null,
    instruction_version: "sunrise-initial-triage-v1",
    decision: "skipped",
  }).select("id").maybeSingle();
  if (claimError?.code === "23505") return;
  if (claimError || !turn) return;

  if (!canRunAiTriage(current.status, current.ai_paused) || !current.external_contact_id || !current.external_phone_number_id) {
    await admin.from("conversation_ai_turns").update({ decision: "skipped", completed_at: new Date().toISOString() }).eq("id", turn.id);
    return;
  }

  try {
    const [{ data: messages }, { data: knowledge }] = await Promise.all([
      admin.from("conversation_messages").select("author,body").eq("conversation_id", current.id).order("created_at", { ascending: false }).limit(8),
      admin.from("ai_knowledge_entries").select("title,body,category").eq("is_active", true).order("category").order("updated_at", { ascending: false }),
    ]);
    const provider = process.env.SUNRISE_AI_API_KEY?.trim() ? openAiProvider : async () => { throw new Error("OpenAI not configured"); };
    const result = await analyzeInitialTriage({
      message: inbound.body,
      history: (messages ?? []).reverse().map((message) => `${message.author}: ${message.body}`).slice(-6),
      knowledge: (knowledge ?? []) as AuthorizedKnowledge[],
      provider,
    });
    await persistTriage(current, result);
    if (result.reply) await sendAiMessage({ conversation: current, inboundMessageId: inbound.id, body: result.reply });
    await admin.from("conversation_ai_turns").update({
      provider: result.provider,
      model: result.model ?? null,
      decision: result.decision,
      confidence: result.confidence,
      response_body: result.reply ?? null,
      extracted_data: extractedData(result),
      handoff_reason: result.handoffReason ?? null,
      completed_at: new Date().toISOString(),
    }).eq("id", turn.id);
  } catch {
    await moveToHuman(current, "A triagem automática não pôde concluir o atendimento com segurança.");
    await admin.from("conversation_ai_turns").update({ decision: "failed", handoff_reason: "Falha técnica segura; encaminhado para humano.", completed_at: new Date().toISOString() }).eq("id", turn.id);
  }
}

async function persistTriage(conversation: ConversationRow, result: AiTriageResult) {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const status = result.decision === "handoff" ? "awaiting_human" : "ai";
  const { data: existingLead } = await admin.from("leads").select("event_type,guest_count").eq("id", conversation.lead_id).maybeSingle();
  const leadUpdates: Record<string, string | number> = {};
  if (!existingLead?.event_type && result.eventType) leadUpdates.event_type = result.eventType;
  if (!existingLead?.guest_count && result.guestCount) leadUpdates.guest_count = result.guestCount;
  if (Object.keys(leadUpdates).length) await admin.from("leads").update(leadUpdates).eq("id", conversation.lead_id);
  await admin.from("conversation_ai_triage").upsert({
    conversation_id: conversation.id, lead_id: conversation.lead_id, identified_event_type: result.eventType ?? null,
    desired_period: result.desiredPeriod ?? null, guest_count: result.guestCount ?? null, observations: result.observations ?? null,
    intent: result.intent, missing_data: result.missingData, conversation_summary: result.summary, suggested_next_action: result.nextAction,
    confidence: result.confidence, handoff_reason: result.handoffReason ?? null, ai_status: status,
    transferred_at: result.decision === "handoff" ? now : null, updated_at: now,
  }, { onConflict: "conversation_id" });
  if (result.decision === "handoff") await moveToHuman(conversation, result.handoffReason ?? "A equipe precisa continuar este atendimento.");
}

async function moveToHuman(conversation: ConversationRow, reason: string) {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  await admin.from("conversations").update({ status: "awaiting_human", needs_human: true, ai_paused: false, handoff_reason: reason, ai_transferred_at: now }).eq("id", conversation.id).eq("status", "ai");
}

async function sendAiMessage(input: { conversation: ConversationRow; inboundMessageId: string; body: string }) {
  const admin = createAdminClient();
  const automationKey = automationKeyFor(input.inboundMessageId);
  const messageId = randomUUID();
  const { error: reservationError } = await admin.from("conversation_messages").insert({
    id: messageId, conversation_id: input.conversation.id, author: "ia", body: input.body, direction: "outbound",
    message_origin: "sunrise", message_type: "text", delivery_status: "pending", automation_key: automationKey,
  });
  if (reservationError?.code === "23505") return;
  if (reservationError) throw new Error("AI outbound reservation failed");
  try {
    const externalId = await sendWhatsAppText({ body: input.body, phoneNumberId: input.conversation.external_phone_number_id!, to: input.conversation.external_contact_id! });
    await admin.from("conversation_messages").update({ external_message_id: externalId, delivery_status: "sent", sent_at: new Date().toISOString() }).eq("id", messageId);
    await admin.rpc("apply_whatsapp_status", { p_id: externalId, p_phone: input.conversation.external_phone_number_id, p_status: "sent", p_at: new Date().toISOString() });
  } catch (error) {
    const rejected = error instanceof MetaRequestError && !error.uncertain;
    await admin.from("conversation_messages").update({ delivery_status: rejected ? "failed" : "unknown", failure_reason: rejected ? "ai_message_rejected" : "ai_confirmation_missing", ...(rejected ? { failed_at: new Date().toISOString() } : {}) }).eq("id", messageId);
    throw error;
  }
}

export function canRunAiTriage(status: string, aiPaused: boolean) {
  return status === "ai" && !aiPaused;
}

export function automationKeyFor(inboundMessageId: string) {
  return `ai:${inboundMessageId}`;
}

function extractedData(result: AiTriageResult) {
  return { eventType: result.eventType, desiredPeriod: result.desiredPeriod, guestCount: result.guestCount, observations: result.observations, intent: result.intent, missingData: result.missingData, summary: result.summary, nextAction: result.nextAction };
}
