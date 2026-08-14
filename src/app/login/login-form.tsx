"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

export function LoginForm({ initialMessage, shouldClearSession }: { initialMessage?: string; shouldClearSession: boolean }) {
  const [message, setMessage] = useState<string | undefined>(initialMessage);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (shouldClearSession) void createClient().auth.signOut();
  }, [shouldClearSession]);

  async function submit(form: FormData) {
    setLoading(true);
    setMessage(undefined);

    const { error } = await createClient().auth.signInWithPassword({
      email: String(form.get("email")).trim(),
      password: String(form.get("password")),
    });

    if (error) setMessage(authErrorMessage(error.message));
    else router.push("/painel");

    setLoading(false);
  }

  async function recover() {
    const email = (document.getElementById("email") as HTMLInputElement)?.value.trim();
    if (!email) {
      setMessage("Informe seu e-mail para recuperar a senha.");
      return;
    }

    const { error } = await createClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login/redefinir-senha`,
    });

    setMessage(error ? resetPasswordErrorMessage(error.message) : "Se o e-mail estiver cadastrado, você receberá as instruções para criar uma nova senha.");
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#f6f0e5] p-6">
      <section className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold tracking-[.22em] text-[#4c7a64]">SUNRISE CELEBRATIONS</p>
        <h1 className="mt-3 text-3xl font-semibold">Bem-vinda de volta</h1>
        <p className="mt-2 text-slate-600">Acesse a operação de eventos.</p>
        <form action={submit} className="mt-8 space-y-5">
          <div>
            <label htmlFor="email">E-mail</label>
            <input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div>
            <label htmlFor="password">Senha</label>
            <input id="password" name="password" type="password" autoComplete="current-password" required />
          </div>
          {message && (
            <p role="status" className="rounded-lg bg-[#fff5e6] p-3 text-sm text-[#744c15]">
              {message}
            </p>
          )}
          <button disabled={loading} className="w-full rounded-lg bg-[#18352d] px-4 py-3 font-semibold text-white disabled:opacity-60">
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
        <button onClick={recover} type="button" className="mt-5 text-sm font-semibold text-[#356451] underline underline-offset-4">
          Esqueci minha senha
        </button>
        <p className="mt-6 text-sm text-slate-500">Precisa de acesso? Fale com a administração.</p>
        <Link className="sr-only" href="/painel">
          Ir para painel
        </Link>
      </section>
    </main>
  );
}

function authErrorMessage(error: string) {
  const normalized = error.toLowerCase();
  if (normalized.includes("email not confirmed")) return "Seu e-mail ainda não foi confirmado no Supabase Auth.";
  if (normalized.includes("invalid login credentials")) return "O Supabase recusou este e-mail/senha. Redefina a senha no Auth ou confirme que está no mesmo projeto Supabase do ambiente.";
  return `O Supabase recusou o login: ${error}`;
}

function resetPasswordErrorMessage(error: string) {
  const normalized = error.toLowerCase();
  if (normalized.includes("rate limit")) {
    return "O Supabase bloqueou novos e-mails de recuperação por alguns minutos por limite de envio. Aguarde um pouco antes de tentar novamente.";
  }
  return `Não foi possível enviar a recuperação: ${error}`;
}
