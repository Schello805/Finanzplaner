export type HierarchyItem = { id: string; parentId: string | null };

export function flattenCategoryHierarchy<T extends HierarchyItem>(items: T[]) {
  const ids = new Set(items.map((item) => item.id));
  const children = new Map<string | null, T[]>();
  for (const item of items) {
    const parentId = item.parentId && ids.has(item.parentId) ? item.parentId : null;
    children.set(parentId, [...(children.get(parentId) ?? []), item]);
  }

  const result: Array<{ category: T; depth: number }> = [];
  const visited = new Set<string>();
  function visit(category: T, depth: number) {
    if (visited.has(category.id)) return;
    visited.add(category.id);
    result.push({ category, depth });
    for (const child of children.get(category.id) ?? []) visit(child, depth + 1);
  }

  for (const root of children.get(null) ?? []) visit(root, 0);
  // Beschädigte Altdaten mit einem Eltern-Zyklus bleiben sichtbar.
  for (const item of items) visit(item, 0);
  return result;
}
