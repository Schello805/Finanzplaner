export type AmazonCategory = { id: string; name: string; isIncome?: boolean };

const rules = [
  { text: /lebensmittel|food|grocery|getr(?:ä|ae)nke|kaffee|tee/i, category: /lebensmittel/i, reason: "Lebensmittelbegriff erkannt" },
  { text: /drogerie|pflege|shampoo|zahnpflege|haushalt|reinigung/i, category: /drogerie|haushalt/i, reason: "Haushalts- oder Drogerieartikel erkannt" },
  { text: /spielzeug|baby|kinder|windel|schule/i, category: /kinder|spielzeug/i, reason: "Kinderartikel erkannt" },
  { text: /apotheke|gesundheit|vitamin|medizin|verband/i, category: /gesundheit|apotheke/i, reason: "Gesundheitsartikel erkannt" },
  { text: /gaming|game|spiel|playstation|xbox|nintendo/i, category: /app|in[- ]?game|spiele|freizeit/i, reason: "Spiel oder Gamingartikel erkannt" },
  { text: /auto|kfz|fahrzeug|reifen|motor(?:öl|oel)/i, category: /mobilit(?:ä|ae)t|auto|kfz/i, reason: "Fahrzeugartikel erkannt" },
  { text: /buch|books|kindle|roman/i, category: /freizeit|buch/i, reason: "Buch oder Lektüre erkannt" },
] as const;

export function suggestAmazonCategory(text: string, categories: AmazonCategory[]) {
  for (const rule of rules) {
    if (!rule.text.test(text)) continue;
    const category = categories.find((item) => !item.isIncome && !/^sonstiges$/i.test(item.name) && rule.category.test(item.name));
    if (category) return { categoryId: category.id, categoryName: category.name, reason: rule.reason };
  }
  return null;
}
