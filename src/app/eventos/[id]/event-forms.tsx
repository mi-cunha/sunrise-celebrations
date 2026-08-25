"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  contractedEventBillingModelLabel,
  contractedEventBillingModels,
  contractedEventContractDocumentKindLabel,
  contractedEventContractDocumentKinds,
  contractedEventStandardClauseLabel,
  contractedEventStandardClauses,
  contractedEventContractStatuses,
  contractedEventContractStatusLabel,
  contractedEventPaymentKindLabel,
  contractedEventPaymentKinds,
  contractedEventPaymentMethodLabel,
  contractedEventPaymentMethods,
  contractedEventPaymentPlanIntervalLabel,
  contractedEventPaymentPlanIntervals,
  contractedEventPaymentStatusLabel,
  contractedEventPaymentStatuses,
  contractedEventStatuses,
  contractedEventStatusLabel,
  contractedEventVendorStatuses,
  contractedEventVendorStatusLabel,
} from "@/lib/domain/contracted-event";
import { formatBrazilPhone } from "@/lib/domain/lead";
import { formatCurrencyFromCents } from "@/lib/domain/quote";
import {
  addContractedEventPayment,
  addContractedEventVendor,
  addContractedEventTimelineEntry,
  addContractedEventChecklistItem,
  cancelContractDocumentVersion,
  generateContractedEventContractDocument,
  generateContractedEventPaymentPlan,
  generateEventOperationalBrief,
  moveContractedEventChecklistItem,
  issueContractDocumentVersion,
  markContractDocumentVersionSent,
  markContractDocumentVersionSigned,
  removeContractedEventChecklistItem,
  removeContractedEventPayment,
  removeContractedEventTimelineEntry,
  removeContractedEventVendor,
  reviewContractDocumentVersion,
  setContractedEventContract,
  toggleContractedEventChecklistItem,
  updateContractedEventBillingModel,
  updateContractedEventChecklistItem,
  updateContractedEventNotes,
  updateContractedEventPayment,
  updateContractedEventStatus,
  updateContractedEventTimelineEntry,
  updateContractedEventVendor,
  type ContractedEventFormState,
} from "../actions";

const initialState: ContractedEventFormState = {};

type Assignee = {
  id: string;
  display_name: string | null;
};

type ChecklistItemForForm = {
  id: string;
  title: string;
  is_done: boolean;
  assigned_to: string | null;
  due_date: string | null;
  notes: string | null;
};

type TimelineEntryForForm = {
  id: string;
  title: string;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  assigned_to: string | null;
  notes: string | null;
};

type VendorForForm = {
  id: string;
  category: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  status: string;
  notes: string | null;
};

type ContractForForm = {
  id: string;
  status: string;
  signed_at: string | null;
  notes: string | null;
};

type ContractDocumentForForm = {
  id: string;
  title: string;
  version: number;
  status: string;
  created_at: string;
  reviewed_at: string | null;
  issued_at: string | null;
  updated_at: string;
} | null;

type BillingModelForForm = {
  billing_model: string;
  billing_notes: string | null;
};

type PaymentForForm = {
  id: string;
  kind: string;
  status: string;
  amount_cents: number;
  due_date: string | null;
  paid_at: string | null;
  payment_method: string | null;
  notes: string | null;
};

export function ContractedEventStatusForm({ eventId, status }: { eventId: string; status: string }) {
  const [state, action, pending] = useActionState(updateContractedEventStatus, initialState);

  return (
    <form action={action} className="rounded-xl border border-[#dbe3dc] bg-white p-5">
      <h2 className="font-semibold">Status operacional</h2>
      <input type="hidden" name="eventId" value={eventId} />
      <div className="mt-4">
        <label htmlFor="event-status">Status</label>
        <select id="event-status" name="status" defaultValue={status}>
          {contractedEventStatuses.map((eventStatus) => (
            <option key={eventStatus} value={eventStatus}>
              {contractedEventStatusLabel(eventStatus)}
            </option>
          ))}
        </select>
      </div>
      {state.error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{state.error}</p>}
      {state.success && <p role="status" className="mt-4 rounded-lg bg-[#edf5ee] p-3 text-sm text-[#356451]">{state.success}</p>}
      <button disabled={pending} className="mt-4 rounded-lg bg-[#18352d] px-5 py-3 font-semibold text-white transition hover:bg-[#23483d] active:scale-[0.99] disabled:opacity-60">
        {pending ? "Atualizando..." : "Atualizar evento"}
      </button>
    </form>
  );
}

export function ContractedEventNotesForm({ eventId, notes }: { eventId: string; notes: string | null }) {
  const [state, action, pending] = useActionState(updateContractedEventNotes, initialState);
  const fieldErrors = state.fieldErrors ?? {};

  return (
    <form action={action} className="rounded-lg border border-[#dbe3dc] bg-white p-4">
      <input type="hidden" name="eventId" value={eventId} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-semibold">Observação operacional</h2>
          <p className="mt-1 text-sm text-slate-600">Entra na ficha operacional do evento.</p>
        </div>
        <button disabled={pending} className="rounded-lg bg-[#18352d] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#23483d] active:scale-[0.99] disabled:opacity-60">
          {pending ? "Salvando..." : "Salvar"}
        </button>
      </div>
      <div className="mt-4">
        <label htmlFor="event-notes">Observação</label>
        <textarea
          id="event-notes"
          name="notes"
          rows={4}
          defaultValue={state.values?.notes ?? notes ?? ""}
          aria-invalid={Boolean(fieldErrors.notes)}
          aria-describedby={fieldErrors.notes ? "event-notes-error" : undefined}
          placeholder="Ex.: restrições do espaço, pontos de atenção para equipe, alinhamentos combinados com o cliente."
        />
        {fieldErrors.notes && <p id="event-notes-error" className="mt-1 text-sm text-red-700">{fieldErrors.notes[0]}</p>}
      </div>
      {state.error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{state.error}</p>}
      {state.success && <p role="status" className="mt-4 rounded-lg bg-[#edf5ee] p-3 text-sm text-[#356451]">{state.success}</p>}
    </form>
  );
}

export function ChecklistItemForm({ assignees, eventId }: { assignees: Assignee[]; eventId: string }) {
  const [state, action, pending] = useActionState(addContractedEventChecklistItem, initialState);
  const fieldErrors = state.fieldErrors ?? {};

  return (
    <details className="mt-5 rounded-xl border border-[#dbe3dc] bg-[#fbf8f1]">
      <summary className="cursor-pointer list-none p-4 font-semibold text-[#18352d] transition hover:bg-white">
        + Adicionar pendência
      </summary>
      <form key={state.version ?? "new-checklist-item"} action={action} className="border-t border-[#edf1ee] bg-white p-4">
        <input type="hidden" name="eventId" value={eventId} />
        <ChecklistFields assignees={assignees} fieldErrors={fieldErrors} values={state.values} />
        {state.error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{state.error}</p>}
        {state.success && <p role="status" className="mt-4 rounded-lg bg-[#edf5ee] p-3 text-sm text-[#356451]">{state.success}</p>}
        <button disabled={pending} className="mt-4 rounded-lg bg-[#18352d] px-5 py-3 font-semibold text-white transition hover:bg-[#23483d] active:scale-[0.99] disabled:opacity-60">
          {pending ? "Adicionando..." : "Adicionar pendência"}
        </button>
      </form>
    </details>
  );
}

