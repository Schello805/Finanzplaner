import { describe, expect, it } from "vitest";
import { assignmentExplanation, mayApplyAutomaticAssignment, shouldLearnAssignmentRule } from "./assignment-policy";

describe("zentrale Zuordnungspriorität", () => {
  it("schützt manuelle Kategorien, Aufteilungen, Ausschlüsse und Umbuchungen", () => {
    expect(mayApplyAutomaticAssignment({ categoryId: "gesetzt" })).toBe(false);
    expect(mayApplyAutomaticAssignment({ hasSplits: true })).toBe(false);
    expect(mayApplyAutomaticAssignment({ excluded: true })).toBe(false);
    expect(mayApplyAutomaticAssignment({ specialType: "transfer" })).toBe(false);
    expect(mayApplyAutomaticAssignment({})).toBe(true);
  });

  it("erklärt die Herkunft einer Zuordnung verständlich", () => {
    expect(assignmentExplanation("local-rule").short).toBe("Gespeicherte Regel");
    expect(assignmentExplanation("ai:openai", "0.97").short).toBe("KI-Vorschlag · 97 %");
    expect(assignmentExplanation("amazon-split").short).toBe("Amazon-Aufteilung");
  });
  it("lernt nur nach einer ausdrücklichen Regelentscheidung",()=>{
    expect(shouldLearnAssignmentRule(undefined)).toBe(false);
    expect(shouldLearnAssignmentRule("none")).toBe(false);
    expect(shouldLearnAssignmentRule("future")).toBe(true);
    expect(shouldLearnAssignmentRule("all")).toBe(true);
  });
});
