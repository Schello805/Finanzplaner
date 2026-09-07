const forbiddenCategoryPattern = /(^|[\s&/\-])(sonstiges?|eink(?:auf|äufe|aeufe)|shopping)([\s&/\-]|$)/i;

export function normalizeCategoryName(name: string) {
  return name.trim().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").toLocaleLowerCase("de-DE");
}

export function isForbiddenCategoryName(name: string) {
  return forbiddenCategoryPattern.test(name.trim());
}

export function assertAllowedCategoryName(name: string) {
  if (isForbiddenCategoryName(name)) throw new Error("Diese Kategorie ist zu allgemein. „Sonstiges“, „Einkäufe“ und „Shopping“ sowie daraus gebildete Sammelkategorien sind nicht erlaubt.");
}