export function ChecklistItemCard({
  assigneeName,
  assignees,
  eventId,
  isFirst,
  isLast,
  item,
}: {
  assigneeName: string;
  assignees: Assignee[];
  eventId: string;
  isFirst: boolean;
  isLast: boolean;
  item: ChecklistItemForForm;
}) {
  const [toggleState, toggleAction, togglePending] = useActionState(toggleContractedEventChecklistItem, initialState);
  const [moveState, moveAction, movePending] = useActionState(moveContractedEventChecklistItem, initialState);
  const [editState, editAction, editPending] = useActionState(updateContractedEventChecklistItem, initialState);
  const [removeState, removeAction, removePending] = useActionState(removeContractedEventChecklistItem, initialState);
  const fieldErrors = editState.fieldErrors ?? {};

  return (
    <details className={`group overflow-hidden rounded-xl border transition ${item.is_done ? "border-[#cfe2d3] bg-[#f1f8f2]" : "border-[#edf1ee] bg-[#fbf8f1] hover:border-[#cdd8cf] hover:bg-white"}`}>
      <summary className="cursor-pointer list-none p-4">
        <div className="flex items-start gap-3">
          <form action={toggleAction} onClick={(event) => event.stopPropagation()}>
            <input type="hidden" name="eventId" value={eventId} />
            <input type="hidden" name="itemId" value={item.id} />
            <label className="!mb-0 grid h-6 w-6 cursor-pointer place-items-center">
              <span className="sr-only">{item.is_done ? "Reabrir pendência" : "Concluir pendência"}</span>
              <input type="checkbox" name="isDone" defaultChecked={item.is_done} disabled={togglePending} onChange={(event) => event.currentTarget.form?.requestSubmit()} className="peer sr-only" />
              <span className="grid h-5 w-5 place-items-center rounded border border-[#9dad9f] bg-white text-[13px] font-bold leading-none text-transparent transition peer-checked:border-[#356451] peer-checked:bg-[#356451] peer-checked:text-white">
                ✓
              </span>
            </label>
          </form>
          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className={`font-medium ${item.is_done ? "text-slate-500 line-through" : "text-[#18352d]"}`}>{item.title}</h3>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <Badge>{item.is_done ? "Concluído" : togglePending ? "Atualizando..." : "Pendente"}</Badge>
                  {item.due_date && <Badge>Prazo: {formatDate(item.due_date)}</Badge>}
                  {assigneeName && <Badge>Responsável: {assigneeName}</Badge>}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2" onClick={(event) => event.stopPropagation()}>
                <ChecklistMoveButton direction="up" disabled={isFirst || movePending} eventId={eventId} itemId={item.id} moveAction={moveAction} />
                <ChecklistMoveButton direction="down" disabled={isLast || movePending} eventId={eventId} itemId={item.id} moveAction={moveAction} />
                <span className="text-xs font-semibold text-[#356451] group-open:hidden">Editar</span>
              </div>
            </div>
            {item.notes && <p className="mt-3 line-clamp-2 text-sm text-slate-600">{item.notes}</p>}
            {toggleState.error && <p role="alert" className="mt-2 rounded-lg bg-red-50 p-2 text-sm text-red-800">{toggleState.error}</p>}
            {moveState.error && <p role="alert" className="mt-2 rounded-lg bg-red-50 p-2 text-sm text-red-800">{moveState.error}</p>}
          </div>
        </div>
      </summary>

      <div className="border-t border-[#edf1ee] bg-white p-4">
        <form key={editState.version ?? item.id} action={editAction}>
          <input type="hidden" name="eventId" value={eventId} />
          <input type="hidden" name="itemId" value={item.id} />
          <ChecklistFields assignees={assignees} fieldErrors={fieldErrors} item={item} values={editState.values} />
          {editState.error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{editState.error}</p>}
          {editState.success && <p role="status" className="mt-4 rounded-lg bg-[#edf5ee] p-3 text-sm text-[#356451]">{editState.success}</p>}
          <button disabled={editPending} className="mt-4 rounded-lg bg-[#18352d] px-5 py-3 font-semibold text-white transition hover:bg-[#23483d] active:scale-[0.99] disabled:opacity-60">
            {editPending ? "Salvando..." : "Salvar pendência"}
          </button>
        </form>

        <form action={removeAction} className="mt-3">
          <input type="hidden" name="eventId" value={eventId} />
          <input type="hidden" name="itemId" value={item.id} />
          {removeState.error && <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{removeState.error}</p>}
          {removeState.success && <p role="status" className="mb-3 rounded-lg bg-[#edf5ee] p-3 text-sm text-[#356451]">{removeState.success}</p>}
          <button disabled={removePending} className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 active:scale-[0.99] disabled:opacity-60">
            {removePending ? "Removendo..." : "Remover pendência"}
          </button>
        </form>
      </div>
    </details>
  );
}

export function OperationalBriefForm({ eventId, hasDocument }: { eventId: string; hasDocument: boolean }) {
  const [state, action, pending] = useActionState(generateEventOperationalBrief, initialState);

  return (
    <form action={action}>
      <input type="hidden" name="eventId" value={eventId} />
      {state.error && <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{state.error}</p>}
      {state.success && <p role="status" className="mb-3 rounded-lg bg-[#edf5ee] p-3 text-sm text-[#356451]">{state.success}</p>}
      <button disabled={pending} className="rounded-lg bg-[#18352d] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#23483d] active:scale-[0.99] disabled:opacity-60">
        {pending ? "Gerando..." : hasDocument ? "Atualizar ficha" : "Gerar ficha operacional"}
      </button>
    </form>
  );
}

export function TimelineEntryForm({ assignees, eventId }: { assignees: Assignee[]; eventId: string }) {
  const [state, action, pending] = useActionState(addContractedEventTimelineEntry, initialState);
  const fieldErrors = state.fieldErrors ?? {};

  return (
    <details className="mt-5 rounded-xl border border-[#dbe3dc] bg-[#fbf8f1]">
      <summary className="cursor-pointer list-none p-4 font-semibold text-[#18352d] transition hover:bg-white">
        + Adicionar etapa
      </summary>
      <form key={state.version ?? "new-timeline-entry"} action={action} className="border-t border-[#edf1ee] bg-white p-4">
        <input type="hidden" name="eventId" value={eventId} />
        <TimelineFields assignees={assignees} fieldErrors={fieldErrors} values={state.values} />
        {state.error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{state.error}</p>}
        {state.success && <p role="status" className="mt-4 rounded-lg bg-[#edf5ee] p-3 text-sm text-[#356451]">{state.success}</p>}
        <button disabled={pending} className="mt-4 rounded-lg bg-[#18352d] px-5 py-3 font-semibold text-white transition hover:bg-[#23483d] active:scale-[0.99] disabled:opacity-60">
          {pending ? "Adicionando..." : "Adicionar etapa"}
        </button>
      </form>
    </details>
  );
}

export function TimelineEntryCard({
  assigneeName,
  assignees,
  entry,
  eventId,
}: {
  assigneeName: string;
  assignees: Assignee[];
  entry: TimelineEntryForForm;
  eventId: string;
}) {
  const [editState, editAction, editPending] = useActionState(updateContractedEventTimelineEntry, initialState);
  const [removeState, removeAction, removePending] = useActionState(removeContractedEventTimelineEntry, initialState);
  const fieldErrors = editState.fieldErrors ?? {};

  return (
    <details className="group overflow-hidden rounded-xl border border-[#edf1ee] bg-[#fbf8f1] transition hover:border-[#cdd8cf] hover:bg-white">
      <summary className="cursor-pointer list-none p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#356451]">{timelineTimeLabel(entry)}</p>
            <h3 className="mt-1 font-medium text-[#18352d]">{entry.title}</h3>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              {entry.location && <Badge>Local: {entry.location}</Badge>}
              {assigneeName && <Badge>Responsável: {assigneeName}</Badge>}
            </div>
            {entry.notes && <p className="mt-3 line-clamp-2 text-sm text-slate-600">{entry.notes}</p>}
          </div>
          <span className="text-xs font-semibold text-[#356451] group-open:hidden">Editar</span>
        </div>
      </summary>

      <div className="border-t border-[#edf1ee] bg-white p-4">
        <form key={editState.version ?? entry.id} action={editAction}>
          <input type="hidden" name="eventId" value={eventId} />
          <input type="hidden" name="entryId" value={entry.id} />
          <TimelineFields assignees={assignees} entry={entry} fieldErrors={fieldErrors} values={editState.values} />
          {editState.error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{editState.error}</p>}
          {editState.success && <p role="status" className="mt-4 rounded-lg bg-[#edf5ee] p-3 text-sm text-[#356451]">{editState.success}</p>}
          <button disabled={editPending} className="mt-4 rounded-lg bg-[#18352d] px-5 py-3 font-semibold text-white transition hover:bg-[#23483d] active:scale-[0.99] disabled:opacity-60">
            {editPending ? "Salvando..." : "Salvar etapa"}
          </button>
        </form>

        <form action={removeAction} className="mt-3">
          <input type="hidden" name="eventId" value={eventId} />
          <input type="hidden" name="entryId" value={entry.id} />
          {removeState.error && <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{removeState.error}</p>}
          {removeState.success && <p role="status" className="mb-3 rounded-lg bg-[#edf5ee] p-3 text-sm text-[#356451]">{removeState.success}</p>}
          <button disabled={removePending} className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 active:scale-[0.99] disabled:opacity-60">
            {removePending ? "Removendo..." : "Remover etapa"}
          </button>
        </form>
      </div>
    </details>
  );
}

