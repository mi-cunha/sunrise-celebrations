"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { quoteEditLockSchema, quoteEventAreaSchema, quoteItemDeleteSchema, quoteItemSchema, quoteItemUpdateSchema, quotePackageChoicesSchema, quotePackageDeleteSchema, quotePackageSchema, quoteStatusSchema } from "@/lib/domain/quote";
import { requireUser } from "@/lib/auth";

export type QuoteFormState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string[]>;
  values?: Record<string, string>;
  version?: number;
  requiresDateConflictConfirmation?: boolean;
};

const createQuoteSchema = z.object({
  leadId: z.string().uuid(),
  returnTo: z.string().optional(),
});

const quoteProposalOptionSchema = z
  .object({
    quoteId: z.string().uuid(),
    catalogOptionId: z.string().uuid().optional(),
    title: z.string().trim().max(120, "Use até 120 caracteres."),
    content: z.string().trim().max(1200, "Use até 1200 caracteres."),
  })
  .refine((value) => value.catalogOptionId || (value.title.length >= 2 && value.content.length >= 2), {
    message: "Escolha uma opção padrão ou escreva uma opção manual.",
    path: ["title"],
  });

const removeQuoteProposalOptionSchema = z.object({
  optionId: z.string().uuid(),
  quoteId: z.string().uuid(),
});

export async function updateQuoteEventArea(_: QuoteFormState, formData: FormData): Promise<QuoteFormState> {
  const raw = {
    quoteId: String(formData.get("quoteId") ?? ""),
    eventArea: String(formData.get("eventArea") ?? ""),
  };
  const parsed = quoteEventAreaSchema.safeParse(raw);
  if (!parsed.success) return { error: "Selecione a área do evento.", fieldErrors: parsed.error.flatten().fieldErrors, values: raw, version: Date.now() };

  const { supabase } = await requireQuoteManager();
  const { error } = await supabase.from("quotes").update({ event_area: parsed.data.eventArea }).eq("id", parsed.data.quoteId);
  if (error) return { error: error.message, values: raw, version: Date.now() };

  revalidatePath(`/orcamentos/${parsed.data.quoteId}`);
  revalidatePath(`/orcamentos/${parsed.data.quoteId}/proposta`);
  revalidatePath("/eventos");
  return { success: "Área do evento atualizada.", version: Date.now() };
}

