import Link from "next/link";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { SetupNotice } from "@/components/setup-notice";
import { conversationStatusLabel } from "@/lib/domain/conversation";
import { canManageLeads, defaultEventTypes, defaultLeadSources } from "@/lib/domain/lead";
import { formatCurrencyFromCents, quoteStatusLabel } from "@/lib/domain/quote";
import { requireUser } from "@/lib/auth";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { assumeConversation, closeConversation, requestHumanHandoff, transferConversation } from "../actions";
import { LeadQuickEditForm, LeadStatusForm } from "./lead-quick-edit";
import { CustomerMessageForm, HumanReplyForm } from "./message-form";
import { createQuoteFromLead } from "@/app/orcamentos/actions";
import { QuoteModal } from "./quote-modal";

type ConversationDetail = {
  id: string;
  channel: string;
  status: string;
  ai_paused: boolean;
  needs_human: boolean;
  assigned_to: string | null;
  external_contact_id: string | null;
  external_phone_number_id: string | null;
  assignee: { display_name: string | null } | null;
  leads: {
    id: string;
    name: string;
    company: string | null;
    phone: string;
    source: string | null;
    status: string;
    event_type: string | null;
    desired_date: string | null;
    guest_count: number | null;
    notes: string | null;
    lead_history: LeadHistoryEntry[] | null;
    quotes: QuoteSummary[] | null;
  } | null;
};

type LeadHistoryEntry = {
  id: string;
  action: string;
  created_at: string;
  metadata: Record<string, unknown>;
  profiles: { display_name: string | null } | null;
};

type Message = {
  id: string;
  author: string;
  body: string;
  created_at: string;
  profiles: { display_name: string | null } | null;
  isHistory?: boolean;
};

type HistoryMessage = {
  id: string;
  direction: "inbound" | "outbound";
  body: string;
  external_created_at: string;
};

type StaffRow = {
  id: string;
  display_name: string | null;
  is_active: boolean;
  user_permissions: { permission: string }[] | null;
};

type QuoteSummary = {
  id: string;
  title: string;
  status: string;
  total_amount_cents: number;
  created_at: string;
};

const actionErrorMessages: Record<string, string> = {
  handoff: "Não foi possível sinalizar humano. Confira suas permissões e tente novamente.",
  handoff_message: "O status foi alterado, mas não foi possível registrar a mensagem de sistema.",
  assume: "Não foi possível assumir o atendimento. Confira suas permissões e tente novamente.",
  assume_message: "O atendimento foi assumido, mas não foi possível registrar a mensagem de sistema.",
  close: "Não foi possível encerrar o atendimento. Confira suas permissões e tente novamente.",
  close_message: "O atendimento foi encerrado, mas não foi possível registrar a mensagem de sistema.",
};