export function VendorForm({ eventId }: { eventId: string }) {
  const [state, action, pending] = useActionState(addContractedEventVendor, initialState);
  const fieldErrors = state.fieldErrors ?? {};

  return (
    <details className="mt-5 rounded-xl border border-[#dbe3dc] bg-[#fbf8f1]">
      <summary className="cursor-pointer list-none p-4 font-semibold text-[#18352d] transition hover:bg-white">
        + Adicionar fornecedor
      </summary>
      <form key={state.version ?? "new-vendor"} action={action} className="border-t border-[#edf1ee] bg-white p-4">
        <input type="hidden" name="eventId" value={eventId} />
        <VendorFields fieldErrors={fieldErrors} values={state.values} />
        {state.error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{state.error}</p>}
        {state.success && <p role="status" className="mt-4 rounded-lg bg-[#edf5ee] p-3 text-sm text-[#356451]">{state.success}</p>}
        <button disabled={pending} className="mt-4 rounded-lg bg-[#18352d] px-5 py-3 font-semibold text-white transition hover:bg-[#23483d] active:scale-[0.99] disabled:opacity-60">
          {pending ? "Adicionando..." : "Adicionar fornecedor"}
        </button>
      </form>
    </details>
  );
}

export function VendorCard({ eventId, vendor }: { eventId: string; vendor: VendorForForm }) {
  const [editState, editAction, editPending] = useActionState(updateContractedEventVendor, initialState);
  const [removeState, removeAction, removePending] = useActionState(removeContractedEventVendor, initialState);
  const fieldErrors = editState.fieldErrors ?? {};

  return (
    <details className="group overflow-hidden rounded-xl border border-[#edf1ee] bg-[#fbf8f1] transition hover:border-[#cdd8cf] hover:bg-white">
      <summary className="cursor-pointer list-none p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#356451]">{vendor.category}</p>
              <Badge>{contractedEventVendorStatusLabel(vendor.status)}</Badge>
            </div>
            <h3 className="mt-1 font-medium text-[#18352d]">{vendor.name}</h3>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              {vendor.contact_name && <Badge>Lead: {vendor.contact_name}</Badge>}
              {vendor.phone && <Badge>{vendor.phone}</Badge>}
              {vendor.email && <Badge>{vendor.email}</Badge>}
            </div>
            {vendor.notes && <p className="mt-3 line-clamp-2 text-sm text-slate-600">{vendor.notes}</p>}
          </div>
          <span className="text-xs font-semibold text-[#356451] group-open:hidden">Editar</span>
        </div>
      </summary>

      <div className="border-t border-[#edf1ee] bg-white p-4">
        <form key={editState.version ?? vendor.id} action={editAction}>
          <input type="hidden" name="eventId" value={eventId} />
          <input type="hidden" name="vendorId" value={vendor.id} />
          <VendorFields fieldErrors={fieldErrors} values={editState.values} vendor={vendor} />
          {editState.error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{editState.error}</p>}
          {editState.success && <p role="status" className="mt-4 rounded-lg bg-[#edf5ee] p-3 text-sm text-[#356451]">{editState.success}</p>}
          <button disabled={editPending} className="mt-4 rounded-lg bg-[#18352d] px-5 py-3 font-semibold text-white transition hover:bg-[#23483d] active:scale-[0.99] disabled:opacity-60">
            {editPending ? "Salvando..." : "Salvar fornecedor"}
          </button>
        </form>

        <form action={removeAction} className="mt-3">
          <input type="hidden" name="eventId" value={eventId} />
          <input type="hidden" name="vendorId" value={vendor.id} />
          {removeState.error && <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{removeState.error}</p>}
          {removeState.success && <p role="status" className="mb-3 rounded-lg bg-[#edf5ee] p-3 text-sm text-[#356451]">{removeState.success}</p>}
          <button disabled={removePending} className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 active:scale-[0.99] disabled:opacity-60">
            {removePending ? "Removendo..." : "Remover fornecedor"}
          </button>
        </form>
      </div>
    </details>
  );
}

export function ContractForm({ contract, eventId }: { contract?: ContractForForm; eventId: string }) {
  const [state, action, pending] = useActionState(setContractedEventContract, initialState);
  const fieldErrors = state.fieldErrors ?? {};

  return (
    <form action={action} className="rounded-xl border border-[#dbe3dc] bg-white p-5">
      <h2 className="font-semibold">Contrato</h2>
      <input type="hidden" name="eventId" value={eventId} />
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="contract-status">Status do contrato</label>
          <select id="contract-status" name="status" defaultValue={state.values?.status ?? contract?.status ?? "pendente"}>
            {contractedEventContractStatuses.map((status) => (
              <option key={status} value={status}>
                {contractedEventContractStatusLabel(status)}
              </option>
            ))}
          </select>
          {fieldErrors.status?.[0] && <p className="mt-1 text-sm text-red-700">{fieldErrors.status[0]}</p>}
        </div>
        <div>
          <label htmlFor="contract-signedAt">Assinado em</label>
          <input id="contract-signedAt" name="signedAt" type="date" defaultValue={state.values?.signedAt ?? contract?.signed_at ?? ""} className={fieldErrors.signedAt ? "border-red-500 bg-red-50" : ""} />
          {fieldErrors.signedAt?.[0] && <p className="mt-1 text-sm text-red-700">{fieldErrors.signedAt[0]}</p>}
        </div>
      </div>
      <div className="mt-4">
        <label htmlFor="contract-notes">Observações financeiras</label>
        <textarea id="contract-notes" name="notes" rows={3} defaultValue={state.values?.notes ?? contract?.notes ?? ""} placeholder="Ex.: contrato enviado por e-mail, pendente de assinatura digital..." />
        {fieldErrors.notes?.[0] && <p className="mt-1 text-sm text-red-700">{fieldErrors.notes[0]}</p>}
      </div>
      {state.error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{state.error}</p>}
      {state.success && <p role="status" className="mt-4 rounded-lg bg-[#edf5ee] p-3 text-sm text-[#356451]">{state.success}</p>}
      <button disabled={pending} className="mt-4 rounded-lg bg-[#18352d] px-5 py-3 font-semibold text-white transition hover:bg-[#23483d] active:scale-[0.99] disabled:opacity-60">
        {pending ? "Salvando..." : "Salvar contrato"}
      </button>
    </form>
  );
}

