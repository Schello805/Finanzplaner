import { describe, expect, it } from "vitest";
import { suggestAmazonCategory } from "./category-suggestions";

describe("Amazon-Kategorievorschläge", () => {
  const categories = [
    { id: "food", name: "Lebensmittel", isIncome: false },
    { id: "health", name: "Gesundheit", isIncome: false },
    { id: "household", name: "Haushalt & Drogerie", isIncome: false },
    { id: "printing", name: "3D-Druck", isIncome: false },
    { id: "other", name: "Sonstiges", isIncome: false },
  ];

  it("schlägt anhand von Artikeltexten eine passende bestehende Kategorie vor", () => {
    expect(suggestAmazonCategory("Bio Kaffee Lebensmittel", categories)?.categoryId).toBe("food");
    expect(suggestAmazonCategory("Vitamin Gesundheit", categories)?.categoryId).toBe("health");
  });

  it("schlägt niemals Sonstiges vor", () => {
    expect(suggestAmazonCategory("Unbekanntes Produkt", categories)).toBeNull();
  });

  it("ordnet Filament sehr sicher dem 3D-Druck zu", () => {
    expect(suggestAmazonCategory("PLA Filament für 3D Drucker", categories)).toMatchObject({ categoryId:"printing", confidence:.98 });
  });

  it("verwechselt Lebensmittelmotten nicht mit Lebensmitteln", () => {
    expect(suggestAmazonCategory("Pheromonfalle gegen Lebensmittelmotten", categories)).toMatchObject({ categoryId:"household", confidence:.94 });
  });
});
