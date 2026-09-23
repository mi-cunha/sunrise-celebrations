import Link from "next/link";
import type { CSSProperties } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { SetupNotice } from "@/components/setup-notice";
import { requireUser } from "@/lib/auth";
import { formatCurrencyFromCents } from "@/lib/domain/quote";
import { canManageLeads, isOverdueFollowUp } from "@/lib/domain/lead";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { LeadStageForm } from "@/app/leads/[id]/lead-stage-form";

type CrmRow = {
  id: string;
  name: string;
  company: string | null;
  phone: string;
  source: string | null;
  event_type: string | null;
  desired_date: string | null;
  guest_count: number | null;
  status: string;
  responsible_name: string | null;
  next_action: string | null;
  next_action_at: string | null;
  next_action_assignee_name: string | null;
  updated_at: string;
  quote_count: number;
  latest_quote_id: string | null;
  latest_quote_status: string | null;
  latest_quote_total_cents: number | null;
};

const stages = [
  { id: "novo", label: "Novo lead", statuses: ["novo"] },
  { id: "qualificacao", label: "Qualificação", statuses: ["em_atendimento", "qualificado"] },
  { id: "visita", label: "Visita agendada", statuses: ["visita_agendada"] },
  { id: "proposta", label: "Proposta enviada", statuses: ["orcamento_em_elaboracao", "proposta_enviada"] },
  { id: "negociacao", label: "Negociação", statuses: ["negociacao"] },
  { id: "fechado", label: "Fechado", statuses: ["ganho"] },
  { id: "perdido", label: "Perdido", statuses: ["perdido"] },
] as const;

