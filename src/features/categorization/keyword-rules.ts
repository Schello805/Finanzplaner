export type KeywordCategory = { id: string; name: string; isIncome: boolean };

const rules = [
  {
    text: /sollzinsen|kreditzinsen|darlehenszinsen/i,
    category: /kreditzinsen|zinsen|bankgebühr|gebühr/i,
    isIncome: false,
  },
  {
    text: /kontof(?:ü|ue)hr|kontoentgelt|pauschalen|entgeltabrechnung/i,
    category: /kontof(?:ü|ue)hr|bankgebühr|gebühr/i,
    isIncome: false,
  },
  {
    text: /habenzinsen|guthabenzinsen|zinsertrag/i,
    category: /zinsen|kapitalertr(?:ä|ae)g/i,
    isIncome: true,
  },
] as const;

export function keywordCategory(
  text: string | null | undefined,
  isIncome: boolean,
  categories: KeywordCategory[],
) {
  const rule = rules.find((candidate) => candidate.isIncome === isIncome && candidate.text.test(text ?? ""));
  return rule
    ? categories.find((category) => category.isIncome === isIncome && rule.category.test(category.name))
    : undefined;
}
