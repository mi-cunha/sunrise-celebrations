export type CorporateReportFilters = { start?: string; end?: string; dateBy?: "lead" | "approval" | "payment" | "event"; responsibleId?: string; status?: string };

type EventRow = {
  id: string; status: string; event_type: string | null; event_date: string | null;
  leads: { name: string | null; company: string | null; created_at: string; responsible_id: string | null; profiles: { display_name: string | null } | null } | null;
  quotes: { total_amount_cents: number; approved_at: string | null } | null;
  contracted_event_payments: { status: string; amount_cents: number; paid_at: string | null }[] | null;
  contracted_event_costs: { status: string; estimated_amount_cents: number; actual_amount_cents: number | null; commission_kind: string | null }[] | null;
};

export type CorporateReportRow = { id: string; company: string; eventType: string; leadCreatedAt: string | null; quoteApprovedAt: string | null; eventDate: string | null; contracted: number; received: number; pending: number; commercialCommission: number; managementCommission: number; estimatedCost: number; estimatedMargin: number; responsible: string; responsibleId: string | null; status: string; paymentDates: string[] };

export function summarizeCorporateEvents(events: EventRow[], filters: CorporateReportFilters): CorporateReportRow[] {
  return events.filter((event) => event.event_type?.toLocaleLowerCase("pt-BR") === "corporativo").map((event) => {
    const payments = event.contracted_event_payments ?? [];
    const costs = (event.contracted_event_costs ?? []).filter((cost) => cost.status !== "cancelado");
    const contracted = event.quotes?.total_amount_cents ?? 0;
    const received = payments.filter((payment) => payment.status === "pago").reduce((sum, payment) => sum + payment.amount_cents, 0);
    const commercialCommission = costs.filter((cost) => cost.commission_kind === "comercial").reduce((sum, cost) => sum + (cost.actual_amount_cents ?? cost.estimated_amount_cents), 0);
    const managementCommission = costs.filter((cost) => cost.commission_kind === "gerencia").reduce((sum, cost) => sum + (cost.actual_amount_cents ?? cost.estimated_amount_cents), 0);
    const estimatedCost = costs.reduce((sum, cost) => sum + (cost.actual_amount_cents ?? cost.estimated_amount_cents), 0);
    return { id: event.id, company: event.leads?.company || event.leads?.name || "Cliente não informado", eventType: event.event_type ?? "Corporativo", leadCreatedAt: event.leads?.created_at ?? null, quoteApprovedAt: event.quotes?.approved_at ?? null, eventDate: event.event_date, contracted, received, pending: Math.max(0, contracted - received), commercialCommission, managementCommission, estimatedCost, estimatedMargin: contracted - estimatedCost, responsible: event.leads?.profiles?.display_name ?? "Não atribuído", responsibleId: event.leads?.responsible_id ?? null, status: event.status, paymentDates: payments.filter((payment) => payment.status === "pago" && payment.paid_at).map((payment) => payment.paid_at as string) };
  }).filter((row) => matchesFilters(row, filters));
}

function matchesFilters(row: CorporateReportRow, filters: CorporateReportFilters) {
  if (filters.status && filters.status !== "todos" && row.status !== filters.status) return false;
  if (filters.responsibleId && filters.responsibleId !== "todos" && row.responsibleId !== filters.responsibleId) return false;
  if (filters.dateBy === "payment") return row.paymentDates.some((value) => (!filters.start || value >= filters.start) && (!filters.end || value <= filters.end));
  const date = filters.dateBy === "approval" ? row.quoteApprovedAt : filters.dateBy === "event" ? row.eventDate : row.leadCreatedAt;
  const normalized = date?.slice(0, 10);
  return (!filters.start || (normalized && normalized >= filters.start)) && (!filters.end || (normalized && normalized <= filters.end));
}

export function corporateReportExportRows(rows: CorporateReportRow[]) {
  return rows.map((row) => ({ "Empresa/cliente": row.company, "Tipo de evento": row.eventType, "Data de entrada do lead": row.leadCreatedAt?.slice(0, 10) ?? "", "Data de confirmação da proposta": row.quoteApprovedAt?.slice(0, 10) ?? "", "Data do evento": row.eventDate ?? "", "Valor contratado": row.contracted / 100, "Valor recebido": row.received / 100, "Saldo pendente": row.pending / 100, "Comissão comercial": row.commercialCommission / 100, "Comissão de gerência": row.managementCommission / 100, "Custo total estimado": row.estimatedCost / 100, "Margem estimada": row.estimatedMargin / 100, "Responsável comercial": row.responsible }));
}
