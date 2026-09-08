import { describe, expect, it } from "vitest";
import { amazonMatchScore, amazonPaymentGroupTotal, uniqueAmountCombination } from "./matching";

describe("Amazon-Abgleich", () => {
  it("summiert alle Positionen einer Zahlungsgruppe centgenau", () => {
    expect(amazonPaymentGroupTotal([{ orderTotal: "10.87" }, { orderTotal: "10.87" }])).toBe(21.74);
    expect(amazonPaymentGroupTotal([{ orderTotal: "0.10" }, { orderTotal: "0.20" }])).toBe(0.3);
  });

  it("bewertet gleiche Beträge und nahe Daten hoch", () => expect(amazonMatchScore(49.99, "2026-09-01", -49.99, "2026-09-03")?.score).toBe(0.97));
  it("verwirft abweichende Beträge", () => expect(amazonMatchScore(49.99, "2026-09-01", -50.99, "2026-09-03")).toBeNull());
  it("verwirft Treffer außerhalb von 21 Tagen", () => expect(amazonMatchScore(49.99, "2026-09-01", -49.99, "2026-09-23")).toBeNull());
  it("akzeptiert die Grenze von 21 Tagen", () => expect(amazonMatchScore(49.99, "2026-09-01", -49.99, "2026-09-22")?.days).toBe(21));

  it("findet eine eindeutige centgenaue Kombination mehrerer Bestellungen", () => {
    expect(uniqueAmountCombination([
      { id: "acht", amountCents: 800 },
      { id: "vier", amountCents: 400 },
      { id: "drei", amountCents: 300 },
    ], 1200)).toEqual({ combination: ["acht", "vier"], ambiguous: false });
  });

  it("verwirft mehrdeutige Kombinationen", () => {
    expect(uniqueAmountCombination([
      { id: "acht", amountCents: 800 },
      { id: "vier-a", amountCents: 400 },
      { id: "vier-b", amountCents: 400 },
    ], 1200)).toEqual({ combination: null, ambiguous: true });
  });

  it("verwendet keine Einzelbestellung als Kombination", () => {
    expect(uniqueAmountCombination([{ id: "zwoelf", amountCents: 1200 }], 1200)).toEqual({ combination: null, ambiguous: false });
  });
});
