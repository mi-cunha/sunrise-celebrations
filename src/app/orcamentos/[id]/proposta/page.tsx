import Link from "next/link";
import { notFound } from "next/navigation";
import { SetupNotice } from "@/components/setup-notice";
import { formatCurrencyFromCents, quoteEventAreaLabel, quoteStatusLabel } from "@/lib/domain/quote";
import { requireUser } from "@/lib/auth";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { PrintButton } from "./print-button";

type QuoteProposal = {
  id: string;
  title: string;
  status: string;
  event_type: string | null;
  event_area: string | null;
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
  is_choice: boolean;
  choice_group: string | null;
  choice_min: number | null;
  choice_max: number | null;
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
  quote_package_item_choices: QuotePackageItemChoice[] | QuotePackageItemChoice | null;
};

type QuotePackageItemChoice = {
  package_item_id: string;
};

type QuoteProposalOption = {
  id: string;
  title: string;
  content: string;
};

type CompanySettings = {
  logo_url: string | null;
};

const standardProposalInfo = [
  {
    title: "Mobiliário incluso",
    content: "A proposta contempla o mobiliário base do espaço, conforme composição e disponibilidade alinhadas para o evento.",
  },
  {
    title: "Validade do orçamento",
    content: "Orçamento válido por 30 dias a partir da data de emissão da proposta.",
  },
  {
    title: "Dados de pagamento",
    content: "Banco Santander\nAgência: 4389\nConta corrente: 130024143\nCNPJ: 05.904.097/0001-80\nPIX: 05.904.097/0001-80",
  },
  {
    title: "Nota fiscal e ISS",
    content: "Caso seja necessária a emissão de nota fiscal de serviços, a incidência de ISS e eventuais ajustes tributários serão confirmados antes da emissão, conforme orientação fiscal/contábil aplicável.",
  },
];

