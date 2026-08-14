"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  contractedEventChecklistItemDeleteSchema,
  contractedEventChecklistItemMoveSchema,
  contractedEventChecklistItemSchema,
  contractedEventChecklistItemUpdateSchema,
  contractedEventChecklistSchema,
  contractedEventBillingModelSchema,
  contractedEventContractSchema,
  contractedEventPaymentDeleteSchema,
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
  if (!parsed.success) return { error: "Revise a tarefa.", fieldErrors: parsed.error.flatten().fieldErrors, values: raw, version: Date.now() };

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
  return { success: "Tarefa adicionada.", version: Date.now() };
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
  if (!parsed.success) return { error: "Revise a tarefa.", fieldErrors: parsed.error.flatten().fieldErrors, values: raw, version: Date.now() };

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
  return { success: "Tarefa atualizada.", version: Date.now() };
}

export async function removeContractedEventChecklistItem(_: ContractedEventFormState, formData: FormData): Promise<ContractedEventFormState> {
  const parsed = contractedEventChecklistItemDeleteSchema.safeParse({
    eventId: formData.get("eventId"),
    itemId: formData.get("itemId"),
  });
  if (!parsed.success) return { error: "Não foi possível identificar a tarefa.", version: Date.now() };

  const { supabase } = await requireEventManager();
  const { data: eventId, error } = await supabase.rpc("remove_contracted_event_checklist_item", {
    p_item_id: parsed.data.itemId,
  });
  if (error) return { error: error.message, version: Date.now() };

  revalidatePath(`/eventos/${eventId ?? parsed.data.eventId}`);
  return { success: "Tarefa removida.", version: Date.now() };
}

export async function moveContractedEventChecklistItem(_: ContractedEventFormState, formData: FormData): Promise<ContractedEventFormState> {
  const parsed = contractedEventChecklistItemMoveSchema.safeParse({
    eventId: formData.get("eventId"),
    itemId: formData.get("itemId"),
    direction: formData.get("direction"),
  });
  if (!parsed.success) return { error: "Não foi possível reordenar a tarefa.", version: Date.now() };

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
