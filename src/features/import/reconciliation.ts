type ComparableTransaction = {
  bookedOn: string;
  amount: number | string;
  currency: string;
  fingerprint: string;
  counterparty?: string | null;
};

const coreKey = (item: ComparableTransaction) =>
  `${item.bookedOn}|${Number(item.amount).toFixed(2)}|${item.currency.toUpperCase()}`;

export function statementCoverage(incoming: ComparableTransaction[]) {
  if (!incoming.length) return { comparable: false, spanDays: 0, reason: "Keine endgültig gebuchten Umsätze im Export." };
  const timestamps = incoming.map((item) => new Date(`${item.bookedOn}T12:00:00Z`).getTime());
  const spanDays = Math.round((Math.max(...timestamps) - Math.min(...timestamps)) / 86_400_000) + 1;
  if (spanDays < 7 || incoming.length < 10) {
    return { comparable: false, spanDays, reason: "Der Export enthält weniger als sieben Tage oder weniger als zehn Buchungen und ist damit möglicherweise nur ein Teil- oder Tagesauszug." };
  }
  return { comparable: true, spanDays, reason: null };
}

/**
 * Finds stored rows that are absent from the statement period. A row is only
 * considered absent when no incoming row has the same date, amount and
 * currency. This deliberately prefers a missed cleanup suggestion over a
 * false deletion proposal when bank text or recipient formatting changes.
 */
export function findMissingStoredTransactions<T extends ComparableTransaction>(
  existing: T[],
  incoming: ComparableTransaction[],
) {
  if (!statementCoverage(incoming).comparable) return [];
  const dates = incoming.map((item) => item.bookedOn).sort();
  const firstDate = dates[0];
  const lastDate = dates.at(-1)!;
  const incomingFingerprints = new Set(incoming.map((item) => item.fingerprint));
  const incomingCoreKeys = new Set(incoming.map(coreKey));
  return existing.filter(
    (row) =>
      row.bookedOn >= firstDate &&
      row.bookedOn <= lastDate &&
      !incomingFingerprints.has(row.fingerprint) &&
      !incomingCoreKeys.has(coreKey(row)),
  );
}

type StoredReferenceTransaction = {
  id: string;
  accountId: string;
  bookedOn: string;
  amount: number | string;
  currency: string;
  bankReference?: string | null;
};

const stableReference = (value?: string | null) => {
  const normalized = (value ?? "").replace(/\s+/g, " ").trim().toLocaleLowerCase("de-DE");
  return normalized.length >= 6 && !/^(notprovided|nicht angegeben|n\/a)$/.test(normalized) ? normalized : null;
};

export function findStoredReferenceDuplicates<T extends StoredReferenceTransaction>(rows: T[]) {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const reference = stableReference(row.bankReference);
    if (!reference) continue;
    const key = `${row.accountId}|${Number(row.amount).toFixed(2)}|${row.currency.toUpperCase()}|${reference}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.values()].flatMap((group) => {
    const sorted = [...group].sort((a,b)=>a.bookedOn.localeCompare(b.bookedOn));
    return sorted.slice(1).map((duplicate, index) => ({ original: sorted[index], duplicate }));
  });
}
