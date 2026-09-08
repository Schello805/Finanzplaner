import { describe, expect, it } from "vitest";
import { evaluateFinancialIntegrity, type IntegrityTransaction } from "./checks";

const transaction = (overrides: Partial<IntegrityTransaction> = {}): IntegrityTransaction => ({
  id: "transaction",
  amount: "-10.00",
  currency: "EUR",
  direction: "expense",
  specialType: "normal",
  excludedFromAnalysis: false,
  linkedTransactionId: null,
  categoryId: null,
  ...overrides,
});

describe("Finanz-Integritätsprüfung", () => {
  it("akzeptiert centgenaue Aufteilungen und Amazon-Zuordnungen", () => {
    const result = evaluateFinancialIntegrity({
      transactions: [transaction()],
      splits: [{ transactionId: "transaction", amount: "4.00" }, { transactionId: "transaction", amount: "6.00" }],
      amazonItems: [{ id: "a", matchedTransactionId: "transaction", orderTotal: "4.00" }, { id: "b", matchedTransactionId: "transaction", orderTotal: "6.00" }],
    });
    expect(result.ok).toBe(true);
  });

  it("findet falsche Aufteilungs- und Amazon-Summen", () => {
    const result = evaluateFinancialIntegrity({
      transactions: [transaction()],
      splits: [{ transactionId: "transaction", amount: "9.99" }],
      amazonItems: [{ id: "a", matchedTransactionId: "transaction", orderTotal: "9.98" }],
    });
    expect(result.issues.map((issue) => issue.code)).toEqual(["split-total", "amazon-total"]);
  });

  it("prüft interne Umbuchungen wechselseitig", () => {
    const result = evaluateFinancialIntegrity({
      transactions: [
        transaction({ id: "out", amount: "-100.00", specialType: "transfer", excludedFromAnalysis: true, linkedTransactionId: "in" }),
        transaction({ id: "in", amount: "100.00", direction: "income", specialType: "transfer", excludedFromAnalysis: true, linkedTransactionId: "out" }),
      ],
      splits: [], amazonItems: [],
    });
    expect(result.ok).toBe(true);
  });

  it("meldet widersprüchliche Richtung und unvollständige Umbuchungen", () => {
    const result = evaluateFinancialIntegrity({
      transactions: [transaction({ amount: "10.00" }), transaction({ id: "transfer", specialType: "transfer" })],
      splits: [], amazonItems: [],
    });
    expect(result.issues.map((issue) => issue.code)).toEqual(["direction-sign", "transfer-included", "transfer-peer-missing"]);
  });
});
