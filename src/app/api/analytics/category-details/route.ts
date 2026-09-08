import { NextRequest, NextResponse } from "next/server";
import { and, eq, gte, inArray, lt, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { accounts, categories, transactions, transactionSplits } from "@/db/schema";
import { hasTrustedAnalysisCategory } from "@/features/analytics/calculations";
import { requireUser } from "@/lib/current-user";
import { memberAndVisibleAccountIds } from "@/lib/visible-accounts";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const visible = await memberAndVisibleAccountIds(user.userId);
    const categoryId = request.nextUrl.searchParams.get("categoryId");
    const month = request.nextUrl.searchParams.get("month");
    const requestedAccountId = request.nextUrl.searchParams.get("accountId");
    if (!categoryId || !/^\d{4}-\d{2}$/.test(month ?? "")) {
      throw new Error("Kategorie und Monat fehlen.");
    }
    let accountIds = visible.accountIds;
    if (requestedAccountId) {
      if (!accountIds.includes(requestedAccountId)) throw new Error("Konto nicht sichtbar.");
      accountIds = [requestedAccountId];
    }
    if (!accountIds.length) return NextResponse.json({ entries: [], total: 0 });

    const categoryRows = await db
      .select({ id: categories.id, name: categories.name, parentId: categories.parentId })
      .from(categories)
      .where(eq(categories.householdId, visible.member.householdId));
    const descendants = new Set<string>();
    if (categoryId !== "uncategorized") {
      if (!categoryRows.some((category) => category.id === categoryId)) {
        throw new Error("Kategorie nicht gefunden.");
      }
      descendants.add(categoryId);
      let changed = true;
      while (changed) {
        changed = false;
        for (const category of categoryRows) {
          if (category.parentId && descendants.has(category.parentId) && !descendants.has(category.id)) {
            descendants.add(category.id);
            changed = true;
          }
        }
      }
    }
    const categoryNames = new Map(categoryRows.map((category) => [category.id, category.name]));
    const nextMonth = new Date(`${month}-01T12:00:00Z`);
    nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
    const until = nextMonth.toISOString().slice(0, 10);

    const rows = await db
      .select({
        id: transactions.id,
        bookedOn: transactions.bookedOn,
        amount: transactions.amount,
        currency: transactions.currency,
        specialType: transactions.specialType,
        categoryId: transactions.categoryId,
        categorizedBy: transactions.categorizedBy,
        categorizationConfidence: transactions.categorizationConfidence,
        counterparty: transactions.counterparty,
        purpose: transactions.purpose,
        bookingType: transactions.bookingType,
        accountName: accounts.name,
      })
      .from(transactions)
      .innerJoin(accounts, eq(transactions.accountId, accounts.id))
      .where(and(
        inArray(transactions.accountId, accountIds),
        gte(transactions.bookedOn, `${month}-01`),
        lt(transactions.bookedOn, until),
        sql`${transactions.amount} <> 0`,
        sql`not (${transactions.counterparty} is null and ${transactions.bookingType} ilike 'SONSTIGER EINZUG' and ${transactions.purpose} ilike 'MO %')`,
        eq(transactions.excludedFromAnalysis, false),
        sql`${transactions.specialType} <> 'transfer'`,
        or(eq(transactions.direction, "expense"), eq(transactions.specialType, "refund")),
      ));
    const splits = rows.length
      ? await db
          .select({
            transactionId: transactionSplits.transactionId,
            categoryId: transactionSplits.categoryId,
            amount: transactionSplits.amount,
          })
          .from(transactionSplits)
          .where(inArray(transactionSplits.transactionId, rows.map((row) => row.id)))
      : [];
    const splitsByTransaction = new Map<string, typeof splits>();
    for (const split of splits) {
      splitsByTransaction.set(split.transactionId, [
        ...(splitsByTransaction.get(split.transactionId) ?? []),
        split,
      ]);
    }

    const entries = rows.flatMap((row) => {
      const ownSplits = splitsByTransaction.get(row.id) ?? [];
      if (ownSplits.length) {
        return ownSplits
          .filter((split) => descendants.has(split.categoryId))
          .map((split) => ({
            id: `${row.id}:${split.categoryId}`,
            transactionId: row.id,
            bookedOn: row.bookedOn,
            amount: row.specialType === "refund" ? -Math.abs(Number(split.amount)) : Math.abs(Number(split.amount)),
            currency: row.currency,
            counterparty: row.counterparty,
            purpose: row.purpose,
            bookingType: row.bookingType,
            accountName: row.accountName,
            categoryName: categoryNames.get(split.categoryId) ?? "Unbekannt",
            split: true,
          }));
      }
      const effectiveCategoryId = hasTrustedAnalysisCategory(row.categorizedBy, row.categorizationConfidence) ? row.categoryId : null;
      const matches = categoryId === "uncategorized" ? !effectiveCategoryId : Boolean(effectiveCategoryId && descendants.has(effectiveCategoryId));
      if (!matches) return [];
      return [{
        id: row.id,
        transactionId: row.id,
        bookedOn: row.bookedOn,
        amount: row.specialType === "refund" ? -Math.abs(Number(row.amount)) : Math.abs(Number(row.amount)),
        currency: row.currency,
        counterparty: row.counterparty,
        purpose: row.purpose,
        bookingType: row.bookingType,
        accountName: row.accountName,
        categoryName: effectiveCategoryId ? categoryNames.get(effectiveCategoryId) ?? "Unbekannt" : "Nicht zugeordnet / KI-Zuordnung prüfen",
        split: false,
      }];
    }).sort((a, b) => b.amount - a.amount || b.bookedOn.localeCompare(a.bookedOn));

    return NextResponse.json({
      categoryId,
      month,
      total: Math.round(entries.reduce((sum, entry) => sum + entry.amount, 0) * 100) / 100,
      entries,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Kategoriedetails konnten nicht geladen werden." },
      { status: 400 },
    );
  }
}
