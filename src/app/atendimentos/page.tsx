import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { SetupNotice } from "@/components/setup-notice";
import { conversationStatusLabel, conversationStatuses } from "@/lib/domain/conversation";
import { canManageLeads } from "@/lib/domain/lead";
import { requireUser } from "@/lib/auth";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { CreateConversationForm } from "./create-conversation-form";

type Conversation = {
  id: string;
  status: string;
  ai_paused: boolean;
  needs_human: boolean;
  assigned_to: string | null;
  created_at: string;
  assignee: { display_name: string | null } | null;
  leads: { name: string; company: string | null; phone: string; status: string } | null;
};

const statusFilters = [
  { value: "todos", label: "Todos" },
  { value: "precisa_humano", label: "Precisa humano" },
  ...conversationStatuses.map((status) => ({ value: status, label: conversationStatusLabel(status) })),
] as const;

const priorityByStatus: Record<string, number> = {
  aguardando_humano: 1,
  ia_triagem: 2,
  humano_assumiu: 3,
  encerrado: 4,
};

export default async function ConversationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[] }>;
}) {
  if (!hasSupabaseConfig()) return <SetupNotice />;

  const { status } = await searchParams;
  const activeStatus = normalizeStatusFilter(status);
  const { supabase, permissions } = await requireUser();
  const canManage = canManageLeads(permissions);

  const { data, error } = await supabase
    .from("conversations")
    .select("id,status,ai_paused,needs_human,assigned_to,created_at,assignee:profiles!conversations_assigned_to_fkey(display_name),leads(name,company,phone,status)")
    .order("created_at", { ascending: false })
    .limit(100);

  const conversations = ((data ?? []) as unknown as Conversation[]).sort(compareConversationsByPriority);
  const filteredConversations = conversations.filter((conversation) => matchesStatusFilter(conversation, activeStatus));
  const counts = countConversations(conversations);

  const { data: leads } = canManage
    ? await supabase.from("leads").select("id,name,company,phone").order("created_at", { ascending: false }).limit(50)
    : { data: [] };

  return (
    <AppShell title="Atendimentos">
      <p className="mt-2 max-w-2xl text-slate-600">
        Fila de conversas simuladas. Todo contato começa com IA em triagem; quando humano assume, a IA fica pausada naquela conversa.
      </p>

      {error && (
        <p className="mt-6 rounded-lg bg-red-50 p-3 text-sm text-red-800">
          Não foi possível carregar os atendimentos. Confira se a migration `202608120002_conversation_triage.sql` foi aplicada. Detalhe: {error.message}
        </p>
      )}

      {canManage && <CreateConversationForm leads={leads ?? []} />}

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Precisa humano" value={counts.precisa_humano} tone="danger" />
        <MetricCard label="IA em triagem" value={counts.ia_triagem} />
        <MetricCard label="Humano assumiu" value={counts.humano_assumiu} />
        <MetricCard label="Encerrados" value={counts.encerrado} />
      </section>

      <nav className="mt-6 flex flex-wrap gap-2" aria-label="Filtros de atendimentos">
        {statusFilters.map((filter) => {
          const isActive = filter.value === activeStatus;
          return (
            <Link
              key={filter.value}
              href={filter.value === "todos" ? "/atendimentos" : `/atendimentos?status=${filter.value}`}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition active:scale-[0.98] ${
                isActive
                  ? "border-[#18352d] bg-[#18352d] text-white shadow-sm"
                  : "border-[#dbe3dc] bg-white text-[#18352d] hover:border-[#b7c8bb] hover:bg-[#f6fbf7]"
              }`}
            >
              {filter.label}
              <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${isActive ? "bg-white/20" : "bg-[#edf5ee]"}`}>
                {countForFilter(counts, filter.value)}
              </span>
            </Link>
          );
        })}
      </nav>

      <section className="mt-4 overflow-hidden rounded-xl border border-[#dbe3dc] bg-white">
        {filteredConversations.length ? (
          <ul>
            {filteredConversations.map((conversation) => {
              const isPriority = needsHumanAttention(conversation);
              return (
                <li key={conversation.id} className={`border-b border-[#edf1ee] last:border-0 ${isPriority ? "border-l-4 border-l-red-400" : ""}`}>
                  <Link
                    href={`/atendimentos/${conversation.id}`}
                    className={`flex flex-col gap-3 p-4 transition active:bg-[#edf5ee] sm:flex-row sm:items-center sm:justify-between ${
                      isPriority ? "bg-red-50/60 hover:bg-red-50" : "hover:bg-[#f6fbf7]"
                    }`}
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold underline-offset-4">{conversation.leads?.name ?? "Lead sem nome"}</p>
                        {isPriority && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">Prioridade</span>}
                      </div>
                      <p className="text-sm text-slate-600">
                        {conversation.leads?.company ? `${conversation.leads.company} · ${conversation.leads.phone}` : conversation.leads?.phone}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Funil: {conversation.leads?.status.replaceAll("_", " ") ?? "não informado"} · Responsável: {conversation.assignee?.display_name ?? "não assumido"} · Criado em{" "}
                        {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(conversation.created_at))}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full bg-[#edf5ee] px-3 py-1 text-sm text-[#356451]">
                        {conversationStatusLabel(conversation.status)}
                      </span>
                      {conversation.ai_paused && <span className="rounded-full bg-[#fff5e6] px-3 py-1 text-sm text-[#744c15]">IA pausada</span>}
                      {isPriority && <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-semibold text-red-700">Precisa humano</span>}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="p-8">
            <h2 className="font-semibold">Nenhum atendimento neste filtro.</h2>
            <p className="mt-1 text-slate-600">
              {canManage ? "Crie uma conversa simulada ou escolha outro filtro." : "Quando a equipe iniciar atendimentos, eles aparecerão aqui."}
            </p>
          </div>
        )}
      </section>
    </AppShell>
  );
}

function normalizeStatusFilter(value: string | string[] | undefined): string {
  const status = Array.isArray(value) ? value[0] : value;
  if (status === "precisa_humano") return status;
  if (status && conversationStatuses.includes(status as (typeof conversationStatuses)[number])) return status;
  return "todos";
}

function matchesStatusFilter(conversation: Conversation, status: string) {
  if (status === "todos") return true;
  if (status === "precisa_humano") return needsHumanAttention(conversation);
  return conversation.status === status;
}

function compareConversationsByPriority(left: Conversation, right: Conversation) {
  const leftPriority = needsHumanAttention(left) ? 0 : priorityByStatus[left.status] ?? 5;
  const rightPriority = needsHumanAttention(right) ? 0 : priorityByStatus[right.status] ?? 5;
  if (leftPriority !== rightPriority) return leftPriority - rightPriority;
  return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
}

function countConversations(conversations: Conversation[]) {
  return conversations.reduce(
    (totals, conversation) => {
      totals.todos += 1;
      if (needsHumanAttention(conversation)) totals.precisa_humano += 1;
      if (conversation.status in totals) totals[conversation.status as keyof typeof totals] += 1;
      return totals;
    },
    { todos: 0, precisa_humano: 0, ia_triagem: 0, aguardando_humano: 0, humano_assumiu: 0, encerrado: 0 },
  );
}

function needsHumanAttention(conversation: Conversation) {
  return conversation.status !== "encerrado" && (conversation.needs_human || conversation.status === "aguardando_humano");
}

function countForFilter(counts: ReturnType<typeof countConversations>, filter: string) {
  if (filter in counts) return counts[filter as keyof typeof counts];
  return 0;
}

function MetricCard({ label, value, tone = "default" }: { label: string; value: number; tone?: "default" | "danger" }) {
  return (
    <div className={`rounded-xl border p-4 ${tone === "danger" ? "border-red-100 bg-red-50" : "border-[#dbe3dc] bg-white"}`}>
      <p className={`text-sm ${tone === "danger" ? "text-red-700" : "text-slate-500"}`}>{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${tone === "danger" ? "text-red-800" : "text-[#18352d]"}`}>{value}</p>
    </div>
  );
}
