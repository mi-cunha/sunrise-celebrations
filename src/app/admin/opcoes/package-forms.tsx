"use client";

import { useActionState } from "react";
import { formatCurrencyFromCents } from "@/lib/domain/quote";
import {
  createEventPackage,
  createEventPackageItem,
  removeEventPackageItem,
  updateEventPackageItem,
  type PackageCatalogFormState,
  type PackageItemFormState,
} from "./actions";

const packageInitialState: PackageCatalogFormState = {};
const itemInitialState: PackageItemFormState = {};

type EventTypeOption = {
  name: string;
};

type EventPackage = {
  id: string;
  event_type: string;
  name: string;
  description: string | null;
  base_price_cents: number | null;
  proposal_notes: string | null;
  operation_notes: string | null;
  event_package_items: PackageItem[];
};

type PackageItem = {
  id: string;
  category: string;
  name: string;
  description: string | null;
  show_in_proposal: boolean;
  show_in_operational_brief: boolean;
};

export function EventPackageForm({ eventTypes }: { eventTypes: EventTypeOption[] }) {
  const [state, action, pending] = useActionState(createEventPackage, packageInitialState);

  return (
    <form action={action} className="rounded-lg border border-[#dbe3dc] bg-[#fbf8f1] p-4">
      <h3 className="font-semibold">Novo pacote</h3>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="package-event-type">Tipo de evento</label>
          <select id="package-event-type" name="eventType" defaultValue={state.eventType ?? ""} required>
            <option value="">Selecione</option>
            {eventTypes.map((option) => (
              <option key={option.name} value={option.name}>
                {option.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="package-name">Nome do pacote</label>
          <input id="package-name" name="name" defaultValue={state.name ?? ""} placeholder="Ex.: Standard, Premium, Café completo" required />
        </div>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-[1fr_180px]">
        <div>
          <label htmlFor="package-description">Descrição comercial</label>
          <textarea id="package-description" name="description" rows={3} defaultValue={state.description ?? ""} placeholder="Resumo do pacote para a equipe comercial." />
        </div>
        <div>
          <label htmlFor="package-base-price">Valor por pessoa</label>
          <input id="package-base-price" name="basePrice" inputMode="decimal" defaultValue={state.basePrice ?? ""} placeholder="Ex.: 120,00" />
          <p className="mt-1 text-xs text-slate-500">Será multiplicado pela quantidade de convidados no orçamento.</p>
        </div>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="package-proposal-notes">Texto para proposta</label>
          <textarea id="package-proposal-notes" name="proposalNotes" rows={3} defaultValue={state.proposalNotes ?? ""} placeholder="Texto comercial que poderá aparecer na proposta." />
        </div>
        <div>
          <label htmlFor="package-operation-notes">Observações operacionais</label>
          <textarea id="package-operation-notes" name="operationNotes" rows={3} defaultValue={state.operationNotes ?? ""} placeholder="Detalhes internos para produção/execução." />
        </div>
      </div>
      {state.error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{state.error}</p>}
      {state.success && <p role="status" className="mt-4 rounded-lg bg-[#edf5ee] p-3 text-sm text-[#356451]">{state.success}</p>}
      <button disabled={pending} className="mt-4 rounded-lg bg-[#18352d] px-5 py-3 font-semibold text-white transition hover:bg-[#23483d] disabled:opacity-60">
        {pending ? "Salvando..." : "Criar pacote"}
      </button>
    </form>
  );
}

export function EventPackageAccordionList({ packages }: { packages: EventPackage[] }) {
  if (!packages.length) return <p className="mt-4 rounded-lg bg-[#fbf8f1] p-3 text-sm text-slate-600">Nenhum pacote cadastrado.</p>;

  return (
    <ul className="mt-5 space-y-3">
      {packages.map((eventPackage) => (
        <li key={eventPackage.id}>
          <details className="rounded-lg border border-[#dbe3dc] bg-[#fbf8f1]">
            <summary className="cursor-pointer list-none p-4 transition hover:bg-[#f6f0e5]">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-semibold">
                    {eventPackage.event_type} · {eventPackage.name}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">{eventPackage.description || "Sem descrição."}</p>
                </div>
                <span className="text-sm font-semibold text-[#18352d]">{eventPackage.base_price_cents ? `${formatCurrencyFromCents(eventPackage.base_price_cents)} / pessoa` : "Sem valor por pessoa"}</span>
              </div>
            </summary>
            <div className="space-y-4 border-t border-[#dbe3dc] p-4">
              <PackageItemForm packageId={eventPackage.id} />
              <PackageItemsList packageId={eventPackage.id} items={eventPackage.event_package_items ?? []} />
              {(eventPackage.proposal_notes || eventPackage.operation_notes) && (
                <div className="grid gap-3 md:grid-cols-2">
                  {eventPackage.proposal_notes && <InfoBox title="Texto para proposta" content={eventPackage.proposal_notes} />}
                  {eventPackage.operation_notes && <InfoBox title="Observações operacionais" content={eventPackage.operation_notes} />}
                </div>
              )}
            </div>
          </details>
        </li>
      ))}
    </ul>
  );
}

function PackageItemForm({ packageId }: { packageId: string }) {
  const [state, action, pending] = useActionState(createEventPackageItem, itemInitialState);

  return (
    <form action={action} className="rounded-lg bg-white p-4">
      <h4 className="font-semibold">Adicionar item incluso</h4>
      <input type="hidden" name="packageId" value={packageId} />
      <PackageItemFields packageId={packageId} state={state} />
      {state.packageId === packageId && state.error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{state.error}</p>}
      {state.packageId === packageId && state.success && <p role="status" className="mt-4 rounded-lg bg-[#edf5ee] p-3 text-sm text-[#356451]">{state.success}</p>}
      <button disabled={pending} className="mt-4 rounded-lg bg-[#18352d] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#23483d] disabled:opacity-60">
        {pending ? "Adicionando..." : "Adicionar item"}
      </button>
    </form>
  );
}

function PackageItemsList({ items, packageId }: { items: PackageItem[]; packageId: string }) {
  if (!items.length) return <p className="rounded-lg bg-white p-3 text-sm text-slate-600">Nenhum item incluso neste pacote.</p>;

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <PackageItemAccordion key={item.id} item={item} packageId={packageId} />
      ))}
    </ul>
  );
}

