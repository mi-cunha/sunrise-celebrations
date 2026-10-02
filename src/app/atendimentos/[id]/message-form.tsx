"use client";

import { useEffect, useRef, useState } from "react";
import { useActionState } from "react";
import { addCustomerMessage, addHumanMessage, sendConversationTemplate, type ConversationFormState } from "../actions";
import { canSendFreeWhatsApp, getWhatsAppWindow, whatsappWindowLabel, type WhatsAppWindow } from "@/lib/whatsapp-window";

const initialState: ConversationFormState = {};

export function CustomerMessageForm({ conversationId, disabled = false }: { conversationId: string; disabled?: boolean }) {
  const [state, action, pending] = useActionState(addCustomerMessage, initialState);
  return (
    <ConversationMessageForm
      key={state.version ?? "customer-initial"}
      action={action}
      conversationId={conversationId}
      disabled={disabled || pending}
      fieldLabel="Simular nova mensagem do cliente"
      buttonLabel={pending ? "Registrando..." : "Registrar mensagem do cliente"}
      helperText="Use para testar novas entradas do cliente dentro da simulação."
      state={state}
      variant="customer"
    />
  );
}

type ResponseTemplate = { title: string; body: string; category?: string | null };

const categoryOrder = [
  "Primeiro contato",
  "Perfil do evento",
  "Proposta",
  "Visita",
  "Pós-visita e reserva",
  "Acompanhamento",
  "Dúvidas e objeções",
  "Encerramento",
  "Outras respostas",
];

type ApprovedTemplate = { id: string; title: string; body: string; whatsapp_template_name: string | null };

export function HumanReplyForm({ conversationId, disabled = false, templates = [], approvedTemplates = [], lastInboundAt = null, whatsapp = false }: { conversationId: string; disabled?: boolean; templates?: ResponseTemplate[]; approvedTemplates?: ApprovedTemplate[]; lastInboundAt?: string | null; whatsapp?: boolean }) {
  const [state, action, pending] = useActionState(addHumanMessage, initialState);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(timer); }, []);
  const windowState = getWhatsAppWindow(lastInboundAt, now);
  const canSendFree = canSendFreeWhatsApp(windowState);
  return (
    <div className="space-y-3">
      {whatsapp && <WhatsAppWindowBanner windowState={windowState} />}
      {(!whatsapp || canSendFree) ? <ConversationMessageForm
      key={state.version ?? "human-initial"}
      action={action}
      conversationId={conversationId}
      disabled={disabled || pending || !canSendFree}
      fieldLabel="Resposta do atendente"
      buttonLabel={pending ? "Enviando..." : "Enviar resposta humana"}
      helperText="Ao responder, o atendimento fica assumido por humano e a IA permanece pausada."
      state={state}
      variant="human"
      templates={templates}
      /> : <ApprovedTemplateForm conversationId={conversationId} disabled={disabled} templates={approvedTemplates} />}
    </div>
  );
}

function WhatsAppWindowBanner({ windowState }: { windowState: WhatsAppWindow }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(timer); }, []);
  const current = getWhatsAppWindow(windowState.lastInboundAt, now);
  const tone = current.state === "active" ? "bg-emerald-50 text-emerald-900" : current.state === "closing" ? "bg-amber-50 text-amber-900" : "bg-slate-100 text-slate-700";
  const last = current.lastInboundAt ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(current.lastInboundAt)) : "—";
  const expires = current.expiresAt ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(current.expiresAt)) : null;
  const remaining = current.remainingMs > 0 ? `${Math.floor(current.remainingMs / 3_600_000)}h ${Math.floor((current.remainingMs % 3_600_000) / 60_000)}min` : null;
  return <div role="status" className={`rounded-lg p-3 text-sm ${tone}`}><strong>◷ {whatsappWindowLabel(current)}</strong><p className="mt-1">{current.state === "expired" ? "Para retomar o contato, envie um template aprovado." : current.state === "not_started" ? "Use um template aprovado para iniciar o contato." : `${current.state === "closing" ? "A janela está próxima de encerrar. " : ""}Responda até ${expires} · faltam ${remaining}.`}</p><p className="mt-1 text-xs">Última mensagem do cliente: {last}</p></div>;
}

function ApprovedTemplateForm({ conversationId, disabled, templates }: { conversationId: string; disabled: boolean; templates: ApprovedTemplate[] }) {
  const [state, action, pending] = useActionState(sendConversationTemplate, initialState);
  const [templateId, setTemplateId] = useState(templates.find((template) => template.whatsapp_template_name)?.id ?? "");
  const available = templates.filter((template) => template.whatsapp_template_name);
  return <form action={(data) => { data.set("requestId", crypto.randomUUID()); action(data); }} className="rounded-xl border border-amber-300 bg-amber-50 p-4"><h2 className="font-semibold text-[#083653]">Usar template aprovado</h2><p className="mt-1 text-xs text-amber-900">Mensagens livres e documentos comuns ficam bloqueados até uma nova mensagem do cliente.</p><input type="hidden" name="conversationId" value={conversationId} /><div className="mt-3"><label htmlFor="approved-template">Template</label><select id="approved-template" name="templateId" value={templateId} onChange={(event) => setTemplateId(event.currentTarget.value)} disabled={disabled || pending}>{available.map((template) => <option key={template.id} value={template.id}>{template.title}</option>)}</select></div>{!available.length && <p className="mt-3 text-sm text-red-800">Não há template aprovado configurado. Peça a configuração em Mensagens do CRM.</p>}{state.error && <p role="alert" className="mt-3 text-sm text-red-800">{state.error}</p>}{state.success && <p role="status" className="mt-3 text-sm text-emerald-900">{state.success}</p>}<button type="submit" disabled={disabled || pending || !templateId} className="mt-3 rounded-lg bg-[#0f5f8f] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{pending ? "Enviando..." : "Usar template"}</button></form>;
}

