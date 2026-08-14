"use client";

import { useActionState } from "react";
import { formatCurrencyFromCents, quoteStatuses, quoteStatusLabel } from "@/lib/domain/quote";
import { addQuoteItem, addQuoteProposalOption, removeQuoteItem, removeQuotePackage, removeQuoteProposalOption, setApprovedQuoteEditLock, setQuotePackage, updateQuoteItem, updateQuoteStatus, type QuoteFormState } from "../actions";

const initialState: QuoteFormState = {};

type QuoteItemForEditor = {
  id: string;
  description: string;
  quantity: number;
  unit_price_cents: number;
};

type QuoteItemCatalogOption = {
  id: string;
  name: string;
  description: string | null;
  default_unit_price_cents: number | null;
};

type ProposalCatalogOption = {
  id: string;
  title: string;
  content: string;
};

type QuoteProposalOption = {
  id: string;
  title: string;
  content: string;
};

type EventPackageOption = {
  id: string;
  event_type: string;
  name: string;
  description: string | null;
  base_price_cents: number | null;
  event_package_items: EventPackageItem[] | EventPackageItem | null;
};

type EventPackageItem = {
  id: string;
  category: string;
  name: string;
  description: string | null;
  show_in_proposal: boolean;
  show_in_operational_brief: boolean;
};

type QuotePackage = {
  id: string;
  package_id: string;
  unit_price_cents: number;
  guest_count: number;
  total_price_cents: number;
  notes: string | null;
  event_package_catalog: EventPackageOption | null;
};

