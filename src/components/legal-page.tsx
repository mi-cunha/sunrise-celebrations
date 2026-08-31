import Link from "next/link";

export function LegalPage({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <main className="min-h-screen bg-[#f7f4ed] text-[#092f38]">
      <header className="border-b border-[#0f5f8f]/30 bg-[#083653]">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-5 py-4">
          <Link href="/" className="text-sm font-semibold tracking-[0.16em] text-white">
            SUNRISE CELEBRATIONS
          </Link>
          <span className="text-xs text-white/70">Informações legais</span>
        </div>
      </header>

      <article className="mx-auto max-w-4xl px-5 py-8 sm:py-10">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0f5f8f]">Sunrise OS</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-[#5f7180]">Última atualização: 31 de agosto de 2026.</p>

        <div className="legal-content mt-7 space-y-7 rounded-lg border border-[#d9ded8] bg-[#fffdf8] p-5 sm:p-7">
          {children}
        </div>

        <nav aria-label="Documentos legais" className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <Link className="font-semibold text-[#0f5f8f] underline underline-offset-4" href="/politica-de-privacidade">Política de Privacidade</Link>
          <Link className="font-semibold text-[#0f5f8f] underline underline-offset-4" href="/termos-de-uso">Termos de Uso</Link>
          <Link className="font-semibold text-[#0f5f8f] underline underline-offset-4" href="/exclusao-de-dados">Exclusão de Dados</Link>
        </nav>
      </article>
    </main>
  );
}

export function LegalSection({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <section>
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-2 space-y-3 text-sm leading-6 text-[#334d56]">{children}</div>
    </section>
  );
}
