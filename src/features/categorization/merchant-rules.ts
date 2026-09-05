import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { categorizationRules, transactions } from "@/db/schema";
import { canLearnMerchant, normalizeMerchant } from "./normalize";
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
        eq(transactions.counterpartyNormalized, value),
      ),
    )
    .returning({ id: transactions.id });
  return { learned: true, applied: applied.length };
}
