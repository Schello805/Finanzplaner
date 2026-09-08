export function amazonMatchScore(orderTotal: number, orderDate: string, transactionAmount: number, transactionDate: string) {
  const amountDifferenceCents = Math.abs(Math.round(Math.abs(transactionAmount) * 100) - Math.round(Math.abs(orderTotal) * 100));
  const days = Math.abs(Date.parse(`${transactionDate}T12:00:00Z`) - Date.parse(`${orderDate}T12:00:00Z`)) / 86_400_000;
  if (amountDifferenceCents !== 0 || days > 21) return null;
  const score = Math.max(0.7, Math.min(0.99, 0.99 - days * 0.01));
  return { score: Math.round(score * 100) / 100, days: Math.round(days), reason: days === 0 ? "Betrag und Datum stimmen überein" : `Betrag stimmt überein · ${Math.round(days)} Tage Abstand` };
}

type AmountCandidate = { id: string; amountCents: number };

export function uniqueAmountCombination(candidates: AmountCandidate[], targetCents: number, minimumItems = 2) {
  const usable = candidates.filter((candidate) => candidate.amountCents > 0 && candidate.amountCents <= targetCents && (minimumItems <= 1 || candidate.amountCents < targetCents));
  const combinations = new Map<number, string[][]>([[0, [[]]]]);
  for (const candidate of usable) {
    const snapshot = [...combinations.entries()].sort(([left], [right]) => right - left);
    for (const [sum, paths] of snapshot) {
      const nextSum = sum + candidate.amountCents;
      if (nextSum > targetCents) continue;
      const existing = combinations.get(nextSum) ?? [];
      const additions = paths.map((path) => [...path, candidate.id]);
      const distinct = [...existing, ...additions].filter((path, index, all) =>
        index === all.findIndex((other) => other.join("|") === path.join("|")),
      ).slice(0, 2);
      combinations.set(nextSum, distinct);
    }
  }
  const matches = (combinations.get(targetCents) ?? []).filter((path) => path.length >= minimumItems);
  return { combination: matches.length === 1 ? matches[0] : null, ambiguous: matches.length > 1 };
}