export function ContractDocumentForm({ document, eventId }: { document?: ContractDocumentForForm; eventId: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(generateContractedEventContractDocument, initialState);
  const [reviewState, reviewAction, reviewPending] = useActionState(reviewContractDocumentVersion, initialState);
  const [issueState, issueAction, issuePending] = useActionState(issueContractDocumentVersion, initialState);
  const [sendState, sendAction, sendPending] = useActionState(markContractDocumentVersionSent, initialState);
  const [signState, signAction, signPending] = useActionState(markContractDocumentVersionSigned, initialState);
  const [cancelState, cancelAction, cancelPending] = useActionState(cancelContractDocumentVersion, initialState);
  const fieldErrors = useMemo(() => state.fieldErrors ?? {}, [state.fieldErrors]);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (reviewState.success || issueState.success || sendState.success || signState.success || cancelState.success) router.refresh();
  }, [cancelState.success, issueState.success, reviewState.success, router, sendState.success, signState.success]);

  useEffect(() => {
    const firstInvalidField = Object.keys(fieldErrors).find((field) => fieldErrors[field]?.length);
    if (!firstInvalidField) return;

    const target = formRef.current?.querySelector<HTMLElement>(`[name="${firstInvalidField}"]`);
    target?.focus();
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [fieldErrors]);

  return (
    <details className="overflow-hidden rounded-xl border border-[#dbe3dc] bg-white" open={!document || Boolean(state.error)}>
      <summary className="flex w-full cursor-pointer list-none items-center justify-between p-5 font-semibold text-[#18352d] transition hover:bg-[#eef6fb]">Elaboração e acompanhamento do contrato</summary>
      <form ref={formRef} action={action} className="border-t border-[#edf1ee] p-5">
        <input type="hidden" name="eventId" value={eventId} />
        <p className="text-sm text-slate-600">Preencha os dados das partes e selecione as condições padronizadas antes de gerar o contrato.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label htmlFor="contract-document-kind">Tipo de documento</label>
            <select id="contract-document-kind" name="documentKind" defaultValue={state.values?.documentKind ?? "auto"} className={fieldErrors.documentKind ? "border-red-500 bg-red-50" : ""}>
              {contractedEventContractDocumentKinds.map((kind) => (
                <option key={kind} value={kind}>{contractedEventContractDocumentKindLabel(kind)}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">No automático: consumo aberto gera termo; eventos médios geram contrato simplificado; eventos maiores geram contrato completo.</p>
            {fieldErrors.documentKind?.[0] && <p className="mt-1 text-sm text-red-700">{fieldErrors.documentKind[0]}</p>}
          </div>
          <div>
            <label htmlFor="contract-contractingPartyName">Contratante</label>
            <input id="contract-contractingPartyName" name="contractingPartyName" defaultValue={state.values?.contractingPartyName ?? ""} placeholder="Nome completo ou razão social" className={fieldErrors.contractingPartyName ? "border-red-500 bg-red-50" : ""} />
            {fieldErrors.contractingPartyName?.[0] && <p className="mt-1 text-sm text-red-700">{fieldErrors.contractingPartyName[0]}</p>}
          </div>
          <div>
            <label htmlFor="contract-contractingPartyDocument">CPF/CNPJ</label>
            <input
              id="contract-contractingPartyDocument"
              name="contractingPartyDocument"
              defaultValue={state.values?.contractingPartyDocument ?? ""}
              placeholder="CPF ou CNPJ do contratante"
              inputMode="numeric"
              maxLength={18}
              onChange={(event) => {
                event.currentTarget.value = formatCpfCnpj(event.currentTarget.value);
              }}
              className={fieldErrors.contractingPartyDocument ? "border-red-500 bg-red-50" : ""}
            />
            {fieldErrors.contractingPartyDocument?.[0] && <p className="mt-1 text-sm text-red-700">{fieldErrors.contractingPartyDocument[0]}</p>}
          </div>
          <div className="md:col-span-2">
            <label htmlFor="contract-contractingPartyAddress">Endereço do contratante</label>
            <input id="contract-contractingPartyAddress" name="contractingPartyAddress" defaultValue={state.values?.contractingPartyAddress ?? ""} placeholder="Rua, número, bairro, cidade/UF" className={fieldErrors.contractingPartyAddress ? "border-red-500 bg-red-50" : ""} />
            {fieldErrors.contractingPartyAddress?.[0] && <p className="mt-1 text-sm text-red-700">{fieldErrors.contractingPartyAddress[0]}</p>}
          </div>
          <div>
            <label htmlFor="contract-contractingPartyRepresentative">Representante</label>
            <input id="contract-contractingPartyRepresentative" name="contractingPartyRepresentative" defaultValue={state.values?.contractingPartyRepresentative ?? ""} placeholder="Quando for empresa" className={fieldErrors.contractingPartyRepresentative ? "border-red-500 bg-red-50" : ""} />
            {fieldErrors.contractingPartyRepresentative?.[0] && <p className="mt-1 text-sm text-red-700">{fieldErrors.contractingPartyRepresentative[0]}</p>}
          </div>
          <div>
            <label htmlFor="contract-eventSchedule">Horário do evento</label>
            <input id="contract-eventSchedule" name="eventSchedule" defaultValue={state.values?.eventSchedule ?? ""} placeholder="Ex.: 17h às 22h" className={fieldErrors.eventSchedule ? "border-red-500 bg-red-50" : ""} />
            {fieldErrors.eventSchedule?.[0] && <p className="mt-1 text-sm text-red-700">{fieldErrors.eventSchedule[0]}</p>}
          </div>
          <div className="md:col-span-2">
            <p className="font-semibold">Condições padronizadas aplicáveis</p>
            <p className="mt-1 text-xs text-slate-500">Selecione somente as situações que fazem parte deste evento. O sistema incluirá o texto aprovado no documento.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {contractedEventStandardClauses.map((clause) => (
                <label key={clause} className="flex cursor-pointer items-center gap-2 rounded-lg border border-[#dbe3dc] bg-white px-3 py-2 text-sm font-medium">
                  <input type="checkbox" name="standardClauses" value={clause} className="h-4 w-4" />
                  {contractedEventStandardClauseLabel(clause)}
                </label>
              ))}
            </div>
          </div>
        </div>
        {document && (
          <div className="mt-4 rounded-lg border border-[#dbe3dc] bg-[#f8fbfd] p-3 text-sm">
            <input type="hidden" name="versionId" value={document.id} />
            <p className="font-semibold">Versão {document.version} · {contractDocumentVersionStatusLabel(document.status)}</p>
            <p className="mt-1 text-xs text-slate-500">Gerada em {formatDateTime(document.created_at)}. Uma nova geração cria outra versão e preserva esta.</p>
            {document.status === "rascunho" && (
              <button formAction={reviewAction} name="versionId" value={document.id} disabled={reviewPending} className="mt-3 rounded-lg border border-[#0f5f8f] bg-white px-3 py-2 text-xs font-semibold text-[#0f5f8f] hover:bg-[#eef6fb] disabled:opacity-60">{reviewPending ? "Revisando..." : "Confirmar revisão humana"}</button>
            )}
            {document.status === "revisado" && (
              <button formAction={issueAction} name="versionId" value={document.id} disabled={issuePending} className="mt-3 rounded-lg bg-[#0f5f8f] px-3 py-2 text-xs font-semibold text-white hover:bg-[#083653] disabled:opacity-60">{issuePending ? "Emitindo..." : "Emitir versão final"}</button>
            )}
            {document.status === "emitido" && (
              <button formAction={sendAction} disabled={sendPending} className="mt-3 rounded-lg bg-[#0f5f8f] px-3 py-2 text-xs font-semibold text-white hover:bg-[#083653] disabled:opacity-60">{sendPending ? "Salvando..." : "Registrar envio"}</button>
            )}
            {document.status === "enviado" && (
              <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,220px)_auto] sm:items-end">
                <div>
                  <label htmlFor="contract-version-signed-at">Assinado em</label>
                  <input id="contract-version-signed-at" name="signedAt" type="date" className={signState.fieldErrors?.signedAt ? "border-red-500 bg-red-50" : ""} />
                </div>
                <button formAction={signAction} disabled={signPending} className="rounded-lg bg-[#2f7d62] px-3 py-2 text-xs font-semibold text-white hover:bg-[#25664f] disabled:opacity-60">{signPending ? "Salvando..." : "Registrar assinatura"}</button>
              </div>
            )}
            {(document.status === "emitido" || document.status === "enviado") && (
              <button formAction={cancelAction} disabled={cancelPending} className="ml-2 mt-3 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60">{cancelPending ? "Cancelando..." : "Cancelar versão"}</button>
            )}
            {(reviewState.error || issueState.error) && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-2 text-xs text-red-800">{reviewState.error ?? issueState.error}</p>}
            {(reviewState.success || issueState.success) && <p role="status" className="mt-3 rounded-lg bg-[#edf5ee] p-2 text-xs text-[#356451]">{reviewState.success ?? issueState.success}</p>}
            {(sendState.error || signState.error || cancelState.error) && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-2 text-xs text-red-800">{sendState.error ?? signState.error ?? cancelState.error}</p>}
            {(sendState.success || signState.success || cancelState.success) && <p role="status" className="mt-3 rounded-lg bg-[#edf5ee] p-2 text-xs text-[#356451]">{sendState.success ?? signState.success ?? cancelState.success}</p>}
          </div>
        )}
        {state.error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{state.error}</p>}
        {state.success && <p role="status" className="mt-4 rounded-lg bg-[#edf5ee] p-3 text-sm text-[#356451]">{state.success}</p>}
        <button disabled={pending} className="mt-4 rounded-lg bg-[#18352d] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#23483d] active:scale-[0.99] disabled:opacity-60">
          {pending ? "Gerando..." : document ? "Gerar nova versão" : "Gerar rascunho"}
        </button>
      </form>
    </details>
  );
}

function contractDocumentVersionStatusLabel(status: string) {
  return ({ rascunho: "Rascunho", revisado: "Revisado", emitido: "Emitido", enviado: "Enviado", assinado: "Assinado", cancelado: "Cancelado" } as Record<string, string>)[status] ?? status;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export function BillingModelForm({ billing, eventId }: { billing: BillingModelForForm; eventId: string }) {
  const [state, action, pending] = useActionState(updateContractedEventBillingModel, initialState);
  const fieldErrors = state.fieldErrors ?? {};

  return (
    <form action={action} className="rounded-xl border border-[#dbe3dc] bg-white p-5">
      <h2 className="font-semibold">Modelo de cobrança</h2>
      <p className="mt-1 text-sm text-slate-600">Use consumo aberto quando o cliente paga após o evento, ou híbrido quando parte é pré-paga e parte será apurada depois.</p>
      <input type="hidden" name="eventId" value={eventId} />
      <div className="mt-4">
        <label htmlFor="billing-model">Formato</label>
        <select id="billing-model" name="billingModel" defaultValue={state.values?.billingModel ?? billing.billing_model}>
          {contractedEventBillingModels.map((model) => (
            <option key={model} value={model}>
              {contractedEventBillingModelLabel(model)}
            </option>
          ))}
        </select>
        {fieldErrors.billingModel?.[0] && <p className="mt-1 text-sm text-red-700">{fieldErrors.billingModel[0]}</p>}
      </div>
      <div className="mt-4">
        <label htmlFor="billing-notes">Observações da cobrança</label>
        <textarea id="billing-notes" name="billingNotes" rows={3} defaultValue={state.values?.billingNotes ?? billing.billing_notes ?? ""} placeholder="Ex.: consumo aberto de cardápio, cobrança pós-evento conforme comandas." />
        {fieldErrors.billingNotes?.[0] && <p className="mt-1 text-sm text-red-700">{fieldErrors.billingNotes[0]}</p>}
      </div>
      {state.error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{state.error}</p>}
      {state.success && <p role="status" className="mt-4 rounded-lg bg-[#edf5ee] p-3 text-sm text-[#356451]">{state.success}</p>}
      <button disabled={pending} className="mt-4 rounded-lg bg-[#18352d] px-5 py-3 font-semibold text-white transition hover:bg-[#23483d] active:scale-[0.99] disabled:opacity-60">
        {pending ? "Salvando..." : "Salvar modelo"}
      </button>
    </form>
  );
}

export function PaymentForm({ eventId }: { eventId: string }) {
  const [state, action, pending] = useActionState(addContractedEventPayment, initialState);
  const fieldErrors = state.fieldErrors ?? {};

  return (
    <details className="mt-5 rounded-xl border border-[#dbe3dc] bg-[#fbf8f1]">
      <summary className="cursor-pointer list-none p-4 font-semibold text-[#18352d] transition hover:bg-white">
        + Adicionar pagamento
      </summary>
      <form key={state.version ?? "new-payment"} action={action} className="border-t border-[#edf1ee] bg-white p-4">
        <input type="hidden" name="eventId" value={eventId} />
        <PaymentFields fieldErrors={fieldErrors} values={state.values} />
        {state.error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{state.error}</p>}
        {state.success && <p role="status" className="mt-4 rounded-lg bg-[#edf5ee] p-3 text-sm text-[#356451]">{state.success}</p>}
        <button disabled={pending} className="mt-4 rounded-lg bg-[#18352d] px-5 py-3 font-semibold text-white transition hover:bg-[#23483d] active:scale-[0.99] disabled:opacity-60">
          {pending ? "Adicionando..." : "Adicionar pagamento"}
        </button>
      </form>
    </details>
  );
}

export function PaymentPlanForm({ eventId, totalAmountCents }: { eventId: string; totalAmountCents: number }) {
  const [state, action, pending] = useActionState(generateContractedEventPaymentPlan, initialState);
  const fieldErrors = state.fieldErrors ?? {};
  const [installmentInterval, setInstallmentInterval] = useState(state.values?.installmentInterval ?? "mensal");
  const isCustomInterval = installmentInterval === "personalizado";

  return (
    <details className="mt-5 rounded-xl border border-[#dbe3dc] bg-[#f6fbf7]">
      <summary className="cursor-pointer list-none p-4 font-semibold text-[#18352d] transition hover:bg-white">
        + Gerar plano de pagamentos
      </summary>
      <form key={state.version ?? "new-payment-plan"} action={action} className="border-t border-[#edf1ee] bg-white p-4">
        <input type="hidden" name="eventId" value={eventId} />
        <p className="mb-4 rounded-lg bg-[#fbf8f1] p-3 text-sm text-slate-600">
          Valor aprovado: <span className="font-semibold text-[#18352d]">{formatCurrencyFromCents(totalAmountCents)}</span>. Informe o sinal e como o saldo deve ser dividido.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="plan-signalAmount">Valor do sinal</label>
            <input id="plan-signalAmount" name="signalAmount" inputMode="decimal" defaultValue={state.values?.signalAmount ?? ""} placeholder="Ex.: 5.000,00" className={fieldErrors.signalAmount ? "border-red-500 bg-red-50" : ""} />
            {fieldErrors.signalAmount?.[0] && <p className="mt-1 text-sm text-red-700">{fieldErrors.signalAmount[0]}</p>}
          </div>
          <div>
            <label htmlFor="plan-signalDueDate">Vencimento do sinal</label>
            <input id="plan-signalDueDate" name="signalDueDate" type="date" defaultValue={state.values?.signalDueDate ?? ""} className={fieldErrors.signalDueDate ? "border-red-500 bg-red-50" : ""} />
            {fieldErrors.signalDueDate?.[0] && <p className="mt-1 text-sm text-red-700">{fieldErrors.signalDueDate[0]}</p>}
          </div>
          <div>
            <label htmlFor="plan-installmentCount">Parcelas do saldo</label>
            <input id="plan-installmentCount" name="installmentCount" type="number" min={0} max={24} defaultValue={state.values?.installmentCount ?? "1"} className={fieldErrors.installmentCount ? "border-red-500 bg-red-50" : ""} />
            {fieldErrors.installmentCount?.[0] && <p className="mt-1 text-sm text-red-700">{fieldErrors.installmentCount[0]}</p>}
          </div>
          <div>
            <label htmlFor="plan-firstInstallmentDueDate">Primeiro vencimento do saldo</label>
            <input id="plan-firstInstallmentDueDate" name="firstInstallmentDueDate" type="date" defaultValue={state.values?.firstInstallmentDueDate ?? ""} className={fieldErrors.firstInstallmentDueDate ? "border-red-500 bg-red-50" : ""} />
            {fieldErrors.firstInstallmentDueDate?.[0] && <p className="mt-1 text-sm text-red-700">{fieldErrors.firstInstallmentDueDate[0]}</p>}
          </div>
          <div>
            <label htmlFor="plan-installmentInterval">Prazo entre parcelas</label>
            <select id="plan-installmentInterval" name="installmentInterval" value={installmentInterval} onChange={(event) => setInstallmentInterval(event.currentTarget.value)}>
              {contractedEventPaymentPlanIntervals.map((interval) => (
                <option key={interval} value={interval}>
                  {contractedEventPaymentPlanIntervalLabel(interval)}
                </option>
              ))}
            </select>
            {fieldErrors.installmentInterval?.[0] && <p className="mt-1 text-sm text-red-700">{fieldErrors.installmentInterval[0]}</p>}
          </div>
          <div>
            <label htmlFor="plan-customIntervalDays">Dias entre parcelas</label>
            <input id="plan-customIntervalDays" name="customIntervalDays" type="number" min={1} max={365} disabled={!isCustomInterval} defaultValue={state.values?.customIntervalDays ?? ""} placeholder={isCustomInterval ? "Ex.: 10" : "Só para personalizado"} className={fieldErrors.customIntervalDays ? "border-red-500 bg-red-50" : "disabled:bg-slate-100 disabled:text-slate-400"} />
            {fieldErrors.customIntervalDays?.[0] && <p className="mt-1 text-sm text-red-700">{fieldErrors.customIntervalDays[0]}</p>}
          </div>
          <div className="md:col-span-2">
            <label htmlFor="plan-paymentMethod">Forma de pagamento</label>
            <select id="plan-paymentMethod" name="paymentMethod" defaultValue={state.values?.paymentMethod ?? ""}>
              <option value="">A definir</option>
              {contractedEventPaymentMethods.map((method) => (
                <option key={method} value={method}>
                  {contractedEventPaymentMethodLabel(method)}
                </option>
              ))}
            </select>
            {fieldErrors.paymentMethod?.[0] && <p className="mt-1 text-sm text-red-700">{fieldErrors.paymentMethod[0]}</p>}
          </div>
          <div className="md:col-span-2">
            <label htmlFor="plan-notes">Observações financeiras</label>
            <textarea id="plan-notes" name="notes" rows={3} defaultValue={state.values?.notes ?? ""} placeholder="Ex.: combinado com cliente, datas ajustadas por contrato..." />
            {fieldErrors.notes?.[0] && <p className="mt-1 text-sm text-red-700">{fieldErrors.notes[0]}</p>}
          </div>
        </div>
        {state.error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{state.error}</p>}
        {state.success && <p role="status" className="mt-4 rounded-lg bg-[#edf5ee] p-3 text-sm text-[#356451]">{state.success}</p>}
        <button disabled={pending} className="mt-4 rounded-lg bg-[#18352d] px-5 py-3 font-semibold text-white transition hover:bg-[#23483d] active:scale-[0.99] disabled:opacity-60">
          {pending ? "Gerando..." : "Gerar plano"}
        </button>
      </form>
    </details>
  );
}

export function PaymentCard({ eventId, payment }: { eventId: string; payment: PaymentForForm }) {
  const [editState, editAction, editPending] = useActionState(updateContractedEventPayment, initialState);
  const [removeState, removeAction, removePending] = useActionState(removeContractedEventPayment, initialState);
  const fieldErrors = editState.fieldErrors ?? {};
  const isLate = isPaymentLate(payment);
  const statusLabel = isLate ? "Atrasado" : contractedEventPaymentStatusLabel(payment.status);

  return (
    <details className={`group overflow-hidden rounded-xl border transition hover:border-[#cdd8cf] hover:bg-white ${isLate ? "border-red-200 bg-red-50/55" : "border-[#edf1ee] bg-[#fbf8f1]"}`}>
      <summary className="cursor-pointer list-none p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className={`text-xs font-semibold uppercase tracking-[0.14em] ${isLate ? "text-red-700" : "text-[#356451]"}`}>{contractedEventPaymentKindLabel(payment.kind)}</p>
              <Badge tone={isLate ? "danger" : undefined}>{statusLabel}</Badge>
            </div>
            <h3 className="mt-1 font-medium text-[#18352d]">{formatCurrencyFromCents(payment.amount_cents)}</h3>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              {payment.due_date && <Badge tone={isLate ? "danger" : undefined}>Venc.: {formatDate(payment.due_date)}</Badge>}
              {payment.paid_at && <Badge>Pago em: {formatDate(payment.paid_at)}</Badge>}
              {payment.payment_method && <Badge>{contractedEventPaymentMethodLabel(payment.payment_method)}</Badge>}
            </div>
            {payment.notes && <p className="mt-3 line-clamp-2 text-sm text-slate-600">{payment.notes}</p>}
          </div>
          <span className="text-xs font-semibold text-[#356451] group-open:hidden">Editar</span>
        </div>
      </summary>

      <div className="border-t border-[#edf1ee] bg-white p-4">
        <form key={editState.version ?? payment.id} action={editAction}>
          <input type="hidden" name="eventId" value={eventId} />
          <input type="hidden" name="paymentId" value={payment.id} />
          <PaymentFields fieldErrors={fieldErrors} payment={payment} values={editState.values} />
          {editState.error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{editState.error}</p>}
          {editState.success && <p role="status" className="mt-4 rounded-lg bg-[#edf5ee] p-3 text-sm text-[#356451]">{editState.success}</p>}
          <button disabled={editPending} className="mt-4 rounded-lg bg-[#18352d] px-5 py-3 font-semibold text-white transition hover:bg-[#23483d] active:scale-[0.99] disabled:opacity-60">
            {editPending ? "Salvando..." : "Salvar pagamento"}
          </button>
        </form>

        <form action={removeAction} className="mt-3">
          <input type="hidden" name="eventId" value={eventId} />
          <input type="hidden" name="paymentId" value={payment.id} />
          {removeState.error && <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{removeState.error}</p>}
          {removeState.success && <p role="status" className="mb-3 rounded-lg bg-[#edf5ee] p-3 text-sm text-[#356451]">{removeState.success}</p>}
          <button disabled={removePending} className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 active:scale-[0.99] disabled:opacity-60">
            {removePending ? "Removendo..." : "Remover pagamento"}
          </button>
        </form>
      </div>
    </details>
  );
}

function ChecklistMoveButton({
  direction,
  disabled,
  eventId,
  itemId,
  moveAction,
}: {
  direction: "up" | "down";
  disabled: boolean;
  eventId: string;
  itemId: string;
  moveAction: (formData: FormData) => void;
}) {
  return (
    <form action={moveAction}>
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="itemId" value={itemId} />
      <input type="hidden" name="direction" value={direction} />
      <button
        type="submit"
        disabled={disabled}
        title={direction === "up" ? "Subir pendência" : "Descer pendência"}
        className="grid h-8 w-8 place-items-center rounded-full border border-[#dbe3dc] bg-white text-sm font-semibold text-[#18352d] transition hover:bg-[#f6fbf7] disabled:cursor-not-allowed disabled:opacity-35"
      >
        {direction === "up" ? "↑" : "↓"}
      </button>
    </form>
  );
}

function ChecklistFields({
  assignees,
  fieldErrors,
  item,
  values,
}: {
  assignees: Assignee[];
  fieldErrors: Record<string, string[]>;
  item?: ChecklistItemForForm;
  values?: Record<string, string>;
}) {
  return (
    <div className="grid gap-4">
      <div>
        <label htmlFor={item ? `title-${item.id}` : "new-title"}>Pendência</label>
        <input id={item ? `title-${item.id}` : "new-title"} name="title" required defaultValue={values?.title ?? item?.title ?? ""} className={fieldErrors.title ? "border-red-500 bg-red-50" : ""} />
        {fieldErrors.title?.[0] && <p className="mt-1 text-sm text-red-700">{fieldErrors.title[0]}</p>}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor={item ? `assignedTo-${item.id}` : "new-assignedTo"}>Responsável</label>
          <select id={item ? `assignedTo-${item.id}` : "new-assignedTo"} name="assignedTo" defaultValue={values?.assignedTo ?? item?.assigned_to ?? ""}>
            <option value="">Sem responsável definido</option>
            {assignees.map((assignee) => (
              <option key={assignee.id} value={assignee.id}>
                {assignee.display_name ?? "Usuário"}
              </option>
            ))}
          </select>
          {fieldErrors.assignedTo?.[0] && <p className="mt-1 text-sm text-red-700">{fieldErrors.assignedTo[0]}</p>}
        </div>
        <div>
          <label htmlFor={item ? `dueDate-${item.id}` : "new-dueDate"}>Prazo</label>
          <input id={item ? `dueDate-${item.id}` : "new-dueDate"} name="dueDate" type="date" defaultValue={values?.dueDate ?? item?.due_date ?? ""} className={fieldErrors.dueDate ? "border-red-500 bg-red-50" : ""} />
          {fieldErrors.dueDate?.[0] && <p className="mt-1 text-sm text-red-700">{fieldErrors.dueDate[0]}</p>}
        </div>
      </div>
      <div>
        <label htmlFor={item ? `notes-${item.id}` : "new-notes"}>Observações internas</label>
        <textarea id={item ? `notes-${item.id}` : "new-notes"} name="notes" rows={3} defaultValue={values?.notes ?? item?.notes ?? ""} placeholder="Detalhes úteis para a execução da pendência." />
        {fieldErrors.notes?.[0] && <p className="mt-1 text-sm text-red-700">{fieldErrors.notes[0]}</p>}
      </div>
    </div>
  );
}

function TimelineFields({
  assignees,
  entry,
  fieldErrors,
  values,
}: {
  assignees: Assignee[];
  entry?: TimelineEntryForForm;
  fieldErrors: Record<string, string[]>;
  values?: Record<string, string>;
}) {
  return (
    <div className="grid gap-4">
      <div>
        <label htmlFor={entry ? `timeline-title-${entry.id}` : "new-timeline-title"}>Etapa</label>
        <input id={entry ? `timeline-title-${entry.id}` : "new-timeline-title"} name="title" required defaultValue={values?.title ?? entry?.title ?? ""} className={fieldErrors.title ? "border-red-500 bg-red-50" : ""} placeholder="Ex.: Chegada da equipe" />
        {fieldErrors.title?.[0] && <p className="mt-1 text-sm text-red-700">{fieldErrors.title[0]}</p>}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor={entry ? `startTime-${entry.id}` : "new-startTime"}>Início</label>
          <input id={entry ? `startTime-${entry.id}` : "new-startTime"} name="startTime" type="time" defaultValue={values?.startTime ?? normalizeTime(entry?.start_time)} className={fieldErrors.startTime ? "border-red-500 bg-red-50" : ""} />
          {fieldErrors.startTime?.[0] && <p className="mt-1 text-sm text-red-700">{fieldErrors.startTime[0]}</p>}
        </div>
        <div>
          <label htmlFor={entry ? `endTime-${entry.id}` : "new-endTime"}>Fim</label>
          <input id={entry ? `endTime-${entry.id}` : "new-endTime"} name="endTime" type="time" defaultValue={values?.endTime ?? normalizeTime(entry?.end_time)} className={fieldErrors.endTime ? "border-red-500 bg-red-50" : ""} />
          {fieldErrors.endTime?.[0] && <p className="mt-1 text-sm text-red-700">{fieldErrors.endTime[0]}</p>}
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor={entry ? `location-${entry.id}` : "new-location"}>Local</label>
          <input id={entry ? `location-${entry.id}` : "new-location"} name="location" defaultValue={values?.location ?? entry?.location ?? ""} placeholder="Ex.: Salão principal" className={fieldErrors.location ? "border-red-500 bg-red-50" : ""} />
          {fieldErrors.location?.[0] && <p className="mt-1 text-sm text-red-700">{fieldErrors.location[0]}</p>}
        </div>
        <div>
          <label htmlFor={entry ? `timeline-assignedTo-${entry.id}` : "new-timeline-assignedTo"}>Responsável</label>
          <select id={entry ? `timeline-assignedTo-${entry.id}` : "new-timeline-assignedTo"} name="assignedTo" defaultValue={values?.assignedTo ?? entry?.assigned_to ?? ""}>
            <option value="">Sem responsável definido</option>
            {assignees.map((assignee) => (
              <option key={assignee.id} value={assignee.id}>
                {assignee.display_name ?? "Usuário"}
              </option>
            ))}
          </select>
          {fieldErrors.assignedTo?.[0] && <p className="mt-1 text-sm text-red-700">{fieldErrors.assignedTo[0]}</p>}
        </div>
      </div>
      <div>
        <label htmlFor={entry ? `timeline-notes-${entry.id}` : "new-timeline-notes"}>Observações internas</label>
        <textarea id={entry ? `timeline-notes-${entry.id}` : "new-timeline-notes"} name="notes" rows={3} defaultValue={values?.notes ?? entry?.notes ?? ""} placeholder="Detalhes úteis para a execução dessa etapa." />
        {fieldErrors.notes?.[0] && <p className="mt-1 text-sm text-red-700">{fieldErrors.notes[0]}</p>}
      </div>
    </div>
  );
}

function VendorFields({
  fieldErrors,
  values,
  vendor,
}: {
  fieldErrors: Record<string, string[]>;
  values?: Record<string, string>;
  vendor?: VendorForForm;
}) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor={vendor ? `vendor-category-${vendor.id}` : "new-vendor-category"}>Tipo</label>
          <input id={vendor ? `vendor-category-${vendor.id}` : "new-vendor-category"} name="category" required defaultValue={values?.category ?? vendor?.category ?? ""} placeholder="Ex.: DJ, buffet, decoração" className={fieldErrors.category ? "border-red-500 bg-red-50" : ""} />
          {fieldErrors.category?.[0] && <p className="mt-1 text-sm text-red-700">{fieldErrors.category[0]}</p>}
        </div>
        <div>
          <label htmlFor={vendor ? `vendor-name-${vendor.id}` : "new-vendor-name"}>Fornecedor</label>
          <input id={vendor ? `vendor-name-${vendor.id}` : "new-vendor-name"} name="name" required defaultValue={values?.name ?? vendor?.name ?? ""} placeholder="Nome do fornecedor" className={fieldErrors.name ? "border-red-500 bg-red-50" : ""} />
          {fieldErrors.name?.[0] && <p className="mt-1 text-sm text-red-700">{fieldErrors.name[0]}</p>}
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label htmlFor={vendor ? `vendor-contact-${vendor.id}` : "new-vendor-contact"}>Lead</label>
          <input id={vendor ? `vendor-contact-${vendor.id}` : "new-vendor-contact"} name="contactName" defaultValue={values?.contactName ?? vendor?.contact_name ?? ""} placeholder="Pessoa responsável" className={fieldErrors.contactName ? "border-red-500 bg-red-50" : ""} />
          {fieldErrors.contactName?.[0] && <p className="mt-1 text-sm text-red-700">{fieldErrors.contactName[0]}</p>}
        </div>
        <div>
          <label htmlFor={vendor ? `vendor-phone-${vendor.id}` : "new-vendor-phone"}>Telefone</label>
          <input
            id={vendor ? `vendor-phone-${vendor.id}` : "new-vendor-phone"}
            name="phone"
            inputMode="tel"
            maxLength={15}
            defaultValue={values?.phone ? formatBrazilPhone(values.phone) : vendor?.phone ?? ""}
            placeholder="(11) 91234-5678"
            className={fieldErrors.phone ? "border-red-500 bg-red-50" : ""}
            onChange={(event) => {
              event.currentTarget.value = formatBrazilPhone(event.currentTarget.value);
            }}
          />
          {fieldErrors.phone?.[0] && <p className="mt-1 text-sm text-red-700">{fieldErrors.phone[0]}</p>}
        </div>
        <div>
          <label htmlFor={vendor ? `vendor-email-${vendor.id}` : "new-vendor-email"}>E-mail</label>
          <input id={vendor ? `vendor-email-${vendor.id}` : "new-vendor-email"} name="email" type="email" inputMode="email" defaultValue={values?.email ?? vendor?.email ?? ""} placeholder="email@exemplo.com" className={fieldErrors.email ? "border-red-500 bg-red-50" : ""} />
          {fieldErrors.email?.[0] && <p className="mt-1 text-sm text-red-700">{fieldErrors.email[0]}</p>}
        </div>
      </div>
      <div>
        <label htmlFor={vendor ? `vendor-status-${vendor.id}` : "new-vendor-status"}>Status</label>
        <select id={vendor ? `vendor-status-${vendor.id}` : "new-vendor-status"} name="status" defaultValue={values?.status ?? vendor?.status ?? "pendente"}>
          {contractedEventVendorStatuses.map((status) => (
            <option key={status} value={status}>
              {contractedEventVendorStatusLabel(status)}
            </option>
          ))}
        </select>
        {fieldErrors.status?.[0] && <p className="mt-1 text-sm text-red-700">{fieldErrors.status[0]}</p>}
      </div>
      <div>
        <label htmlFor={vendor ? `vendor-notes-${vendor.id}` : "new-vendor-notes"}>Observações internas</label>
        <textarea id={vendor ? `vendor-notes-${vendor.id}` : "new-vendor-notes"} name="notes" rows={3} defaultValue={values?.notes ?? vendor?.notes ?? ""} placeholder="Detalhes úteis sobre alinhamento, entrega ou pendências." />
        {fieldErrors.notes?.[0] && <p className="mt-1 text-sm text-red-700">{fieldErrors.notes[0]}</p>}
      </div>
    </div>
  );
}

function PaymentFields({
  fieldErrors,
  payment,
  values,
}: {
  fieldErrors: Record<string, string[]>;
  payment?: PaymentForForm;
  values?: Record<string, string>;
}) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label htmlFor={payment ? `payment-kind-${payment.id}` : "new-payment-kind"}>Tipo</label>
          <select id={payment ? `payment-kind-${payment.id}` : "new-payment-kind"} name="kind" defaultValue={values?.kind ?? payment?.kind ?? "parcela"}>
            {contractedEventPaymentKinds.map((kind) => (
              <option key={kind} value={kind}>
                {contractedEventPaymentKindLabel(kind)}
              </option>
            ))}
          </select>
          {fieldErrors.kind?.[0] && <p className="mt-1 text-sm text-red-700">{fieldErrors.kind[0]}</p>}
        </div>
        <div>
          <label htmlFor={payment ? `payment-status-${payment.id}` : "new-payment-status"}>Status</label>
          <select id={payment ? `payment-status-${payment.id}` : "new-payment-status"} name="status" defaultValue={values?.status ?? payment?.status ?? "previsto"}>
            {contractedEventPaymentStatuses.map((status) => (
              <option key={status} value={status}>
                {contractedEventPaymentStatusLabel(status)}
              </option>
            ))}
          </select>
          {fieldErrors.status?.[0] && <p className="mt-1 text-sm text-red-700">{fieldErrors.status[0]}</p>}
        </div>
        <div>
          <label htmlFor={payment ? `payment-amount-${payment.id}` : "new-payment-amount"}>Valor</label>
          <input
            id={payment ? `payment-amount-${payment.id}` : "new-payment-amount"}
            name="amount"
            inputMode="decimal"
            required
            defaultValue={values?.amount ?? (payment ? (payment.amount_cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "")}
            placeholder="Ex.: 1.500,00"
            className={fieldErrors.amount ? "border-red-500 bg-red-50" : ""}
          />
          {fieldErrors.amount?.[0] && <p className="mt-1 text-sm text-red-700">{fieldErrors.amount[0]}</p>}
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label htmlFor={payment ? `payment-dueDate-${payment.id}` : "new-payment-dueDate"}>Vencimento</label>
          <input id={payment ? `payment-dueDate-${payment.id}` : "new-payment-dueDate"} name="dueDate" type="date" defaultValue={values?.dueDate ?? payment?.due_date ?? ""} className={fieldErrors.dueDate ? "border-red-500 bg-red-50" : ""} />
          {fieldErrors.dueDate?.[0] && <p className="mt-1 text-sm text-red-700">{fieldErrors.dueDate[0]}</p>}
        </div>
        <div>
          <label htmlFor={payment ? `payment-paidAt-${payment.id}` : "new-payment-paidAt"}>Pago em</label>
          <input id={payment ? `payment-paidAt-${payment.id}` : "new-payment-paidAt"} name="paidAt" type="date" defaultValue={values?.paidAt ?? payment?.paid_at ?? ""} className={fieldErrors.paidAt ? "border-red-500 bg-red-50" : ""} />
          {fieldErrors.paidAt?.[0] && <p className="mt-1 text-sm text-red-700">{fieldErrors.paidAt[0]}</p>}
        </div>
        <div>
          <label htmlFor={payment ? `payment-method-${payment.id}` : "new-payment-method"}>Forma</label>
          <select id={payment ? `payment-method-${payment.id}` : "new-payment-method"} name="paymentMethod" defaultValue={values?.paymentMethod ?? normalizePaymentMethod(payment?.payment_method)}>
            <option value="">A definir</option>
            {contractedEventPaymentMethods.map((method) => (
              <option key={method} value={method}>
                {contractedEventPaymentMethodLabel(method)}
              </option>
            ))}
          </select>
          {fieldErrors.paymentMethod?.[0] && <p className="mt-1 text-sm text-red-700">{fieldErrors.paymentMethod[0]}</p>}
        </div>
      </div>
      <div>
        <label htmlFor={payment ? `payment-notes-${payment.id}` : "new-payment-notes"}>Observações financeiras</label>
        <textarea id={payment ? `payment-notes-${payment.id}` : "new-payment-notes"} name="notes" rows={3} defaultValue={values?.notes ?? payment?.notes ?? ""} placeholder="Detalhes internos de cobrança, alinhamento ou comprovante." />
        {fieldErrors.notes?.[0] && <p className="mt-1 text-sm text-red-700">{fieldErrors.notes[0]}</p>}
      </div>
    </div>
  );
}

function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "danger" }) {
  const className = tone === "danger" ? "bg-red-100 text-red-700" : "bg-white text-slate-600";
  return <span className={`rounded-full px-2.5 py-1 shadow-sm ${className}`}>{children}</span>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(`${value}T00:00:00`));
}

