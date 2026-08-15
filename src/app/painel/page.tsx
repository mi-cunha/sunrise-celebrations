import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { SetupNotice } from "@/components/setup-notice";
import { requireUser } from "@/lib/auth";
import { canManageLeads } from "@/lib/domain/lead";
import { formatCurrencyFromCents } from "@/lib/domain/quote";
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
  contracted_event_checklist: { id: string; is_done: boolean }[];
  contracted_event_payments: { id: string; status: string; amount_cents: number; due_date: string | null }[];
};

export default async function Dashboard() {
  if (!hasSupabaseConfig()) return <SetupNotice />;

  const { supabase, permissions } = await requireUser();
  const canCreateContact = canManageLeads(permissions);
  const canSeeFinancial = permissions.some((permission) => permission === "financeiro" || permission === "gerencia" || permission === "admin_owner");

  const [{ data: leads }, { data: conversations }, { data: quotes }, { data: events }] = await Promise.all([
    supabase.from("leads").select("id,name,company,phone,status,created_at").order("created_at", { ascending: false }).limit(8),
    supabase.from("conversations").select("id,status,needs_human,created_at,leads(name,phone)").order("created_at", { ascending: false }).limit(20),
    supabase.from("quotes").select("id,title,status,total_amount_cents,approved_at,created_at,leads(name),contracted_events(id)").order("created_at", { ascending: false }).limit(30),
    supabase
      .from("contracted_events")
      .select("id,title,status,event_date,guest_count,contracted_event_checklist(id,is_done),contracted_event_payments(id,status,amount_cents,due_date)")
      .order("event_date", { ascending: true, nullsFirst: false })
      .limit(30),
  ]);

  const recentContacts = (leads ?? []) as unknown as LeadRow[];
  const conversationsRows = (conversations ?? []) as unknown as ConversationRow[];
  const quoteRows = (quotes ?? []) as unknown as QuoteRow[];
  const eventRows = (events ?? []) as unknown as EventRow[];
  const today = new Date().toISOString().slice(0, 10);
  const weekEnd = weekEndKey();

  const humanQueue = conversationsRows.filter((conversation) => conversation.status !== "encerrado" && (conversation.needs_human || conversation.status === "aguardando_humano"));
  const openQuotes = quoteRows.filter((quote) => quote.status === "rascunho" || quote.status === "em_elaboracao");
  const sentQuotes = quoteRows.filter((quote) => quote.status === "enviado");
  const approvedWithoutEvent = quoteRows.filter((quote) => quote.status === "aprovado" && !quote.contracted_events?.length);
  const activeEvents = eventRows.filter((event) => !["realizado", "cancelado"].includes(event.status));
  const weekEvents = activeEvents.filter((event) => event.event_date && event.event_date >= today && event.event_date <= weekEnd);
  const checklistPending = activeEvents.filter((event) => event.contracted_event_checklist?.some((item) => !item.is_done));
  const financialPending = activeEvents.filter((event) =>
    event.contracted_event_payments?.some((payment) => payment.status === "atrasado" || (payment.status === "previsto" && payment.due_date && payment.due_date < today)),
  );

  return (
    <AppShell title="Painel">
      <section className="mt-4 rounded-lg border border-[#d9ded8] bg-[#fffdf8] p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[#092f38]">Prioridades da operação</h2>
            <p className="text-sm text-[#5f7180]">Atendimentos, orçamentos, eventos e pendências.</p>
          </div>
          {canCreateContact && (
            <Link href="/leads/novo" className="rounded-md bg-[#083653] px-3 py-2 text-sm font-semibold text-white hover:bg-[#0f5f8f]">
              Novo contato
            </Link>
          )}
        </div>
      </section>

      <section className="mt-3 grid gap-2 md:grid-cols-3 xl:grid-cols-5" aria-label="Métricas operacionais">
        <Metric label="Aguardando humano" value={humanQueue.length} tone={humanQueue.length ? "danger" : "neutral"} />
        <Metric label="Orçamentos abertos" value={openQuotes.length} />
        <Metric label="Propostas enviadas" value={sentQuotes.length} />
        <Metric label="Eventos da semana" value={weekEvents.length} />
        <Metric label={canSeeFinancial ? "Pendências financeiras" : "Pendências"} value={canSeeFinancial ? financialPending.length : checklistPending.length} tone={(canSeeFinancial ? financialPending.length : checklistPending.length) ? "warning" : "neutral"} />
      </section>

      <section className="mt-4 grid gap-3 xl:grid-cols-[1fr_1fr]">
        <PanelList
          title="Fila de atendimento"
          empty="Nenhum contato aguardando humano."
          items={humanQueue.slice(0, 5).map((conversation) => ({
            href: `/atendimentos/${conversation.id}`,
            title: conversation.leads?.name ?? "Contato sem nome",
            meta: conversation.leads?.phone ?? "Sem telefone",
          }))}
        />

        <PanelList
          title="Orçamentos em andamento"
          empty="Nenhum orçamento aberto."
          items={openQuotes.slice(0, 5).map((quote) => ({
            href: `/orcamentos/${quote.id}`,
            title: quote.title,
            meta: `${quote.leads?.name ?? "Contato"} · ${formatCurrencyFromCents(quote.total_amount_cents)}`,
          }))}
        />

        <PanelList
          title="Eventos próximos"
          empty="Nenhum evento próximo."
          items={weekEvents.slice(0, 5).map((event) => ({
            href: `/eventos/${event.id}`,
            title: event.title,
            meta: `${event.event_date ? formatDate(event.event_date) : "Sem data"} · ${event.guest_count ?? "?"} convidados`,
          }))}
        />

        <PanelList
          title="Pendências críticas"
          empty="Nenhuma pendência crítica."
          items={[
            ...approvedWithoutEvent.slice(0, 3).map((quote) => ({
              href: "/eventos",
              title: "Criar evento",
              meta: quote.title,
            })),
            ...(canSeeFinancial ? financialPending : checklistPending).slice(0, 3).map((event) => ({
              href: `/eventos/${event.id}`,
              title: event.title,
              meta: canSeeFinancial ? "Pagamento pendente/atrasado" : "Checklist pendente",
            })),
          ].slice(0, 5)}
        />
      </section>

      <section className="mt-3 rounded-lg border border-[#d9ded8] bg-[#fffdf8]">
        <div className="flex items-center justify-between border-b border-[#d9ded8] px-3 py-2">
          <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-[#083653]">Contatos recentes</h2>
          {canCreateContact && (
            <Link href="/leads/novo" className="text-sm font-semibold text-[#0f5f8f] hover:underline">
              Novo contato
            </Link>
          )}
        </div>
        {recentContacts.length ? (
          <ul className="divide-y divide-[#d9ded8]">
            {recentContacts.map((contact) => (
              <li key={contact.id}>
                <Link href={`/leads/${contact.id}`} className="grid gap-1 px-3 py-2 hover:bg-[#dcecf6]/45 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div>
                    <p className="font-semibold text-[#092f38]">{contact.name}</p>
                    <p className="text-sm text-[#5f7180]">{contact.company ? `${contact.company} · ${contact.phone}` : contact.phone}</p>
                  </div>
                  <StatusPill>{formatContactStatus(contact.status)}</StatusPill>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-3 py-3 text-sm text-[#5f7180]">Nenhum contato cadastrado.</p>
        )}
      </section>
    </AppShell>
  );
}

function Metric({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "neutral" | "warning" | "danger" }) {
  const toneClass = {
    neutral: "text-[#083653]",
    warning: "text-[#b7791f]",
    danger: "text-[#b54747]",
  }[tone];

  return (
    <div className="rounded-lg border border-[#d9ded8] bg-[#fffdf8] px-3 py-2">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#5f7180]">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}

function PanelList({
  empty,
  items,
  title,
}: {
  empty: string;
  items: { href: string; meta: string; title: string }[];
  title: string;
}) {
  return (
    <section className="rounded-lg border border-[#d9ded8] bg-[#fffdf8]">
      <div className="border-b border-[#d9ded8] px-3 py-2">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-[#083653]">{title}</h2>
      </div>
      {items.length ? (
        <ul className="divide-y divide-[#d9ded8]">
          {items.map((item, index) => (
            <li key={`${item.title}-${index}`}>
              <Link href={item.href} className="block px-3 py-2 hover:bg-[#dcecf6]/45">
                <p className="font-semibold text-[#092f38]">{item.title}</p>
                <p className="text-sm text-[#5f7180]">{item.meta}</p>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-3 py-3 text-sm text-[#5f7180]">{empty}</p>
      )}
    </section>
  );
}

function StatusPill({ children }: { children: React.ReactNode }) {
  return <span className="w-fit rounded-md bg-[#dcecf6] px-2 py-1 text-xs font-semibold text-[#083653]">{children}</span>;
}

function formatContactStatus(status: string) {
  const labels: Record<string, string> = {
    novo: "Novo",
    em_atendimento: "Em atendimento",
    qualificado: "Qualificado",
    orcamento_em_elaboracao: "Orçamento em elaboração",
    proposta_enviada: "Proposta enviada",
    negociacao: "Negociação",
    ganho: "Evento fechado",
    perdido: "Não avançou",
  };
  return labels[status] ?? status.replaceAll("_", " ");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(`${value}T00:00:00`));
}

function weekEndKey() {
  const now = new Date();
  const end = new Date(now);
  end.setDate(now.getDate() + 7);
  return end.toISOString().slice(0, 10);
}
