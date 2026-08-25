"use client";

import { useActionState } from "react";
import { deleteCalendarEntry, saveCalendarEntry, type CalendarFormState } from "./actions";

const initialState: CalendarFormState = {};

export type CalendarEntryForForm = { id: string; title: string; entry_type: string; start_date: string; end_date: string; notes: string | null };

export function CalendarEntryForm({ entry, initialDate }: { entry?: CalendarEntryForForm; initialDate?: string }) {
  const [state, action, pending] = useActionState(saveCalendarEntry, initialState);
  const errors = state.fieldErrors ?? {};
  return (
    <form action={action} className="grid gap-3 md:grid-cols-2">
      {entry && <input type="hidden" name="id" value={entry.id} />}
      <div className="md:col-span-2">
        <label htmlFor={`calendar-title-${entry?.id ?? "new"}`}>Título</label>
        <input id={`calendar-title-${entry?.id ?? "new"}`} name="title" defaultValue={state.values?.title ?? entry?.title ?? ""} placeholder="Ex.: Réveillon da casa" className={errors.title ? "border-red-500 bg-red-50" : ""} />
        {errors.title?.[0] && <p className="mt-1 text-xs text-red-700">{errors.title[0]}</p>}
      </div>
      <div>
        <label htmlFor={`calendar-type-${entry?.id ?? "new"}`}>Tipo</label>
        <select id={`calendar-type-${entry?.id ?? "new"}`} name="entryType" defaultValue={state.values?.entryType ?? entry?.entry_type ?? "evento_casa"}>
          <option value="evento_casa">Evento da casa</option>
          <option value="data_importante">Data importante</option>
          <option value="bloqueio">Bloqueio</option>
          <option value="manutencao">Manutenção</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div><label htmlFor={`calendar-start-${entry?.id ?? "new"}`}>Início</label><input id={`calendar-start-${entry?.id ?? "new"}`} type="date" name="startDate" defaultValue={state.values?.startDate ?? entry?.start_date ?? initialDate ?? ""} className={errors.startDate ? "border-red-500 bg-red-50" : ""} /></div>
        <div><label htmlFor={`calendar-end-${entry?.id ?? "new"}`}>Fim</label><input id={`calendar-end-${entry?.id ?? "new"}`} type="date" name="endDate" defaultValue={state.values?.endDate ?? entry?.end_date ?? initialDate ?? ""} className={errors.endDate ? "border-red-500 bg-red-50" : ""} /></div>
      </div>
      <div className="md:col-span-2">
        <label htmlFor={`calendar-notes-${entry?.id ?? "new"}`}>Observações</label>
        <textarea id={`calendar-notes-${entry?.id ?? "new"}`} name="notes" rows={2} defaultValue={state.values?.notes ?? entry?.notes ?? ""} placeholder="Informação interna opcional." />
      </div>
      {state.error && <p role="alert" className="md:col-span-2 rounded-lg bg-red-50 p-3 text-sm text-red-800">{state.error}</p>}
      {state.success && <p role="status" className="md:col-span-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{state.success}</p>}
      <button disabled={pending} className="w-fit rounded-lg bg-[#083653] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0f5f8f] disabled:opacity-60">{pending ? "Salvando..." : entry ? "Salvar alterações" : "Adicionar à agenda"}</button>
    </form>
  );
}

export function DeleteCalendarEntryForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(deleteCalendarEntry, initialState);
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      {state.error && <p role="alert" className="mb-2 text-xs text-red-700">{state.error}</p>}
      <button disabled={pending} className="text-xs font-semibold text-red-700 underline disabled:opacity-60">{pending ? "Removendo..." : "Remover"}</button>
    </form>
  );
}