function normalizeTime(value: string | null | undefined) {
  return value ? value.slice(0, 5) : "";
}

function normalizePaymentMethod(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase();
  const aliases: Record<string, string> = {
    pix: "pix",
    "cartão": "cartao_credito",
    cartao: "cartao_credito",
    "cartão de crédito": "cartao_credito",
    "cartao de credito": "cartao_credito",
    "cartão de débito": "cartao_debito",
    "cartao de debito": "cartao_debito",
    boleto: "boleto",
    transferência: "transferencia",
    transferencia: "transferencia",
    "transferência bancária": "transferencia",
    "transferencia bancaria": "transferencia",
    dinheiro: "dinheiro",
    outro: "outro",
  };
  return normalized ? aliases[normalized] ?? value ?? "" : "";
}

function formatCpfCnpj(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 11) {
    return digits
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
  }

  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3/$4")
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, "$1.$2.$3/$4-$5");
}

function isPaymentLate(payment: PaymentForForm) {
  if (payment.status === "pago" || payment.status === "cancelado" || !payment.due_date) return false;
  const today = new Date().toISOString().slice(0, 10);
  return payment.status === "atrasado" || payment.due_date < today;
}

function timelineTimeLabel(entry: TimelineEntryForForm) {
  const start = normalizeTime(entry.start_time);
  const end = normalizeTime(entry.end_time);
  if (start && end) return `${start} – ${end}`;
  if (start) return start;
  if (end) return `Até ${end}`;
  return "Horário a definir";
}
