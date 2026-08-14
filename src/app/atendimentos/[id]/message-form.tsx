"use client";

import { useState } from "react";
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

export function HumanReplyForm({ conversationId, disabled = false, templates = [] }: { conversationId: string; disabled?: boolean; templates?: { title: string; body: string }[] }) {
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
  templates?: { title: string; body: string }[];
}) {
  const [body, setBody] = useState(state.values?.body ?? "");
  const buttonClass =
    variant === "human"
      ? "bg-[#18352d] text-white shadow-sm hover:bg-[#23483d] hover:shadow active:bg-[#102820]"
      : "border border-[#dbe3dc] bg-white text-[#18352d] hover:border-[#b7c8bb] hover:bg-[#f6fbf7] active:bg-[#edf5ee]";

  return (
    <form action={action} className="space-y-3 rounded-xl border border-[#dbe3dc] bg-white p-4">
      <input type="hidden" name="conversationId" value={conversationId} />
      <div>
        <label htmlFor={`${variant}-body`} className="font-semibold text-[#18352d]">
          {fieldLabel}
        </label>
        <p className="mt-1 text-xs text-slate-500">{helperText}</p>
        {variant === "human" && templates.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {templates.map((template) => (
              <button
                key={template.title}
                type="button"
                disabled={disabled}
                onClick={() => setBody(template.body)}
                className="rounded-full border border-[#dbe3dc] px-3 py-1 text-xs font-semibold text-[#18352d] transition hover:border-[#b7c8bb] hover:bg-[#f6fbf7] active:scale-[0.98]"
              >
                {template.title}
              </button>
            ))}
          </div>
        )}
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