export default async function CrmPage({ searchParams }: { searchParams: Promise<{ busca?: string; status?: string; followup?: string }> }) {
  if (!hasSupabaseConfig()) return <SetupNotice />;
  const query = await searchParams;
  const { supabase, permissions } = await requireUser();
  if (!permissions.some((permission) => permission === "atendimento" || permission === "gerencia" || permission === "direcao" || permission === "admin_owner")) redirect("/painel");

  const { data, error } = await supabase.rpc("get_crm_pipeline");
  const rows = (data ?? []) as unknown as CrmRow[];
  const today = brazilToday();
  const search = query.busca?.trim().toLocaleLowerCase("pt-BR") ?? "";
  const filtered = rows.filter((row) => {
    const matchesSearch = !search || [row.name, row.company, row.phone, row.event_type, row.source, row.responsible_name].some((value) => value?.toLocaleLowerCase("pt-BR").includes(search));
    const matchesStatus = !query.status || query.status === "todos" || row.status === query.status;
    const isOverdue = Boolean(row.next_action_at && isOverdueFollowUp(row.next_action_at, today));
    const matchesFollowUp = !query.followup || query.followup === "todos" || (query.followup === "vencidos" && isOverdue) || (query.followup === "hoje" && row.next_action_at === today) || (query.followup === "proximos" && Boolean(row.next_action_at && row.next_action_at > today)) || (query.followup === "agendados" && Boolean(row.next_action_at) && !isOverdue) || (query.followup === "sem_acao" && !row.next_action_at);
    return matchesSearch && matchesStatus && matchesFollowUp;
  });
  const active = rows.filter((row) => !["ganho", "perdido"].includes(row.status)).length;
  const closed = rows.filter((row) => row.status === "ganho").length;
  const lost = rows.filter((row) => row.status === "perdido").length;
  const conversion = closed + lost ? Math.round((closed / (closed + lost)) * 100) : 0;
  const overdue = rows.filter((row) => Boolean(row.next_action_at && isOverdueFollowUp(row.next_action_at, today))).length;
  const todayFollowUps = rows.filter((row) => row.next_action_at === today).length;
  const upcomingFollowUps = rows.filter((row) => Boolean(row.next_action_at && row.next_action_at > today)).length;

  return (
    <AppShell title="Funil comercial">
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[#5f7180]">Jornada comercial dos contatos até o fechamento do evento.</p>
        <Link href="/leads/novo" className="workspace-button">+ Novo contato</Link>
      </div>

      {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">Não foi possível carregar o CRM: {translateCrmError(error.message)}</p>}

      <section className="crm-metrics" aria-label="Resumo comercial">
        <Metric label="Leads recebidos" value={String(rows.length)} />
        <Metric label="Contatos ativos" value={String(active)} />
        <Metric label="Visitas agendadas" value={String(rows.filter((row) => row.status === "visita_agendada").length)} />
        <Metric label="Propostas enviadas" value={String(rows.filter((row) => row.status === "proposta_enviada").length)} />
        <Metric label="Eventos fechados" value={String(closed)} />
        <Metric label="Conversão" value={`${conversion}%`} />
        <Metric label="Follow-ups vencidos" value={String(overdue)} />
      </section>

      <section className="mt-3 flex flex-wrap gap-2" aria-label="Filas de follow-up">
        <QueueLink href="/crm?followup=hoje" label="Follow-ups de hoje" value={todayFollowUps} />
        <QueueLink href="/crm?followup=vencidos" label="Atrasados" value={overdue} tone="danger" />
        <QueueLink href="/crm?followup=proximos" label="Próximos" value={upcomingFollowUps} />
      </section>

      <form className="crm-filters">
        <div>
          <label htmlFor="crm-search">Buscar contato</label>
          <input id="crm-search" name="busca" defaultValue={query.busca ?? ""} placeholder="Nome, empresa, telefone, evento ou responsável" />
        </div>
        <div>
          <label htmlFor="crm-follow-up">Acompanhamento</label>
          <select id="crm-follow-up" name="followup" defaultValue={query.followup ?? "todos"}>
            <option value="todos">Todos</option>
            <option value="vencidos">Follow-up vencido</option>
            <option value="hoje">Follow-ups de hoje</option>
            <option value="proximos">Próximos follow-ups</option>
            <option value="agendados">Próxima ação agendada</option>
            <option value="sem_acao">Sem próxima ação</option>
          </select>
        </div>
        <div>
          <label htmlFor="crm-status">Status</label>
          <select id="crm-status" name="status" defaultValue={query.status ?? "todos"}>
            <option value="todos">Todos</option>
            {stages.flatMap((stage) => stage.statuses).map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
          </select>
        </div>
        <button className="self-end rounded-md bg-[#0f5f8f] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#083653]">Filtrar</button>
      </form>

      <div className="crm-board-heading"><h2>Jornada dos leads <span className="ml-2 text-xs font-normal text-slate-500">{filtered.length} contatos</span></h2><span>Role para explorar as etapas →</span></div>
      {!filtered.length && <p className="mb-4 rounded-lg border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-600">{rows.length ? "Nenhum contato corresponde aos filtros." : "Seu funil está pronto para receber o primeiro contato."} <Link href={rows.length ? "/crm" : "/leads/novo"} className="ml-2 font-semibold text-[#0f5f8f] underline">{rows.length ? "Limpar filtros" : "Cadastrar contato"}</Link></p>}
      <section aria-label="Jornada comercial">
        <div className="crm-board" tabIndex={0} role="region" aria-label="Etapas do funil; use as setas para rolar">
          {stages.map((stage, index) => {
            const contacts = filtered.filter((row) => (stage.statuses as readonly string[]).includes(row.status));
            return (
              <section key={stage.id} className="crm-column" style={{ "--stage-color": ["#7d94b0", "#8d82b8", "#c29b52", "#6593b8", "#b58564", "#569b7d", "#b87980"][index] } as CSSProperties}>
                <header className="crm-column-header">
                  <h2 className="text-sm font-semibold text-[#083653]">{stage.label}</h2>
                  <span className="rounded-md bg-white px-2 py-0.5 text-xs font-semibold text-[#5f7180]">{contacts.length}</span>
                </header>
                <div className="space-y-2 p-2">
                  {contacts.map((contact) => <ContactCard key={contact.id} contact={contact} canManage={canManageLeads(permissions)} />)}
                  {!contacts.length && <p className="rounded-md border border-dashed border-[#d9ded8] px-2 py-4 text-center text-xs text-[#5f7180]">Nenhum contato</p>}
                </div>
              </section>
            );
          })}
        </div>
      </section>
    </AppShell>
  );
}

function ContactCard({ canManage, contact }: { canManage: boolean; contact: CrmRow }) {
  return (
    <article className="crm-card">
      <Link href={`/leads/${contact.id}`} className="block">
      <div className="flex items-start justify-between gap-2">
        <p className="break-words text-sm font-semibold text-[#092f38]">{contact.name}</p>
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${contact.status === "ganho" ? "bg-emerald-50 text-emerald-700" : contact.status === "perdido" ? "bg-red-50 text-red-700" : "bg-[#dcecf6] text-[#083653]"}`}>{statusLabel(contact.status)}</span>
      </div>
      <p className="mt-1 text-xs text-[#5f7180]">{contact.company ?? contact.phone}</p>
      <dl className="mt-3 space-y-1 text-xs">
        <Info label="Evento" value={contact.event_type ?? "Não informado"} />
        <Info label="Data" value={contact.desired_date ? formatDate(contact.desired_date) : "Sem data"} />
        <Info label="Responsável" value={contact.responsible_name ?? "Não atribuído"} />
        <Info label="Próxima ação" value={contact.next_action_at ? `${formatDate(contact.next_action_at)} · ${contact.next_action_assignee_name ?? "Sem responsável"}` : "Não definida"} />
      </dl>
      {contact.next_action && <p className={`mt-3 rounded-md px-2 py-1 text-xs font-medium ${isOverdueFollowUp(contact.next_action_at ?? "9999-12-31", brazilToday()) ? "bg-red-50 text-red-800" : "bg-[#edf5ee] text-[#356451]"}`}>{contact.next_action}</p>}
      {contact.latest_quote_id && <p className="mt-3 border-t border-[#edf1ee] pt-2 text-xs font-semibold text-[#0f5f8f]">{contact.latest_quote_status ? statusLabel(contact.latest_quote_status) : "Orçamento"} · {formatCurrencyFromCents(contact.latest_quote_total_cents ?? 0)}</p>}
      </Link>
      {canManage && <details className="mt-3 border-t border-[#edf1ee] pt-2"><summary className="cursor-pointer text-xs font-semibold text-[#356451]">Mover no funil</summary><div className="mt-2"><LeadStageForm leadId={contact.id} status={contact.status} /></div></details>}
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="crm-metric"><p>{label}</p><strong>{value}</strong></div>; }
function QueueLink({ href, label, tone = "normal", value }: { href: string; label: string; tone?: "normal" | "danger"; value: number }) { return <Link href={href} className={`rounded-md border px-3 py-2 text-sm font-semibold ${tone === "danger" ? "border-red-200 bg-red-50 text-red-800" : "border-[#d9ded8] bg-[#fffdf8] text-[#083653]"}`}>{label}: {value}</Link>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="flex justify-between gap-2"><dt className="text-[#5f7180]">{label}</dt><dd className="truncate text-right font-medium text-[#092f38]">{value}</dd></div>; }
function formatDate(value: string) { const [year, month, day] = value.split("-"); return year && month && day ? `${day}/${month}/${year}` : value; }
function brazilToday() {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
function statusLabel(status: string) { return ({ novo: "Novo lead", em_atendimento: "Qualificação", qualificado: "Qualificação", visita_agendada: "Visita agendada", orcamento_em_elaboracao: "Proposta enviada", proposta_enviada: "Proposta enviada", negociacao: "Negociação", ganho: "Fechado", perdido: "Perdido", rascunho: "Rascunho", em_elaboracao: "Em elaboração", enviado: "Enviado", aprovado: "Aprovado", recusado: "Recusado" } as Record<string, string>)[status] ?? status.replaceAll("_", " "); }
function translateCrmError(message: string) { return message.includes("permission denied") ? "Seu usuário não possui permissão comercial." : message.includes("get_crm_pipeline") ? "Aplique a migration do CRM no Supabase." : message; }
