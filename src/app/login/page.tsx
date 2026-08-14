import { SetupNotice } from "@/components/setup-notice";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { LoginForm } from "./login-form";

const loginErrorMessages: Record<string, string> = {
  inactive: "Seu usuário está inativo no Sunrise OS. Peça para a administração reativar o acesso.",
  missing_profile: "Seu login existe no Supabase, mas ainda falta criar seu perfil no Sunrise OS.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (!hasSupabaseConfig()) return <SetupNotice />;
  const { error } = await searchParams;
  return <LoginForm initialMessage={error ? loginErrorMessages[error] : undefined} shouldClearSession={error === "inactive" || error === "missing_profile"} />;
}
