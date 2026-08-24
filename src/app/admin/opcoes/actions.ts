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
  eventTypes: z.array(z.string().trim().min(2).max(80)).min(1, "Selecione ao menos um tipo de evento."),
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

const packageCatalogUpdateSchema = packageCatalogSchema.extend({
  id: z.string().uuid(),
});

const packageCatalogDeleteSchema = z.object({
  id: z.string().uuid(),
});

const packageItemSchema = z.object({
  packageId: z.string().uuid(),
  category: z.enum(["buffet", "bebida", "servico", "estrutura", "observacao", "outro"]),
  name: z.string().trim().min(2, "Informe o item.").max(160, "Use até 160 caracteres."),
  description: z.string().trim().max(800, "Use até 800 caracteres.").optional(),
  showInProposal: z.boolean(),
  showInOperationalBrief: z.boolean(),
  isChoice: z.boolean(),
  choiceGroup: z.string().trim().max(120, "Use até 120 caracteres.").optional(),
  choiceMin: z
    .string()
    .trim()
    .optional()
    .transform((value) => (!value ? null : Number(value)))
    .refine((value) => value === null || (Number.isInteger(value) && value >= 0), "Informe um mínimo válido."),
  choiceMax: z
    .string()
    .trim()
    .optional()
    .transform((value) => (!value ? null : Number(value)))
    .refine((value) => value === null || (Number.isInteger(value) && value >= 1), "Informe um máximo válido."),
}).superRefine((value, context) => {
  if (value.isChoice && !value.choiceGroup) {
    context.addIssue({ code: "custom", message: "Informe o grupo de escolha.", path: ["choiceGroup"] });
  }
  if (value.isChoice && value.choiceMin !== null && value.choiceMax !== null && value.choiceMin > value.choiceMax) {
    context.addIssue({ code: "custom", message: "O mínimo não pode ser maior que o máximo.", path: ["choiceMin"] });
  }
});

const packageItemUpdateSchema = packageItemSchema.extend({
  id: z.string().uuid(),
});

const packageItemDeleteSchema = z.object({
  id: z.string().uuid(),
});

const packageSubcategorySchema = z.object({
  category: z.enum(["buffet", "bebida", "servico", "estrutura", "decoracao", "observacao", "outro"]),
  name: z.string().trim().min(2, "Informe a subcategoria.").max(120, "Use até 120 caracteres."),
  description: z.string().trim().max(800, "Use até 800 caracteres.").optional(),
});

const packageLibraryItemSchema = z.object({
  subcategoryId: z.string().uuid(),
  name: z.string().trim().min(2, "Informe o item.").max(160, "Use até 160 caracteres."),
  proposalDescription: z.string().trim().max(800, "Use até 800 caracteres.").optional(),
  operationalDescription: z.string().trim().max(800, "Use até 800 caracteres.").optional(),
  showInProposal: z.boolean(),
  showInOperationalBrief: z.boolean(),
});

const packageRuleSchema = z
  .object({
    packageId: z.string().uuid(),
    subcategoryId: z.string().uuid(),
    itemIds: z.array(z.string().uuid()).default([]),
    title: z.string().trim().max(160, "Use até 160 caracteres.").optional(),
    selectionMin: z
      .string()
      .trim()
      .optional()
      .transform((value) => (!value ? 0 : Number(value)))
      .refine((value) => Number.isInteger(value) && value >= 0, "Informe um mínimo válido."),
    selectionMax: z
      .string()
      .trim()
      .optional()
      .transform((value) => (!value ? 0 : Number(value)))
      .refine((value) => Number.isInteger(value) && value >= 0, "Informe um máximo válido."),
    isRequired: z.boolean(),
  })
  .superRefine((value, context) => {
    if (value.selectionMax > 0 && value.selectionMin > value.selectionMax) {
      context.addIssue({ code: "custom", message: "O mínimo não pode ser maior que o máximo.", path: ["selectionMin"] });
    }
  });

const packageRuleItemSchema = z.object({
  ruleId: z.string().uuid(),
  itemId: z.string().uuid(),
});

