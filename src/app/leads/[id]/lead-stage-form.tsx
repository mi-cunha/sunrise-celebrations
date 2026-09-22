"use client";
import { useActionState } from "react";
import { leadStatuses } from "@/lib/domain/lead";
import { changeLeadStatus, type LeadStatusChangeState } from "./actions";
const initialState: LeadStatusChangeState = {};
export function LeadStageForm({ leadId, status }: { leadId: string; status: string }) {
  const [state, action, pending] = useActionState(changeLeadStatus, initialState);
  return <section className="rounded-lg border border-[#dbe3dc] bg-white p-4"><h2 className="font-semibold">Etapa comercial</h2><form action={action} className="mt-3 space-y-3"><input type="hidden" name="leadId" value={leadId} /><div><label htmlFor="lead-stage">Funil</label><select id="lead-stage" name="status" defaultValue={status}>{leadStatuses.map((item) => <option key={item} value={item}>{stageLabel(item)}</option>)}</select></div><div><label htmlFor="lead-lost-reason">Motivo da perda (obrigatório ao marcar perdido)</label><textarea id="lead-lost-reason" name="lostReason" rows={2} maxLength={500} placeholder="Ex.: data indisponível" />{state.fieldErrors?.lostReason?.[0] && <p className="mt-1 text-sm text-red-700">{state.fieldErrors.lostReason[0]}</p>}</div>{state.error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{state.error}</p>}{state.success && <p role="status" className="rounded-lg bg-[#edf5ee] p-3 text-sm text-[#356451]">{state.success}</p>}<button disabled={pending} className="rounded-lg bg-[#18352d] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{pending ? "Atualizando..." : "Atualizar etapa"}</button></form></section>;
}
function stageLabel(status: string) { return ({ novo: "Novo lead", em_atendimento: "Qualificação", qualificado: "Qualificação", visita_agendada: "Visita agendada", orcamento_em_elaboracao: "Proposta enviada", proposta_enviada: "Proposta enviada", negociacao: "Negociação", ganho: "Fechado", perdido: "Perdido" } as Record<string, string>)[status] ?? status; }
