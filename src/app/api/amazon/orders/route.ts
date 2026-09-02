import { NextResponse } from "next/server";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { accounts, amazonOrderItems, categories, transactions, transactionSplits } from "@/db/schema";
import { allocateAmazonCategories } from "@/features/amazon/allocation";
import { writeAudit } from "@/lib/audit";
import { requireUser } from "@/lib/current-user";
import { decryptSecret } from "@/lib/security";
import { memberAndVisibleAccountIds } from "@/lib/visible-accounts";

const categorySchema = z.object({ itemId: z.string().uuid(), categoryId: z.string().uuid().nullable() });
const applySchema = z.object({ itemIds: z.array(z.string().uuid()).min(1).max(50), transactionId: z.string().uuid() });
const day = 86_400_000;
const cents = (value: number) => Math.round(value * 100);

export async function GET() {
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
      })
      .from(amazonOrderItems)
      .where(eq(amazonOrderItems.ownerMemberId, member.id))
      .orderBy(desc(amazonOrderItems.orderDate))
      .limit(1000);
    const amazonTransactions = accountIds.length ? await db
      .select({ id: transactions.id, bookedOn: transactions.bookedOn, amount: transactions.amount, currency: transactions.currency, accountName: accounts.name })
      .from(transactions)
      .innerJoin(accounts, eq(transactions.accountId, accounts.id))
      .where(and(inArray(transactions.accountId, accountIds), or(sql`${transactions.counterparty} ilike '%amazon%'`, sql`${transactions.purpose} ilike '%amazon%'`)))
      .orderBy(desc(transactions.bookedOn))
      .limit(1000) : [];
    const groups = new Map<string, typeof items>();
    for (const item of items) {
      const key = `${item.orderIdFingerprint}|${Number(item.orderTotal).toFixed(2)}|${item.shipDate ?? item.orderDate}`;
      groups.set(key, [...(groups.get(key) ?? []), item]);
    }
    return NextResponse.json([...groups.entries()].slice(0, 250).map(([key, rows]) => {
      const first = rows[0];
      const referenceDate = new Date(`${first.shipDate ?? first.orderDate}T12:00:00Z`).getTime();
      const candidates = amazonTransactions.filter((transaction) =>
        transaction.currency === first.currency &&
        Math.abs(Math.abs(Number(transaction.amount)) - Number(first.orderTotal)) < 0.01 &&
        Math.abs(new Date(`${transaction.bookedOn}T12:00:00Z`).getTime() - referenceDate) <= 21 * day,
      );
      return {
        key, orderDate: first.orderDate, shipDate: first.shipDate, total: Number(first.orderTotal), currency: first.currency,
        matchedTransactionId: rows.find((row) => row.matchedTransactionId)?.matchedTransactionId ?? null,
        items: rows.map((row) => ({ id: row.id, productName: decryptSecret(row.productNameEncrypted), quantity: Number(row.quantity), gross: (Number(row.unitPrice) + Number(row.unitTax)) * Number(row.quantity), categoryId: row.categoryId })),
        candidates: candidates.map((transaction) => ({ ...transaction, amount: Number(transaction.amount) })),
      };
    }));
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
    const [item] = await db.update(amazonOrderItems).set({ categoryId: body.categoryId, updatedAt: new Date() }).where(and(eq(amazonOrderItems.id, body.itemId), eq(amazonOrderItems.ownerMemberId, member.id))).returning({ id: amazonOrderItems.id });
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
      db.select({ id: transactions.id, amount: transactions.amount, accountId: transactions.accountId, counterparty: transactions.counterparty, purpose: transactions.purpose }).from(transactions).where(eq(transactions.id, body.transactionId)).limit(1),
    ]);
    const transaction = transactionRows[0];
    if (items.length !== body.itemIds.length || !transaction || !accountIds.includes(transaction.accountId)) throw new Error("Bestellung oder Bankumsatz ist nicht zugänglich.");
    if (!`${transaction.counterparty ?? ""} ${transaction.purpose ?? ""}`.toLowerCase().includes("amazon")) throw new Error("Der gewählte Umsatz ist keine erkennbare Amazon-Buchung.");
    const first = items[0];
    if (items.some((item) => item.orderIdFingerprint !== first.orderIdFingerprint || Number(item.orderTotal) !== Number(first.orderTotal) || (item.shipDate ?? item.orderDate) !== (first.shipDate ?? first.orderDate))) throw new Error("Die gewählten Artikel gehören nicht zur selben Amazon-Belastung.");
    if (Math.abs(Math.abs(Number(transaction.amount)) - Number(first.orderTotal)) >= 0.01) throw new Error("Amazon-Bestellsumme und Bankumsatz stimmen nicht überein.");
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
