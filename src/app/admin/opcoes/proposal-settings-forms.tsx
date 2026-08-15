"use client";

import { useState } from "react";
import { useActionState } from "react";
import { createProposalOption, createQuoteItemCatalogOption, updateCompanyLogo, type LogoFormState, type ProposalOptionFormState, type QuoteItemCatalogOptionFormState } from "./actions";

const logoInitialState: LogoFormState = {};
const proposalOptionInitialState: ProposalOptionFormState = {};
const quoteItemCatalogOptionInitialState: QuoteItemCatalogOptionFormState = {};

export function CompanyLogoForm({ logoUrl }: { logoUrl: string }) {
  const [state, action, pending] = useActionState(updateCompanyLogo, logoInitialState);
  const [selectedLogo, setSelectedLogo] = useState(state.logoUrl ?? logoUrl);
  const [fileError, setFileError] = useState<string>();
  const currentLogo = selectedLogo || state.logoUrl || logoUrl;

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setFileError(undefined);
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setFileError("Selecione um arquivo de imagem.");
      return;
    }
    if (file.size > 250_000) {
      setFileError("Use uma imagem menor, até 250 KB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setSelectedLogo(reader.result);
    };
    reader.readAsDataURL(file);
  }

  return (
    <form action={action} className="mt-4 space-y-4">
      <div>
        <label htmlFor="logoFile">Buscar logo no computador</label>
        <input id="logoFile" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={handleFileChange} />
        <input type="hidden" name="logoUrl" value={currentLogo} />
        <p className="mt-1 text-sm text-slate-500">Use uma imagem pequena, preferencialmente PNG ou SVG. Se não escolher nada, a proposta usa apenas o texto Sunrise Celebrations.</p>
      </div>
      {fileError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{fileError}</p>}
      {currentLogo && (
        <div className="rounded-lg border border-[#dbe3dc] bg-[#fbf8f1] p-4">
          <p className="mb-2 text-sm font-semibold text-slate-600">Prévia</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={currentLogo} alt="Logo cadastrada" className="max-h-20 max-w-56 object-contain" />
        </div>
      )}
      {state.error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{state.error}</p>}
      {state.success && <p role="status" className="rounded-lg bg-[#edf5ee] p-3 text-sm text-[#356451]">{state.success}</p>}
      <button disabled={pending} className="rounded-lg bg-[#18352d] px-5 py-3 font-semibold text-white transition hover:bg-[#23483d] disabled:opacity-60">
        {pending ? "Salvando..." : "Salvar logo"}
      </button>
      {currentLogo && (
        <button type="button" onClick={() => setSelectedLogo("")} className="ml-3 rounded-lg border border-[#dbe3dc] px-5 py-3 font-semibold text-[#18352d] transition hover:bg-[#f6f0e5]">
          Remover prévia
        </button>
      )}
    </form>
  );
}

export function ProposalOptionForm() {
  const [state, action, pending] = useActionState(createProposalOption, proposalOptionInitialState);

  return (
    <form action={action} className="mt-4 space-y-4">
      <div>
        <label htmlFor="proposal-option-title">Título</label>
        <input id="proposal-option-title" name="title" defaultValue={state.title ?? ""} placeholder="Ex.: Validade da proposta" />
      </div>
      <div>
        <label htmlFor="proposal-option-content">Texto padrão</label>
        <textarea id="proposal-option-content" name="content" rows={4} defaultValue={state.content ?? ""} placeholder="Ex.: Esta proposta é válida por 7 dias..." />
      </div>
      {state.error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{state.error}</p>}
      {state.success && <p role="status" className="rounded-lg bg-[#edf5ee] p-3 text-sm text-[#356451]">{state.success}</p>}
      <button disabled={pending} className="rounded-lg bg-[#18352d] px-5 py-3 font-semibold text-white transition hover:bg-[#23483d] disabled:opacity-60">
        {pending ? "Salvando..." : "Adicionar opção"}
      </button>
    </form>
  );
}

export function QuoteItemCatalogOptionForm() {
  const [state, action, pending] = useActionState(createQuoteItemCatalogOption, quoteItemCatalogOptionInitialState);

  return (
    <form action={action} className="mt-4 space-y-4">
      <div>
        <label htmlFor="quote-item-name">Item/serviço</label>
        <input id="quote-item-name" name="name" defaultValue={state.name ?? ""} placeholder="Ex.: Buffet completo" />
      </div>
      <div>
        <label htmlFor="quote-item-description">Descrição padrão</label>
        <textarea id="quote-item-description" name="description" rows={3} defaultValue={state.description ?? ""} placeholder="Opcional. Ex.: Buffet completo para evento social..." />
      </div>
      <div>
        <label htmlFor="quote-item-price">Valor unitário padrão</label>
        <input id="quote-item-price" name="defaultUnitPrice" inputMode="decimal" defaultValue={state.defaultUnitPrice ?? ""} placeholder="Opcional. Ex.: 120,00" />
      </div>
      {state.error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{state.error}</p>}
      {state.success && <p role="status" className="rounded-lg bg-[#edf5ee] p-3 text-sm text-[#356451]">{state.success}</p>}
      <button disabled={pending} className="rounded-lg bg-[#18352d] px-5 py-3 font-semibold text-white transition hover:bg-[#23483d] disabled:opacity-60">
        {pending ? "Salvando..." : "Adicionar item"}
      </button>
    </form>
  );
}
