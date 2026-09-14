"use client";

import { useActionState } from "react";
import { sendReviewMessageAction, type ReviewSendState } from "./actions";

export function ReviewSendPanel({ operationId, recipient, body, ready, sendAction = sendReviewMessageAction, externalReviewer = false }: { operationId: string; recipient: string; body?: string; ready: boolean; sendAction?: typeof sendReviewMessageAction; externalReviewer?: boolean }) {
  const [state, action, pending] = useActionState(sendAction, {} as ReviewSendState);
  return <section className="space-y-4 rounded-xl border border-[#d9ded8] bg-white p-5">
    <h2 className="text-lg font-semibold">1. Enviar mensagem pelo Sunrise OS</h2>
    <p className="text-sm text-[#5f7180]">Modelo oficial de teste: hello_world · en_US. O envio é real; não conecta o número corporativo.</p>
    {body && <blockquote className="whitespace-pre-wrap rounded-lg bg-[#eef5ef] p-4 text-sm">{body}</blockquote>}
    {!ready && <p className="text-sm text-amber-800">Envio bloqueado até validar a configuração e o modelo aprovado.</p>}
    <form action={action} className="space-y-3">
      <input type="hidden" name="operationId" value={operationId} />
      <label style={{ display: "flex", alignItems: "center", gap: 8 }}><input style={{ width: 16, height: 16, padding: 0, flexShrink: 0 }} type="checkbox" name="consent" required disabled={!ready || pending} /> {externalReviewer ? "Confirmo o envio ao destinatário de teste autorizado pela equipe:" : "Confirmo meu destinatário autorizado para esta demonstração:"} {recipient ? `+${recipient}` : "número a configurar"}.</label>
      <button disabled={!ready || pending || Boolean(state.error || state.messageId)} className="rounded-lg bg-[#083653] px-4 py-2 font-semibold text-white disabled:opacity-50">{pending ? "Enviando à Meta…" : "Enviar mensagem de demonstração"}</button>
    </form>
    {state.error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{state.error}</p>}
    {state.messageId && <div role="status" className="space-y-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900"><p>Mensagem aceita pela API da Meta. Confira o recebimento no WhatsApp do destinatário.</p><p className="break-all">ID: {state.messageId}</p>{state.warning && <p>{state.warning}</p>}</div>}
    {(state.error || state.messageId) && <p className="text-xs text-[#5f7180]">Não há reenvio automático. Após conferir o WhatsApp, recarregue a página somente se quiser iniciar uma nova tentativa.</p>}
  </section>;
}
