"use client";

import type { ReactNode } from "react";
import { useActionState } from "react";
import { updateLeadFromConversation, updateLeadStatusFromConversation, type LeadUpdateFormState } from "../actions";
import { formatBrazilPhone, leadStatuses } from "@/lib/domain/lead";

const initialState: LeadUpdateFormState = {};

type Option = { name: string };

type LeadQuickEditValue = {
  id: string;
  name: string;
  company: string | null;
  phone: string;
  source: string | null;
  status: string;
  event_type: string | null;
  desired_date: string | null;
  guest_count: number | null;
  notes: string | null;
};

export function LeadStatusForm({ conversationId, lead }: { conversationId: string; lead: LeadQuickEditValue }) {
  const [state, action, pending] = useActionState(updateLeadStatusFromConversation, initialState);
  return (
    <form action={action} className="rounded-xl border border-[#dbe3dc] bg-white p-5">
      <h2 className="font-semibold">Status comercial</h2>
      <input type="hidden" name="leadId" value={lead.id} />
      <input type="hidden" name="conversationId" value={conversationId} />
      <div className="mt-4">
        <label htmlFor="lead-status">Etapa da jornada</label>
        <select id="lead-status" name="status" defaultValue={lead.status}>
          {leadStatuses.map((status) => (
            <option key={status} value={status}>
              {formatLeadStatus(status)}
            </option>
          ))}
        </select>
      </div>
      {state.error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{state.error}</p>}
      {state.success && <p role="status" className="mt-3 rounded-lg bg-[#edf5ee] p-3 text-sm text-[#356451]">{state.success}</p>}
      <button disabled={pending} className="mt-4 rounded-lg bg-[#18352d] px-5 py-3 font-semibold text-white transition hover:bg-[#23483d] active:scale-[0.99] disabled:opacity-60">
        {pending ? "Atualizando..." : "Atualizar status"}
      </button>
    </form>
  );
}

export function LeadQuickEditForm({
  conversationId,
  lead,
  eventTypes,
  leadSources,
}: {
  conversationId: string;
  lead: LeadQuickEditValue;
  eventTypes: Option[];
  leadSources: Option[];
}) {
  const [state, action, pending] = useActionState(updateLeadFromConversation, initialState);
  const values = state.values;
  const fieldErrors = state.fieldErrors ?? {};

  return (
    <details className="rounded-xl border border-[#dbe3dc] bg-white p-5">
      <summary className="cursor-pointer font-semibold text-[#083653]">Editar dados do contato</summary>
      <form key={state.version ?? "lead-edit-initial"} action={action} className="mt-5 space-y-4">
        <input type="hidden" name="leadId" value={lead.id} />
        <input type="hidden" name="conversationId" value={conversationId} />

        <Field label="Nome *" htmlFor="lead-name" error={fieldErrors.name?.[0]}>
          <input id="lead-name" name="name" required defaultValue={values?.name ?? lead.name} className={fieldClass(fieldErrors.name)} />
        </Field>

        <Field label="Telefone *" htmlFor="lead-phone" error={fieldErrors.phone?.[0]}>
          <input
            id="lead-phone"
            name="phone"
            required
            inputMode="tel"
            maxLength={15}
            defaultValue={values?.phone ? formatBrazilPhone(values.phone) : lead.phone}
            className={fieldClass(fieldErrors.phone)}
            onInput={(event) => {
              event.currentTarget.value = formatBrazilPhone(event.currentTarget.value);
            }}
          />
        </Field>

        <Field label="Empresa" htmlFor="lead-company" error={fieldErrors.company?.[0]}>
          <input id="lead-company" name="company" defaultValue={values?.company ?? lead.company ?? ""} className={fieldClass(fieldErrors.company)} />
        </Field>

        <Field label="Origem" htmlFor="lead-source" error={fieldErrors.source?.[0]}>
          <select id="lead-source" name="source" defaultValue={values?.source ?? lead.source ?? ""} className={fieldClass(fieldErrors.source)}>
            <option value="">Selecione</option>
            {leadSources.map((option) => (
              <option key={option.name} value={option.name}>
                {option.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Tipo de evento" htmlFor="lead-event-type" error={fieldErrors.eventType?.[0]}>
          <select id="lead-event-type" name="eventType" defaultValue={values?.eventType ?? lead.event_type ?? ""} className={fieldClass(fieldErrors.eventType)}>
            <option value="">Selecione</option>
            {eventTypes.map((option) => (
              <option key={option.name} value={option.name}>
                {option.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Data desejada" htmlFor="lead-desired-date" error={fieldErrors.desiredDate?.[0]}>
          <input id="lead-desired-date" name="desiredDate" type="date" defaultValue={values?.desiredDate ?? lead.desired_date ?? ""} className={fieldClass(fieldErrors.desiredDate)} />
        </Field>

        <Field label="Convidados estimados" htmlFor="lead-guest-count" error={fieldErrors.guestCount?.[0]}>
          <input id="lead-guest-count" name="guestCount" type="number" min="1" defaultValue={values?.guestCount ?? lead.guest_count ?? ""} className={fieldClass(fieldErrors.guestCount)} />
        </Field>

        <Field label="Observações" htmlFor="lead-notes" error={fieldErrors.notes?.[0]}>
          <textarea id="lead-notes" name="notes" rows={4} defaultValue={values?.notes ?? lead.notes ?? ""} className={fieldClass(fieldErrors.notes)} />
        </Field>

        {state.error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{state.error}</p>}
        {state.success && <p role="status" className="rounded-lg bg-[#edf5ee] p-3 text-sm text-[#356451]">{state.success}</p>}
        <button disabled={pending} className="rounded-lg bg-[#18352d] px-5 py-3 font-semibold text-white transition hover:bg-[#23483d] active:scale-[0.99] disabled:opacity-60">
          {pending ? "Salvando..." : "Salvar dados do contato"}
        </button>
      </form>
    </details>
  );
}

function Field({ label, htmlFor, error, children }: { label: string; htmlFor: string; error?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor}>{label}</label>
      <div className="mt-1">{children}</div>
      {error && <p className="mt-1 text-sm text-red-700">{error}</p>}
    </div>
  );
}

function fieldClass(errors?: string[]) {
  return errors?.length ? "border-red-500 bg-red-50" : "";
}

function formatLeadStatus(status: string) {
  return status.replaceAll("_", " ");
}
