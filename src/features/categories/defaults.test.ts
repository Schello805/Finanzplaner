import { describe, expect, it } from "vitest";
import { defaultCategories } from "./defaults";

describe("Standardkategorien", () => {
  it("enthält keine unspezifische Auffangkategorie", () => {
    expect(defaultCategories.some(([name]) => /sonstiges|diverses|andere/i.test(name))).toBe(false);
  });

  it("ordnet jede Unterkategorie einer vorher angelegten Hauptkategorie zu", () => {
    const known = new Set<string>();
    for (const [, slug, , , parentSlug] of defaultCategories) {
      if (parentSlug) expect(known.has(parentSlug)).toBe(true);
      known.add(slug);
    }
  });

  it("liefert einen ausreichend differenzierten Familien-Kategorienbaum", () => {
    expect(defaultCategories.length).toBeGreaterThanOrEqual(60);
    expect(defaultCategories.some(([name]) => name === "Kfz-Versicherung")).toBe(true);
    expect(defaultCategories.some(([name]) => name === "Darlehensrate")).toBe(true);
    expect(defaultCategories.some(([name]) => name === "Telefon & Internet")).toBe(true);
  });
});
