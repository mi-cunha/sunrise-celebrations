import Link from "next/link";
import { notFound } from "next/navigation";
import { SetupNotice } from "@/components/setup-notice";
import { formatCurrencyFromCents, quoteStatusLabel } from "@/lib/domain/quote";
import { requireUser } from "@/lib/auth";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { PrintButton } from "./print-button";

type QuoteProposal = {
  id: string;
  title: string;
  status: string;
  event_type: string | null;
  desired_date: string | null;
  guest_count: number | null;
  notes: string | null;
  total_amount_cents: number;
  created_at: string;
  leads: { id: string; name: string; company: string | null; phone: string } | null;
  quote_items: QuoteItem[];
  quote_packages: QuotePackage[] | QuotePackage | null;
  quote_proposal_options: QuoteProposalOption[];
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

type QuoteProposalOption = {
  id: string;
  title: string;
  content: string;
};

type CompanySettings = {
  logo_url: string | null;
};

export default async function QuoteProposalPage({ params }: { params: Promise<{ id: string }> }) {
  if (!hasSupabaseConfig()) return <SetupNotice />;
  const { id } = await params;
  const { supabase } = await requireUser();

  const { data: quote, error } = await supabase
    .from("quotes")
    .select("id,title,status,event_type,desired_date,guest_count,notes,total_amount_cents,created_at,leads(id,name,company,phone),quote_items(id,description,quantity,unit_price_cents),quote_packages(id,package_id,unit_price_cents,guest_count,total_price_cents,notes,event_package_catalog(id,event_type,name,description,base_price_cents,event_package_items(id,category,name,description,show_in_proposal,show_in_operational_brief))),quote_proposal_options(id,title,content)")
    .eq("id", id)
    .maybeSingle();
  const { data: settings } = await supabase.from("company_settings").select("logo_url").eq("id", true).maybeSingle();

  if (error) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">Não foi possível carregar a proposta: {error.message}</p>
      </main>
    );
  }
  if (!quote) notFound();

  const detail = quote as unknown as QuoteProposal;
  const items = [...(detail.quote_items ?? [])];
  const selectedPackage = firstRecord(detail.quote_packages);
  const proposalPackageItems = asArray(selectedPackage?.event_package_catalog?.event_package_items)
    .filter((item) => item.show_in_proposal)
    .sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
  const proposalOptions = [...(detail.quote_proposal_options ?? [])];
  const companySettings = settings as CompanySettings | null;
  const issueDate = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(new Date(detail.created_at));

  return (
    <main className="bg-[#eef5fb] px-4 py-6 text-[#0b2742] print:bg-white print:p-0">
      <div className="mx-auto mb-4 flex max-w-4xl items-center justify-between gap-3 print:hidden">
        <Link href={`/orcamentos/${detail.id}`} className="text-sm font-semibold text-[#1f5f8b] underline">
          ← Voltar ao orçamento
        </Link>
        <PrintButton />
      </div>

      <article className="mx-auto max-w-4xl overflow-hidden rounded-[2rem] bg-white shadow-sm ring-1 ring-[#e6dccb] print:max-w-none print:overflow-visible print:rounded-none print:shadow-none print:ring-0">
        <section className="print:flex print:min-h-[260mm] print:break-after-page print:flex-col">
          <header className="relative overflow-hidden bg-[#0b2742] px-8 py-10 text-white md:px-12 print:min-h-[88mm] print:rounded-none">
            <div className="absolute right-[-4rem] top-[-5rem] h-56 w-56 rounded-full bg-[#77a8d8]/30" />
            <div className="absolute bottom-[-6rem] left-[-5rem] h-60 w-60 rounded-full bg-[#1f5f8b]/35" />
            <div className="relative">
              {companySettings?.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={companySettings.logo_url} alt="Sunrise Celebrations" className="max-h-28 max-w-80 object-contain print:max-h-24 print:max-w-72" />
              ) : (
                <p className="text-sm font-semibold tracking-[0.32em] text-[#b8d8f2]">SUNRISE CELEBRATIONS</p>
              )}
              <h1 className="mt-5 max-w-2xl text-4xl font-semibold leading-tight md:text-5xl">Proposta de evento</h1>
              <p className="mt-4 max-w-2xl text-lg text-white/80">
                Uma celebração pensada com cuidado, clareza e atenção aos detalhes.
              </p>
            </div>
          </header>

          <div className="grid gap-5 border-b border-[#eadfce] px-8 py-8 md:grid-cols-[1.4fr_0.8fr] md:px-12 print:break-inside-avoid print:py-7">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#1f5f8b]">Cliente</p>
              <h2 className="mt-2 text-2xl font-semibold">{detail.leads?.name ?? "Cliente"}</h2>
              {detail.leads?.company && <p className="mt-1 text-slate-600">{detail.leads.company}</p>}
              <p className="mt-1 text-slate-600">{detail.leads?.phone ?? "Contato não informado"}</p>
            </div>
            <div className="rounded-2xl bg-[#f3f8fc] p-5">
              <p className="text-sm text-slate-500">Orçamento</p>
              <p className="mt-1 font-semibold">{detail.title}</p>
              <p className="mt-3 text-sm text-slate-500">Emitido em</p>
              <p className="mt-1 font-semibold">{issueDate}</p>
              <p className="mt-3 inline-flex rounded-full bg-[#e3f0fa] px-3 py-1 text-sm font-semibold text-[#1f5f8b]">{quoteStatusLabel(detail.status)}</p>
            </div>
          </div>

          <section className="grid gap-6 px-8 py-8 md:grid-cols-2 md:px-12 print:break-inside-avoid print:py-7">
            <div>
              <h2 className="text-xl font-semibold">Observações gerais</h2>
              <p className="mt-3 whitespace-pre-wrap text-slate-700">{detail.notes?.trim() || "Condições, validade e próximos detalhes podem ser alinhados com a equipe Sunrise."}</p>
            </div>
            <div className="rounded-2xl bg-[#f3f8fc] p-5">
              <h2 className="text-xl font-semibold">Próximo passo</h2>
              <p className="mt-3 text-slate-700">
                Após aprovação, nossa equipe confirma disponibilidade, contrato, forma de pagamento e detalhes finais do evento.
              </p>
            </div>
          </section>

          <footer className="mt-auto border-t border-[#eadfce] px-8 py-6 text-sm text-slate-500 md:px-12">
            <p>Sunrise Celebrations - proposta gerada pelo Sunrise OS.</p>
          </footer>
        </section>

        <section className="print:min-h-[260mm]">
          <div className="px-8 py-8 md:px-12 print:pt-10">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#1f5f8b]">Resumo do evento</p>
            <h2 className="mt-2 text-3xl font-semibold">Detalhes e investimento</h2>
            <dl className="mt-6 grid gap-4 md:grid-cols-3 print:break-inside-avoid">
              <InfoCard label="Tipo de evento" value={detail.event_type ?? "A definir"} />
              <InfoCard label="Data desejada" value={formatDate(detail.desired_date)} />
              <InfoCard label="Convidados" value={detail.guest_count ? `${detail.guest_count} pessoas` : "A definir"} />
            </dl>
          </div>

          <section className="px-8 pb-8 md:px-12 print:pb-6">
            {selectedPackage?.event_package_catalog && (
              <section className="mb-6 rounded-2xl border border-[#d7e5ef] bg-[#f8fbfd] p-5 print:break-inside-avoid">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#1f5f8b]">Pacote escolhido</p>
                    <h3 className="mt-2 text-2xl font-semibold">{selectedPackage.event_package_catalog.name}</h3>
                    {selectedPackage.event_package_catalog.description && (
                      <p className="mt-2 whitespace-pre-wrap leading-6 text-slate-700">{selectedPackage.event_package_catalog.description}</p>
                    )}
                  </div>
                  <div className="rounded-2xl bg-white p-4 text-sm ring-1 ring-[#d7e5ef]">
                    <p className="text-slate-500">Valor por pessoa</p>
                    <p className="mt-1 text-lg font-semibold">{formatCurrencyFromCents(selectedPackage.unit_price_cents)}</p>
                    <p className="mt-2 text-slate-500">{selectedPackage.guest_count} convidados</p>
                    <p className="mt-1 font-semibold">{formatCurrencyFromCents(selectedPackage.total_price_cents)}</p>
                  </div>
                </div>
                {proposalPackageItems.length > 0 && (
                  <div className="mt-5 grid gap-3 md:grid-cols-2">
                    {proposalPackageItems.map((item) => (
                      <div key={item.id} className="rounded-xl bg-white p-4 ring-1 ring-[#d7e5ef]">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#1f5f8b]">{categoryLabel(item.category)}</p>
                        <p className="mt-1 font-semibold">{item.name}</p>
                        {item.description && <p className="mt-1 text-sm leading-6 text-slate-600">{item.description}</p>}
                      </div>
                    ))}
                  </div>
                )}
                {selectedPackage.notes && <p className="mt-4 whitespace-pre-wrap rounded-xl bg-white p-4 text-sm leading-6 text-slate-700 ring-1 ring-[#d7e5ef]">{selectedPackage.notes}</p>}
              </section>
            )}

            <div className="overflow-x-auto rounded-2xl border border-[#eadfce] print:overflow-visible print:break-inside-avoid">
              <div className="min-w-[680px] print:min-w-0">
                <div className="grid grid-cols-[1fr_80px_120px_120px] gap-3 bg-[#f3f8fc] px-5 py-3 text-sm font-semibold text-[#1f5f8b]">
                  <p>Item</p>
                  <p>Qtd.</p>
                  <p>Unitário</p>
                  <p className="text-right">Subtotal</p>
                </div>
                {items.length ? (
                  items.map((item) => {
                    const quantity = Number(item.quantity);
                    return (
                      <div key={item.id} className="grid grid-cols-[1fr_80px_120px_120px] gap-3 border-t border-[#eadfce] px-5 py-4 text-sm print:break-inside-avoid">
                        <p className="font-medium">{item.description}</p>
                        <p>{quantity.toLocaleString("pt-BR")}</p>
                        <p>{formatCurrencyFromCents(item.unit_price_cents)}</p>
                        <p className="text-right font-semibold">{formatCurrencyFromCents(Math.round(quantity * item.unit_price_cents))}</p>
                      </div>
                    );
                  })
                ) : (
                  <div className="border-t border-[#eadfce] px-5 py-6 text-sm text-slate-600">Nenhum item adicionado ao orçamento.</div>
                )}
              </div>
            </div>

            <div className="ml-auto mt-6 max-w-sm rounded-2xl bg-[#0b2742] p-6 text-white print:break-inside-avoid print:p-5">
              <p className="text-sm uppercase tracking-[0.18em] text-[#b8d8f2]">Investimento total</p>
              <p className="mt-2 text-4xl font-semibold">{formatCurrencyFromCents(detail.total_amount_cents)}</p>
            </div>

            {proposalOptions.length > 0 && (
              <section className="mt-8 print:break-inside-avoid">
                <h2 className="text-xl font-semibold">Condições e informações adicionais</h2>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  {proposalOptions.map((option) => (
                    <div key={option.id} className="rounded-2xl bg-[#f3f8fc] p-5 print:break-inside-avoid">
                      <h3 className="font-semibold">{option.title}</h3>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{option.content}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}
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
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(date);
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

function firstRecord<T>(value: T[] | T | null | undefined) {
  if (Array.isArray(value)) return value[0];
  return value;
}

function asArray<T>(value: T[] | T | null | undefined) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}
