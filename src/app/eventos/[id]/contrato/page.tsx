import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SetupNotice } from "@/components/setup-notice";
import { requireUser } from "@/lib/auth";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { PrintButton } from "../ficha/print-button";

type ContractDocumentDetail = {
  id: string;
  title: string;
  updated_at: string;
  content: string;
  version: number;
  status: string;
  contracted_events: {
    id: string;
    title: string;
    leads: { name: string; company: string | null; phone: string } | null;
  } | null;
};

type CompanySettings = { logo_url: string | null };

export default async function ContractDocumentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ versao?: string }> }) {
  if (!hasSupabaseConfig()) return <SetupNotice />;

  const { id } = await params;
  const query = await searchParams;
  const { supabase, permissions } = await requireUser();
  const canSeeContract = permissions.some((permission) => permission === "financeiro" || permission === "gerencia" || permission === "admin_owner");
  if (!canSeeContract) redirect("/painel?error=forbidden");

  const requestedVersion = Number(query.versao);
  let documentQuery = supabase
    .from("contracted_event_contract_document_versions")
    .select("id,title,content,version,status,updated_at,contracted_events(id,title,leads(name,company,phone))")
    .eq("event_id", id);
  documentQuery = Number.isInteger(requestedVersion) && requestedVersion > 0
    ? documentQuery.eq("version", requestedVersion)
    : documentQuery.order("version", { ascending: false }).limit(1);
  const { data, error } = await documentQuery.maybeSingle();
  const { data: settings } = await supabase.from("company_settings").select("logo_url").eq("id", true).maybeSingle();

  if (error) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">Não foi possível carregar o contrato: {error.message}</p>
      </main>
    );
  }
  if (!data) notFound();

  const detail = data as unknown as ContractDocumentDetail;
  const companySettings = settings as CompanySettings | null;
  const eventTitle = detail.contracted_events?.title;
  const documentTitle = eventTitle && detail.title.endsWith(` - ${eventTitle}`) ? detail.title.slice(0, -(eventTitle.length + 3)) : detail.title;

  return (
    <main className="bg-[#eef5fb] px-4 py-6 text-[#0b2742] print:bg-white print:p-0">
      <div className="mx-auto mb-4 flex max-w-4xl items-center justify-between gap-3 print:hidden">
        <Link href={`/eventos/${id}`} className="text-sm font-semibold text-[#1f5f8b] underline">
          ← Voltar ao evento
        </Link>
        {detail.status === "emitido" || detail.status === "enviado" || detail.status === "assinado" ? <PrintButton /> : <span className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">Rascunho para revisão · impressão final bloqueada</span>}
      </div>

      <article className="mx-auto max-w-4xl overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-[#d7e5ef] print:max-w-none print:overflow-visible print:rounded-none print:shadow-none print:ring-0">
        <header className="border-b-4 border-[#77a8d8] bg-[#0b2742] px-8 py-6 text-white md:px-12 print:px-10 print:py-5">
          <div className="flex items-center justify-between gap-6">
            <div>
              {companySettings?.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={companySettings.logo_url} alt="Sunrise Celebrations" className="max-h-16 max-w-64 object-contain object-left" />
              ) : (
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#b8d8f2]">Sunrise Celebrations</p>
              )}
              <h1 className="mt-3 text-xl font-semibold uppercase leading-tight tracking-[0.025em]">{documentTitle}</h1>
            </div>
            <p className="shrink-0 text-right text-xs leading-5 text-white/70">Versão {detail.version} · {contractDocumentVersionStatusLabel(detail.status)}<br />{formatDateTime(detail.updated_at)}</p>
          </div>
        </header>

        <section className="grid gap-x-8 gap-y-3 border-b border-[#d7e5ef] bg-[#f8fbfd] px-8 py-4 md:grid-cols-3 md:px-12 print:px-10 print:py-3">
          <Info label="Evento" value={detail.contracted_events?.title ?? "Não informado"} />
          <Info label="Contato/cliente" value={detail.contracted_events?.leads?.name ?? "Não informado"} />
          <Info label="Telefone" value={detail.contracted_events?.leads?.phone ?? "Não informado"} />
        </section>

        <section className="space-y-5 px-8 py-7 md:px-12 print:px-10 print:py-5">
          {renderContractContent(detail.content)}
        </section>
      </article>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#1f5f8b]">{label}</p>
      <p className="mt-0.5 text-sm font-semibold">{value}</p>
    </div>
  );
}

function renderContractContent(content: string) {
  const blocks = content.split(/\n(?=## )/g);
  return blocks.map((block, index) => {
    const lines = block.trim().split("\n");
    const titleLine = lines[0] ?? "";
    if (titleLine.startsWith("## ")) {
      const title = titleLine.replace(/^## /, "");
      if (title === "ASSINATURAS") return renderSignatureSection(lines.slice(1), index);
      return (
        <section key={index}>
          <h2 className="border-b border-[#d7e5ef] pb-1.5 text-sm font-bold uppercase tracking-[0.035em] text-[#0b2742] print:break-after-avoid">{title}</h2>
          <div className="mt-2.5 space-y-1.5 text-sm leading-6 text-slate-700 print:text-[10.5pt] print:leading-[1.5]">
            {lines.slice(1).map((line, lineIndex) => renderLine(line, lineIndex))}
          </div>
        </section>
      );
    }
    return (
      <p key={index} className="border-b border-[#d7e5ef] pb-5 text-justify text-sm leading-6 text-slate-700 print:text-[10.5pt] print:leading-[1.5]">
        {block}
      </p>
    );
  });
}

function renderLine(line: string, index: number) {
  if (!line.trim()) return null;
  if (line.startsWith("- ")) {
    return (
      <p key={index} className="pl-4">
        • {line.slice(2)}
      </p>
    );
  }
  return <p key={index} className="text-justify">{line}</p>;
}

function renderSignatureSection(lines: string[], index: number) {
  const groups: string[][] = [];
  let current: string[] = [];
  for (const line of lines) {
    if (!line.trim()) {
      if (current.length) groups.push(current);
      current = [];
      continue;
    }
    current.push(line);
  }
  if (current.length) groups.push(current);

  return (
    <section key={index} className="pt-2 print:break-before-auto">
      <h2 className="border-b border-[#d7e5ef] pb-1.5 text-sm font-bold uppercase tracking-[0.035em] text-[#0b2742]">Assinaturas</h2>
      <div className="mt-8 grid gap-x-10 gap-y-9 sm:grid-cols-2">
        {groups.map((group, groupIndex) => (
          <div key={groupIndex} className="break-inside-avoid text-center text-xs leading-5 text-slate-700">
            {group.map((line, lineIndex) => <p key={lineIndex}>{line}</p>)}
          </div>
        ))}
      </div>
    </section>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function contractDocumentVersionStatusLabel(status: string) {
  return ({ rascunho: "Rascunho", revisado: "Revisado", emitido: "Emitido", enviado: "Enviado", assinado: "Assinado", cancelado: "Cancelado" } as Record<string, string>)[status] ?? status;
}
