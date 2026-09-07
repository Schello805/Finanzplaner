export type AmazonProductRule = {
  id: string;
  pattern: string;
  categoryId: string;
  enabled?: boolean;
};

export function normalizeProductPattern(value: string) {
  return value
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("de-DE");
}

export function matchesProductPattern(pattern: string, productName: string) {
  const normalizedPattern = normalizeProductPattern(pattern);
  const normalizedName = normalizeProductPattern(productName);
  if (!normalizedPattern) return false;
  const escaped = normalizedPattern
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`, "u").test(normalizedName);
}

export function matchingProductRule(rules: AmazonProductRule[], productName: string) {
  return (
    rules
      .filter(
        (rule) => rule.enabled !== false && matchesProductPattern(rule.pattern, productName),
      )
      .sort((a, b) => {
        const exactA = a.pattern.includes("*") ? 0 : 1;
        const exactB = b.pattern.includes("*") ? 0 : 1;
        return (
          exactB - exactA ||
          b.pattern.replace(/\*/g, "").length - a.pattern.replace(/\*/g, "").length
        );
      })[0] ?? null
  );
}
