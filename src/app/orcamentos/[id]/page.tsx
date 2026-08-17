import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { FlowProgress, NextStepCard } from "@/components/flow-guidance";
import { SetupNotice } from "@/components/setup-notice";
import { createContractedEventFromQuote } from "@/app/eventos/actions";
import { contractedEventStatusLabel } from "@/lib/domain/contracted-event";
import { quoteStatusLabel, formatCurrencyFromCents } from "@/lib/domain/quote";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { requireUser } from "@/lib/auth";
import { QuoteEditLockForm, QuoteItemEditor, QuoteItemForm, QuotePackageForm, QuoteStatusForm } from "./quote-forms";
import { QuoteProposalOptionsPanel } from "./quote-proposal-options-panel";

type QuoteDetail = {
  id: string;
  title: string;
  status: string;
  event_type: string | null;
  desired_date: string | null;
  guest_count: number | null;
  notes: string | null;
  total_amount_cents: number;
  sent_at: string | null;
  approved_at: string | null;
  refused_at: string | null;
  decision_reason: string | null;
  admin_edit_unlocked: boolean;
  created_at: string;
  leads: { id: string; name: string; company: string | null; phone: string } | null;
  quote_items: QuoteItem[];
  quote_packages: QuotePackage[] | QuotePackage | null;
  quote_proposal_options: QuoteProposalOption[];
  quote_history: QuoteHistory[];
  contracted_events: ContractedEventSummary[];
};

type QuoteItem = {
  id: string;
  description: string;
  quantity: number;
  unit_price_cents: number;
};

type EventPackageItem = {
  id: string;
  category: string;
  name: string;
  description: string | null;
  show_in_proposal: boolean;
  show_in_operational_brief: boolean;
};

type EventPackageOption = {
  id: string;
  event_type: string;
  event_types: string[] | null;
  name: string;
  description: string | null;
  base_price_cents: number | null;
  event_package_items: EventPackageItem[] | EventPackageItem | null;
};

type QuotePackage = {
  id: string;
  package_id: string;
  unit_price_cents: number;
  guest_count: number;
  total_price_cents: number;
  notes: string | null;
  event_package_catalog: EventPackageOption | null;
};

type QuoteHistory = {
  id: string;
  action: string;
  created_at: string;
  metadata: Record<string, unknown>;
  profiles: { display_name: string | null } | null;
};

type ProposalCatalogOption = {
  id: string;
  title: string;
  content: string;
};

type QuoteProposalOption = {
  id: string;
  title: string;
  content: string;
};

type QuoteItemCatalogOption = {
  id: string;
  name: string;
  description: string | null;
  default_unit_price_cents: number | null;
};

type ContractedEventSummary = {
  id: string;
  status: string;
};