export default async function ConversationDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; orcamento?: string | string[] }> }) {
  if (!hasSupabaseConfig()) return <SetupNotice />;

  const { id } = await params;
  const { error: actionError, orcamento } = await searchParams;
  const selectedQuoteId = Array.isArray(orcamento) ? orcamento[0] : orcamento;
  const { supabase, permissions } = await requireUser();
  const canManage = canManageLeads(permissions);

  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .select("id,channel,status,ai_paused,needs_human,assigned_to,external_contact_id,external_phone_number_id,assignee:profiles!conversations_assigned_to_fkey(display_name),leads(id,name,company,phone,source,status,event_type,desired_date,guest_count,notes,lead_history(id,action,metadata,created_at,profiles(display_name)),quotes(id,title,status,total_amount_cents,created_at))")
    .eq("id", id)
    .maybeSingle();

  if (conversationError) {
    return (
      <AppShell title="Atendimento indisponível">
        <Link href="/atendimentos" className="text-sm font-semibold text-[#356451] underline">
          ← Voltar à fila
        </Link>
        <div className="mt-6 rounded-xl border border-red-100 bg-red-50 p-5 text-red-800">
          <h2 className="font-semibold">Não foi possível carregar esta conversa.</h2>
          <p className="mt-2 text-sm">
            A conversa pode existir no banco, mas a consulta foi recusada ou retornou um erro de relacionamento/RLS.
          </p>
          <p className="mt-3 rounded-lg bg-white/70 p-3 text-xs">{conversationError.message}</p>
        </div>
      </AppShell>
    );
  }

  if (!conversation) notFound();

  const detail = conversation as unknown as ConversationDetail;
  const { data: options } = await supabase.from("option_catalog").select("kind,name").eq("is_active", true).order("sort_order").order("name");
  const eventTypes = options?.filter((option) => option.kind === "event_type") ?? defaultEventTypes.map((name) => ({ name }));
  const leadSources = options?.filter((option) => option.kind === "lead_source") ?? defaultLeadSources.map((name) => ({ name }));
  const { data: responseTemplates } = await supabase.from("response_templates").select("title,body").eq("is_active", true).order("sort_order").order("title");
  const { data: staffRows } = canManage
    ? await supabase.from("profiles").select("id,display_name,is_active,user_permissions(permission)").eq("is_active", true).order("display_name")
    : { data: [] };
  const staff = ((staffRows ?? []) as unknown as StaffRow[]).filter((row) => row.user_permissions?.some((permission) => permission.permission === "atendimento" || permission.permission === "admin_owner"));
  const { data: messages, error: messagesError } = await supabase
    .from("conversation_messages")
    .select("id,author,body,created_at,profiles(display_name)")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });
  const { data: historyMessages, error: historyError } = detail.external_contact_id && detail.external_phone_number_id
    ? await supabase
      .from("whatsapp_history_messages")
      .select("id,direction,body,external_created_at")
      .eq("phone_number_id", detail.external_phone_number_id)
      .eq("contact_whatsapp_id", detail.external_contact_id)
      .order("external_created_at", { ascending: true })
    : { data: [], error: null };
  const importedRows = ((historyMessages ?? []) as HistoryMessage[]).map((message): Message => ({
    id: `history-${message.id}`,
    author: message.direction === "inbound" ? "cliente" : "humano",
    body: message.body,
    created_at: message.external_created_at,
    profiles: null,
    isHistory: true,
  }));
  const messageRows = ([...importedRows, ...((messages ?? []) as unknown as Message[])])
    .sort((left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime());
  const isClosed = detail.status === "encerrado";
  const leadHistory = [...(detail.leads?.lead_history ?? [])].sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime()).slice(0, 6);
  const leadChecklist = buildLeadChecklist(detail.leads);
  const missingItems = leadChecklist.filter((item) => !item.complete);
  const quotes = [...(detail.leads?.quotes ?? [])].sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime()).slice(0, 4);

  return (
    <AppShell title={`Atendimento · ${detail.leads?.name ?? "Lead"}`}>
      <Link href="/atendimentos" className="text-sm font-semibold text-[#356451] underline">
        ← Voltar à fila
      </Link>

      {messagesError && (
        <p className="mt-6 rounded-lg bg-red-50 p-3 text-sm text-red-800">
          Não foi possível carregar as mensagens desta conversa. Detalhe: {messagesError.message}
        </p>
      )}

      {historyError && (
        <p className="mt-6 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          As mensagens atuais foram carregadas, mas o histórico anterior do WhatsApp não pôde ser consultado.
        </p>
      )}

      {actionError && actionErrorMessages[actionError] && (
        <p className="mt-6 rounded-lg bg-red-50 p-3 text-sm text-red-800">{actionErrorMessages[actionError]}</p>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <section className="rounded-xl border border-[#dbe3dc] bg-white p-5 lg:col-span-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#edf5ee] px-3 py-1 text-sm text-[#356451]">
              {conversationStatusLabel(detail.status)}
            </span>
            {detail.ai_paused && <span className="rounded-full bg-[#fff5e6] px-3 py-1 text-sm text-[#744c15]">IA pausada</span>}
            {detail.needs_human && <span className="rounded-full bg-red-50 px-3 py-1 text-sm text-red-700">Precisa humano</span>}
            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">
              Responsável: {detail.assignee?.display_name ?? "não assumido"}
            </span>
            <span className="rounded-full bg-[#dcecf6] px-3 py-1 text-sm text-[#083653]">{detail.channel === "whatsapp_cloud" ? "WhatsApp oficial" : "Simulação"}</span>
          </div>

          <ol className="mt-6 max-h-[620px] space-y-4 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/40 p-3 pr-2">
            {messageRows.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
          </ol>

          {canManage && (
            <div className="mt-6 grid gap-4 xl:grid-cols-2">
              <HumanReplyForm conversationId={id} disabled={isClosed} templates={responseTemplates ?? []} />
              {detail.channel !== "whatsapp_cloud" && <CustomerMessageForm conversationId={id} disabled={isClosed} />}
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <SidebarToggle title="Lead" defaultOpen>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-slate-500">Lead</dt>
                <dd>{detail.leads?.phone}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Empresa</dt>
                <dd>{detail.leads?.company ?? "Não informada"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Status comercial</dt>
                <dd>{detail.leads?.status.replaceAll("_", " ")}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Origem</dt>
                <dd>{detail.leads?.source ?? "Não informada"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Evento</dt>
                <dd>{detail.leads?.event_type ?? "Não informado"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Data</dt>
                <dd>{detail.leads?.desired_date ?? "Não informada"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Convidados</dt>
                <dd>{detail.leads?.guest_count ?? "Não informado"}</dd>
              </div>
            </dl>
            {detail.leads?.notes && <p className="mt-4 whitespace-pre-wrap border-t border-slate-100 pt-4 text-sm text-slate-700">{detail.leads.notes}</p>}
          </SidebarToggle>

          <SidebarToggle title="Dados necessários" defaultOpen>
            <p className={`mt-2 rounded-lg p-3 text-sm ${missingItems.length ? "bg-[#fff5e6] text-[#744c15]" : "bg-[#edf5ee] text-[#356451]"}`}>
              {missingItems.length ? `Faltam ${missingItems.length} dado(s): ${missingItems.map((item) => item.label.toLowerCase()).join(", ")}.` : "Dados mínimos completos para qualificar."}
            </p>
            <ul className="mt-4 space-y-2">
              {leadChecklist.map((item) => (
                <li key={item.label} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-slate-700">{item.label}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${item.complete ? "bg-[#edf5ee] text-[#356451]" : "bg-[#fff5e6] text-[#744c15]"}`}>
                    {item.complete ? "✓" : "faltando"}
                  </span>
                </li>
              ))}
            </ul>
          </SidebarToggle>

          {canManage && detail.leads && (
            <>
              <LeadStatusForm conversationId={id} lead={detail.leads} />
              <LeadQuickEditForm conversationId={id} lead={detail.leads} eventTypes={eventTypes} leadSources={leadSources} />
            </>
          )}

          <SidebarToggle title="Orçamentos" defaultOpen>
            {canManage && detail.leads && (
              <form action={createQuoteFromLead}>
                <input type="hidden" name="leadId" value={detail.leads.id} />
                <input type="hidden" name="returnTo" value={`/atendimentos/${id}?orcamento=`} />
                <button className="text-sm font-semibold text-[#356451] underline underline-offset-4">Criar</button>
              </form>
            )}
            {quotes.length ? (
              <ul className="mt-4 space-y-3">
                {quotes.map((quote) => (
                  <li key={quote.id}>
                    <Link href={`/atendimentos/${id}?orcamento=${quote.id}`} className="block rounded-lg border border-[#edf1ee] bg-white p-3 transition hover:border-[#c7d8ce] hover:bg-[#f6fbf7]">
                      <span className="text-sm font-semibold underline underline-offset-4">
                      {quote.title}
                      </span>
                      <span className="mt-1 block text-xs text-slate-500">
                        {quoteStatusLabel(quote.status)} · {formatCurrencyFromCents(quote.total_amount_cents)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-slate-600">Ainda não há orçamento para este lead.</p>
            )}
          </SidebarToggle>

          <SidebarToggle title="Histórico do lead">
            <div className="flex items-center justify-between gap-3">
              {detail.leads && <Link href={`/leads/${detail.leads.id}`} className="text-xs font-semibold text-[#356451] underline">Ver lead</Link>}
            </div>
            {leadHistory.length ? (
              <ol className="mt-4 space-y-4">
                {leadHistory.map((entry) => (
                  <li key={entry.id} className="border-l-2 border-[#e8a849] pl-3">
                    <p className="text-sm font-medium">{historyText(entry)}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {entry.profiles?.display_name ?? "Usuário"} · {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(entry.created_at))}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-3 text-sm text-slate-600">Ainda não há histórico registrado para este lead.</p>
            )}
          </SidebarToggle>

          {canManage && (
            <SidebarToggle title="Ações" defaultOpen>
              <div className="mt-4 space-y-3">
                {detail.status === "ia_triagem" && (
                  <form action={requestHumanHandoff}>
                    <input type="hidden" name="conversationId" value={id} />
                    <input type="hidden" name="reason" value="Sinalização manual da equipe." />
                    <button className="w-full rounded-lg border border-[#dbe3dc] px-4 py-3 font-semibold text-[#18352d] transition hover:border-[#b7c8bb] hover:bg-[#f6fbf7] active:scale-[0.99] active:bg-[#edf5ee]">
                      Sinalizar humano
                    </button>
                  </form>
                )}
                {detail.status !== "humano_assumiu" && detail.status !== "encerrado" && (
                  <form action={assumeConversation}>
                    <input type="hidden" name="conversationId" value={id} />
                    <button className="w-full rounded-lg bg-[#18352d] px-4 py-3 font-semibold text-white shadow-sm transition hover:bg-[#23483d] hover:shadow active:scale-[0.99] active:bg-[#102820]">
                      Assumir atendimento
                    </button>
                  </form>
                )}
                {detail.status !== "encerrado" && (
                  <form action={closeConversation}>
                    <input type="hidden" name="conversationId" value={id} />
                    <button className="w-full rounded-lg border border-[#dbe3dc] px-4 py-3 font-semibold text-[#18352d] transition hover:border-[#b7c8bb] hover:bg-[#f6fbf7] active:scale-[0.99] active:bg-[#edf5ee]">
                      Encerrar
                    </button>
                  </form>
                )}
                {detail.status !== "encerrado" && staff.length > 0 && (
                  <form action={transferConversation} className="border-t border-slate-100 pt-3">
                    <input type="hidden" name="conversationId" value={id} />
                    <label htmlFor="assigneeId">Transferir para</label>
                    <select id="assigneeId" name="assigneeId" defaultValue={detail.assigned_to ?? ""} required className="mt-1">
                      <option value="">Selecione</option>
                      {staff.map((person) => (
                        <option key={person.id} value={person.id}>
                          {person.display_name ?? "Usuário"}
                        </option>
                      ))}
                    </select>
                    <button className="mt-3 w-full rounded-lg border border-[#dbe3dc] px-4 py-3 font-semibold text-[#18352d] transition hover:border-[#b7c8bb] hover:bg-[#f6fbf7] active:scale-[0.99] active:bg-[#edf5ee]">
                      Transferir atendimento
                    </button>
                  </form>
                )}
              </div>
            </SidebarToggle>
          )}
        </aside>
      </div>
      {selectedQuoteId && <QuoteModal quoteId={selectedQuoteId} closeHref={`/atendimentos/${id}`} />}
    </AppShell>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const config = messageStyle(message.author);
  return (
    <li className={`flex ${config.align}`}>
      <article className={`max-w-[92%] rounded-lg border p-3 lg:max-w-[78%] ${config.className}`}>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${config.badgeClassName}`}>{config.label}</span>
          {message.profiles?.display_name && <span className="text-xs text-slate-500">{message.profiles.display_name}</span>}
          {message.isHistory && <span className="text-xs text-slate-500">Histórico importado</span>}
        </div>
        <p className="mt-3 whitespace-pre-wrap text-slate-800">{message.body}</p>
        <p className="mt-3 text-xs text-slate-500">
          {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(message.created_at))}
        </p>
      </article>
    </li>
  );
}

function messageStyle(author: string) {
  if (author === "cliente") {
    return {
      align: "justify-start",
      label: "Contato",
      className: "border-[#dbe3dc] bg-white",
      badgeClassName: "bg-slate-100 text-slate-700",
    };
  }
  if (author === "ia") {
    return {
      align: "justify-start",
      label: "IA",
      className: "border-[#d8eadc] bg-[#f6fbf7]",
      badgeClassName: "bg-[#edf5ee] text-[#356451]",
    };
  }
  if (author === "humano") {
    return {
      align: "justify-end",
      label: "Atendente",
      className: "border-[#c7d8ce] bg-[#edf5ee]",
      badgeClassName: "bg-[#18352d] text-white",
    };
  }
  return {
    align: "justify-center",
    label: "Sistema",
    className: "border-[#f0dfbd] bg-[#fffaf0]",
    badgeClassName: "bg-[#fff1d2] text-[#744c15]",
  };
}

function historyText(entry: LeadHistoryEntry) {
  if (entry.action === "Status comercial alterado") {
    const from = typeof entry.metadata.from === "string" ? entry.metadata.from.replaceAll("_", " ") : "status anterior";
    const to = typeof entry.metadata.to === "string" ? entry.metadata.to.replaceAll("_", " ") : "novo status";
    return `Status comercial: ${from} → ${to}`;
  }
  return entry.action;
}

function SidebarToggle({ children, defaultOpen = false, title }: { children: ReactNode; defaultOpen?: boolean; title: string }) {
  return (
    <details open={defaultOpen} className="group rounded-xl border border-[#dbe3dc] bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5 font-semibold text-[#18352d] transition hover:bg-[#f6fbf7]">
        <span>{title}</span>
        <span className="grid h-7 w-7 place-items-center rounded-full border border-[#dbe3dc] text-sm text-[#356451] transition group-open:rotate-180">⌄</span>
      </summary>
      <div className="border-t border-[#edf1ee] px-5 pb-5 pt-1">{children}</div>
    </details>
  );
}

function buildLeadChecklist(lead: ConversationDetail["leads"]) {
  return [
    { label: "Nome", complete: Boolean(lead?.name?.trim()) },
    { label: "Telefone", complete: Boolean(lead?.phone?.trim()) },
    { label: "Origem", complete: Boolean(lead?.source?.trim()) },
    { label: "Tipo de evento", complete: Boolean(lead?.event_type?.trim()) },
    { label: "Data desejada", complete: Boolean(lead?.desired_date) },
    { label: "Convidados", complete: Boolean(lead?.guest_count) },
  ];
}
