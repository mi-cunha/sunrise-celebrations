import { z } from "zod";

export const leadStatuses = ["novo", "em_atendimento", "qualificado", "visita_agendada", "orcamento_em_elaboracao", "proposta_enviada", "negociacao", "ganho", "perdido"] as const;
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
  budgetRange: optionalText(120),
  notes: optionalText(2000),
  responsibleId: z.preprocess(value => value === "" ? undefined : value, z.string().uuid().optional()),
});
export type LeadInput = z.infer<typeof leadSchema>;

export const eventScheduleSchema = z.object({
  desiredDateMode: z.enum(["exact", "month_year", "weekday", "undefined"]),
  desiredDate: z.string().optional().transform((value) => value || undefined).refine((value) => !value || !Number.isNaN(Date.parse(value)), "Informe uma data válida."),
  desiredDateNote: optionalText(80),
  desiredStartTime: z.string().regex(/^$|^([01]\d|2[0-3]):[0-5]\d$/, "Informe um horário válido."),
  desiredDurationMinutes: z.preprocess((value) => value === "" || value == null ? undefined : value, z.coerce.number().min(0.5, "Informe ao menos 30 minutos.").max(24, "Informe no máximo 24 horas.").optional()),
}).superRefine((value, context) => {
  if (value.desiredDateMode === "exact" && !value.desiredDate) context.addIssue({ code: "custom", path: ["desiredDate"], message: "Informe a data exata ou escolha outra opção." });
  if (["month_year", "weekday"].includes(value.desiredDateMode) && !value.desiredDateNote) context.addIssue({ code: "custom", path: ["desiredDateNote"], message: "Descreva o mês/ano ou o dia da semana." });
});

export const followUpSchema = z.object({
  leadId: z.string().uuid(),
  nextAction: z.string().trim().min(2, "Descreva a próxima ação.").max(240),
  nextActionAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data da próxima ação."),
  nextActionAssigneeId: z.string().uuid("Selecione o responsável pela ação."),
});

export const leadStatusChangeSchema = z.object({
  leadId: z.string().uuid(),
  status: z.enum(leadStatuses),
  lostReason: optionalText(500),
}).superRefine((value, context) => {
  if (value.status === "perdido" && !value.lostReason) {
    context.addIssue({ code: "custom", path: ["lostReason"], message: "Informe o motivo da perda." });
  }
});

export function isOverdueFollowUp(date: string, today: string) {
  return date < today;
}

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
