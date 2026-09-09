import { describe, expect, it } from "vitest";
import { findSparkasseByBlz, isTrustedSparkasseEndpoint } from "./bank-directory";

describe("FinTS-Bankverzeichnis", () => {
  const directory = [
    "76550000=Sparkasse Ansbach|Ansbach, Mittelfr|BYLADEM1ANS|00|i004.by.s-hbci.de|https://banking-by1.s-fints-pt-by.de/fints30|220|300|",
    "76050000=Bayerische Landesbank|Nürnberg, Mittelfr|BYLADEMMXXX|09|||||",
  ].join("\n");

  it("findet eine Sparkasse anhand der BLZ und übernimmt den PIN/TAN-Endpunkt", () => {
    expect(findSparkasseByBlz(directory, "76550000")).toEqual({
      blz: "76550000",
      name: "Sparkasse Ansbach",
      city: "Ansbach, Mittelfr",
      bic: "BYLADEM1ANS",
      endpoint: "https://banking-by1.s-fints-pt-by.de/fints30",
    });
  });

  it("lehnt Nicht-Sparkassen und manipulierte Endpunkte ab", () => {
    expect(findSparkasseByBlz(directory, "76050000")).toBeNull();
    expect(isTrustedSparkasseEndpoint("https://evil.example/fints30")).toBe(false);
    expect(isTrustedSparkasseEndpoint("http://banking-by1.s-fints-pt-by.de/fints30")).toBe(false);
    expect(isTrustedSparkasseEndpoint("https://banking-by1.s-fints-pt-by.de.evil.example/fints30")).toBe(false);
  });
});
