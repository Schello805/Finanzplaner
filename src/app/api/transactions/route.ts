import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  accounts,
  categories,
  transactions,
  transactionSplits,
} from "@/db/schema";
import { requireUser } from "@/lib/current-user";
import { memberAndVisibleAccountIds } from "@/lib/visible-accounts";
import { learnMerchantRule } from "@/features/categorization/merchant-rules";
export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const { accountIds } = await memberAndVisibleAccountIds(user.userId);
    if (!accountIds.length) return NextResponse.json([]);
    const search = request.nextUrl.searchParams.get("q")?.trim();
    const conditions = [inArray(transactions.accountId, accountIds)];
    if (search)
      conditions.push(
        or(
          sql`${transactions.counterparty} ilike ${`%${search}%`}`,
          sql`${transactions.purpose} ilike ${`%${search}%`}`,
        )!,
      );
    const rows = await db
      .select({
        id: transactions.id,
        bookedOn: transactions.bookedOn,
        amount: transactions.amount,
        currency: transactions.currency,
        counterparty: transactions.counterparty,
        purpose: transactions.purpose,
        categoryId: transactions.categoryId,
        categoryName: categories.name,
        accountName: accounts.name,
        note: transactions.note,
        tags: transactions.tags,
        excluded: transactions.excludedFromAnalysis,
        specialType: transactions.specialType,
        linkedTransactionId: transactions.linkedTransactionId,
      })
      .from(transactions)
      .innerJoin(accounts, eq(transactions.accountId, accounts.id))
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .where(and(...conditions))
      .orderBy(desc(transactions.bookedOn), desc(transactions.createdAt))
      .limit(500);
    const splitRows = rows.length
      ? await db
          .select()
          .from(transactionSplits)
          .where(
            inArray(
              transactionSplits.transactionId,
              rows.map((row) => row.id),
            ),
          )
      : [];
    return NextResponse.json(
      rows.map((row) => ({
        ...row,
        splits: splitRows
          .filter((split) => split.transactionId === row.id)
          .map(({ categoryId, amount, note }) => ({
            categoryId,
            amount,
            note,
          })),
      })),
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Umsätze konnten nicht geladen werden.",
      },
      { status: 400 },
    );
  }
}
const splitSchema = z.object({
  categoryId: z.string().uuid(),
  amount: z.number().positive().finite(),
  note: z.string().trim().max(200).nullable().optional(),
});
const patchSchema = z.object({
  id: z.string().uuid(),
  categoryId: z.string().uuid().nullable().optional(),
  note: z.string().max(500).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(30)).max(20).optional(),
  excluded: z.boolean().optional(),
  specialType: z.enum(["normal", "refund", "transfer"]).optional(),
  linkedTransactionId: z.string().uuid().nullable().optional(),
  splits: z.array(splitSchema).min(2).max(20).optional(),
});
export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    const { member, accountIds } = await memberAndVisibleAccountIds(
      user.userId,
    );
    const body = patchSchema.parse(await request.json());
    const [row] = await db
      .select({
        accountId: transactions.accountId,
        amount: transactions.amount,
        counterparty: transactions.counterparty,
      })
      .from(transactions)
      .where(eq(transactions.id, body.id))
      .limit(1);
    if (!row || !accountIds.includes(row.accountId))
      throw new Error("Umsatz nicht sichtbar.");
    const categoryIds = [
      ...(body.categoryId ? [body.categoryId] : []),
      ...(body.splits?.map((split) => split.categoryId) ?? []),
    ];
    if (categoryIds.length) {
      const valid = await db
        .select({ id: categories.id })
        .from(categories)
        .where(
          and(
            inArray(categories.id, [...new Set(categoryIds)]),
            eq(categories.householdId, member.householdId),
          ),
        );
      if (valid.length !== new Set(categoryIds).size)
        throw new Error("Mindestens eine Kategorie wurde nicht gefunden.");
    }
    if (body.linkedTransactionId) {
      if (body.linkedTransactionId === body.id)
        throw new Error(
          "Ein Umsatz kann nicht mit sich selbst verknüpft werden.",
        );
      const [linked] = await db
        .select({ accountId: transactions.accountId })
        .from(transactions)
        .where(eq(transactions.id, body.linkedTransactionId))
        .limit(1);
      if (!linked || !accountIds.includes(linked.accountId))
        throw new Error("Die verknüpfte Buchung ist nicht sichtbar.");
    }
    if (body.splits) {
      const splitTotal = body.splits.reduce(
        (sum, split) => sum + split.amount,
        0,
      );
      if (Math.abs(splitTotal - Math.abs(Number(row.amount))) > 0.01)
        throw new Error(
          `Die Aufteilung muss zusammen ${Math.abs(Number(row.amount)).toFixed(2)} € ergeben.`,
        );
    }
    await db.transaction(async (tx) => {
      await tx
        .update(transactions)
        .set({
          categoryId: body.splits ? null : body.categoryId,
          note: body.note,
          tags: body.tags,
          excludedFromAnalysis:
            body.specialType === "transfer" ? true : body.excluded,
          specialType: body.specialType,
          linkedTransactionId: body.linkedTransactionId,
          updatedAt: new Date(),
          categorizedBy:
            body.categoryId !== undefined || body.splits ? "manual" : undefined,
        })
        .where(eq(transactions.id, body.id));
      if (body.splits) {
        await tx
          .delete(transactionSplits)
          .where(eq(transactionSplits.transactionId, body.id));
        await tx
          .insert(transactionSplits)
          .values(
            body.splits.map((split) => ({
              transactionId: body.id,
              categoryId: split.categoryId,
              amount: split.amount.toFixed(2),
              note: split.note,
            })),
          );
      } else if (body.categoryId !== undefined)
        await tx
          .delete(transactionSplits)
          .where(eq(transactionSplits.transactionId, body.id));
    });
    const learned = body.categoryId !== undefined && !body.splits
      ? await learnMerchantRule({
          householdId: member.householdId,
          ownerMemberId: member.id,
          visibleAccountIds: accountIds,
          merchant: row.counterparty,
          categoryId: body.categoryId ?? null,
        })
      : { learned: false, applied: 0 };
    return NextResponse.json({ ok: true, ruleLearned: learned.learned, additionallyApplied: learned.applied });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Umsatz konnte nicht gespeichert werden.",
      },
      { status: 400 },
    );
  }
}
