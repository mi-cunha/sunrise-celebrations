"use client";
import { useActionState } from "react";
import { createOption, type OptionFormState } from "./actions";

const initialState: OptionFormState = {};

export function OptionForm({ kind, label }: { kind: "event_type" | "lead_source"; label: string }) {
  const [state, action, pending] = useActionState(createOption, initialState);
  const message = state.kind === kind ? state.error ?? state.success : undefined;
  return <form action={action} className="mt-4 flex flex-col gap-3 sm:flex-row"><input type="hidden" name="kind" value={kind}/><div className="flex-1"><label htmlFor={kind}>{label}</label><input id={kind} name="name" defaultValue={state.kind === kind ? state.name : ""} placeholder="Nova opção"/></div><div className="sm:self-end"><button disabled={pending} className="rounded-lg bg-[#18352d] px-5 py-3 font-semibold text-white disabled:opacity-60">{pending ? "Salvando..." : "Adicionar"}</button></div>{message && <p role="status" className={`sm:self-end text-sm ${state.error ? "text-red-700" : "text-[#356451]"}`}>{message}</p>}</form>;
}
