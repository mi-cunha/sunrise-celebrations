"use client";

import type { ReactNode } from "react";
import { useActionState } from "react";
import { formatBrazilPhone } from "@/lib/domain/lead";
import { updateLeadFromDetail, type LeadDetailUpdateState } from "./actions";

const initialState: LeadDetailUpdateState = {};

type Option = { name: string };

type LeadEditValue = {
  id: string;
  name: string;
  company: string | null;
  phone: string;
  source: string | null;
  event_type: string | null;
  desired_date: string | null;
  guest_count: number | null;
  notes: string | null;
};

export function LeadDetailEditForm({
  eventTypes,
  lead,
  leadSources,
}: {
  eventTypes: Option[];
  lead: LeadEditValue;
  leadSources: Option[];
}) {
  const [state, action, pending] = useActionState(updateLeadFromDetail, initialState);
  const values = state.values;
  const fieldErrors = state.fieldErrors ?? {};

  return (
    <details className="rounded-lg border border-[#dbe3dc] bg-white p-4">
      <summary className="cursor-pointer font-semibold text-[#083653]">Editar dados do contato</summary>
      <form key={state.version ?? "lead-detail-edit-initial"} action={action} className="mt-5 grid gap-4 md:grid-cols-2">
        <input type="hidden" name="leadId" value={lead.id} />

        <Field label="Nome *" htmlFor="lead-edit-name" error={fieldErrors.name?.[0]}>
          <input id="lead-edit-name" name="name" required defaultValue={values?.name ?? lead.name} className={fieldClass(fieldErrors.name)} />
        </Field>

        <Field label="Telefone *" htmlFor="lead-edit-phone" error={fieldErrors.phone?.[0]}>
          <input
            id="lead-edit-phone"
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

        <Field label="Empresa" htmlFor="lead-edit-company" error={fieldErrors.company?.[0]}>
          <input id="lead-edit-company" name="company" defaultValue={values?.company ?? lead.company ?? ""} className={fieldClass(fieldErrors.company)} />
        </Field>

        <Field label="Origem" htmlFor="lead-edit-source" error={fieldErrors.source?.[0]}>
          <select id="lead-edit-source" name="source" defaultValue={values?.source ?? lead.source ?? ""} className={fieldClass(fieldErrors.source)}>
            <option value="">Selecione</option>
            {leadSources.map((option) => (
              <option key={option.name} value={option.name}>
                {option.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Tipo de evento" htmlFor="lead-edit-event-type" error={fieldErrors.eventType?.[0]}>
          <select id="lead-edit-event-type" name="eventType" defaultValue={values?.eventType ?? lead.event_type ?? ""} className={fieldClass(fieldErrors.eventType)}>
            <option value="">Selecione</option>
            {eventTypes.map((option) => (
              <option key={option.name} value={option.name}>
                {option.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Data desejada" htmlFor="lead-edit-desired-date" error={fieldErrors.desiredDate?.[0]}>
          <input id="lead-edit-desired-date" name="desiredDate" type="date" defaultValue={values?.desiredDate ?? lead.desired_date ?? ""} className={fieldClass(fieldErrors.desiredDate)} />
        </Field>

        <Field label="Convidados estimados" htmlFor="lead-edit-guest-count" error={fieldErrors.guestCount?.[0]}>
          <input id="lead-edit-guest-count" name="guestCount" type="number" min="1" defaultValue={values?.guestCount ?? lead.guest_count ?? ""} className={fieldClass(fieldErrors.guestCount)} />
        </Field>

        <Field label="Observações" htmlFor="lead-edit-notes" error={fieldErrors.notes?.[0]} className="md:col-span-2">
          <textarea id="lead-edit-notes" name="notes" rows={4} defaultValue={values?.notes ?? lead.notes ?? ""} className={fieldClass(fieldErrors.notes)} />
        </Field>

        {state.error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800 md:col-span-2">{state.error}</p>}
        {state.success && <p role="status" className="rounded-lg bg-[#edf5ee] p-3 text-sm text-[#356451] md:col-span-2">{state.success}</p>}

        <div className="md:col-span-2">
          <button disabled={pending} className="rounded-lg bg-[#18352d] px-5 py-3 font-semibold text-white transition hover:bg-[#23483d] active:scale-[0.99] disabled:opacity-60">
            {pending ? "Salvando..." : "Salvar dados do contato"}
          </button>
        </div>
      </form>
    </details>
  );
}

function Field({ children, className = "", error, htmlFor, label }: { children: ReactNode; className?: string; error?: string; htmlFor: string; label: string }) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor}>{label}</label>
      <div className="mt-1">{children}</div>
      {error && <p className="mt-1 text-sm text-red-700">{error}</p>}
    </div>
  );
}

function fieldClass(errors?: string[]) {
  return errors?.length ? "border-red-500 bg-red-50" : "";
}
