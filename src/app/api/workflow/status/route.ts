import { NextResponse } from "next/server";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { accounts, amazonOrderItems, imports, systemSettings, transactions, transactionSplits } from "@/db/schema";
import { requireUser } from "@/lib/current-user";
import { memberAndVisibleAccountIds } from "@/lib/visible-accounts";

export async function GET() {
  try {
    const user = await requireUser();
    const { member, accountIds } = await memberAndVisibleAccountIds(user.userId);
    if (!accountIds.length) return NextResponse.json({ accountCount: 0, transactionCount: 0, uncategorizedCount: 0, amazonOpenCount: 0, lastImportAt: null, aiConfigured: false });
    const [transactionRows, splitRows, lastImportRows, amazonRows, aiDefaultRows] = await Promise.all([
      db.select({ id: transactions.id, categoryId: transactions.categoryId }).from(transactions).where(and(inArray(transactions.accountId, accountIds), sql`${transactions.amount} <> 0`, sql`not (${transactions.counterparty} is null and ${transactions.bookingType} ilike 'SONSTIGER EINZUG' and ${transactions.purpose} ilike 'MO %')`)),
      db.select({ transactionId: transactionSplits.transactionId }).from(transactionSplits),
      db.select({ completedAt: imports.completedAt }).from(imports).innerJoin(accounts, eq(imports.accountId, accounts.id)).where(and(inArray(accounts.id, accountIds), eq(imports.status, "completed"))).orderBy(desc(imports.completedAt)).limit(1),
      db.select({ id: amazonOrderItems.id }).from(amazonOrderItems).where(and(eq(amazonOrderItems.ownerMemberId, member.id), isNull(amazonOrderItems.matchedTransactionId))),
      db.select({ valueJson: systemSettings.valueJson }).from(systemSettings).where(eq(systemSettings.key, "ai.default")).limit(1),
    ]);
    const splitIds = new Set(splitRows.map((row) => row.transactionId));
    const uncategorizedCount = transactionRows.filter((row) => !row.categoryId && !splitIds.has(row.id)).length;
    const provider = (aiDefaultRows[0]?.valueJson as { provider?: "openai" | "gemini" } | null)?.provider ?? "openai";
    const [providerRow] = await db.select({ secret: systemSettings.valueEncrypted }).from(systemSettings).where(eq(systemSettings.key, `ai.${provider}`)).limit(1);
    return NextResponse.json({ accountCount: accountIds.length, transactionCount: transactionRows.length, uncategorizedCount, amazonOpenCount: amazonRows.length, lastImportAt: lastImportRows[0]?.completedAt ?? null, aiConfigured: Boolean(providerRow?.secret) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Workflow-Status konnte nicht geladen werden." }, { status: 400 });
  }
}
