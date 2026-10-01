import { describe, expect, it } from "vitest";
import { canManageCalendar } from "./calendar";

describe("calendar authorization", () => {
  it("permite atendimento operar a agenda sem liberar o financeiro", () => {
    expect(canManageCalendar(["atendimento"])).toBe(true);
    expect(canManageCalendar(["gerencia"])).toBe(true);
    expect(canManageCalendar(["direcao"])).toBe(true);
    expect(canManageCalendar(["admin_owner"])).toBe(true);
    expect(canManageCalendar(["financeiro"])).toBe(false);
  });
});
