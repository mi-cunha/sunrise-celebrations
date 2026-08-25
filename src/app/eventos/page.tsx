import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { SetupNotice } from "@/components/setup-notice";
import { createContractedEventFromQuote } from "@/app/eventos/actions";
import { contractedEventContractStatusLabel, contractedEventStatusLabel } from "@/lib/domain/contracted-event";
import { formatCurrencyFromCents } from "@/lib/domain/quote";
import { requireUser } from "@/lib/auth";
import { hasSupabaseConfig } from "@/lib/supabase/config";

type ContractedEventRow = {
  id: string;
  title: string;
  status: string;
  event_type: string | null;
  event_date: string | null;
  guest_count: number | null;
  created_at: string;
  leads: { id: string; name: string; phone: string } | null;
  quotes: { id: string; total_amount_cents: number } | null;
  contracted_event_checklist: { id: string; is_done: boolean }[];
  contracted_event_contracts: { id: string; status: string }[] | { id: string; status: string } | null;
  contracted_event_payments: { id: string; status: string; amount_cents: number; due_date: string | null }[];
};

type PendingApprovedQuote = {
  id: string;
  title: string;
  event_type: string | null;
  desired_date: string | null;
  guest_count: number | null;
  total_amount_cents: number;
  approved_at: string | null;
  leads: { id: string; name: string; phone: string } | null;
  contracted_events: { id: string }[] | null;
};

