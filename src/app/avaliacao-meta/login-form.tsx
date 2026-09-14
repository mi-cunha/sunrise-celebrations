"use client";
import { useActionState } from "react";
import { reviewerLoginAction } from "./actions";

export function ReviewerLoginForm() {
  const [state, action, pending] = useActionState(reviewerLoginAction, {});
  return <form action={action} className="space-y-4 rounded-xl border bg-white p-6">
    <label className="block">Usuário<input name="username" autoComplete="username" required defaultValue="meta-review" /></label>
    <label className="block">Senha de avaliação<input name="password" type="password" autoComplete="current-password" required maxLength={256} /></label>
    <button disabled={pending} className="rounded-lg bg-[#083653] px-4 py-2 text-white disabled:opacity-50">{pending ? "Entrando…" : "Entrar na avaliação"}</button>
    {state.error && <p role="alert" className="text-red-800">{state.error}</p>}
  </form>;
}
