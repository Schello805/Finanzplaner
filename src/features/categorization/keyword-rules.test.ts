import { describe, expect, it } from "vitest";
import { keywordCategory } from "./keyword-rules";

const categories = [
  { id: "fees", name: "Bankgebühren", isIncome: false },
  { id: "interest", name: "Zinsen", isIncome: true },
];

describe("lokale Buchungstext-Erkennung", () => {
  it("erkennt Kontoführungspauschalen", () => {
    expect(keywordCategory("Pauschalen", false, categories)?.id).toBe("fees");
  });

  it("verwechselt Soll- und Habenzinsen nicht", () => {
    expect(keywordCategory("Sollzinsen für Kredite", false, categories)?.id).toBe("fees");
    expect(keywordCategory("Habenzinsen", true, categories)?.id).toBe("interest");
  });
});
