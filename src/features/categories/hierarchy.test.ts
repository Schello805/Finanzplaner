import { describe, expect, it } from "vitest";
import { flattenCategoryHierarchy } from "./hierarchy";

describe("Kategoriehierarchie", () => {
  it("ordnet Unterkategorien direkt und eingerückt unter ihrem Elternteil an", () => {
    const result = flattenCategoryHierarchy([
      { id: "food", parentId: null, name: "Lebensmittel" },
      { id: "phone", parentId: "fixed", name: "Telefon" },
      { id: "fixed", parentId: null, name: "Fixkosten" },
      { id: "mobile", parentId: "phone", name: "Mobilfunk" },
    ]);

    expect(result.map(({ category, depth }) => [category.name, depth])).toEqual([
      ["Fixkosten", 0],
      ["Telefon", 1],
      ["Mobilfunk", 2],
      ["Lebensmittel", 0],
    ]);
  });

  it("sortiert Haupt- und Unterkategorien alphabetisch", () => {
    const result = flattenCategoryHierarchy([
      { id: "z", parentId: null, name: "Wohnen" },
      { id: "b", parentId: "z", name: "Strom" },
      { id: "a", parentId: "z", name: "Miete" },
      { id: "a0", parentId: null, name: "Bank & Finanzen" },
    ]);
    expect(result.map(({ category }) => category.name)).toEqual(["Bank & Finanzen", "Wohnen", "Miete", "Strom"]);
  });
});