function PackageItemAccordion({ item, packageId }: { item: PackageItem; packageId: string }) {
  const [updateState, updateAction, updatePending] = useActionState(updateEventPackageItem, itemInitialState);
  const [removeState, removeAction, removePending] = useActionState(removeEventPackageItem, itemInitialState);
  const updateMessage = updateState.packageId === packageId ? updateState.error ?? updateState.success : undefined;
  const removeMessage = removeState.packageId === packageId ? removeState.error ?? removeState.success : undefined;

  return (
    <li>
      <details className="rounded-lg border border-[#edf1ee] bg-white">
        <summary className="cursor-pointer list-none p-4 transition hover:bg-[#f6f0e5]">
          <div className="grid gap-2 md:grid-cols-[120px_1fr_180px]">
            <span className="text-sm font-semibold text-[#356451]">{categoryLabel(item.category)}</span>
            <div>
              <p className="font-medium">{item.name}</p>
              {item.description && <p className="mt-1 text-sm text-slate-600">{item.description}</p>}
            </div>
            <p className="text-xs text-slate-500">
              {item.show_in_proposal ? "Proposta" : ""}
              {item.show_in_proposal && item.show_in_operational_brief ? " · " : ""}
              {item.show_in_operational_brief ? "Ficha operacional" : ""}
            </p>
          </div>
        </summary>
        <div className="border-t border-[#edf1ee] p-4">
          <form action={updateAction}>
            <input type="hidden" name="id" value={item.id} />
            <input type="hidden" name="packageId" value={packageId} />
            <PackageItemFields item={item} packageId={packageId} />
            {updateMessage && <p role="status" className={`mt-4 rounded-lg p-3 text-sm ${updateState.error ? "bg-red-50 text-red-800" : "bg-[#edf5ee] text-[#356451]"}`}>{updateMessage}</p>}
            <button disabled={updatePending} className="mt-4 rounded-lg bg-[#18352d] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#23483d] disabled:opacity-60">
              {updatePending ? "Salvando..." : "Salvar item"}
            </button>
          </form>
          <form action={removeAction} className="mt-3">
            <input type="hidden" name="id" value={item.id} />
            <input type="hidden" name="packageId" value={packageId} />
            {removeMessage && <p role="status" className={`mb-3 rounded-lg p-3 text-sm ${removeState.error ? "bg-red-50 text-red-800" : "bg-[#edf5ee] text-[#356451]"}`}>{removeMessage}</p>}
            <button disabled={removePending} className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-60">
              {removePending ? "Removendo..." : "Remover item"}
            </button>
          </form>
        </div>
      </details>
    </li>
  );
}