export type OptionFormState = { error?: string; success?: string; kind?: "event_type" | "lead_source"; name?: string };
export type LogoFormState = { error?: string; success?: string; logoUrl?: string };
export type ProposalOptionFormState = { error?: string; success?: string; title?: string; content?: string };
export type QuoteItemCatalogOptionFormState = { error?: string; success?: string; name?: string; description?: string; defaultUnitPrice?: string };
export type PackageCatalogFormState = { error?: string; success?: string; id?: string; eventType?: string; eventTypes?: string[]; name?: string; description?: string; basePrice?: string; proposalNotes?: string; operationNotes?: string };
export type PackageItemFormState = { error?: string; success?: string; packageId?: string; category?: string; name?: string; description?: string; isChoice?: string; choiceGroup?: string; choiceMin?: string; choiceMax?: string };
export type PackageModelFormState = { error?: string; success?: string; id?: string; category?: string; subcategoryId?: string; packageId?: string; ruleId?: string; itemId?: string; name?: string; description?: string; proposalDescription?: string; operationalDescription?: string; title?: string; selectionMin?: string; selectionMax?: string };
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
    eventTypes: formData.getAll("eventTypes").map(String),
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

  const primaryEventType = parsed.data.eventTypes[0];
  const { error } = await supabase.from("event_package_catalog").insert({
    event_type: primaryEventType,
    event_types: parsed.data.eventTypes,
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

export async function updateEventPackage(_: PackageCatalogFormState, formData: FormData): Promise<PackageCatalogFormState> {
  const raw = packageRawValues(formData);
  const parsed = packageCatalogUpdateSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revise o pacote.", ...raw };

  const { supabase, permissions } = await requireUser();
  if (!permissions.includes("admin_owner")) redirect("/painel?error=forbidden");

  const primaryEventType = parsed.data.eventTypes[0];
  const { error } = await supabase
    .from("event_package_catalog")
    .update({
      event_type: primaryEventType,
      event_types: parsed.data.eventTypes,
      name: parsed.data.name,
      description: parsed.data.description || null,
      base_price_cents: parsed.data.basePrice,
      proposal_notes: parsed.data.proposalNotes || null,
      operation_notes: parsed.data.operationNotes || null,
    })
    .eq("id", parsed.data.id);
  if (error) return { error: error.code === "23505" ? "Esse pacote já existe para este tipo de evento." : "Não foi possível atualizar o pacote.", ...raw };

  revalidatePath("/admin/opcoes");
  revalidatePath("/orcamentos/[id]", "page");
  revalidatePath("/orcamentos/[id]/proposta", "page");
  return { success: "Pacote atualizado.", id: parsed.data.id };
}

export async function removeEventPackage(_: PackageCatalogFormState, formData: FormData): Promise<PackageCatalogFormState> {
  const parsed = packageCatalogDeleteSchema.safeParse({
    id: formData.get("id"),
  });
  if (!parsed.success) return { error: "Não foi possível identificar o pacote.", id: String(formData.get("id") ?? "") };

  const { supabase, permissions } = await requireUser();
  if (!permissions.includes("admin_owner")) redirect("/painel?error=forbidden");

  const { error } = await supabase.from("event_package_catalog").update({ is_active: false }).eq("id", parsed.data.id);
  if (error) return { error: "Não foi possível remover o pacote.", id: parsed.data.id };

  revalidatePath("/admin/opcoes");
  revalidatePath("/orcamentos/[id]", "page");
  return { success: "Pacote removido do catálogo.", id: parsed.data.id };
}

function packageRawValues(formData: FormData) {
  return {
    id: String(formData.get("id") ?? ""),
    eventTypes: formData.getAll("eventTypes").map(String),
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
    basePrice: String(formData.get("basePrice") ?? ""),
    proposalNotes: String(formData.get("proposalNotes") ?? ""),
    operationNotes: String(formData.get("operationNotes") ?? ""),
  };
}

export async function createEventPackageItem(_: PackageItemFormState, formData: FormData): Promise<PackageItemFormState> {
  const raw = {
    packageId: String(formData.get("packageId") ?? ""),
    category: String(formData.get("category") ?? ""),
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
    showInProposal: formData.get("showInProposal") === "on",
    showInOperationalBrief: formData.get("showInOperationalBrief") === "on",
    isChoice: formData.get("isChoice") === "on",
    choiceGroup: String(formData.get("choiceGroup") ?? ""),
    choiceMin: String(formData.get("choiceMin") ?? ""),
    choiceMax: String(formData.get("choiceMax") ?? ""),
  };
  const parsed = packageItemSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revise o item do pacote.", packageId: raw.packageId, category: raw.category, name: raw.name, description: raw.description, isChoice: raw.isChoice ? "on" : "", choiceGroup: raw.choiceGroup, choiceMin: raw.choiceMin, choiceMax: raw.choiceMax };

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
    is_choice: parsed.data.isChoice,
    choice_group: parsed.data.isChoice ? parsed.data.choiceGroup : null,
    choice_min: parsed.data.isChoice ? parsed.data.choiceMin : null,
    choice_max: parsed.data.isChoice ? parsed.data.choiceMax : null,
    sort_order: sortOrder ?? 100,
  });
  if (error) return { error: "Não foi possível salvar o item do pacote.", packageId: parsed.data.packageId, category: parsed.data.category, name: parsed.data.name, description: parsed.data.description ?? "", isChoice: parsed.data.isChoice ? "on" : "", choiceGroup: parsed.data.choiceGroup ?? "", choiceMin: raw.choiceMin, choiceMax: raw.choiceMax };

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
    isChoice: formData.get("isChoice") === "on",
    choiceGroup: String(formData.get("choiceGroup") ?? ""),
    choiceMin: String(formData.get("choiceMin") ?? ""),
    choiceMax: String(formData.get("choiceMax") ?? ""),
  };
  const parsed = packageItemUpdateSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revise o item do pacote.", packageId: raw.packageId, category: raw.category, name: raw.name, description: raw.description, isChoice: raw.isChoice ? "on" : "", choiceGroup: raw.choiceGroup, choiceMin: raw.choiceMin, choiceMax: raw.choiceMax };

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
      is_choice: parsed.data.isChoice,
      choice_group: parsed.data.isChoice ? parsed.data.choiceGroup : null,
      choice_min: parsed.data.isChoice ? parsed.data.choiceMin : null,
      choice_max: parsed.data.isChoice ? parsed.data.choiceMax : null,
    })
    .eq("id", parsed.data.id);
  if (error) return { error: "Não foi possível atualizar o item do pacote.", packageId: parsed.data.packageId, category: parsed.data.category, name: parsed.data.name, description: parsed.data.description ?? "", isChoice: parsed.data.isChoice ? "on" : "", choiceGroup: parsed.data.choiceGroup ?? "", choiceMin: raw.choiceMin, choiceMax: raw.choiceMax };

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

