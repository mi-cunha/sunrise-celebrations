import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { SetupNotice } from "@/components/setup-notice";
import { requireUser } from "@/lib/auth";
import { canManageLeads } from "@/lib/domain/lead";
import { formatCurrencyFromCents, quoteStatusLabel } from "@/lib/domain/quote";
import { hasSupabaseConfig } from "@/lib/supabase/config";

type LeadRow = {
  id: string;
  name: string;
  company: string | null;
  phone: string;
  status: string;
  created_at: string;
};

type ConversationRow = {
  id: string;
  status: string;
  needs_human: boolean;
  created_at: string;
  leads: { name: string; phone: string } | null;
};

type QuoteRow = {
  id: string;
  title: string;
  status: string;
  total_amount_cents: number;
  approved_at: string | null;
  created_at: string;
  leads: { name: string } | null;
  contracted_events: { id: string }[] | null;
};

type EventRow = {
  id: string;
  title: string;
  status: string;
  event_date: string | null;
  guest_count: number | null;
  quotes: { total_amount_cents: number } | null;
  contracted_event_checklist: { id: string; is_done: boolean }[];
  contracted_event_contracts: { id: string; status: string }[] | { id: string; status: string } | null;
  contracted_event_payments: { id: string; status: string; amount_cents: number; due_date: string | null }[];
};

type ActionItem = {
  title: string;
  description: string;
  href: string;
  label: string;
  tone: "danger" | "warning" | "info" | "success";
};

