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
  it("erkennt eine Kfz-Versicherung eindeutig", () => {
    expect(keywordCategory("Beitrag Kfz-Versicherung", false, [
      ...categories,
      { id: "car-insurance", name: "Kfz-Versicherung", isIncome: false },
    ])?.id).toBe("car-insurance");
  });
  it("ordnet typische Händler und regelmäßige Zahlungen lokal zu", () => {
    const extended = [
      ...categories,
      { id: "food", name: "Lebensmittel", isIncome: false },
      { id: "phone", name: "Telefon & Internet", isIncome: false },
      { id: "rate", name: "Rate", isIncome: false },
    ];
    expect(keywordCategory("Kartenzahlung LIDL SAGT DANKE", false, extended)?.id).toBe("food");
    expect(keywordCategory("Telefonica Germany GmbH & Co. OHG", false, extended)?.id).toBe("phone");
    expect(keywordCategory("Darlehensrückzahlung an Bank", false, extended)?.id).toBe("rate");
  });
});
