import Image from "next/image";
import Link from "next/link";
import { signOut } from "@/app/painel/actions";
import { createClient } from "@/lib/supabase/server";

type CompanySettings = {
  logo_url: string | null;
};

export async function AppShell({ children, title }: { children: React.ReactNode; title: string }) {
  const supabase = await createClient();
  const { data: settings } = await supabase.from("company_settings").select("logo_url").eq("id", true).maybeSingle();
  const logoUrl = (settings as CompanySettings | null)?.logo_url;

  return (
    <main className="min-h-screen">
      <header className="border-b border-[#1d4f78] bg-[#092f4f] shadow-sm">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-3">
          <Link href="/painel" className="flex items-center">
            {logoUrl ? (
              <Image src={logoUrl} alt="Sunrise Celebrations" width={360} height={100} unoptimized className="h-16 w-auto object-contain sm:h-20" />
            ) : (
              <span className="font-semibold tracking-[.16em] text-white">SUNRISE OS</span>
            )}
          </Link>

          <nav className="flex items-center gap-2">
            <Link href="/painel" className="rounded-md px-3 py-2 text-sm font-semibold text-white/90 hover:bg-white/10 hover:text-white">
              Painel
            </Link>
            <Link href="/eventos" className="rounded-md px-3 py-2 text-sm font-semibold text-white/90 hover:bg-white/10 hover:text-white">
              Eventos
            </Link>
            <details className="group relative">
              <summary
                aria-label="Configurações"
                className="flex cursor-pointer list-none items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-white/90 hover:bg-white/10 hover:text-white"
              >
                Configurações
              </summary>
              <div className="absolute right-0 z-20 mt-2 w-64 overflow-hidden rounded-xl border border-[#dbe3dc] bg-white shadow-lg">
                <ConfigLink href="/admin/opcoes#opcoes" label="Opções" description="Tipos de evento, origens e textos padrão." />
                <ConfigLink href="/admin/opcoes#pacotes" label="Pacotes" description="Pacotes de buffet e itens inclusos." />
                <ConfigLink href="/ajuda#fornecedores" label="Fornecedores" description="Como usar fornecedores por evento." />
                <ConfigLink href="/admin/usuarios" label="Usuários" description="Acessos e permissões." />
                <ConfigLink href="/ajuda" label="Ajuda e guia de uso" description="Manual simples do sistema." />
              </div>
            </details>
            <form action={signOut}>
              <button className="rounded-md px-3 py-2 text-sm font-semibold text-white/90 hover:bg-white/10 hover:text-white">Sair</button>
            </form>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-8">
        <h1 className="text-3xl font-semibold">{title}</h1>
        {children}
      </div>
    </main>
  );
}

function ConfigLink({ description, href, label }: { description: string; href: string; label: string }) {
  return (
    <Link href={href} className="block border-b border-[#edf1ee] px-4 py-3 last:border-0 hover:bg-[#f7fbff]">
      <span className="block text-sm font-semibold text-[#18352d]">{label}</span>
      <span className="mt-0.5 block text-xs leading-5 text-slate-500">{description}</span>
    </Link>
  );
}
