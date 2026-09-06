import { describe, expect, it } from "vitest";
import { canLearnMerchant, normalizeMerchant } from "./normalize";
import {resolveRuleAssignments} from "./rule-resolution";

describe("lokale Händlerregeln", () => {
  it("normalisiert wiederkehrende Händler stabil", () => {
    expect(normalizeMerchant("  LIDL   Dienstleistung GmbH & Co. KG ")).toBe("lidl dienstleistung gmbh & co. kg");
  });
  it("lernt keine Sammelzahlungsanbieter pauschal", () => {
    expect(canLearnMerchant("AMAZON PAYMENTS EUROPE S.C.A.")).toBe(false);
    expect(canLearnMerchant("PayPal (Europe) S.à r.l." )).toBe(false);
    expect(canLearnMerchant("Telefónica Germany GmbH")).toBe(true);
  });
  it("wendet widersprüchliche Familienregeln nicht automatisch an",()=>{const result=resolveRuleAssignments([{value:"o2",categoryId:"telefon"},{value:"o2",categoryId:"freizeit"},{value:"lidl",categoryId:"lebensmittel"}]);expect(result.conflicts.has("o2")).toBe(true);expect(result.assignments.has("o2")).toBe(false);expect(result.assignments.get("lidl")).toBe("lebensmittel")});
});