function ConversationMessageForm({
  action,
  conversationId,
  disabled,
  fieldLabel,
  buttonLabel,
  helperText,
  state,
  variant,
  templates = [],
}: {
  action: (payload: FormData) => void;
  conversationId: string;
  disabled: boolean;
  fieldLabel: string;
  buttonLabel: string;
  helperText: string;
  state: ConversationFormState;
  variant: "customer" | "human";
  templates?: ResponseTemplate[];
}) {
  const [body, setBody] = useState(state.values?.body ?? "");
  const requestId = useRef(state.values?.requestId ?? "");
  const buttonClass =
    variant === "human"
      ? "bg-[#0f5f8f] text-white shadow-sm hover:bg-[#083653] hover:shadow active:bg-[#06283d]"
      : "border border-[#dbe3dc] bg-white text-[#18352d] hover:border-[#b7c8bb] hover:bg-[#f6fbf7] active:bg-[#edf5ee]";

  return (
    <form action={(data) => {
      requestId.current ||= crypto.randomUUID();
      data.set("requestId", requestId.current);
      action(data);
    }} className="space-y-3 rounded-xl border border-[#dbe3dc] bg-white p-4">
      <input type="hidden" name="conversationId" value={conversationId} />
      <div>
        <label htmlFor={`${variant}-body`} className="font-semibold text-[#18352d]">
          {fieldLabel}
        </label>
        <p className="mt-1 text-xs text-slate-500">{helperText}</p>
        {variant === "human" && templates.length > 0 && <ResponseTemplatePicker disabled={disabled} onSelect={setBody} templates={templates} />}
        <textarea
          id={`${variant}-body`}
          name="body"
          rows={3}
          required
          disabled={disabled}
          value={body}
          onChange={(event) => setBody(event.currentTarget.value)}
          className={`mt-3 ${state.fieldErrors?.body ? "border-red-500 bg-red-50" : ""}`}
        />
        {state.fieldErrors?.body?.[0] && <p className="mt-1 text-sm text-red-700">{state.fieldErrors.body[0]}</p>}
      </div>
      {state.error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{state.error}</p>}
      {state.success && <p role="status" className="rounded-lg bg-[#edf5ee] p-3 text-sm text-[#356451]">{state.success}</p>}
      <button disabled={disabled} className={`rounded-lg px-5 py-3 font-semibold transition active:scale-[0.99] disabled:opacity-60 ${buttonClass}`}>
        {buttonLabel}
      </button>
    </form>
  );
}

function ResponseTemplatePicker({ disabled, onSelect, templates }: { disabled: boolean; onSelect: (body: string) => void; templates: ResponseTemplate[] }) {
  const groups = new Map<string, ResponseTemplate[]>();

  for (const template of templates) {
    const category = template.category?.trim() || "Outras respostas";
    const group = groups.get(category) ?? [];
    group.push(template);
    groups.set(category, group);
  }

  const orderedGroups = [...groups.entries()].sort(([left], [right]) => {
    const leftIndex = categoryOrder.indexOf(left);
    const rightIndex = categoryOrder.indexOf(right);
    return (leftIndex === -1 ? categoryOrder.length : leftIndex) - (rightIndex === -1 ? categoryOrder.length : rightIndex) || left.localeCompare(right, "pt-BR");
  });

  return (
    <div className="mt-3 space-y-2" aria-label="Respostas prontas">
      <p className="text-xs font-semibold text-[#356451]">Respostas prontas</p>
      {orderedGroups.map(([category, group], index) => (
        <details key={category} open={index === 0} className="overflow-hidden rounded-lg border border-[#dbe3dc] bg-[#fbfdfd]">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-xs font-semibold text-[#18352d] hover:bg-[#edf5ee]">
            <span>{category}</span>
            <span className="rounded-full bg-[#e6f1f6] px-2 py-0.5 text-[10px] text-[#0f5f8f]">{group.length}</span>
          </summary>
          <div className="grid gap-2 border-t border-[#e4ece7] p-2 sm:grid-cols-2">
            {group.map((template) => (
              <button
                key={template.title}
                type="button"
                disabled={disabled}
                onClick={() => onSelect(template.body)}
                className="min-h-0 rounded-md border border-[#dbe3dc] bg-white px-3 py-2 text-left text-xs font-semibold text-[#18352d] transition hover:border-[#8bb3ca] hover:bg-[#f2f9fc] active:scale-[0.99] disabled:opacity-60"
              >
                {template.title}
              </button>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}
