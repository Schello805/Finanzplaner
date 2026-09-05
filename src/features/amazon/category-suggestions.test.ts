import { describe, expect, it } from "vitest";
import { suggestAmazonCategory } from "./category-suggestions";

describe("Amazon-Kategorievorschläge", () => {
  const categories = [
    { id: "food", name: "Lebensmittel", isIncome: false },
    { id: "health", name: "Gesundheit", isIncome: false },
    { id: "other", name: "Sonstiges", isIncome: false },
  ];

  it("schlägt anhand von Artikeltexten eine passende bestehende Kategorie vor", () => {
    expect(suggestAmazonCategory("Bio Kaffee Lebensmittel", categories)?.categoryId).toBe("food");
    expect(suggestAmazonCategory("Vitamin Gesundheit", categories)?.categoryId).toBe("health");
  });

  it("schlägt niemals Sonstiges vor", () => {
    expect(suggestAmazonCategory("Unbekanntes Produkt", categories)).toBeNull();
  });
});
