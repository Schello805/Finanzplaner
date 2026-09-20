import { describe, expect, it } from "vitest";
import { resolveStatementCurrency } from "./statement-currency";

describe("FinTS statement currency", () => {
  it("uses the CAMT balance currency instead of a transaction business code", () => {
    const statement = { openingBalance: { currency: "EUR" }, closingBalance: { currency: "EUR" } };
    expect(resolveStatementCurrency(statement)).toBe("EUR");
  });

  it("falls back to the selected account currency when balances omit it", () => {
    expect(resolveStatementCurrency({}, "eur")).toBe("EUR");
  });

  it("rejects conflicting balance currencies", () => {
    expect(() => resolveStatementCurrency({ openingBalance: { currency: "EUR" }, closingBalance: { currency: "USD" } })).toThrow("widersprüchliche Währungen");
  });

  it("never accepts a FinTS business code as currency", () => {
    expect(() => resolveStatementCurrency({}, "ACMT")).toThrow("nicht sicher ermittelt");
  });
});