function PackageItemFields({ item, packageId, state }: { item?: PackageItem; packageId: string; state?: PackageItemFormState }) {
  const currentCategory = item?.category === "comida" ? "buffet" : item?.category;
  return (
    <>
      <div className="mt-4 grid gap-4 md:grid-cols-[160px_1fr]">
        <div>
          <label htmlFor={item ? `package-item-category-${item.id}` : `package-item-category-${packageId}`}>Categoria</label>
          <select id={item ? `package-item-category-${item.id}` : `package-item-category-${packageId}`} name="category" defaultValue={state?.category ?? currentCategory ?? "buffet"}>
            <option value="buffet">Buffet</option>
            <option value="bebida">Bebida</option>
            <option value="servico">Serviço</option>
            <option value="estrutura">Estrutura</option>
            <option value="observacao">Observação</option>
            <option value="outro">Outro</option>
          </select>
        </div>
        <div>
          <label htmlFor={item ? `package-item-name-${item.id}` : `package-item-name-${packageId}`}>Item</label>
          <input id={item ? `package-item-name-${item.id}` : `package-item-name-${packageId}`} name="name" defaultValue={state?.name ?? item?.name ?? ""} placeholder="Ex.: Mini sanduíches, suco natural, equipe de apoio" required />
        </div>
      </div>
      <div className="mt-4">
        <label htmlFor={item ? `package-item-description-${item.id}` : `package-item-description-${packageId}`}>Descrição</label>
        <textarea id={item ? `package-item-description-${item.id}` : `package-item-description-${packageId}`} name="description" rows={2} defaultValue={state?.description ?? item?.description ?? ""} />
      </div>
      <div className="mt-4 flex flex-wrap gap-4">
        <label className="!mb-0 !flex items-center gap-2 text-sm">
          <input type="checkbox" name="showInProposal" defaultChecked={item?.show_in_proposal ?? true} className="!h-4 !w-4" />
          Aparece na proposta
        </label>
        <label className="!mb-0 !flex items-center gap-2 text-sm">
          <input type="checkbox" name="showInOperationalBrief" defaultChecked={item?.show_in_operational_brief ?? true} className="!h-4 !w-4" />
          Aparece na ficha operacional
        </label>
      </div>
    </>
  );
}

function InfoBox({ content, title }: { content: string; title: string }) {
  return (
    <div className="rounded-lg bg-white p-4">
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{content}</p>
    </div>
  );
}

function categoryLabel(category: string) {
  const labels: Record<string, string> = {
    buffet: "Buffet",
    comida: "Buffet",
    bebida: "Bebida",
    servico: "Serviço",
    estrutura: "Estrutura",
    observacao: "Observação",
    outro: "Outro",
  };
  return labels[category] ?? category;
}
