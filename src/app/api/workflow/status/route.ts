import { NextResponse } from "next/server";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { accounts, amazonOrderItems, imports, systemSettings, transactions, transactionSplits } from "@/db/schema";
import { requireUser } from "@/lib/current-user";
import { memberAndVisibleAccountIds } from "@/lib/visible-accounts";
import { VERY_SAFE_CONFIDENCE } from "@/features/categorization/confidence";
import { amazonAnalysisCoverage, countOpenAmazonPaymentGroups } from "@/features/amazon/analysis-coverage";

export async function GET() {
  try {
    const user = await requireUser();
    const { member, accountIds } = await memberAndVisibleAccountIds(user.userId);
    if (!accountIds.length) return NextResponse.json({ accountCount: 0, transactionCount: 0, uncategorizedCount: 0, reviewCount:0,deferredCount:0,unresolvedSources:{amazon:0,paypal:0,card:0},amazonOpenCount: 0, lastImportAt: null, aiConfigured: false,bankConnected:false });
    const [transactionRows, splitRows, lastImportRows, amazonRows, aiDefaultRows,finTsRows] = await Promise.all([
      db.select({ id: transactions.id, bookedOn:transactions.bookedOn,categoryId: transactions.categoryId,counterparty:transactions.counterparty,purpose:transactions.purpose,bookingType:transactions.bookingType,confidence:transactions.categorizationConfidence,categorizedBy:transactions.categorizedBy,aiReviewDeferredAt:transactions.aiReviewDeferredAt }).from(transactions).where(and(inArray(transactions.accountId, accountIds),eq(transactions.excludedFromAnalysis,false),sql`${transactions.specialType} <> 'transfer'`, sql`${transactions.amount} <> 0`, sql`not (${transactions.counterparty} is null and ${transactions.bookingType} ilike 'SONSTIGER EINZUG' and ${transactions.purpose} ilike 'MO %')`)),
      db.select({ transactionId: transactionSplits.transactionId }).from(transactionSplits).innerJoin(transactions,eq(transactionSplits.transactionId,transactions.id)).where(inArray(transactions.accountId,accountIds)),
      db.select({ completedAt: imports.completedAt }).from(imports).innerJoin(accounts, eq(imports.accountId, accounts.id)).where(and(inArray(accounts.id, accountIds), eq(imports.status, "completed"))).orderBy(desc(imports.completedAt)).limit(1),
      db.select({ id:amazonOrderItems.id,orderIdFingerprint:amazonOrderItems.orderIdFingerprint,orderDate:amazonOrderItems.orderDate,shipDate:amazonOrderItems.shipDate,orderTotal:amazonOrderItems.orderTotal,quantity:amazonOrderItems.quantity,matchedTransactionId:amazonOrderItems.matchedTransactionId }).from(amazonOrderItems).where(eq(amazonOrderItems.ownerMemberId, member.id)),
      db.select({ valueJson: systemSettings.valueJson }).from(systemSettings).where(eq(systemSettings.key, "ai.default")).limit(1),
      db.select({key:systemSettings.key}).from(systemSettings).where(eq(systemSettings.key,`fints.sparkasse.${member.id}`)).limit(1),
    ]);
    const splitIds = new Set(splitRows.map((row) => row.transactionId));
    const uncategorizedCount = transactionRows.filter((row) => !row.categoryId && !splitIds.has(row.id)).length;
    const openRows=transactionRows.filter(row=>!row.categoryId&&!splitIds.has(row.id));
    const unresolvedSources={amazon:openRows.filter(row=>/amazon/i.test(`${row.counterparty} ${row.purpose}`)).length,paypal:openRows.filter(row=>/paypal/i.test(`${row.counterparty} ${row.purpose}`)).length,card:openRows.filter(row=>/kreditkarte|credit card|kartenabrechnung/i.test(`${row.counterparty} ${row.purpose} ${row.bookingType}`)).length};
    const amazonCoverage=amazonAnalysisCoverage(transactionRows.filter(row=>/amazon/i.test(`${row.counterparty} ${row.purpose}`)).map(row=>row.bookedOn));
    const amazonOpenCount=countOpenAmazonPaymentGroups(amazonRows,amazonCoverage);
    const reviewCount=transactionRows.filter(row=>row.categoryId&&row.categorizedBy?.startsWith("ai:")&&Number(row.confidence??0)<VERY_SAFE_CONFIDENCE).length;
    const deferredCount=openRows.filter(row=>row.aiReviewDeferredAt).length;
    const provider = (aiDefaultRows[0]?.valueJson as { provider?: "openai" | "gemini" } | null)?.provider ?? "openai";
    const [providerRow] = await db.select({ secret: systemSettings.valueEncrypted }).from(systemSettings).where(eq(systemSettings.key, `ai.${provider}`)).limit(1);
    return NextResponse.json({ accountCount: accountIds.length, transactionCount: transactionRows.length, uncategorizedCount, reviewCount,deferredCount,unresolvedSources,amazonOpenCount, lastImportAt: lastImportRows[0]?.completedAt ?? null, aiConfigured: Boolean(providerRow?.secret),bankConnected:finTsRows.length>0 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Workflow-Status konnte nicht geladen werden." }, { status: 400 });
  }
}
