import { describe, expect, it } from "vitest";
import { estimateCost, resolveModelPrice } from "./provider";

describe("KI-Kostenschätzung", () => {
  it("verwendet für gpt-5-mini einen Preis, wenn der Admin keinen hinterlegt hat", () => {
    expect(resolveModelPrice("openai", "gpt-5-mini", { inputPricePerMillion: 0, outputPricePerMillion: 0 })).toMatchObject({ inputPerMillion: 0.25, outputPerMillion: 2, source: "model-default" });
  });

  it("bevorzugt individuell konfigurierte Preise", () => {
    expect(resolveModelPrice("openai", "gpt-5-mini", { inputPricePerMillion: 1, outputPricePerMillion: 3 })).toMatchObject({ inputPerMillion: 1, outputPerMillion: 3, source: "configured" });
  });

  it("liefert mit Modellpreis eine positive Schätzung", () => {
    const price = resolveModelPrice("openai", "gpt-5-mini")!;
    expect(estimateCost({ categories: [{ name: "Tanken" }] }, price).highEur).toBeGreaterThan(0);
  });
});
