"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  contractedEventChecklistItemDeleteSchema,
  contractedEventChecklistItemMoveSchema,
  contractedEventChecklistItemSchema,
  contractedEventChecklistItemUpdateSchema,
  contractedEventChecklistSchema,
  contractedEventBillingModelSchema,
  contractedEventBillingModelLabel,
  contractedEventContractDocumentKindLabel,
  contractedEventContractDocumentSchema,
  contractedEventContractSchema,
  contractedEventNotesSchema,
  contractedEventPaymentDeleteSchema,
  contractedEventPaymentKindLabel,
  contractedEventPaymentPlanSchema,
  contractedEventPaymentSchema,
  contractedEventPaymentUpdateSchema,
  contractedEventStatusSchema,
  contractedEventTimelineEntryDeleteSchema,
  contractedEventTimelineEntrySchema,
  contractedEventTimelineEntryUpdateSchema,
  contractedEventVendorDeleteSchema,
  contractedEventVendorSchema,
  contractedEventVendorUpdateSchema,
  createContractedEventSchema,
  eventOperationalBriefSchema,
} from "@/lib/domain/contracted-event";
import { requireUser } from "@/lib/auth";
import { formatCurrencyFromCents, quoteEventAreaLabel } from "@/lib/domain/quote";

export type ContractedEventFormState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string[]>;
  values?: Record<string, string>;
  version?: number;
};

export async function createContractedEventFromQuote(formData: FormData) {
  const parsed = createContractedEventSchema.safeParse({
    quoteId: formData.get("quoteId"),
  });
  if (!parsed.success) redirect("/painel?error=invalid_event");

  const { supabase } = await requireEventManager();
  const { data: eventId, error } = await supabase.rpc("create_contracted_event_from_quote", {
    p_quote_id: parsed.data.quoteId,
  });
  if (error || !eventId) redirect(`/orcamentos/${parsed.data.quoteId}?error=contracted_event`);

  revalidatePath("/eventos");
  revalidatePath(`/orcamentos/${parsed.data.quoteId}`);
  redirect(`/eventos/${eventId}`);
}

export async function updateContractedEventStatus(_: ContractedEventFormState, formData: FormData): Promise<ContractedEventFormState> {
  const parsed = contractedEventStatusSchema.safeParse({
    eventId: formData.get("eventId"),
    status: formData.get("status"),
  });
  if (!parsed.success) return { error: "Selecione um status válido.", version: Date.now() };

  const { supabase } = await requireEventManager();
  const { error } = await supabase.rpc("update_contracted_event_status", {
    p_event_id: parsed.data.eventId,
    p_status: parsed.data.status,
  });
  if (error) return { error: error.message, version: Date.now() };

  revalidatePath("/eventos");
  revalidatePath(`/eventos/${parsed.data.eventId}`);
  return { success: "Status do evento atualizado.", version: Date.now() };
}

