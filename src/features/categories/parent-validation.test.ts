import { describe, expect, it } from "vitest";
import { assertValidCategoryParent } from "./parent-validation";

const categories = [
  { id: "root", parentId: null, isIncome: false },
  { id: "child", parentId: "root", isIncome: false },
  { id: "income", parentId: null, isIncome: true },
];

describe("Kategoriehierarchie", () => {
  it("erlaubt eine passende Ausgaben-Unterkategorie", () =>
    expect(() =>
      assertValidCategoryParent(categories, { parentId: "root", isIncome: false }),
    ).not.toThrow());
  it("verhindert die Vermischung von Einnahmen und Ausgaben", () =>
    expect(() =>
      assertValidCategoryParent(categories, { parentId: "income", isIncome: false }),
    ).toThrow("nicht miteinander verschachtelt"));
  it("verhindert das Verschieben unter eine eigene Unterkategorie", () =>
    expect(() =>
      assertValidCategoryParent(categories, {
        categoryId: "root",
        parentId: "child",
        isIncome: false,
      }),
    ).toThrow("eigene Unterkategorie"));
});
