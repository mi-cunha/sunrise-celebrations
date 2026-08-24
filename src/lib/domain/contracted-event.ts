import { z } from "zod";
import { formatBrazilPhone } from "@/lib/domain/lead";
import { parseCurrencyToCents } from "@/lib/domain/quote";

export const contractedEventStatuses = ["planejamento", "confirmado", "em_execucao", "realizado", "cancelado"] as const;
export type ContractedEventStatus = (typeof contractedEventStatuses)[number];

export const contractedEventVendorStatuses = ["pendente", "confirmado", "substituir", "cancelado"] as const;
export type ContractedEventVendorStatus = (typeof contractedEventVendorStatuses)[number];

export const contractedEventContractStatuses = ["pendente", "enviado", "assinado", "cancelado"] as const;
export type ContractedEventContractStatus = (typeof contractedEventContractStatuses)[number];

export const contractedEventPaymentKinds = ["sinal", "parcela", "saldo", "outro"] as const;
export type ContractedEventPaymentKind = (typeof contractedEventPaymentKinds)[number];

export const contractedEventPaymentStatuses = ["previsto", "pago", "atrasado", "cancelado"] as const;
export type ContractedEventPaymentStatus = (typeof contractedEventPaymentStatuses)[number];

export const contractedEventPaymentMethods = ["pix", "cartao_credito", "cartao_debito", "boleto", "transferencia", "dinheiro", "outro"] as const;
export type ContractedEventPaymentMethod = (typeof contractedEventPaymentMethods)[number];

export const contractedEventBillingModels = ["orcamento_fechado", "consumo_aberto_pos_evento", "pre_pago_com_consumo_aberto"] as const;
export type ContractedEventBillingModel = (typeof contractedEventBillingModels)[number];

export const contractedEventPaymentPlanIntervals = ["semanal", "quinzenal", "mensal", "personalizado"] as const;
export type ContractedEventPaymentPlanInterval = (typeof contractedEventPaymentPlanIntervals)[number];

export const createContractedEventSchema = z.object({
  quoteId: z.string().uuid(),
});

export const contractedEventStatusSchema = z.object({
  eventId: z.string().uuid(),
  status: z.enum(contractedEventStatuses),
});

export const contractedEventNotesSchema = z.object({
  eventId: z.string().uuid(),
  notes: z.string().trim().max(4000, "Use até 4000 caracteres.").optional().transform((value) => value || undefined),
});

export const contractedEventChecklistSchema = z.object({
  itemId: z.string().uuid(),
  isDone: z.boolean(),
});

const optionalDate = z
  .string()
  .optional()
  .transform((value) => value || undefined)
  .refine((value) => !value || !Number.isNaN(Date.parse(value)), "Informe uma data válida.");

const optionalUuid = z.preprocess((value) => (value === "" ? undefined : value), z.string().uuid().optional());

const optionalNotes = z.string().trim().max(1200, "Use até 1200 caracteres.").optional().transform((value) => value || undefined);

const optionalCpfCnpj = z
  .string()
  .trim()
  .max(80, "Use até 80 caracteres.")
  .optional()
  .transform((value) => value || undefined)
  .refine((value) => !value || isValidCpfCnpj(value), "Informe um CPF ou CNPJ válido.");

export const contractedEventChecklistItemSchema = z.object({
  eventId: z.string().uuid(),
  title: z.string().trim().min(2, "Informe a pendência.").max(160, "Use até 160 caracteres."),
  assignedTo: optionalUuid,
  dueDate: optionalDate,
  notes: optionalNotes,
});

export const contractedEventChecklistItemUpdateSchema = contractedEventChecklistItemSchema.extend({
  itemId: z.string().uuid(),
});

export const contractedEventChecklistItemDeleteSchema = z.object({
  eventId: z.string().uuid(),
  itemId: z.string().uuid(),
});

export const contractedEventChecklistItemMoveSchema = z.object({
  eventId: z.string().uuid(),
  itemId: z.string().uuid(),
  direction: z.enum(["up", "down"]),
});