export async function updateContractedEventNotes(_: ContractedEventFormState, formData: FormData): Promise<ContractedEventFormState> {
  const raw = {
    eventId: String(formData.get("eventId") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  };
  const parsed = contractedEventNotesSchema.safeParse(raw);
  if (!parsed.success) return { error: "Revise a observação do evento.", fieldErrors: parsed.error.flatten().fieldErrors, values: raw, version: Date.now() };

  const { supabase, user } = await requireEventManager();
  const { error } = await supabase
    .from("contracted_events")
    .update({ notes: parsed.data.notes ?? null })
    .eq("id", parsed.data.eventId);
  if (error) return { error: error.message, values: raw, version: Date.now() };

  await supabase.from("contracted_event_history").insert({
    event_id: parsed.data.eventId,
    actor_id: user.id,
    action: "Observação operacional atualizada",
    metadata: {},
  });

  revalidatePath(`/eventos/${parsed.data.eventId}`);
  revalidatePath(`/eventos/${parsed.data.eventId}/ficha`);
  return { success: "Observação operacional atualizada.", version: Date.now() };
}

export async function toggleContractedEventChecklistItem(_: ContractedEventFormState, formData: FormData): Promise<ContractedEventFormState> {
  const parsed = contractedEventChecklistSchema.safeParse({
    itemId: formData.get("itemId"),
    isDone: formData.get("isDone") === "on",
  });
  const eventId = String(formData.get("eventId") ?? "");
  if (!parsed.success) return { error: "Não foi possível identificar o item.", version: Date.now() };

  const { supabase } = await requireEventManager();
  const { data: updatedEventId, error } = await supabase.rpc("toggle_contracted_event_checklist_item", {
    p_item_id: parsed.data.itemId,
    p_is_done: parsed.data.isDone,
  });
  if (error) return { error: error.message, version: Date.now() };

  revalidatePath("/eventos");
  revalidatePath(`/eventos/${updatedEventId ?? eventId}`);
  return { success: parsed.data.isDone ? "Item concluído." : "Item reaberto.", version: Date.now() };
}

export async function addContractedEventChecklistItem(_: ContractedEventFormState, formData: FormData): Promise<ContractedEventFormState> {
  const raw = {
    eventId: String(formData.get("eventId") ?? ""),
    title: String(formData.get("title") ?? ""),
    assignedTo: String(formData.get("assignedTo") ?? ""),
    dueDate: String(formData.get("dueDate") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  };
  const parsed = contractedEventChecklistItemSchema.safeParse(raw);
  if (!parsed.success) return { error: "Revise a pendência.", fieldErrors: parsed.error.flatten().fieldErrors, values: raw, version: Date.now() };

  const { supabase } = await requireEventManager();
  const { error } = await supabase.rpc("add_contracted_event_checklist_item", {
    p_event_id: parsed.data.eventId,
    p_title: parsed.data.title,
    p_assigned_to: parsed.data.assignedTo ?? null,
    p_due_date: parsed.data.dueDate ?? null,
    p_notes: parsed.data.notes ?? null,
  });
  if (error) return { error: error.message, values: raw, version: Date.now() };

  revalidatePath(`/eventos/${parsed.data.eventId}`);
  return { success: "Pendência adicionada.", version: Date.now() };
}

export async function updateContractedEventChecklistItem(_: ContractedEventFormState, formData: FormData): Promise<ContractedEventFormState> {
  const raw = {
    eventId: String(formData.get("eventId") ?? ""),
    itemId: String(formData.get("itemId") ?? ""),
    title: String(formData.get("title") ?? ""),
    assignedTo: String(formData.get("assignedTo") ?? ""),
    dueDate: String(formData.get("dueDate") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  };
  const parsed = contractedEventChecklistItemUpdateSchema.safeParse(raw);
  if (!parsed.success) return { error: "Revise a pendência.", fieldErrors: parsed.error.flatten().fieldErrors, values: raw, version: Date.now() };

  const { supabase } = await requireEventManager();
  const { data: eventId, error } = await supabase.rpc("update_contracted_event_checklist_item", {
    p_item_id: parsed.data.itemId,
    p_title: parsed.data.title,
    p_assigned_to: parsed.data.assignedTo ?? null,
    p_due_date: parsed.data.dueDate ?? null,
    p_notes: parsed.data.notes ?? null,
  });
  if (error) return { error: error.message, values: raw, version: Date.now() };

  revalidatePath(`/eventos/${eventId ?? parsed.data.eventId}`);
  return { success: "Pendência atualizada.", version: Date.now() };
}

export async function removeContractedEventChecklistItem(_: ContractedEventFormState, formData: FormData): Promise<ContractedEventFormState> {
  const parsed = contractedEventChecklistItemDeleteSchema.safeParse({
    eventId: formData.get("eventId"),
    itemId: formData.get("itemId"),
  });
  if (!parsed.success) return { error: "Não foi possível identificar a pendência.", version: Date.now() };

  const { supabase } = await requireEventManager();
  const { data: eventId, error } = await supabase.rpc("remove_contracted_event_checklist_item", {
    p_item_id: parsed.data.itemId,
  });
  if (error) return { error: error.message, version: Date.now() };

  revalidatePath(`/eventos/${eventId ?? parsed.data.eventId}`);
  return { success: "Pendência removida.", version: Date.now() };
}

export async function moveContractedEventChecklistItem(_: ContractedEventFormState, formData: FormData): Promise<ContractedEventFormState> {
  const parsed = contractedEventChecklistItemMoveSchema.safeParse({
    eventId: formData.get("eventId"),
    itemId: formData.get("itemId"),
    direction: formData.get("direction"),
  });
  if (!parsed.success) return { error: "Não foi possível reordenar a pendência.", version: Date.now() };

  const { supabase } = await requireEventManager();
  const { data: eventId, error } = await supabase.rpc("move_contracted_event_checklist_item", {
    p_item_id: parsed.data.itemId,
    p_direction: parsed.data.direction,
  });
  if (error) return { error: error.message, version: Date.now() };

  revalidatePath(`/eventos/${eventId ?? parsed.data.eventId}`);
  return { success: "Ordem atualizada.", version: Date.now() };
}

export async function generateEventOperationalBrief(_: ContractedEventFormState, formData: FormData): Promise<ContractedEventFormState> {
  const parsed = eventOperationalBriefSchema.safeParse({
    eventId: formData.get("eventId"),
  });
  if (!parsed.success) return { error: "Não foi possível identificar o evento.", version: Date.now() };

  const { supabase } = await requireEventManager();
  const { error } = await supabase.rpc("generate_event_operational_brief", {
    p_event_id: parsed.data.eventId,
  });
  if (error) return { error: error.message, version: Date.now() };

  revalidatePath(`/eventos/${parsed.data.eventId}`);
  redirect(`/eventos/${parsed.data.eventId}?ficha=1`);
}

export async function generateContractedEventContractDocument(_: ContractedEventFormState, formData: FormData): Promise<ContractedEventFormState> {
  const raw = {
    eventId: String(formData.get("eventId") ?? ""),
    documentKind: String(formData.get("documentKind") ?? ""),
    contractingPartyName: String(formData.get("contractingPartyName") ?? ""),
    contractingPartyDocument: String(formData.get("contractingPartyDocument") ?? ""),
    contractingPartyAddress: String(formData.get("contractingPartyAddress") ?? ""),
    contractingPartyRepresentative: String(formData.get("contractingPartyRepresentative") ?? ""),
    eventSchedule: String(formData.get("eventSchedule") ?? ""),
    specialClauses: String(formData.get("specialClauses") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  };
  const parsed = contractedEventContractDocumentSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revise os dados do contrato.", fieldErrors: parsed.error.flatten().fieldErrors, values: raw, version: Date.now() };

  const { supabase } = await requireContractDocumentManager();
  const { data, error } = await supabase
    .from("contracted_events")
    .select("id,title,status,event_type,event_date,event_area,guest_count,billing_model,billing_notes,notes,leads(name,company,phone),quotes(title,status,total_amount_cents,quote_packages(id,unit_price_cents,guest_count,notes,event_package_catalog(id,name,description,event_package_items(id,category,name,description,show_in_proposal,is_choice,choice_group,choice_min,choice_max)),quote_package_item_choices(package_item_id))),contracted_event_contracts(status,signed_at,notes),contracted_event_payments(kind,status,amount_cents,due_date,paid_at,payment_method,notes)")
    .eq("id", parsed.data.eventId)
    .maybeSingle();

  if (error) return { error: error.message, values: raw, version: Date.now() };
  if (!data) return { error: "Evento não encontrado.", values: raw, version: Date.now() };

  const event = data as unknown as ContractDocumentEvent;
  if (event.quotes?.status !== "aprovado") {
    return {
      error: "O contrato fica disponível somente depois da aprovação do orçamento.",
      values: raw,
      version: Date.now(),
    };
  }
  const quotePackages = asArray(event.quotes.quote_packages);
  if (hasPendingContractPackageChoices(quotePackages)) {
    return {
      error: "Finalize as escolhas do pacote no orçamento antes de emitir o contrato.",
      values: raw,
      version: Date.now(),
    };
  }
  const packageUnitPrice = quotePackages.find((packageItem) => (packageItem.unit_price_cents ?? 0) > 0)?.unit_price_cents ?? null;
  if (!packageUnitPrice) {
    return {
      error: "O pacote precisa ter um valor por pessoa para calcular o adicional de convidado extra.",
      values: raw,
      version: Date.now(),
    };
  }
  const payments = [...(event.contracted_event_payments ?? [])].sort((left, right) => (left.due_date ?? "9999-12-31").localeCompare(right.due_date ?? "9999-12-31"));
  const suggestedKind = parsed.data.documentKind === "auto" ? suggestContractDocumentKind(event) : parsed.data.documentKind;
  const title = `${contractedEventContractDocumentKindLabel(suggestedKind)} - ${event.title}`;
  const content = buildContractDocumentContent({
    event,
    form: parsed.data,
    kind: suggestedKind,
    payments,
  });

  const { error: versionError } = await supabase.rpc("create_contract_document_version", {
    p_event_id: parsed.data.eventId,
    p_document_kind: suggestedKind,
    p_title: title,
    p_content: content,
  });
  if (versionError) return { error: versionError.message, values: raw, version: Date.now() };

  revalidatePath("/contratos");
  revalidatePath(`/eventos/${parsed.data.eventId}`);
  revalidatePath(`/eventos/${parsed.data.eventId}/contrato`);
  redirect(`/eventos/${parsed.data.eventId}?contrato=1`);
}

const contractDocumentVersionActionSchema = z.object({ versionId: z.string().uuid() });

export async function reviewContractDocumentVersion(_: ContractedEventFormState, formData: FormData): Promise<ContractedEventFormState> {
  const parsed = contractDocumentVersionActionSchema.safeParse({ versionId: formData.get("versionId") });
  if (!parsed.success) return { error: "Não foi possível identificar a versão.", version: Date.now() };
  const { supabase } = await requireContractDocumentManager();
  const { data: eventId, error } = await supabase.rpc("review_contract_document_version", { p_version_id: parsed.data.versionId });
  if (error || !eventId) return { error: error?.message ?? "Não foi possível revisar a versão.", version: Date.now() };
  revalidatePath(`/eventos/${eventId}`);
  revalidatePath(`/eventos/${eventId}/contrato`);
  return { success: "Versão revisada. Agora ela pode ser emitida.", version: Date.now() };
}

export async function issueContractDocumentVersion(_: ContractedEventFormState, formData: FormData): Promise<ContractedEventFormState> {
  const parsed = contractDocumentVersionActionSchema.safeParse({ versionId: formData.get("versionId") });
  if (!parsed.success) return { error: "Não foi possível identificar a versão.", version: Date.now() };
  const { supabase } = await requireContractDocumentManager();
  const { data: eventId, error } = await supabase.rpc("issue_contract_document_version", { p_version_id: parsed.data.versionId });
  if (error || !eventId) return { error: error?.message ?? "Não foi possível emitir a versão.", version: Date.now() };
  revalidatePath(`/eventos/${eventId}`);
  revalidatePath(`/eventos/${eventId}/contrato`);
  return { success: "Versão final emitida e pronta para impressão.", version: Date.now() };
}

export async function addContractedEventTimelineEntry(_: ContractedEventFormState, formData: FormData): Promise<ContractedEventFormState> {
  const raw = {
    eventId: String(formData.get("eventId") ?? ""),
    title: String(formData.get("title") ?? ""),
    startTime: String(formData.get("startTime") ?? ""),
    endTime: String(formData.get("endTime") ?? ""),
    location: String(formData.get("location") ?? ""),
    assignedTo: String(formData.get("assignedTo") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  };
  const parsed = contractedEventTimelineEntrySchema.safeParse(raw);
  if (!parsed.success) return { error: "Revise a etapa do cronograma.", fieldErrors: parsed.error.flatten().fieldErrors, values: raw, version: Date.now() };

  const { supabase } = await requireEventManager();
  const { error } = await supabase.rpc("add_contracted_event_timeline_entry", {
    p_event_id: parsed.data.eventId,
    p_title: parsed.data.title,
    p_start_time: parsed.data.startTime ?? null,
    p_end_time: parsed.data.endTime ?? null,
    p_location: parsed.data.location ?? null,
    p_assigned_to: parsed.data.assignedTo ?? null,
    p_notes: parsed.data.notes ?? null,
  });
  if (error) return { error: error.message, values: raw, version: Date.now() };

  revalidatePath(`/eventos/${parsed.data.eventId}`);
  return { success: "Etapa adicionada ao cronograma.", version: Date.now() };
}

export async function updateContractedEventTimelineEntry(_: ContractedEventFormState, formData: FormData): Promise<ContractedEventFormState> {
  const raw = {
    eventId: String(formData.get("eventId") ?? ""),
    entryId: String(formData.get("entryId") ?? ""),
    title: String(formData.get("title") ?? ""),
    startTime: String(formData.get("startTime") ?? ""),
    endTime: String(formData.get("endTime") ?? ""),
    location: String(formData.get("location") ?? ""),
    assignedTo: String(formData.get("assignedTo") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  };
  const parsed = contractedEventTimelineEntryUpdateSchema.safeParse(raw);
  if (!parsed.success) return { error: "Revise a etapa do cronograma.", fieldErrors: parsed.error.flatten().fieldErrors, values: raw, version: Date.now() };

  const { supabase } = await requireEventManager();
  const { data: eventId, error } = await supabase.rpc("update_contracted_event_timeline_entry", {
    p_entry_id: parsed.data.entryId,
    p_title: parsed.data.title,
    p_start_time: parsed.data.startTime ?? null,
    p_end_time: parsed.data.endTime ?? null,
    p_location: parsed.data.location ?? null,
    p_assigned_to: parsed.data.assignedTo ?? null,
    p_notes: parsed.data.notes ?? null,
  });
  if (error) return { error: error.message, values: raw, version: Date.now() };

  revalidatePath(`/eventos/${eventId ?? parsed.data.eventId}`);
  return { success: "Etapa atualizada.", version: Date.now() };
}

export async function removeContractedEventTimelineEntry(_: ContractedEventFormState, formData: FormData): Promise<ContractedEventFormState> {
  const parsed = contractedEventTimelineEntryDeleteSchema.safeParse({
    eventId: formData.get("eventId"),
    entryId: formData.get("entryId"),
  });
  if (!parsed.success) return { error: "Não foi possível identificar a etapa.", version: Date.now() };

  const { supabase } = await requireEventManager();
  const { data: eventId, error } = await supabase.rpc("remove_contracted_event_timeline_entry", {
    p_entry_id: parsed.data.entryId,
  });
  if (error) return { error: error.message, version: Date.now() };

  revalidatePath(`/eventos/${eventId ?? parsed.data.eventId}`);
  return { success: "Etapa removida.", version: Date.now() };
}

export async function addContractedEventVendor(_: ContractedEventFormState, formData: FormData): Promise<ContractedEventFormState> {
  const raw = {
    eventId: String(formData.get("eventId") ?? ""),
    category: String(formData.get("category") ?? ""),
    name: String(formData.get("name") ?? ""),
    contactName: String(formData.get("contactName") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    email: String(formData.get("email") ?? ""),
    status: String(formData.get("status") ?? "pendente"),
    notes: String(formData.get("notes") ?? ""),
  };
  const parsed = contractedEventVendorSchema.safeParse(raw);
  if (!parsed.success) return { error: "Revise o fornecedor.", fieldErrors: parsed.error.flatten().fieldErrors, values: raw, version: Date.now() };

  const { supabase } = await requireEventManager();
  const { error } = await supabase.rpc("add_contracted_event_vendor", {
    p_event_id: parsed.data.eventId,
    p_category: parsed.data.category,
    p_name: parsed.data.name,
    p_contact_name: parsed.data.contactName ?? null,
    p_phone: parsed.data.phone ?? null,
    p_email: parsed.data.email ?? null,
    p_status: parsed.data.status,
    p_notes: parsed.data.notes ?? null,
  });
  if (error) return { error: error.message, values: raw, version: Date.now() };

  revalidatePath(`/eventos/${parsed.data.eventId}`);
  return { success: "Fornecedor adicionado.", version: Date.now() };
}

export async function updateContractedEventVendor(_: ContractedEventFormState, formData: FormData): Promise<ContractedEventFormState> {
  const raw = {
    eventId: String(formData.get("eventId") ?? ""),
    vendorId: String(formData.get("vendorId") ?? ""),
    category: String(formData.get("category") ?? ""),
    name: String(formData.get("name") ?? ""),
    contactName: String(formData.get("contactName") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    email: String(formData.get("email") ?? ""),
    status: String(formData.get("status") ?? "pendente"),
    notes: String(formData.get("notes") ?? ""),
  };
  const parsed = contractedEventVendorUpdateSchema.safeParse(raw);
  if (!parsed.success) return { error: "Revise o fornecedor.", fieldErrors: parsed.error.flatten().fieldErrors, values: raw, version: Date.now() };

  const { supabase } = await requireEventManager();
  const { data: eventId, error } = await supabase.rpc("update_contracted_event_vendor", {
    p_vendor_id: parsed.data.vendorId,
    p_category: parsed.data.category,
    p_name: parsed.data.name,
    p_contact_name: parsed.data.contactName ?? null,
    p_phone: parsed.data.phone ?? null,
    p_email: parsed.data.email ?? null,
    p_status: parsed.data.status,
    p_notes: parsed.data.notes ?? null,
  });
  if (error) return { error: error.message, values: raw, version: Date.now() };

  revalidatePath(`/eventos/${eventId ?? parsed.data.eventId}`);
  return { success: "Fornecedor atualizado.", version: Date.now() };
}

export async function removeContractedEventVendor(_: ContractedEventFormState, formData: FormData): Promise<ContractedEventFormState> {
  const parsed = contractedEventVendorDeleteSchema.safeParse({
    eventId: formData.get("eventId"),
    vendorId: formData.get("vendorId"),
  });
  if (!parsed.success) return { error: "Não foi possível identificar o fornecedor.", version: Date.now() };

  const { supabase } = await requireEventManager();
  const { data: eventId, error } = await supabase.rpc("remove_contracted_event_vendor", {
    p_vendor_id: parsed.data.vendorId,
  });
  if (error) return { error: error.message, version: Date.now() };

  revalidatePath(`/eventos/${eventId ?? parsed.data.eventId}`);
  return { success: "Fornecedor removido.", version: Date.now() };
}

export async function setContractedEventContract(_: ContractedEventFormState, formData: FormData): Promise<ContractedEventFormState> {
  const raw = {
    eventId: String(formData.get("eventId") ?? ""),
    status: String(formData.get("status") ?? ""),
    signedAt: String(formData.get("signedAt") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  };
  const parsed = contractedEventContractSchema.safeParse(raw);
  if (!parsed.success) return { error: "Revise os dados do contrato.", fieldErrors: parsed.error.flatten().fieldErrors, values: raw, version: Date.now() };

  const { supabase } = await requireFinancialManager();
  const { error } = await supabase.rpc("set_contracted_event_contract", {
    p_event_id: parsed.data.eventId,
    p_status: parsed.data.status,
    p_signed_at: parsed.data.signedAt ?? null,
    p_notes: parsed.data.notes ?? null,
  });
  if (error) return { error: error.message, values: raw, version: Date.now() };

  revalidatePath(`/eventos/${parsed.data.eventId}`);
  return { success: "Contrato atualizado.", version: Date.now() };
}

export async function updateContractedEventBillingModel(_: ContractedEventFormState, formData: FormData): Promise<ContractedEventFormState> {
  const raw = {
    eventId: String(formData.get("eventId") ?? ""),
    billingModel: String(formData.get("billingModel") ?? ""),
    billingNotes: String(formData.get("billingNotes") ?? ""),
  };
  const parsed = contractedEventBillingModelSchema.safeParse(raw);
  if (!parsed.success) return { error: "Revise o modelo de cobrança.", fieldErrors: parsed.error.flatten().fieldErrors, values: raw, version: Date.now() };

  const { supabase } = await requireFinancialManager();
  const { data: eventId, error } = await supabase.rpc("update_contracted_event_billing_model", {
    p_event_id: parsed.data.eventId,
    p_billing_model: parsed.data.billingModel,
    p_billing_notes: parsed.data.billingNotes ?? null,
  });
  if (error) return { error: error.message, values: raw, version: Date.now() };

  revalidatePath("/eventos");
  revalidatePath(`/eventos/${eventId ?? parsed.data.eventId}`);
  return { success: "Modelo de cobrança atualizado.", version: Date.now() };
}

export async function addContractedEventPayment(_: ContractedEventFormState, formData: FormData): Promise<ContractedEventFormState> {
  const raw = paymentRawValues(formData);
  const parsed = contractedEventPaymentSchema.safeParse(raw);
  if (!parsed.success) return { error: "Revise o pagamento.", fieldErrors: parsed.error.flatten().fieldErrors, values: raw, version: Date.now() };

  const { supabase } = await requireFinancialManager();
  const { error } = await supabase.rpc("add_contracted_event_payment", {
    p_event_id: parsed.data.eventId,
    p_kind: parsed.data.kind,
    p_status: parsed.data.status,
    p_amount_cents: parsed.data.amount,
    p_due_date: parsed.data.dueDate ?? null,
    p_paid_at: parsed.data.paidAt ?? null,
    p_payment_method: parsed.data.paymentMethod ?? null,
    p_notes: parsed.data.notes ?? null,
  });
  if (error) return { error: error.message, values: raw, version: Date.now() };

  revalidatePath(`/eventos/${parsed.data.eventId}`);
  return { success: "Pagamento adicionado.", version: Date.now() };
}

export async function generateContractedEventPaymentPlan(_: ContractedEventFormState, formData: FormData): Promise<ContractedEventFormState> {
  const raw = {
    eventId: String(formData.get("eventId") ?? ""),
    signalAmount: String(formData.get("signalAmount") ?? ""),
    signalDueDate: String(formData.get("signalDueDate") ?? ""),
    installmentCount: String(formData.get("installmentCount") ?? ""),
    firstInstallmentDueDate: String(formData.get("firstInstallmentDueDate") ?? ""),
    installmentInterval: String(formData.get("installmentInterval") ?? "mensal"),
    customIntervalDays: String(formData.get("customIntervalDays") ?? ""),
    paymentMethod: String(formData.get("paymentMethod") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  };
  const parsed = contractedEventPaymentPlanSchema.safeParse(raw);
  if (!parsed.success) return { error: "Revise o plano de pagamento.", fieldErrors: parsed.error.flatten().fieldErrors, values: raw, version: Date.now() };

  const { supabase } = await requireFinancialManager();
  const { data: event, error: eventError } = await supabase
    .from("contracted_events")
    .select("id,quotes(total_amount_cents)")
    .eq("id", parsed.data.eventId)
    .maybeSingle();

  const quote = firstRecord((event as { quotes?: { total_amount_cents: number }[] | { total_amount_cents: number } | null } | null)?.quotes);
  const totalAmount = quote?.total_amount_cents ?? 0;
  if (eventError || !event || totalAmount <= 0) {
    return { error: eventError?.message ?? "Não foi possível encontrar o valor aprovado do evento.", values: raw, version: Date.now() };
  }
  if (parsed.data.signalAmount > totalAmount) {
    return { error: "O sinal não pode ser maior que o valor aprovado.", fieldErrors: { signalAmount: ["O sinal não pode ser maior que o total."] }, values: raw, version: Date.now() };
  }

  const remainingAmount = totalAmount - parsed.data.signalAmount;
  if (remainingAmount > 0 && parsed.data.installmentCount === 0) {
    return { error: "O valor restante precisa ser lançado em parcelas.", fieldErrors: { installmentCount: ["Informe ao menos uma parcela para o saldo restante."] }, values: raw, version: Date.now() };
  }
  if (remainingAmount === 0 && parsed.data.installmentCount > 0) {
    return { error: "O sinal já cobre o valor total. Use 0 parcelas.", fieldErrors: { installmentCount: ["Use 0 parcelas quando o sinal cobre o total."] }, values: raw, version: Date.now() };
  }

  const notes = parsed.data.notes ? `Plano gerado automaticamente. ${parsed.data.notes}` : "Plano gerado automaticamente.";
  let createdPayments = 0;
  if (parsed.data.signalAmount > 0) {
    const { error } = await supabase.rpc("add_contracted_event_payment", {
      p_event_id: parsed.data.eventId,
      p_kind: "sinal",
      p_status: "previsto",
      p_amount_cents: parsed.data.signalAmount,
      p_due_date: parsed.data.signalDueDate ?? null,
      p_paid_at: null,
      p_payment_method: parsed.data.paymentMethod ?? null,
      p_notes: notes,
    });
    if (error) return { error: error.message, values: raw, version: Date.now() };
    createdPayments += 1;
  }

  if (parsed.data.installmentCount > 0 && parsed.data.firstInstallmentDueDate) {
    const baseAmount = Math.floor(remainingAmount / parsed.data.installmentCount);
    const remainder = remainingAmount % parsed.data.installmentCount;
    for (let index = 0; index < parsed.data.installmentCount; index += 1) {
      const amount = baseAmount + (index === parsed.data.installmentCount - 1 ? remainder : 0);
      const { error } = await supabase.rpc("add_contracted_event_payment", {
        p_event_id: parsed.data.eventId,
        p_kind: parsed.data.signalAmount > 0 && parsed.data.installmentCount === 1 ? "saldo" : "parcela",
        p_status: "previsto",
        p_amount_cents: amount,
        p_due_date: addInstallmentInterval(parsed.data.firstInstallmentDueDate, index, parsed.data.installmentInterval, parsed.data.customIntervalDays),
        p_paid_at: null,
        p_payment_method: parsed.data.paymentMethod ?? null,
        p_notes: notes,
      });
      if (error) return { error: error.message, values: raw, version: Date.now() };
      createdPayments += 1;
    }
  }

  revalidatePath("/eventos");
  revalidatePath(`/eventos/${parsed.data.eventId}`);
  return { success: `${createdPayments} pagamento(s) gerado(s).`, version: Date.now() };
}

export async function updateContractedEventPayment(_: ContractedEventFormState, formData: FormData): Promise<ContractedEventFormState> {
  const raw = {
    ...paymentRawValues(formData),
    paymentId: String(formData.get("paymentId") ?? ""),
  };
  const parsed = contractedEventPaymentUpdateSchema.safeParse(raw);
  if (!parsed.success) return { error: "Revise o pagamento.", fieldErrors: parsed.error.flatten().fieldErrors, values: raw, version: Date.now() };

  const { supabase } = await requireFinancialManager();
  const { data: eventId, error } = await supabase.rpc("update_contracted_event_payment", {
    p_payment_id: parsed.data.paymentId,
    p_kind: parsed.data.kind,
    p_status: parsed.data.status,
    p_amount_cents: parsed.data.amount,
    p_due_date: parsed.data.dueDate ?? null,
    p_paid_at: parsed.data.paidAt ?? null,
    p_payment_method: parsed.data.paymentMethod ?? null,
    p_notes: parsed.data.notes ?? null,
  });
  if (error) return { error: error.message, values: raw, version: Date.now() };

  revalidatePath(`/eventos/${eventId ?? parsed.data.eventId}`);
  return { success: "Pagamento atualizado.", version: Date.now() };
}

export async function removeContractedEventPayment(_: ContractedEventFormState, formData: FormData): Promise<ContractedEventFormState> {
  const parsed = contractedEventPaymentDeleteSchema.safeParse({
    eventId: formData.get("eventId"),
    paymentId: formData.get("paymentId"),
  });
  if (!parsed.success) return { error: "Não foi possível identificar o pagamento.", version: Date.now() };

  const { supabase } = await requireFinancialManager();
  const { data: eventId, error } = await supabase.rpc("remove_contracted_event_payment", {
    p_payment_id: parsed.data.paymentId,
  });
  if (error) return { error: error.message, version: Date.now() };

  revalidatePath(`/eventos/${eventId ?? parsed.data.eventId}`);
  return { success: "Pagamento removido.", version: Date.now() };
}

function paymentRawValues(formData: FormData) {
  return {
    eventId: String(formData.get("eventId") ?? ""),
    kind: String(formData.get("kind") ?? ""),
    status: String(formData.get("status") ?? ""),
    amount: String(formData.get("amount") ?? ""),
    dueDate: String(formData.get("dueDate") ?? ""),
    paidAt: String(formData.get("paidAt") ?? ""),
    paymentMethod: String(formData.get("paymentMethod") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  };
}

function addInstallmentInterval(value: string, index: number, interval: string, customIntervalDays?: number) {
  if (interval === "mensal") return addMonths(value, index);
  const daysByInterval: Record<string, number> = {
    semanal: 7,
    quinzenal: 15,
    personalizado: customIntervalDays ?? 30,
  };
  return addDays(value, index * (daysByInterval[interval] ?? 30));
}

function addMonths(value: string, months: number) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + months, day));
  return date.toISOString().slice(0, 10);
}

function addDays(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

function firstRecord<T>(value: T[] | T | null | undefined) {
  if (Array.isArray(value)) return value[0];
  return value;
}

function asArray<T>(value: T[] | T | null | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

type ContractDocumentEvent = {
  id: string;
  title: string;
  status: string;
  event_type: string | null;
  event_date: string | null;
  event_area: string | null;
  guest_count: number | null;
  billing_model: string;
  billing_notes: string | null;
  notes: string | null;
  leads: { name: string; company: string | null; phone: string } | null;
  quotes: ContractDocumentQuote | null;
  contracted_event_contracts: { status: string; signed_at: string | null; notes: string | null }[] | { status: string; signed_at: string | null; notes: string | null } | null;
  contracted_event_payments: ContractDocumentPayment[] | null;
};

type ContractDocumentQuote = {
  title: string;
  status: string;
  total_amount_cents: number;
  quote_packages: ContractDocumentQuotePackage[] | ContractDocumentQuotePackage | null;
};

type ContractDocumentQuotePackage = {
  id: string;
  unit_price_cents: number | null;
  guest_count: number | null;
  notes: string | null;
  event_package_catalog: {
    id: string;
    name: string;
    description: string | null;
    event_package_items: ContractDocumentPackageItem[] | null;
  } | null;
  quote_package_item_choices: { package_item_id: string }[] | null;
};

type ContractDocumentPackageItem = {
  id: string;
  category: string;
  name: string;
  description: string | null;
  show_in_proposal: boolean;
  is_choice: boolean;
  choice_group: string | null;
  choice_min: number | null;
  choice_max: number | null;
};

type ContractDocumentPayment = {
  kind: string;
  status: string;
  amount_cents: number;
  due_date: string | null;
  paid_at: string | null;
  payment_method: string | null;
  notes: string | null;
};

type ContractDocumentForm = {
  contractingPartyName?: string;
  contractingPartyDocument?: string;
  contractingPartyAddress?: string;
  contractingPartyRepresentative?: string;
  eventSchedule?: string;
  specialClauses?: string;
  notes?: string;
};

function suggestContractDocumentKind(event: ContractDocumentEvent) {
  const totalAmount = event.quotes?.total_amount_cents ?? 0;

  if (event.billing_model === "consumo_aberto_pos_evento") return "aceite_proposta";
  if (totalAmount >= 1500000 || (event.guest_count ?? 0) >= 80) return "contrato_completo";
  if (totalAmount >= 500000 || (event.guest_count ?? 0) >= 30 || event.billing_model === "pre_pago_com_consumo_aberto") return "termo_simplificado";
  return "aceite_proposta";
}

function buildContractDocumentContent({
  event,
  form,
  kind,
  payments,
}: {
  event: ContractDocumentEvent;
  form: ContractDocumentForm;
  kind: string;
  payments: ContractDocumentPayment[];
}) {
  const totalAmount = event.quotes?.total_amount_cents ?? 0;
  const quotePackages = asArray(event.quotes?.quote_packages);
  const packageUnitPrice = quotePackages.find((packageItem) => (packageItem.unit_price_cents ?? 0) > 0)?.unit_price_cents ?? 0;
  const extraGuestFee = Math.round(packageUnitPrice * 1.2);
  const leadName = form.contractingPartyName ?? event.leads?.company ?? event.leads?.name ?? "A preencher";
  const packageLines = buildContractPackageLines(quotePackages);
  const activePayments = payments.filter((payment) => payment.status !== "cancelado");
  const paymentLines = activePayments.length
    ? activePayments
        .map((payment) =>
          [
            `- ${contractedEventPaymentKindLabel(payment.kind)}: ${formatCurrencyFromCents(payment.amount_cents)}`,
            payment.due_date ? `Vencimento: ${formatDate(payment.due_date)}` : "",
          ]
            .filter(Boolean)
            .join(" | "),
        )
        .join("\n")
    : event.billing_model === "consumo_aberto_pos_evento"
      ? "Consumo apurado e pago após o evento, conforme comandas e condições registradas para a operação."
      : "Na ausência de plano de pagamento específico, a confirmação da data depende do pagamento de sinal mínimo de 20% (vinte por cento) do valor contratado, e o saldo total deverá estar quitado até 7 (sete) dias antes do evento.";

  const sections = [
    `Pelo presente instrumento particular, as partes abaixo identificadas celebram o documento denominado ${contractedEventContractDocumentKindLabel(kind)}, regido pelas cláusulas e condições seguintes. A proposta final aprovada, o cardápio confirmado, os termos de uso do espaço e eventuais aditivos escritos integram este instrumento para todos os fins.`,
    [
      "## QUALIFICAÇÃO DAS PARTES",
      `CONTRATANTE: ${leadName}, inscrito(a) no CPF/CNPJ sob o nº ${form.contractingPartyDocument ?? "A preencher"}, com endereço em ${form.contractingPartyAddress ?? "A preencher"}${form.contractingPartyRepresentative ? `, neste ato representado(a) por ${form.contractingPartyRepresentative}` : ""}${event.leads?.phone ? `, telefone/WhatsApp ${event.leads.phone}` : ""}, doravante denominado(a) CONTRATANTE.`,
      "CONTRATADA: Sunrise Serviços de Bares e Restaurantes Ltda., pessoa jurídica de direito privado, inscrita no CNPJ sob o nº 05.904.097/0001-80, com sede na Av. Zezé Diogo, 4959, Praia do Futuro, Fortaleza/CE, doravante denominada SUNRISE CELEBRATIONS ou CONTRATADA.",
    ]
      .filter(Boolean)
      .join("\n"),
    [
      "## CLÁUSULA PRIMEIRA - DO OBJETO E DOS DOCUMENTOS INTEGRANTES",
      "1.1. O presente instrumento tem por objeto a prestação de serviços para realização do evento descrito na cláusula seguinte, conforme o escopo, o pacote, o cardápio, as escolhas finais e as condições comerciais aprovadas pela CONTRATANTE.",
      "1.2. Integram este contrato, independentemente de transcrição: (i) a proposta final aprovada; (ii) o cardápio e as escolhas confirmadas; (iii) os termos de uso do espaço; e (iv) os aditivos aceitos por escrito pelas partes.",
      "1.3. Em caso de divergência, prevalecem os aditivos mais recentes, este contrato e, em seguida, a proposta final aprovada.",
    ].join("\n"),
    [
      "## CLÁUSULA SEGUNDA - DOS DADOS DO EVENTO",
      `Tipo de evento: ${event.event_type ?? "A definir"}`,
      `Data: ${event.event_date ? formatDate(event.event_date) : "A definir"}`,
      `Horário: ${form.eventSchedule ?? "A definir"}`,
      "Endereço: Av. Zezé Diogo, 4959, Praia do Futuro, Fortaleza/CE, CEP 60182-026",
      `Área do evento: ${quoteEventAreaLabel(event.event_area)}`,
      `Quantidade prevista de convidados: ${event.guest_count ? `${event.guest_count} pessoas` : "A definir"}`,
      `Modelo de cobrança: ${contractedEventBillingModelLabel(event.billing_model)}`,
      event.billing_notes ? `Observações de cobrança: ${event.billing_notes}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
    [
      "## CLÁUSULA TERCEIRA - DO PACOTE E DOS SERVIÇOS INCLUSOS",
      "3.1. O pacote, os itens fixos e as escolhas confirmadas pela CONTRATANTE constam do Anexo I, parte integrante deste instrumento.",
      "3.1. Integram a execução, quando previstos na proposta: mobiliário operacional disponível, materiais de serviço, utensílios, equipe compatível, limpeza e suporte durante o evento.",
      "3.2. Marcas, sabores, apresentações e itens sujeitos à sazonalidade poderão ser substituídos por equivalentes de padrão semelhante, mediante alinhamento prévio quando a alteração for relevante.",
    ].join("\n"),
    [
      "## CLÁUSULA QUARTA - DOS SERVIÇOS NÃO INCLUSOS E DOS EXTRAS",
      "4.1. Não estão incluídos serviços, personalizações, horas extras, fornecedores externos, decoração, atrações, equipamentos ou consumos que não constem expressamente da proposta aprovada, deste contrato ou de aditivo.",
      "4.2. Todo acréscimo dependerá de disponibilidade, orçamento complementar e aprovação escrita da CONTRATANTE antes da execução.",
    ].join("\n"),
    [
      "## CLÁUSULA QUINTA - DO VALOR, DA RESERVA E DO PAGAMENTO",
      `Valor aprovado: ${totalAmount > 0 ? formatCurrencyFromCents(totalAmount) : "A preencher"}`,
      `Condições de pagamento registradas no sistema:\n${paymentLines}`,
      "5.1. A reserva da data somente será considerada confirmada após o cumprimento da condição de entrada ou sinal definida entre as partes.",
      "5.2. O atraso de qualquer parcela autoriza a CONTRATADA, após comunicação à CONTRATANTE, a suspender preparativos ou a execução até a regularização, sem afastar os custos já assumidos.",
      "Dados bancários para pagamento: Banco Santander, agência 4389, conta corrente 13002414-3. Pix/CNPJ: 05.904.097/0001-80. Favorecido: Sunrise Serviços de Bares e Restaurantes Ltda.",
    ].join("\n"),
    [
      "## CLÁUSULA SÉTIMA - DA QUANTIDADE DE CONVIDADOS",
      `7.1. O contrato considera ${event.guest_count ? `${event.guest_count} convidados` : "quantidade de convidados a definir"}. Alterações poderão impactar estrutura, buffet, bebidas, equipe e valor final.`,
      "7.2. A quantidade final deverá ser informada com antecedência mínima de 15 (quinze) dias. Acréscimos posteriores dependerão de capacidade, disponibilidade e pagamento complementar.",
      "7.3. A redução de convidados após compras, contratações ou dimensionamento operacional não implica redução automática do valor contratado.",
      "7.4. Crianças com menos de 7 (sete) anos não serão computadas como convidados pagantes, salvo condição específica expressamente registrada.",
      `7.5. Cada convidado incluído além da quantidade contratada terá custo adicional de ${formatCurrencyFromCents(extraGuestFee)}, correspondente ao valor por pessoa do pacote acrescido de 20% (vinte por cento), sujeito à disponibilidade operacional.`,
      kind !== "aceite_proposta" ? `7.6. Trabalhadores e prestadores de serviços externos que utilizem alimentação, bebidas ou estrutura operacional terão custo fixo de ${formatCurrencyFromCents(10000)} por pessoa.` : "",
    ].join("\n"),
    [
      "## CLÁUSULA OITAVA - DO HORÁRIO, DA MONTAGEM E DAS HORAS EXTRAS",
      "8.1. O evento observará o horário contratado. A permanência além do período acordado, inclusive por fornecedores, dependerá de autorização e poderá gerar cobrança de horas extras.",
      "8.2. Horários e condições de montagem e desmontagem de decoração, equipamentos e fornecedores externos deverão ser aprovados previamente pela CONTRATADA.",
    ].join("\n"),
    [
      "## CLÁUSULA NONA - DO USO DO ESPAÇO E DA CONDUTA",
      "9.1. O espaço será utilizado exclusivamente para o evento identificado neste contrato, sendo vedada finalidade diversa sem autorização escrita.",
      "9.2. A CONTRATANTE responderá pela conduta de seus convidados e deverá colaborar para a retirada de quem descumprir normas de segurança, causar risco, dano, perturbação ou constrangimento.",
      "9.3. Materiais publicitários, ações de marca, equipamentos e alterações no ambiente dependem de autorização prévia da CONTRATADA.",
    ].join("\n"),
    [
      "## CLÁUSULA DÉCIMA - DA CAPACIDADE, DA SEGURANÇA E DAS NORMAS INTERNAS",
      "10.1. A CONTRATANTE declara ciência de que a capacidade do espaço, as rotas de circulação e as orientações de segurança deverão ser respeitadas por todos os participantes e fornecedores.",
      "10.2. A CONTRATADA poderá adotar medidas necessárias à preservação das pessoas e do patrimônio, inclusive interromper atividade que apresente risco ou viole norma aplicável.",
    ].join("\n"),
    [
      "## CLÁUSULA DÉCIMA PRIMEIRA - DA LIMPEZA, DA DECORAÇÃO E DO PATRIMÔNIO",
      "11.1. A CONTRATADA manterá o serviço de limpeza e a organização das áreas abrangidas pelo escopo durante o evento.",
      "11.2. A decoração não poderá obstruir saídas, equipamentos de segurança ou danificar pisos, paredes, mobiliário e instalações. Fixações e estruturas dependerão de autorização prévia.",
      "11.3. A CONTRATANTE responderá pelos danos comprovadamente causados por si, seus convidados ou fornecedores, assegurado o direito de verificação e apresentação dos custos de reparo.",
    ].join("\n"),
    [
      "## CLÁUSULA DÉCIMA SEGUNDA - DAS OBRIGAÇÕES DA CONTRATADA",
      "- Disponibilizar a estrutura e os serviços contratados.",
      "- Coordenar a execução operacional dos serviços internos.",
      "- Manter equipe compatível com o pacote contratado.",
      "- Zelar por limpeza, organização, segurança operacional e suporte durante o evento, conforme escopo aprovado.",
    ].join("\n"),
    [
      "## CLÁUSULA DÉCIMA TERCEIRA - DAS OBRIGAÇÕES DA CONTRATANTE",
      "- Efetuar os pagamentos nas datas acordadas.",
      "- Informar dados corretos sobre evento, convidados, horários e fornecedores externos.",
      "- Respeitar normas internas, horários, capacidade e orientações de segurança do espaço.",
      "- Responsabilizar-se por danos causados por convidados, fornecedores externos ou terceiros vinculados ao evento.",
    ].join("\n"),
    [
      "## CLÁUSULA DÉCIMA QUARTA - DOS FORNECEDORES EXTERNOS",
      "14.1. A entrada de fornecedores externos dependerá de autorização prévia. A CONTRATANTE informará identificação, serviço, responsáveis e horários de chegada, montagem e desmontagem.",
      "14.2. A CONTRATADA não responde por atrasos, vícios, danos ou falhas de fornecedores contratados diretamente pela CONTRATANTE, sem prejuízo das medidas de segurança e controle do espaço.",
    ].join("\n"),
    [
      "## CLÁUSULA DÉCIMA QUINTA - DO CANCELAMENTO, DO REAGENDAMENTO E DA FORÇA MAIOR",
      "15.1. Cancelamento ou reagendamento solicitado pela CONTRATANTE será analisado conforme a antecedência, o bloqueio da data, as compras, as contratações e os custos administrativos e operacionais já assumidos.",
      "15.2. Valores pagos poderão ser retidos na medida dos custos e compromissos já incorridos. Eventual crédito para nova data dependerá de disponibilidade e acordo escrito.",
      "15.3. Se o cancelamento decorrer exclusivamente da CONTRATADA, sem inadimplemento da CONTRATANTE, os valores recebidos serão restituídos conforme a legislação aplicável e o acerto formal entre as partes.",
      "15.4. Caso fortuito ou força maior que impeça a realização ensejará tentativa prioritária de reagendamento. As partes definirão por escrito a nova data e o tratamento dos custos comprovadamente já assumidos.",
    ].join("\n"),
    [
      "## CLÁUSULA DÉCIMA SEXTA - DAS ALTERAÇÕES E COMUNICAÇÕES",
      "16.1. Alterações de escopo, pacote, cardápio, valores, datas, horários ou responsabilidades somente terão validade quando registradas por escrito, inclusive por meio eletrônico que permita comprovar autoria e conteúdo.",
      "16.2. A tolerância de uma parte quanto ao descumprimento de obrigação não importará renúncia, novação ou alteração contratual.",
      form.specialClauses ? `Condições específicas: ${form.specialClauses}` : "",
      form.notes ? `Observações contratuais adicionais: ${form.notes}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
    [
      "## CLÁUSULA DÉCIMA SÉTIMA - DA VIGÊNCIA E DA RESCISÃO",
      "17.1. Este contrato entra em vigor na data de sua assinatura e permanece válido até o integral cumprimento das obrigações das partes.",
      "17.2. O descumprimento de obrigação essencial, não sanado após comunicação, poderá ensejar rescisão, sem prejuízo da apuração de valores devidos e perdas comprovadas, observada a legislação aplicável.",
    ].join("\n"),
    [
      "## CLÁUSULA DÉCIMA OITAVA - DO FORO",
      "Fica eleito o Foro da Comarca de Fortaleza, Estado do Ceará, para dirimir dúvidas ou controvérsias decorrentes deste contrato, ressalvadas hipóteses legais de competência obrigatória.",
      "E, por estarem de acordo, as partes assinam o presente instrumento, juntamente com duas testemunhas, admitida a assinatura eletrônica na forma da legislação aplicável.",
      "Fortaleza/CE, ____ de __________________________ de ________.",
    ].join("\n"),
    [
      "## ASSINATURAS",
      "________________________________________",
      "SUNRISE SERVIÇOS DE BARES E RESTAURANTES LTDA.",
      "CONTRATADA - CNPJ 05.904.097/0001-80",
      "",
      "________________________________________",
      leadName,
      `CONTRATANTE - CPF/CNPJ ${form.contractingPartyDocument ?? "A preencher"}`,
      "",
      "________________________________________",
      "TESTEMUNHA 1 - Nome:",
      "CPF:",
      "",
      "________________________________________",
      "TESTEMUNHA 2 - Nome:",
      "CPF:",
    ].join("\n"),
    [
      "## ANEXO I - PACOTE, ITENS E ESCOLHAS CONFIRMADAS",
      packageLines || "Nenhum pacote foi associado ao orçamento. A proposta final aprovada permanece como referência do escopo contratado.",
    ].join("\n"),
  ];

  if (kind === "aceite_proposta") {
    return buildConsentTermContent({ event, form, leadName, packageLines, paymentLines, totalAmount });
  }

  return renumberContractSections(selectContractSections(sections, kind))
    .filter(Boolean)
    .join("\n\n");
}

function buildConsentTermContent({ event, form, leadName, packageLines, paymentLines, totalAmount }: {
  event: ContractDocumentEvent;
  form: ContractDocumentForm;
  leadName: string;
  packageLines: string;
  paymentLines: string;
  totalAmount: number;
}) {
  return [
    "Por este termo, a pessoa identificada abaixo confirma que recebeu, conferiu e aceita as condições essenciais da proposta aprovada para a realização do evento.",
    [
      "## IDENTIFICAÇÃO",
      `Responsável: ${leadName}`,
      `CPF/CNPJ: ${form.contractingPartyDocument ?? "A preencher"}`,
      event.leads?.phone ? `Telefone/WhatsApp: ${event.leads.phone}` : "",
    ].filter(Boolean).join("\n"),
    [
      "## DADOS DO EVENTO",
      `Tipo: ${event.event_type ?? "A definir"}`,
      `Data: ${event.event_date ? formatDate(event.event_date) : "A definir"}`,
      `Horário: ${form.eventSchedule ?? "A definir"}`,
      "Local: Av. Zezé Diogo, 4959, Praia do Futuro, Fortaleza/CE, CEP 60182-026",
      `Área: ${quoteEventAreaLabel(event.event_area)}`,
      `Convidados: ${event.guest_count ? `${event.guest_count} pessoas` : "A definir"}`,
    ].join("\n"),
    [
      "## PROPOSTA ACEITA",
      packageLines || "A proposta final aprovada define o pacote, os itens e as escolhas do evento.",
      `Valor total: ${totalAmount > 0 ? formatCurrencyFromCents(totalAmount) : "A preencher"}`,
      `Condições de pagamento:\n${paymentLines}`,
    ].join("\n"),
    [
      "## CONDIÇÕES ESSENCIAIS",
      "A data é confirmada após o cumprimento da condição de sinal acordada. Alterações de data, convidados, horário, pacote ou itens dependem de disponibilidade e podem alterar o valor.",
      "Cancelamentos e reagendamentos serão tratados conforme a antecedência e os custos já assumidos pela Sunrise Celebrations.",
      "A pessoa responsável declara ciência das regras de uso do espaço e responde pela conduta de convidados e fornecedores externos.",
      form.specialClauses ? `Condição específica: ${form.specialClauses}` : "",
      form.notes ? `Observação: ${form.notes}` : "",
    ].filter(Boolean).join("\n"),
    [
      "## ACEITE",
      "Declaro que li e aceito a proposta e as condições acima.",
      "Fortaleza/CE, ____ de __________________________ de ________.",
      "",
      "________________________________________",
      leadName,
      "RESPONSÁVEL PELO EVENTO",
      "",
      "________________________________________",
      "SUNRISE SERVIÇOS DE BARES E RESTAURANTES LTDA.",
    ].join("\n"),
  ].join("\n\n");
}

function selectContractSections(sections: string[], kind: string) {
  if (kind === "contrato_completo") return sections;

  const simplifiedOmissions = ["DA CAPACIDADE, DA SEGURANÇA", "DA LIMPEZA, DA DECORAÇÃO", "DA VIGÊNCIA E DA RESCISÃO"];
  const consentSections = [
    "DO OBJETO E DOS DOCUMENTOS",
    "DOS DADOS DO EVENTO",
    "DO PACOTE E DOS SERVIÇOS",
    "DO VALOR, DA RESERVA",
    "DA QUANTIDADE DE CONVIDADOS",
    "DO HORÁRIO, DA MONTAGEM",
    "DO USO DO ESPAÇO",
    "DAS OBRIGAÇÕES DA CONTRATANTE",
    "DOS FORNECEDORES EXTERNOS",
    "DO CANCELAMENTO, DO REAGENDAMENTO",
    "DAS ALTERAÇÕES E COMUNICAÇÕES",
    "DO FORO",
  ];

  return sections.filter((section) => {
    if (!section.startsWith("## CLÁUSULA")) return true;
    if (kind === "termo_simplificado") return !simplifiedOmissions.some((title) => section.includes(title));
    return consentSections.some((title) => section.includes(title));
  });
}

function renumberContractSections(sections: string[]) {
  const ordinals = [
    "PRIMEIRA",
    "SEGUNDA",
    "TERCEIRA",
    "QUARTA",
    "QUINTA",
    "SEXTA",
    "SÉTIMA",
    "OITAVA",
    "NONA",
    "DÉCIMA",
    "DÉCIMA PRIMEIRA",
    "DÉCIMA SEGUNDA",
    "DÉCIMA TERCEIRA",
    "DÉCIMA QUARTA",
    "DÉCIMA QUINTA",
    "DÉCIMA SEXTA",
    "DÉCIMA SÉTIMA",
    "DÉCIMA OITAVA",
  ];
  let clauseIndex = 0;
  return sections.map((section) => {
    if (!section.startsWith("## CLÁUSULA")) return section;
    const clauseNumber = clauseIndex + 1;
    const ordinal = ordinals[clauseIndex] ?? String(clauseNumber);
    clauseIndex += 1;
    return section
      .replace(/^## CLÁUSULA .*? - /, `## CLÁUSULA ${ordinal} - `)
      .replace(/^\d+\.(\d+)\./gm, `${clauseNumber}.$1.`);
  });
}

function buildContractPackageLines(packages: ContractDocumentQuotePackage[]) {
  if (!packages.length) return "";
  return packages
    .map((packageItem) => {
      const catalog = packageItem.event_package_catalog;
      const selectedIds = new Set((packageItem.quote_package_item_choices ?? []).map((choice) => choice.package_item_id));
      const items = (catalog?.event_package_items ?? []).filter((item) => item.show_in_proposal);
      const fixedItems = items.filter((item) => !item.is_choice);
      const choiceItems = items.filter((item) => item.is_choice);
      const chosenItems = choiceItems.filter((item) => selectedIds.has(item.id));

      return [
        `Pacote: ${catalog?.name ?? "Pacote sem nome"}`,
        catalog?.description ? `Descrição: ${catalog.description}` : "",
        packageItem.guest_count ? `Convidados/base: ${packageItem.guest_count}` : "",
        fixedItems.length ? `Itens inclusos:\n${formatContractPackageItems(fixedItems)}` : "",
        chosenItems.length ? `Escolhas confirmadas pela contratante:\n${formatContractPackageItems(chosenItems)}` : "",
        packageItem.notes ? `Observações do pacote: ${packageItem.notes}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
}

function formatContractPackageItems(items: ContractDocumentPackageItem[]) {
  const groups = items.reduce((result, item) => {
    const current = result.get(item.category) ?? [];
    current.push(item.name);
    result.set(item.category, current);
    return result;
  }, new Map<string, string[]>());
  return Array.from(groups.entries())
    .map(([category, names]) => `- ${category}: ${names.join("; ")}.`)
    .join("\n");
}

function hasPendingContractPackageChoices(packages: ContractDocumentQuotePackage[]) {
  return packages.some((packageItem) => {
    const selectedIds = new Set((packageItem.quote_package_item_choices ?? []).map((choice) => choice.package_item_id));
    const choiceItems = (packageItem.event_package_catalog?.event_package_items ?? []).filter((item) => item.show_in_proposal && item.is_choice);
    const groups = choiceItems.reduce((result, item) => {
      const group = item.choice_group || item.category;
      const current = result.get(group) ?? { minimum: item.choice_min ?? 0, selected: 0 };
      current.minimum = Math.max(current.minimum, item.choice_min ?? 0);
      if (selectedIds.has(item.id)) current.selected += 1;
      result.set(group, current);
      return result;
    }, new Map<string, { minimum: number; selected: number }>());
    return Array.from(groups.values()).some((group) => group.minimum > group.selected);
  });
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(`${value}T00:00:00`));
}

async function requireContractDocumentManager() {
  const context = await requireUser();
  if (!context.permissions.some((permission) => permission === "gerencia" || permission === "admin_owner")) {
    redirect("/painel?error=forbidden");
  }
  return context;
}

async function requireFinancialManager() {
  const context = await requireUser();
  if (!context.permissions.some((permission) => permission === "financeiro" || permission === "gerencia" || permission === "admin_owner")) {
    redirect("/painel?error=forbidden");
  }
  return context;
}

async function requireEventManager() {
  const context = await requireUser();
  if (!context.permissions.some((permission) => permission === "atendimento" || permission === "gerencia" || permission === "admin_owner")) {
    redirect("/painel?error=forbidden");
  }
  return context;
}
