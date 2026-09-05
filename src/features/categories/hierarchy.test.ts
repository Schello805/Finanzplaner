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
      ["Lebensmittel", 0],
      ["Fixkosten", 0],
      ["Telefon", 1],
      ["Mobilfunk", 2],
    ]);
  });
});
