import { describe, expect, it } from "vitest";
import { canLearnMerchant, normalizeMerchant } from "./normalize";

describe("lokale Händlerregeln", () => {
  it("normalisiert wiederkehrende Händler stabil", () => {
    expect(normalizeMerchant("  LIDL   Dienstleistung GmbH & Co. KG ")).toBe("lidl dienstleistung gmbh & co. kg");
  });
  it("lernt keine Sammelzahlungsanbieter pauschal", () => {
    expect(canLearnMerchant("AMAZON PAYMENTS EUROPE S.C.A.")).toBe(false);
    expect(canLearnMerchant("PayPal (Europe) S.à r.l." )).toBe(false);
    expect(canLearnMerchant("Telefónica Germany GmbH")).toBe(true);
  });
});
