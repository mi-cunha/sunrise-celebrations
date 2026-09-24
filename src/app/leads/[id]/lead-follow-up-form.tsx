"use client";

import { useActionState, useState } from "react";
import { completeLeadFollowUp, saveLeadFollowUp, type LeadFollowUpState } from "./actions";

const initialState: LeadFollowUpState = {};
const actionSuggestions = [
  "Ligar para confirmar a visita",
  "Enviar apresentação",
  "Enviar proposta",
  "Fazer follow-up da proposta",
  "Confirmar número de convidados",
  "Confirmar data do evento",
  "Agendar visita",
  "Aguardar retorno do cliente",
] as const;

type Person = { id: string; display_name: string | null };
type LeadFollowUp = {
  id: string;
  next_action: string | null;
  next_action_at: string | null;
  next_action_assignee_id: string | null;
  responsible_id: string | null;
};

export function LeadFollowUpForm({ lead, people, currentUserId }: { lead: LeadFollowUp; people: Person[]; currentUserId: string }) {
  const [saveState, saveAction, saving] = useActionState(saveLeadFollowUp, initialState);
  const [completeState, completeAction, completing] = useActionState(completeLeadFollowUp, initialState);
  const values = saveState.values;
  const fieldErrors = saveState.fieldErrors ?? {};
  const hasFollowUp = Boolean(lead.next_action);
  const defaultAssignee = values?.nextActionAssigneeId ?? lead.next_action_assignee_id ?? lead.responsible_id ?? currentUserId;
  const initialAction = values?.nextAction ?? lead.next_action ?? "";
  const [nextAction, setNextAction] = useState(initialAction);
  const [selectedSuggestion, setSelectedSuggestion] = useState(actionSuggestions.includes(initialAction as (typeof actionSuggestions)[number]) ? initialAction : "manual");

  return (
    <section className="rounded-lg border border-[#dbe3dc] bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Próxima ação</h2>
          <p className="mt-1 text-sm text-slate-600">Acompanhamento manual do contato. Nenhuma mensagem é enviada automaticamente.</p>
        </div>
        {hasFollowUp && <span className="rounded-full bg-[#dcecf6] px-3 py-1 text-xs font-semibold text-[#083653]">Pendente</span>}
      </div>

      <form key={saveState.version ?? "lead-follow-up-initial"} action={saveAction} className="mt-4 grid gap-4 md:grid-cols-2">
        <input type="hidden" name="leadId" value={lead.id} />
        <div className="md:col-span-2">
          <label htmlFor="lead-next-action">Ação *</label>
          <select aria-label="Sugestão de próxima ação" value={selectedSuggestion} onChange={(event) => { setSelectedSuggestion(event.target.value); if (event.target.value !== "manual") setNextAction(event.target.value); }} className="mb-2">
            <option value="manual">Outra ação (escrever manualmente)</option>
            {actionSuggestions.map((suggestion) => <option key={suggestion} value={suggestion}>{suggestion}</option>)}
          </select>
          <input id="lead-next-action" name="nextAction" required maxLength={240} value={nextAction} onChange={(event) => setNextAction(event.target.value)} placeholder="Ex.: Ligar para confirmar a visita" className={fieldClass(fieldErrors.nextAction)} />
          <FieldError error={fieldErrors.nextAction?.[0]} />
        </div>
        <div>
          <label htmlFor="lead-next-action-at">Data *</label>
          <input id="lead-next-action-at" name="nextActionAt" type="date" required defaultValue={values?.nextActionAt ?? lead.next_action_at ?? ""} className={fieldClass(fieldErrors.nextActionAt)} />
          <FieldError error={fieldErrors.nextActionAt?.[0]} />
        </div>
        <div>
          <label htmlFor="lead-next-action-assignee">Responsável *</label>
          <select id="lead-next-action-assignee" name="nextActionAssigneeId" required defaultValue={defaultAssignee} className={fieldClass(fieldErrors.nextActionAssigneeId)}>
            <option value="">Selecione</option>
            {people.map((person) => <option key={person.id} value={person.id}>{person.display_name ?? "Usuário"}</option>)}
          </select>
          <FieldError error={fieldErrors.nextActionAssigneeId?.[0]} />
        </div>
        {saveState.error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800 md:col-span-2">{saveState.error}</p>}
        {saveState.success && <p role="status" className="rounded-lg bg-[#edf5ee] p-3 text-sm text-[#356451] md:col-span-2">{saveState.success}</p>}
        <div className="flex flex-wrap gap-3 md:col-span-2">
          <button disabled={saving} className="rounded-lg bg-[#18352d] px-5 py-3 font-semibold text-white transition hover:bg-[#23483d] disabled:opacity-60">{saving ? "Salvando..." : hasFollowUp ? "Atualizar próxima ação" : "Definir próxima ação"}</button>
        </div>
      </form>

      {hasFollowUp && (
        <form action={completeAction} className="mt-3">
          <input type="hidden" name="leadId" value={lead.id} />
          {completeState.error && <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{completeState.error}</p>}
          {completeState.success && <p role="status" className="mb-3 rounded-lg bg-[#edf5ee] p-3 text-sm text-[#356451]">{completeState.success}</p>}
          <button disabled={completing} className="rounded-lg border border-[#356451] px-5 py-3 font-semibold text-[#356451] transition hover:bg-[#edf5ee] disabled:opacity-60">{completing ? "Concluindo..." : "Concluir próxima ação"}</button>
        </form>
      )}
    </section>
  );
}

function FieldError({ error }: { error?: string }) { return error ? <p className="mt-1 text-sm text-red-700">{error}</p> : null; }
function fieldClass(errors?: string[]) { return errors?.length ? "border-red-500 bg-red-50" : ""; }
