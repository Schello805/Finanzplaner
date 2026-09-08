import { NextRequest, NextResponse } from "next/server";
import { and, eq, gte, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { categories, transactions, transactionSplits } from "@/db/schema";
import { categoryComparison, categoryTrendAnalysis, comparisonTotals, normalizeAnalysisTransactions, spendingOpportunities, spendingTotal } from "@/features/analytics/calculations";
import { requireUser } from "@/lib/current-user";
import { memberAndVisibleAccountIds } from "@/lib/visible-accounts";
import { VERY_SAFE_CONFIDENCE } from "@/features/categorization/confidence";

const monthKey = (date: Date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
const dateKey = (date: Date) => `${monthKey(date)}-${String(date.getUTCDate()).padStart(2, "0")}`;
const shift = (date: Date, months: number) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const visible = await memberAndVisibleAccountIds(user.userId);
    let accountIds = visible.accountIds;
    const requested = request.nextUrl.searchParams.get("accountId");
    if (requested) {
      if (!accountIds.includes(requested)) throw new Error("Konto nicht sichtbar.");
      accountIds = [requested];
    }
    if (!accountIds.length) return NextResponse.json({ empty: true, categories: [], months: [] });

    const now = new Date();
    const currentMonth = monthKey(now);
    const lastMonth = monthKey(shift(now, -1));
    const asOfDate = dateKey(now);
    const from = `${monthKey(shift(now, -13))}-01`;
    const [rows, categoryRows] = await Promise.all([db
      .select({ id: transactions.id, bookedOn: transactions.bookedOn, amount: transactions.amount, specialType: transactions.specialType, categoryId: transactions.categoryId, categoryName: categories.name, color: categories.color })
      .from(transactions)
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .where(and(
        inArray(transactions.accountId, accountIds),
        sql`${transactions.amount} <> 0`,
        sql`not (${transactions.counterparty} is null and ${transactions.bookingType} ilike 'SONSTIGER EINZUG' and ${transactions.purpose} ilike 'MO %')`,
        eq(transactions.excludedFromAnalysis, false),
        sql`${transactions.specialType} <> 'transfer'`,
        or(eq(transactions.direction, "expense"), eq(transactions.specialType, "refund")),
        sql`not (coalesce(${transactions.categorizedBy}, '') like 'ai:%' and coalesce(${transactions.categorizationConfidence}, 0) < ${VERY_SAFE_CONFIDENCE})`,
        gte(transactions.bookedOn, from),
      )), db.select({ id: categories.id, name: categories.name, parentId: categories.parentId, color: categories.color }).from(categories).where(eq(categories.householdId, visible.member.householdId))]);
    const splits = rows.length
      ? await db.select({ transactionId: transactionSplits.transactionId, categoryId: transactionSplits.categoryId, categoryName: categories.name, amount: transactionSplits.amount, color: categories.color }).from(transactionSplits).leftJoin(categories, eq(transactionSplits.categoryId, categories.id)).where(inArray(transactionSplits.transactionId, rows.map((row) => row.id)))
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
      const root = rootCategory(row.categoryId);
      return { ...row, categoryId: root?.id ?? row.categoryId, categoryName: root?.name ?? row.categoryName, color: root?.color ?? row.color };
    });
    const splitsAtRoot = splits.map((split) => {
      const root = rootCategory(split.categoryId);
      return { ...split, categoryId: root?.id ?? split.categoryId, categoryName: root?.name ?? split.categoryName, color: root?.color ?? split.color };
    });
    const colors = new Map<string, string>();
    for(const row of rowsAtRoot)colors.set(row.categoryId??"uncategorized",row.color??"#7c898c");
    for(const split of splitsAtRoot)colors.set(split.categoryId,split.color??"#7c898c");
    const normalized = normalizeAnalysisTransactions(rowsAtRoot, splitsAtRoot);
    const rowsThroughToday = normalized.filter((row) => !row.bookedOn || row.bookedOn <= asOfDate);
    const comparisons = categoryComparison(rowsThroughToday, lastMonth, currentMonth).map((item) => ({ ...item, color: colors.get(item.categoryId) ?? "#7c898c" }));
    const months = [...new Set(normalized.map((row) => row.month))]
      .filter((month) => month < currentMonth)
      .sort()
      .map((month) => ({ month, value: spendingTotal(normalized.filter((row) => row.month === month)) }));
    const totals=comparisonTotals(comparisons);
    const lastSeriesValue=months.find(item=>item.month===lastMonth)?.value??0;
    if(Math.round(lastSeriesValue*100)!==Math.round(totals.last*100))throw new Error("Interne Summenprüfung fehlgeschlagen: Monatsverlauf und Kategorien stimmen nicht überein.");
    const completeMonths = [...new Set(normalized.map((row) => row.month))].filter((month) => month < currentMonth).sort().slice(-12);
    const trends = categoryTrendAnalysis(normalized, completeMonths, comparisons);
    const opportunities = spendingOpportunities(comparisons);
    return NextResponse.json({
      empty: rows.length === 0,
      currentMonth,
      lastMonth,
      asOfDate,
      historyMonths: Math.max(0, ...comparisons.map((item) => item.historyMonths)),
      totals,
      integrityCheck:"passed",
      categories: comparisons.filter((item) => item.last !== 0 || item.current !== 0 || (item.average ?? 0) !== 0),
      months: months.slice(-6),
      trends: trends.slice(0, 5),
      opportunities,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Analyse konnte nicht geladen werden." }, { status: 400 });
  }
}
