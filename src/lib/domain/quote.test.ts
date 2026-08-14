import { describe, expect, it } from "vitest";
import { parseCurrencyToCents, quoteItemSchema } from "./quote";

const quoteId = "8b62eaa0-2b24-4137-9f65-28c97632fe9c";

describe("parseCurrencyToCents", () => {
  it("accepts Brazilian currency values", () => {
    expect(parseCurrencyToCents("20")).toBe(2000);
    expect(parseCurrencyToCents("20,50")).toBe(2050);
    expect(parseCurrencyToCents("1.200,99")).toBe(120099);
    expect(parseCurrencyToCents("R$ 1.200,99")).toBe(120099);
  });

  it("rejects ambiguous or invalid values", () => {
    expect(parseCurrencyToCents("20/50")).toBe(-1);
    expect(parseCurrencyToCents("abc")).toBe(-1);
    expect(parseCurrencyToCents("20.50")).toBe(-1);
    expect(parseCurrencyToCents("")).toBe(-1);
  });
});

describe("quoteItemSchema", () => {
  it("rejects zero quantity and zero unit price", () => {
    expect(
      quoteItemSchema.safeParse({
        quoteId,
        description: "Buffet",
        quantity: "0",
        unitPrice: "20,00",
      }).success,
    ).toBe(false);

    expect(
      quoteItemSchema.safeParse({
        quoteId,
        description: "Buffet",
        quantity: "1",
        unitPrice: "0",
      }).success,
    ).toBe(false);
  });

  it("rejects short descriptions and invalid unit prices", () => {
    expect(
      quoteItemSchema.safeParse({
        quoteId,
        description: "B",
        quantity: "1",
        unitPrice: "20,00",
      }).success,
    ).toBe(false);

    expect(
      quoteItemSchema.safeParse({
        quoteId,
        description: "Buffet",
        quantity: "1",
        unitPrice: "20/00",
      }).success,
    ).toBe(false);
  });
});