export default async function QuoteProposalPage({ params }: { params: Promise<{ id: string }> }) {
  if (!hasSupabaseConfig()) return <SetupNotice />;
  const { id } = await params;
  const { supabase } = await requireUser();

  const { data: quote, error } = await supabase
    .from("quotes")
    .select("id,title,status,event_type,event_area,desired_date,guest_count,notes,total_amount_cents,created_at,leads(id,name,company,phone),quote_items(id,description,quantity,unit_price_cents),quote_packages(id,package_id,unit_price_cents,guest_count,total_price_cents,notes,event_package_catalog(id,event_type,name,description,base_price_cents,event_package_items(id,category,name,description,show_in_proposal,show_in_operational_brief,is_choice,choice_group,choice_min,choice_max)),quote_package_item_choices(package_item_id)),quote_proposal_options(id,title,content)")
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
  const selectedChoiceIds = new Set(asArray(selectedPackage?.quote_package_item_choices).map((choice) => choice.package_item_id));
  const hasChoiceItems = proposalPackageItems.some((item) => item.is_choice);
  const isFinalProposal = !hasChoiceItems || selectedChoiceIds.size > 0;
  const fixedPackageItems = proposalPackageItems.filter((item) => !item.is_choice);
  const selectedPackageChoiceItems = proposalPackageItems.filter((item) => item.is_choice && selectedChoiceIds.has(item.id));
  const pendingChoiceGroups = groupChoiceItems(proposalPackageItems);
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
        <section>
          <header className="relative overflow-hidden bg-[#0b2742] px-8 py-10 text-white md:px-12 print:min-h-[64mm] print:rounded-none print:py-8">
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
              <p className="mt-1 text-slate-600">{detail.leads?.phone ?? "Lead não informado"}</p>
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

          <footer className="border-t border-[#eadfce] px-8 py-6 text-sm text-slate-500 md:px-12 print:hidden">
            <p>Sunrise Celebrations - proposta gerada pelo Sunrise OS.</p>
          </footer>
        </section>

        <section>
          <div className="px-8 py-8 md:px-12 print:pt-10">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#1f5f8b]">Resumo do evento</p>
            <h2 className="mt-2 text-3xl font-semibold">Detalhes e investimento</h2>
            <dl className="mt-6 grid gap-4 md:grid-cols-4 print:break-inside-avoid">
              <InfoCard label="Tipo de evento" value={detail.event_type ?? "A definir"} />
              <InfoCard label="Data desejada" value={formatDate(detail.desired_date)} />
              <InfoCard label="Convidados" value={detail.guest_count ? `${detail.guest_count} pessoas` : "A definir"} />
              <InfoCard label="Área" value={quoteEventAreaLabel(detail.event_area)} />
            </dl>
          </div>

          <section className="px-8 pb-8 md:px-12 print:pb-6">
            {selectedPackage?.event_package_catalog && (
              <section className="mb-6 rounded-2xl border border-[#d7e5ef] bg-[#f8fbfd] p-5 print:break-inside-avoid">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#1f5f8b]">{isFinalProposal ? "Pacote definido" : "Proposta provisória"}</p>
                    <h3 className="mt-2 text-2xl font-semibold">{selectedPackage.event_package_catalog.name}</h3>
                    {selectedPackage.event_package_catalog.description && (
                      <p className="mt-2 whitespace-pre-wrap leading-6 text-slate-700">{selectedPackage.event_package_catalog.description}</p>
                    )}
                    {!isFinalProposal && <p className="mt-3 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-[#1f5f8b] ring-1 ring-[#d7e5ef]">Alguns itens ainda serão escolhidos pelo cliente antes da proposta final.</p>}
                  </div>
                  <div className="rounded-2xl bg-white p-4 text-sm ring-1 ring-[#d7e5ef]">
                    <p className="text-slate-500">Convidados</p>
                    <p className="mt-1 text-lg font-semibold">{selectedPackage.guest_count} pessoas</p>
                    <p className="mt-2 text-slate-500">Pacote incluso no investimento total</p>
                  </div>
                </div>
                {fixedPackageItems.length > 0 && (
                  <div className="mt-5 grid gap-2 md:grid-cols-2">
                    {fixedPackageItems.map((item) => <PackageItemCard key={item.id} item={item} />)}
                  </div>
                )}
                {isFinalProposal && selectedPackageChoiceItems.length > 0 && (
                  <div className="mt-5">
                    <h4 className="text-sm font-semibold uppercase tracking-[0.14em] text-[#1f5f8b]">Escolhas definidas</h4>
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      {selectedPackageChoiceItems.map((item) => <PackageItemCard key={item.id} item={item} />)}
                    </div>
                  </div>
                )}
                {!isFinalProposal && pendingChoiceGroups.length > 0 && (
                  <div className="mt-5 space-y-3">
                    {pendingChoiceGroups.map((group) => (
                      <div key={group.name} className="rounded-xl bg-white p-4 ring-1 ring-[#d7e5ef] print:break-inside-avoid">
                        <h4 className="text-sm font-semibold text-[#1f5f8b]">{choiceGroupInstruction(group)}</h4>
                        <ul className="mt-3 grid gap-2 md:grid-cols-2">
                          {group.items.map((item) => (
                            <li key={item.id} className="flex gap-2 text-sm">
                              <span className="mt-1 h-3 w-3 shrink-0 rounded-sm border border-[#1f5f8b]" />
                              <span>
                                <span className="font-semibold">{item.name}</span>
                                {item.description && <span className="block text-xs leading-5 text-slate-600">{item.description}</span>}
                              </span>
                            </li>
                          ))}
                        </ul>
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

            <section className="mt-8 print:break-inside-avoid">
              <h2 className="text-xl font-semibold">Condições e informações adicionais</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {standardProposalInfo.map((option) => (
                  <div key={option.title} className="rounded-2xl bg-[#f3f8fc] p-5 print:break-inside-avoid">
                    <h3 className="font-semibold">{option.title}</h3>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{option.content}</p>
                  </div>
                ))}
                {proposalOptions.map((option) => (
                  <div key={option.id} className="rounded-2xl bg-[#f3f8fc] p-5 print:break-inside-avoid">
                    <h3 className="font-semibold">{option.title}</h3>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{option.content}</p>
                  </div>
                ))}
              </div>
            </section>
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

function PackageItemCard({ item }: { item: EventPackageItem }) {
  return (
    <div className="rounded-lg bg-white px-3 py-2 ring-1 ring-[#d7e5ef] print:break-inside-avoid">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-[#1f5f8b]">{categoryLabel(item.category)}</p>
        <p className="text-sm font-semibold">{item.name}</p>
      </div>
      {item.description && <p className="mt-1 text-xs leading-5 text-slate-600">{item.description}</p>}
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

function groupChoiceItems(items: EventPackageItem[]) {
  const groups = new Map<string, { name: string; min: number | null; max: number | null; items: EventPackageItem[] }>();
  for (const item of items) {
    if (!item.is_choice) continue;
    const name = item.choice_group?.trim() || "Escolhas do pacote";
    const current = groups.get(name) ?? { name, min: item.choice_min, max: item.choice_max, items: [] };
    current.min = current.min ?? item.choice_min;
    current.max = current.max ?? item.choice_max;
    current.items.push(item);
    groups.set(name, current);
  }
  return Array.from(groups.values());
}

function choiceGroupInstruction(group: { name: string; min: number | null; max: number | null }) {
  if (group.min && group.max && group.min === group.max) return `Escolha ${group.max}: ${group.name}`;
  if (group.min && group.max) return `Escolha de ${group.min} a ${group.max}: ${group.name}`;
  if (group.max) return `Escolha até ${group.max}: ${group.name}`;
  if (group.min) return `Escolha ao menos ${group.min}: ${group.name}`;
  return `Escolha entre: ${group.name}`;
}
