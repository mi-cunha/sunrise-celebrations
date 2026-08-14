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
        <p className="mt-4 text-slate-600">Apenas administradores podem gerenciar opções.</p>
        <Link href="/painel" className="mt-6 inline-block text-sm font-semibold text-[#356451] underline">
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
    <AppShell title="Opções do cadastro">
      <p className="mt-2 max-w-2xl text-slate-600">Padronize os seletores, os itens de orçamento, os pacotes de evento e os blocos que podem entrar na proposta comercial.</p>
      {error && <p className="mt-6 rounded-lg bg-red-50 p-3 text-sm text-red-800">A tabela de opções ainda não está disponível. Aplique a migration `202608120001_lead_option_catalog.sql`.</p>}

      <div className="mt-8 space-y-4">
        <AdminSection title="Tipos de evento" description="Categorias usadas no cadastro do lead e no resumo do evento." count={eventTypes.length} defaultOpen>
          <OptionForm kind="event_type" label="Novo tipo de evento" />
          <OptionAccordionList options={eventTypes} />
        </AdminSection>

        <AdminSection title="Origens" description="Canais de entrada para padronizar a origem dos leads." count={leadSources.length}>
          <OptionForm kind="lead_source" label="Nova origem" />
          <OptionAccordionList options={leadSources} />
        </AdminSection>

        <AdminSection title="Marca da proposta" description="Logo fixa usada na proposta enviada ao cliente." count={companySettings?.logo_url ? 1 : 0}>
          <CompanyLogoForm logoUrl={companySettings?.logo_url ?? ""} />
        </AdminSection>

        <AdminSection title="Itens/serviços do orçamento" description="Opções como Buffet completo, DJ, Bar de drinks e outros serviços recorrentes." count={(quoteItemOptions ?? []).length}>
          <QuoteItemCatalogOptionForm />
          <QuoteItemCatalogAccordionList options={(quoteItemOptions ?? []) as QuoteItemCatalogOption[]} />
        </AdminSection>

        <AdminSection title="Pacotes de evento" description="Pacotes como Entradinhas, Standard, Premium, Café completo ou Almoço executivo, com itens inclusos para proposta e operação." count={(eventPackages ?? []).length}>
          <EventPackageForm eventTypes={eventTypes.map((option) => ({ name: option.name }))} />
          <EventPackageAccordionList packages={(eventPackages ?? []) as EventPackage[]} />
        </AdminSection>

        <AdminSection title="Condições e textos da proposta" description="Validade, pagamento, observações comerciais, inclusões ou condições adicionais." count={(proposalOptions ?? []).length}>
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
  description,
  title,
}: {
  children: ReactNode;
  count: number;
  defaultOpen?: boolean;
  description: string;
  title: string;
}) {
  return (
    <details open={defaultOpen} className="group overflow-hidden rounded-2xl border border-[#dbe3dc] bg-white shadow-sm transition hover:border-[#c8d6cf]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 bg-gradient-to-r from-white to-[#f7faf8] p-5 transition hover:from-[#fbf8f1] hover:to-white">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-slate-600">{description}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="rounded-full bg-[#edf5ee] px-3 py-1 text-sm font-semibold text-[#356451]">{count}</span>
          <span className="grid h-9 w-9 place-items-center rounded-full border border-[#dbe3dc] text-lg text-[#356451] transition group-open:rotate-180">⌄</span>
        </div>
      </summary>
      <div className="border-t border-[#edf1ee] p-5">{children}</div>
    </details>
  );
}
