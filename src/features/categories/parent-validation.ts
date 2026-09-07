export type CategoryParentCandidate = {
  id: string;
  parentId: string | null;
  isIncome: boolean;
};

export function assertValidCategoryParent(
  categories: CategoryParentCandidate[],
  options: { categoryId?: string; parentId?: string | null; isIncome: boolean },
) {
  if (!options.parentId) return;
  const parent = categories.find((category) => category.id === options.parentId);
  if (!parent) throw new Error("Übergeordnete Kategorie nicht gefunden.");
  if (parent.isIncome !== options.isIncome)
    throw new Error(
      "Einnahmen- und Ausgabenkategorien können nicht miteinander verschachtelt werden.",
    );
  if (options.categoryId && parent.id === options.categoryId)
    throw new Error("Eine Kategorie kann nicht sich selbst untergeordnet werden.");
  const visited = new Set<string>();
  let current: CategoryParentCandidate | undefined = parent;
  while (current) {
    if (visited.has(current.id))
      throw new Error("Die vorhandene Kategoriehierarchie enthält einen Kreislauf.");
    visited.add(current.id);
    if (options.categoryId && current.id === options.categoryId)
      throw new Error(
        "Eine Kategorie kann nicht unter eine eigene Unterkategorie verschoben werden.",
      );
    current = current.parentId
      ? categories.find((category) => category.id === current?.parentId)
      : undefined;
  }
}
