"use client";

import { useActionState } from "react";
import { contractedEventCostCategories, contractedEventCostCategoryLabel, contractedEventCostStatuses, contractedEventCostStatusLabel } from "@/lib/domain/contracted-event";
import { formatCurrencyFromCents } from "@/lib/domain/quote";
import { addContractedEventCost, removeContractedEventCost, updateContractedEventCost, type ContractedEventFormState } from "../actions";

export type EventCost = { id: string; category: string; status: string; description: string; estimated_amount_cents: number; actual_amount_cents: number | null; due_date: string | null; notes: string | null };
const initialState: ContractedEventFormState = {};

export function CostForm({ eventId }: { eventId: string }) {
  const [state, action, pending] = useActionState(addContractedEventCost, initialState);
  return <details className="rounded-lg border border-[#dbe3dc] bg-[#fbf8f1]">
    <summary className="cursor-pointer list-none p-3 font-semibold text-[#18352d] hover:bg-white">+ Adicionar custo</summary>
    <form key={state.version ?? "new-cost"} action={action} className="border-t border-[#edf1ee] bg-white p-4">
      <input type="hidden" name="eventId" value={eventId} /><CostFields errors={state.fieldErrors ?? {}} values={state.values} />
      <Feedback state={state} />
      <button disabled={pending} className="mt-4 rounded-lg bg-[#083653] px-4 py-2.5 font-semibold text-white disabled:opacity-60">{pending ? "Adicionando..." : "Adicionar custo"}</button>
    </form>
  </details>;
}

export function CostCard({ eventId, cost }: { eventId: string; cost: EventCost }) {
  const [editState, editAction, editPending] = useActionState(updateContractedEventCost, initialState);
  const [removeState, removeAction, removePending] = useActionState(removeContractedEventCost, initialState);
  const amount = cost.actual_amount_cents ?? cost.estimated_amount_cents;
  return <details className="group rounded-lg border border-[#edf1ee] bg-[#fbf8f1]">
    <summary className="cursor-pointer list-none p-3">
      <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-[#0f5f8f]">{contractedEventCostCategoryLabel(cost.category)} · {contractedEventCostStatusLabel(cost.status)}</p><p className="mt-1 font-medium text-[#18352d]">{cost.description}</p><p className="mt-1 text-sm text-slate-600">{formatCurrencyFromCents(amount)}{cost.actual_amount_cents === null ? " previsto" : " realizado"}</p></div><span className="text-xs font-semibold text-[#356451] group-open:hidden">Editar</span></div>
    </summary>
    <div className="border-t border-[#edf1ee] bg-white p-4">
      <form key={editState.version ?? cost.id} action={editAction}><input type="hidden" name="eventId" value={eventId} /><input type="hidden" name="costId" value={cost.id} /><CostFields cost={cost} errors={editState.fieldErrors ?? {}} values={editState.values} /><Feedback state={editState} /><button disabled={editPending} className="mt-4 rounded-lg bg-[#083653] px-4 py-2.5 font-semibold text-white disabled:opacity-60">{editPending ? "Salvando..." : "Salvar custo"}</button></form>
      <form action={removeAction} className="mt-3"><input type="hidden" name="eventId" value={eventId} /><input type="hidden" name="costId" value={cost.id} /><Feedback state={removeState} /><button disabled={removePending} className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60">{removePending ? "Removendo..." : "Remover custo"}</button></form>
    </div>
  </details>;
}

function CostFields({ cost, errors, values }: { cost?: EventCost; errors: Record<string, string[]>; values?: Record<string, string> }) {
  const id = cost?.id ?? "new";
  return <div className="grid gap-4">
    <div className="grid gap-4 md:grid-cols-2"><div><label htmlFor={`cost-description-${id}`}>Descrição</label><input id={`cost-description-${id}`} name="description" required defaultValue={values?.description ?? cost?.description ?? ""} className={errors.description ? "border-red-500 bg-red-50" : ""} />{error(errors.description)}</div><div><label htmlFor={`cost-category-${id}`}>Categoria</label><select id={`cost-category-${id}`} name="category" defaultValue={values?.category ?? cost?.category ?? "fornecedor"}>{contractedEventCostCategories.map((v) => <option key={v} value={v}>{contractedEventCostCategoryLabel(v)}</option>)}</select></div></div>
    <div className="grid gap-4 md:grid-cols-2"><div><label htmlFor={`cost-estimated-${id}`}>Valor previsto</label><input id={`cost-estimated-${id}`} name="estimatedAmount" inputMode="decimal" required defaultValue={values?.estimatedAmount ?? money(cost?.estimated_amount_cents)} placeholder="Ex.: 1.500,00" className={errors.estimatedAmount ? "border-red-500 bg-red-50" : ""} />{error(errors.estimatedAmount)}</div><div><label htmlFor={`cost-actual-${id}`}>Valor realizado (opcional)</label><input id={`cost-actual-${id}`} name="actualAmount" inputMode="decimal" defaultValue={values?.actualAmount ?? money(cost?.actual_amount_cents)} placeholder="Preencha quando confirmado" />{error(errors.actualAmount)}</div></div>
    <div className="grid gap-4 md:grid-cols-2"><div><label htmlFor={`cost-status-${id}`}>Status</label><select id={`cost-status-${id}`} name="status" defaultValue={values?.status ?? cost?.status ?? "previsto"}>{contractedEventCostStatuses.map((v) => <option key={v} value={v}>{contractedEventCostStatusLabel(v)}</option>)}</select></div><div><label htmlFor={`cost-due-${id}`}>Vencimento</label><input id={`cost-due-${id}`} name="dueDate" type="date" defaultValue={values?.dueDate ?? cost?.due_date ?? ""} />{error(errors.dueDate)}</div></div>
    <div><label htmlFor={`cost-notes-${id}`}>Observações internas</label><textarea id={`cost-notes-${id}`} name="notes" rows={2} defaultValue={values?.notes ?? cost?.notes ?? ""} /></div>
  </div>;
}

function money(value: number | null | undefined) { return value === null || value === undefined ? "" : (value / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 }); }
function error(value?: string[]) { return value?.[0] ? <p className="mt-1 text-sm text-red-700">{value[0]}</p> : null; }
function Feedback({ state }: { state: ContractedEventFormState }) { return <>{state.error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{state.error}</p>}{state.success && <p role="status" className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{state.success}</p>}</>; }
