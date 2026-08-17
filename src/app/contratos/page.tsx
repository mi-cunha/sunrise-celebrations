import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { SetupNotice } from "@/components/setup-notice";
import { requireUser } from "@/lib/auth";
import { contractedEventContractStatusLabel, contractedEventStatusLabel } from "@/lib/domain/contracted-event";
import { formatCurrencyFromCents } from "@/lib/domain/quote";
import { hasSupabaseConfig } from "@/lib/supabase/config";

type ContractRow = {
  id: string;
  status: string;
  signed_at: string | null;
  notes: string | null;
  updated_at: string;
};

type ContractDocumentRow = {
  id: string;
  document_type: string;
  title: string;
  updated_at: string;
};

type ContractedEventRow = {
  id: string;
  title: string;
  status: string;
  event_type: string | null;
  event_date: string | null;
  guest_count: number | null;
  leads: { name: string; phone: string } | null;
  quotes: { total_amount_cents: number } | null;
  contracted_event_contracts: ContractRow[] | ContractRow | null;
  contracted_event_documents: ContractDocumentRow[];
};

export default async function ContractsPage() {
  if (!hasSupabaseConfig()) return <SetupNotice />;

  const { supabase, permissions } = await requireUser();
  const canSeeContracts = permissions.some((permission) => permission === "financeiro" || permission === "gerencia" || permission === "admin_owner");

  if (!canSeeContracts) {
    return (
      <AppShell title="Contratos">
        <section className="mt-4 rounded-lg border border-[#d9ded8] bg-[#fffdf8] p-4">
          <h2 className="font-semibold text-[#092f38]">Acesso restrito</h2>
          <p className="mt-1 text-sm text-[#5f7180]">Contratos ficam disponíveis para financeiro, gerência e administração.</p>
        </section>
      </AppShell>
    );
  }

  const { data } = await supabase
    .from("contracted_events")
    .select("id,title,status,event_type,event_date,guest_count,leads(name,phone),quotes(total_amount_cents),contracted_event_contracts(id,status,signed_at,notes,updated_at),contracted_event_documents(id,document_type,title,updated_at)")
    .order("event_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  const events = ((data ?? []) as unknown as ContractedEventRow[]).filter((event) => event.status !== "cancelado");
  const rows = events.map((event) => ({ event, contract: firstRecord(event.contracted_event_contracts), document: event.contracted_event_documents?.find((document) => document.document_type === "contrato") }));
  const pending = rows.filter((row) => !row.contract || row.contract.status === "pendente").length;
  const sent = rows.filter((row) => row.contract?.status === "enviado").length;
  const signed = rows.filter((row) => row.contract?.status === "assinado").length;
  const attention = rows.filter((row) => !row.contract || row.contract.status === "pendente" || row.contract.status === "enviado");

  return (
    <AppShell title="Contratos">
      <section className="mt-4 grid gap-2 md:grid-cols-4">
        <Metric label="Pendentes" value={pending} tone={pending ? "warning" : "neutral"} />
        <Metric label="Enviados" value={sent} />
        <Metric label="Assinados" value={signed} tone="success" />
        <Metric label="A acompanhar" value={attention.length} tone={attention.length ? "warning" : "neutral"} />
      </section>

      <section className="mt-4 rounded-lg border border-[#d9ded8] bg-[#fffdf8]">
        <div className="border-b border-[#d9ded8] px-3 py-2">
          <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-[#083653]">Contratos de eventos</h2>
        </div>

        {rows.length ? (
          <ul className="divide-y divide-[#d9ded8]">
            {rows.map(({ contract, document, event }) => {
              const contractStatus = contract?.status ?? "pendente";
              return (
                <li key={event.id}>
                  <Link href={document ? `/eventos/${event.id}?contrato=1` : `/eventos/${event.id}`} className="grid gap-3 px-3 py-3 hover:bg-[#dcecf6]/45 md:grid-cols-[1fr_auto] md:items-center">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-[#092f38]">{event.title}</h3>
                        <StatusPill status={contractStatus}>{contractedEventContractStatusLabel(contractStatus)}</StatusPill>
                      </div>
                      <p className="mt-1 text-sm text-[#5f7180]">
                        {event.leads?.name ?? "Contato não informado"} · {event.event_type ?? "Evento"} · {formatDate(event.event_date)}
                      </p>
                      <p className="mt-1 text-xs text-[#5f7180]">
                        Evento: {contractedEventStatusLabel(event.status)}
                        {contract?.signed_at ? ` · Assinado em ${formatDate(contract.signed_at)}` : ""}
                        {document ? ` · Documento gerado em ${formatDateTime(document.updated_at)}` : " · Documento não gerado"}
                        {contract?.notes ? ` · ${contract.notes}` : ""}
                      </p>
                    </div>
                    <div className="text-left md:text-right">
                      <p className="text-sm font-semibold text-[#092f38]">{event.quotes ? formatCurrencyFromCents(event.quotes.total_amount_cents) : "Valor não informado"}</p>
                      <p className="mt-1 text-xs text-[#5f7180]">{event.guest_count ? `${event.guest_count} convidados` : "Convidados a definir"}</p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="px-3 py-4 text-sm text-[#5f7180]">
            <p className="font-semibold text-[#092f38]">Nenhum contrato ainda.</p>
            <p className="mt-1">Contratos aparecem quando um orçamento aprovado vira evento contratado. Depois, abra o evento para registrar status e gerar o documento do contrato.</p>
            <Link href="/painel" className="mt-3 inline-flex rounded-lg border border-[#d9ded8] bg-white px-3 py-2 text-sm font-semibold text-[#083653] hover:bg-[#dcecf6]">
              Voltar ao painel
            </Link>
          </div>
        )}
      </section>
    </AppShell>
  );
}

function Metric({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "neutral" | "success" | "warning" }) {
  const toneClass = {
    neutral: "text-[#083653]",
    success: "text-[#2f7d62]",
    warning: "text-[#b7791f]",
  }[tone];

  return (
    <div className="rounded-lg border border-[#d9ded8] bg-[#fffdf8] px-3 py-2">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#5f7180]">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}

function StatusPill({ children, status }: { children: React.ReactNode; status: string }) {
  const className = {
    assinado: "bg-[#e9f5ef] text-[#2f7d62]",
    enviado: "bg-[#dcecf6] text-[#083653]",
    cancelado: "bg-[#f9e8e8] text-[#b54747]",
    pendente: "bg-[#fff3d8] text-[#b7791f]",
  }[status] ?? "bg-[#dcecf6] text-[#083653]";

  return <span className={`w-fit rounded-md px-2 py-1 text-xs font-semibold ${className}`}>{children}</span>;
}

function formatDate(value: string | null) {
  if (!value) return "Sem data";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(`${value}T00:00:00`));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function firstRecord<T>(value: T[] | T | null | undefined) {
  if (Array.isArray(value)) return value[0];
  return value;
}
