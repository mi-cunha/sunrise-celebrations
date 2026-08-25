import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { FlowProgress, NextStepCard } from "@/components/flow-guidance";
import { SetupNotice } from "@/components/setup-notice";
import { contractedEventBillingModelLabel, contractedEventContractStatusLabel, contractedEventPaymentStatusLabel, contractedEventStatusLabel, contractedEventVendorStatusLabel } from "@/lib/domain/contracted-event";
import { formatCurrencyFromCents, quoteEventAreaLabel, quoteStatusLabel } from "@/lib/domain/quote";
import { requireUser } from "@/lib/auth";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { BillingModelForm, ChecklistItemCard, ChecklistItemForm, ContractedEventNotesForm, ContractedEventStatusForm, ContractDocumentForm, OperationalBriefForm, PaymentCard, PaymentForm, PaymentPlanForm, TimelineEntryCard, TimelineEntryForm, VendorCard, VendorForm } from "./event-forms";
import { CostCard, CostForm, type EventCost } from "./cost-forms";

type ContractedEventDetail = {
  id: string;
  title: string;
  status: string;
  event_type: string | null;
  event_area: string | null;
  event_date: string | null;
  guest_count: number | null;
  billing_model: string;
  billing_notes: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  leads: { id: string; name: string; company: string | null; phone: string } | null;
  quotes: { id: string; title: string; status: string; total_amount_cents: number } | null;
  contracted_event_contracts: ContractSummary[] | ContractSummary | null;
  contracted_event_payments: PaymentSummary[];
  contracted_event_costs: EventCost[];
  contracted_event_checklist: ChecklistItem[];
  contracted_event_timeline: TimelineEntry[];
  contracted_event_vendors: Vendor[];
  contracted_event_history: EventHistory[];
  contracted_event_documents: EventDocument[];
  contracted_event_contract_document_versions: ContractDocumentVersion[];
};

type ChecklistItem = {
  id: string;
  title: string;
  is_done: boolean;
  sort_order: number;
  completed_at: string | null;
  assigned_to: string | null;
  due_date: string | null;
  notes: string | null;
};

type TimelineEntry = {
  id: string;
  title: string;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  assigned_to: string | null;
  notes: string | null;
  sort_order: number;
};

type Vendor = {
  id: string;
  category: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  status: string;
  notes: string | null;
};

type ContractSummary = {
  id: string;
  status: string;
  signed_at: string | null;
  notes: string | null;
};

type PaymentSummary = {
  id: string;
  kind: string;
  status: string;
  amount_cents: number;
  due_date: string | null;
  paid_at: string | null;
  payment_method: string | null;
  notes: string | null;
};

type EventHistory = {
  id: string;
  action: string;
  created_at: string;
  metadata: Record<string, unknown>;
  profiles: { display_name: string | null } | null;
};

type EventDocument = {
  id: string;
  document_type: string;
  title: string;
  content: string;
  updated_at: string;
};

type ContractDocumentVersion = {
  id: string;
  version: number;
  document_kind: string;
  status: string;
  title: string;
  created_at: string;
  updated_at: string;
  reviewed_at: string | null;
  issued_at: string | null;
};

type Assignee = {
  id: string;
  display_name: string | null;
};

