import Link from "next/link";
import { signOut } from "@/app/painel/actions";

export function AppShell({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <main className="min-h-screen">
      <header className="border-b border-[#dbe3dc] bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <Link href="/painel" className="font-semibold tracking-[.16em] text-[#356451]">
            SUNRISE OS
          </Link>
          <nav className="flex items-center gap-2">
            <Link href="/painel" className="rounded-md px-3 py-2 text-sm font-semibold text-[#18352d] hover:bg-[#f6f0e5]">
              Painel
            </Link>
            <Link href="/atendimentos" className="rounded-md px-3 py-2 text-sm font-semibold text-[#18352d] hover:bg-[#f6f0e5]">
              Atendimentos
            </Link>
            <Link href="/eventos" className="rounded-md px-3 py-2 text-sm font-semibold text-[#18352d] hover:bg-[#f6f0e5]">
              Eventos
            </Link>
            <form action={signOut}>
              <button className="rounded-md px-3 py-2 text-sm font-semibold text-[#18352d] hover:bg-[#f6f0e5]">Sair</button>
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