export async function setQuotePackage(_: QuoteFormState, formData: FormData): Promise<QuoteFormState> {
  const raw = {
    quoteId: String(formData.get("quoteId") ?? ""),
    packageId: String(formData.get("packageId") ?? ""),
    unitPrice: String(formData.get("unitPrice") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  };
  const parsed = quotePackageSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revise o pacote.", values: raw, version: Date.now() };

  const { supabase } = await requireQuoteManager();
  const { error } = await supabase.rpc("set_quote_package", {
    p_quote_id: parsed.data.quoteId,
    p_package_id: parsed.data.packageId,
    p_unit_price_cents: parsed.data.unitPrice ?? null,
    p_notes: parsed.data.notes ?? "",
  });
  if (error) return { error: error.message, values: raw, version: Date.now() };

  await supabase.rpc("set_quote_package_item_choices", {
    p_quote_id: parsed.data.quoteId,
    p_package_item_ids: [],
  });

  revalidatePath(`/orcamentos/${parsed.data.quoteId}`);
  revalidatePath(`/orcamentos/${parsed.data.quoteId}/proposta`);
  return { success: "Pacote aplicado ao orçamento.", version: Date.now() };
}

export async function removeQuotePackage(_: QuoteFormState, formData: FormData): Promise<QuoteFormState> {
  const parsed = quotePackageDeleteSchema.safeParse({
    quoteId: formData.get("quoteId"),
  });
  if (!parsed.success) return { error: "Não foi possível identificar o orçamento.", version: Date.now() };

  const { supabase } = await requireQuoteManager();
  const { error } = await supabase.rpc("remove_quote_package", {
    p_quote_id: parsed.data.quoteId,
  });
  if (error) return { error: error.message, version: Date.now() };

  revalidatePath(`/orcamentos/${parsed.data.quoteId}`);
  revalidatePath(`/orcamentos/${parsed.data.quoteId}/proposta`);
  return { success: "Pacote removido.", version: Date.now() };
}

export async function setQuotePackageChoices(_: QuoteFormState, formData: FormData): Promise<QuoteFormState> {
  const raw = {
    quoteId: String(formData.get("quoteId") ?? ""),
    packageItemIds: formData.getAll("packageItemIds").map(String),
  };
  const parsed = quotePackageChoicesSchema.safeParse(raw);
  if (!parsed.success) return { error: "Revise as escolhas do pacote.", version: Date.now() };

  const { supabase } = await requireQuoteManager();
  const { error } = await supabase.rpc("set_quote_package_item_choices", {
    p_quote_id: parsed.data.quoteId,
    p_package_item_ids: parsed.data.packageItemIds,
  });
  if (error) return { error: error.message, version: Date.now() };

  revalidatePath(`/orcamentos/${parsed.data.quoteId}`);
  revalidatePath(`/orcamentos/${parsed.data.quoteId}/proposta`);
  return { success: "Escolhas do pacote salvas.", version: Date.now() };
}

export async function createQuoteFromLead(formData: FormData) {
  const parsed = createQuoteSchema.safeParse({
    leadId: formData.get("leadId"),
    returnTo: formData.get("returnTo"),
  });
  if (!parsed.success) redirect("/painel?error=invalid_quote");

  const { supabase } = await requireQuoteManager();
  const { data: quoteId, error } = await supabase.rpc("create_quote_from_lead", {
    p_lead_id: parsed.data.leadId,
  });
  if (error || !quoteId) redirect(`${parsed.data.returnTo || `/leads/${parsed.data.leadId}`}?error=quote_create_failed`);

  revalidatePath("/painel");
  revalidatePath("/atendimentos");
  revalidatePath(`/leads/${parsed.data.leadId}`);
  if (parsed.data.returnTo?.endsWith("orcamento=") && parsed.data.returnTo.startsWith("/")) {
    redirect(`${parsed.data.returnTo}${quoteId}`);
  }
  redirect(`/orcamentos/${quoteId}`);
}

export async function addQuoteItem(_: QuoteFormState, formData: FormData): Promise<QuoteFormState> {
  const raw = {
    quoteId: String(formData.get("quoteId") ?? ""),
    description: String(formData.get("description") ?? ""),
    quantity: String(formData.get("quantity") ?? ""),
    unitPrice: String(formData.get("unitPrice") ?? ""),
  };
  const parsed = quoteItemSchema.safeParse(raw);
  if (!parsed.success) return { error: "Revise o item do orçamento.", fieldErrors: parsed.error.flatten().fieldErrors, values: raw, version: Date.now() };

  const { supabase } = await requireQuoteManager();
  const { error } = await supabase.rpc("add_quote_item", {
    p_quote_id: parsed.data.quoteId,
    p_description: parsed.data.description,
    p_quantity: parsed.data.quantity,
    p_unit_price_cents: parsed.data.unitPrice,
  });
  if (error) return { error: error.message, values: raw, version: Date.now() };

  revalidatePath(`/orcamentos/${parsed.data.quoteId}`);
  return { success: "Item adicionado.", version: Date.now() };
}

export async function updateQuoteItem(_: QuoteFormState, formData: FormData): Promise<QuoteFormState> {
  const raw = {
    quoteId: String(formData.get("quoteId") ?? ""),
    itemId: String(formData.get("itemId") ?? ""),
    description: String(formData.get("description") ?? ""),
    quantity: String(formData.get("quantity") ?? ""),
    unitPrice: String(formData.get("unitPrice") ?? ""),
  };
  const parsed = quoteItemUpdateSchema.safeParse(raw);
  if (!parsed.success) return { error: "Revise o item do orçamento.", fieldErrors: parsed.error.flatten().fieldErrors, values: raw, version: Date.now() };

  const { supabase } = await requireQuoteManager();
  const { error } = await supabase.rpc("update_quote_item", {
    p_item_id: parsed.data.itemId,
    p_description: parsed.data.description,
    p_quantity: parsed.data.quantity,
    p_unit_price_cents: parsed.data.unitPrice,
  });
  if (error) return { error: error.message, values: raw, version: Date.now() };

  revalidatePath(`/orcamentos/${parsed.data.quoteId}`);
  return { success: "Item atualizado.", version: Date.now() };
}

export async function removeQuoteItem(_: QuoteFormState, formData: FormData): Promise<QuoteFormState> {
  const parsed = quoteItemDeleteSchema.safeParse({
    itemId: formData.get("itemId"),
  });
  const quoteId = String(formData.get("quoteId") ?? "");
  if (!parsed.success) return { error: "Não foi possível identificar o item.", version: Date.now() };

  const { supabase } = await requireQuoteManager();
  const { error } = await supabase.rpc("remove_quote_item", {
    p_item_id: parsed.data.itemId,
  });
  if (error) return { error: error.message, version: Date.now() };

  if (quoteId) revalidatePath(`/orcamentos/${quoteId}`);
  return { success: "Item removido.", version: Date.now() };
}

export async function updateQuoteStatus(_: QuoteFormState, formData: FormData): Promise<QuoteFormState> {
  const parsed = quoteStatusSchema.safeParse({
    quoteId: formData.get("quoteId"),
    status: formData.get("status"),
    reason: String(formData.get("reason") ?? ""),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Selecione um status válido.", values: { reason: String(formData.get("reason") ?? "") }, version: Date.now() };

  const { supabase } = await requireQuoteManager();
  if (parsed.data.status === "aprovado") {
    const { data: quote, error: quoteError } = await supabase
      .from("quotes")
      .select("desired_date,quote_packages(id,unit_price_cents,event_package_catalog(event_package_items(id,category,show_in_proposal,is_choice,choice_group,choice_min)),quote_package_item_choices(package_item_id))")
      .eq("id", parsed.data.quoteId)
      .maybeSingle();
    if (quoteError) return { error: quoteError.message, values: { reason: parsed.data.reason ?? "" }, version: Date.now() };

    const approvalIssue = getQuoteApprovalIssue(quote as unknown as QuoteApprovalData | null);
    if (approvalIssue) return { error: approvalIssue, values: { reason: parsed.data.reason ?? "" }, version: Date.now() };

    const { data: approvalResult, error: approvalError } = await supabase.rpc("approve_quote_and_create_event", {
      p_quote_id: parsed.data.quoteId,
      p_reason: parsed.data.reason ?? "",
      p_confirm_date_conflict: formData.get("confirmDateConflict") === "true",
    });
    if (approvalError) {
      return {
        error: translateQuoteApprovalError(approvalError.message),
        values: { reason: parsed.data.reason ?? "", status: parsed.data.status },
        version: Date.now(),
      };
    }

    const result = approvalResult as AtomicQuoteApprovalResult | null;
    if (result?.requires_confirmation) {
      const conflicts = result.conflicts ?? [];
      return {
        error: `A data já possui ${conflicts.length === 1 ? "um compromisso" : `${conflicts.length} compromissos`}: ${conflicts.join(", ")}. Confirme se deseja continuar.`,
        values: { reason: parsed.data.reason ?? "", status: parsed.data.status },
        requiresDateConflictConfirmation: true,
        version: Date.now(),
      };
    }
  } else {
    const { error } = await supabase.rpc("update_quote_status", {
      p_quote_id: parsed.data.quoteId,
      p_status: parsed.data.status,
      p_reason: parsed.data.reason ?? "",
    });
    if (error) {
      const message = error.message.includes("decision reason is required") ? "Informe o motivo da aprovação ou recusa." : error.message;
      return { error: message, values: { reason: parsed.data.reason ?? "", status: parsed.data.status }, version: Date.now() };
    }
  }

  const { data: persistedQuote, error: verificationError } = await supabase
    .from("quotes")
    .select("status,contracted_events(id)")
    .eq("id", parsed.data.quoteId)
    .maybeSingle();
  if (verificationError || !persistedQuote) {
    return {
      error: `A operação foi enviada, mas não foi possível confirmar o status salvo: ${verificationError?.message ?? "orçamento não encontrado"}`,
      values: { reason: parsed.data.reason ?? "", status: parsed.data.status },
      version: Date.now(),
    };
  }
  if (persistedQuote.status !== parsed.data.status) {
    return {
      error: `O banco manteve o status “${persistedQuote.status}” em vez de “${parsed.data.status}”. Nenhuma confirmação visual foi aplicada.`,
      values: { reason: parsed.data.reason ?? "", status: parsed.data.status },
      version: Date.now(),
    };
  }
  if (parsed.data.status === "aprovado" && toArray(persistedQuote.contracted_events).length === 0) {
    return {
      error: "O orçamento foi aprovado, mas o banco não retornou o evento vinculado. Recarregue a página antes de tentar novamente.",
      values: { reason: parsed.data.reason ?? "", status: parsed.data.status },
      version: Date.now(),
    };
  }

  revalidatePath(`/orcamentos/${parsed.data.quoteId}`);
  revalidatePath("/painel");
  revalidatePath("/atendimentos");
  revalidatePath("/eventos");
  revalidatePath("/agenda");
  redirect(`/orcamentos/${parsed.data.quoteId}?statusUpdated=${parsed.data.status}`);
}

type AtomicQuoteApprovalResult = {
  requires_confirmation: boolean;
  conflicts?: string[];
  event_id?: string;
};

function translateQuoteApprovalError(message: string) {
  if (message.includes("event date capacity reached")) return "Esta data já atingiu o limite de 3 eventos ativos. Escolha outra data antes de aprovar.";
  if (message.includes("event date is required")) return "Informe a data do evento antes de aprovar o orçamento.";
  if (message.includes("decision reason is required")) return "Informe o motivo da aprovação.";
  if (message.includes("permission denied")) return "Seu usuário não possui permissão para aprovar o orçamento e criar o evento.";
  if (message.includes("approve_quote_and_create_event")) return "Aplique a migration de aprovação transacional no Supabase antes de continuar.";
  return `Não foi possível aprovar o orçamento: ${message}`;
}

export async function confirmQuoteStatusWithDateConflict(formData: FormData) {
  const quoteId = String(formData.get("quoteId") ?? "");
  if (!z.string().uuid().safeParse(quoteId).success) redirect("/painel?error=invalid_quote");

  formData.set("confirmDateConflict", "true");
  const result = await updateQuoteStatus({}, formData);
  if (result.error) {
    redirect(`/orcamentos/${quoteId}?statusError=${encodeURIComponent(result.error)}`);
  }
  redirect(`/orcamentos/${quoteId}?statusUpdated=1`);
}

type QuoteApprovalPackageItem = {
  id: string;
  category: string;
  show_in_proposal: boolean;
  is_choice: boolean;
  choice_group: string | null;
  choice_min: number | null;
};

type QuoteApprovalPackage = {
  unit_price_cents: number | null;
  event_package_catalog: { event_package_items: QuoteApprovalPackageItem[] | QuoteApprovalPackageItem | null } | null;
  quote_package_item_choices: { package_item_id: string }[] | { package_item_id: string } | null;
};

type QuoteApprovalData = {
  desired_date: string | null;
  quote_packages: QuoteApprovalPackage[] | QuoteApprovalPackage | null;
};

function getQuoteApprovalIssue(quote: QuoteApprovalData | null) {
  if (!quote) return "Orçamento não encontrado.";
  const packages = toArray(quote.quote_packages);
  if (!packages.length) return "Selecione um pacote antes de aprovar o orçamento.";
  if (!packages.some((packageItem) => (packageItem.unit_price_cents ?? 0) > 0)) {
    return "Informe o valor por pessoa do pacote antes de aprovar o orçamento.";
  }

  for (const packageItem of packages) {
    const selectedIds = new Set(toArray(packageItem.quote_package_item_choices).map((choice) => choice.package_item_id));
    const choiceItems = toArray(packageItem.event_package_catalog?.event_package_items).filter((item) => item.show_in_proposal && item.is_choice);
    const groups = choiceItems.reduce((result, item) => {
      const name = item.choice_group?.trim() || item.category;
      const current = result.get(name) ?? { minimum: item.choice_min ?? 0, selected: 0 };
      current.minimum = Math.max(current.minimum, item.choice_min ?? 0);
      if (selectedIds.has(item.id)) current.selected += 1;
      result.set(name, current);
      return result;
    }, new Map<string, { minimum: number; selected: number }>());
    const pendingGroup = Array.from(groups.entries()).find(([, group]) => group.selected < group.minimum);
    if (pendingGroup) {
      const [name, group] = pendingGroup;
      return `Complete as escolhas obrigatórias de “${name}” antes de aprovar: ${group.selected} de ${group.minimum} selecionadas.`;
    }
  }
  return null;
}

function toArray<T>(value: T[] | T | null | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

export async function setApprovedQuoteEditLock(_: QuoteFormState, formData: FormData): Promise<QuoteFormState> {
  const parsed = quoteEditLockSchema.safeParse({
    quoteId: formData.get("quoteId"),
    unlocked: formData.get("unlocked") === "true",
    reason: String(formData.get("reason") ?? ""),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revise a liberação.", values: { reason: String(formData.get("reason") ?? "") }, version: Date.now() };

  const { supabase, permissions } = await requireUser();
  if (!permissions.includes("admin_owner")) redirect("/painel?error=forbidden");

  const { error } = await supabase.rpc("set_approved_quote_edit_lock", {
    p_quote_id: parsed.data.quoteId,
    p_unlocked: parsed.data.unlocked,
    p_reason: parsed.data.reason ?? "",
  });
  if (error) return { error: error.message, values: { reason: parsed.data.reason ?? "" }, version: Date.now() };

  revalidatePath(`/orcamentos/${parsed.data.quoteId}`);
  return { success: parsed.data.unlocked ? "Edição liberada pelo admin." : "Edição bloqueada novamente.", version: Date.now() };
}

export async function addQuoteProposalOption(_: QuoteFormState, formData: FormData): Promise<QuoteFormState> {
  const selectedCatalogOption = String(formData.get("catalogOptionId") ?? "");
  const rawValues = {
    quoteId: String(formData.get("quoteId") ?? ""),
    catalogOptionId: selectedCatalogOption,
    title: String(formData.get("title") ?? ""),
    content: String(formData.get("content") ?? ""),
  };
  const raw = {
    quoteId: String(formData.get("quoteId") ?? ""),
    catalogOptionId: selectedCatalogOption && selectedCatalogOption !== "manual" ? selectedCatalogOption : undefined,
    title: String(formData.get("title") ?? ""),
    content: String(formData.get("content") ?? ""),
  };
  const parsed = quoteProposalOptionSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revise a opção da proposta.", values: rawValues, version: Date.now() };

  const { supabase } = await requireQuoteManager();
  const { error } = await supabase.rpc("add_quote_proposal_option", {
    p_quote_id: parsed.data.quoteId,
    p_catalog_option_id: parsed.data.catalogOptionId ?? null,
    p_title: parsed.data.title,
    p_content: parsed.data.content,
  });
  if (error) return { error: error.message, values: rawValues, version: Date.now() };

  revalidatePath(`/orcamentos/${parsed.data.quoteId}`);
  revalidatePath(`/orcamentos/${parsed.data.quoteId}/proposta`);
  return { success: "Opção adicionada à proposta.", version: Date.now() };
}

export async function removeQuoteProposalOption(_: QuoteFormState, formData: FormData): Promise<QuoteFormState> {
  const parsed = removeQuoteProposalOptionSchema.safeParse({
    optionId: formData.get("optionId"),
    quoteId: formData.get("quoteId"),
  });
  if (!parsed.success) return { error: "Não foi possível identificar a opção.", version: Date.now() };

  const { supabase } = await requireQuoteManager();
  const { error } = await supabase.rpc("remove_quote_proposal_option", {
    p_option_id: parsed.data.optionId,
  });
  if (error) return { error: error.message, version: Date.now() };

  revalidatePath(`/orcamentos/${parsed.data.quoteId}`);
  revalidatePath(`/orcamentos/${parsed.data.quoteId}/proposta`);
  return { success: "Opção removida da proposta.", version: Date.now() };
}

async function requireQuoteManager() {
  const context = await requireUser();
  if (!context.permissions.some((permission) => permission === "atendimento" || permission === "financeiro" || permission === "gerencia" || permission === "direcao" || permission === "admin_owner")) {
    redirect("/painel?error=forbidden");
  }
  return context;
}