export async function createPackageSubcategory(_: PackageModelFormState, formData: FormData): Promise<PackageModelFormState> {
  const raw = {
    category: String(formData.get("category") ?? ""),
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
  };
  const parsed = packageSubcategorySchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revise a subcategoria.", ...raw };

  const { supabase, permissions } = await requireUser();
  if (!permissions.includes("admin_owner")) redirect("/painel?error=forbidden");

  const { error } = await supabase.from("event_package_subcategories").insert({
    category: parsed.data.category,
    name: parsed.data.name,
    description: parsed.data.description || null,
  });
  if (error) return { error: error.code === "23505" ? "Essa subcategoria já existe nessa categoria." : "Não foi possível salvar a subcategoria.", ...raw };

  revalidatePath("/admin/opcoes");
  return { success: "Subcategoria criada." };
}

export async function createPackageLibraryItem(_: PackageModelFormState, formData: FormData): Promise<PackageModelFormState> {
  const raw = {
    subcategoryId: String(formData.get("subcategoryId") ?? ""),
    name: String(formData.get("name") ?? ""),
    proposalDescription: String(formData.get("proposalDescription") ?? ""),
    operationalDescription: String(formData.get("operationalDescription") ?? ""),
    showInProposal: formData.get("showInProposal") === "on",
    showInOperationalBrief: formData.get("showInOperationalBrief") === "on",
  };
  const parsed = packageLibraryItemSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revise o item.", subcategoryId: raw.subcategoryId, name: raw.name, proposalDescription: raw.proposalDescription, operationalDescription: raw.operationalDescription };

  const { supabase, permissions } = await requireUser();
  if (!permissions.includes("admin_owner")) redirect("/painel?error=forbidden");

  const { error } = await supabase.from("event_package_item_catalog").insert({
    subcategory_id: parsed.data.subcategoryId,
    name: parsed.data.name,
    proposal_description: parsed.data.proposalDescription || null,
    operational_description: parsed.data.operationalDescription || null,
    show_in_proposal: parsed.data.showInProposal,
    show_in_operational_brief: parsed.data.showInOperationalBrief,
  });
  if (error) return { error: error.code === "23505" ? "Esse item já existe nessa subcategoria." : "Não foi possível salvar o item.", subcategoryId: raw.subcategoryId, name: raw.name, proposalDescription: raw.proposalDescription, operationalDescription: raw.operationalDescription };

  revalidatePath("/admin/opcoes");
  return { success: "Item criado na biblioteca." };
}