export const eventOperationalBriefSchema = z.object({
  eventId: z.string().uuid(),
});

const optionalTime = z
  .string()
  .optional()
  .transform((value) => value || undefined)
  .refine((value) => !value || /^([01]\d|2[0-3]):[0-5]\d$/.test(value), "Informe um horário válido.");

export const contractedEventTimelineEntrySchema = z
  .object({
    eventId: z.string().uuid(),
    title: z.string().trim().min(2, "Informe a etapa.").max(160, "Use até 160 caracteres."),
    startTime: optionalTime,
    endTime: optionalTime,
    location: z.string().trim().max(160, "Use até 160 caracteres.").optional().transform((value) => value || undefined),
    assignedTo: optionalUuid,
    notes: optionalNotes,
  })
  .superRefine((value, context) => {
    if (value.startTime && value.endTime && value.endTime < value.startTime) {
      context.addIssue({
        code: "custom",
        message: "O fim deve ser depois do início.",
        path: ["endTime"],
      });
    }
  });

export const contractedEventTimelineEntryUpdateSchema = contractedEventTimelineEntrySchema.extend({
  entryId: z.string().uuid(),
});

export const contractedEventTimelineEntryDeleteSchema = z.object({
  eventId: z.string().uuid(),
  entryId: z.string().uuid(),
});

export const contractedEventVendorSchema = z.object({
  eventId: z.string().uuid(),
  category: z.string().trim().min(2, "Informe o tipo de fornecedor.").max(80, "Use até 80 caracteres."),
  name: z.string().trim().min(2, "Informe o nome do fornecedor.").max(160, "Use até 160 caracteres."),
  contactName: z.string().trim().max(160, "Use até 160 caracteres.").optional().transform((value) => value || undefined),
  phone: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? formatBrazilPhone(value) : undefined))
    .refine((value) => !value || /^\(\d{2}\) \d{4,5}-\d{4}$/.test(value), "Informe um telefone com DDD."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(160, "Use até 160 caracteres.")
    .optional()
    .transform((value) => value || undefined)
    .refine((value) => !value || z.string().email().safeParse(value).success, "Informe um e-mail válido."),
  status: z.enum(contractedEventVendorStatuses),
  notes: optionalNotes,
});

export const contractedEventVendorUpdateSchema = contractedEventVendorSchema.extend({
  vendorId: z.string().uuid(),
});

export const contractedEventVendorDeleteSchema = z.object({
  eventId: z.string().uuid(),
  vendorId: z.string().uuid(),
});

export const contractedEventContractSchema = z.object({
  eventId: z.string().uuid(),
  status: z.enum(contractedEventContractStatuses),
  signedAt: optionalDate,
  notes: optionalNotes,
});

export const contractedEventContractDocumentKinds = ["auto", "contrato_completo", "termo_simplificado", "aceite_proposta"] as const;
export type ContractedEventContractDocumentKind = (typeof contractedEventContractDocumentKinds)[number];

export const contractedEventContractDocumentSchema = z.object({
  eventId: z.string().uuid(),
  documentKind: z.enum(contractedEventContractDocumentKinds),
  contractingPartyName: z.string().trim().max(180, "Use até 180 caracteres.").optional().transform((value) => value || undefined),
  contractingPartyDocument: optionalCpfCnpj,
  contractingPartyAddress: z.string().trim().max(240, "Use até 240 caracteres.").optional().transform((value) => value || undefined),
  contractingPartyRepresentative: z.string().trim().max(180, "Use até 180 caracteres.").optional().transform((value) => value || undefined),
  eventSchedule: z.string().trim().max(120, "Use até 120 caracteres.").optional().transform((value) => value || undefined),
  specialClauses: z.string().trim().max(1600, "Use até 1600 caracteres.").optional().transform((value) => value || undefined),
  notes: optionalNotes,
});

