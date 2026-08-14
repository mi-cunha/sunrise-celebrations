"use client";

import { useActionState } from "react";
import {
  removeOptionCatalogItem,
  removeProposalCatalogItem,
  removeQuoteItemCatalogItem,
  updateOptionCatalogItem,
  updateProposalCatalogItem,
  updateQuoteItemCatalogItem,
  type CatalogMutationState,
} from "./actions";

const initialState: CatalogMutationState = {};

type Option = { id: string; name: string };
type ProposalOption = { id: string; title: string; content: string };
type QuoteItemCatalogOption = { id: string; name: string; description: string | null; default_unit_price_cents: number | null };

export function OptionAccordionList({ options }: { options: Option[] }) {
  if (!options.length) return <p className="mt-4 rounded-lg bg-[#fbf8f1] p-3 text-sm text-slate-600">Nenhuma opção cadastrada.</p>;
  return (
    <ul className="mt-5 space-y-3">
      {options.map((option) => (
        <OptionAccordionItem key={option.id} option={option} />
      ))}
    </ul>
  );
}

function OptionAccordionItem({ option }: { option: Option }) {
  const [updateState, updateAction, updatePending] = useActionState(updateOptionCatalogItem, initialState);
  const [removeState, removeAction, removePending] = useActionState(removeOptionCatalogItem, initialState);
  const message = updateState.id === option.id ? updateState.error ?? updateState.success : removeState.id === option.id ? removeState.error ?? removeState.success : undefined;
  const hasError = updateState.id === option.id ? Boolean(updateState.error) : removeState.id === option.id ? Boolean(removeState.error) : false;

  return (
    <li>
      <details className="rounded-xl border border-[#dbe3dc] bg-[#fbf8f1]">
        <summary className="cursor-pointer list-none p-4 font-semibold transition hover:bg-[#f6f0e5]">{option.name}</summary>
        <div className="border-t border-[#dbe3dc] p-4">
          <form action={updateAction} className="space-y-3">
            <input type="hidden" name="id" value={option.id} />
            <div>
              <label htmlFor={`option-name-${option.id}`}>Nome</label>
              <input id={`option-name-${option.id}`} name="name" defaultValue={option.name} />
            </div>
            <button disabled={updatePending} className="rounded-lg bg-[#18352d] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#23483d] disabled:opacity-60">
              {updatePending ? "Salvando..." : "Salvar"}
            </button>
          </form>
          <form action={removeAction} className="mt-3">
            <input type="hidden" name="id" value={option.id} />
            <button disabled={removePending} className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-60">
              {removePending ? "Removendo..." : "Remover"}
            </button>
          </form>
          {message && <p role="status" className={`mt-3 rounded-lg p-3 text-sm ${hasError ? "bg-red-50 text-red-800" : "bg-[#edf5ee] text-[#356451]"}`}>{message}</p>}
        </div>
      </details>
    </li>
  );
}

export function ProposalOptionAccordionList({ options }: { options: ProposalOption[] }) {
  if (!options.length) return <p className="mt-4 rounded-lg bg-[#fbf8f1] p-3 text-sm text-slate-600">Nenhuma condição cadastrada.</p>;
  return (
    <ul className="mt-5 space-y-3">
      {options.map((option) => (
        <ProposalOptionAccordionItem key={option.id} option={option} />
      ))}
    </ul>
  );
}

