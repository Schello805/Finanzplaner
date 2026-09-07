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
import { isBalancedTransfer } from "@/features/analytics/transfers";
import { writeAudit } from "@/lib/audit";
export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const { accountIds } = await memberAndVisibleAccountIds(user.userId);
    if (!accountIds.length) return NextResponse.json([]);
    const search = request.nextUrl.searchParams.get("q")?.trim();
    const conditions = [
      inArray(transactions.accountId, accountIds),
      sql`${transactions.amount} <> 0`,
      sql`not (${transactions.counterparty} is null and ${transactions.bookingType} ilike 'SONSTIGER EINZUG' and ${transactions.purpose} ilike 'MO %')`,
    ];
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
        accountId: transactions.accountId,
        bookedOn: transactions.bookedOn,
        amount: transactions.amount,
        currency: transactions.currency,
        direction: transactions.direction,
        counterparty: transactions.counterparty,
        bookingType: transactions.bookingType,
        purpose: transactions.purpose,
        categoryId: transactions.categoryId,
        categoryName: categories.name,
        accountName: accounts.name,
        note: transactions.note,
        tags: transactions.tags,
        excluded: transactions.excludedFromAnalysis,
        specialType: transactions.specialType,
        linkedTransactionId: transactions.linkedTransactionId,
        categorizationConfidence: transactions.categorizationConfidence,
        categorizedBy: transactions.categorizedBy,
        aiReviewDeferredAt: transactions.aiReviewDeferredAt,
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
        counterparty:
          row.counterparty ??
          (/zinsen/i.test(row.bookingType ?? "")
            ? "Zinsen"
            : /entgelt/i.test(row.bookingType ?? "")
              ? "Kontoführungsgebühren"
              : "Ohne Empfänger"),
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
  amount: z.number().positive().finite().refine((value)=>Math.abs(value*100-Math.round(value*100))<1e-8,"Teilbeträge dürfen höchstens zwei Nachkommastellen haben."),
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
  ruleMode: z.enum(["none", "future", "all"]).optional(),
  matchingKeyword: z.string().trim().max(80).nullable().optional(),
  deferAiReview: z.boolean().optional(),
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
        currency:transactions.currency,
        direction:transactions.direction,
        counterparty: transactions.counterparty,
        purpose: transactions.purpose,
        categoryId: transactions.categoryId,
        categorySlug: categories.slug,
        specialType: transactions.specialType,
        excludedFromAnalysis: transactions.excludedFromAnalysis,
        linkedTransactionId:transactions.linkedTransactionId,
      })
      .from(transactions)
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .where(eq(transactions.id, body.id))
      .limit(1);
    if (!row || !accountIds.includes(row.accountId))
      throw new Error("Umsatz nicht sichtbar.");
    const categoryIds = [
      ...(body.categoryId ? [body.categoryId] : []),
      ...(body.splits?.map((split) => split.categoryId) ?? []),
    ];
    let selectedCategorySlug: string | undefined;
    if (categoryIds.length) {
      const valid = await db
        .select({ id: categories.id, slug: categories.slug,isIncome:categories.isIncome })
        .from(categories)
        .where(
          and(
            inArray(categories.id, [...new Set(categoryIds)]),
            eq(categories.householdId, member.householdId),
          ),
        );
      if (valid.length !== new Set(categoryIds).size)
        throw new Error("Mindestens eine Kategorie wurde nicht gefunden.");
      selectedCategorySlug = body.categoryId ? valid.find((item) => item.id === body.categoryId)?.slug : undefined;
      const marksTransfer=selectedCategorySlug==="umbuchung";
      const intendedType=body.specialType??row.specialType;
      const expectsIncome=row.direction==="income"&&intendedType!=="refund";
      if(!marksTransfer&&valid.some(category=>category.isIncome!==expectsIncome))throw new Error(expectsIncome?"Einnahmen können nur einer Einnahmekategorie zugeordnet werden.":"Ausgaben und Erstattungen können nur einer Ausgabenkategorie zugeordnet werden.");
    }
    const categoryMarksTransfer = selectedCategorySlug === "umbuchung";
    const leavesTransferCategory = body.categoryId !== undefined && row.categorySlug === "umbuchung" && !categoryMarksTransfer;
    const effectiveSpecialType = body.specialType ?? (categoryMarksTransfer ? "transfer" : leavesTransferCategory ? "normal" : undefined);
    const effectiveLinkedTransactionId = body.linkedTransactionId !== undefined
      ? body.linkedTransactionId
      : effectiveSpecialType === "normal"
        ? null
        : row.linkedTransactionId;
    if (body.linkedTransactionId) {
      if (body.linkedTransactionId === body.id)
        throw new Error(
          "Ein Umsatz kann nicht mit sich selbst verknüpft werden.",
        );
      const [linked] = await db
        .select({ accountId: transactions.accountId,amount:transactions.amount,currency:transactions.currency,linkedTransactionId:transactions.linkedTransactionId })
        .from(transactions)
        .where(eq(transactions.id, body.linkedTransactionId))
        .limit(1);
      if (!linked || !accountIds.includes(linked.accountId))
        throw new Error("Die verknüpfte Buchung ist nicht sichtbar.");
      if(effectiveSpecialType==="transfer"&&!isBalancedTransfer(row,linked))throw new Error("Eine Umbuchung muss aus centgleichen Gegenbuchungen verschiedener Konten in derselben Währung bestehen.");
      if(effectiveSpecialType==="transfer"&&linked.linkedTransactionId&&linked.linkedTransactionId!==body.id)throw new Error("Die Gegenbuchung ist bereits mit einer anderen Umbuchung verknüpft.");
    }
    let transferCategoryId: string | null = categoryMarksTransfer ? body.categoryId ?? null : null;
    if (effectiveSpecialType === "transfer" && !transferCategoryId) {
      const [transferCategory] = await db.select({id:categories.id}).from(categories).where(and(eq(categories.householdId,member.householdId),eq(categories.slug,"umbuchung"))).limit(1);
      transferCategoryId = transferCategory?.id ?? null;
    }
    if (body.splits) {
      const splitTotalCents = body.splits.reduce((sum, split) => sum + Math.round(split.amount * 100), 0);
      const transactionCents = Math.round(Math.abs(Number(row.amount)) * 100);
      if (splitTotalCents !== transactionCents)
        throw new Error(
          `Die Aufteilung muss zusammen ${Math.abs(Number(row.amount)).toFixed(2)} € ergeben.`,
        );
    }
    await db.transaction(async (tx) => {
      await tx
        .update(transactions)
        .set({
          categoryId: body.splits ? null : effectiveSpecialType === "transfer" ? transferCategoryId : effectiveSpecialType === "normal" && body.categoryId === undefined && row.categorySlug === "umbuchung" ? null : body.categoryId,
          note: body.note,
          tags: body.tags,
          excludedFromAnalysis:
            effectiveSpecialType === "transfer" ? true : effectiveSpecialType === "normal" ? false : body.excluded,
          specialType: effectiveSpecialType,
          linkedTransactionId: effectiveLinkedTransactionId,
          isTransfer:effectiveSpecialType!==undefined?effectiveSpecialType==="transfer":undefined,
          transferPeerId:effectiveSpecialType==="transfer"?effectiveLinkedTransactionId:effectiveSpecialType!==undefined?null:undefined,
          updatedAt: new Date(),
          categorizedBy:
            body.categoryId !== undefined || body.splits ? "manual" : undefined,
          categorizationConfidence:
            body.categoryId !== undefined || body.splits ? "1.000" : undefined,
          aiReviewDeferredAt:
            body.deferAiReview === true
              ? new Date()
              : body.deferAiReview === false || body.categoryId !== undefined || body.splits
                ? null
                : undefined,
        })
        .where(eq(transactions.id, body.id));
      if(effectiveSpecialType==="transfer"&&effectiveLinkedTransactionId)await tx.update(transactions).set({categoryId:transferCategoryId,specialType:"transfer",excludedFromAnalysis:true,linkedTransactionId:body.id,isTransfer:true,transferPeerId:body.id,updatedAt:new Date()}).where(eq(transactions.id,effectiveLinkedTransactionId));
      if(row.linkedTransactionId&&(effectiveSpecialType!=="transfer"||row.linkedTransactionId!==effectiveLinkedTransactionId))await tx.update(transactions).set({categoryId:null,specialType:"normal",excludedFromAnalysis:false,linkedTransactionId:null,isTransfer:false,transferPeerId:null,updatedAt:new Date()}).where(and(eq(transactions.id,row.linkedTransactionId),eq(transactions.linkedTransactionId,body.id)));
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
    const learned = effectiveSpecialType !== "transfer" && body.categoryId !== undefined && !body.splits && body.ruleMode !== "none"
      ? await learnMerchantRule({
          householdId: member.householdId,
          ownerMemberId: member.id,
          visibleAccountIds: accountIds,
          sourceAccountId:row.accountId,
          merchant: row.counterparty,
          purpose: row.purpose,
          matchingKeyword: body.matchingKeyword,
          categoryId: body.categoryId ?? null,
          applyExisting: body.ruleMode === "all" ? "all" : "none",
        })
      : { learned: false, applied: 0 };
    await writeAudit("transaction-updated","Ein Umsatz wurde bearbeitet.",{userId:user.userId,metadata:{transactionId:body.id,accountId:row.accountId,categoryChanged:body.categoryId!==undefined,splitChanged:Boolean(body.splits),specialType:effectiveSpecialType,linkedTransactionId:effectiveLinkedTransactionId,ruleMode:body.ruleMode,deferAiReview:body.deferAiReview}});
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

const deleteSchema = z.object({ id: z.string().uuid() });
export async function DELETE(request: Request) {
  try {
    const user = await requireUser();
    const { accountIds } = await memberAndVisibleAccountIds(user.userId);
    const body = deleteSchema.parse(await request.json());
    const [row] = await db.select({ accountId: transactions.accountId, linkedTransactionId: transactions.linkedTransactionId }).from(transactions).where(eq(transactions.id, body.id)).limit(1);
    if (!row || !accountIds.includes(row.accountId)) throw new Error("Umsatz nicht sichtbar.");
    await db.transaction(async (tx) => {
      if (row.linkedTransactionId) await tx.update(transactions).set({ specialType:"normal", excludedFromAnalysis:false, linkedTransactionId:null, isTransfer:false, transferPeerId:null, updatedAt:new Date() }).where(and(eq(transactions.id,row.linkedTransactionId),eq(transactions.linkedTransactionId,body.id)));
      await tx.delete(transactions).where(eq(transactions.id, body.id));
    });
    await writeAudit("transaction-deleted","Eine bestätigte Umsatzdublette wurde gelöscht.",{userId:user.userId,metadata:{transactionId:body.id,accountId:row.accountId}});
    return NextResponse.json({ ok:true });
  } catch (error) {
    return NextResponse.json({ error:error instanceof Error?error.message:"Umsatz konnte nicht gelöscht werden." },{status:400});
  }
}
