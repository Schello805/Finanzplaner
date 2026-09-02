import { describe, expect, it } from "vitest";
import { allocateAmazonCategories } from "./allocation";

describe("Amazon-Kategorieaufteilung", () => {
  it("verteilt auch mit Rundung centgenau auf den Bankbetrag", () => {
    const result = allocateAmazonCategories([
      { categoryId: "a", weight: 1 },
      { categoryId: "b", weight: 1 },
      { categoryId: "c", weight: 1 },
    ], 1000);
    expect([...result.values()].reduce((sum, value) => sum + value, 0)).toBe(1000);
    expect([...result.values()]).toEqual([333, 333, 334]);
  });

  it("fasst mehrere Artikel derselben Kategorie zusammen", () => {
    const result = allocateAmazonCategories([
      { categoryId: "lebensmittel", weight: 10 },
      { categoryId: "lebensmittel", weight: 20 },
      { categoryId: "haushalt", weight: 30 },
    ], 6000);
    expect(result.get("lebensmittel")).toBe(3000);
    expect(result.get("haushalt")).toBe(3000);
  });
});
