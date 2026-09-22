"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireLeadManager } from "@/lib/auth";
import { followUpSchema, leadSchema, leadStatusChangeSchema } from "@/lib/domain/lead";

export type LeadDetailUpdateValues = Record<"leadId" | "name" | "company" | "phone" | "source" | "eventType" | "desiredDate" | "guestCount" | "budgetRange" | "responsibleId" | "notes", string>;
export type LeadDetailUpdateState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string[]>;
  values?: LeadDetailUpdateValues;
  version?: number;
};

export type LeadFollowUpState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string[]>;
  values?: Record<"nextAction" | "nextActionAt" | "nextActionAssigneeId", string>;
  version?: number;
};
export type LeadStatusChangeState = { error?: string; success?: string; fieldErrors?: Record<string, string[]>; version?: number };

export async function updateLeadFromDetail(_: LeadDetailUpdateState, formData: FormData): Promise<LeadDetailUpdateState> {
  const raw = leadUpdateValues(formData);
  const id = z.string().uuid().safeParse(raw.leadId);
  if (!id.success) return { error: "Não foi possível identificar o lead.", values: raw, version: Date.now() };

  const parsed = leadSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      error: "Revise os dados do lead.",
      fieldErrors: parsed.error.flatten().fieldErrors,
      values: raw,
      version: Date.now(),
    };
  }

  const { supabase } = await requireLeadManager();
  const input = parsed.data;
  const { error } = await supabase.rpc("update_lead_crm_details", {
    p_lead_id: id.data,
    p_name: input.name,
    p_company: input.company ?? null,
    p_phone: input.phone,
    p_source: input.source ?? null,
    p_event_type: input.eventType ?? null,
    p_desired_date: input.desiredDate ?? null,
    p_guest_count: input.guestCount ?? null,
    p_notes: input.notes ?? null,
    p_budget_range: input.budgetRange ?? null,
    p_responsible_id: input.responsibleId ?? null,
  });

  if (error) return { error: error.message, values: raw, version: Date.now() };

  revalidatePath("/painel");
  revalidatePath(`/leads/${id.data}`);
  return { success: "Lead atualizado.", version: Date.now() };
}

export async function changeLeadStatus(_: LeadStatusChangeState, formData: FormData): Promise<LeadStatusChangeState> {
  const parsed = leadStatusChangeSchema.safeParse({ leadId: formData.get("leadId"), status: formData.get("status"), lostReason: formData.get("lostReason") });
  if (!parsed.success) return { error: "Revise a alteração de etapa.", fieldErrors: parsed.error.flatten().fieldErrors, version: Date.now() };
  const { supabase } = await requireLeadManager();
  const { error } = await supabase.rpc("update_lead_status_from_atendimento", { p_lead_id: parsed.data.leadId, p_status: parsed.data.status, p_lost_reason: parsed.data.lostReason ?? null });
  if (error) return { error: error.message.includes("lost reason") ? "Informe o motivo da perda." : "Não foi possível atualizar a etapa.", version: Date.now() };
  revalidatePath("/crm"); revalidatePath("/painel"); revalidatePath(`/leads/${parsed.data.leadId}`);
  return { success: "Etapa comercial atualizada.", version: Date.now() };
}

export async function saveLeadFollowUp(_: LeadFollowUpState, formData: FormData): Promise<LeadFollowUpState> {
  const raw = {
    leadId: String(formData.get("leadId") ?? ""),
    nextAction: String(formData.get("nextAction") ?? ""),
    nextActionAt: String(formData.get("nextActionAt") ?? ""),
    nextActionAssigneeId: String(formData.get("nextActionAssigneeId") ?? ""),
  };
  const parsed = followUpSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      error: "Revise os dados da próxima ação.",
      fieldErrors: parsed.error.flatten().fieldErrors,
      values: { nextAction: raw.nextAction, nextActionAt: raw.nextActionAt, nextActionAssigneeId: raw.nextActionAssigneeId },
      version: Date.now(),
    };
  }

  const { supabase } = await requireLeadManager();
  const { error } = await supabase.rpc("schedule_lead_follow_up", {
    p_lead_id: parsed.data.leadId,
    p_next_action: parsed.data.nextAction,
    p_next_action_at: parsed.data.nextActionAt,
    p_next_action_assignee_id: parsed.data.nextActionAssigneeId,
  });
  if (error) return { error: translateFollowUpError(error.message), values: { nextAction: raw.nextAction, nextActionAt: raw.nextActionAt, nextActionAssigneeId: raw.nextActionAssigneeId }, version: Date.now() };

  revalidatePath("/crm");
  revalidatePath("/painel");
  revalidatePath(`/leads/${parsed.data.leadId}`);
  return { success: "Próxima ação salva.", version: Date.now() };
}

export async function completeLeadFollowUp(_: LeadFollowUpState, formData: FormData): Promise<LeadFollowUpState> {
  const leadId = z.string().uuid().safeParse(formData.get("leadId"));
  if (!leadId.success) return { error: "Não foi possível identificar o lead.", version: Date.now() };

  const { supabase } = await requireLeadManager();
  const { error } = await supabase.rpc("complete_lead_follow_up", { p_lead_id: leadId.data });
  if (error) return { error: translateFollowUpError(error.message), version: Date.now() };

  revalidatePath("/crm");
  revalidatePath("/painel");
  revalidatePath(`/leads/${leadId.data}`);
  return { success: "Próxima ação concluída.", version: Date.now() };
}

function leadUpdateValues(formData: FormData): LeadDetailUpdateValues {
  return {
    leadId: String(formData.get("leadId") ?? ""),
    name: String(formData.get("name") ?? ""),
    company: String(formData.get("company") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    source: String(formData.get("source") ?? ""),
    eventType: String(formData.get("eventType") ?? ""),
    desiredDate: String(formData.get("desiredDate") ?? ""),
    guestCount: String(formData.get("guestCount") ?? ""),
    budgetRange: String(formData.get("budgetRange") ?? ""),
    responsibleId: String(formData.get("responsibleId") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  };
}

function translateFollowUpError(message: string) {
  if (message.includes("permission denied")) return "Seu usuário não possui permissão para acompanhar este lead.";
  if (message.includes("assignee is not active")) return "Selecione um responsável ativo.";
  if (message.includes("follow up not found")) return "Não há uma próxima ação para concluir.";
  if (message.includes("invalid follow up")) return "Informe ação, data e responsável.";
  return "Não foi possível salvar a próxima ação.";
}
