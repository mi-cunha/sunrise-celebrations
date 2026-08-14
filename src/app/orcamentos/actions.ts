"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { quoteEditLockSchema, quoteItemDeleteSchema, quoteItemSchema, quoteItemUpdateSchema, quotePackageDeleteSchema, quotePackageSchema, quoteStatusSchema } from "@/lib/domain/quote";
import { requireUser } from "@/lib/auth";

export type QuoteFormState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string[]>;
  values?: Record<string, string>;
  version?: number;
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
  if (error || !quoteId) redirect(parsed.data.returnTo || `/leads/${parsed.data.leadId}`);

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
  const { error } = await supabase.rpc("update_quote_status", {
    p_quote_id: parsed.data.quoteId,
    p_status: parsed.data.status,
    p_reason: parsed.data.reason ?? "",
  });
  if (error) return { error: error.message, version: Date.now() };

  revalidatePath(`/orcamentos/${parsed.data.quoteId}`);
  revalidatePath("/painel");
  revalidatePath("/atendimentos");
  return { success: "Status atualizado.", version: Date.now() };
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
  if (!context.permissions.some((permission) => permission === "atendimento" || permission === "financeiro" || permission === "admin_owner")) {
    redirect("/painel?error=forbidden");
  }
  return context;
}
