"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { leadSchema } from "@/lib/domain/lead";
import { requireLeadManager, requireUser } from "@/lib/auth";

export type LeadFormValues = Record<"name" | "company" | "phone" | "source" | "eventType" | "desiredDate" | "guestCount" | "responsibleId" | "notes", string>;
export type FormState = { error?: string; fieldErrors?: Record<string, string[]>; values?: LeadFormValues; version?: number };
export async function createLead(_: FormState, formData: FormData): Promise<FormState> {
  const raw = formValues(formData);
  const parsed = leadSchema.safeParse(raw);
  if (!parsed.success) return { error: "Revise os campos destacados.", fieldErrors: parsed.error.flatten().fieldErrors, values: raw, version: Date.now() };
  const { supabase, user, permissions } = await requireLeadManager();
  const input = parsed.data;
  if (input.responsibleId && !permissions.includes("admin_owner")) return { error: "Você não pode escolher outro responsável.", values: raw, version: Date.now() };
  const { data: leadId, error } = await supabase.rpc("create_lead_with_event", { p_name: input.name, p_company: input.company ?? null, p_phone: input.phone, p_source: input.source ?? null, p_event_type: input.eventType ?? null, p_desired_date: input.desiredDate ?? null, p_guest_count: input.guestCount ?? null, p_notes: input.notes ?? null, p_responsible_id: input.responsibleId ?? user.id, p_create_event: Boolean(input.eventType || input.desiredDate || input.guestCount) });
  if (error || !leadId) return { error: error?.message ?? "Não foi possível salvar o lead. Tente novamente.", values: raw, version: Date.now() };
  revalidatePath("/painel");
  redirect(`/leads/${leadId}`);
}

export async function signOut() { const { supabase } = await requireUser(); await supabase.auth.signOut(); redirect("/login"); }

function formValues(formData: FormData): LeadFormValues {
  return {
    name: String(formData.get("name") ?? ""),
    company: String(formData.get("company") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    source: String(formData.get("source") ?? ""),
    eventType: String(formData.get("eventType") ?? ""),
    desiredDate: String(formData.get("desiredDate") ?? ""),
    guestCount: String(formData.get("guestCount") ?? ""),
    responsibleId: String(formData.get("responsibleId") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  };
}
