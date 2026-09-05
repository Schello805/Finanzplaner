import { flattenCategoryHierarchy } from "@/features/categories/hierarchy";

export type SelectCategory = {
  id: string;
  name: string;
  parentId: string | null;
  isIncome: boolean;
};

function options(categories: SelectCategory[]) {
  return flattenCategoryHierarchy(categories).map(({ category, depth }) => (
    <option key={category.id} value={category.id}>
      {`${"\u00a0\u00a0".repeat(depth)}${depth ? "↳ " : ""}${category.name}`}
    </option>
  ));
}

export function CategorySelectOptions({ categories }: { categories: SelectCategory[] }) {
  const expenses = categories.filter((category) => !category.isIncome);
  const income = categories.filter((category) => category.isIncome);
  return (
    <>
      {expenses.length > 0 && <optgroup label="Ausgaben">{options(expenses)}</optgroup>}
      {income.length > 0 && <optgroup label="Einnahmen">{options(income)}</optgroup>}
    </>
  );
}
