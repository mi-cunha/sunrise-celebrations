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
  contracted_events: {
    id: string;
    title: string;
    leads: { name: string; company: string | null; phone: string } | null;
  } | null;
};

export default async function ContractDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  if (!hasSupabaseConfig()) return <SetupNotice />;

  const { id } = await params;
  const { supabase, permissions } = await requireUser();
  const canSeeContract = permissions.some((permission) => permission === "financeiro" || permission === "gerencia" || permission === "admin_owner");
  if (!canSeeContract) redirect("/painel?error=forbidden");

  const { data, error } = await supabase
    .from("contracted_event_documents")
    .select("id,title,content,updated_at,contracted_events(id,title,leads(name,company,phone))")
    .eq("event_id", id)
    .eq("document_type", "contrato")
    .maybeSingle();

  if (error) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">Não foi possível carregar o contrato: {error.message}</p>
      </main>
    );
  }
  if (!data) notFound();

  const detail = data as unknown as ContractDocumentDetail;

  return (
    <main className="bg-[#eef5fb] px-4 py-6 text-[#0b2742] print:bg-white print:p-0">
      <div className="mx-auto mb-4 flex max-w-4xl items-center justify-between gap-3 print:hidden">
        <Link href={`/eventos/${id}`} className="text-sm font-semibold text-[#1f5f8b] underline">
          ← Voltar ao evento
        </Link>
        <PrintButton />
      </div>

      <article className="mx-auto max-w-4xl overflow-hidden rounded-[1.5rem] bg-white shadow-sm ring-1 ring-[#d7e5ef] print:max-w-none print:rounded-none print:shadow-none print:ring-0">
        <header className="bg-[#0b2742] px-8 py-8 text-white md:px-12 print:px-10 print:py-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#b8d8f2]">Sunrise Celebrations</p>
          <h1 className="mt-3 text-3xl font-semibold leading-tight">{detail.title}</h1>
          <p className="mt-2 text-sm text-white/75">Atualizado em {formatDateTime(detail.updated_at)}</p>
        </header>

        <section className="grid gap-4 border-b border-[#d7e5ef] px-8 py-6 md:grid-cols-3 md:px-12 print:px-10">
          <Info label="Evento" value={detail.contracted_events?.title ?? "Não informado"} />
          <Info label="Contato/cliente" value={detail.contracted_events?.leads?.name ?? "Não informado"} />
          <Info label="Telefone" value={detail.contracted_events?.leads?.phone ?? "Não informado"} />
        </section>

        <section className="space-y-6 px-8 py-8 md:px-12 print:px-10">
          {renderContractContent(detail.content)}
        </section>
      </article>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[#f3f8fc] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#1f5f8b]">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}

function renderContractContent(content: string) {
  const blocks = content.split(/\n(?=## )/g);
  return blocks.map((block, index) => {
    const lines = block.trim().split("\n");
    const titleLine = lines[0] ?? "";
    if (titleLine.startsWith("# ")) {
      return (
        <section key={index} className="rounded-lg border border-[#d7e5ef] bg-[#f8fbfd] p-5 print:break-inside-avoid">
          <h2 className="text-xl font-semibold">{titleLine.replace(/^# /, "")}</h2>
          <div className="mt-4 space-y-2 text-sm leading-6 text-slate-700">
            {lines.slice(1).map((line, lineIndex) => renderLine(line, lineIndex))}
          </div>
        </section>
      );
    }
    if (titleLine.startsWith("## ")) {
      return (
        <section key={index} className="print:break-inside-avoid">
          <h2 className="text-lg font-semibold text-[#0b2742]">{titleLine.replace(/^## /, "")}</h2>
          <div className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
            {lines.slice(1).map((line, lineIndex) => renderLine(line, lineIndex))}
          </div>
        </section>
      );
    }
    return (
      <p key={index} className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
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
  return <p key={index}>{line}</p>;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}
