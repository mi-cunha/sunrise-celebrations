import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { SetupNotice } from "@/components/setup-notice";
import { requireUser } from "@/lib/auth";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { canManageLeads } from "@/lib/domain/lead";

export default async function Dashboard() {
  if (!hasSupabaseConfig()) return <SetupNotice />;

  const { supabase, permissions } = await requireUser();
  const { data: leads } = await supabase.from("leads").select("id,name,company,phone,status,created_at").order("created_at", { ascending: false }).limit(20);
  const allowed = canManageLeads(permissions);

  return (
    <AppShell title="Painel comercial">
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <p className="text-slate-600">Acompanhe os leads recentes.</p>
        <div className="flex flex-wrap gap-3">
          <Link href="/atendimentos" className="rounded-lg border border-[#dbe3dc] px-4 py-3 font-semibold text-[#18352d]">
            Atendimentos
          </Link>
          <Link href="/eventos" className="rounded-lg border border-[#dbe3dc] px-4 py-3 font-semibold text-[#18352d]">
            Eventos
          </Link>
          {permissions.includes("admin_owner") && (
            <Link href="/admin/opcoes" className="rounded-lg border border-[#dbe3dc] px-4 py-3 font-semibold text-[#18352d]">
              Opções
            </Link>
          )}
          {permissions.includes("admin_owner") && (
            <Link href="/admin/usuarios" className="rounded-lg border border-[#dbe3dc] px-4 py-3 font-semibold text-[#18352d]">
              Usuários
            </Link>
          )}
          {allowed && (
            <Link href="/leads/novo" className="rounded-lg bg-[#18352d] px-4 py-3 font-semibold text-white">
              Novo lead
            </Link>
          )}
        </div>
      </div>
      <section className="mt-6 overflow-hidden rounded-xl border border-[#dbe3dc] bg-white">
        {leads?.length ? (
          <ul>
            {leads.map((lead) => (
              <li key={lead.id} className="flex items-center justify-between border-b border-[#edf1ee] p-4 last:border-0">
                <div>
                  <Link href={`/leads/${lead.id}`} className="font-semibold underline-offset-4 hover:underline">
                    {lead.name}
                  </Link>
                  <p className="text-sm text-slate-600">{lead.company ? `${lead.company} · ${lead.phone}` : lead.phone}</p>
                </div>
                <span className="rounded-full bg-[#edf5ee] px-3 py-1 text-sm text-[#356451]">{lead.status.replaceAll("_", " ")}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="p-8">
            <h2 className="font-semibold">Ainda não há leads.</h2>
            <p className="mt-1 text-slate-600">{allowed ? "Cadastre o primeiro contato para iniciar o funil." : "Quando a equipe cadastrar contatos, eles aparecerão aqui."}</p>
          </div>
        )}
      </section>
    </AppShell>
  );
}
