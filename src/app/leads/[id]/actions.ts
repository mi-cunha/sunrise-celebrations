"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireLeadManager } from "@/lib/auth";
import { leadSchema } from "@/lib/domain/lead";

export type LeadDetailUpdateValues = Record<"leadId" | "name" | "company" | "phone" | "source" | "eventType" | "desiredDate" | "guestCount" | "notes", string>;
export type LeadDetailUpdateState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string[]>;
  values?: LeadDetailUpdateValues;
  version?: number;
};

export async function updateLeadFromDetail(_: LeadDetailUpdateState, formData: FormData): Promise<LeadDetailUpdateState> {
  const raw = leadUpdateValues(formData);
  const id = z.string().uuid().safeParse(raw.leadId);
  if (!id.success) return { error: "Não foi possível identificar o lead.", values: raw, version: Date.now() };

  const parsed = leadSchema.omit({ responsibleId: true }).safeParse(raw);
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
  const { error } = await supabase.rpc("update_lead_from_atendimento", {
    p_lead_id: id.data,
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
  revalidatePath(`/leads/${id.data}`);
  return { success: "Lead atualizado.", version: Date.now() };
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
    notes: String(formData.get("notes") ?? ""),
  };
}
