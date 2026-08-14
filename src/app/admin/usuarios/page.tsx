import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { SetupNotice } from "@/components/setup-notice";
import { requireUser } from "@/lib/auth";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { UserAccessForm } from "./user-access-form";

type ProfileRow = {
  id: string;
  display_name: string | null;
  is_active: boolean;
  user_permissions: { permission: string }[] | null;
};

export default async function UsersAdminPage() {
  if (!hasSupabaseConfig()) return <SetupNotice />;
  const { supabase, permissions } = await requireUser();
  if (!permissions.includes("admin_owner")) {
    return (
      <AppShell title="Acesso restrito">
        <p className="mt-4 text-slate-600">Apenas administradores podem gerenciar usuários.</p>
        <Link href="/painel" className="mt-6 inline-block text-sm font-semibold text-[#356451] underline">
          Voltar ao painel
        </Link>
      </AppShell>
    );
  }

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id,display_name,is_active,user_permissions(permission)")
    .order("display_name");

  const users = ((profiles ?? []) as unknown as ProfileRow[]).map((profile) => ({
    id: profile.id,
    display_name: profile.display_name,
    is_active: profile.is_active,
    permissions: profile.user_permissions?.map((row) => row.permission) ?? [],
  }));
  const activeUsers = users.filter((user) => user.is_active).length;
  const owners = users.filter((user) => user.permissions.includes("admin_owner")).length;
  const attendants = users.filter((user) => user.permissions.includes("atendimento") || user.permissions.includes("admin_owner")).length;

  return (
    <AppShell title="Usuários">
      <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <p className="max-w-2xl text-slate-600">
          Gerencie quem pode acessar o Sunrise OS. O usuário precisa existir primeiro no Auth do Supabase; depois você cola o UUID aqui e define nome, status e permissões.
        </p>
        <Link href="/painel" className="text-sm font-semibold text-[#356451] underline underline-offset-4">
          Voltar ao painel
        </Link>
      </div>

      {error && <p className="mt-6 rounded-lg bg-red-50 p-3 text-sm text-red-800">Não foi possível carregar usuários: {error.message}</p>}

      <section className="mt-8 grid gap-3 sm:grid-cols-3">
        <MetricCard label="Usuários ativos" value={activeUsers} />
        <MetricCard label="Atendentes" value={attendants} />
        <MetricCard label="Administradores" value={owners} />
      </section>

      <details className="mt-8 rounded-xl border border-[#dbe3dc] bg-white p-5">
        <summary className="cursor-pointer font-semibold text-[#18352d]">Adicionar usuário</summary>
        <p className="mt-2 text-sm text-slate-600">
          Use este bloco para liberar acesso a alguém que já foi criado no Supabase Auth. Cole o UUID do Auth, escolha um nome amigável e marque as permissões.
        </p>
        <div className="mt-5">
          <UserAccessForm mode="create" />
        </div>
      </details>

      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Usuários cadastrados</h2>
          <p className="text-sm text-slate-500">{users.length} usuário(s) no perfil interno</p>
        </div>

        {users.length ? (
          <div className="mt-4 grid gap-4">
            {users.map((user) => (
              <UserAccessForm key={user.id} user={user} mode="edit" />
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-[#dbe3dc] bg-white p-8">
            <h3 className="font-semibold">Nenhum usuário cadastrado.</h3>
            <p className="mt-1 text-slate-600">Adicione o primeiro perfil interno usando o UUID do Supabase Auth.</p>
          </div>
        )}
      </section>
    </AppShell>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-[#dbe3dc] bg-white p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-[#18352d]">{value}</p>
    </div>
  );
}
