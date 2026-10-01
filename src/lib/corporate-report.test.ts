import { describe, expect, it } from "vitest";
import { summarizeCorporateEvents } from "./corporate-report";

const event = {
  id: "event-1", status: "confirmado", event_type: "Corporativo", event_date: "2026-11-10",
  leads: { name: "Ana", company: "Empresa", created_at: "2026-10-01T10:00:00Z", responsible_id: "user-1", profiles: { display_name: "Comercial" } },
  quotes: { total_amount_cents: 100000, approved_at: "2026-10-05T10:00:00Z" },
  contracted_event_payments: [{ status: "pago", amount_cents: 40000, paid_at: "2026-10-08" }],
  contracted_event_costs: [
    { status: "provisionada", estimated_amount_cents: 2500, actual_amount_cents: null, commission_kind: "comercial" },
    { status: "provisionada", estimated_amount_cents: 2500, actual_amount_cents: null, commission_kind: "gerencia" },
    { status: "previsto", estimated_amount_cents: 10000, actual_amount_cents: null, commission_kind: null },
  ],
};

describe("summarizeCorporateEvents", () => {
  it("separates contracted, received, commissions, costs and margin", () => {
    const [row] = summarizeCorporateEvents([event], { dateBy: "approval", start: "2026-10-01", end: "2026-10-31" });
    expect(row).toMatchObject({ contracted: 100000, received: 40000, pending: 60000, commercialCommission: 2500, managementCommission: 2500, estimatedCost: 15000, estimatedMargin: 85000 });
  });

  it("filters payment date using paid payments rather than contract date", () => {
    expect(summarizeCorporateEvents([event], { dateBy: "payment", start: "2026-10-08", end: "2026-10-08" })).toHaveLength(1);
    expect(summarizeCorporateEvents([event], { dateBy: "payment", start: "2026-10-09", end: "2026-10-09" })).toHaveLength(0);
  });
});
