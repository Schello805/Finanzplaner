import { and, desc, eq, inArray, isNotNull, isNull, notExists, or } from "drizzle-orm";
import { db } from "@/db";
import { categorizationRules, categories, transactions, transactionSplits } from "@/db/schema";
import { canLearnMerchant, normalizeMerchant } from "./normalize";
import { keywordCategory } from "./keyword-rules";
export { normalizeMerchant } from "./normalize";

export async function merchantRuleMap(householdId: string, ownerMemberId: string) {
  const rows = await db
    .select({ value: categorizationRules.value, categoryId: categorizationRules.categoryId })
    .from(categorizationRules)
    .where(
      and(
        eq(categorizationRules.householdId, householdId),
        eq(categorizationRules.field, "counterparty"),
        eq(categorizationRules.operator, "equals"),
        eq(categorizationRules.enabled, true),
        or(eq(categorizationRules.ownerMemberId, ownerMemberId), eq(categorizationRules.shared, true)),
      ),
    );
  return new Map(rows.map((row) => [row.value, row.categoryId]));
}

export async function learnMerchantRule(input: {
  householdId: string;
  ownerMemberId: string;
  visibleAccountIds: string[];
  merchant?: string | null;
  categoryId: string | null;
}) {
  const value = normalizeMerchant(input.merchant);
  if (!canLearnMerchant(value)) return { learned: false, applied: 0 };
  await db.transaction(async (tx) => {
    await tx.delete(categorizationRules).where(
      and(
        eq(categorizationRules.householdId, input.householdId),
        eq(categorizationRules.ownerMemberId, input.ownerMemberId),
        eq(categorizationRules.field, "counterparty"),
        eq(categorizationRules.operator, "equals"),
        eq(categorizationRules.value, value),
      ),
    );
    if (input.categoryId) {
      await tx.insert(categorizationRules).values({
        householdId: input.householdId,
        ownerMemberId: input.ownerMemberId,
        categoryId: input.categoryId,
        field: "counterparty",
        operator: "equals",
        value,
        shared: false,
        priority: 100,
      });
    }
  });
  if (!input.categoryId || !input.visibleAccountIds.length) return { learned: true, applied: 0 };
  const applied = await db
    .update(transactions)
    .set({ categoryId: input.categoryId, categorizedBy: "local-rule", categorizationConfidence: "1.000", updatedAt: new Date() })
    .where(
      and(
        inArray(transactions.accountId, input.visibleAccountIds),
        isNull(transactions.categoryId),
        notExists(db.select({ id: transactionSplits.transactionId }).from(transactionSplits).where(eq(transactionSplits.transactionId, transactions.id))),
        eq(transactions.counterpartyNormalized, value),
      ),
    )
    .returning({ id: transactions.id });
  return { learned: true, applied: applied.length };
}

export async function applyMerchantRules(input: {
  householdId: string;
  ownerMemberId: string;
  visibleAccountIds: string[];
}) {
  if (!input.visibleAccountIds.length) return { applied: 0, rules: 0 };
  const existingRules = await merchantRuleMap(input.householdId, input.ownerMemberId);
  const assigned = await db
    .select({
      merchant: transactions.counterparty,
      merchantNormalized: transactions.counterpartyNormalized,
      categoryId: transactions.categoryId,
    })
    .from(transactions)
    .where(
      and(
        inArray(transactions.accountId, input.visibleAccountIds),
        isNotNull(transactions.categoryId),
      ),
    )
    .orderBy(desc(transactions.updatedAt));

  // Vor Einführung der Regeltabelle vorgenommene Zuordnungen werden beim
  // manuellen Lauf einmalig nachgelernt. Bei widersprüchlichen Altzuordnungen
  // gewinnt die zuletzt bearbeitete Buchung.
  const learned = new Map<string, string>();
  for (const row of assigned) {
    const merchant = normalizeMerchant(row.merchantNormalized || row.merchant);
    if (!row.categoryId || existingRules.has(merchant) || learned.has(merchant) || !canLearnMerchant(merchant)) continue;
    learned.set(merchant, row.categoryId);
  }
  if (learned.size) {
    await db.insert(categorizationRules).values(
      [...learned].map(([value, categoryId]) => ({
        householdId: input.householdId,
        ownerMemberId: input.ownerMemberId,
        categoryId,
        field: "counterparty",
        operator: "equals",
        value,
        shared: false,
        priority: 100,
      })),
    );
  }

  const rules = new Map([...existingRules, ...learned]);
  let applied = 0;
  for (const [merchant, categoryId] of rules) {
    const rows = await db
      .update(transactions)
      .set({ categoryId, categorizedBy: "local-rule", categorizationConfidence: "1.000", updatedAt: new Date() })
      .where(
        and(
          inArray(transactions.accountId, input.visibleAccountIds),
          isNull(transactions.categoryId),
          notExists(db.select({ id: transactionSplits.transactionId }).from(transactionSplits).where(eq(transactionSplits.transactionId, transactions.id))),
          eq(transactions.counterpartyNormalized, merchant),
        ),
      )
      .returning({ id: transactions.id });
    applied += rows.length;
  }
  const [availableCategories, remaining] = await Promise.all([
    db.select({ id: categories.id, name: categories.name, isIncome: categories.isIncome }).from(categories).where(eq(categories.householdId, input.householdId)),
    db.select({ id: transactions.id, purpose: transactions.purpose, amount: transactions.amount }).from(transactions).where(and(inArray(transactions.accountId, input.visibleAccountIds), isNull(transactions.categoryId), notExists(db.select({ id: transactionSplits.transactionId }).from(transactionSplits).where(eq(transactionSplits.transactionId, transactions.id))))),
  ]);
  let keywordApplied = 0;
  for (const row of remaining) {
    const category = keywordCategory(row.purpose, Number(row.amount) >= 0, availableCategories);
    if (!category) continue;
    await db.update(transactions).set({ categoryId: category.id, categorizedBy: "local-keyword", categorizationConfidence: "0.950", updatedAt: new Date() }).where(eq(transactions.id, row.id));
    keywordApplied++;
  }
  return { applied: applied + keywordApplied, rules: rules.size, learned: learned.size, keywordApplied };
}