export function QuotePackageForm({
  canEdit,
  guestCount,
  packageOptions,
  quoteId,
  selectedPackage,
}: {
  canEdit: boolean;
  guestCount: number | null;
  packageOptions: EventPackageOption[];
  quoteId: string;
  selectedPackage?: QuotePackage;
}) {
  const [state, action, pending] = useActionState(setQuotePackage, initialState);
  const [removeState, removeAction, removePending] = useActionState(removeQuotePackage, initialState);
  const selectedOption = selectedPackage?.event_package_catalog;
  const selectedItems = asArray(selectedOption?.event_package_items);

  function handlePackageChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const selected = packageOptions.find((option) => option.id === event.currentTarget.value);
    const form = event.currentTarget.form;
    const unitPrice = form?.elements.namedItem("unitPrice");
    if (unitPrice instanceof HTMLInputElement) {
      unitPrice.value = selected?.base_price_cents ? (selected.base_price_cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "";
    }
  }

  return (
    <section className="rounded-xl border border-[#dbe3dc] bg-white p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-semibold">Pacote do evento</h2>
          <p className="mt-1 text-sm text-slate-600">Selecione o pacote principal. O valor por pessoa será multiplicado pelos convidados.</p>
        </div>
        {selectedPackage && (
          <span className="rounded-full bg-[#edf5ee] px-3 py-1 text-sm font-semibold text-[#356451]">
            {formatCurrencyFromCents(selectedPackage.total_price_cents)}
          </span>
        )}
      </div>

      {selectedPackage && selectedOption && (
        <div className="mt-4 rounded-xl bg-[#fbf8f1] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#356451]">Pacote aplicado</p>
          <p className="mt-1 font-semibold">{selectedOption.name}</p>
          <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
            <div className="rounded-lg bg-white p-3">
              <p className="text-slate-500">Valor por pessoa</p>
              <p className="mt-1 font-semibold">{formatCurrencyFromCents(selectedPackage.unit_price_cents)}</p>
            </div>
            <div className="rounded-lg bg-white p-3">
              <p className="text-slate-500">Convidados</p>
              <p className="mt-1 font-semibold">{selectedPackage.guest_count}</p>
            </div>
            <div className="rounded-lg bg-white p-3">
              <p className="text-slate-500">Total do pacote</p>
              <p className="mt-1 font-semibold">{formatCurrencyFromCents(selectedPackage.total_price_cents)}</p>
            </div>
          </div>
          {selectedOption.description && <p className="mt-2 text-sm text-slate-600">{selectedOption.description}</p>}
          {selectedItems.length > 0 && (
            <ul className="mt-3 grid gap-2 text-sm md:grid-cols-2">
              {selectedItems.map((item) => (
                <li key={item.id} className="rounded-lg bg-white px-3 py-2">
                  <span className="font-semibold">{categoryLabel(item.category)}:</span> {item.name}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {!canEdit && <p className="mt-4 rounded-lg bg-slate-100 p-3 text-sm text-slate-700">Edição bloqueada para orçamento aprovado.</p>}
      {canEdit && (
        <>
          {!guestCount && <p className="mt-4 rounded-lg bg-[#fff5e6] p-3 text-sm text-[#744c15]">Informe a quantidade de convidados no lead antes de aplicar um pacote.</p>}
          <form action={action} className="mt-4">
            <input type="hidden" name="quoteId" value={quoteId} />
            <div className="grid gap-4 md:grid-cols-[1fr_180px]">
              <div>
                <label htmlFor="packageId">Pacote</label>
                <select id="packageId" name="packageId" defaultValue={state.values?.packageId ?? selectedPackage?.package_id ?? ""} onChange={handlePackageChange} required>
                  <option value="">Selecione um pacote</option>
                  {packageOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name} {option.base_price_cents ? `· ${formatCurrencyFromCents(option.base_price_cents)} / pessoa` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="unitPrice">Valor por pessoa</label>
                <input id="unitPrice" name="unitPrice" inputMode="decimal" defaultValue={state.values?.unitPrice ?? (selectedPackage ? (selectedPackage.unit_price_cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "")} placeholder="Ex.: 120,00" />
              </div>
            </div>
            <div className="mt-4">
              <label htmlFor="package-notes">Observações do pacote</label>
              <textarea id="package-notes" name="notes" rows={3} defaultValue={state.values?.notes ?? selectedPackage?.notes ?? ""} placeholder="Ajustes comerciais específicos para este orçamento." />
            </div>
            {state.error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{state.error}</p>}
            {state.success && <p role="status" className="mt-4 rounded-lg bg-[#edf5ee] p-3 text-sm text-[#356451]">{state.success}</p>}
            <button disabled={pending || !guestCount} className="mt-4 rounded-lg bg-[#18352d] px-5 py-3 font-semibold text-white transition hover:bg-[#23483d] disabled:opacity-60">
              {pending ? "Aplicando..." : selectedPackage ? "Atualizar pacote" : "Aplicar pacote"}
            </button>
          </form>
          {selectedPackage && (
            <form action={removeAction} className="mt-3">
              <input type="hidden" name="quoteId" value={quoteId} />
              {removeState.error && <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{removeState.error}</p>}
              {removeState.success && <p role="status" className="mb-3 rounded-lg bg-[#edf5ee] p-3 text-sm text-[#356451]">{removeState.success}</p>}
              <button disabled={removePending} className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-60">
                {removePending ? "Removendo..." : "Remover pacote"}
              </button>
            </form>
          )}
        </>
      )}
    </section>
  );
}

export function QuoteItemForm({ quoteId, catalogItems = [] }: { quoteId: string; catalogItems?: QuoteItemCatalogOption[] }) {
  const [state, action, pending] = useActionState(addQuoteItem, initialState);
  const fieldErrors = state.fieldErrors ?? {};

  function handleCatalogChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const selected = catalogItems.find((item) => item.id === event.currentTarget.value);
    const form = event.currentTarget.form;
    if (!selected || !form) return;

    const description = form.elements.namedItem("description");
    if (description instanceof HTMLInputElement) description.value = selected.description || selected.name;

    const unitPrice = form.elements.namedItem("unitPrice");
    if (unitPrice instanceof HTMLInputElement && selected.default_unit_price_cents) {
      unitPrice.value = (selected.default_unit_price_cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
    }
  }

  return (
    <form key={state.version ?? "item-initial"} action={action} className="rounded-xl border border-[#dbe3dc] bg-white p-5">
      <h2 className="font-semibold">Adicionar item</h2>
      <input type="hidden" name="quoteId" value={quoteId} />
      <div className="mt-4">
        <label htmlFor="catalogItem">Item/serviço padrão</label>
        <select id="catalogItem" name="catalogItem" defaultValue="" onChange={handleCatalogChange}>
          <option value="">Selecione ou preencha manualmente</option>
          {catalogItems.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
          <option value="manual">Outro item manual</option>
        </select>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-[1fr_120px_160px]">
        <div>
          <label htmlFor="description">Descrição</label>
          <input id="description" name="description" required defaultValue={state.values?.description} className={fieldErrors.description ? "border-red-500 bg-red-50" : ""} />
          {fieldErrors.description?.[0] && <p className="mt-1 text-sm text-red-700">{fieldErrors.description[0]}</p>}
        </div>
        <div>
          <label htmlFor="quantity">Qtd.</label>
          <input id="quantity" name="quantity" type="number" min="0.01" step="0.01" required defaultValue={state.values?.quantity ?? "1"} className={fieldErrors.quantity ? "border-red-500 bg-red-50" : ""} />
          {fieldErrors.quantity?.[0] && <p className="mt-1 text-sm text-red-700">{fieldErrors.quantity[0]}</p>}
        </div>
        <div>
          <label htmlFor="unitPrice">Valor unitário</label>
          <input id="unitPrice" name="unitPrice" inputMode="decimal" required placeholder="Ex.: 120,00" defaultValue={state.values?.unitPrice} className={fieldErrors.unitPrice ? "border-red-500 bg-red-50" : ""} />
          {fieldErrors.unitPrice?.[0] && <p className="mt-1 text-sm text-red-700">{fieldErrors.unitPrice[0]}</p>}
        </div>
      </div>
      {state.error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{state.error}</p>}
      {state.success && <p role="status" className="mt-4 rounded-lg bg-[#edf5ee] p-3 text-sm text-[#356451]">{state.success}</p>}
      <button disabled={pending} className="mt-4 rounded-lg bg-[#18352d] px-5 py-3 font-semibold text-white transition hover:bg-[#23483d] active:scale-[0.99] disabled:opacity-60">
        {pending ? "Adicionando..." : "Adicionar item"}
      </button>
    </form>
  );
}

export function QuoteItemEditor({ canEdit, quoteId, item }: { canEdit: boolean; quoteId: string; item: QuoteItemForEditor }) {
  const [editState, editAction, editPending] = useActionState(updateQuoteItem, initialState);
  const [removeState, removeAction, removePending] = useActionState(removeQuoteItem, initialState);
  const fieldErrors = editState.fieldErrors ?? {};
  const quantity = Number(item.quantity);
  const unitPrice = item.unit_price_cents / 100;

  return (
    <li className="border-b border-[#edf1ee] p-4 last:border-0">
      <details className="group">
        <summary className="grid cursor-pointer list-none gap-3 rounded-lg p-2 transition hover:bg-[#f6fbf7] md:grid-cols-[1fr_100px_140px_140px] md:items-center">
          <p className="font-medium">{item.description}</p>
          <p className="text-sm text-slate-600">Qtd. {quantity.toLocaleString("pt-BR")}</p>
          <p className="text-sm text-slate-600">{formatCurrencyFromCents(item.unit_price_cents)}</p>
          <p className="font-semibold text-[#18352d]">{formatCurrencyFromCents(Math.round(quantity * item.unit_price_cents))}</p>
        </summary>

        <div className="mt-4 rounded-xl border border-[#dbe3dc] bg-[#fbf8f1] p-4">
          {!canEdit && <p className="rounded-lg bg-slate-100 p-3 text-sm text-slate-700">Edição bloqueada para orçamento aprovado.</p>}
          {canEdit && (
          <>
          <form key={editState.version ?? item.id} action={editAction}>
            <input type="hidden" name="quoteId" value={quoteId} />
            <input type="hidden" name="itemId" value={item.id} />
            <div className="grid gap-4 md:grid-cols-[1fr_120px_160px]">
              <div>
                <label htmlFor={`description-${item.id}`}>Descrição</label>
                <input
                  id={`description-${item.id}`}
                  name="description"
                  required
                  defaultValue={editState.values?.description ?? item.description}
                  className={fieldErrors.description ? "border-red-500 bg-red-50" : ""}
                />
                {fieldErrors.description?.[0] && <p className="mt-1 text-sm text-red-700">{fieldErrors.description[0]}</p>}
              </div>
              <div>
                <label htmlFor={`quantity-${item.id}`}>Qtd.</label>
                <input
                  id={`quantity-${item.id}`}
                  name="quantity"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  defaultValue={editState.values?.quantity ?? String(quantity)}
                  className={fieldErrors.quantity ? "border-red-500 bg-red-50" : ""}
                />
                {fieldErrors.quantity?.[0] && <p className="mt-1 text-sm text-red-700">{fieldErrors.quantity[0]}</p>}
              </div>
              <div>
                <label htmlFor={`unitPrice-${item.id}`}>Valor unitário</label>
                <input
                  id={`unitPrice-${item.id}`}
                  name="unitPrice"
                  inputMode="decimal"
                  required
                  defaultValue={editState.values?.unitPrice ?? unitPrice.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  className={fieldErrors.unitPrice ? "border-red-500 bg-red-50" : ""}
                />
                {fieldErrors.unitPrice?.[0] && <p className="mt-1 text-sm text-red-700">{fieldErrors.unitPrice[0]}</p>}
              </div>
            </div>
            {editState.error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{editState.error}</p>}
            {editState.success && <p role="status" className="mt-4 rounded-lg bg-[#edf5ee] p-3 text-sm text-[#356451]">{editState.success}</p>}
            <button disabled={editPending} className="mt-4 rounded-lg bg-[#18352d] px-5 py-3 font-semibold text-white transition hover:bg-[#23483d] active:scale-[0.99] disabled:opacity-60">
              {editPending ? "Salvando..." : "Salvar item"}
            </button>
          </form>

          <form action={removeAction} className="mt-3">
            <input type="hidden" name="quoteId" value={quoteId} />
            <input type="hidden" name="itemId" value={item.id} />
            {removeState.error && <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{removeState.error}</p>}
            {removeState.success && <p role="status" className="mb-3 rounded-lg bg-[#edf5ee] p-3 text-sm text-[#356451]">{removeState.success}</p>}
            <button disabled={removePending} className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 active:scale-[0.99] disabled:opacity-60">
              {removePending ? "Removendo..." : "Remover item"}
            </button>
          </form>
          </>
          )}
        </div>
      </details>
    </li>
  );
}

export function QuoteStatusForm({ decisionReason, quoteId, status }: { decisionReason: string; quoteId: string; status: string }) {
  const [state, action, pending] = useActionState(updateQuoteStatus, initialState);
  return (
    <form action={action} className="rounded-xl border border-[#dbe3dc] bg-white p-5">
      <h2 className="font-semibold">Status do orçamento</h2>
      <input type="hidden" name="quoteId" value={quoteId} />
      <div className="mt-4">
        <label htmlFor="status">Status</label>
        <select id="status" name="status" defaultValue={status}>
          {quoteStatuses.map((quoteStatus) => (
            <option key={quoteStatus} value={quoteStatus}>
              {quoteStatusLabel(quoteStatus)}
            </option>
          ))}
        </select>
      </div>
      <div className="mt-4">
        <label htmlFor="reason">Motivo da decisão</label>
        <textarea id="reason" name="reason" rows={3} defaultValue={state.values?.reason ?? decisionReason} placeholder="Obrigatório para aprovado ou recusado." />
        <p className="mt-1 text-xs text-slate-500">Use para registrar aprovação, recusa ou contexto comercial importante.</p>
      </div>
      {state.error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{state.error}</p>}
      {state.success && <p role="status" className="mt-4 rounded-lg bg-[#edf5ee] p-3 text-sm text-[#356451]">{state.success}</p>}
      <button disabled={pending} className="mt-4 rounded-lg bg-[#18352d] px-5 py-3 font-semibold text-white transition hover:bg-[#23483d] active:scale-[0.99] disabled:opacity-60">
        {pending ? "Atualizando..." : "Atualizar status"}
      </button>
    </form>
  );
}

export function QuoteEditLockForm({ quoteId, unlocked }: { quoteId: string; unlocked: boolean }) {
  const [state, action, pending] = useActionState(setApprovedQuoteEditLock, initialState);
  return (
    <form action={action} className="rounded-xl border border-[#dbe3dc] bg-white p-5">
      <h2 className="font-semibold">Edição pós-aprovação</h2>
      <p className="mt-2 text-sm text-slate-600">
        {unlocked ? "A edição está liberada pelo admin para ajustes controlados." : "O orçamento aprovado está protegido contra edição acidental."}
      </p>
      <input type="hidden" name="quoteId" value={quoteId} />
      <input type="hidden" name="unlocked" value={unlocked ? "false" : "true"} />
      <div className="mt-4">
        <label htmlFor="edit-lock-reason">Motivo</label>
        <textarea id="edit-lock-reason" name="reason" rows={3} defaultValue={state.values?.reason ?? ""} placeholder="Ex.: ajuste solicitado pelo cliente após aprovação." />
      </div>
      {state.error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{state.error}</p>}
      {state.success && <p role="status" className="mt-4 rounded-lg bg-[#edf5ee] p-3 text-sm text-[#356451]">{state.success}</p>}
      <button disabled={pending} className="mt-4 rounded-lg bg-[#18352d] px-5 py-3 font-semibold text-white transition hover:bg-[#23483d] active:scale-[0.99] disabled:opacity-60">
        {pending ? "Atualizando..." : unlocked ? "Bloquear edição" : "Liberar edição"}
      </button>
    </form>
  );
}

export function QuoteProposalOptionsPanel({
  quoteId,
  catalogOptions,
  selectedOptions,
}: {
  quoteId: string;
  catalogOptions: ProposalCatalogOption[];
  selectedOptions: QuoteProposalOption[];
}) {
  const [addState, addAction, addPending] = useActionState(addQuoteProposalOption, initialState);
  const selectedCatalogValue = addState.values?.catalogOptionId ?? "";

  return (
    <section className="rounded-xl border border-[#dbe3dc] bg-white p-5">
      <h2 className="font-semibold">Opções da proposta</h2>
      <p className="mt-1 text-sm text-slate-600">Inclua condições e observações padronizadas ou escreva uma opção manual para este orçamento.</p>

      {selectedOptions.length ? (
        <ul className="mt-4 divide-y divide-[#edf1ee]">
          {selectedOptions.map((option) => (
            <QuoteProposalOptionRow key={option.id} quoteId={quoteId} option={option} />
          ))}
        </ul>
      ) : (
        <p className="mt-4 rounded-lg bg-[#fbf8f1] p-3 text-sm text-slate-600">Nenhuma opção adicionada à proposta.</p>
      )}

      <form key={addState.version ?? "proposal-option-initial"} action={addAction} className="mt-5 space-y-4 rounded-xl bg-[#fbf8f1] p-4">
        <input type="hidden" name="quoteId" value={quoteId} />
        <div>
          <label htmlFor="catalogOptionId">Adicionar opção</label>
          <select id="catalogOptionId" name="catalogOptionId" defaultValue={selectedCatalogValue}>
            <option value="">Selecione uma opção padrão</option>
            {catalogOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.title}
              </option>
            ))}
            <option value="manual">Escrever manualmente</option>
          </select>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="proposal-title">Título manual</label>
            <input id="proposal-title" name="title" defaultValue={addState.values?.title ?? ""} placeholder="Ex.: Condição especial" />
          </div>
          <div>
            <label htmlFor="proposal-content">Texto manual</label>
            <textarea id="proposal-content" name="content" rows={3} defaultValue={addState.values?.content ?? ""} placeholder="Texto que aparecerá na proposta" />
          </div>
        </div>
        {addState.error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{addState.error}</p>}
        {addState.success && <p role="status" className="rounded-lg bg-[#edf5ee] p-3 text-sm text-[#356451]">{addState.success}</p>}
        <button disabled={addPending} className="rounded-lg bg-[#18352d] px-5 py-3 font-semibold text-white transition hover:bg-[#23483d] active:scale-[0.99] disabled:opacity-60">
          {addPending ? "Adicionando..." : "Adicionar à proposta"}
        </button>
      </form>
    </section>
  );
}

function QuoteProposalOptionRow({ quoteId, option }: { quoteId: string; option: QuoteProposalOption }) {
  const [state, action, pending] = useActionState(removeQuoteProposalOption, initialState);
  return (
    <li className="py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold">{option.title}</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{option.content}</p>
        </div>
        <form action={action}>
          <input type="hidden" name="quoteId" value={quoteId} />
          <input type="hidden" name="optionId" value={option.id} />
          <button disabled={pending} className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-60">
            {pending ? "Removendo..." : "Remover"}
          </button>
        </form>
      </div>
      {state.error && <p role="alert" className="mt-2 rounded-lg bg-red-50 p-3 text-sm text-red-800">{state.error}</p>}
      {state.success && <p role="status" className="mt-2 rounded-lg bg-[#edf5ee] p-3 text-sm text-[#356451]">{state.success}</p>}
    </li>
  );
}

function categoryLabel(category: string) {
  const labels: Record<string, string> = {
    buffet: "Buffet",
    comida: "Buffet",
    bebida: "Bebidas",
    servico: "Serviço",
    estrutura: "Estrutura",
    decoracao: "Decoração",
    outro: "Outro",
  };
  return labels[category] ?? category;
}

function asArray<T>(value: T[] | T | null | undefined) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}
