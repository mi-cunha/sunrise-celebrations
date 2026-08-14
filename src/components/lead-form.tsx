"use client";
import { useActionState } from "react";
import { createLead, type FormState } from "@/app/painel/actions";
import { formatBrazilPhone } from "@/lib/domain/lead";

const initialState: FormState = {};

type Option = { name: string };

function ErrorText({ errors }: { errors?: string[] }) { return errors?.[0] ? <p className="mt-1 text-sm text-red-700">{errors[0]}</p> : null; }
function fieldClass(errors?: string[]) { return errors?.length ? "border-red-500 bg-red-50" : ""; }

export function LeadForm({ canAssign, people, eventTypes, leadSources }: { canAssign: boolean; people: { id: string; display_name: string | null }[]; eventTypes: Option[]; leadSources: Option[] }) {
 const [state, action, pending] = useActionState(createLead, initialState);
 const values = state.values;
 const fieldErrors = state.fieldErrors ?? {};
 return <form key={state.version ?? "initial"} action={action} className="grid gap-5 md:grid-cols-2">
  <div><label htmlFor="name">Nome *</label><input id="name" name="name" required aria-invalid={Boolean(fieldErrors.name)} defaultValue={values?.name} className={fieldClass(fieldErrors.name)}/><ErrorText errors={fieldErrors.name}/></div>
  <div><label htmlFor="company">Empresa</label><input id="company" name="company" placeholder="Ex.: cliente corporativo" aria-invalid={Boolean(fieldErrors.company)} defaultValue={values?.company} className={fieldClass(fieldErrors.company)}/><ErrorText errors={fieldErrors.company}/></div>
  <div><label htmlFor="phone">Telefone *</label><input id="phone" name="phone" inputMode="tel" required maxLength={15} placeholder="(11) 90000-0000" aria-invalid={Boolean(fieldErrors.phone)} defaultValue={values?.phone ? formatBrazilPhone(values.phone) : ""} className={fieldClass(fieldErrors.phone)} onInput={(event) => { event.currentTarget.value = formatBrazilPhone(event.currentTarget.value); }}/><ErrorText errors={fieldErrors.phone}/></div>
  <div><label htmlFor="source">Origem</label><select id="source" name="source" aria-invalid={Boolean(fieldErrors.source)} defaultValue={values?.source ?? ""} className={fieldClass(fieldErrors.source)}><option value="">Selecione</option>{leadSources.map(option => <option key={option.name} value={option.name}>{option.name}</option>)}</select><ErrorText errors={fieldErrors.source}/></div>
  <div><label htmlFor="eventType">Tipo de evento</label><select id="eventType" name="eventType" aria-invalid={Boolean(fieldErrors.eventType)} defaultValue={values?.eventType ?? ""} className={fieldClass(fieldErrors.eventType)}><option value="">Selecione</option>{eventTypes.map(option => <option key={option.name} value={option.name}>{option.name}</option>)}</select><ErrorText errors={fieldErrors.eventType}/></div>
  <div><label htmlFor="desiredDate">Data desejada</label><input id="desiredDate" name="desiredDate" type="date" aria-invalid={Boolean(fieldErrors.desiredDate)} defaultValue={values?.desiredDate} className={fieldClass(fieldErrors.desiredDate)}/><ErrorText errors={fieldErrors.desiredDate}/></div>
  <div><label htmlFor="guestCount">Convidados estimados</label><input id="guestCount" name="guestCount" type="number" min="1" aria-invalid={Boolean(fieldErrors.guestCount)} defaultValue={values?.guestCount} className={fieldClass(fieldErrors.guestCount)}/><ErrorText errors={fieldErrors.guestCount}/></div>
  {canAssign && <div><label htmlFor="responsibleId">Responsável</label><select id="responsibleId" name="responsibleId" aria-invalid={Boolean(fieldErrors.responsibleId)} defaultValue={values?.responsibleId ?? ""} className={fieldClass(fieldErrors.responsibleId)}><option value="">Eu mesma</option>{people.map(person => <option key={person.id} value={person.id}>{person.display_name ?? "Usuário"}</option>)}</select><ErrorText errors={fieldErrors.responsibleId}/></div>}
  <div className="md:col-span-2"><label htmlFor="notes">Observações</label><textarea id="notes" name="notes" rows={4} aria-invalid={Boolean(fieldErrors.notes)} defaultValue={values?.notes} className={fieldClass(fieldErrors.notes)}/><ErrorText errors={fieldErrors.notes}/></div>
  {state.error && <p role="alert" className="md:col-span-2 rounded-lg bg-red-50 p-3 text-sm text-red-800">{state.error}</p>}
  <div className="md:col-span-2"><button disabled={pending} className="rounded-lg bg-[#18352d] px-5 py-3 font-semibold text-white disabled:opacity-60">{pending ? "Salvando…" : "Cadastrar lead"}</button></div>
 </form>;
}
