"use client";

import { useRef, useState } from "react";
import { useActionState } from "react";
import { addCustomerMessage, addHumanMessage, type ConversationFormState } from "../actions";

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

export function HumanReplyForm({ conversationId, disabled = false, templates = [] }: { conversationId: string; disabled?: boolean; templates?: ResponseTemplate[] }) {
  const [state, action, pending] = useActionState(addHumanMessage, initialState);
  return (
    <ConversationMessageForm
      key={state.version ?? "human-initial"}
      action={action}
      conversationId={conversationId}
      disabled={disabled || pending}
      fieldLabel="Resposta do atendente"
      buttonLabel={pending ? "Enviando..." : "Enviar resposta humana"}
      helperText="Ao responder, o atendimento fica assumido por humano e a IA permanece pausada."
      state={state}
      variant="human"
      templates={templates}
    />
  );
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
