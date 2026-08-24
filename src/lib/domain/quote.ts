import { z } from "zod";

export const quoteStatuses = ["rascunho", "em_elaboracao", "enviado", "aprovado", "recusado", "expirado"] as const;
export const quoteEventAreas = ["lado_esquerdo", "lado_direito", "praia", "casa_completa"] as const;

export const quoteEventAreaSchema = z.object({
  quoteId: z.string().uuid(),
  eventArea: z.enum(quoteEventAreas),
});

export function quoteEventAreaLabel(area: string | null | undefined) {
  const labels: Record<string, string> = {
    lado_esquerdo: "Lado esquerdo",
    lado_direito: "Lado direito",
    praia: "Praia",
    casa_completa: "Casa completa",
  };
  return area ? labels[area] ?? area : "A definir";
}
export type QuoteStatus = (typeof quoteStatuses)[number];

export const quoteItemSchema = z.object({
  quoteId: z.string().uuid(),
  description: z.string().trim().min(2, "Descreva o item.").max(300, "Descrição muito longa."),
  quantity: z.preprocess(
    (value) => (value === "" || value == null ? undefined : value),
    z.coerce.number().positive("Informe uma quantidade maior que zero.").max(100000, "Quantidade muito alta."),
  ),
  unitPrice: z
    .string()
    .trim()
    .min(1, "Informe o valor unitário.")
    .transform(parseCurrencyToCents)
    .refine((value) => value > 0, "Informe um valor válido maior que zero."),
});

export const quoteItemUpdateSchema = quoteItemSchema.extend({
  itemId: z.string().uuid(),
});

export const quoteItemDeleteSchema = z.object({
  itemId: z.string().uuid(),
});

export const quoteStatusSchema = z.object({
  quoteId: z.string().uuid(),
  status: z.enum(quoteStatuses),
  reason: z.string().trim().max(1200, "Use até 1200 caracteres.").optional(),
}).superRefine((value, context) => {
  if ((value.status === "aprovado" || value.status === "recusado") && !value.reason) {
    context.addIssue({
      code: "custom",
      message: "Informe o motivo da decisão.",
      path: ["reason"],
    });
  }
});

export const quoteEditLockSchema = z.object({
  quoteId: z.string().uuid(),
  unlocked: z.boolean(),
  reason: z.string().trim().max(1200, "Use até 1200 caracteres.").optional(),
});

export const quotePackageSchema = z.object({
  quoteId: z.string().uuid(),
  packageId: z.string().uuid(),
  unitPrice: z
    .string()
    .trim()
    .optional()
    .transform((value) => (!value ? undefined : parseCurrencyToCents(value)))
    .refine((value) => value === undefined || value >= 0, "Informe um valor por pessoa válido."),
  notes: z.string().trim().max(1200, "Use até 1200 caracteres.").optional(),
});

export const quotePackageDeleteSchema = z.object({
  quoteId: z.string().uuid(),
});

export const quotePackageChoicesSchema = z.object({
  quoteId: z.string().uuid(),
  packageItemIds: z.array(z.string().uuid()),
});

export function quoteStatusLabel(status: string) {
  const labels: Record<string, string> = {
    rascunho: "Rascunho",
    em_elaboracao: "Em elaboração",
    enviado: "Enviado",
    aprovado: "Aprovado",
    recusado: "Recusado",
    expirado: "Expirado",
  };
  return labels[status] ?? status;
}

export function formatCurrencyFromCents(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value / 100);
}

export function parseCurrencyToCents(value: string) {
  const normalized = value.trim().replace(/^R\$\s?/i, "").replace(/\s/g, "");
  const hasBrazilianCurrencyFormat = /^\d{1,3}(\.\d{3})*(,\d{1,2})?$/.test(normalized) || /^\d+(,\d{1,2})?$/.test(normalized);
  if (!hasBrazilianCurrencyFormat) return -1;

  const numeric = Number(normalized.replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(numeric)) return -1;
  return Math.round(numeric * 100);
}
