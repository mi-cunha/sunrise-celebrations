import { z } from "zod";

export const leadStatuses = ["novo", "em_atendimento", "qualificado", "orcamento_em_elaboracao", "proposta_enviada", "negociacao", "ganho", "perdido"] as const;
export type LeadStatus = (typeof leadStatuses)[number];
export const permissions = ["atendimento", "financeiro", "gerencia", "direcao", "admin_owner"] as const;
export type Permission = (typeof permissions)[number];
export const defaultEventTypes = ["Casamento", "Corporativo", "Aniversário", "Café da manhã", "Formatura", "Confraternização", "Brunch", "Almoço", "Jantar", "Outro"] as const;
export const defaultLeadSources = ["WhatsApp", "Instagram", "Indicação", "Site", "Evento", "Parceiro", "Retorno", "Outro"] as const;

const optionalText = (max: number) => z.string().trim().max(max).optional().transform(value => value || undefined);
const optionalNumber = z.preprocess(value => value === "" || value == null ? undefined : value, z.coerce.number().int().min(1, "Informe ao menos 1 convidado.").max(10000).optional());
const phoneSchema = z.string().trim().transform(formatBrazilPhone).refine(value => /^\(\d{2}\) \d{4,5}-\d{4}$/.test(value), "Informe um telefone com DDD.");
export const leadSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do contato.").max(120),
  company: optionalText(120),
  phone: phoneSchema,
  source: optionalText(80),
  eventType: optionalText(80),
  desiredDate: z.string().optional().transform(value => value || undefined).refine(value => !value || !Number.isNaN(Date.parse(value)), "Informe uma data válida."),
  guestCount: optionalNumber,
  notes: optionalText(2000),
  responsibleId: z.preprocess(value => value === "" ? undefined : value, z.string().uuid().optional()),
});
export type LeadInput = z.infer<typeof leadSchema>;

export function canManageLeads(userPermissions: readonly string[]) {
  return userPermissions.includes("atendimento") || userPermissions.includes("gerencia") || userPermissions.includes("direcao") || userPermissions.includes("admin_owner");
}

export function formatBrazilPhone(value: string) {
  let digits = value.replace(/\D/g, "");
  if (digits.length > 11 && digits.startsWith("55")) digits = digits.slice(2);
  digits = digits.slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}
