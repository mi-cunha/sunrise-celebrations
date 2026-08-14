"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

export function ResetPasswordForm() {
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("Validando link de recuperação...");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    async function prepareRecoverySession() {
      const supabase = createClient();
      const code = new URLSearchParams(window.location.search).get("code");

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setMessage(`Link de recuperação inválido ou expirado: ${error.message}`);
          return;
        }
      }

      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        if (error) {
          setMessage(`Link de recuperação inválido ou expirado: ${error.message}`);
          return;
        }
        window.history.replaceState(null, "", window.location.pathname);
      }

      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setMessage("Abra esta tela pelo link enviado por e-mail para redefinir sua senha.");
        return;
      }

      setReady(true);
      setMessage("Digite uma nova senha para concluir o acesso.");
    }

    void prepareRecoverySession();
  }, []);

  async function updatePassword(form: FormData) {
    const password = String(form.get("password"));
    const confirmation = String(form.get("confirmation"));

    if (password.length < 8) {
      setMessage("Use uma senha com pelo menos 8 caracteres.");
      return;
    }

    if (password !== confirmation) {
      setMessage("As senhas não conferem.");
      return;
    }

    setLoading(true);
    const { error } = await createClient().auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setMessage(`Não foi possível salvar a nova senha: ${error.message}`);
      return;
    }

    setMessage("Senha atualizada. Você já pode entrar.");
    router.push("/login");
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#f6f0e5] p-6">
      <section className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold tracking-[.22em] text-[#4c7a64]">SUNRISE CELEBRATIONS</p>
        <h1 className="mt-3 text-3xl font-semibold">Redefinir senha</h1>
        <p role="status" className="mt-4 rounded-lg bg-[#fff5e6] p-3 text-sm text-[#744c15]">
          {message}
        </p>
        <form action={updatePassword} className="mt-8 space-y-5">
          <div>
            <label htmlFor="password">Nova senha</label>
            <input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required disabled={!ready} />
          </div>
          <div>
            <label htmlFor="confirmation">Confirmar senha</label>
            <input id="confirmation" name="confirmation" type="password" autoComplete="new-password" minLength={8} required disabled={!ready} />
          </div>
          <button disabled={!ready || loading} className="w-full rounded-lg bg-[#18352d] px-4 py-3 font-semibold text-white disabled:opacity-60">
            {loading ? "Salvando..." : "Salvar nova senha"}
          </button>
        </form>
        <Link href="/login" className="mt-5 inline-block text-sm font-semibold text-[#356451] underline underline-offset-4">
          Voltar ao login
        </Link>
      </section>
    </main>
  );
}
