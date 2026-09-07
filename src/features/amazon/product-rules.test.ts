import { describe, expect, it } from "vitest";

import { matchingProductRule, matchesProductPattern } from "./product-rules";

describe("Amazon-Artikelregeln", () => {
  it("unterstützt Platzhalter", () => {
    expect(matchesProductPattern("Filament*", "Filament PLA schwarz")).toBe(true);
    expect(matchesProductPattern("Filament*", "GEEETECH Filament PLA")).toBe(false);
    expect(matchesProductPattern("*Filament*", "GEEETECH Filament PLA")).toBe(true);
  });

  it("ignoriert Großschreibung und überzählige Leerzeichen", () => {
    expect(matchesProductPattern("*filament*", "  GEEETECH   FILAMENT PLA ")).toBe(true);
  });

  it("bevorzugt exakte und spezifische Regeln", () => {
    expect(
      matchingProductRule(
        [
          { id: "1", pattern: "*Filament*", categoryId: "a" },
          { id: "2", pattern: "PLA Filament", categoryId: "b" },
        ],
        "PLA Filament",
      )?.id,
    ).toBe("2");
  });
});
