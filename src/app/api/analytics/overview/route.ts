import { NextRequest, NextResponse } from "next/server";
import { and, eq, gte, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { categories, transactions, transactionSplits } from "@/db/schema";
import { categoryComparison, spendingProjection, type MonthlyCategoryTotal } from "@/features/analytics/calculations";
import { requireUser } from "@/lib/current-user";
import { memberAndVisibleAccountIds } from "@/lib/visible-accounts";

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
        or(eq(transactions.direction, "expense"), eq(transactions.specialType, "refund")),
        gte(transactions.bookedOn, from),
      ));
    const splits = rows.length
      ? await db.select({ transactionId: transactionSplits.transactionId, categoryId: transactionSplits.categoryId, categoryName: categories.name, amount: transactionSplits.amount, color: categories.color }).from(transactionSplits).leftJoin(categories, eq(transactionSplits.categoryId, categories.id)).where(inArray(transactionSplits.transactionId, rows.map((row) => row.id)))
      : [];
    const colors = new Map<string, string>();
    const normalized: MonthlyCategoryTotal[] = rows.flatMap((row) => {
      const ownSplits = splits.filter((split) => split.transactionId === row.id);
      if (ownSplits.length) return ownSplits.map((split) => {
        colors.set(split.categoryId, split.color ?? "#7c898c");
        return { bookedOn: row.bookedOn, month: row.bookedOn.slice(0, 7), categoryId: split.categoryId, categoryName: split.categoryName ?? "Nicht zugeordnet", amount: row.specialType === "refund" ? Number(split.amount) : -Number(split.amount) };
      });
      const categoryId = row.categoryId ?? "uncategorized";
      colors.set(categoryId, row.color ?? "#7c898c");
      return [{ bookedOn: row.bookedOn, month: row.bookedOn.slice(0, 7), categoryId, categoryName: row.categoryName ?? "Nicht zugeordnet", amount: row.specialType === "refund" ? Math.abs(Number(row.amount)) : -Math.abs(Number(row.amount)) }];
    });
    const rowsThroughToday = normalized.filter((row) => !row.bookedOn || row.bookedOn <= asOfDate);
    const comparisons = categoryComparison(rowsThroughToday, lastMonth, currentMonth).map((item) => ({ ...item, color: colors.get(item.categoryId) ?? "#7c898c" }));
    const months = [...new Set(normalized.map((row) => row.month))]
      .filter((month) => month < currentMonth)
      .sort()
      .map((month) => ({ month, value: Math.max(0, -normalized.filter((row) => row.month === month).reduce((sum, row) => sum + row.amount, 0)) }));
    return NextResponse.json({
      empty: rows.length === 0,
      currentMonth,
      lastMonth,
      asOfDate,
      historyMonths: Math.max(0, ...comparisons.map((item) => item.historyMonths)),
      categories: comparisons.filter((item) => item.last > 0 || item.current > 0).slice(0, 5),
      months: months.slice(-6),
      projection: spendingProjection(normalized, currentMonth, asOfDate),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Analyse konnte nicht geladen werden." }, { status: 400 });
  }
}
