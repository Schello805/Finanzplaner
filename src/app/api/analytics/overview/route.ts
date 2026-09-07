import { NextRequest, NextResponse } from "next/server";
import { and, eq, gte, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { categories, transactions, transactionSplits } from "@/db/schema";
import { categoryComparison, comparisonTotals, normalizeAnalysisTransactions, spendingTotal } from "@/features/analytics/calculations";
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
    const rows = await db
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
      ));
    const splits = rows.length
      ? await db.select({ transactionId: transactionSplits.transactionId, categoryId: transactionSplits.categoryId, categoryName: categories.name, amount: transactionSplits.amount, color: categories.color }).from(transactionSplits).leftJoin(categories, eq(transactionSplits.categoryId, categories.id)).where(inArray(transactionSplits.transactionId, rows.map((row) => row.id)))
      : [];
    const colors = new Map<string, string>();
    for(const row of rows)colors.set(row.categoryId??"uncategorized",row.color??"#7c898c");
    for(const split of splits)colors.set(split.categoryId,split.color??"#7c898c");
    const normalized = normalizeAnalysisTransactions(rows, splits);
    const rowsThroughToday = normalized.filter((row) => !row.bookedOn || row.bookedOn <= asOfDate);
    const comparisons = categoryComparison(rowsThroughToday, lastMonth, currentMonth).map((item) => ({ ...item, color: colors.get(item.categoryId) ?? "#7c898c" }));
    const months = [...new Set(normalized.map((row) => row.month))]
      .filter((month) => month < currentMonth)
      .sort()
      .map((month) => ({ month, value: spendingTotal(normalized.filter((row) => row.month === month)) }));
    const totals=comparisonTotals(comparisons);
    const lastSeriesValue=months.find(item=>item.month===lastMonth)?.value??0;
    if(Math.round(lastSeriesValue*100)!==Math.round(totals.last*100))throw new Error("Interne Summenprüfung fehlgeschlagen: Monatsverlauf und Kategorien stimmen nicht überein.");
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
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Analyse konnte nicht geladen werden." }, { status: 400 });
  }
}
