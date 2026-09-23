"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const icons: Record<string, string> = {
  painel: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  crm: "M3 4h5v16H3z M10 4h5v11h-5z M17 4h4v8h-4z",
  atendimentos: "M21 11a9 9 0 0 1-9 9H4l-2 2V11a9 9 0 0 1 19 0Z M7 10h9 M7 14h6",
  agenda: "M4 5h16v16H4z M4 10h16 M8 3v4 M16 3v4 M8 14h2 M14 14h2 M8 18h2",
  eventos: "m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z",
  financeiro: "M3 5h18v14H3z M3 9h18 M15 14h3",
  contratos: "M6 3h8l4 4v14H6z M14 3v5h4 M9 12h6 M9 16h6",
  resumo: "M4 20h16 M7 16V9 M12 16V4 M17 16v-5",
  ajustes: "M4 7h16 M4 17h16 M8 4v6 M16 14v6",
  usuarios: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M20 21v-2a4 4 0 0 0-3-3.9",
};

export function AppNavigation({ canSeeCrm, canSeeFinancial }: { canSeeCrm: boolean; canSeeFinancial: boolean }) {
  const pathname = usePathname();
  const groups = [
    { name: "Visão geral", links: [{ href: "/painel", label: "Painel", icon: "painel" }] },
    { name: "Relacionamento", links: canSeeCrm ? [{ href: "/crm", label: "Funil comercial", icon: "crm" }, { href: "/atendimentos", label: "Atendimentos", icon: "atendimentos" }] : [] },
    { name: "Operação", links: [{ href: "/eventos", label: "Eventos", icon: "eventos" }, { href: "/agenda", label: "Agenda", icon: "agenda" }, { href: "/contratos", label: "Contratos", icon: "contratos" }, ...(canSeeFinancial ? [{ href: "/financeiro", label: "Financeiro", icon: "financeiro" }] : []), { href: "/resumo-semanal", label: "Resumo semanal", icon: "resumo" }] },
    { name: "Gestão", links: [{ href: "/admin/opcoes", label: "Configurações", icon: "ajustes" }, { href: "/admin/usuarios", label: "Usuários e acessos", icon: "usuarios" }] },
  ];
  return <nav aria-label="Navegação principal" className="workspace-navigation">{groups.filter((group) => group.links.length).map((group) => <div className="nav-group" key={group.name}><p>{group.name}</p>{group.links.map((link) => {
    const active = pathname === link.href || pathname.startsWith(link.href + "/") || (link.href === "/crm" && (pathname.startsWith("/leads/") || pathname.startsWith("/orcamentos/")));
    return <Link key={link.href} href={link.href} aria-current={active ? "page" : undefined} className={`workspace-nav-link ${active ? "is-active" : ""}`} onClick={(event) => { event.currentTarget.closest("details")?.removeAttribute("open"); }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={icons[link.icon]} /></svg>{link.label}{active && <span className="nav-active-dot" />}</Link>;
  })}</div>)}</nav>;
}