export async function createPackageRule(_: PackageModelFormState, formData: FormData): Promise<PackageModelFormState> {
  const raw = {
    packageId: String(formData.get("packageId") ?? ""),
    subcategoryId: String(formData.get("subcategoryId") ?? ""),
    itemIds: formData.getAll("itemIds").map(String),
    title: String(formData.get("title") ?? ""),
    selectionMin: String(formData.get("selectionMin") ?? ""),
    selectionMax: String(formData.get("selectionMax") ?? ""),
    isRequired: formData.get("isRequired") === "on",
  };
  const parsed = packageRuleSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revise a regra do pacote.", packageId: raw.packageId, subcategoryId: raw.subcategoryId, title: raw.title, selectionMin: raw.selectionMin, selectionMax: raw.selectionMax };

  const { supabase, permissions } = await requireUser();
  if (!permissions.includes("admin_owner")) redirect("/painel?error=forbidden");

  if (parsed.data.itemIds.length > 0) {
    const { count, error: itemCheckError } = await supabase
      .from("event_package_item_catalog")
      .select("id", { count: "exact", head: true })
      .eq("subcategory_id", parsed.data.subcategoryId)
      .in("id", parsed.data.itemIds);
    if (itemCheckError || count !== parsed.data.itemIds.length) {
      return { error: "Selecione apenas itens da subcategoria escolhida.", packageId: raw.packageId, subcategoryId: raw.subcategoryId, title: raw.title, selectionMin: raw.selectionMin, selectionMax: raw.selectionMax };
    }
  }

  const { data: createdRule, error } = await supabase.from("event_package_rules").insert({
    package_id: parsed.data.packageId,
    subcategory_id: parsed.data.subcategoryId,
    title: parsed.data.title || null,
    selection_min: parsed.data.selectionMin,
    selection_max: parsed.data.selectionMax,
    is_required: parsed.data.isRequired,
  }).select("id").single();
  if (error) return { error: error.code === "23505" ? "Essa subcategoria já está configurada neste pacote." : "Não foi possível salvar a regra.", packageId: raw.packageId, subcategoryId: raw.subcategoryId, title: raw.title, selectionMin: raw.selectionMin, selectionMax: raw.selectionMax };

  if (createdRule && parsed.data.itemIds.length > 0) {
    const { error: itemError } = await supabase.from("event_package_rule_items").insert(
      parsed.data.itemIds.map((itemId) => ({
        package_rule_id: createdRule.id,
        item_catalog_id: itemId,
      })),
    );
    if (itemError) return { error: "Regra criada, mas não foi possível associar os itens.", packageId: raw.packageId, subcategoryId: raw.subcategoryId };
  }

  revalidatePath("/admin/opcoes");
  return { success: "Regra criada no pacote." };
}

export async function attachPackageRuleItem(_: PackageModelFormState, formData: FormData): Promise<PackageModelFormState> {
  const raw = {
    ruleId: String(formData.get("ruleId") ?? ""),
    itemId: String(formData.get("itemId") ?? ""),
  };
  const parsed = packageRuleItemSchema.safeParse(raw);
  if (!parsed.success) return { error: "Selecione regra e item.", ruleId: raw.ruleId, itemId: raw.itemId };

  const { supabase, permissions } = await requireUser();
  if (!permissions.includes("admin_owner")) redirect("/painel?error=forbidden");

  const { error } = await supabase.from("event_package_rule_items").insert({
    package_rule_id: parsed.data.ruleId,
    item_catalog_id: parsed.data.itemId,
  });
  if (error) return { error: error.code === "23505" ? "Esse item já está associado a essa regra." : "Não foi possível associar o item.", ruleId: raw.ruleId, itemId: raw.itemId };

  revalidatePath("/admin/opcoes");
  return { success: "Item associado ao pacote.", ruleId: parsed.data.ruleId };
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
