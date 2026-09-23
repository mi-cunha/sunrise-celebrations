import Image from "next/image";
import Link from "next/link";
import { signOut } from "@/app/painel/actions";
import { requireUser } from "@/lib/auth";
import { AppNavigation } from "./app-navigation";

export async function AppShell({ children, title }: { children: React.ReactNode; title: string }) {
  const { supabase, permissions, profile } = await requireUser();
  const { data: settings } = await supabase.from("company_settings").select("logo_url").eq("id", true).maybeSingle();
  const canSeeCrm = permissions.some((p) => ["atendimento", "gerencia", "direcao", "admin_owner"].includes(p));
  const canSeeFinancial = permissions.some((p) => ["financeiro", "gerencia", "direcao", "admin_owner"].includes(p));
  const navigation = <AppNavigation canSeeCrm={canSeeCrm} canSeeFinancial={canSeeFinancial} />;
  const brand = <Link href="/painel" className="sunrise-brand" aria-label="Sunrise Celebrations — início">
    {settings?.logo_url ? <Image src={settings.logo_url} alt="Sunrise Celebrations" width={220} height={70} unoptimized className="max-h-16 w-auto max-w-full object-contain" /> : <><span className="brand-sun" aria-hidden="true">☀</span><span>sunrise<span className="brand-caption">CELEBRATIONS</span></span></>}
  </Link>;
  return <div className="workspace">
    <a className="skip-link" href="#main-content">Pular para o conteúdo</a>
    <aside className="workspace-sidebar">
      {brand}
      <div className="workspace-label">SEU ESPAÇO DE GESTÃO</div>
      {navigation}
      <div className="sidebar-account"><span className="avatar">{(profile.display_name || "S").slice(0, 1).toUpperCase()}</span><div><strong>{profile.display_name || "Equipe Sunrise"}</strong><span>Sunrise Celebrations</span></div><form action={signOut}><button aria-label="Sair da conta" title="Sair da conta">↗</button></form></div>
    </aside>
    <div className="workspace-main">
      <header className="workspace-topbar">
        <details className="mobile-navigation"><summary aria-label="Abrir navegação">☰ <span>Menu</span></summary><div className="mobile-navigation-panel">{brand}{navigation}<form action={signOut}><button className="workspace-button secondary">Sair da conta</button></form></div></details>
        <p className="workspace-breadcrumb">Sunrise <span>/</span> <strong>{title}</strong></p>
        <Link href="/ajuda" className="help-link"><span aria-hidden="true">?</span> Ajuda</Link>
      </header>
      <main id="main-content" className="workspace-content" tabIndex={-1}>
        <h1 className="workspace-title">{title}</h1>
        {children}
      </main>
    </div>
  </div>;
}
