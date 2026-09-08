import { NextRequest, NextResponse } from "next/server";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { categories, transactions, transactionSplits } from "@/db/schema";
import {
  categoryHistorySeries,
  completeMonthRange,
  hasTrustedAnalysisCategory,
  normalizeAnalysisTransactions,
} from "@/features/analytics/calculations";
import { requireUser } from "@/lib/current-user";
import { memberAndVisibleAccountIds } from "@/lib/visible-accounts";

const monthKey = (date: Date) =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const visible = await memberAndVisibleAccountIds(user.userId);
    let accountIds = visible.accountIds;
    const requestedAccountId = request.nextUrl.searchParams.get("accountId");
    if (requestedAccountId) {
      if (!accountIds.includes(requestedAccountId)) throw new Error("Konto nicht sichtbar.");
      accountIds = [requestedAccountId];
    }
    if (!accountIds.length) return NextResponse.json({ months: [], categories: [] });

    const [rows, categoryRows] = await Promise.all([
      db
        .select({
          id: transactions.id,
          bookedOn: transactions.bookedOn,
          amount: transactions.amount,
          specialType: transactions.specialType,
          categoryId: transactions.categoryId,
          categoryName: categories.name,
          color: categories.color,
          categorizedBy: transactions.categorizedBy,
          categorizationConfidence: transactions.categorizationConfidence,
        })
        .from(transactions)
        .leftJoin(categories, eq(transactions.categoryId, categories.id))
        .where(
          and(
            inArray(transactions.accountId, accountIds),
            sql`${transactions.amount} <> 0`,
            sql`not (${transactions.counterparty} is null and ${transactions.bookingType} ilike 'SONSTIGER EINZUG' and ${transactions.purpose} ilike 'MO %')`,
            eq(transactions.excludedFromAnalysis, false),
            sql`${transactions.specialType} <> 'transfer'`,
            or(eq(transactions.direction, "expense"), eq(transactions.specialType, "refund")),
          ),
        ),
      db
        .select({
          id: categories.id,
          name: categories.name,
          parentId: categories.parentId,
          color: categories.color,
        })
        .from(categories)
        .where(eq(categories.householdId, visible.member.householdId)),
    ]);

    const splits = rows.length
      ? await db
          .select({
            transactionId: transactionSplits.transactionId,
            categoryId: transactionSplits.categoryId,
            categoryName: categories.name,
            amount: transactionSplits.amount,
            color: categories.color,
          })
          .from(transactionSplits)
          .leftJoin(categories, eq(transactionSplits.categoryId, categories.id))
          .where(inArray(transactionSplits.transactionId, rows.map((row) => row.id)))
      : [];

    const categoryById = new Map(categoryRows.map((category) => [category.id, category]));
    const rootCategory = (categoryId: string | null) => {
      if (!categoryId) return null;
      let current = categoryById.get(categoryId);
      const visited = new Set<string>();
      while (current?.parentId && !visited.has(current.id)) {
        visited.add(current.id);
        current = categoryById.get(current.parentId) ?? current;
      }
      return current ?? categoryById.get(categoryId) ?? null;
    };

    const rowsAtRoot = rows.map((row) => {
      const trusted = hasTrustedAnalysisCategory(row.categorizedBy, row.categorizationConfidence);
      const root = rootCategory(trusted ? row.categoryId : null);
      return {
        ...row,
        categoryId: trusted ? (root?.id ?? row.categoryId) : null,
        categoryName: trusted ? (root?.name ?? row.categoryName) : null,
        color: trusted ? (root?.color ?? row.color) : "#7c898c",
      };
    });
    const splitsAtRoot = splits.map((split) => {
      const root = rootCategory(split.categoryId);
      return {
        ...split,
        categoryId: root?.id ?? split.categoryId,
        categoryName: root?.name ?? split.categoryName,
        color: root?.color ?? split.color,
      };
    });
    const colors = new Map<string, string>();
    for (const row of rowsAtRoot) colors.set(row.categoryId ?? "uncategorized", row.color ?? "#7c898c");
    for (const split of splitsAtRoot) colors.set(split.categoryId, split.color ?? "#7c898c");

    const normalized = normalizeAnalysisTransactions(rowsAtRoot, splitsAtRoot);
    const currentMonth = monthKey(new Date());
    const availableMonths = [...new Set(normalized.map((row) => row.month))]
      .filter((month) => month < currentMonth)
      .sort();
    const months = availableMonths.length
      ? completeMonthRange(availableMonths[0], availableMonths.at(-1)!)
      : [];
    const completeRows = normalized.filter((row) => row.month < currentMonth);
    const series = categoryHistorySeries(completeRows, months).map((category) => ({
      ...category,
      color: colors.get(category.categoryId) ?? "#7c898c",
    }));

    return NextResponse.json({ months, categories: series });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Kategorieverlauf konnte nicht geladen werden." },
      { status: 400 },
    );
  }
}
