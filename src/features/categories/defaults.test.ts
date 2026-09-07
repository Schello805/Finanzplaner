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

  it("liefert einen bewusst kleinen, aber brauchbaren Familien-Kategorienbaum", () => {
    expect(defaultCategories.length).toBeGreaterThanOrEqual(25);
    expect(defaultCategories.length).toBeLessThanOrEqual(35);
    expect(defaultCategories.some(([name]) => String(name) === "Einkäufe")).toBe(false);
    expect(defaultCategories.some(([name]) => name === "Kfz-Versicherung")).toBe(true);
    expect(defaultCategories.some(([name]) => name === "Kredite & Raten")).toBe(true);
    expect(defaultCategories.some(([name]) => name === "Telefon & Internet")).toBe(true);
  });
});
