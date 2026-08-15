import Link from "next/link";
import { notFound } from "next/navigation";
import { SetupNotice } from "@/components/setup-notice";
import { contractedEventBillingModelLabel, contractedEventStatusLabel, contractedEventVendorStatusLabel } from "@/lib/domain/contracted-event";
import { requireUser } from "@/lib/auth";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { PrintButton } from "./print-button";

type EventOperationalBrief = {
  id: string;
  title: string;
  status: string;
  event_type: string | null;
  event_date: string | null;
  guest_count: number | null;
  billing_model: string;
  billing_notes: string | null;
  notes: string | null;
  leads: { name: string; company: string | null; phone: string } | null;
  quotes: EventQuote[] | EventQuote | null;
  contracted_event_timeline: TimelineEntry[];
  contracted_event_vendors: Vendor[];
  contracted_event_checklist: ChecklistItem[];
  contracted_event_documents: EventDocument[];
};

type EventQuote = {
  quote_packages: QuotePackage[] | QuotePackage | null;
};

type QuotePackage = {
  id: string;
  notes: string | null;
  event_package_catalog: EventPackageOption | null;
};

type EventPackageOption = {
  id: string;
  name: string;
  description: string | null;
  event_package_items: EventPackageItem[] | EventPackageItem | null;
};

