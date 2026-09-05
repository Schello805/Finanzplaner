export function normalizeMerchant(value?: string | null) {
  return (value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("de-DE")
    .replace(/[^a-z0-9äöüß&+.-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function canLearnMerchant(value?: string | null) {
  const normalized = normalizeMerchant(value);
  return normalized.length >= 3 && !/(^|\s)(amazon|paypal)(\s|$)/.test(normalized);
}