export default async function EventsPage() {
  if (!hasSupabaseConfig()) return <SetupNotice />;

  const { supabase, permissions } = await requireUser();
  const canCreateEvents = permissions.some((permission) => permission === "atendimento" || permission === "gerencia" || permission === "direcao" || permission === "admin_owner");
  const canSeeFinancial = permissions.some((permission) => permission === "financeiro" || permission === "gerencia" || permission === "direcao" || permission === "admin_owner");
  const { data: events, error } = await supabase
    .from("contracted_events")
    .select("id,title,status,event_type,event_date,guest_count,created_at,leads(id,name,phone),quotes(id,total_amount_cents),contracted_event_checklist(id,is_done),contracted_event_contracts(id,status),contracted_event_payments(id,status,amount_cents,due_date)")
    .order("event_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(50);

  const { data: approvedQuotes, error: approvedQuotesError } = await supabase
    .from("quotes")
    .select("id,title,event_type,desired_date,guest_count,total_amount_cents,approved_at,leads(id,name,phone),contracted_events(id)")
    .eq("status", "aprovado")
    .order("approved_at", { ascending: false, nullsFirst: false })
    .limit(50);

  const rows = (events ?? []) as unknown as ContractedEventRow[];
  const contractedQuoteIds = new Set(rows.map((event) => event.quotes?.id).filter(Boolean));
  const pendingQuotes = ((approvedQuotes ?? []) as unknown as PendingApprovedQuote[]).filter((quote) => !quote.contracted_events?.length && !contractedQuoteIds.has(quote.id));
  const activeEvents = rows.filter((event) => !["realizado", "cancelado"].includes(event.status));
  const today = new Date().toISOString().slice(0, 10);
  const eventsWithPendingChecklist = activeEvents.filter((event) => event.contracted_event_checklist?.some((item) => !item.is_done)).length;
  const eventsWithOpenPayments = activeEvents.filter((event) => event.contracted_event_payments?.some((payment) => payment.status !== "pago" && payment.status !== "cancelado")).length;
  const eventsWithLatePayments = activeEvents.filter((event) => event.contracted_event_payments?.some((payment) => payment.status === "atrasado" || (payment.status === "previsto" && payment.due_date && payment.due_date < today))).length;

  return (
    <AppShell title="Eventos contratados">
      <div className="mt-8 grid gap-4 md:grid-cols-4">
        <MetricCard label="Eventos ativos" value={String(activeEvents.length)} />
        <MetricCard label="Próximos com data" value={String(activeEvents.filter((event) => event.event_date).length)} />
        <MetricCard label={canSeeFinancial ? "Com pagamento em aberto" : "Checklist pendente"} value={String(canSeeFinancial ? eventsWithOpenPayments : eventsWithPendingChecklist)} />
        <MetricCard label={canSeeFinancial ? "Pagamentos atrasados" : "Aguardando criação"} value={String(canSeeFinancial ? eventsWithLatePayments : pendingQuotes.length)} />
      </div>

      {error && <p className="mt-6 rounded-lg bg-red-50 p-3 text-sm text-red-800">Não foi possível carregar os eventos: {error.message}</p>}
      {approvedQuotesError && <p className="mt-6 rounded-lg bg-red-50 p-3 text-sm text-red-800">Não foi possível carregar orçamentos aprovados: {approvedQuotesError.message}</p>}

      {pendingQuotes.length > 0 && (
        <section className="mt-6 overflow-hidden rounded-xl border border-[#e8d7a9] bg-[#fffaf0]">
          <div className="border-b border-[#f1e3bd] p-5">
            <h2 className="font-semibold text-[#18352d]">Orçamentos aprovados aguardando evento</h2>
            <p className="mt-1 text-sm text-slate-600">Esses orçamentos já foram aprovados, mas ainda não viraram registro operacional.</p>
          </div>
          <ul>
            {pendingQuotes.map((quote) => (
              <li key={quote.id} className="flex flex-col gap-3 border-b border-[#f1e3bd] p-4 last:border-0 md:flex-row md:items-center md:justify-between">
                <div>
                  <Link href={`/orcamentos/${quote.id}`} className="font-semibold text-[#18352d] underline-offset-4 hover:underline">
                    {quote.title}
                  </Link>
                  <p className="mt-1 text-sm text-slate-600">
                    {quote.leads?.name ?? "Lead"} · {quote.event_type ?? "Evento não informado"}
                    {quote.guest_count ? ` · ${quote.guest_count} convidados` : ""}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">{quote.desired_date ? formatDate(quote.desired_date) : "Data ainda não definida"}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm font-semibold text-[#18352d]">{formatCurrencyFromCents(quote.total_amount_cents)}</span>
                  {canCreateEvents && (
                    <form action={createContractedEventFromQuote}>
                      <input type="hidden" name="quoteId" value={quote.id} />
                      <button className="rounded-lg bg-[#18352d] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#23483d] active:scale-[0.99]">
                        Criar evento
                      </button>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-6 overflow-hidden rounded-xl border border-[#dbe3dc] bg-white">
        {rows.length ? (
          <ul>
            {rows.map((event) => (
              <li key={event.id} className="border-b border-[#edf1ee] p-4 transition last:border-0 hover:bg-[#f6fbf7]">
                <Link href={`/eventos/${event.id}`} className="block">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <h2 className="font-semibold text-[#18352d]">{event.title}</h2>
                      <p className="mt-1 text-sm text-slate-600">
                        {event.leads?.name ?? "Lead"} · {event.event_type ?? "Evento não informado"}
                        {event.guest_count ? ` · ${event.guest_count} convidados` : ""}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">{event.event_date ? formatDate(event.event_date) : "Data ainda não definida"}</p>
                      <EventOperationalBadges canSeeFinancial={canSeeFinancial} event={event} today={today} />
                    </div>
                    <div className="flex flex-wrap items-center gap-2 md:justify-end">
                      <span className="rounded-full bg-[#edf5ee] px-3 py-1 text-sm text-[#356451]">{contractedEventStatusLabel(event.status)}</span>
                      {event.quotes && <span className="text-sm font-semibold text-[#18352d]">{formatCurrencyFromCents(event.quotes.total_amount_cents)}</span>}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="p-8">
            <h2 className="font-semibold">Ainda não há eventos contratados.</h2>
            <p className="mt-1 text-slate-600">
              {pendingQuotes.length ? "Crie o primeiro evento a partir de um orçamento aprovado acima." : "Quando um orçamento aprovado virar evento, ele aparecerá aqui para acompanhamento operacional."}
            </p>
          </div>
        )}
      </section>
    </AppShell>
  );
}

function EventOperationalBadges({ canSeeFinancial, event, today }: { canSeeFinancial: boolean; event: ContractedEventRow; today: string }) {
  const checklist = event.contracted_event_checklist ?? [];
  const completedChecklist = checklist.filter((item) => item.is_done).length;
  const contract = firstRecord(event.contracted_event_contracts);
  const payments = event.contracted_event_payments ?? [];
  const openAmount = payments.filter((payment) => payment.status !== "pago" && payment.status !== "cancelado").reduce((total, payment) => total + payment.amount_cents, 0);
  const lateAmount = payments.filter((payment) => payment.status === "atrasado" || (payment.status === "previsto" && payment.due_date && payment.due_date < today)).reduce((total, payment) => total + payment.amount_cents, 0);

  return (
    <div className="mt-3 flex flex-wrap gap-2 text-xs">
      <StatusPill tone={checklist.length && completedChecklist === checklist.length ? "success" : "neutral"}>
        Checklist: {completedChecklist} de {checklist.length}
      </StatusPill>
      {canSeeFinancial && (
        <>
          <StatusPill tone={contract?.status === "assinado" ? "success" : contract ? "warning" : "neutral"}>
            Contrato {contract ? contractedEventContractStatusLabel(contract.status).toLowerCase() : "pendente"}
          </StatusPill>
          <StatusPill tone={lateAmount > 0 ? "danger" : openAmount > 0 ? "warning" : "success"}>
            {lateAmount > 0 ? `Atrasado ${formatCurrencyFromCents(lateAmount)}` : `Em aberto ${formatCurrencyFromCents(openAmount)}`}
          </StatusPill>
        </>
      )}
    </div>
  );
}

function StatusPill({ children, tone }: { children: React.ReactNode; tone: "success" | "warning" | "danger" | "neutral" }) {
  const classes = {
    success: "bg-[#edf5ee] text-[#356451]",
    warning: "bg-[#fff4df] text-[#8a5a12]",
    danger: "bg-red-50 text-red-700",
    neutral: "bg-slate-100 text-slate-600",
  };
  return <span className={`rounded-full px-2.5 py-1 font-medium ${classes[tone]}`}>{children}</span>;
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#dbe3dc] bg-white p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-[#18352d]">{value}</p>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date(`${value}T00:00:00`));
}

function firstRecord<T>(value: T[] | T | null | undefined) {
  if (Array.isArray(value)) return value[0];
  return value;
}
