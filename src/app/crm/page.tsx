import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { SetupNotice } from "@/components/setup-notice";
import { requireUser } from "@/lib/auth";
import { formatCurrencyFromCents } from "@/lib/domain/quote";
import { hasSupabaseConfig } from "@/lib/supabase/config";

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
  updated_at: string;
  quote_count: number;
  latest_quote_id: string | null;
  latest_quote_status: string | null;
  latest_quote_total_cents: number | null;
};

const stages = [
  { id: "entrada", label: "Entrada", statuses: ["novo", "em_atendimento"] },
  { id: "qualificacao", label: "Qualificação", statuses: ["qualificado"] },
  { id: "orcamento", label: "Orçamento", statuses: ["orcamento_em_elaboracao"] },
  { id: "negociacao", label: "Proposta e negociação", statuses: ["proposta_enviada", "negociacao"] },
  { id: "encerrados", label: "Encerrados", statuses: ["ganho", "perdido"] },
] as const;

export default async function CrmPage({ searchParams }: { searchParams: Promise<{ busca?: string; status?: string }> }) {
  if (!hasSupabaseConfig()) return <SetupNotice />;
  const query = await searchParams;
  const { supabase, permissions } = await requireUser();
  if (!permissions.some((permission) => permission === "atendimento" || permission === "gerencia" || permission === "direcao" || permission === "admin_owner")) redirect("/painel");

  const { data, error } = await supabase.rpc("get_crm_pipeline");
  const rows = (data ?? []) as unknown as CrmRow[];
  const search = query.busca?.trim().toLocaleLowerCase("pt-BR") ?? "";
  const filtered = rows.filter((row) => {
    const matchesSearch = !search || [row.name, row.company, row.phone, row.event_type, row.source, row.responsible_name].some((value) => value?.toLocaleLowerCase("pt-BR").includes(search));
    const matchesStatus = !query.status || query.status === "todos" || row.status === query.status;
    return matchesSearch && matchesStatus;
  });
  const active = rows.filter((row) => !["ganho", "perdido"].includes(row.status)).length;
  const closed = rows.filter((row) => row.status === "ganho").length;
  const lost = rows.filter((row) => row.status === "perdido").length;
  const conversion = closed + lost ? Math.round((closed / (closed + lost)) * 100) : 0;

  return (
    <AppShell title="CRM">
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[#5f7180]">Jornada comercial dos contatos até o fechamento do evento.</p>
        <Link href="/leads/novo" className="rounded-md bg-[#083653] px-3 py-2 text-sm font-semibold text-white hover:bg-[#0f5f8f]">Novo contato</Link>
      </div>

      {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">Não foi possível carregar o CRM: {translateCrmError(error.message)}</p>}

      <section className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Contatos ativos" value={String(active)} />
        <Metric label="Propostas enviadas" value={String(rows.filter((row) => row.status === "proposta_enviada").length)} />
        <Metric label="Eventos fechados" value={String(closed)} />
        <Metric label="Conversão" value={`${conversion}%`} />
      </section>

      <form className="mt-4 grid gap-2 rounded-lg border border-[#d9ded8] bg-[#fffdf8] p-3 sm:grid-cols-[1fr_220px_auto]">
        <div>
          <label htmlFor="crm-search">Buscar contato</label>
          <input id="crm-search" name="busca" defaultValue={query.busca ?? ""} placeholder="Nome, empresa, telefone, evento ou responsável" />
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

      <section className="mt-4 overflow-x-auto pb-3" aria-label="Jornada comercial">
        <div className="grid min-w-[1080px] grid-cols-5 gap-3">
          {stages.map((stage) => {
            const contacts = filtered.filter((row) => (stage.statuses as readonly string[]).includes(row.status));
            return (
              <section key={stage.id} className="rounded-lg border border-[#d9ded8] bg-[#f7f4ed]">
                <header className="flex items-center justify-between border-b border-[#d9ded8] px-3 py-2">
                  <h2 className="text-sm font-semibold text-[#083653]">{stage.label}</h2>
                  <span className="rounded-md bg-white px-2 py-0.5 text-xs font-semibold text-[#5f7180]">{contacts.length}</span>
                </header>
                <div className="space-y-2 p-2">
                  {contacts.map((contact) => <ContactCard key={contact.id} contact={contact} />)}
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

function ContactCard({ contact }: { contact: CrmRow }) {
  return (
    <Link href={`/leads/${contact.id}`} className="block rounded-lg border border-[#d9ded8] bg-[#fffdf8] p-3 hover:border-[#0f5f8f] hover:bg-white">
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-[#092f38]">{contact.name}</p>
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${contact.status === "ganho" ? "bg-emerald-50 text-emerald-700" : contact.status === "perdido" ? "bg-red-50 text-red-700" : "bg-[#dcecf6] text-[#083653]"}`}>{statusLabel(contact.status)}</span>
      </div>
      <p className="mt-1 text-xs text-[#5f7180]">{contact.company ?? contact.phone}</p>
      <dl className="mt-3 space-y-1 text-xs">
        <Info label="Evento" value={contact.event_type ?? "Não informado"} />
        <Info label="Data" value={contact.desired_date ? formatDate(contact.desired_date) : "Sem data"} />
        <Info label="Responsável" value={contact.responsible_name ?? "Não atribuído"} />
      </dl>
      {contact.latest_quote_id && <p className="mt-3 border-t border-[#edf1ee] pt-2 text-xs font-semibold text-[#0f5f8f]">{contact.latest_quote_status ? statusLabel(contact.latest_quote_status) : "Orçamento"} · {formatCurrencyFromCents(contact.latest_quote_total_cents ?? 0)}</p>}
    </Link>
  );
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-lg border border-[#d9ded8] bg-[#fffdf8] px-3 py-2"><p className="text-xs font-semibold uppercase tracking-[0.06em] text-[#5f7180]">{label}</p><p className="mt-1 text-2xl font-semibold text-[#083653]">{value}</p></div>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="flex justify-between gap-2"><dt className="text-[#5f7180]">{label}</dt><dd className="truncate text-right font-medium text-[#092f38]">{value}</dd></div>; }
function formatDate(value: string) { const [year, month, day] = value.split("-"); return year && month && day ? `${day}/${month}/${year}` : value; }
function statusLabel(status: string) { return ({ novo: "Novo", em_atendimento: "Em atendimento", qualificado: "Qualificado", orcamento_em_elaboracao: "Orçamento", proposta_enviada: "Proposta enviada", negociacao: "Negociação", ganho: "Evento fechado", perdido: "Não avançou", rascunho: "Rascunho", em_elaboracao: "Em elaboração", enviado: "Enviado", aprovado: "Aprovado", recusado: "Recusado" } as Record<string, string>)[status] ?? status.replaceAll("_", " "); }
function translateCrmError(message: string) { return message.includes("permission denied") ? "Seu usuário não possui permissão comercial." : message.includes("get_crm_pipeline") ? "Aplique a migration do CRM no Supabase." : message; }
