"use client";

import { useActionState } from "react";
import { addQuoteProposalOption, removeQuoteProposalOption, type QuoteFormState } from "../actions";

const initialState: QuoteFormState = {};

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
      <h2 className="font-semibold">Condições da proposta</h2>
      <p className="mt-1 text-sm text-slate-600">Inclua validade, pagamento, condições comerciais ou uma observação manual para este orçamento.</p>

      {selectedOptions.length ? (
        <ul className="mt-4 divide-y divide-[#edf1ee]">
          {selectedOptions.map((option) => (
            <QuoteProposalOptionRow key={option.id} quoteId={quoteId} option={option} />
          ))}
        </ul>
      ) : (
        <p className="mt-4 rounded-lg bg-[#fbf8f1] p-3 text-sm text-slate-600">Nenhuma condição adicionada à proposta.</p>
      )}

      <form key={addState.version ?? "proposal-option-initial"} action={addAction} className="mt-5 space-y-4 rounded-xl bg-[#fbf8f1] p-4">
        <input type="hidden" name="quoteId" value={quoteId} />
        <div>
          <label htmlFor="catalogOptionId">Adicionar condição</label>
          <select id="catalogOptionId" name="catalogOptionId" defaultValue={selectedCatalogValue}>
            <option value="">Selecione uma condição padrão</option>
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
