import { describe, expect, it } from "vitest";
import { findMissingStoredTransactions } from "./reconciliation";

const transaction = (overrides: Partial<{ bookedOn: string; amount: number; currency: string; fingerprint: string; counterparty: string }> = {}) => ({
  bookedOn: "2026-09-01",
  amount: -56.08,
  currency: "EUR",
  fingerprint: "stored",
  counterparty: "Telefonica Germany GmbH + Co. OHG",
  ...overrides,
});
const statement = (base: ReturnType<typeof transaction>) => Array.from({ length: 10 }, (_, index) => ({ ...base, bookedOn: `2026-09-${String(index + 1).padStart(2, "0")}`, fingerprint: `${base.fingerprint}-${index}` }));

describe("Bestandsabgleich beim Import", () => {
  it("meldet eine vorhandene Buchung trotz geänderter Empfängerschreibweise nicht als fehlend", () => {
    const existing = transaction();
    const incoming = transaction({ fingerprint: "new-export", counterparty: "TELEFONICA GERMANY GMBH & CO OHG" });
    expect(findMissingStoredTransactions([existing], statement(incoming))).toEqual([]);
  });

  it("meldet nur Buchungen ohne passenden Datums-, Betrags- und Währungstreffer", () => {
    const existing = transaction();
    const incoming = statement(transaction({ fingerprint: "other", amount: -55 }));
    expect(findMissingStoredTransactions([existing], incoming)).toEqual([existing]);
  });

  it("vergleicht ausschließlich den Zeitraum des neuen Exports", () => {
    const older = transaction({ bookedOn: "2026-08-31" });
    expect(findMissingStoredTransactions([older], statement(transaction({ fingerprint: "incoming" })))).toEqual([]);
  });

  it("unterdrückt Löschvorschläge bei Tages- und Teilauszügen", () => {
    expect(findMissingStoredTransactions([transaction()], [transaction({ fingerprint: "incoming", amount: -1 })])).toEqual([]);
  });
});
