export type AmazonCategory = { id: string; name: string; isIncome?: boolean };

const rules = [
  { text: /filament|pla\b|petg\b|abs[- ]?filament/i, category: /3d[- ]?druck/i, reason: "3D-Druck-Material erkannt", confidence: .98 },
  { text: /motte|pheromonfalle|ungeziefer|insektenfalle/i, category: /drogerie|haushalt/i, reason: "Haushalts-Schädlingsbekämpfung erkannt", confidence: .94 },
  { text: /lebensmittel\b|food\b|grocery|getr(?:ä|ae)nke|kaffee|tee\b/i, category: /lebensmittel/i, reason: "Lebensmittelbegriff erkannt", confidence: .92 },
  { text: /drogerie|pflege|shampoo|zahnpflege|haushalt|reinigung/i, category: /drogerie|haushalt/i, reason: "Haushalts- oder Drogerieartikel erkannt", confidence: .92 },
  { text: /spielzeug|baby|kinder|windel|schule/i, category: /kinder|spielzeug/i, reason: "Kinderartikel erkannt", confidence: .9 },
  { text: /apotheke|gesundheit|vitamin|medizin|verband/i, category: /gesundheit|apotheke/i, reason: "Gesundheitsartikel erkannt", confidence: .9 },
  { text: /gaming|game|spiel|playstation|xbox|nintendo/i, category: /app|in[- ]?game|spiele|freizeit/i, reason: "Spiel oder Gamingartikel erkannt", confidence: .88 },
  { text: /auto|kfz|fahrzeug|reifen|motor(?:öl|oel)/i, category: /mobilit(?:ä|ae)t|auto|kfz/i, reason: "Fahrzeugartikel erkannt", confidence: .88 },
  { text: /buch|books|kindle|roman/i, category: /freizeit|buch/i, reason: "Buch oder Lektüre erkannt", confidence: .85 },
] as const;

export function suggestAmazonCategory(text: string, categories: AmazonCategory[]) {
  for (const rule of rules) {
    if (!rule.text.test(text)) continue;
    const category = categories.find((item) => !item.isIncome && !/^sonstiges$/i.test(item.name) && rule.category.test(item.name));
    if (category) return { categoryId: category.id, categoryName: category.name, reason: rule.reason, confidence:rule.confidence };
  }
  return null;
}