export default async function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  if (!hasSupabaseConfig()) return <SetupNotice />;
  const { id } = await params;
  const { supabase, permissions } = await requireUser();
  const canManageQuotes = permissions.some((permission) => permission === "atendimento" || permission === "financeiro" || permission === "admin_owner");
  const isAdminOwner = permissions.includes("admin_owner");

  const { data: quote, error } = await supabase
    .from("quotes")
    .select("id,title,status,event_type,desired_date,guest_count,notes,total_amount_cents,sent_at,approved_at,refused_at,decision_reason,admin_edit_unlocked,created_at,leads(id,name,company,phone),quote_items(id,description,quantity,unit_price_cents),quote_packages(id,package_id,unit_price_cents,guest_count,total_price_cents,notes,event_package_catalog(id,event_type,event_types,name,description,base_price_cents,event_package_items(id,category,name,description,show_in_proposal,show_in_operational_brief))),quote_proposal_options(id,title,content),quote_history(id,action,metadata,created_at,profiles(display_name)),contracted_events(id,status)")
    .eq("id", id)
    .maybeSingle();
  const { data: proposalCatalogOptions } = await supabase.from("proposal_option_catalog").select("id,title,content").eq("is_active", true).order("sort_order").order("title");
  const { data: quoteItemCatalogOptions } = await supabase.from("quote_item_catalog").select("id,name,description,default_unit_price_cents").eq("is_active", true).order("sort_order").order("name");

  if (error) {
    return (
      <AppShell title="Orçamento indisponível">
        <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">Não foi possível carregar o orçamento: {error.message}</p>
      </AppShell>
    );
  }
  if (!quote) notFound();

  const detail = quote as unknown as QuoteDetail;
  const packageRequest = supabase
    .from("event_package_catalog")
    .select("id,event_type,event_types,name,description,base_price_cents,event_package_items(id,category,name,description,show_in_proposal,show_in_operational_brief)")
    .eq("is_active", true)
    .order("sort_order")
    .order("name");
  const { data: packageOptions } = await packageRequest;
  const safePackageOptions = ((packageOptions ?? []) as EventPackageOption[]).filter((option) => !detail.event_type || packageMatchesEventType(option, detail.event_type));
  const items = [...(detail.quote_items ?? [])];
  const selectedPackage = firstRecord(detail.quote_packages);
  const selectedProposalOptions = [...(detail.quote_proposal_options ?? [])];
  const history = [...(detail.quote_history ?? [])].sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime());
  const contractedEvent = detail.contracted_events?.[0];
  const isApprovedLocked = detail.status === "aprovado" && !detail.admin_edit_unlocked && !isAdminOwner;
  const canEditQuote = canManageQuotes && !isApprovedLocked;

  return (
    <AppShell title={detail.title}>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <Link href={`/leads/${detail.leads?.id}`} className="text-sm font-semibold text-[#356451] underline">
          ← Voltar ao lead
        </Link>
        <Link href={`/orcamentos/${detail.id}/proposta`} className="text-sm font-semibold text-[#356451] underline">
          Ver proposta para cliente
        </Link>
        <span className="rounded-full bg-[#edf5ee] px-3 py-1 text-sm text-[#356451]">{quoteStatusLabel(detail.status)}</span>
        {detail.status === "aprovado" && (
          <span className={`rounded-full px-3 py-1 text-sm ${detail.admin_edit_unlocked ? "bg-[#fff5e6] text-[#744c15]" : "bg-slate-100 text-slate-700"}`}>
            {detail.admin_edit_unlocked ? "Edição liberada" : "Edição protegida"}
          </span>
        )}
      </div>

      <FlowProgress steps={quoteFlowSteps({ status: detail.status, hasItems: items.length > 0 || Boolean(selectedPackage), hasEvent: Boolean(contractedEvent) })} />

      <NextStepCard
        title={quoteNextStepTitle({ status: detail.status, hasItems: items.length > 0 || Boolean(selectedPackage), hasEvent: Boolean(contractedEvent) })}
        description={quoteNextStepDescription({ status: detail.status, hasItems: items.length > 0 || Boolean(selectedPackage), hasEvent: Boolean(contractedEvent) })}
        href={contractedEvent ? `/eventos/${contractedEvent.id}` : detail.status === "aprovado" ? undefined : `/orcamentos/${detail.id}/proposta`}
        ctaLabel={detail.status === "enviado" ? "Abrir proposta" : contractedEvent ? "Abrir evento" : "Ver proposta"}
        tone={contractedEvent ? "success" : detail.status === "aprovado" ? "warning" : "info"}
        action={
          detail.status === "aprovado" && !contractedEvent ? (
            <form action={createContractedEventFromQuote}>
              <input type="hidden" name="quoteId" value={detail.id} />
              <button className="rounded-lg bg-[#18352d] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#23483d] active:scale-[0.99]">
                Criar evento
              </button>
            </form>
          ) : undefined
        }
      />

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <section className="space-y-4 lg:col-span-2">
          <section className="rounded-lg border border-[#dbe3dc] bg-white p-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="font-semibold">Resumo</h2>
                <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-sm text-slate-500">Lead</dt>
                    <dd>{detail.leads?.name ?? "Lead"}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-slate-500">Lead</dt>
                    <dd>{detail.leads?.phone}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-slate-500">Evento</dt>
                    <dd>{detail.event_type ?? "Não informado"}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-slate-500">Data</dt>
                    <dd>{detail.desired_date ?? "Não informada"}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-slate-500">Convidados</dt>
                    <dd>{detail.guest_count ?? "Não informado"}</dd>
                  </div>
                </dl>
              </div>
              <div className="rounded-lg bg-[#f6fbf7] p-4 text-right">
                <p className="text-sm text-slate-500">Total</p>
                <p className="mt-1 text-3xl font-semibold text-[#18352d]">{formatCurrencyFromCents(detail.total_amount_cents)}</p>
              </div>
            </div>
            {detail.notes && <p className="mt-5 whitespace-pre-wrap border-t border-slate-100 pt-4 text-slate-700">{detail.notes}</p>}
            {(detail.approved_at || detail.refused_at || detail.sent_at || detail.decision_reason) && (
              <dl className="mt-5 grid gap-3 border-t border-slate-100 pt-4 text-sm sm:grid-cols-2">
                {detail.sent_at && <DecisionInfo label="Enviado em" value={formatDateTime(detail.sent_at)} />}
                {detail.approved_at && <DecisionInfo label="Aprovado em" value={formatDateTime(detail.approved_at)} />}
                {detail.refused_at && <DecisionInfo label="Recusado em" value={formatDateTime(detail.refused_at)} />}
                {detail.decision_reason && <DecisionInfo label="Motivo" value={detail.decision_reason} />}
              </dl>
            )}
          </section>

          <QuotePackageForm
            canEdit={canEditQuote}
            guestCount={detail.guest_count}
            packageOptions={safePackageOptions}
            quoteId={detail.id}
            selectedPackage={selectedPackage ?? undefined}
          />

          <section className="overflow-hidden rounded-lg border border-[#dbe3dc] bg-white">
            <div className="border-b border-[#edf1ee] p-4">
              <h2 className="font-semibold">Itens</h2>
            </div>
            {items.length ? (
              <ul>
                {items.map((item) => (
                  <QuoteItemEditor key={item.id} quoteId={detail.id} item={item} canEdit={canEditQuote} />
                ))}
              </ul>
            ) : (
              <div className="p-4">
                <h3 className="font-semibold">Nenhum item adicionado.</h3>
                <p className="mt-1 text-slate-600">Adicione os serviços/produtos para calcular o total do orçamento.</p>
              </div>
            )}
          </section>

          {canManageQuotes && isApprovedLocked && (
            <p className="rounded-lg border border-[#dbe3dc] bg-slate-50 p-4 text-sm text-slate-700">Este orçamento foi aprovado e está protegido. Peça a um admin para liberar edição, se necessário.</p>
          )}
          {canEditQuote && <QuoteItemForm quoteId={detail.id} catalogItems={(quoteItemCatalogOptions ?? []) as QuoteItemCatalogOption[]} />}

          {canEditQuote && <QuoteProposalOptionsPanel quoteId={detail.id} catalogOptions={(proposalCatalogOptions ?? []) as ProposalCatalogOption[]} selectedOptions={selectedProposalOptions} />}
        </section>

        <aside className="space-y-5">
          {canManageQuotes && <QuoteStatusForm quoteId={detail.id} status={detail.status} decisionReason={detail.decision_reason ?? ""} />}
          {isAdminOwner && detail.status === "aprovado" && <QuoteEditLockForm quoteId={detail.id} unlocked={detail.admin_edit_unlocked} />}
          {detail.status === "aprovado" && (
            <section className="rounded-lg border border-[#dbe3dc] bg-white p-4">
              <h2 className="font-semibold">Evento contratado</h2>
              {contractedEvent ? (
                <>
                  <p className="mt-2 text-sm text-slate-600">Evento criado e em status {contractedEventStatusLabel(contractedEvent.status)}.</p>
                  <Link href={`/eventos/${contractedEvent.id}`} className="mt-4 inline-flex rounded-lg bg-[#18352d] px-5 py-3 font-semibold text-white transition hover:bg-[#23483d]">
                    Abrir evento
                  </Link>
                </>
              ) : (
                <>
                  <p className="mt-2 text-sm text-slate-600">Crie o registro operacional a partir deste orçamento aprovado.</p>
                  <form action={createContractedEventFromQuote} className="mt-4">
                    <input type="hidden" name="quoteId" value={detail.id} />
                    <button className="rounded-lg bg-[#18352d] px-5 py-3 font-semibold text-white transition hover:bg-[#23483d] active:scale-[0.99]">
                      Criar evento contratado
                    </button>
                  </form>
                </>
              )}
            </section>
          )}

          <section className="rounded-lg border border-[#dbe3dc] bg-white p-4">
            <h2 className="font-semibold">Histórico do orçamento</h2>
            {history.length ? (
              <ol className="mt-4 space-y-4">
                {history.map((entry) => (
                  <li key={entry.id} className="border-l-2 border-[#e8a849] pl-3">
                    <p className="text-sm font-medium">{historyText(entry)}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {entry.profiles?.display_name ?? "Usuário"} · {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(entry.created_at))}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-3 text-sm text-slate-600">Ainda não há histórico.</p>
            )}
          </section>
        </aside>
      </div>
    </AppShell>
  );
}

function DecisionInfo({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className="mt-1 whitespace-pre-wrap font-medium">{value}</dd>
    </div>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function historyText(entry: QuoteHistory) {
  if (entry.action === "Status do orçamento alterado") {
    const from = typeof entry.metadata.from === "string" ? quoteStatusLabel(entry.metadata.from) : "status anterior";
    const to = typeof entry.metadata.to === "string" ? quoteStatusLabel(entry.metadata.to) : "novo status";
    return `Status: ${from} → ${to}`;
  }
  return entry.action;
}

function quoteFlowSteps({ hasEvent, hasItems, status }: { hasEvent: boolean; hasItems: boolean; status: string }) {
  return [
    {
      label: "Montagem",
      description: hasItems ? "Pacote ou itens já adicionados." : "Adicione pacote e itens para formar o valor.",
      status: hasItems ? ("done" as const) : ("current" as const),
    },
    {
      label: "Proposta",
      description: status === "enviado" || status === "aprovado" || hasEvent ? "Proposta já saiu do rascunho." : "Revise a proposta antes de enviar.",
      status: status === "enviado" || status === "aprovado" || hasEvent ? ("done" as const) : hasItems ? ("current" as const) : ("pending" as const),
    },
    {
      label: "Decisão",
      description: status === "aprovado" ? "Cliente aprovou o orçamento." : status === "recusado" ? "Cliente recusou a proposta." : "Aguardando retorno do cliente.",
      status: status === "aprovado" || status === "recusado" || hasEvent ? ("done" as const) : status === "enviado" ? ("current" as const) : ("pending" as const),
    },
    {
      label: "Evento",
      description: hasEvent ? "Evento operacional criado." : "Após aprovação, crie o evento.",
      status: hasEvent ? ("done" as const) : status === "aprovado" ? ("current" as const) : ("pending" as const),
    },
  ];
}

function quoteNextStepTitle({ hasEvent, hasItems, status }: { hasEvent: boolean; hasItems: boolean; status: string }) {
  if (hasEvent) return "Acompanhar o evento";
  if (status === "aprovado") return "Transformar orçamento em evento";
  if (status === "enviado") return "Acompanhar resposta do cliente";
  if (!hasItems) return "Adicionar pacote ou itens";
  return "Revisar proposta para cliente";
}

function quoteNextStepDescription({ hasEvent, hasItems, status }: { hasEvent: boolean; hasItems: boolean; status: string }) {
  if (hasEvent) return "O orçamento já virou evento. Continue a operação pelo checklist, financeiro, fornecedores e ficha operacional.";
  if (status === "aprovado") return "O orçamento foi aprovado. Agora crie o registro de evento para a equipe operacional acompanhar.";
  if (status === "enviado") return "A proposta já foi enviada. Abra a proposta para consultar o material enviado ao cliente; quando houver retorno, registre aprovação, recusa ou ajustes no status do orçamento.";
  if (!hasItems) return "Escolha um pacote principal ou adicione itens avulsos antes de enviar a proposta.";
  return "Confira se pacote, itens, valores e textos estão corretos antes de compartilhar com o cliente.";
}

function firstRecord<T>(value: T[] | T | null | undefined) {
  if (Array.isArray(value)) return value[0];
  return value;
}

function packageMatchesEventType(option: EventPackageOption, eventType: string) {
  const eventTypes = option.event_types?.length ? option.event_types : [option.event_type];
  return eventTypes.includes(eventType);
}
