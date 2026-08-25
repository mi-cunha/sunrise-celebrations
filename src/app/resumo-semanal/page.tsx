import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { SetupNotice } from "@/components/setup-notice";
import { requireUser } from "@/lib/auth";
import { contractedEventStatusLabel } from "@/lib/domain/contracted-event";
import { formatCurrencyFromCents, quoteStatusLabel } from "@/lib/domain/quote";
import { hasSupabaseConfig } from "@/lib/supabase/config";

type EventRow = {
  id: string;
  title: string;
  status: string;
  event_type: string | null;
  event_date: string | null;
  guest_count: number | null;
  leads: { name: string; phone: string } | null;
  quotes: { total_amount_cents: number } | null;
  contracted_event_checklist: { id: string; is_done: boolean }[];
  contracted_event_payments: { id: string; status: string; amount_cents: number; due_date: string | null }[];
};

type QuoteRow = {
  id: string;
  title: string;
  status: string;
  total_amount_cents: number;
  created_at: string;
  leads: { name: string } | null;
};

type LeadRow = {
  id: string;
  name: string;
  phone: string;
  source: string | null;
  status: string;
  created_at: string;
};

export default async function WeeklySummaryPage() {
  if (!hasSupabaseConfig()) return <SetupNotice />;

  const { supabase, permissions } = await requireUser();
  const canSeeFinancial = permissions.some((permission) => permission === "financeiro" || permission === "gerencia" || permission === "direcao" || permission === "admin_owner");
  const { start, end } = currentWeekRange();
  const today = todayKey();

  const [{ data: events }, { data: quotes }, { data: leads }] = await Promise.all([
    supabase
      .from("contracted_events")
      .select("id,title,status,event_type,event_date,guest_count,leads(name,phone),quotes(total_amount_cents),contracted_event_checklist(id,is_done),contracted_event_payments(id,status,amount_cents,due_date)")
      .gte("event_date", start)
      .lte("event_date", end)
      .order("event_date", { ascending: true }),
    supabase.from("quotes").select("id,title,status,total_amount_cents,created_at,leads(name)").in("status", ["enviado", "em_elaboracao"]).order("created_at", { ascending: false }).limit(20),
    supabase.from("leads").select("id,name,phone,source,status,created_at").gte("created_at", `${start}T00:00:00`).lte("created_at", `${end}T23:59:59`).order("created_at", { ascending: false }).limit(20),
  ]);

  const eventRows = (events ?? []) as unknown as EventRow[];
  const quoteRows = (quotes ?? []) as unknown as QuoteRow[];
  const leadRows = (leads ?? []) as unknown as LeadRow[];
  const payments = eventRows.flatMap((event) =>
    (event.contracted_event_payments ?? []).map((payment) => ({
      ...payment,
      event,
    })),
  );
  const latePayments = payments.filter((payment) => payment.status === "atrasado" || (payment.status === "previsto" && payment.due_date && payment.due_date < today));
  const openPayments = payments.filter((payment) => payment.status !== "pago" && payment.status !== "cancelado");
  const eventsWithPendingChecklist = eventRows.filter((event) => event.contracted_event_checklist?.some((item) => !item.is_done));
  const sentQuotes = quoteRows.filter((quote) => quote.status === "enviado");
  const draftQuotes = quoteRows.filter((quote) => quote.status === "em_elaboracao");

  return (
    <AppShell title="Resumo semanal">
      <section className="mt-4 rounded-lg border border-[#c5d7e5] bg-[#f7fbff] p-4">
        <p className="text-sm font-semibold uppercase tracking-[.16em] text-[#28608f]">Semana atual</p>
        <h2 className="mt-2 text-2xl font-semibold text-[#092f4f]">
          {formatDate(start)} a {formatDate(end)}
        </h2>
        <p className="mt-2 max-w-3xl text-slate-600">
          Visão interna para acompanhar eventos, pendências, propostas e novos contatos. Futuramente este resumo pode alimentar o envio automático para a gerência.
        </p>
      </section>

      <section className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Eventos na semana" value={eventRows.length} />
        <MetricCard label="Checklist pendente" value={eventsWithPendingChecklist.length} />
        <MetricCard label="Propostas enviadas" value={sentQuotes.length} />
        <MetricCard label={canSeeFinancial ? "Pagamentos atrasados" : "Contatos novos"} value={canSeeFinancial ? latePayments.length : leadRows.length} />
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <SummarySection title="Eventos da semana" empty="Nenhum evento com data nesta semana.">
          {eventRows.map((event) => {
            const checklist = event.contracted_event_checklist ?? [];
            const completed = checklist.filter((item) => item.is_done).length;
            return (
              <Link key={event.id} href={`/eventos/${event.id}`} className="block border-b border-[#edf1ee] p-4 last:border-0 hover:bg-[#f7fbff]">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="font-semibold text-[#18352d]">{event.title}</h3>
                    <p className="mt-1 text-sm text-slate-600">
                      {event.event_date ? formatDate(event.event_date) : "Sem data"} · {event.event_type ?? "Evento"} · {event.guest_count ?? "?"} convidados
                    </p>
                    <p className="mt-1 text-sm text-slate-500">{event.leads?.name ?? "Contato não informado"}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    <Badge>{contractedEventStatusLabel(event.status)}</Badge>
                    <Badge>
                      Checklist {completed}/{checklist.length}
                    </Badge>
                  </div>
                </div>
              </Link>
            );
          })}
        </SummarySection>

        <SummarySection title="Novos contatos da semana" empty="Nenhum contato novo nesta semana.">
          {leadRows.map((lead) => (
            <Link key={lead.id} href={`/leads/${lead.id}`} className="block border-b border-[#edf1ee] p-4 last:border-0 hover:bg-[#f7fbff]">
              <h3 className="font-semibold text-[#18352d]">{lead.name}</h3>
              <p className="mt-1 text-sm text-slate-600">
                {lead.phone} · {lead.source ?? "Origem não informada"}
              </p>
              <p className="mt-1 text-xs text-slate-500">Criado em {formatDateTime(lead.created_at)}</p>
            </Link>
          ))}
        </SummarySection>
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-2">
        <SummarySection title="Propostas para acompanhar" empty="Nenhuma proposta enviada ou em elaboração.">
          {[...sentQuotes, ...draftQuotes].slice(0, 10).map((quote) => (
            <Link key={quote.id} href={`/orcamentos/${quote.id}`} className="block border-b border-[#edf1ee] p-4 last:border-0 hover:bg-[#f7fbff]">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-semibold text-[#18352d]">{quote.title}</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    {quote.leads?.name ?? "Contato"} · {quoteStatusLabel(quote.status)}
                  </p>
                </div>
                <span className="font-semibold text-[#18352d]">{formatCurrencyFromCents(quote.total_amount_cents)}</span>
              </div>
            </Link>
          ))}
        </SummarySection>

        <SummarySection title={canSeeFinancial ? "Pagamentos que merecem atenção" : "Pendências operacionais"} empty="Nenhuma pendência crítica encontrada.">
          {canSeeFinancial
            ? [...latePayments, ...openPayments.filter((payment) => !latePayments.some((late) => late.id === payment.id))]
                .slice(0, 10)
                .map((payment) => (
                  <Link key={payment.id} href={`/eventos/${payment.event.id}`} className="block border-b border-[#edf1ee] p-4 last:border-0 hover:bg-[#f7fbff]">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="font-semibold text-[#18352d]">{payment.event.title}</h3>
                        <p className="mt-1 text-sm text-slate-600">
                          Vencimento: {payment.due_date ? formatDate(payment.due_date) : "sem data"} · {payment.status}
                        </p>
                      </div>
                      <span className="font-semibold text-[#18352d]">{formatCurrencyFromCents(payment.amount_cents)}</span>
                    </div>
                  </Link>
                ))
            : eventsWithPendingChecklist.map((event) => (
                <Link key={event.id} href={`/eventos/${event.id}`} className="block border-b border-[#edf1ee] p-4 last:border-0 hover:bg-[#f7fbff]">
                  <h3 className="font-semibold text-[#18352d]">{event.title}</h3>
                  <p className="mt-1 text-sm text-slate-600">Checklist operacional ainda possui itens pendentes.</p>
                </Link>
              ))}
        </SummarySection>
      </section>
    </AppShell>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-[#dbe3dc] bg-white p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-[#092f4f]">{value}</p>
    </div>
  );
}

function SummarySection({ children, empty, title }: { children: React.ReactNode[] | React.ReactNode; empty: string; title: string }) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <section className="overflow-hidden rounded-lg border border-[#dbe3dc] bg-white">
      <div className="border-b border-[#edf1ee] p-4">
        <h2 className="text-lg font-semibold text-[#092f4f]">{title}</h2>
      </div>
      {hasChildren ? children : <p className="p-4 text-sm text-slate-600">{empty}</p>}
    </section>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-[#edf5ee] px-3 py-1 text-xs font-semibold text-[#356451]">{children}</span>;
}

function currentWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const start = new Date(now);
  start.setDate(now.getDate() + diffToMonday);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start: dateKey(start), end: dateKey(end) };
}

function todayKey() {
  return dateKey(new Date());
}

function dateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date(`${value}T00:00:00`));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}
