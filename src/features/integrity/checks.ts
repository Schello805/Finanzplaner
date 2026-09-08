export type IntegrityTransaction = {
  id: string;
  amount: number | string;
  currency: string;
  direction: "income" | "expense";
  specialType: "normal" | "refund" | "transfer";
  excludedFromAnalysis: boolean;
  linkedTransactionId: string | null;
  categoryId: string | null;
};
export type IntegritySplit = { transactionId: string; amount: number | string };
export type IntegrityAmazonItem = { id: string; matchedTransactionId: string | null; orderTotal: number | string };
export type IntegrityIssue = { code: string; severity: "error" | "warning"; entityId: string; message: string };

const cents = (value: number | string) => Math.round(Math.abs(Number(value)) * 100);

export function evaluateFinancialIntegrity(input: {
  transactions: IntegrityTransaction[];
  splits: IntegritySplit[];
  amazonItems: IntegrityAmazonItem[];
}) {
  const issues: IntegrityIssue[] = [];
  const transactionById = new Map(input.transactions.map((row) => [row.id, row]));
  const splitsByTransaction = new Map<string, IntegritySplit[]>();
  for (const split of input.splits) splitsByTransaction.set(split.transactionId, [...(splitsByTransaction.get(split.transactionId) ?? []), split]);

  for (const transaction of input.transactions) {
    const ownSplits = splitsByTransaction.get(transaction.id) ?? [];
    if (ownSplits.length) {
      const splitCents = ownSplits.reduce((sum, split) => sum + cents(split.amount), 0);
      if (splitCents !== cents(transaction.amount)) issues.push({ code: "split-total", severity: "error", entityId: transaction.id, message: `Aufteilung ${splitCents} Cent, Buchung ${cents(transaction.amount)} Cent.` });
      if (transaction.categoryId) issues.push({ code: "split-and-category", severity: "error", entityId: transaction.id, message: "Umsatz besitzt gleichzeitig eine direkte Kategorie und Aufteilungen." });
    }
    if (transaction.specialType === "normal" && ((transaction.direction === "expense" && Number(transaction.amount) > 0) || (transaction.direction === "income" && Number(transaction.amount) < 0))) {
      issues.push({ code: "direction-sign", severity: "error", entityId: transaction.id, message: "Buchungsrichtung und Vorzeichen widersprechen sich." });
    }
    if (transaction.specialType === "transfer") {
      if (!transaction.excludedFromAnalysis) issues.push({ code: "transfer-included", severity: "error", entityId: transaction.id, message: "Interne Umbuchung ist nicht von der Auswertung ausgeschlossen." });
      const peer = transaction.linkedTransactionId ? transactionById.get(transaction.linkedTransactionId) : undefined;
      if (!peer) issues.push({ code: "transfer-peer-missing", severity: "warning", entityId: transaction.id, message: "Interne Umbuchung besitzt keine erreichbare Gegenbuchung." });
      else if (peer.linkedTransactionId !== transaction.id || peer.specialType !== "transfer" || peer.currency !== transaction.currency || cents(peer.amount) !== cents(transaction.amount) || Math.sign(Number(peer.amount)) === Math.sign(Number(transaction.amount))) {
        issues.push({ code: "transfer-peer-invalid", severity: "error", entityId: transaction.id, message: "Gegenbuchung der internen Umbuchung ist nicht wechselseitig und centgleich." });
      }
    }
  }

  const amazonByTransaction = new Map<string, IntegrityAmazonItem[]>();
  for (const item of input.amazonItems) if (item.matchedTransactionId) amazonByTransaction.set(item.matchedTransactionId, [...(amazonByTransaction.get(item.matchedTransactionId) ?? []), item]);
  for (const [transactionId, items] of amazonByTransaction) {
    const transaction = transactionById.get(transactionId);
    if (!transaction) {
      issues.push({ code: "amazon-transaction-missing", severity: "error", entityId: items[0].id, message: "Amazon-Zuordnung verweist auf keinen vorhandenen Umsatz." });
      continue;
    }
    const amazonCents = items.reduce((sum, item) => sum + cents(item.orderTotal), 0);
    if (amazonCents !== cents(transaction.amount)) issues.push({ code: "amazon-total", severity: "error", entityId: transactionId, message: `Amazon-Positionen ${amazonCents} Cent, Bankbuchung ${cents(transaction.amount)} Cent.` });
  }

  return {
    ok: issues.length === 0,
    checkedTransactions: input.transactions.length,
    checkedSplits: input.splits.length,
    checkedAmazonItems: input.amazonItems.length,
    errorCount: issues.filter((issue) => issue.severity === "error").length,
    warningCount: issues.filter((issue) => issue.severity === "warning").length,
    issues,
  };
}