function ProposalOptionAccordionItem({ option }: { option: ProposalOption }) {
  const [updateState, updateAction, updatePending] = useActionState(updateProposalCatalogItem, initialState);
  const [removeState, removeAction, removePending] = useActionState(removeProposalCatalogItem, initialState);
  const message = updateState.id === option.id ? updateState.error ?? updateState.success : removeState.id === option.id ? removeState.error ?? removeState.success : undefined;
  const hasError = updateState.id === option.id ? Boolean(updateState.error) : removeState.id === option.id ? Boolean(removeState.error) : false;

  return (
    <li>
      <details className="rounded-xl border border-[#dbe3dc] bg-[#fbf8f1]">
        <summary className="cursor-pointer list-none p-4 transition hover:bg-[#f6f0e5]">
          <p className="font-semibold">{option.title}</p>
          <p className="mt-1 text-sm font-normal text-slate-600">{option.content}</p>
        </summary>
        <div className="border-t border-[#dbe3dc] p-4">
          <form action={updateAction} className="space-y-3">
            <input type="hidden" name="id" value={option.id} />
            <div>
              <label htmlFor={`proposal-title-${option.id}`}>Título</label>
              <input id={`proposal-title-${option.id}`} name="title" defaultValue={option.title} />
            </div>
            <div>
              <label htmlFor={`proposal-content-${option.id}`}>Texto</label>
              <textarea id={`proposal-content-${option.id}`} name="content" rows={4} defaultValue={option.content} />
            </div>
            <button disabled={updatePending} className="rounded-lg bg-[#18352d] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#23483d] disabled:opacity-60">
              {updatePending ? "Salvando..." : "Salvar"}
            </button>
          </form>
          <form action={removeAction} className="mt-3">
            <input type="hidden" name="id" value={option.id} />
            <button disabled={removePending} className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-60">
              {removePending ? "Removendo..." : "Remover"}
            </button>
          </form>
          {message && <p role="status" className={`mt-3 rounded-lg p-3 text-sm ${hasError ? "bg-red-50 text-red-800" : "bg-[#edf5ee] text-[#356451]"}`}>{message}</p>}
        </div>
      </details>
    </li>
  );
}

export function QuoteItemCatalogAccordionList({ options }: { options: QuoteItemCatalogOption[] }) {
  if (!options.length) return <p className="mt-4 rounded-lg bg-[#fbf8f1] p-3 text-sm text-slate-600">Nenhum item cadastrado.</p>;
  return (
    <ul className="mt-5 space-y-3">
      {options.map((option) => (
        <QuoteItemCatalogAccordionItem key={option.id} option={option} />
      ))}
    </ul>
  );
}

function QuoteItemCatalogAccordionItem({ option }: { option: QuoteItemCatalogOption }) {
  const [updateState, updateAction, updatePending] = useActionState(updateQuoteItemCatalogItem, initialState);
  const [removeState, removeAction, removePending] = useActionState(removeQuoteItemCatalogItem, initialState);
  const defaultUnitPrice = option.default_unit_price_cents ? (option.default_unit_price_cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "";
  const message = updateState.id === option.id ? updateState.error ?? updateState.success : removeState.id === option.id ? removeState.error ?? removeState.success : undefined;
  const hasError = updateState.id === option.id ? Boolean(updateState.error) : removeState.id === option.id ? Boolean(removeState.error) : false;

  return (
    <li>
      <details className="rounded-xl border border-[#dbe3dc] bg-[#fbf8f1]">
        <summary className="cursor-pointer list-none p-4 transition hover:bg-[#f6f0e5]">
          <p className="font-semibold">{option.name}</p>
          <p className="mt-1 text-sm font-normal text-slate-600">
            {option.default_unit_price_cents ? `Valor padrão: ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(option.default_unit_price_cents / 100)}` : "Sem valor padrão"}
          </p>
        </summary>
        <div className="border-t border-[#dbe3dc] p-4">
          <form action={updateAction} className="space-y-3">
            <input type="hidden" name="id" value={option.id} />
            <div>
              <label htmlFor={`quote-item-name-${option.id}`}>Item/serviço</label>
              <input id={`quote-item-name-${option.id}`} name="name" defaultValue={option.name} />
            </div>
            <div>
              <label htmlFor={`quote-item-description-${option.id}`}>Descrição padrão</label>
              <textarea id={`quote-item-description-${option.id}`} name="description" rows={3} defaultValue={option.description ?? ""} />
            </div>
            <div>
              <label htmlFor={`quote-item-price-${option.id}`}>Valor unitário padrão</label>
              <input id={`quote-item-price-${option.id}`} name="defaultUnitPrice" inputMode="decimal" defaultValue={defaultUnitPrice} placeholder="Ex.: 120,00" />
            </div>
            <button disabled={updatePending} className="rounded-lg bg-[#18352d] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#23483d] disabled:opacity-60">
              {updatePending ? "Salvando..." : "Salvar"}
            </button>
          </form>
          <form action={removeAction} className="mt-3">
            <input type="hidden" name="id" value={option.id} />
            <button disabled={removePending} className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-60">
              {removePending ? "Removendo..." : "Remover"}
            </button>
          </form>
          {message && <p role="status" className={`mt-3 rounded-lg p-3 text-sm ${hasError ? "bg-red-50 text-red-800" : "bg-[#edf5ee] text-[#356451]"}`}>{message}</p>}
        </div>
      </details>
    </li>
  );
}
