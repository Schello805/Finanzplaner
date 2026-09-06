import { describe, expect, it } from "vitest";
import { estimateCost, resolveModelPrice } from "./provider";

describe("KI-Kostenschätzung", () => {
  it("meldet fehlende Preise, statt Dollarwerte fälschlich als Euro auszugeben", () => {
    expect(resolveModelPrice("openai", "gpt-5-mini", { inputPricePerMillion: 0, outputPricePerMillion: 0 })).toBeNull();
  });

  it("bevorzugt individuell konfigurierte Preise", () => {
    expect(resolveModelPrice("openai", "gpt-5-mini", { inputPricePerMillion: 1, outputPricePerMillion: 3 })).toMatchObject({ inputPerMillion: 1, outputPerMillion: 3, source: "configured" });
  });

  it("liefert mit konfiguriertem Preis eine positive Schätzung", () => {
    const price = resolveModelPrice("openai", "gpt-5-mini", { inputPricePerMillion: 0.25, outputPricePerMillion: 2 })!;
    expect(estimateCost({ categories: [{ name: "Tanken" }] }, price).highEur).toBeGreaterThan(0);
  });
});
