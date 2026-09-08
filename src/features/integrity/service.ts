import "server-only";

import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { accounts, amazonOrderItems, transactionSplits, transactions } from "@/db/schema";
import { evaluateFinancialIntegrity } from "./checks";
import { writeAudit } from "@/lib/audit";

export async function runHouseholdIntegrityCheck(householdId: string, options: { audit?: boolean; userId?: string } = {}) {
  const accountRows = await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.householdId, householdId));
  const accountIds = accountRows.map((row) => row.id);
  const transactionRows = accountIds.length ? await db.select({
    id: transactions.id,
    amount: transactions.amount,
    currency: transactions.currency,
    direction: transactions.direction,
    specialType: transactions.specialType,
    excludedFromAnalysis: transactions.excludedFromAnalysis,
    linkedTransactionId: transactions.linkedTransactionId,
    categoryId: transactions.categoryId,
  }).from(transactions).where(inArray(transactions.accountId, accountIds)) : [];
  const transactionIds = transactionRows.map((row) => row.id);
  const [splits, amazonItems] = await Promise.all([
    transactionIds.length ? db.select({ transactionId: transactionSplits.transactionId, amount: transactionSplits.amount }).from(transactionSplits).where(inArray(transactionSplits.transactionId, transactionIds)) : [],
    db.select({ id: amazonOrderItems.id, matchedTransactionId: amazonOrderItems.matchedTransactionId, orderTotal: amazonOrderItems.orderTotal }).from(amazonOrderItems).where(eq(amazonOrderItems.householdId, householdId)),
  ]);
  const result = evaluateFinancialIntegrity({ transactions: transactionRows, splits, amazonItems });
  if (options.audit && !result.ok) await writeAudit("integrity", "Automatische Finanz-Integritätsprüfung hat Abweichungen gefunden.", { userId: options.userId, level: "error", metadata: { errors: result.errorCount, warnings: result.warningCount } });
  return result;
}
