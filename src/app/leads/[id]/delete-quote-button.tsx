"use client";

import { useActionState } from "react";
import { deleteLeadQuote, type DeleteLeadQuoteState } from "./actions";

const initialState: DeleteLeadQuoteState = {};

export function DeleteQuoteButton({ leadId, quoteId, quoteTitle }: { leadId: string; quoteId: string; quoteTitle: string }) {
  const [state, action, pending] = useActionState(deleteLeadQuote, initialState);

  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(`Excluir o orçamento “${quoteTitle}”? Essa ação não pode ser desfeita.`)) event.preventDefault();
      }}
      className="flex flex-col items-start gap-1 sm:items-end"
    >
      <input type="hidden" name="leadId" value={leadId} />
      <input type="hidden" name="quoteId" value={quoteId} />
      <button
        type="submit"
        disabled={pending}
        aria-label={`Excluir orçamento ${quoteTitle}`}
        className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? "Excluindo…" : "Excluir"}
      </button>
      {state.error && <span role="alert" className="max-w-56 text-xs text-red-700">{state.error}</span>}
    </form>
  );
}
