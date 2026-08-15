import Link from "next/link";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { SetupNotice } from "@/components/setup-notice";
import { requireUser } from "@/lib/auth";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { OptionForm } from "./option-form";
import { CompanyLogoForm, ProposalOptionForm, QuoteItemCatalogOptionForm } from "./proposal-settings-forms";
import { OptionAccordionList, ProposalOptionAccordionList, QuoteItemCatalogAccordionList } from "./catalog-accordions";
import { EventPackageAccordionList, EventPackageForm } from "./package-forms";

type Option = { id: string; kind: "event_type" | "lead_source"; name: string; is_active: boolean };
type ProposalOption = { id: string; title: string; content: string; is_active: boolean };
type QuoteItemCatalogOption = { id: string; name: string; description: string | null; default_unit_price_cents: number | null; is_active: boolean };
type CompanySettings = { logo_url: string | null };
type EventPackage = {
  id: string;
  event_type: string;
  name: string;
  description: string | null;
  base_price_cents: number | null;
  proposal_notes: string | null;
  operation_notes: string | null;
  event_package_items: {
    id: string;
    category: string;
    name: string;
    description: string | null;
    show_in_proposal: boolean;
    show_in_operational_brief: boolean;
  }[];
};

export default async function OptionsAdminPage() {
  if (!hasSupabaseConfig()) return <SetupNotice />;

  const { supabase, permissions } = await requireUser();
  if (!permissions.includes("admin_owner")) {
    return (
      <AppShell title="Acesso restrito">
        <p className="mt-3 text-sm text-[#5f7180]">Apenas administradores podem gerenciar configurações.</p>
        <Link href="/painel" className="mt-4 inline-block text-sm font-semibold text-[#0f5f8f] underline">
          Voltar ao painel
        </Link>
      </AppShell>
    );
  }

  const { data: options, error } = await supabase.from("option_catalog").select("id,kind,name,is_active").order("kind").order("sort_order").order("name");
  const { data: settings } = await supabase.from("company_settings").select("logo_url").eq("id", true).maybeSingle();
  const { data: proposalOptions } = await supabase.from("proposal_option_catalog").select("id,title,content,is_active").order("sort_order").order("title");
  const { data: quoteItemOptions } = await supabase.from("quote_item_catalog").select("id,name,description,default_unit_price_cents,is_active").order("sort_order").order("name");
  const { data: eventPackages } = await supabase
    .from("event_package_catalog")
    .select("id,event_type,name,description,base_price_cents,proposal_notes,operation_notes,event_package_items(id,category,name,description,show_in_proposal,show_in_operational_brief)")
    .eq("is_active", true)
    .order("event_type")
    .order("sort_order")
    .order("name");

  const eventTypes = ((options ?? []) as Option[]).filter((option) => option.kind === "event_type");
  const leadSources = ((options ?? []) as Option[]).filter((option) => option.kind === "lead_source");
  const companySettings = settings as CompanySettings | null;

  return (
    <AppShell title="Configurações">
      <p className="mt-1 text-sm text-[#5f7180]">Padrões usados em leads, orçamentos, propostas e eventos.</p>
      {error && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-[#b54747]">Tabela de opções indisponível. Confira as migrations.</p>}

      <div className="mt-4 space-y-2">
        <AdminSection id="opcoes" title="Tipos de evento" count={eventTypes.length} defaultOpen>
          <OptionForm kind="event_type" label="Novo tipo" />
          <OptionAccordionList options={eventTypes} />
        </AdminSection>

        <AdminSection title="Origens" count={leadSources.length}>
          <OptionForm kind="lead_source" label="Nova origem" />
          <OptionAccordionList options={leadSources} />
        </AdminSection>

        <AdminSection title="Marca" count={companySettings?.logo_url ? 1 : 0}>
          <CompanyLogoForm logoUrl={companySettings?.logo_url ?? ""} />
        </AdminSection>

        <AdminSection title="Itens de orçamento" count={(quoteItemOptions ?? []).length}>
          <QuoteItemCatalogOptionForm />
          <QuoteItemCatalogAccordionList options={(quoteItemOptions ?? []) as QuoteItemCatalogOption[]} />
        </AdminSection>

        <AdminSection id="pacotes" title="Pacotes" count={(eventPackages ?? []).length}>
          <EventPackageForm eventTypes={eventTypes.map((option) => ({ name: option.name }))} />
          <EventPackageAccordionList packages={(eventPackages ?? []) as EventPackage[]} />
        </AdminSection>

        <AdminSection title="Textos da proposta" count={(proposalOptions ?? []).length}>
          <ProposalOptionForm />
          <ProposalOptionAccordionList options={(proposalOptions ?? []) as ProposalOption[]} />
        </AdminSection>
      </div>
    </AppShell>
  );
}

function AdminSection({
  children,
  count,
  defaultOpen = false,
  id,
  title,
}: {
  children: ReactNode;
  count: number;
  defaultOpen?: boolean;
  id?: string;
  title: string;
}) {
  return (
    <details id={id} open={defaultOpen} className="group scroll-mt-20 overflow-hidden rounded-lg border border-[#d9ded8] bg-[#fffdf8]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 hover:bg-[#dcecf6]/45">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-[#083653]">{title}</h2>
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-md bg-[#dcecf6] px-2 py-1 text-xs font-semibold text-[#083653]">{count}</span>
          <span className="text-sm text-[#5f7180] transition group-open:rotate-180">⌄</span>
        </div>
      </summary>
      <div className="border-t border-[#d9ded8] p-3">{children}</div>
    </details>
  );
}