export const contractedEventBillingModelSchema = z.object({
  eventId: z.string().uuid(),
  billingModel: z.enum(contractedEventBillingModels),
  billingNotes: optionalNotes,
});

export const contractedEventPaymentSchema = z
  .object({
    eventId: z.string().uuid(),
    kind: z.enum(contractedEventPaymentKinds),
    status: z.enum(contractedEventPaymentStatuses),
    amount: z
      .string()
      .trim()
      .min(1, "Informe o valor.")
      .transform(parseCurrencyToCents)
      .refine((value) => value > 0, "Informe um valor válido maior que zero."),
    dueDate: optionalDate,
    paidAt: optionalDate,
    paymentMethod: z.preprocess((value) => (value === "" ? undefined : value), z.enum(contractedEventPaymentMethods).optional()),
    notes: optionalNotes,
  })
  .superRefine((value, context) => {
    if (value.status === "pago" && !value.paidAt) {
      context.addIssue({
        code: "custom",
        message: "Informe a data de pagamento.",
        path: ["paidAt"],
      });
    }
  });

export const contractedEventPaymentUpdateSchema = contractedEventPaymentSchema.extend({
  paymentId: z.string().uuid(),
});

export const contractedEventPaymentPlanSchema = z
  .object({
    eventId: z.string().uuid(),
    signalAmount: z
      .string()
      .trim()
      .optional()
      .transform((value) => (value ? parseCurrencyToCents(value) : 0))
      .refine((value) => value >= 0, "Informe um sinal válido."),
    signalDueDate: optionalDate,
    installmentCount: z
      .string()
      .trim()
      .min(1, "Informe a quantidade de parcelas.")
      .transform(Number)
      .refine((value) => Number.isInteger(value) && value >= 0 && value <= 24, "Use de 0 a 24 parcelas."),
    firstInstallmentDueDate: optionalDate,
    installmentInterval: z.enum(contractedEventPaymentPlanIntervals),
    customIntervalDays: z
      .string()
      .trim()
      .optional()
      .transform((value) => (value ? Number(value) : undefined))
      .refine((value) => value === undefined || (Number.isInteger(value) && value >= 1 && value <= 365), "Use de 1 a 365 dias."),
    paymentMethod: z.preprocess((value) => (value === "" ? undefined : value), z.enum(contractedEventPaymentMethods).optional()),
    notes: optionalNotes,
  })
  .superRefine((value, context) => {
    if (value.signalAmount > 0 && !value.signalDueDate) {
      context.addIssue({
        code: "custom",
        message: "Informe o vencimento do sinal.",
        path: ["signalDueDate"],
      });
    }
    if (value.installmentCount > 0 && !value.firstInstallmentDueDate) {
      context.addIssue({
        code: "custom",
        message: "Informe o primeiro vencimento.",
        path: ["firstInstallmentDueDate"],
      });
    }
    if (value.installmentCount > 1 && value.installmentInterval === "personalizado" && !value.customIntervalDays) {
      context.addIssue({
        code: "custom",
        message: "Informe o intervalo personalizado em dias.",
        path: ["customIntervalDays"],
      });
    }
    if (value.signalAmount <= 0 && value.installmentCount <= 0) {
      context.addIssue({
        code: "custom",
        message: "Informe sinal ou pelo menos uma parcela.",
        path: ["installmentCount"],
      });
    }
  });

export const contractedEventPaymentDeleteSchema = z.object({
  eventId: z.string().uuid(),
  paymentId: z.string().uuid(),
});

export function contractedEventStatusLabel(status: string) {
  const labels: Record<string, string> = {
    planejamento: "Planejamento",
    confirmado: "Confirmado",
    em_execucao: "Em execução",
    realizado: "Realizado",
    cancelado: "Cancelado",
  };
  return labels[status] ?? status;
}

export function contractedEventVendorStatusLabel(status: string) {
  const labels: Record<string, string> = {
    pendente: "Pendente",
    confirmado: "Confirmado",
    substituir: "Substituir",
    cancelado: "Cancelado",
  };
  return labels[status] ?? status;
}

