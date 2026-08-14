"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { parseCurrencyToCents } from "@/lib/domain/quote";
import { requireUser } from "@/lib/auth";

const optionSchema = z.object({
  kind: z.enum(["event_type", "lead_source"]),
  name: z.string().trim().min(2, "Informe uma opção.").max(80, "Use até 80 caracteres."),
});

const logoSchema = z.object({
  logoUrl: z
    .string()
    .trim()
    .max(500000, "Imagem muito grande. Use uma imagem menor.")
    .refine((value) => value === "" || z.string().url().safeParse(value).success || /^data:image\/(png|jpeg|jpg|webp|svg\+xml);base64,/i.test(value), "Informe uma URL válida ou selecione uma imagem."),
});

const proposalOptionSchema = z.object({
  title: z.string().trim().min(2, "Informe um título.").max(120, "Use até 120 caracteres."),
  content: z.string().trim().min(2, "Informe o texto da opção.").max(1200, "Use até 1200 caracteres."),
});

const quoteItemCatalogOptionSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do item.").max(120, "Use até 120 caracteres."),
  description: z.string().trim().max(300, "Use até 300 caracteres.").optional(),
  defaultUnitPrice: z
    .string()
    .trim()
    .optional()
    .transform((value) => (!value ? null : parseCurrencyToCents(value)))
    .refine((value) => value === null || value > 0, "Informe um valor válido maior que zero."),
});

const packageCatalogSchema = z.object({
  eventType: z.string().trim().min(2, "Informe o tipo de evento.").max(80, "Use até 80 caracteres."),
  name: z.string().trim().min(2, "Informe o nome do pacote.").max(120, "Use até 120 caracteres."),
  description: z.string().trim().max(1200, "Use até 1200 caracteres.").optional(),
  basePrice: z
    .string()
    .trim()
    .optional()
    .transform((value) => (!value ? null : parseCurrencyToCents(value)))
    .refine((value) => value === null || value >= 0, "Informe um valor válido."),
  proposalNotes: z.string().trim().max(1600, "Use até 1600 caracteres.").optional(),
  operationNotes: z.string().trim().max(1600, "Use até 1600 caracteres.").optional(),
});

const packageItemSchema = z.object({
  packageId: z.string().uuid(),
  category: z.enum(["buffet", "bebida", "servico", "estrutura", "observacao", "outro"]),
  name: z.string().trim().min(2, "Informe o item.").max(160, "Use até 160 caracteres."),
  description: z.string().trim().max(800, "Use até 800 caracteres.").optional(),
  showInProposal: z.boolean(),
  showInOperationalBrief: z.boolean(),
});

const packageItemUpdateSchema = packageItemSchema.extend({
  id: z.string().uuid(),
});

const packageItemDeleteSchema = z.object({
  id: z.string().uuid(),
});

export type OptionFormState = { error?: string; success?: string; kind?: "event_type" | "lead_source"; name?: string };
export type LogoFormState = { error?: string; success?: string; logoUrl?: string };
export type ProposalOptionFormState = { error?: string; success?: string; title?: string; content?: string };
export type QuoteItemCatalogOptionFormState = { error?: string; success?: string; name?: string; description?: string; defaultUnitPrice?: string };
export type PackageCatalogFormState = { error?: string; success?: string; eventType?: string; name?: string; description?: string; basePrice?: string; proposalNotes?: string; operationNotes?: string };
export type PackageItemFormState = { error?: string; success?: string; packageId?: string; category?: string; name?: string; description?: string };
export type CatalogMutationState = { error?: string; success?: string; id?: string };

