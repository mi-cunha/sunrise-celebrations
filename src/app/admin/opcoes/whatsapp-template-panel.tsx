"use client";

import { useActionState } from "react";
import type { WhatsAppTemplateSummary } from "@/lib/whatsapp-review";
import { createWhatsAppTemplateAction, type WhatsAppTemplateFormState } from "./whatsapp-template-actions";

const initialState: WhatsAppTemplateFormState = {};

export function WhatsAppTemplatePanel({ configured, loadError, templates, operationId }: { configured: boolean; loadError?: string; templates: WhatsAppTemplateSummary[]; operationId: string }) {
  const [state, action, pending] = useActionState(createWhatsAppTemplateAction, initialState);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-[#092f38]">Modelos do ambiente de avaliação</h3>
        <p className="mt-1 text-xs text-[#5f7180]">Área isolada para demonstrar à Meta a permissão de gerenciamento. O token nunca é exibido no navegador.</p>
      </div>

      {!configured && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Conclua a configuração e a verificação do ambiente de avaliação antes de criar modelos.</p>}
      {loadError && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{loadError}</p>}

      {configured && (
        <form action={action} className="grid gap-3 rounded-lg border border-[#d9ded8] bg-white p-3 sm:grid-cols-[minmax(180px,0.7fr)_minmax(260px,1.3fr)_auto] sm:items-end">
          <input type="hidden" name="operationId" value={operationId} />
          <div>
            <label htmlFor="whatsapp-template-name" className="text-sm font-semibold">Nome técnico</label>
            <input id="whatsapp-template-name" name="name" required defaultValue={`sunrise_confirmacao_${operationId.slice(0, 8)}`} className="mt-1" />
            {state.fieldErrors?.name?.[0] && <p className="mt-1 text-xs text-red-700">{state.fieldErrors.name[0]}</p>}
          </div>
          <div>
            <label htmlFor="whatsapp-template-body" className="text-sm font-semibold">Mensagem</label>
            <input id="whatsapp-template-body" name="body" required defaultValue="Olá! Recebemos sua solicitação de orçamento para um evento no Sunrise Celebrations. Nossa equipe dará continuidade ao seu atendimento por aqui." className="mt-1" />
            {state.fieldErrors?.body?.[0] && <p className="mt-1 text-xs text-red-700">{state.fieldErrors.body[0]}</p>}
          </div>
          <button disabled={pending || Boolean(state.success || state.error)} className="rounded-lg bg-[#083653] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{pending ? "Enviando…" : "Criar modelo"}</button>
        </form>
      )}

      {state.error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{state.error}</p>}
      {state.success && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{state.success}</p>}

      {templates.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-[#d9ded8] bg-white">
          {templates.map((template) => (
            <div key={template.id} className="grid gap-1 border-b border-[#d9ded8] px-3 py-2 text-sm last:border-0 sm:grid-cols-[1fr_140px_100px]">
              <span className="font-semibold text-[#092f38]">{template.name}</span>
              <span className="text-[#5f7180]">{template.category}</span>
              <span className="text-[#5f7180]">{template.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
