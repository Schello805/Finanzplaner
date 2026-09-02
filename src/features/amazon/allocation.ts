export function allocateAmazonCategories(
  items: Array<{ categoryId: string; weight: number }>,
  totalCents: number,
) {
  const weightTotal = items.reduce((sum, item) => sum + Math.max(0, item.weight), 0);
  if (!weightTotal) throw new Error("Artikelbeträge können nicht aufgeteilt werden.");
  let allocated = 0;
  const grouped = new Map<string, number>();
  items.forEach((item, index) => {
    const value = index === items.length - 1
      ? totalCents - allocated
      : Math.round(totalCents * Math.max(0, item.weight) / weightTotal);
    allocated += value;
    grouped.set(item.categoryId, (grouped.get(item.categoryId) ?? 0) + value);
  });
  return grouped;
}