export async function createOption(_: OptionFormState, formData: FormData): Promise<OptionFormState> {
  const parsed = optionSchema.safeParse({ kind: formData.get("kind"), name: formData.get("name") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revise a opção.", kind: String(formData.get("kind")) as "event_type" | "lead_source", name: String(formData.get("name") ?? "") };
  const { supabase, permissions } = await requireUser();
  if (!permissions.includes("admin_owner")) redirect("/painel?error=forbidden");
  const { error } = await supabase.from("option_catalog").insert({ kind: parsed.data.kind, name: parsed.data.name });
  if (error) return { error: error.code === "23505" ? "Essa opção já existe." : "Não foi possível salvar a opção.", kind: parsed.data.kind, name: parsed.data.name };
  revalidatePath("/admin/opcoes");
  revalidatePath("/leads/novo");
  return { success: "Opção adicionada.", kind: parsed.data.kind };
}

export async function updateCompanyLogo(_: LogoFormState, formData: FormData): Promise<LogoFormState> {
  const parsed = logoSchema.safeParse({ logoUrl: String(formData.get("logoUrl") ?? "") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revise a logo.", logoUrl: String(formData.get("logoUrl") ?? "") };

  const { supabase, permissions } = await requireUser();
  if (!permissions.includes("admin_owner")) redirect("/painel?error=forbidden");

  const { error } = await supabase.rpc("set_company_logo", { p_logo_url: parsed.data.logoUrl });
  if (error) return { error: "Não foi possível salvar a logo.", logoUrl: parsed.data.logoUrl };

  revalidatePath("/admin/opcoes");
  revalidatePath("/orcamentos/[id]/proposta", "page");
  return { success: "Logo atualizada.", logoUrl: parsed.data.logoUrl };
}

export async function createProposalOption(_: ProposalOptionFormState, formData: FormData): Promise<ProposalOptionFormState> {
  const parsed = proposalOptionSchema.safeParse({
    title: formData.get("title"),
    content: formData.get("content"),
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      error: issue?.message ?? "Revise a opção da proposta.",
      title: String(formData.get("title") ?? ""),
      content: String(formData.get("content") ?? ""),
    };
  }

  const { supabase, permissions } = await requireUser();
  if (!permissions.includes("admin_owner")) redirect("/painel?error=forbidden");

  const { error } = await supabase.rpc("add_proposal_catalog_option", {
    p_title: parsed.data.title,
    p_content: parsed.data.content,
  });
  if (error) return { error: error.code === "23505" ? "Essa opção já existe." : "Não foi possível salvar a opção.", title: parsed.data.title, content: parsed.data.content };

  revalidatePath("/admin/opcoes");
  revalidatePath("/orcamentos/[id]", "page");
  return { success: "Opção de proposta adicionada." };
}

export async function createQuoteItemCatalogOption(_: QuoteItemCatalogOptionFormState, formData: FormData): Promise<QuoteItemCatalogOptionFormState> {
  const raw = {
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
    defaultUnitPrice: String(formData.get("defaultUnitPrice") ?? ""),
  };
  const parsed = quoteItemCatalogOptionSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revise o item.", ...raw };

  const { supabase, permissions } = await requireUser();
  if (!permissions.includes("admin_owner")) redirect("/painel?error=forbidden");

  const { error } = await supabase.rpc("add_quote_item_catalog_option", {
    p_name: parsed.data.name,
    p_description: parsed.data.description ?? "",
    p_default_unit_price_cents: parsed.data.defaultUnitPrice,
  });
  if (error) return { error: error.code === "23505" ? "Esse item já existe." : "Não foi possível salvar o item.", ...raw };

  revalidatePath("/admin/opcoes");
  revalidatePath("/orcamentos/[id]", "page");
  return { success: "Item de orçamento adicionado." };
}

export async function createEventPackage(_: PackageCatalogFormState, formData: FormData): Promise<PackageCatalogFormState> {
  const raw = {
    eventType: String(formData.get("eventType") ?? ""),
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
    basePrice: String(formData.get("basePrice") ?? ""),
    proposalNotes: String(formData.get("proposalNotes") ?? ""),
    operationNotes: String(formData.get("operationNotes") ?? ""),
  };
  const parsed = packageCatalogSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revise o pacote.", ...raw };

  const { supabase, permissions } = await requireUser();
  if (!permissions.includes("admin_owner")) redirect("/painel?error=forbidden");

  const { error } = await supabase.from("event_package_catalog").insert({
    event_type: parsed.data.eventType,
    name: parsed.data.name,
    description: parsed.data.description || null,
    base_price_cents: parsed.data.basePrice,
    proposal_notes: parsed.data.proposalNotes || null,
    operation_notes: parsed.data.operationNotes || null,
  });
  if (error) return { error: error.code === "23505" ? "Esse pacote já existe para este tipo de evento." : "Não foi possível salvar o pacote.", ...raw };

  revalidatePath("/admin/opcoes");
  return { success: "Pacote criado." };
}

export async function createEventPackageItem(_: PackageItemFormState, formData: FormData): Promise<PackageItemFormState> {
  const raw = {
    packageId: String(formData.get("packageId") ?? ""),
    category: String(formData.get("category") ?? ""),
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
    showInProposal: formData.get("showInProposal") === "on",
    showInOperationalBrief: formData.get("showInOperationalBrief") === "on",
  };
  const parsed = packageItemSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revise o item do pacote.", packageId: raw.packageId, category: raw.category, name: raw.name, description: raw.description };

  const { supabase, permissions } = await requireUser();
  if (!permissions.includes("admin_owner")) redirect("/painel?error=forbidden");

  const { data: sortOrder } = await supabase.rpc("next_event_package_item_sort_order", { p_package_id: parsed.data.packageId });
  const { error } = await supabase.from("event_package_items").insert({
    package_id: parsed.data.packageId,
    category: parsed.data.category,
    name: parsed.data.name,
    description: parsed.data.description || null,
    show_in_proposal: parsed.data.showInProposal,
    show_in_operational_brief: parsed.data.showInOperationalBrief,
    sort_order: sortOrder ?? 100,
  });
  if (error) return { error: "Não foi possível salvar o item do pacote.", packageId: parsed.data.packageId, category: parsed.data.category, name: parsed.data.name, description: parsed.data.description ?? "" };

  revalidatePath("/admin/opcoes");
  return { success: "Item adicionado ao pacote.", packageId: parsed.data.packageId };
}

export async function updateEventPackageItem(_: PackageItemFormState, formData: FormData): Promise<PackageItemFormState> {
  const raw = {
    id: String(formData.get("id") ?? ""),
    packageId: String(formData.get("packageId") ?? ""),
    category: String(formData.get("category") ?? ""),
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
    showInProposal: formData.get("showInProposal") === "on",
    showInOperationalBrief: formData.get("showInOperationalBrief") === "on",
  };
  const parsed = packageItemUpdateSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revise o item do pacote.", packageId: raw.packageId, category: raw.category, name: raw.name, description: raw.description };

  const { supabase, permissions } = await requireUser();
  if (!permissions.includes("admin_owner")) redirect("/painel?error=forbidden");

  const { error } = await supabase
    .from("event_package_items")
    .update({
      category: parsed.data.category,
      name: parsed.data.name,
      description: parsed.data.description || null,
      show_in_proposal: parsed.data.showInProposal,
      show_in_operational_brief: parsed.data.showInOperationalBrief,
    })
    .eq("id", parsed.data.id);
  if (error) return { error: "Não foi possível atualizar o item do pacote.", packageId: parsed.data.packageId, category: parsed.data.category, name: parsed.data.name, description: parsed.data.description ?? "" };

  revalidatePath("/admin/opcoes");
  return { success: "Item do pacote atualizado.", packageId: parsed.data.packageId };
}

export async function removeEventPackageItem(_: PackageItemFormState, formData: FormData): Promise<PackageItemFormState> {
  const parsed = packageItemDeleteSchema.safeParse({
    id: formData.get("id"),
  });
  const packageId = String(formData.get("packageId") ?? "");
  if (!parsed.success) return { error: "Não foi possível identificar o item.", packageId };

  const { supabase, permissions } = await requireUser();
  if (!permissions.includes("admin_owner")) redirect("/painel?error=forbidden");

  const { error } = await supabase.from("event_package_items").delete().eq("id", parsed.data.id);
  if (error) return { error: "Não foi possível remover o item do pacote.", packageId };

  revalidatePath("/admin/opcoes");
  return { success: "Item do pacote removido.", packageId };
}

export async function updateOptionCatalogItem(_: CatalogMutationState, formData: FormData): Promise<CatalogMutationState> {
  const id = String(formData.get("id") ?? "");
  const parsed = optionSchema.pick({ name: true }).safeParse({ name: formData.get("name") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revise a opção.", id };

  const { supabase, permissions } = await requireUser();
  if (!permissions.includes("admin_owner")) redirect("/painel?error=forbidden");

  const { error } = await supabase.rpc("update_option_catalog_option", { p_option_id: id, p_name: parsed.data.name });
  if (error) return { error: error.code === "23505" ? "Essa opção já existe." : "Não foi possível atualizar.", id };

  revalidatePath("/admin/opcoes");
  revalidatePath("/leads/novo");
  return { success: "Opção atualizada.", id };
}

export async function removeOptionCatalogItem(_: CatalogMutationState, formData: FormData): Promise<CatalogMutationState> {
  const id = String(formData.get("id") ?? "");
  const { supabase, permissions } = await requireUser();
  if (!permissions.includes("admin_owner")) redirect("/painel?error=forbidden");

  const { error } = await supabase.rpc("remove_option_catalog_option", { p_option_id: id });
  if (error) return { error: "Não foi possível remover.", id };

  revalidatePath("/admin/opcoes");
  revalidatePath("/leads/novo");
  return { success: "Opção removida.", id };
}

export async function updateProposalCatalogItem(_: CatalogMutationState, formData: FormData): Promise<CatalogMutationState> {
  const id = String(formData.get("id") ?? "");
  const parsed = proposalOptionSchema.safeParse({
    title: formData.get("title"),
    content: formData.get("content"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revise a opção.", id };

  const { supabase, permissions } = await requireUser();
  if (!permissions.includes("admin_owner")) redirect("/painel?error=forbidden");

  const { error } = await supabase.rpc("update_proposal_catalog_option", {
    p_option_id: id,
    p_title: parsed.data.title,
    p_content: parsed.data.content,
  });
  if (error) return { error: error.code === "23505" ? "Essa opção já existe." : "Não foi possível atualizar.", id };

  revalidatePath("/admin/opcoes");
  revalidatePath("/orcamentos/[id]", "page");
  return { success: "Condição atualizada.", id };
}

export async function removeProposalCatalogItem(_: CatalogMutationState, formData: FormData): Promise<CatalogMutationState> {
  const id = String(formData.get("id") ?? "");
  const { supabase, permissions } = await requireUser();
  if (!permissions.includes("admin_owner")) redirect("/painel?error=forbidden");

  const { error } = await supabase.rpc("remove_proposal_catalog_option", { p_option_id: id });
  if (error) return { error: "Não foi possível remover.", id };

  revalidatePath("/admin/opcoes");
  revalidatePath("/orcamentos/[id]", "page");
  return { success: "Condição removida.", id };
}

export async function updateQuoteItemCatalogItem(_: CatalogMutationState, formData: FormData): Promise<CatalogMutationState> {
  const id = String(formData.get("id") ?? "");
  const raw = {
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
    defaultUnitPrice: String(formData.get("defaultUnitPrice") ?? ""),
  };
  const parsed = quoteItemCatalogOptionSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revise o item.", id };

  const { supabase, permissions } = await requireUser();
  if (!permissions.includes("admin_owner")) redirect("/painel?error=forbidden");

  const { error } = await supabase.rpc("update_quote_item_catalog_option", {
    p_option_id: id,
    p_name: parsed.data.name,
    p_description: parsed.data.description ?? "",
    p_default_unit_price_cents: parsed.data.defaultUnitPrice,
  });
  if (error) return { error: error.code === "23505" ? "Esse item já existe." : "Não foi possível atualizar.", id };

  revalidatePath("/admin/opcoes");
  revalidatePath("/orcamentos/[id]", "page");
  return { success: "Item atualizado.", id };
}

export async function removeQuoteItemCatalogItem(_: CatalogMutationState, formData: FormData): Promise<CatalogMutationState> {
  const id = String(formData.get("id") ?? "");
  const { supabase, permissions } = await requireUser();
  if (!permissions.includes("admin_owner")) redirect("/painel?error=forbidden");

  const { error } = await supabase.rpc("remove_quote_item_catalog_option", { p_option_id: id });
  if (error) return { error: "Não foi possível remover.", id };

  revalidatePath("/admin/opcoes");
  revalidatePath("/orcamentos/[id]", "page");
  return { success: "Item removido.", id };
}
