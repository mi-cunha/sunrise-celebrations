import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { formatCurrencyFromCents } from "@/lib/domain/quote";
import { requireUser } from "@/lib/auth";
import { summarizeCorporateEvents, type CorporateReportFilters } from "@/lib/corporate-report";

export default async function CorporateReportPage({ searchParams }: { searchParams: Promise<{ inicio?: string; fim?: string; criterio?: string; responsavel?: string; status?: string }> }) {
  const query = await searchParams;
  const { supabase, permissions } = await requireUser();
  if (!permissions.some((permission) => ["financeiro", "gerencia", "direcao", "admin_owner"].includes(permission))) redirect("/painel?error=forbidden");
  const filters: CorporateReportFilters = { start: query.inicio, end: query.fim, dateBy: normalizeDateBy(query.criterio), responsibleId: query.responsavel, status: query.status };
  const [{ data, error }, { data: people }] = await Promise.all([
    supabase.from("contracted_events").select("id,status,event_type,event_date,leads(name,company,created_at,responsible_id,profiles!leads_responsible_id_fkey(display_name)),quotes(total_amount_cents,approved_at),contracted_event_payments(status,amount_cents,paid_at),contracted_event_costs(status,estimated_amount_cents,actual_amount_cents,commission_kind)").limit(1000),
    supabase.rpc("get_active_operational_profiles"),
  ]);
  const rows = summarizeCorporateEvents((data ?? []) as never[], filters);
  const totals = rows.reduce((sum, row) => ({ contracted: sum.contracted + row.contracted, received: sum.received + row.received, cost: sum.cost + row.estimatedCost, margin: sum.margin + row.estimatedMargin, realized: sum.realized + (row.eventDate && row.eventDate <= new Date().toISOString().slice(0, 10) ? 1 : 0) }), { contracted: 0, received: 0, cost: 0, margin: 0, realized: 0 });
  const exportSearch = new URLSearchParams(); for (const [key, value] of Object.entries({ inicio: query.inicio, fim: query.fim, criterio: query.criterio, responsavel: query.responsavel, status: query.status })) if (value) exportSearch.set(key, value);

  return <AppShell title="Relatório corporativo">
    <p className="mt-2 text-sm text-slate-600">Propostas aprovadas de eventos corporativos, com recebimentos, comissões, custos e margem estimada.</p>
    {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">Não foi possível carregar o relatório.</p>}
    <form method="get" className="mt-5 grid gap-3 rounded-xl border border-[#dbe3dc] bg-white p-4 md:grid-cols-3 xl:grid-cols-5">
      <label>Período inicial<input name="inicio" type="date" defaultValue={query.inicio} /></label><label>Período final<input name="fim" type="date" defaultValue={query.fim} /></label>
      <label>Critério de data<select name="criterio" defaultValue={filters.dateBy}><option value="lead">Entrada do lead</option><option value="approval">Confirmação da proposta</option><option value="payment">Pagamento recebido</option><option value="event">Data do evento</option></select></label>
      <label>Responsável comercial<select name="responsavel" defaultValue={query.responsavel ?? "todos"}><option value="todos">Todos</option>{(people ?? []).map((person: { id: string; display_name: string | null }) => <option key={person.id} value={person.id}>{person.display_name ?? "Usuário"}</option>)}</select></label>
      <label>Status<select name="status" defaultValue={query.status ?? "todos"}><option value="todos">Todos</option><option value="planejamento">Planejamento</option><option value="confirmado">Confirmado</option><option value="em_execucao">Em execução</option><option value="realizado">Realizado</option></select></label>
      <div className="flex flex-wrap gap-2 md:col-span-3 xl:col-span-5"><button className="rounded-lg bg-[#18352d] px-4 py-2 text-sm font-semibold text-white">Aplicar filtros</button><Link href={`/relatorios/corporativos/export?${exportSearch.toString()}&format=csv`} className="rounded-lg border border-[#dbe3dc] px-4 py-2 text-sm font-semibold">Exportar CSV</Link><Link href={`/relatorios/corporativos/export?${exportSearch.toString()}&format=xlsx`} className="rounded-lg border border-[#dbe3dc] px-4 py-2 text-sm font-semibold">Exportar XLSX</Link></div>
    </form>
    <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><Metric label="Propostas aprovadas" value={String(rows.length)} /><Metric label="Valor contratado" value={formatCurrencyFromCents(totals.contracted)} /><Metric label="Valor recebido" value={formatCurrencyFromCents(totals.received)} /><Metric label="Ticket médio" value={formatCurrencyFromCents(rows.length ? Math.round(totals.contracted / rows.length) : 0)} /><Metric label="Margem estimada" value={formatCurrencyFromCents(totals.margin)} /><Metric label="Eventos realizados" value={String(totals.realized)} /></section>
    <section className="mt-5 overflow-x-auto rounded-xl border border-[#dbe3dc] bg-white"><table className="w-full min-w-[1100px] text-left text-sm"><thead className="bg-[#f3f8fc] text-[#083653]"><tr>{["Cliente", "Entrada", "Aprovação", "Evento", "Contratado", "Recebido", "Saldo", "Comissões", "Custo", "Margem", "Responsável"].map((label) => <th key={label} className="px-3 py-3 font-semibold">{label}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-t border-[#edf1ee]"><td className="px-3 py-3 font-semibold">{row.company}</td><td className="px-3 py-3">{date(row.leadCreatedAt)}</td><td className="px-3 py-3">{date(row.quoteApprovedAt)}</td><td className="px-3 py-3">{date(row.eventDate)}</td><td className="px-3 py-3">{formatCurrencyFromCents(row.contracted)}</td><td className="px-3 py-3">{formatCurrencyFromCents(row.received)}</td><td className="px-3 py-3">{formatCurrencyFromCents(row.pending)}</td><td className="px-3 py-3">{formatCurrencyFromCents(row.commercialCommission + row.managementCommission)}</td><td className="px-3 py-3">{formatCurrencyFromCents(row.estimatedCost)}</td><td className="px-3 py-3">{formatCurrencyFromCents(row.estimatedMargin)}</td><td className="px-3 py-3">{row.responsible}</td></tr>)}{!rows.length && <tr><td colSpan={11} className="px-4 py-10 text-center text-slate-600">Nenhum evento corporativo aprovado neste filtro.</td></tr>}</tbody></table></section>
  </AppShell>;
}
function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-[#dbe3dc] bg-white p-4"><p className="text-sm text-slate-500">{label}</p><p className="mt-1 text-xl font-semibold text-[#18352d]">{value}</p></div>; }
function normalizeDateBy(value?: string): CorporateReportFilters["dateBy"] { return value === "approval" || value === "payment" || value === "event" ? value : "lead"; }
function date(value: string | null) { return value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(`${value.slice(0, 10)}T00:00:00`)) : "—"; }