export default async function EventDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ contrato?: string; ficha?: string }>;
}) {
  if (!hasSupabaseConfig()) return <SetupNotice />;

  const { id } = await params;
  const query = await searchParams;
  const { supabase, permissions } = await requireUser();
  const canManageEvents = permissions.some((permission) => permission === "atendimento" || permission === "gerencia" || permission === "direcao" || permission === "admin_owner");
  const canManageFinancials = permissions.some((permission) => permission === "financeiro" || permission === "gerencia" || permission === "direcao" || permission === "admin_owner");
  const canGenerateContractDocument = permissions.some((permission) => permission === "gerencia" || permission === "direcao" || permission === "admin_owner");

  const { data: event, error } = await supabase
    .from("contracted_events")
    .select("id,title,status,event_type,event_area,event_date,guest_count,billing_model,billing_notes,notes,created_at,updated_at,leads(id,name,company,phone),quotes(id,title,status,total_amount_cents),contracted_event_contracts(id,status,signed_at,notes),contracted_event_payments(id,kind,status,amount_cents,due_date,paid_at,payment_method,notes),contracted_event_costs(id,category,status,description,estimated_amount_cents,actual_amount_cents,due_date,notes),contracted_event_checklist(id,title,is_done,sort_order,completed_at,assigned_to,due_date,notes),contracted_event_timeline(id,title,start_time,end_time,location,assigned_to,notes,sort_order),contracted_event_vendors(id,category,name,contact_name,phone,email,status,notes),contracted_event_history(id,action,metadata,created_at,profiles(display_name)),contracted_event_documents(id,document_type,title,content,updated_at),contracted_event_contract_document_versions(id,version,document_kind,status,title,created_at,updated_at,reviewed_at,issued_at)")
    .eq("id", id)
    .maybeSingle();
  const { data: profiles } = await supabase.from("profiles").select("id,display_name").eq("is_active", true).order("display_name");

  if (error) {
    return (
      <AppShell title="Evento indisponível">
        <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">Não foi possível carregar o evento: {error.message}</p>
      </AppShell>
    );
  }
  if (!event) notFound();

  const detail = event as unknown as ContractedEventDetail;
  const checklist = [...(detail.contracted_event_checklist ?? [])].sort((left, right) => left.sort_order - right.sort_order);
  const timeline = [...(detail.contracted_event_timeline ?? [])].sort((left, right) => {
    const leftTime = left.start_time ?? "99:99";
    const rightTime = right.start_time ?? "99:99";
    return leftTime.localeCompare(rightTime) || left.sort_order - right.sort_order;
  });
  const vendors = [...(detail.contracted_event_vendors ?? [])].sort((left, right) => left.category.localeCompare(right.category, "pt-BR") || left.name.localeCompare(right.name, "pt-BR"));
  const contract = firstRecord(detail.contracted_event_contracts);
  const payments = [...(detail.contracted_event_payments ?? [])].sort((left, right) => (left.due_date ?? "9999-12-31").localeCompare(right.due_date ?? "9999-12-31"));
  const paidAmount = payments.filter((payment) => payment.status === "pago").reduce((total, payment) => total + payment.amount_cents, 0);
  const openAmount = payments.filter((payment) => payment.status !== "pago" && payment.status !== "cancelado").reduce((total, payment) => total + payment.amount_cents, 0);
  const costs = [...(detail.contracted_event_costs ?? [])].sort((left, right) => left.category.localeCompare(right.category, "pt-BR") || left.description.localeCompare(right.description, "pt-BR"));
  const totalCosts = costs.filter((cost) => cost.status !== "cancelado").reduce((total, cost) => total + (cost.actual_amount_cents ?? cost.estimated_amount_cents), 0);
  const approvedRevenue = detail.quotes?.total_amount_cents ?? 0;
  const estimatedMargin = approvedRevenue - totalCosts;
  const history = [...(detail.contracted_event_history ?? [])].sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime());
  const assignees = (profiles ?? []) as Assignee[];
  const assigneeNames = new Map(assignees.map((profile) => [profile.id, profile.display_name ?? "Usuário"]));
  const operationalBrief = detail.contracted_event_documents?.find((document) => document.document_type === "ficha_operacional");
  const contractDocument = detail.contracted_event_documents?.find((document) => document.document_type === "contrato");
  const contractVersions = [...(detail.contracted_event_contract_document_versions ?? [])].sort((left, right) => right.version - left.version);
  const latestContractVersion = contractVersions[0];
  const completedItems = checklist.filter((item) => item.is_done).length;
  const hasPendingChecklist = checklist.some((item) => !item.is_done);
  const hasVendors = vendors.length > 0;
  const hasTimeline = timeline.length > 0;
  const hasSignedContract = contract?.status === "assinado";

  return (
    <AppShell title={detail.title}>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <Link href="/eventos" className="text-sm font-semibold text-[#356451] underline">
          Voltar aos eventos
        </Link>
        {detail.leads && (
          <Link href={`/leads/${detail.leads.id}`} className="text-sm font-semibold text-[#356451] underline">
            Ver lead
          </Link>
        )}
        {detail.quotes && (
          <Link href={`/orcamentos/${detail.quotes.id}`} className="text-sm font-semibold text-[#356451] underline">
            Ver orçamento
          </Link>
        )}
        <span className="rounded-full bg-[#edf5ee] px-3 py-1 text-sm text-[#356451]">{contractedEventStatusLabel(detail.status)}</span>
      </div>

      <FlowProgress steps={eventFlowSteps({ hasPendingChecklist, hasSignedContract, hasTimeline, hasVendors })} />

      <NextStepCard
        title={eventNextStepTitle({ hasPendingChecklist, hasSignedContract, hasTimeline, hasVendors, openAmount })}
        description={eventNextStepDescription({ hasPendingChecklist, hasSignedContract, hasTimeline, hasVendors, openAmount })}
        tone={hasPendingChecklist || openAmount > 0 ? "warning" : "success"}
      />

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <section className="space-y-4 lg:col-span-2">
          <section className="rounded-lg border border-[#dbe3dc] bg-white p-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="font-semibold">Resumo do evento</h2>
                <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Info label="Cliente" value={detail.leads?.name ?? "Não informado"} />
                  <Info label="Telefone" value={detail.leads?.phone ?? "Não informado"} />
                  <Info label="Tipo de evento" value={detail.event_type ?? "Não informado"} />
                  <Info label="Área" value={quoteEventAreaLabel(detail.event_area)} />
                  <Info label="Data" value={detail.event_date ? formatDate(detail.event_date) : "Não definida"} />
                  <Info label="Convidados" value={detail.guest_count ? String(detail.guest_count) : "Não informado"} />
                  <Info label="Status" value={contractedEventStatusLabel(detail.status)} />
                  <Info label="Cobrança" value={contractedEventBillingModelLabel(detail.billing_model)} />
                </dl>
              </div>
              {detail.quotes && (
                <div className="rounded-lg bg-[#f6fbf7] p-4 text-right">
                  <p className="text-sm text-slate-500">Investimento aprovado</p>
                  <p className="mt-1 text-3xl font-semibold text-[#18352d]">{formatCurrencyFromCents(detail.quotes.total_amount_cents)}</p>
                  <p className="mt-1 text-xs text-slate-500">Orçamento {quoteStatusLabel(detail.quotes.status)}</p>
                </div>
              )}
            </div>
            {["consumo_aberto_pos_evento", "pre_pago_com_consumo_aberto"].includes(detail.billing_model) && (
              <div className="mt-5 rounded-lg border border-[#e8d7a9] bg-[#fffaf0] p-4 text-sm text-[#8a5a12]">
                <p className="font-semibold">{detail.billing_model === "pre_pago_com_consumo_aberto" ? "Evento com pré-pago + consumo aberto." : "Evento com consumo aberto - pagamento pós-evento."}</p>
                <p className="mt-1">{detail.billing_model === "pre_pago_com_consumo_aberto" ? "Parte dos serviços pode ser paga antecipadamente, e consumos variáveis serão apurados e cobrados após o evento." : "O cliente pode reservar o espaço sem cobrança antecipada; o consumo será apurado e cobrado após o evento."}</p>
                {detail.billing_notes && <p className="mt-2 whitespace-pre-wrap">{detail.billing_notes}</p>}
              </div>
            )}
          </section>

          {canManageEvents && <ContractedEventNotesForm eventId={detail.id} notes={detail.notes} />}
          {!canManageEvents && detail.notes && (
            <section className="rounded-lg border border-[#dbe3dc] bg-white p-4">
              <h2 className="font-semibold">Observação operacional</h2>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{detail.notes}</p>
            </section>
          )}

          {canManageFinancials && (
            <section className="rounded-lg border border-[#dbe3dc] bg-white p-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <h2 className="font-semibold">Pagamentos e contrato</h2>
                  <p className="mt-1 text-sm text-slate-600">Controle interno do evento. Esta área não aparece na ficha operacional.</p>
                </div>
                <div className="grid gap-2 text-sm sm:grid-cols-2 xl:grid-cols-5">
                  <FinanceBadge label="Contrato" value={contract ? contractedEventContractStatusLabel(contract.status) : "Pendente"} />
                  <FinanceBadge label="Pago" value={formatCurrencyFromCents(paidAmount)} />
                  <FinanceBadge label="Em aberto" value={formatCurrencyFromCents(openAmount)} />
                  <FinanceBadge label="Custos" value={formatCurrencyFromCents(totalCosts)} />
                  <FinanceBadge label="Margem estimada" value={formatCurrencyFromCents(estimatedMargin)} />
                </div>
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                <div className="space-y-5 rounded-lg border border-[#dbe3dc] bg-white p-4">
                  <div>
                    <h3 className="font-semibold">1. Cobrança e pagamentos</h3>
                    <p className="mt-1 text-sm text-slate-600">Cadastre o plano de pagamento antes de gerar a versão contratual.</p>
                  </div>
                  <BillingModelForm billing={{ billing_model: detail.billing_model, billing_notes: detail.billing_notes }} eventId={detail.id} />
                  {payments.length ? (
                    <div className="space-y-3">
                      {payments.map((payment) => (
                        <PaymentCard key={payment.id} eventId={detail.id} payment={payment} />
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-lg bg-[#fbf8f1] p-3 text-sm text-slate-600">Nenhum pagamento cadastrado.</p>
                  )}
                  {detail.quotes && <PaymentPlanForm eventId={detail.id} totalAmountCents={detail.quotes.total_amount_cents} />}
                  <PaymentForm eventId={detail.id} />
                </div>
                <div className="space-y-5 rounded-lg border border-[#dbe3dc] bg-white p-4">
                  <div>
                    <h3 className="font-semibold">2. Contrato</h3>
                    <p className="mt-1 text-sm text-slate-600">Gere, revise, emita e acompanhe o mesmo documento até a assinatura.</p>
                  </div>
                  {detail.quotes?.status === "aprovado" ? (
                    canGenerateContractDocument ? <ContractDocumentForm document={latestContractVersion ?? undefined} eventId={detail.id} /> : <p className="rounded-lg bg-[#fbf8f1] p-3 text-sm text-slate-600">A emissão e a atualização do contrato são restritas à gerência.</p>
                  ) : (
                    <div className="rounded-lg border border-[#dbe3dc] bg-[#f8fafc] p-4">
                      <h3 className="font-semibold">Contrato indisponível</h3>
                      <p className="mt-1 text-sm text-slate-600">A área de contrato será liberada após a aprovação do orçamento e a conclusão das escolhas obrigatórias do pacote.</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 rounded-lg border border-[#dbe3dc] bg-white p-4">
                <div className="mb-4"><h3 className="font-semibold">3. Custos e margem</h3><p className="mt-1 text-sm text-slate-600">Custos internos não aparecem na proposta, no contrato ou na ficha operacional.</p></div>
                {costs.length ? <div className="mb-4 grid gap-3 md:grid-cols-2">{costs.map((cost) => <CostCard key={cost.id} eventId={detail.id} cost={cost} />)}</div> : <p className="mb-4 rounded-lg bg-[#fbf8f1] p-3 text-sm text-slate-600">Nenhum custo interno cadastrado.</p>}
                <CostForm eventId={detail.id} />
              </div>
            </section>
          )}

          <section className="rounded-lg border border-[#dbe3dc] bg-white p-4">
            <div>
              <h2 className="font-semibold">Cronograma operacional</h2>
              <p className="mt-1 text-sm text-slate-600">Organize horários, locais, responsáveis e observações do dia do evento.</p>
            </div>
            {timeline.length ? (
              <div className="mt-5 space-y-3">
                {timeline.map((entry) => (
                  <TimelineEntryCard
                    key={entry.id}
                    assigneeName={entry.assigned_to ? assigneeNames.get(entry.assigned_to) ?? "Usuário" : ""}
                    assignees={assignees}
                    entry={entry}
                    eventId={detail.id}
                  />
                ))}
              </div>
            ) : (
              <p className="mt-4 rounded-lg bg-[#fbf8f1] p-3 text-sm text-slate-600">Nenhuma etapa de cronograma cadastrada.</p>
            )}
            {canManageEvents && <TimelineEntryForm eventId={detail.id} assignees={assignees} />}
          </section>

          <section className="rounded-lg border border-[#dbe3dc] bg-white p-4">
            <div>
              <h2 className="font-semibold">Fornecedores</h2>
              <p className="mt-1 text-sm text-slate-600">Registre fornecedores operacionais, leads e status de confirmação.</p>
            </div>
            {vendors.length ? (
              <div className="mt-5 space-y-3">
                {vendors.map((vendor) => (
                  <VendorCard key={vendor.id} eventId={detail.id} vendor={vendor} />
                ))}
              </div>
            ) : (
              <p className="mt-4 rounded-lg bg-[#fbf8f1] p-3 text-sm text-slate-600">Nenhum fornecedor cadastrado.</p>
            )}
            {canManageEvents && <VendorForm eventId={detail.id} />}
          </section>

          <section className="rounded-lg border border-[#dbe3dc] bg-white p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold">Checklist operacional</h2>
                <p className="mt-1 text-sm text-slate-600">
                  {completedItems} de {checklist.length} itens concluídos
                </p>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100 sm:w-48">
                <div className="h-full bg-[#356451]" style={{ width: `${checklist.length ? Math.round((completedItems / checklist.length) * 100) : 0}%` }} />
              </div>
            </div>
            {checklist.length ? (
              <div className="mt-5 space-y-3">
                {checklist.map((item, index) => (
                  <ChecklistItemCard
                    key={item.id}
                    eventId={detail.id}
                    item={item}
                    assignees={assignees}
                    assigneeName={item.assigned_to ? assigneeNames.get(item.assigned_to) ?? "Usuário" : ""}
                    isFirst={index === 0}
                    isLast={index === checklist.length - 1}
                  />
                ))}
              </div>
            ) : (
              <p className="mt-4 rounded-lg bg-[#fbf8f1] p-3 text-sm text-slate-600">Nenhum item de checklist cadastrado.</p>
            )}
            {canManageEvents && <ChecklistItemForm eventId={detail.id} assignees={assignees} />}
          </section>

          <section className="rounded-lg border border-[#dbe3dc] bg-white p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="font-semibold">Documentos do evento</h2>
                <p className="mt-1 text-sm text-slate-600">Ficha operacional e contrato ficam concentrados aqui para consulta e impressão.</p>
              </div>
              {canManageEvents && <OperationalBriefForm eventId={detail.id} hasDocument={Boolean(operationalBrief)} />}
            </div>
            {operationalBrief || contractDocument ? (
              <div className="mt-5 grid gap-3">
                {operationalBrief && (
                  <DocumentCard
                    href={`/eventos/${detail.id}?ficha=1`}
                    title={operationalBrief.title}
                    updatedAt={operationalBrief.updated_at}
                    action="Abrir ficha"
                  />
                )}
                {contractDocument && (
                  <DocumentCard
                    href={`/eventos/${detail.id}?contrato=1`}
                    title={contractDocument.title}
                    updatedAt={contractDocument.updated_at}
                    action="Abrir contrato"
                  />
                )}
                {contractVersions.length > 0 && (
                  <div className="rounded-lg border border-[#edf1ee] bg-white p-4">
                    <p className="text-sm font-semibold">Histórico de versões</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {contractVersions.map((version) => (
                        <Link key={version.id} href={`/eventos/${detail.id}/contrato?versao=${version.version}`} target="_blank" className="rounded-lg border border-[#dbe3dc] px-3 py-2 text-xs font-semibold text-[#0f5f8f] hover:bg-[#eef6fb]">
                          Versão {version.version} · {contractDocumentVersionStatusLabel(version.status)}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="mt-4 rounded-lg bg-[#fbf8f1] p-3 text-sm text-slate-600">Nenhum documento gerado ainda.</p>
            )}
          </section>
        </section>

        <aside className="space-y-5">
          {canManageEvents && <ContractedEventStatusForm eventId={detail.id} status={detail.status} />}

          <section className="rounded-lg border border-[#dbe3dc] bg-white p-4">
            <h2 className="font-semibold">Histórico do evento</h2>
            {history.length ? (
              <ol className="mt-4 space-y-4">
                {history.map((entry) => (
                  <li key={entry.id} className="border-l-2 border-[#e8a849] pl-3">
                    <p className="text-sm font-medium">{historyText(entry)}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {entry.profiles?.display_name ?? "Usuário"} · {formatDateTime(entry.created_at)}
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
      {query.ficha === "1" && operationalBrief && <OperationalBriefModal eventId={detail.id} />}
      {query.contrato === "1" && contractDocument && <ContractDocumentModal eventId={detail.id} />}
    </AppShell>
  );
}

function DocumentCard({ action, href, title, updatedAt }: { action: string; href: string; title: string; updatedAt: string }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-[#edf1ee] bg-[#fbf8f1] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-semibold text-[#18352d]">{title}</p>
        <p className="mt-1 text-sm text-slate-600">Atualizado em {formatDateTime(updatedAt)}</p>
      </div>
      <Link href={href} className="rounded-lg border border-[#dbe3dc] bg-white px-4 py-2 text-sm font-semibold text-[#18352d] transition hover:bg-[#f6fbf7]">
        {action}
      </Link>
    </div>
  );
}

function contractDocumentVersionStatusLabel(status: string) {
  return ({ rascunho: "Rascunho", revisado: "Revisado", emitido: "Emitido", enviado: "Enviado", assinado: "Assinado", cancelado: "Cancelado" } as Record<string, string>)[status] ?? status;
}

function OperationalBriefModal({ eventId }: { eventId: string }) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/55 p-4">
      <div className="mx-auto flex h-full max-w-6xl flex-col overflow-hidden rounded-lg bg-white ">
        <div className="flex items-center justify-between gap-3 border-b border-[#dbe3dc] px-4 py-3">
          <div>
            <p className="font-semibold text-[#18352d]">Ficha operacional</p>
            <p className="text-xs text-slate-500">Use o botão interno para imprimir ou salvar em PDF.</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/eventos/${eventId}/ficha`} target="_blank" className="rounded-lg border border-[#dbe3dc] px-3 py-2 text-sm font-semibold text-[#18352d] hover:bg-[#f6fbf7]">
              Abrir página
            </Link>
            <Link href={`/eventos/${eventId}`} className="rounded-lg bg-[#18352d] px-3 py-2 text-sm font-semibold text-white hover:bg-[#23483d]">
              Fechar
            </Link>
          </div>
        </div>
        <iframe title="Ficha operacional" src={`/eventos/${eventId}/ficha`} className="min-h-0 flex-1 border-0" />
      </div>
    </div>
  );
}

function ContractDocumentModal({ eventId }: { eventId: string }) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/55 p-4">
      <div className="mx-auto flex h-full max-w-6xl flex-col overflow-hidden rounded-lg bg-white ">
        <div className="flex items-center justify-between gap-3 border-b border-[#dbe3dc] px-4 py-3">
          <div>
            <p className="font-semibold text-[#18352d]">Contrato</p>
            <p className="text-xs text-slate-500">Revise antes de enviar. Use a página interna para imprimir ou salvar em PDF.</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/eventos/${eventId}/contrato`} target="_blank" className="rounded-lg border border-[#dbe3dc] px-3 py-2 text-sm font-semibold text-[#18352d] hover:bg-[#f6fbf7]">
              Abrir página
            </Link>
            <Link href={`/eventos/${eventId}`} className="rounded-lg bg-[#18352d] px-3 py-2 text-sm font-semibold text-white hover:bg-[#23483d]">
              Fechar
            </Link>
          </div>
        </div>
        <iframe title="Contrato" src={`/eventos/${eventId}/contrato`} className="min-h-0 flex-1 border-0" />
      </div>
    </div>
  );
}

function eventFlowSteps({
  hasPendingChecklist,
  hasSignedContract,
  hasTimeline,
  hasVendors,
}: {
  hasPendingChecklist: boolean;
  hasSignedContract: boolean;
  hasTimeline: boolean;
  hasVendors: boolean;
}) {
  return [
    {
      label: "Contrato",
      description: hasSignedContract ? "Contrato assinado." : "Confirme envio e assinatura.",
      status: hasSignedContract ? ("done" as const) : ("current" as const),
    },
    {
      label: "Equipe",
      description: hasVendors ? "Fornecedores cadastrados." : "Cadastre fornecedores quando necessário.",
      status: hasVendors ? ("done" as const) : hasSignedContract ? ("current" as const) : ("pending" as const),
    },
    {
      label: "Cronograma",
      description: hasTimeline ? "Cronograma iniciado." : "Organize horários e responsáveis.",
      status: hasTimeline ? ("done" as const) : hasVendors ? ("current" as const) : ("pending" as const),
    },
    {
      label: "Checklist",
      description: hasPendingChecklist ? "Ainda há itens pendentes." : "Checklist concluído.",
      status: hasPendingChecklist ? ("current" as const) : ("done" as const),
    },
  ];
}

function eventNextStepTitle({
  hasPendingChecklist,
  hasSignedContract,
  hasTimeline,
  hasVendors,
  openAmount,
}: {
  hasPendingChecklist: boolean;
  hasSignedContract: boolean;
  hasTimeline: boolean;
  hasVendors: boolean;
  openAmount: number;
}) {
  if (!hasSignedContract) return "Conferir contrato";
  if (openAmount > 0) return "Acompanhar pagamentos em aberto";
  if (!hasVendors) return "Cadastrar fornecedores";
  if (!hasTimeline) return "Montar cronograma";
  if (hasPendingChecklist) return "Concluir checklist operacional";
  return "Evento operacionalmente organizado";
}

function eventNextStepDescription({
  hasPendingChecklist,
  hasSignedContract,
  hasTimeline,
  hasVendors,
  openAmount,
}: {
  hasPendingChecklist: boolean;
  hasSignedContract: boolean;
  hasTimeline: boolean;
  hasVendors: boolean;
  openAmount: number;
}) {
  if (!hasSignedContract) return "Atualize o status do contrato e registre observações importantes para a equipe.";
  if (openAmount > 0) return "Revise os pagamentos previstos, vencidos ou pendentes antes da data do evento.";
  if (!hasVendors) return "Inclua fornecedores e leads para centralizar a operação do evento.";
  if (!hasTimeline) return "Cadastre as etapas do dia do evento para orientar a equipe operacional.";
  if (hasPendingChecklist) return "Finalize os itens pendentes do checklist para reduzir risco operacional.";
  return "O evento já tem os principais blocos preenchidos. Use o histórico e a ficha operacional para acompanhamento.";
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function FinanceBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[#f6fbf7] px-4 py-3 text-right">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 font-semibold text-[#18352d]">{value}</p>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date(`${value}T00:00:00`));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function historyText(entry: EventHistory) {
  if (entry.action === "Status do evento alterado") {
    const from = typeof entry.metadata.from === "string" ? contractedEventStatusLabel(entry.metadata.from) : "status anterior";
    const to = typeof entry.metadata.to === "string" ? contractedEventStatusLabel(entry.metadata.to) : "novo status";
    return `Status: ${from} -> ${to}`;
  }
  if (entry.action === "Checklist concluído" || entry.action === "Checklist concluído" || entry.action === "Checklist reaberto") {
    const title = typeof entry.metadata.title === "string" ? `: ${entry.metadata.title}` : "";
    return `${entry.action}${title}`;
  }
  if (entry.action === "Fornecedor atualizado") {
    const name = typeof entry.metadata.name === "string" ? `: ${entry.metadata.name}` : "";
    const status = typeof entry.metadata.status === "string" ? ` (${contractedEventVendorStatusLabel(entry.metadata.status)})` : "";
    return `${entry.action}${name}${status}`;
  }
  if (entry.action === "Contrato atualizado") {
    const status = typeof entry.metadata.status === "string" ? `: ${contractedEventContractStatusLabel(entry.metadata.status)}` : "";
    return `${entry.action}${status}`;
  }
  if (entry.action === "Pagamento adicionado" || entry.action === "Pagamento atualizado" || entry.action === "Pagamento removido") {
    const status = typeof entry.metadata.status === "string" ? ` (${contractedEventPaymentStatusLabel(entry.metadata.status)})` : "";
    return `${entry.action}${status}`;
  }
  return entry.action;
}

function firstRecord<T>(value: T[] | T | null | undefined) {
  if (Array.isArray(value)) return value[0];
  return value;
}

