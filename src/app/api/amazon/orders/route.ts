import { NextResponse } from "next/server";
import { and, desc, eq, inArray, notInArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { accounts, amazonOrderItems, categories, transactions, transactionSplits } from "@/db/schema";
import { allocateAmazonCategories } from "@/features/amazon/allocation";
import { suggestAmazonCategory } from "@/features/amazon/category-suggestions";
import { amazonMatchScore } from "@/features/amazon/matching";
import { amazonAnalysisCoverage, isWithinAmazonCoverage } from "@/features/amazon/analysis-coverage";
import { writeAudit } from "@/lib/audit";
import { requireUser } from "@/lib/current-user";
import { decryptSecret } from "@/lib/security";
import { memberAndVisibleAccountIds } from "@/lib/visible-accounts";

const categorySchema = z.object({ itemId: z.string().uuid(), categoryId: z.string().uuid().nullable() });
const applySchema = z.object({ itemIds: z.array(z.string().uuid()).min(1).max(50), transactionId: z.string().uuid() });
const cents = (value: number) => Math.round(value * 100);

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { member, accountIds } = await memberAndVisibleAccountIds(user.userId);
    const items = await db
      .select({
        id: amazonOrderItems.id, orderIdFingerprint: amazonOrderItems.orderIdFingerprint,
        orderDate: amazonOrderItems.orderDate, shipDate: amazonOrderItems.shipDate,
        productNameEncrypted: amazonOrderItems.productNameEncrypted, quantity: amazonOrderItems.quantity,
        unitPrice: amazonOrderItems.unitPrice, unitTax: amazonOrderItems.unitTax,
        orderTotal: amazonOrderItems.orderTotal, currency: amazonOrderItems.currency,
        categoryId: amazonOrderItems.categoryId, matchedTransactionId: amazonOrderItems.matchedTransactionId,
        aiSuggestedCategoryId:amazonOrderItems.aiSuggestedCategoryId,aiSuggestedCategoryName:amazonOrderItems.aiSuggestedCategoryName,aiSuggestionConfidence:amazonOrderItems.aiSuggestionConfidence,aiSuggestionReason:amazonOrderItems.aiSuggestionReason,
      })
      .from(amazonOrderItems)
      .where(eq(amazonOrderItems.ownerMemberId, member.id))
      .orderBy(desc(amazonOrderItems.orderDate));
    const availableCategories = await db.select({ id: categories.id, name: categories.name, isIncome: categories.isIncome }).from(categories).where(eq(categories.householdId, member.householdId));
    const amazonTransactions = accountIds.length ? await db
      .select({ id: transactions.id, bookedOn: transactions.bookedOn, amount: transactions.amount, currency: transactions.currency, accountName: accounts.name })
      .from(transactions)
      .innerJoin(accounts, eq(transactions.accountId, accounts.id))
      .where(and(inArray(transactions.accountId, accountIds), or(sql`${transactions.counterparty} ilike '%amazon%'`, sql`${transactions.purpose} ilike '%amazon%'`)))
      .orderBy(desc(transactions.bookedOn)) : [];
    const coverage = amazonAnalysisCoverage(amazonTransactions.map((transaction) => transaction.bookedOn));
    const groups = new Map<string, typeof items>();
    for (const item of items) {
      const key = `${item.orderIdFingerprint}|${Number(item.orderTotal).toFixed(2)}|${item.shipDate ?? item.orderDate}`;
      groups.set(key, [...(groups.get(key) ?? []), item]);
    }
    const usedTransactionIds = new Set(
      items.flatMap((item) => item.matchedTransactionId ? [item.matchedTransactionId] : []),
    );
    const relevantGroups = [...groups.entries()].filter(([, rows]) => isWithinAmazonCoverage(rows[0].shipDate ?? rows[0].orderDate, coverage));
    const openGroups = relevantGroups.filter(([, rows]) => !rows.some((row) => row.matchedTransactionId));
    const preparedGroups = openGroups.map(([key, rows]) => {
      const first = rows[0];
      const currentTransactionId = rows.find((row) => row.matchedTransactionId)?.matchedTransactionId ?? null;
      const candidates = amazonTransactions.flatMap((transaction) => {
        if (usedTransactionIds.has(transaction.id) && transaction.id !== currentTransactionId) return [];
        if (transaction.currency !== first.currency) return [];
        const match = amazonMatchScore(Number(first.orderTotal), first.shipDate ?? first.orderDate, Number(transaction.amount), transaction.bookedOn);
        return match ? [{ ...transaction, ...match }] : [];
      }).sort((a, b) => b.score - a.score);
      return {
        key, orderDate: first.orderDate, shipDate: first.shipDate, total: Number(first.orderTotal), currency: first.currency,
        matchedTransactionId: currentTransactionId,
        items: rows.map((row) => {
          const productName = decryptSecret(row.productNameEncrypted);
          const persistedSuggestion=row.aiSuggestedCategoryId&&row.aiSuggestedCategoryName&&row.aiSuggestionConfidence?{categoryId:row.aiSuggestedCategoryId,categoryName:row.aiSuggestedCategoryName,reason:row.aiSuggestionReason??"KI-Vorschlag",confidence:Number(row.aiSuggestionConfidence)}:null;
          const proposal=!row.aiSuggestedCategoryId&&row.aiSuggestedCategoryName&&row.aiSuggestionConfidence?{name:row.aiSuggestedCategoryName,reason:row.aiSuggestionReason??"KI-Vorschlag",confidence:Number(row.aiSuggestionConfidence)}:null;
          const suggestion = row.categoryId ? null : persistedSuggestion??suggestAmazonCategory(productName, availableCategories);
          return { id: row.id, productName, quantity: Number(row.quantity), gross: (Number(row.unitPrice) + Number(row.unitTax)) * Number(row.quantity), categoryId: row.categoryId, suggestion,proposal };
        }),
        candidates: candidates.map((transaction) => ({ ...transaction, amount: Number(transaction.amount) })),
      };
    });
    const url = new URL(request.url);
    const match = z.enum(["all", "found", "missing"]).catch("all").parse(url.searchParams.get("match"));
    const filteredGroups = preparedGroups.filter((group) => match === "all" || (match === "found" ? group.candidates.length > 0 : group.candidates.length === 0));
    const pageSize = 100;
    const pageCount = Math.max(1, Math.ceil(filteredGroups.length / pageSize));
    const page = Math.min(pageCount, Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1));
    const found = preparedGroups.filter((group) => group.candidates.length > 0).length;
    return NextResponse.json({
      groups: filteredGroups.slice((page - 1) * pageSize, page * pageSize),
      page,
      pageSize,
      pageCount,
      filteredCount: filteredGroups.length,
      counts: {
        importedItems: items.length,
        importedGroups: groups.size,
        relevantGroups: relevantGroups.length,
        excludedGroups: groups.size - relevantGroups.length,
        openGroups: preparedGroups.length,
        linkedGroups: relevantGroups.length - preparedGroups.length,
        bankMatchFound: found,
        bankMatchMissing: preparedGroups.length - found,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Amazon-Bestellungen konnten nicht geladen werden." }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    const { member } = await memberAndVisibleAccountIds(user.userId);
    const body = categorySchema.parse(await request.json());
    if (body.categoryId) {
      const [category] = await db.select({ id: categories.id }).from(categories).where(and(eq(categories.id, body.categoryId), eq(categories.householdId, member.householdId))).limit(1);
      if (!category) throw new Error("Kategorie nicht gefunden.");
    }
    const [item] = await db.update(amazonOrderItems).set({categoryId:body.categoryId,aiSuggestedCategoryId:null,aiSuggestedCategoryName:null,aiSuggestionConfidence:null,aiSuggestionReason:null,aiAnalyzedAt:body.categoryId?new Date():null,updatedAt:new Date()}).where(and(eq(amazonOrderItems.id,body.itemId),eq(amazonOrderItems.ownerMemberId,member.id))).returning({id:amazonOrderItems.id});
    if (!item) throw new Error("Amazon-Artikel nicht gefunden.");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Kategorie konnte nicht gespeichert werden." }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const { member, accountIds } = await memberAndVisibleAccountIds(user.userId);
    const body = applySchema.parse(await request.json());
    const [items, transactionRows] = await Promise.all([
      db.select().from(amazonOrderItems).where(and(inArray(amazonOrderItems.id, body.itemIds), eq(amazonOrderItems.ownerMemberId, member.id))),
      db.select({ id: transactions.id, amount: transactions.amount, currency:transactions.currency, bookedOn:transactions.bookedOn, accountId: transactions.accountId, counterparty: transactions.counterparty, purpose: transactions.purpose }).from(transactions).where(eq(transactions.id, body.transactionId)).limit(1),
    ]);
    const transaction = transactionRows[0];
    if (items.length !== body.itemIds.length || !transaction || !accountIds.includes(transaction.accountId)) throw new Error("Bestellung oder Bankumsatz ist nicht zugänglich.");
    if (!`${transaction.counterparty ?? ""} ${transaction.purpose ?? ""}`.toLowerCase().includes("amazon")) throw new Error("Der gewählte Umsatz ist keine erkennbare Amazon-Buchung.");
    const first = items[0];
    if (items.some((item) => item.orderIdFingerprint !== first.orderIdFingerprint || Number(item.orderTotal) !== Number(first.orderTotal) || (item.shipDate ?? item.orderDate) !== (first.shipDate ?? first.orderDate))) throw new Error("Die gewählten Artikel gehören nicht zur selben Amazon-Belastung.");
    if (cents(Math.abs(Number(transaction.amount))) !== cents(Number(first.orderTotal))) throw new Error("Amazon-Bestellsumme und Bankumsatz stimmen nicht centgenau überein.");
    if (transaction.currency !== first.currency) throw new Error("Währungen von Amazon-Bestellung und Bankumsatz stimmen nicht überein.");
    if (!amazonMatchScore(Number(first.orderTotal), first.shipDate ?? first.orderDate, Number(transaction.amount), transaction.bookedOn)) throw new Error("Die Bankbuchung liegt außerhalb des zulässigen Zeitraums von 21 Tagen.");
    const alreadyUsed = await db.select({id:amazonOrderItems.id}).from(amazonOrderItems).where(and(eq(amazonOrderItems.matchedTransactionId,transaction.id),notInArray(amazonOrderItems.id,body.itemIds))).limit(1);
    if(alreadyUsed.length)throw new Error("Diese Bankbuchung ist bereits mit einer anderen Amazon-Bestellung verbunden.");
    if (items.some((item) => !item.categoryId)) throw new Error("Bitte zuerst jedem Artikel eine Kategorie zuordnen.");
    const totalCents = cents(Math.abs(Number(transaction.amount)));
    const weights = items.map((item) => Math.max(0, (Number(item.unitPrice) + Number(item.unitTax)) * Number(item.quantity)));
    const weightTotal = weights.reduce((sum, value) => sum + value, 0);
    if (!weightTotal) throw new Error("Artikelbeträge können nicht aufgeteilt werden.");
    const grouped = allocateAmazonCategories(items.map((item, index) => ({ categoryId: item.categoryId!, weight: weights[index] })), totalCents);
    await db.transaction(async (tx) => {
      await tx.delete(transactionSplits).where(eq(transactionSplits.transactionId, transaction.id));
      if (grouped.size === 1) {
        await tx.update(transactions).set({ categoryId: [...grouped.keys()][0], categorizedBy: "amazon", updatedAt: new Date() }).where(eq(transactions.id, transaction.id));
      } else {
        await tx.update(transactions).set({ categoryId: null, categorizedBy: "amazon-split", updatedAt: new Date() }).where(eq(transactions.id, transaction.id));
        await tx.insert(transactionSplits).values([...grouped].map(([categoryId, value]) => ({ transactionId: transaction.id, categoryId, amount: (value / 100).toFixed(2), note: "Amazon-Bestellimport" })));
      }
      await tx.update(amazonOrderItems).set({ matchedTransactionId: transaction.id, updatedAt: new Date() }).where(inArray(amazonOrderItems.id, body.itemIds));
    });
    await writeAudit("amazon-match", "Amazon-Artikel wurden einer Bankbuchung zugeordnet.", { userId: user.userId, metadata: { transactionId: transaction.id, items: items.length, categories: grouped.size } });
    return NextResponse.json({ ok: true, splitCount: grouped.size });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Amazon-Zuordnung fehlgeschlagen." }, { status: 400 });
  }
}