export default async function Dashboard() {
  if (!hasSupabaseConfig()) return <SetupNotice />;

  const { supabase, permissions } = await requireUser();
  const allowed = canManageLeads(permissions);
  const canSeeFinancial = permissions.some((permission) => permission === "financeiro" || permission === "gerencia" || permission === "admin_owner");
  const isAdmin = permissions.includes("admin_owner");

  const [{ data: leads }, { data: conversations }, { data: quotes }, { data: events }] = await Promise.all([
    supabase.from("leads").select("id,name,company,phone,status,created_at").order("created_at", { ascending: false }).limit(8),
    supabase
      .from("conversations")
      .select("id,status,needs_human,created_at,leads(name,phone)")
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("quotes")
      .select("id,title,status,total_amount_cents,approved_at,created_at,leads(name),contracted_events(id)")
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("contracted_events")
      .select("id,title,status,event_date,guest_count,quotes(total_amount_cents),contracted_event_checklist(id,is_done),contracted_event_contracts(id,status),contracted_event_payments(id,status,amount_cents,due_date)")
      .order("event_date", { ascending: true, nullsFirst: false })
      .limit(40),
  ]);

  const recentLeads = (leads ?? []) as unknown as LeadRow[];
  const conversationRows = (conversations ?? []) as unknown as ConversationRow[];
  const quoteRows = (quotes ?? []) as unknown as QuoteRow[];
  const eventRows = (events ?? []) as unknown as EventRow[];

  const today = new Date().toISOString().slice(0, 10);
  const humanQueue = conversationRows.filter((conversation) => conversation.status !== "encerrado" && (conversation.needs_human || conversation.status === "aguardando_humano"));
  const quotesInProgress = quoteRows.filter((quote) => quote.status === "rascunho" || quote.status === "em_elaboracao");
  const sentQuotes = quoteRows.filter((quote) => quote.status === "enviado");
  const approvedQuotesWaitingEvent = quoteRows.filter((quote) => quote.status === "aprovado" && !quote.contracted_events?.length);
  const activeEvents = eventRows.filter((event) => !["realizado", "cancelado"].includes(event.status));
  const eventsWithChecklistPending = activeEvents.filter((event) => event.contracted_event_checklist?.some((item) => !item.is_done));
  const eventsWithLatePayments = activeEvents.filter((event) => event.contracted_event_payments?.some((payment) => payment.status === "atrasado" || (payment.status === "previsto" && payment.due_date && payment.due_date < today)));

  const nextActions = buildNextActions({
    quotesInProgress,
    sentQuotes,
    approvedQuotesWaitingEvent,
    eventsWithChecklistPending,
    eventsWithLatePayments,
    canSeeFinancial,
  });

  return (
    <AppShell title="Painel">
      <section className="mt-8 rounded-2xl border border-[#dbe3dc] bg-gradient-to-br from-[#f7fbff] via-white to-[#f8f2e8] p-6">
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[.18em] text-[#28608f]">Central de trabalho</p>
            <h2 className="mt-3 text-2xl font-semibold text-[#092f4f]">Comece pelo que precisa de decisão hoje.</h2>
            <p className="mt-2 max-w-2xl text-slate-600">
              O painel organiza atendimentos, orçamentos e eventos em uma fila simples de prioridades para a equipe não precisar caçar informação entre páginas.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 lg:justify-end">
            <QuickLink href="/eventos" label="Ver eventos" />
            {allowed && <QuickLink href="/leads/novo" label="Novo lead" primary />}
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4" aria-label="Resumo operacional">
        <MetricCard label="Precisam de humano" value={humanQueue.length} tone={humanQueue.length > 0 ? "danger" : "success"} />
        <MetricCard label="Orçamentos em preparo" value={quotesInProgress.length} href="/painel#orcamentos" tone="info" />
        <MetricCard label="Aprovados sem evento" value={approvedQuotesWaitingEvent.length} href="/eventos" tone={approvedQuotesWaitingEvent.length > 0 ? "warning" : "success"} />
        <MetricCard
          label={canSeeFinancial ? "Pagamentos atrasados" : "Eventos com pendências"}
          value={canSeeFinancial ? eventsWithLatePayments.length : eventsWithChecklistPending.length}
          href="/eventos"
          tone={(canSeeFinancial ? eventsWithLatePayments.length : eventsWithChecklistPending.length) > 0 ? "danger" : "success"}
        />
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-2xl border border-[#dbe3dc] bg-white">
          <div className="border-b border-[#edf1ee] p-5">
            <h2 className="text-lg font-semibold text-[#092f4f]">Próximas ações</h2>
            <p className="mt-1 text-sm text-slate-600">Uma lista curta para orientar o começo do dia.</p>
          </div>
          {nextActions.length ? (
            <ul className="divide-y divide-[#edf1ee]">
              {nextActions.map((action) => (
                <li key={`${action.href}-${action.title}`}>
                  <Link href={action.href} className="group flex flex-col gap-3 p-5 transition hover:bg-[#f7fbff] sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusPill tone={action.tone}>{action.label}</StatusPill>
                        <h3 className="font-semibold text-[#18352d] group-hover:underline">{action.title}</h3>
                      </div>
                      <p className="mt-2 text-sm text-slate-600">{action.description}</p>
                    </div>
                    <span className="text-sm font-semibold text-[#28608f]">Abrir →</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-8">
              <h3 className="font-semibold text-[#18352d]">Tudo sob controle por aqui.</h3>
              <p className="mt-1 text-sm text-slate-600">Nenhuma ação urgente apareceu nos atendimentos, orçamentos ou eventos ativos.</p>
            </div>
          )}
        </div>

        <aside className="rounded-2xl border border-[#dbe3dc] bg-white p-5">
          <h2 className="text-lg font-semibold text-[#092f4f]">Fluxo recomendado</h2>
          <p className="mt-1 text-sm text-slate-600">Use esta sequência como mapa mental do sistema.</p>
          <ol className="mt-5 space-y-3">
            <WorkflowStep number="1" title="Cadastrar" description="Registre o lead e complete os dados necessários para orçamento." href="/leads/novo" />
            <WorkflowStep number="2" title="Orçar" description="Monte o orçamento com pacote, itens extras e proposta para cliente." href="/painel#orcamentos" />
            <WorkflowStep number="3" title="Converter" description="Quando aprovado, transforme o orçamento em evento operacional." href="/eventos" />
            <WorkflowStep number="4" title="Operar" description="Controle checklist, cronograma, fornecedores, contrato e pagamentos." href="/eventos" />
          </ol>
        </aside>
      </section>

      <section id="orcamentos" className="mt-6 grid gap-6 lg:grid-cols-2">
        <QueueCard
          title="Orçamentos em andamento"
          description="Propostas que ainda estão sendo montadas ou aguardam envio."
          emptyTitle="Nenhum orçamento em elaboração."
          emptyDescription="Quando um lead virar orçamento, ele aparecerá aqui."
          items={quotesInProgress.slice(0, 5).map((quote) => ({
            href: `/orcamentos/${quote.id}`,
            title: quote.title,
            description: `${quote.leads?.name ?? "Lead"} · ${quoteStatusLabel(quote.status)} · ${formatCurrencyFromCents(quote.total_amount_cents)}`,
          }))}
        />
        <QueueCard
          title="Propostas enviadas"
          description="Orçamentos já enviados e aguardando resposta do cliente."
          emptyTitle="Nenhuma proposta aguardando cliente."
          emptyDescription="Assim que uma proposta for enviada, ela entra nesta fila."
          items={sentQuotes.slice(0, 5).map((quote) => ({
            href: `/orcamentos/${quote.id}`,
            title: quote.title,
            description: `${quote.leads?.name ?? "Lead"} · ${formatCurrencyFromCents(quote.total_amount_cents)}`,
          }))}
        />
      </section>

      <section className="mt-6 overflow-hidden rounded-2xl border border-[#dbe3dc] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf1ee] p-5">
          <div>
            <h2 className="text-lg font-semibold text-[#092f4f]">Leads recentes</h2>
            <p className="mt-1 text-sm text-slate-600">Últimos contatos cadastrados no sistema.</p>
          </div>
          {allowed && (
            <Link href="/leads/novo" className="rounded-lg bg-[#18352d] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#23483d]">
              Novo lead
            </Link>
          )}
        </div>
        {recentLeads.length ? (
          <ul className="divide-y divide-[#edf1ee]">
            {recentLeads.map((lead) => (
              <li key={lead.id}>
                <Link href={`/leads/${lead.id}`} className="flex flex-col gap-3 p-4 transition hover:bg-[#f6fbf7] sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="font-semibold text-[#18352d]">{lead.name}</h3>
                    <p className="text-sm text-slate-600">{lead.company ? `${lead.company} · ${lead.phone}` : lead.phone}</p>
                  </div>
                  <StatusPill tone="info">{formatLeadStatus(lead.status)}</StatusPill>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="p-8">
            <h3 className="font-semibold">Ainda não há leads.</h3>
            <p className="mt-1 text-slate-600">{allowed ? "Cadastre o primeiro contato para iniciar o funil." : "Quando a equipe cadastrar contatos, eles aparecerão aqui."}</p>
          </div>
        )}
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4" aria-label="Atalhos do sistema">
        <ShortcutCard href="/eventos" title="Eventos" description="Operação, checklist, fornecedores e pagamentos." />
        {isAdmin && <ShortcutCard href="/admin/opcoes" title="Opções e pacotes" description="Tipos, origens, itens e pacotes padronizados." />}
        {isAdmin && <ShortcutCard href="/admin/usuarios" title="Usuários" description="Acessos, permissões e usuários ativos." />}
      </section>
    </AppShell>
  );
}

function buildNextActions({
  quotesInProgress,
  sentQuotes,
  approvedQuotesWaitingEvent,
  eventsWithChecklistPending,
  eventsWithLatePayments,
  canSeeFinancial,
}: {
  quotesInProgress: QuoteRow[];
  sentQuotes: QuoteRow[];
  approvedQuotesWaitingEvent: QuoteRow[];
  eventsWithChecklistPending: EventRow[];
  eventsWithLatePayments: EventRow[];
  canSeeFinancial: boolean;
}) {
  const actions: ActionItem[] = [];
  const latePaymentEvent = eventsWithLatePayments[0];
  const approvedQuote = approvedQuotesWaitingEvent[0];
  const draftQuote = quotesInProgress[0];
  const sentQuote = sentQuotes[0];
  const checklistEvent = eventsWithChecklistPending[0];

  if (canSeeFinancial && latePaymentEvent) {
    actions.push({
      title: latePaymentEvent.title,
      description: "Existe pagamento atrasado ou vencido sem baixa.",
      href: `/eventos/${latePaymentEvent.id}`,
      label: "Financeiro",
      tone: "danger",
    });
  }

  if (approvedQuote) {
    actions.push({
      title: approvedQuote.title,
      description: "Orçamento aprovado ainda não virou evento operacional.",
      href: "/eventos",
      label: "Criar evento",
      tone: "warning",
    });
  }

  if (draftQuote) {
    actions.push({
      title: draftQuote.title,
      description: `Continue a proposta · ${formatCurrencyFromCents(draftQuote.total_amount_cents)}`,
      href: `/orcamentos/${draftQuote.id}`,
      label: "Orçamento",
      tone: "info",
    });
  }

  if (sentQuote) {
    actions.push({
      title: sentQuote.title,
      description: "Proposta enviada aguardando retorno do cliente.",
      href: `/orcamentos/${sentQuote.id}`,
      label: "Follow-up",
      tone: "info",
    });
  }

  if (checklistEvent) {
    const checklist = checklistEvent.contracted_event_checklist ?? [];
    const completed = checklist.filter((item) => item.is_done).length;
    actions.push({
      title: checklistEvent.title,
      description: `Checklist operacional ${completed} de ${checklist.length}.`,
      href: `/eventos/${checklistEvent.id}`,
      label: "Operação",
      tone: "warning",
    });
  }

  return actions.slice(0, 5);
}

function MetricCard({ label, value, href, tone }: { label: string; value: number; href?: string; tone: "success" | "warning" | "danger" | "info" }) {
  const className = `rounded-2xl border p-5 transition ${href ? "hover:-translate-y-0.5 hover:shadow-sm" : ""} ${toneClasses[tone].card}`;
  const content = (
    <>
      <p className="text-sm text-slate-600">{label}</p>
      <p className={`mt-2 text-3xl font-semibold ${toneClasses[tone].text}`}>{value}</p>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }

  return <div className={className}>{content}</div>;
}

function QuickLink({ href, label, primary = false }: { href: string; label: string; primary?: boolean }) {
  return (
    <Link
      href={href}
      className={
        primary
          ? "rounded-lg bg-[#18352d] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#23483d]"
          : "rounded-lg border border-[#cfdeda] bg-white px-4 py-3 text-sm font-semibold text-[#18352d] transition hover:border-[#28608f] hover:text-[#28608f]"
      }
    >
      {label}
    </Link>
  );
}

function WorkflowStep({ number, title, description, href }: { number: string; title: string; description: string; href: string }) {
  return (
    <li>
      <Link href={href} className="grid grid-cols-[2.25rem_1fr] gap-3 rounded-xl border border-[#edf1ee] p-3 transition hover:border-[#c5d7e5] hover:bg-[#f7fbff]">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e3f0fa] text-sm font-semibold text-[#28608f]">{number}</span>
        <span>
          <span className="block font-semibold text-[#18352d]">{title}</span>
          <span className="mt-1 block text-sm text-slate-600">{description}</span>
        </span>
      </Link>
    </li>
  );
}

function QueueCard({
  title,
  description,
  emptyTitle,
  emptyDescription,
  items,
}: {
  title: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
  items: { href: string; title: string; description: string }[];
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[#dbe3dc] bg-white">
      <div className="border-b border-[#edf1ee] p-5">
        <h2 className="text-lg font-semibold text-[#092f4f]">{title}</h2>
        <p className="mt-1 text-sm text-slate-600">{description}</p>
      </div>
      {items.length ? (
        <ul className="divide-y divide-[#edf1ee]">
          {items.map((item) => (
            <li key={item.href}>
              <Link href={item.href} className="block p-4 transition hover:bg-[#f6fbf7]">
                <h3 className="font-semibold text-[#18352d]">{item.title}</h3>
                <p className="mt-1 text-sm text-slate-600">{item.description}</p>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="p-6">
          <h3 className="font-semibold text-[#18352d]">{emptyTitle}</h3>
          <p className="mt-1 text-sm text-slate-600">{emptyDescription}</p>
        </div>
      )}
    </section>
  );
}

function ShortcutCard({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <Link href={href} className="rounded-2xl border border-[#dbe3dc] bg-white p-5 transition hover:-translate-y-0.5 hover:border-[#c5d7e5] hover:shadow-sm">
      <h2 className="font-semibold text-[#18352d]">{title}</h2>
      <p className="mt-2 text-sm text-slate-600">{description}</p>
    </Link>
  );
}

function StatusPill({ children, tone }: { children: React.ReactNode; tone: "success" | "warning" | "danger" | "info" }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${toneClasses[tone].pill}`}>{children}</span>;
}

const toneClasses = {
  success: {
    card: "border-[#dbe3dc] bg-[#f6fbf7]",
    text: "text-[#356451]",
    pill: "bg-[#edf5ee] text-[#356451]",
  },
  warning: {
    card: "border-[#ead8ae] bg-[#fffaf0]",
    text: "text-[#8a5a12]",
    pill: "bg-[#fff4df] text-[#8a5a12]",
  },
  danger: {
    card: "border-red-100 bg-red-50",
    text: "text-red-800",
    pill: "bg-red-100 text-red-700",
  },
  info: {
    card: "border-[#c5d7e5] bg-[#f7fbff]",
    text: "text-[#28608f]",
    pill: "bg-[#e3f0fa] text-[#28608f]",
  },
} as const;

function formatLeadStatus(status: string) {
  const labels: Record<string, string> = {
    novo: "Novo",
    em_atendimento: "Em atendimento",
    qualificado: "Qualificado",
    orcamento_em_elaboracao: "Orçamento em elaboração",
    proposta_enviada: "Proposta enviada",
    negociacao: "Negociação",
    ganho: "Ganho",
    perdido: "Perdido",
  };
  return labels[status] ?? status.replaceAll("_", " ");
}
