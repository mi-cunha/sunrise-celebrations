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
  const { data: permissionRows } = await supabase.from("user_permissions").select("permission");
  const logoUrl = (settings as CompanySettings | null)?.logo_url;
  const canSeeCrm = (permissionRows ?? []).some((row) => row.permission === "atendimento" || row.permission === "gerencia" || row.permission === "direcao" || row.permission === "admin_owner");
  const canSeeFinancial = (permissionRows ?? []).some((row) => row.permission === "financeiro" || row.permission === "gerencia" || row.permission === "direcao" || row.permission === "admin_owner");

  return (
    <main className="min-h-screen">
      <header className="border-b border-[#0f5f8f]/30 bg-[#083653]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2">
          <Link href="/painel" className="flex items-center">
            {logoUrl ? (
              <Image src={logoUrl} alt="Sunrise Celebrations" width={300} height={76} unoptimized className="h-14 w-auto object-contain sm:h-16" />
            ) : (
              <span className="text-sm font-semibold tracking-[.16em] text-white">SUNRISE OS</span>
            )}
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            <NavLink href="/painel">Painel</NavLink>
            {canSeeCrm && <NavLink href="/atendimentos">Atendimentos</NavLink>}
            {canSeeCrm && <NavLink href="/crm">CRM</NavLink>}
            <NavLink href="/eventos">Eventos</NavLink>
            {canSeeFinancial && <NavLink href="/financeiro">Financeiro</NavLink>}
            <NavLink href="/agenda">Agenda</NavLink>
            <NavLink href="/contratos">Contratos</NavLink>
            <NavLink href="/resumo-semanal">Resumo</NavLink>
            <details className="group relative">
              <summary
                aria-label="Configurações"
                className="flex cursor-pointer list-none items-center rounded-md px-2.5 py-1.5 text-sm font-semibold text-white/85 hover:bg-white/10 hover:text-white"
              >
                Configurações
              </summary>
              <div className="absolute right-0 z-20 mt-1 w-60 overflow-hidden rounded-lg border border-[#d9ded8] bg-[#fffdf8]">
                <ConfigLink href="/admin/opcoes#whatsapp" label="WhatsApp" description="Conexão e sincronização." />
                <ConfigLink href="/admin/opcoes#opcoes" label="Opções" description="Tipos, origens e textos." />
                <ConfigLink href="/admin/opcoes#pacotes" label="Pacotes" description="Buffet e itens inclusos." />
                <ConfigLink href="/ajuda#fornecedores" label="Fornecedores" description="Uso por evento." />
                <ConfigLink href="/admin/usuarios" label="Usuários" description="Acessos e permissões." />
                <ConfigLink href="/ajuda" label="Guia de uso" description="Manual interno." />
              </div>
            </details>
            <form action={signOut}>
              <button className="rounded-md px-2.5 py-1.5 text-sm font-semibold text-white/85 hover:bg-white/10 hover:text-white">Sair</button>
            </form>
          </nav>

          <details className="group relative md:hidden">
            <summary
              aria-label="Abrir menu"
              className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-md border border-white/20 text-white hover:bg-white/10"
            >
              <span className="sr-only">Menu</span>
              <span className="flex flex-col gap-1.5" aria-hidden="true">
                <span className="block h-0.5 w-5 rounded bg-current" />
                <span className="block h-0.5 w-5 rounded bg-current" />
                <span className="block h-0.5 w-5 rounded bg-current" />
              </span>
            </summary>
            <div className="absolute right-0 z-30 mt-2 w-72 overflow-hidden rounded-lg border border-[#d9ded8] bg-[#fffdf8]">
              <MobileMenuLink href="/painel" label="Painel" />
              {canSeeCrm && <MobileMenuLink href="/atendimentos" label="Atendimentos" />}
              {canSeeCrm && <MobileMenuLink href="/crm" label="CRM" />}
              <MobileMenuLink href="/eventos" label="Eventos" />
              {canSeeFinancial && <MobileMenuLink href="/financeiro" label="Financeiro" />}
              <MobileMenuLink href="/agenda" label="Agenda" />
              <MobileMenuLink href="/contratos" label="Contratos" />
              <MobileMenuLink href="/resumo-semanal" label="Resumo semanal" />
              <div className="border-t border-[#d9ded8] bg-[#f7f4ed] px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#5f7180]">
                Configurações
              </div>
              <MobileMenuLink href="/admin/opcoes#whatsapp" label="WhatsApp" />
              <MobileMenuLink href="/admin/opcoes#opcoes" label="Opções" />
              <MobileMenuLink href="/admin/opcoes#pacotes" label="Pacotes" />
              <MobileMenuLink href="/ajuda#fornecedores" label="Fornecedores" />
              <MobileMenuLink href="/admin/usuarios" label="Usuários" />
              <MobileMenuLink href="/ajuda" label="Ajuda e guia de uso" />
              <form action={signOut} className="border-t border-[#d9ded8]">
                <button className="w-full px-3 py-2 text-left text-sm font-semibold text-[#b54747] hover:bg-[#dcecf6]">Sair</button>
              </form>
            </div>
          </details>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-5">
        <h1 className="text-2xl font-semibold tracking-tight text-[#092f38]">{title}</h1>
        {children}
      </div>
    </main>
  );
}

function NavLink({ children, href }: { children: React.ReactNode; href: string }) {
  return (
    <Link href={href} className="rounded-md px-2.5 py-1.5 text-sm font-semibold text-white/85 hover:bg-white/10 hover:text-white">
      {children}
    </Link>
  );
}

function ConfigLink({ description, href, label }: { description: string; href: string; label: string }) {
  return (
    <Link href={href} className="block border-b border-[#d9ded8] px-3 py-2 last:border-0 hover:bg-[#dcecf6]">
      <span className="block text-sm font-semibold text-[#092f38]">{label}</span>
      <span className="block text-xs leading-4 text-[#5f7180]">{description}</span>
    </Link>
  );
}

function MobileMenuLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="block border-b border-[#d9ded8] px-3 py-2 text-sm font-semibold text-[#092f38] last:border-0 hover:bg-[#dcecf6]">
      {label}
    </Link>
  );
}
