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
  {
    text: /kfz[- ]?versicherung|autoversicherung|kraftfahrzeugversicherung/i,
    category: /kfz[- ]?versicherung|autoversicherung|versicherung/i,
    isIncome: false,
  },
  {
    text: /\b(lidl|aldi|netto|penny|rewe|edeka|kaufland|norma)\b/i,
    category: /lebensmittel|supermarkt/i,
    isIncome: false,
  },
  {
    text: /\b(o2|telefonica|telekom|vodafone|1&1|congstar)\b/i,
    category: /telefon|internet|kommunikation/i,
    isIncome: false,
  },
  {
    text: /darlehensr(?:ü|ue)ckzahlung|darlehensrate|kreditrate|tilgung/i,
    category: /rate|darlehen|kredit|finanzierung/i,
    isIncome: false,
  },
  {
    text: /\b(aral|shell|esso|totalenergies|jet tankstelle|agip|avia)\b|kraftstoff|tankstelle/i,
    category: /tanken|kraftstoff/i,
    isIncome: false,
  },
  {
    text: /google play|apple\.com\/bill|playstation|xbox|steam games|in[- ]?game/i,
    category: /app|in[- ]?game|spiele/i,
    isIncome: false,
  },
  {
    text: /gehalt|lohn|besoldung|arbeitsentgelt/i,
    category: /einkommen|gehalt|lohn/i,
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