type EventPackageItem = {
  id: string;
  category: string;
  name: string;
  description: string | null;
  show_in_operational_brief: boolean;
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
  assigned_profile: { display_name: string | null } | null;
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

type ChecklistItem = {
  id: string;
  title: string;
  is_done: boolean;
  sort_order: number;
  assigned_to: string | null;
  due_date: string | null;
  notes: string | null;
  assigned_profile: { display_name: string | null } | null;
};

type EventDocument = {
  id: string;
  title: string;
  document_type: string;
  updated_at: string;
};

export default async function EventOperationalBriefPage({ params }: { params: Promise<{ id: string }> }) {
  if (!hasSupabaseConfig()) return <SetupNotice />;

  const { id } = await params;
  const { supabase } = await requireUser();
  const { data: event, error } = await supabase
    .from("contracted_events")
    .select("id,title,status,event_type,event_date,guest_count,billing_model,billing_notes,notes,leads(name,company,phone),quotes(quote_packages(id,notes,event_package_catalog(id,name,description,event_package_items(id,category,name,description,show_in_operational_brief)))),contracted_event_timeline(id,title,start_time,end_time,location,assigned_to,notes,sort_order,assigned_profile:profiles!contracted_event_timeline_assigned_to_fkey(display_name)),contracted_event_vendors(id,category,name,contact_name,phone,email,status,notes),contracted_event_checklist(id,title,is_done,sort_order,assigned_to,due_date,notes,assigned_profile:profiles!contracted_event_checklist_assigned_to_fkey(display_name)),contracted_event_documents(id,title,document_type,updated_at)")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">Não foi possível carregar a ficha: {error.message}</p>
      </main>
    );
  }
  if (!event) notFound();

  const detail = event as unknown as EventOperationalBrief;
  const checklist = [...(detail.contracted_event_checklist ?? [])].sort((left, right) => left.sort_order - right.sort_order);
  const timeline = [...(detail.contracted_event_timeline ?? [])].sort((left, right) => {
    const leftTime = left.start_time ?? "99:99";
    const rightTime = right.start_time ?? "99:99";
    return leftTime.localeCompare(rightTime) || left.sort_order - right.sort_order;
  });
  const vendors = [...(detail.contracted_event_vendors ?? [])].sort((left, right) => left.category.localeCompare(right.category, "pt-BR") || left.name.localeCompare(right.name, "pt-BR"));
  const quoteRecord = firstRecord(detail.quotes);
  const selectedPackage = firstRecord(quoteRecord?.quote_packages);
  const operationalPackageItems = asArray(selectedPackage?.event_package_catalog?.event_package_items)
    .filter((item) => item.show_in_operational_brief)
    .sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
  const document = detail.contracted_event_documents?.find((item) => item.document_type === "ficha_operacional");
  if (!document) notFound();

  return (
    <main className="bg-[#eef5fb] px-4 py-6 text-[#0b2742] print:bg-white print:p-0">
      <div className="mx-auto mb-4 flex max-w-4xl items-center justify-between gap-3 print:hidden">
        <Link href={`/eventos/${detail.id}`} className="text-sm font-semibold text-[#1f5f8b] underline">
          ? Voltar ao evento
        </Link>
        <PrintButton />
      </div>

      <article className="mx-auto max-w-4xl overflow-hidden rounded-[2rem] bg-white shadow-sm ring-1 ring-[#d7e5ef] print:max-w-none print:overflow-visible print:rounded-none print:shadow-none print:ring-0">
        <header className="relative overflow-hidden bg-[#0b2742] px-8 py-9 text-white md:px-12 print:rounded-none">
          <div className="absolute right-[-4rem] top-[-5rem] h-52 w-52 rounded-full bg-[#77a8d8]/30" />
          <div className="absolute bottom-[-6rem] left-[-5rem] h-56 w-56 rounded-full bg-[#1f5f8b]/35" />
          <div className="relative">
            <p className="text-sm font-semibold tracking-[0.32em] text-[#b8d8f2]">SUNRISE CELEBRATIONS</p>
            <h1 className="mt-5 max-w-2xl text-4xl font-semibold leading-tight">Ficha operacional</h1>
            <p className="mt-3 max-w-2xl text-white/80">Documento interno para alinhamento da equipe antes da execução do evento.</p>
          </div>
        </header>

        <section className="grid gap-5 border-b border-[#d7e5ef] px-8 py-7 md:grid-cols-[1.4fr_0.8fr] md:px-12 print:break-inside-avoid">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#1f5f8b]">Cliente</p>
            <h2 className="mt-2 text-2xl font-semibold">{detail.leads?.name ?? "Cliente"}</h2>
            {detail.leads?.company && <p className="mt-1 text-slate-600">{detail.leads.company}</p>}
            <p className="mt-1 text-slate-600">{detail.leads?.phone ?? "Lead não informado"}</p>
          </div>
          <div className="rounded-2xl bg-[#f3f8fc] p-5">
            <p className="text-sm text-slate-500">Evento</p>
            <p className="mt-1 font-semibold">{detail.title}</p>
            <p className="mt-3 text-sm text-slate-500">Atualizada em</p>
            <p className="mt-1 font-semibold">{formatDateTime(document.updated_at)}</p>
            <p className="mt-3 inline-flex rounded-full bg-[#e3f0fa] px-3 py-1 text-sm font-semibold text-[#1f5f8b]">{contractedEventStatusLabel(detail.status)}</p>
          </div>
        </section>

        <section className="grid gap-4 px-8 py-7 md:grid-cols-3 md:px-12 print:break-inside-avoid">
          <InfoCard label="Tipo" value={detail.event_type ?? "A definir"} />
          <InfoCard label="Data" value={formatDate(detail.event_date)} />
          <InfoCard label="Convidados" value={detail.guest_count ? `${detail.guest_count} pessoas` : "A definir"} />
        </section>

        <section className="px-8 pb-7 md:px-12 print:break-inside-avoid">
          <div className="rounded-2xl border border-[#d7e5ef] bg-[#f8fbfd] p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#1f5f8b]">Cobrança operacional</p>
            <h2 className="mt-2 text-xl font-semibold">{contractedEventBillingModelLabel(detail.billing_model)}</h2>
            <p className="mt-3 leading-7 text-slate-700">{billingModelOperationalText(detail.billing_model)}</p>
            {detail.billing_notes && <p className="mt-3 whitespace-pre-wrap rounded-xl bg-white p-4 text-sm leading-6 text-slate-600 ring-1 ring-[#d7e5ef]">{detail.billing_notes}</p>}
          </div>
        </section>

        <section className="px-8 pb-8 md:px-12">
          <div className="rounded-2xl bg-[#f8fbfd] p-5 print:break-inside-avoid">
            <h2 className="text-xl font-semibold">Observações do evento</h2>
            <p className="mt-3 whitespace-pre-wrap leading-7 text-slate-700">{detail.notes?.trim() || "Sem observações registradas."}</p>
          </div>

          {selectedPackage?.event_package_catalog && (
            <section className="mt-7 rounded-2xl border border-[#d7e5ef] bg-[#f8fbfd] p-5 print:break-inside-avoid">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#1f5f8b]">Pacote operacional</p>
              <h2 className="mt-2 text-xl font-semibold">{selectedPackage.event_package_catalog.name}</h2>
              {selectedPackage.event_package_catalog.description && <p className="mt-3 whitespace-pre-wrap leading-7 text-slate-700">{selectedPackage.event_package_catalog.description}</p>}
              {selectedPackage.notes && (
                <div className="mt-4 rounded-xl bg-white p-4 ring-1 ring-[#d7e5ef]">
                  <p className="text-sm font-semibold text-slate-700">Observações do pacote</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{selectedPackage.notes}</p>
                </div>
              )}
              {operationalPackageItems.length > 0 && (
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  {operationalPackageItems.map((item) => (
                    <div key={item.id} className="rounded-xl bg-white p-4 ring-1 ring-[#d7e5ef]">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#1f5f8b]">{categoryLabel(item.category)}</p>
                      <p className="mt-1 font-semibold">{item.name}</p>
                      {item.description && <p className="mt-1 text-sm leading-6 text-slate-600">{item.description}</p>}
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          <section className="mt-7">
            <h2 className="text-xl font-semibold">Cronograma operacional</h2>
            <div className="mt-4 overflow-hidden rounded-2xl border border-[#d7e5ef]">
              {timeline.length ? (
                timeline.map((entry) => (
                  <div key={entry.id} className="grid gap-3 border-b border-[#d7e5ef] px-5 py-4 last:border-0 md:grid-cols-[120px_1fr_160px_150px] print:break-inside-avoid">
                    <p className="text-sm font-semibold text-[#1f5f8b]">{timelineTimeLabel(entry)}</p>
                    <div>
                      <p className="font-medium">{entry.title}</p>
                      {entry.notes && <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-600">{entry.notes}</p>}
                    </div>
                    <p className="text-sm text-slate-600">{entry.location ? `Local: ${entry.location}` : "Local a definir"}</p>
                    <p className="text-sm text-slate-600">{entry.assigned_profile?.display_name ? `Resp.: ${entry.assigned_profile.display_name}` : "Sem responsável"}</p>
                  </div>
                ))
              ) : (
                <p className="p-5 text-sm text-slate-600">Nenhuma etapa de cronograma cadastrada.</p>
              )}
            </div>
          </section>

          <section className="mt-7">
            <h2 className="text-xl font-semibold">Fornecedores</h2>
            <div className="mt-4 overflow-hidden rounded-2xl border border-[#d7e5ef]">
              {vendors.length ? (
                vendors.map((vendor) => (
                  <div key={vendor.id} className="grid gap-3 border-b border-[#d7e5ef] px-5 py-4 last:border-0 md:grid-cols-[120px_1fr_150px_170px] print:break-inside-avoid">
                    <p className="text-sm font-semibold text-[#1f5f8b]">{vendor.category}</p>
                    <div>
                      <p className="font-medium">{vendor.name}</p>
                      {vendor.notes && <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-600">{vendor.notes}</p>}
                    </div>
                    <p className="text-sm text-slate-600">{contractedEventVendorStatusLabel(vendor.status)}</p>
                    <div className="space-y-1 text-sm text-slate-600">
                      {vendor.contact_name && <p>{vendor.contact_name}</p>}
                      {vendor.phone && <p>{vendor.phone}</p>}
                      {vendor.email && <p>{vendor.email}</p>}
                      {!vendor.contact_name && !vendor.phone && !vendor.email && <p>Lead a definir</p>}
                    </div>
                  </div>
                ))
              ) : (
                <p className="p-5 text-sm text-slate-600">Nenhum fornecedor cadastrado.</p>
              )}
            </div>
          </section>

          <section className="mt-7">
            <h2 className="text-xl font-semibold">Checklist operacional</h2>
            <div className="mt-4 overflow-hidden rounded-2xl border border-[#d7e5ef]">
              {checklist.length ? (
                checklist.map((item) => (
                  <div key={item.id} className="grid gap-3 border-b border-[#d7e5ef] px-5 py-4 last:border-0 md:grid-cols-[42px_1fr_160px_150px] print:break-inside-avoid">
                    <div className="pt-0.5">
                      <span className={`grid h-6 w-6 place-items-center rounded border text-sm font-bold ${item.is_done ? "border-[#356451] bg-[#356451] text-white" : "border-[#9dad9f] bg-white text-transparent"}`}>
                        ?
                      </span>
                    </div>
                    <div>
                      <p className="font-medium">{item.title}</p>
                      {item.notes && <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-600">{item.notes}</p>}
                    </div>
                    <p className="text-sm text-slate-600">{item.assigned_profile?.display_name ? `Resp.: ${item.assigned_profile.display_name}` : "Sem responsável"}</p>
                    <p className="text-sm text-slate-600">{item.due_date ? `Prazo: ${formatDate(item.due_date)}` : "Sem prazo"}</p>
                  </div>
                ))
              ) : (
                <p className="p-5 text-sm text-slate-600">Nenhuma tarefa cadastrada.</p>
              )}
            </div>
          </section>
        </section>
      </article>
    </main>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[#f3f8fc] p-5 print:break-inside-avoid">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="mt-2 text-lg font-semibold">{value}</dd>
    </div>
  );
}

function formatDate(value: string | null) {
  if (!value) return "A definir";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date(`${value}T00:00:00`));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function categoryLabel(category: string) {
  const labels: Record<string, string> = {
    buffet: "Buffet",
    comida: "Buffet",
    bebida: "Bebidas",
    servico: "Serviço",
    estrutura: "Estrutura",
    decoracao: "Decoração",
    outro: "Outro",
  };
  return labels[category] ?? category;
}

function billingModelOperationalText(model: string) {
  const labels: Record<string, string> = {
    orcamento_fechado: "Serviços e condições principais já estão definidos no orçamento aprovado. A operação deve seguir pacote, cronograma, fornecedores e observações desta ficha.",
    consumo_aberto_pos_evento: "Evento com consumo apurado após a realização. A equipe deve orientar comandas, registros de consumo e fechamento operacional conforme combinado.",
    pre_pago_com_consumo_aberto: "Evento com parte pré-paga e parte variável. A equipe deve seguir os serviços já contratados e registrar os consumos abertos para apuração pós-evento.",
  };
  return labels[model] ?? "Modelo de cobrança a confirmar com a administração.";
}

function normalizeTime(value: string | null | undefined) {
  return value ? value.slice(0, 5) : "";
}

function timelineTimeLabel(entry: TimelineEntry) {
  const start = normalizeTime(entry.start_time);
  const end = normalizeTime(entry.end_time);
  if (start && end) return `${start}  ${end}`;
  if (start) return start;
  if (end) return `Até ${end}`;
  return "A definir";
}

function firstRecord<T>(value: T[] | T | null | undefined) {
  if (Array.isArray(value)) return value[0];
  return value;
}

function asArray<T>(value: T[] | T | null | undefined) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}


