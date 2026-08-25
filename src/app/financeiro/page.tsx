import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { SetupNotice } from "@/components/setup-notice";
import { requireUser } from "@/lib/auth";
import { contractedEventStatusLabel } from "@/lib/domain/contracted-event";
import { formatCurrencyFromCents } from "@/lib/domain/quote";
import { hasSupabaseConfig } from "@/lib/supabase/config";

type FinancialEvent = {
  id: string;
  title: string;
  status: string;
  event_date: string | null;
  leads: { name: string } | null;
  quotes: { total_amount_cents: number } | null;
  contracted_event_payments: { status: string; amount_cents: number; due_date: string | null }[];
  contracted_event_costs: { status: string; estimated_amount_cents: number; actual_amount_cents: number | null }[];
};

export default async function FinancialPage({ searchParams }: { searchParams: Promise<{ busca?: string; situacao?: string }> }) {
  if (!hasSupabaseConfig()) return <SetupNotice />;
  const query = await searchParams;
  const { supabase, permissions } = await requireUser();
  if (!permissions.some((permission) => permission === "financeiro" || permission === "gerencia" || permission === "direcao" || permission === "admin_owner")) redirect("/painel");

  const { data, error } = await supabase.from("contracted_events")
    .select("id,title,status,event_date,leads(name),quotes(total_amount_cents),contracted_event_payments(status,amount_cents,due_date),contracted_event_costs(status,estimated_amount_cents,actual_amount_cents)")
    .neq("status", "cancelado").order("event_date", { ascending: true, nullsFirst: false }).limit(200);

  const today = new Date().toISOString().slice(0, 10);
  const rows = ((data ?? []) as unknown as FinancialEvent[]).map((event) => summarize(event, today));
  const search = query.busca?.trim().toLocaleLowerCase("pt-BR") ?? "";
  const filtered = rows.filter((row) => {
    const matchesSearch = !search || [row.event.title, row.event.leads?.name].some((value) => value?.toLocaleLowerCase("pt-BR").includes(search));
    const matchesSituation = !query.situacao || query.situacao === "todos" || (query.situacao === "atrasado" && row.late > 0) || (query.situacao === "aberto" && row.open > 0) || (query.situacao === "margem_negativa" && row.margin < 0);
    return matchesSearch && matchesSituation;
  });
  const totals = rows.reduce((result, row) => ({ revenue: result.revenue + row.revenue, paid: result.paid + row.paid, open: result.open + row.open, late: result.late + row.late, costs: result.costs + row.costs, margin: result.margin + row.margin }), { revenue: 0, paid: 0, open: 0, late: 0, costs: 0, margin: 0 });

  return <AppShell title="Financeiro">
    <p className="mt-2 text-sm text-[#5f7180]">Receitas contratadas, recebimentos, custos e margem por evento.</p>
    {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">Não foi possível carregar o financeiro: {translateError(error.message)}</p>}

    <section className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <Metric label="Receita contratada" value={totals.revenue} />
      <Metric label="Recebido" value={totals.paid} tone="success" />
      <Metric label="Em aberto" value={totals.open} tone="warning" />
      <Metric label="Atrasado" value={totals.late} tone="danger" />
      <Metric label="Custos" value={totals.costs} />
      <Metric label="Margem estimada" value={totals.margin} tone={totals.margin < 0 ? "danger" : "success"} />
    </section>

    <form className="mt-4 grid gap-2 rounded-lg border border-[#d9ded8] bg-[#fffdf8] p-3 sm:grid-cols-[1fr_220px_auto]">
      <div><label htmlFor="financial-search">Buscar evento</label><input id="financial-search" name="busca" defaultValue={query.busca ?? ""} placeholder="Evento ou contato" /></div>
      <div><label htmlFor="financial-situation">Situação</label><select id="financial-situation" name="situacao" defaultValue={query.situacao ?? "todos"}><option value="todos">Todos</option><option value="aberto">Com valor em aberto</option><option value="atrasado">Com pagamento atrasado</option><option value="margem_negativa">Margem negativa</option></select></div>
      <button className="self-end rounded-md bg-[#0f5f8f] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#083653]">Filtrar</button>
    </form>

    <section className="mt-4 overflow-x-auto rounded-lg border border-[#d9ded8] bg-[#fffdf8]">
      <table className="w-full min-w-[980px] text-sm"><thead className="border-b border-[#d9ded8] bg-[#f7f4ed] text-left text-xs uppercase tracking-wide text-[#5f7180]"><tr><th className="px-3 py-2.5">Evento</th><th className="px-3 py-2.5">Data</th><th className="px-3 py-2.5 text-right">Contratado</th><th className="px-3 py-2.5 text-right">Recebido</th><th className="px-3 py-2.5 text-right">Em aberto</th><th className="px-3 py-2.5 text-right">Custos</th><th className="px-3 py-2.5 text-right">Margem</th></tr></thead>
        <tbody>{filtered.map((row) => <tr key={row.event.id} className="border-b border-[#edf1ee] last:border-0 hover:bg-[#dcecf6]/30"><td className="px-3 py-3"><Link href={`/eventos/${row.event.id}`} className="font-semibold text-[#083653] hover:underline">{row.event.title}</Link><p className="mt-0.5 text-xs text-[#5f7180]">{row.event.leads?.name ?? "Contato não informado"} · {contractedEventStatusLabel(row.event.status)}</p></td><td className="whitespace-nowrap px-3 py-3 text-[#5f7180]">{row.event.event_date ? formatDate(row.event.event_date) : "Sem data"}</td><Money value={row.revenue} /><Money value={row.paid} tone="success" /><Money value={row.open} sub={row.late > 0 ? `${formatCurrencyFromCents(row.late)} atrasado` : undefined} tone={row.late > 0 ? "danger" : row.open > 0 ? "warning" : undefined} /><Money value={row.costs} /><Money value={row.margin} tone={row.margin < 0 ? "danger" : "success"} /></tr>)}</tbody>
      </table>
      {!filtered.length && <p className="p-8 text-center text-sm text-[#5f7180]">Nenhum evento corresponde aos filtros.</p>}
    </section>
    <p className="mt-3 text-xs text-[#5f7180]">A margem usa o valor realizado do custo quando preenchido; caso contrário, utiliza o valor previsto.</p>
  </AppShell>;
}

function summarize(event: FinancialEvent, today: string) {
  const payments = event.contracted_event_payments ?? [];
  const revenue = event.quotes?.total_amount_cents ?? 0;
  const paid = payments.filter((item) => item.status === "pago").reduce((sum, item) => sum + item.amount_cents, 0);
  const open = payments.filter((item) => !["pago", "cancelado"].includes(item.status)).reduce((sum, item) => sum + item.amount_cents, 0);
  const late = payments.filter((item) => item.status === "atrasado" || (item.status === "previsto" && item.due_date && item.due_date < today)).reduce((sum, item) => sum + item.amount_cents, 0);
  const costs = (event.contracted_event_costs ?? []).filter((item) => item.status !== "cancelado").reduce((sum, item) => sum + (item.actual_amount_cents ?? item.estimated_amount_cents), 0);
  return { event, revenue, paid, open, late, costs, margin: revenue - costs };
}
function Metric({ label, value, tone }: { label: string; value: number; tone?: "success" | "warning" | "danger" }) { const color = tone === "danger" ? "text-[#b54747]" : tone === "warning" ? "text-[#b7791f]" : tone === "success" ? "text-[#2f7d62]" : "text-[#083653]"; return <div className="rounded-lg border border-[#d9ded8] bg-[#fffdf8] px-3 py-2.5"><p className="text-xs font-semibold text-[#5f7180]">{label}</p><p className={`mt-1 text-lg font-semibold ${color}`}>{formatCurrencyFromCents(value)}</p></div>; }
function Money({ sub, tone, value }: { sub?: string; tone?: "success" | "warning" | "danger"; value: number }) { const color = tone === "danger" ? "text-[#b54747]" : tone === "warning" ? "text-[#b7791f]" : tone === "success" ? "text-[#2f7d62]" : "text-[#092f38]"; return <td className={`whitespace-nowrap px-3 py-3 text-right font-semibold ${color}`}>{formatCurrencyFromCents(value)}{sub && <span className="block text-[10px] font-medium text-[#b54747]">{sub}</span>}</td>; }
function formatDate(value: string) { const [year, month, day] = value.split("-"); return year && month && day ? `${day}/${month}/${year}` : value; }
function translateError(message: string) { return message.includes("contracted_event_costs") ? "Aplique a migration 202608250006_event_costs.sql no Supabase." : message; }
