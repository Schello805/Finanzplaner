import { normalizeMerchant } from "./normalize";

export const COMPOUND_RULE_FIELD = "counterparty-purpose";
export const COMPOUND_RULE_OPERATOR = "contains";

const aggregatorPattern = /(^|\s)(amazon|paypal|klarna|apple|google|sumup)(\s|$)/;
const unsafeKeywordPattern = /^(zahlung|einkauf|bestellung|rechnung|abbuchung|lastschrift|online|marketplace|amazon|paypal|apple|google|klarna|unbekannt)$/;

export type CompoundRuleValue = { merchant: string; keyword: string };

export function isAggregatorMerchant(value?: string | null) {
  return aggregatorPattern.test(normalizeMerchant(value));
}

export function normalizeRuleKeyword(value?: string | null) {
  return normalizeMerchant(value).replace(/\s+/g, " ").trim();
}

export function isSafeRuleKeyword(value?: string | null) {
  const keyword = normalizeRuleKeyword(value);
  return keyword.length >= 4 && keyword.length <= 80 && !unsafeKeywordPattern.test(keyword) && !/^\d+$/.test(keyword) && !/^[a-z]*\d{6,}[a-z\d]*$/.test(keyword);
}

export function serializeCompoundRule(merchant: string, keyword: string) {
  return JSON.stringify({ merchant: normalizeMerchant(merchant), keyword: normalizeRuleKeyword(keyword) });
}

export function parseCompoundRule(value: string): CompoundRuleValue | null {
  try {
    const parsed = JSON.parse(value) as Partial<CompoundRuleValue>;
    if (!parsed.merchant || !isSafeRuleKeyword(parsed.keyword)) return null;
    return { merchant: normalizeMerchant(parsed.merchant), keyword: normalizeRuleKeyword(parsed.keyword) };
  } catch { return null; }
}

export function matchesCompoundRule(rule: CompoundRuleValue, transaction: { merchant?: string | null; purpose?: string | null }) {
  if (normalizeMerchant(transaction.merchant) !== rule.merchant) return false;
  return normalizeRuleKeyword(transaction.purpose).includes(rule.keyword);
}

export function compoundRuleLabel(value: string) {
  const rule = parseCompoundRule(value);
  return rule ? `${rule.merchant} + „${rule.keyword}“ im Buchungstext` : value;
}
