import Link from "next/link";
import { notFound } from "next/navigation";
import { createQuoteFromLead } from "@/app/orcamentos/actions";
import { AppShell } from "@/components/app-shell";
import { FlowProgress, NextStepCard } from "@/components/flow-guidance";
import { SetupNotice } from "@/components/setup-notice";
import { requireUser } from "@/lib/auth";
import { canManageLeads, defaultEventTypes, defaultLeadSources } from "@/lib/domain/lead";
import { formatCurrencyFromCents, quoteStatusLabel } from "@/lib/domain/quote";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { LeadDetailEditForm } from "./lead-detail-edit-form";

type Option = { kind?: string; name: string };

type QuoteSummary = {
  id: string;
  title: string;
  status: string;
  total_amount_cents: number;
  created_at: string;
  contracted_events: { id: string; status: string }[] | null;
};

type LeadHistory = {
  id: string;
  action: string;
  created_at: string;
  profiles: { display_name: string | null } | null;
};

export default async function LeadDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  if (!hasSupabaseConfig()) return <SetupNotice />;

  const { id } = await params;
  const query = await searchParams;
  const errorCode = Array.isArray(query.error) ? query.error[0] : query.error;
  const { supabase, permissions } = await requireUser();
  const canManage = canManageLeads(permissions);

  const [{ data: lead }, { data: options }] = await Promise.all([
    supabase
      .from("leads")
      .select("*,potential_events(*),lead_history(*, profiles(display_name)),quotes(id,title,status,total_amount_cents,created_at,contracted_events(id,status))")
      .eq("id", id)
      .single(),
    supabase.from("option_catalog").select("kind,name").eq("is_active", true).order("sort_order").order("name"),
  ]);

  if (!lead) notFound();

  const eventTypes = ((options ?? []) as Option[]).filter((option) => option.kind === "event_type");
  const leadSources = ((options ?? []) as Option[]).filter((option) => option.kind === "lead_source");
  const safeEventTypes = eventTypes.length ? eventTypes : defaultEventTypes.map((name) => ({ name }));
  const safeLeadSources = leadSources.length ? leadSources : defaultLeadSources.map((name) => ({ name }));
  const quotes = ([...((lead.quotes ?? []) as QuoteSummary[])]).sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime());
  const history = ([...((lead.lead_history ?? []) as LeadHistory[])]).sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime());
  const latestQuote = quotes[0];
  const contractedEvent = quotes.flatMap((quote) => quote.contracted_events ?? [])[0];

  return (
    <AppShell title={lead.name}>
      <Link href="/painel" className="text-sm font-semibold text-[#356451] underline">
        ← Voltar ao painel
      </Link>

      {errorCode === "quote_create_failed" && (
        <p className="mt-4 rounded-lg border border-red-100 bg-red-50 p-4 text-sm text-red-800">
          Não foi possível criar o orçamento. Confira suas permissões ou tente novamente.
        </p>
      )}

      <FlowProgress steps={leadFlowSteps({ hasQuote: Boolean(latestQuote), hasEvent: Boolean(contractedEvent), quoteStatus: latestQuote?.status })} />

      <NextStepCard
        title={leadNextStepTitle({ canManage, hasQuote: Boolean(latestQuote), hasEvent: Boolean(contractedEvent), quoteStatus: latestQuote?.status })}
        description={leadNextStepDescription({ canManage, hasQuote: Boolean(latestQuote), hasEvent: Boolean(contractedEvent), quoteStatus: latestQuote?.status })}
        href={latestQuote && !contractedEvent ? `/orcamentos/${latestQuote.id}` : undefined}
        ctaLabel="Abrir orçamento"
        tone={contractedEvent ? "success" : latestQuote?.status === "aprovado" ? "warning" : "info"}
        action={
          !latestQuote && canManage ? (
            <form action={createQuoteFromLead}>
              <input type="hidden" name="leadId" value={lead.id} />
              <input type="hidden" name="returnTo" value={`/leads/${lead.id}`} />
              <button className="rounded-lg bg-[#18352d] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#23483d] active:scale-[0.99]">
                Criar orçamento
              </button>
            </form>
          ) : contractedEvent ? (
            <Link href={`/eventos/${contractedEvent.id}`} className="inline-flex rounded-lg bg-[#18352d] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#23483d]">
              Abrir evento
            </Link>
          ) : undefined
        }
      />

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <section className="space-y-4 md:col-span-2">
          <section className="rounded-lg border border-[#dbe3dc] bg-white p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="font-semibold">Contato e evento</h2>
                <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Info label="Telefone" value={lead.phone} />
                  <Info label="Empresa" value={lead.company ?? "Não informada"} />
                  <Info label="Status" value={formatLeadStatus(lead.status)} />
                  <Info label="Origem" value={lead.source ?? "Não informada"} />
                  <Info label="Evento" value={lead.event_type ?? "Não informado"} />
                  <Info label="Data desejada" value={lead.desired_date ? formatDate(lead.desired_date) : "Não informada"} />
                  <Info label="Convidados" value={lead.guest_count ? String(lead.guest_count) : "Não informado"} />
                </dl>
              </div>
              {canManage && (
                <form action={createQuoteFromLead}>
                  <input type="hidden" name="leadId" value={lead.id} />
                  <input type="hidden" name="returnTo" value={`/leads/${lead.id}`} />
                  <button className="rounded-lg bg-[#18352d] px-5 py-3 font-semibold text-white transition hover:bg-[#23483d] active:scale-[0.99]">
                    Criar orçamento
                  </button>
                </form>
              )}
            </div>
            {lead.notes && <p className="mt-5 whitespace-pre-wrap border-t border-slate-100 pt-4 text-slate-700">{lead.notes}</p>}
          </section>

          {canManage && <LeadDetailEditForm lead={lead} eventTypes={safeEventTypes} leadSources={safeLeadSources} />}

          <section className="overflow-hidden rounded-lg border border-[#dbe3dc] bg-white">
            <div className="border-b border-[#edf1ee] p-4">
              <h2 className="font-semibold">Orçamentos</h2>
            </div>
            {quotes.length ? (
              <ul>
                {quotes.map((quote) => (
                  <li key={quote.id} className="flex flex-col gap-3 border-b border-[#edf1ee] p-4 last:border-0 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <Link href={`/orcamentos/${quote.id}`} className="font-semibold underline-offset-4 hover:underline">
                        {quote.title}
                      </Link>
                      <p className="mt-1 text-sm text-slate-600">
                        {quoteStatusLabel(quote.status)} · {formatDateTime(quote.created_at)}
                      </p>
                    </div>
                    <span className="rounded-full bg-[#edf5ee] px-3 py-1 text-sm font-semibold text-[#356451]">{formatCurrencyFromCents(quote.total_amount_cents)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-4">
                <h3 className="font-semibold">Ainda não há orçamentos.</h3>
                <p className="mt-1 text-slate-600">Crie o primeiro orçamento quando o contato estiver qualificado.</p>
              </div>
            )}
          </section>
        </section>

        <aside className="rounded-lg border border-[#dbe3dc] bg-white p-4">
          <h2 className="font-semibold">Histórico</h2>
          {history.length ? (
            <ol className="mt-4 space-y-4">
              {history.map((entry) => (
                <li key={entry.id} className="border-l-2 border-[#e8a849] pl-3">
                  <p className="text-sm font-medium">{entry.action}</p>
                  <p className="text-xs text-slate-500">
                    {entry.profiles?.display_name ?? "Usuário"} · {formatDateTime(entry.created_at)}
                  </p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-3 text-sm text-slate-600">Ainda não há histórico.</p>
          )}
        </aside>
      </div>
    </AppShell>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function leadFlowSteps({ hasEvent, hasQuote, quoteStatus }: { hasEvent: boolean; hasQuote: boolean; quoteStatus?: string }) {
  return [
    { label: "Lead", description: "Lead cadastrado e dados principais reunidos.", status: "done" as const },
    {
      label: "Orçamento",
      description: hasQuote ? `Existe orçamento em status ${quoteStatusLabel(quoteStatus ?? "")}.` : "Próximo passo: criar orçamento.",
      status: hasQuote ? ("done" as const) : ("current" as const),
    },
    {
      label: "Aprovação",
      description: quoteStatus === "aprovado" ? "Proposta aprovada pelo cliente." : "Aguardando proposta enviada e decisão do cliente.",
      status: quoteStatus === "aprovado" || hasEvent ? ("done" as const) : hasQuote ? ("current" as const) : ("pending" as const),
    },
    {
      label: "Evento",
      description: hasEvent ? "Evento operacional criado." : "Quando aprovado, vira evento.",
      status: hasEvent ? ("done" as const) : quoteStatus === "aprovado" ? ("current" as const) : ("pending" as const),
    },
  ];
}

function leadNextStepTitle({ canManage, hasEvent, hasQuote, quoteStatus }: { canManage: boolean; hasEvent: boolean; hasQuote: boolean; quoteStatus?: string }) {
  if (hasEvent) return "Acompanhar o evento contratado";
  if (quoteStatus === "aprovado") return "Criar o evento operacional";
  if (hasQuote) return "Continuar o orçamento";
  if (canManage) return "Criar o primeiro orçamento";
  return "Aguardar equipe comercial";
}

function leadNextStepDescription({ canManage, hasEvent, hasQuote, quoteStatus }: { canManage: boolean; hasEvent: boolean; hasQuote: boolean; quoteStatus?: string }) {
  if (hasEvent) return "Este lead já virou evento. Acompanhe checklist, fornecedores, cronograma e pagamentos na página do evento.";
  if (quoteStatus === "aprovado") return "O cliente aprovou a proposta. O próximo passo é transformar o orçamento em evento para a operação acompanhar.";
  if (hasQuote) return "Abra o orçamento para revisar pacote, itens, valor, proposta e status comercial.";
  if (canManage) return "Use os dados do lead para gerar um orçamento e iniciar a proposta comercial.";
  return "Você pode consultar os dados, mas precisa de permissão de atendimento para criar orçamento.";
}

function formatLeadStatus(status: string) {
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
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date(`${value}T00:00:00`));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}
