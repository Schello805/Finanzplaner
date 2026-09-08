const forbiddenCategoryPattern = /(^|[\s&/\-])(sonstiges?|einkauf(?:e)?|shopping)([\s&/\-]|$)/i;
const purchaseChannelPattern = /(^|[\s&/\-])(einzelhandel|fachhandel|marktplatz(?:kaufe)?|onlinehandel|bezugsquelle|zahlungsanbieter)([\s&/\-]|$)/i;

export function normalizeCategoryName(name: string) {
  return name.trim().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").toLocaleLowerCase("de-DE");
}

export function isForbiddenCategoryName(name: string) {
  const normalized = normalizeCategoryName(name);
  return forbiddenCategoryPattern.test(normalized) || purchaseChannelPattern.test(normalized);
}

export function assertAllowedCategoryName(name: string) {
  if (isForbiddenCategoryName(name)) throw new Error("Diese Kategorie beschreibt keinen konkreten Verwendungszweck. Allgemeine Sammelbegriffe sowie Einkaufsort, Marktplatz oder Bezugsquelle sind nicht erlaubt.");
}
