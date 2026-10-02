export type AgendaVisibilityState = "negotiation" | "confirmed" | "formalizing";

export type AgendaVisibilityRow = {
  id: string;
  source: "quote" | "event";
  lead_id: string;
  event_date: string;
  desired_start_time: string | null;
  desired_duration_minutes: number | null;
  client_name: string;
  company: string | null;
  title: string;
  event_type: string | null;
  guest_count: number | null;
  responsible_name: string | null;
  next_action: string | null;
  next_action_at: string | null;
  proposal_created_at: string | null;
  visual_state: AgendaVisibilityState;
};

export function agendaStateLabel(state: AgendaVisibilityState) {
  return { negotiation: "Em negociação", confirmed: "Confirmado", formalizing: "Em formalização" }[state];
}

export function shouldShowPreReservation(status: string, desiredDate: string | null) {
  return status === "em_negociacao" && Boolean(desiredDate);
}

export function isAgendaConfirmed(contractStatus: string | null, hasPaidDeposit: boolean) {
  return contractStatus === "assinado" && hasPaidDeposit;
}

export function canKeepNegotiating() {
  return true;
}

export function agendaTimeLabel(startTime: string | null, durationMinutes: number | null) {
  if (!startTime) return "Dia inteiro";
  const [hour, minute] = startTime.slice(0, 5).split(":").map(Number);
  if (!durationMinutes) return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  const end = (hour * 60 + minute + durationMinutes) % (24 * 60);
  return `${startTime.slice(0, 5)}–${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`;
}

export function sortAgendaVisibility(rows: AgendaVisibilityRow[]) {
  const priority: Record<AgendaVisibilityState, number> = { confirmed: 0, formalizing: 1, negotiation: 2 };
  return [...rows].sort((left, right) => priority[left.visual_state] - priority[right.visual_state] || (left.desired_start_time ?? "").localeCompare(right.desired_start_time ?? "") || left.client_name.localeCompare(right.client_name));
}