export function contractedEventContractStatusLabel(status: string) {
  const labels: Record<string, string> = {
    pendente: "Pendente",
    enviado: "Enviado",
    assinado: "Assinado",
    cancelado: "Cancelado",
  };
  return labels[status] ?? status;
}

export function contractedEventContractDocumentKindLabel(kind: string) {
  const labels: Record<string, string> = {
    auto: "Automático conforme o porte do evento",
    contrato_completo: "Contrato completo de prestação de serviços",
    termo_simplificado: "Contrato simplificado de prestação de serviços",
    aceite_proposta: "Termo de ciência e consentimento para evento",
  };
  return labels[kind] ?? kind;
}

export function contractedEventBillingModelLabel(model: string) {
  const labels: Record<string, string> = {
    orcamento_fechado: "Orçamento fechado",
    consumo_aberto_pos_evento: "Consumo aberto - Pagamento pós-evento",
    pre_pago_com_consumo_aberto: "Pré-pago + consumo aberto",
  };
  return labels[model] ?? model;
}

export function contractedEventPaymentKindLabel(kind: string) {
  const labels: Record<string, string> = {
    sinal: "Sinal",
    parcela: "Parcela",
    saldo: "Saldo",
    outro: "Outro",
  };
  return labels[kind] ?? kind;
}

export function contractedEventPaymentStatusLabel(status: string) {
  const labels: Record<string, string> = {
    previsto: "Previsto",
    pago: "Pago",
    atrasado: "Atrasado",
    cancelado: "Cancelado",
  };
  return labels[status] ?? status;
}

export function contractedEventPaymentMethodLabel(method: string) {
  const labels: Record<string, string> = {
    pix: "Pix",
    cartao_credito: "Cartão de crédito",
    cartao_debito: "Cartão de débito",
    boleto: "Boleto",
    transferencia: "Transferência bancária",
    dinheiro: "Dinheiro",
    outro: "Outro",
    Pix: "Pix",
    "cartão": "Cartão",
    cartao: "Cartão",
  };
  return labels[method] ?? method;
}

export function contractedEventPaymentPlanIntervalLabel(interval: string) {
  const labels: Record<string, string> = {
    semanal: "Semanal",
    quinzenal: "Quinzenal",
    mensal: "Mensal",
    personalizado: "Personalizado",
  };
  return labels[interval] ?? interval;
}

function isValidCpfCnpj(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 11) return isValidCpf(digits);
  if (digits.length === 14) return isValidCnpj(digits);
  return false;
}

function isValidCpf(cpf: string) {
  if (/^(\d)\1+$/.test(cpf)) return false;
  const firstDigit = calculateCheckDigit(cpf.slice(0, 9), 10);
  const secondDigit = calculateCheckDigit(cpf.slice(0, 10), 11);
  return cpf === `${cpf.slice(0, 9)}${firstDigit}${secondDigit}`;
}

function isValidCnpj(cnpj: string) {
  if (/^(\d)\1+$/.test(cnpj)) return false;
  const firstWeights = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const secondWeights = [6, ...firstWeights];
  const firstDigit = calculateWeightedCheckDigit(cnpj.slice(0, 12), firstWeights);
  const secondDigit = calculateWeightedCheckDigit(cnpj.slice(0, 13), secondWeights);
  return cnpj === `${cnpj.slice(0, 12)}${firstDigit}${secondDigit}`;
}

function calculateCheckDigit(base: string, initialWeight: number) {
  const sum = base.split("").reduce((total, digit, index) => total + Number(digit) * (initialWeight - index), 0);
  const remainder = (sum * 10) % 11;
  return remainder === 10 ? 0 : remainder;
}

function calculateWeightedCheckDigit(base: string, weights: number[]) {
  const sum = base.split("").reduce((total, digit, index) => total + Number(digit) * weights[index], 0);
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}
