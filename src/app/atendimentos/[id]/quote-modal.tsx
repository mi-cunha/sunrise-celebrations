import Link from "next/link";

export function QuoteModal({ closeHref, quoteId }: { closeHref: string; quoteId: string }) {
  return (
    <div className="fixed inset-0 z-50 bg-[#102820]/60 p-4 backdrop-blur-sm">
      <div className="mx-auto flex h-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-[#fcfaf5] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#dbe3dc] bg-white px-5 py-3">
          <div>
            <p className="text-sm font-semibold text-[#356451]">Orçamento aberto</p>
            <p className="text-xs text-slate-500">Consulte ou edite sem sair do atendimento.</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/orcamentos/${quoteId}`} className="rounded-full border border-[#dbe3dc] px-4 py-2 text-sm font-semibold text-[#18352d] transition hover:bg-[#f6f0e5]">
              Abrir página
            </Link>
            <Link href={closeHref} className="rounded-full bg-[#18352d] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#23483d]">
              Fechar
            </Link>
          </div>
        </div>
        <iframe src={`/orcamentos/${quoteId}`} title="Orçamento" className="min-h-0 flex-1 border-0" />
      </div>
    </div>
  );
}
