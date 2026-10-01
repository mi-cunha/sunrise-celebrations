"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { startConversationFromLead, type StartConversationState } from "./start-conversation-actions";

type Template = { id: string; title: string; body: string; whatsapp_template_name: string | null };
const initialState: StartConversationState = {};

export function StartConversationForm({ leadId, leadName, templates }: { leadId: string; leadName: string; templates: Template[] }) {
  const [state, action, pending] = useActionState(startConversationFromLead, initialState);
  const [templateId, setTemplateId] = useState(state.values?.templateId ?? templates[0]?.id ?? "");
  const selected = useMemo(() => templates.find((template) => template.id === templateId), [templateId, templates]);
  const [body, setBody] = useState(state.values?.body ?? applyName(selected?.body ?? "", leadName));

  function selectTemplate(id: string) {
    setTemplateId(id);
    setBody(applyName(templates.find((template) => template.id === id)?.body ?? "", leadName));
  }

  return <section className="rounded-lg border border-[#cce3ef] bg-[#f7fbfe] p-4">
    <h2 className="font-semibold text-[#083653]">Iniciar conversa</h2>
    <p className="mt-1 text-sm text-slate-600">Envie um template aprovado pelo WhatsApp. A mensagem será revisada antes do envio e abrirá o atendimento na Inbox.</p>
    {!templates.length ? <p className="mt-3 rounded-md bg-amber-50 p-3 text-sm text-amber-800">Não há mensagens-modelo ativas para iniciar o atendimento.</p> : <form action={action} className="mt-4 space-y-3">
      <input type="hidden" name="leadId" value={leadId} />
      <div><label htmlFor="crm-initial-template">Mensagem-modelo</label><select id="crm-initial-template" name="templateId" value={templateId} onChange={(event) => selectTemplate(event.currentTarget.value)}>{templates.map((template) => <option key={template.id} value={template.id}>{template.title}{template.whatsapp_template_name ? "" : " · precisa configurar na Meta"}</option>)}</select></div>
      <div><label htmlFor="crm-initial-body">Prévia da mensagem</label><textarea id="crm-initial-body" name="body" rows={4} value={body} onChange={(event) => setBody(event.currentTarget.value)} />{state.fieldErrors?.body?.[0] && <p className="mt-1 text-sm text-red-700">{state.fieldErrors.body[0]}</p>}</div>
      {!selected?.whatsapp_template_name && <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">Este modelo precisa do nome técnico do template aprovado pela Meta antes de poder ser enviado.</p>}
      <label className="flex items-start gap-2 text-sm text-slate-700"><input name="confirmed" type="checkbox" className="mt-1" /> <span>Revisei a mensagem e confirmo o envio pelo WhatsApp oficial.</span></label>
      {state.error && <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">{state.error}</p>}
      {state.success && <p role="status" className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-900">{state.success} {state.conversationId && <Link className="font-semibold underline" href={`/atendimentos/${state.conversationId}`}>Abrir atendimento</Link>}</p>}
      {state.conversationId && state.error && <Link className="inline-block text-sm font-semibold text-[#0f5f8f] underline" href={`/atendimentos/${state.conversationId}`}>Abrir atendimento criado</Link>}
      <button disabled={pending || !selected?.whatsapp_template_name} className="rounded-lg bg-[#0f5f8f] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{pending ? "Enviando..." : "Confirmar e iniciar conversa"}</button>
    </form>}
  </section>;
}

function applyName(body: string, name: string) { return body.replaceAll("{{nome}}", name); }
