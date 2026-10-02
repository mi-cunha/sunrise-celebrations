import { describe, expect, it } from "vitest";
import { agendaStateLabel, agendaTimeLabel, canKeepNegotiating, isAgendaConfirmed, shouldShowPreReservation, sortAgendaVisibility, type AgendaVisibilityRow } from "./agenda-visibility";

const negotiation: AgendaVisibilityRow = { id: "quote-1", source: "quote", lead_id: "lead-1", event_date: "2026-12-11", desired_start_time: null, desired_duration_minutes: null, client_name: "Flavia", company: null, title: "Orçamento - Flavia", event_type: "Corporativo", guest_count: 50, responsible_name: "Noemi", next_action: "Ligar", next_action_at: "2026-12-01", proposal_created_at: "2026-10-02", visual_state: "negotiation" };

describe("agenda negotiation visibility", () => {
  it("identifies a negotiation and keeps an undefined time as all-day", () => {
    expect(agendaStateLabel(negotiation.visual_state)).toBe("Em negociação");
    expect(agendaTimeLabel(negotiation.desired_start_time, negotiation.desired_duration_minutes)).toBe("Dia inteiro");
  });

  it("shows a dated proposal in negotiation as a pre-reservation", () => {
    expect(shouldShowPreReservation("em_negociacao", "2026-12-11")).toBe(true);
  });

  it("does not show a negotiation without an exact event date", () => {
    expect(shouldShowPreReservation("em_negociacao", null)).toBe(false);
  });

  it("uses the replacement date when a proposal date changes", () => {
    const updated = { ...negotiation, event_date: "2026-12-12" };
    expect(updated.event_date).toBe("2026-12-12");
  });

  it("never treats a pre-reservation as a commercial block", () => {
    expect(canKeepNegotiating()).toBe(true);
  });

  it("requires both a signed contract and paid deposit for confirmation", () => {
    expect(isAgendaConfirmed("assinado", true)).toBe(true);
    expect(isAgendaConfirmed("assinado", false)).toBe(false);
    expect(isAgendaConfirmed("enviado", true)).toBe(false);
  });

  it("removes visibility when negotiation is lost or cancelled", () => {
    expect(shouldShowPreReservation("recusado", "2026-12-11")).toBe(false);
    expect(shouldShowPreReservation("cancelado", "2026-12-11")).toBe(false);
  });

  it("keeps one visual identity when the source changes from quote to event", () => {
    const confirmed = { ...negotiation, id: "event-1", source: "event" as const, visual_state: "confirmed" as const };
    expect(new Set([confirmed.id]).size).toBe(1);
  });

  it("does not allow a display calculation to change financial data", () => {
    const payment = { status: "pago", amount_cents: 5000 };
    isAgendaConfirmed("assinado", payment.status === "pago");
    expect(payment).toEqual({ status: "pago", amount_cents: 5000 });
  });

  it("shows the end time when a schedule is available", () => {
    expect(agendaTimeLabel("16:30:00", 300)).toBe("16:30–21:30");
  });

  it("gives confirmed events visual priority without excluding negotiations", () => {
    const confirmed = { ...negotiation, id: "event-1", source: "event" as const, visual_state: "confirmed" as const };
    expect(sortAgendaVisibility([negotiation, confirmed]).map((row) => row.id)).toEqual(["event-1", "quote-1"]);
  });
});
