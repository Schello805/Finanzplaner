import { NextResponse } from "next/server";
import { and, desc, eq, inArray, notInArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { accounts, amazonOrderItems, categories, transactions, transactionSplits } from "@/db/schema";
import { allocateAmazonCategories } from "@/features/amazon/allocation";
import { suggestAmazonCategory } from "@/features/amazon/category-suggestions";
import { amazonMatchScore, amazonPaymentGroupTotal, uniqueAmountCombination } from "@/features/amazon/matching";
import { amazonAnalysisCoverage, isWithinAmazonCoverage } from "@/features/amazon/analysis-coverage";
import { writeAudit } from "@/lib/audit";
import { requireUser } from "@/lib/current-user";
import { decryptSecret } from "@/lib/security";
import { memberAndVisibleAccountIds } from "@/lib/visible-accounts";

const categorySchema = z.object({ itemId: z.string().uuid(), categoryId: z.string().uuid().nullable() });
const applySchema = z.object({ itemIds: z.array(z.string().uuid()).min(1).max(200), transactionId: z.string().uuid() });
const cents = (value: number) => Math.round(value * 100);
const paymentGroupKey = (item: { orderIdFingerprint: string; orderTotal: unknown; shipDate: string | null; orderDate: string }) =>
  `${item.orderIdFingerprint}|${Number(item.orderTotal).toFixed(2)}|${item.shipDate ?? item.orderDate}`;

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { member, accountIds } = await memberAndVisibleAccountIds(user.userId);
    const allItems = await db
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
    const items = allItems.filter((item) => Number(item.quantity) > 0 && Number(item.orderTotal) > 0);
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
      const key = paymentGroupKey(item);
      groups.set(key, [...(groups.get(key) ?? []), item]);
    }
    const usedTransactionIds = new Set(
      items.flatMap((item) => item.matchedTransactionId ? [item.matchedTransactionId] : []),
    );
    const relevantGroups = [...groups.entries()].filter(([, rows]) => isWithinAmazonCoverage(rows[0].shipDate ?? rows[0].orderDate, coverage));
    const openGroups = relevantGroups.filter(([, rows]) => !rows.some((row) => row.matchedTransactionId));
    const linkedGroupCount = relevantGroups.length - openGroups.length;
    const openRecords = openGroups.map(([key, rows]) => ({ key, rows, first: rows[0], date: rows[0].shipDate ?? rows[0].orderDate, orderDate: rows[0].orderDate, totalCents: cents(amazonPaymentGroupTotal(rows)) }));
    const combinationProposals = amazonTransactions.flatMap((transaction) => {
      if (usedTransactionIds.has(transaction.id)) return [];
      const targetCents = cents(Math.abs(Number(transaction.amount)));
      const orderDates = [...new Set(openRecords.map((group) => group.orderDate))];
      const matches = orderDates.flatMap((groupDate) => {
        const combinationMatch = amazonMatchScore(targetCents / 100, groupDate, Number(transaction.amount), transaction.bookedOn);
        if (!combinationMatch) return [];
        const sameDayGroups = openRecords.filter((group) => group.orderDate === groupDate && group.first.currency === transaction.currency && group.totalCents < targetCents);
        const result = uniqueAmountCombination(sameDayGroups.map((group) => ({ id: group.key, amountCents: group.totalCents })), targetCents);
        return result.combination ? [{ groupKeys: result.combination, groupDate, match: combinationMatch }] : [];
      });
      if (matches.length !== 1) return [];
      const bestDirectScore = Math.max(0, ...openRecords.flatMap((group) => {
        if (group.first.currency !== transaction.currency) return [];
        const direct = amazonMatchScore(group.totalCents / 100, group.date, Number(transaction.amount), transaction.bookedOn);
        return direct ? [direct.score] : [];
      }));
      if (bestDirectScore >= matches[0].match.score) return [];
      return [{ transaction, groupKeys: matches[0].groupKeys, match: matches[0].match }];
    });
    const groupProposalCounts = new Map<string, number>();
    combinationProposals.forEach((proposal) => proposal.groupKeys.forEach((key) => groupProposalCounts.set(key, (groupProposalCounts.get(key) ?? 0) + 1)));
    const safeCombinations = combinationProposals.filter((proposal) => proposal.groupKeys.every((key) => groupProposalCounts.get(key) === 1));
    const combinedTransactionIds = new Set(safeCombinations.map((combination) => combination.transaction.id));
    const combinationByKey = new Map(safeCombinations.flatMap((proposal) => proposal.groupKeys.map((key) => [key, proposal] as const)));
    const emittedCombinations = new Set<string>();
    const preparedGroups = openRecords.flatMap((record) => {
      const combination = combinationByKey.get(record.key);
      if (combination) {
        const combinationKey = combination.groupKeys.join("+");
        if (emittedCombinations.has(combinationKey)) return [];
        emittedCombinations.add(combinationKey);
      }
      const selectedRecords = combination ? combination.groupKeys.map((key) => openRecords.find((group) => group.key === key)!) : [record];
      const rows = selectedRecords.flatMap((group) => group.rows);
      const first = rows[0];
      const currentTransactionId = rows.find((row) => row.matchedTransactionId)?.matchedTransactionId ?? null;
      const candidates = combination ? [{
        ...combination.transaction,
        ...combination.match,
        reason: `${combination.groupKeys.length} Amazon-Zahlungsgruppen ergeben zusammen centgenau ${Math.abs(Number(combination.transaction.amount)).toFixed(2)} €`,
      }] : amazonTransactions.flatMap((transaction) => {
        if (combinedTransactionIds.has(transaction.id)) return [];
        if (usedTransactionIds.has(transaction.id) && transaction.id !== currentTransactionId) return [];
        if (transaction.currency !== first.currency) return [];
        const match = amazonMatchScore(record.totalCents / 100, first.shipDate ?? first.orderDate, Number(transaction.amount), transaction.bookedOn);
        return match ? [{ ...transaction, ...match }] : [];
      }).sort((a, b) => b.score - a.score);
      return {
        key: combination ? combination.groupKeys.join("+") : record.key,
        orderDate: selectedRecords.map((group) => group.date).sort()[0],
        shipDate: null,
        total: selectedRecords.reduce((sum, group) => sum + group.totalCents, 0) / 100,
        paymentGroupCount: selectedRecords.length,
        currency: first.currency,
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
        unlinkedGroups: openGroups.length,
        openGroups: preparedGroups.length,
        combinedGroups: safeCombinations.reduce((sum, combination) => sum + combination.groupKeys.length, 0),
        combinedAssignments: safeCombinations.length,
        linkedGroups: linkedGroupCount,
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
    const selectedGroupKeys = new Set(items.map(paymentGroupKey));
    const fingerprints = [...new Set(items.map((item) => item.orderIdFingerprint))];
    const completeGroupRows = await db.select().from(amazonOrderItems).where(and(eq(amazonOrderItems.ownerMemberId, member.id), inArray(amazonOrderItems.orderIdFingerprint, fingerprints)));
    const expectedItems = completeGroupRows.filter((item) => selectedGroupKeys.has(paymentGroupKey(item)));
    const selectedIds = new Set(body.itemIds);
    if (expectedItems.length !== items.length || expectedItems.some((item) => !selectedIds.has(item.id))) throw new Error("Eine Amazon-Zahlungsgruppe ist unvollständig. Bitte die Ansicht aktualisieren.");
    const paymentGroups = [...selectedGroupKeys].map((key) => {
      const rows = items.filter((item) => paymentGroupKey(item) === key);
      const first = rows[0];
      return { total: amazonPaymentGroupTotal(rows), date: first.shipDate ?? first.orderDate, currency: first.currency };
    });
    const combinedTotal = paymentGroups.reduce((sum, group) => sum + group.total, 0);
    if (cents(Math.abs(Number(transaction.amount))) !== cents(combinedTotal)) throw new Error("Die Summe der Amazon-Zahlungsgruppen und der Bankumsatz stimmen nicht centgenau überein.");
    if (paymentGroups.some((group) => transaction.currency !== group.currency)) throw new Error("Währungen von Amazon-Bestellungen und Bankumsatz stimmen nicht überein.");
    if (paymentGroups.some((group) => !amazonMatchScore(combinedTotal, group.date, Number(transaction.amount), transaction.bookedOn))) throw new Error("Mindestens eine Amazon-Bestellung liegt außerhalb des zulässigen Zeitraums von 21 Tagen.");
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
    await writeAudit("amazon-match", "Amazon-Artikel wurden einer Bankbuchung zugeordnet.", { userId: user.userId, metadata: { transactionId: transaction.id, items: items.length, paymentGroups: paymentGroups.length, categories: grouped.size } });
    return NextResponse.json({ ok: true, splitCount: grouped.size, paymentGroupCount: paymentGroups.length });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Amazon-Zuordnung fehlgeschlagen." }, { status: 400 });
  }
}
