import { NextResponse } from "next/server";
import { and, eq, inArray, notExists, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { categorizationRules, categories, transactions, transactionSplits } from "@/db/schema";
import { requireUser } from "@/lib/current-user";
import { memberAndVisibleAccountIds } from "@/lib/visible-accounts";
import { writeAudit } from "@/lib/audit";

const updateSchema = z.object({ id: z.string().uuid(), categoryId: z.string().uuid().optional(), enabled: z.boolean().optional(), shared: z.boolean().optional(), applyToExisting: z.boolean().default(false) });
const deleteSchema = z.object({ id: z.string().uuid() });

export async function GET() {
  try {
    const user = await requireUser();
    const { member, accountIds } = await memberAndVisibleAccountIds(user.userId);
    const rows = await db.select({ id: categorizationRules.id, value: categorizationRules.value, categoryId: categorizationRules.categoryId, categoryName: categories.name, enabled: categorizationRules.enabled, shared: categorizationRules.shared, ownerMemberId: categorizationRules.ownerMemberId, updatedAt: categorizationRules.updatedAt })
      .from(categorizationRules).innerJoin(categories, eq(categorizationRules.categoryId, categories.id))
      .where(and(eq(categorizationRules.householdId, member.householdId), sql`(${categorizationRules.ownerMemberId} = ${member.id} or ${categorizationRules.shared} = true)`));
    const counts = accountIds.length ? await db.select({ value: transactions.counterpartyNormalized, count: sql<number>`count(*)::int` }).from(transactions).where(inArray(transactions.accountId, accountIds)).groupBy(transactions.counterpartyNormalized) : [];
    const countMap = new Map(counts.map((row) => [row.value, row.count]));
    return NextResponse.json(rows.map((row) => ({ ...row, matchedTransactions: countMap.get(row.value) ?? 0, editable: row.ownerMemberId === member.id })));
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Regeln konnten nicht geladen werden." }, { status: 400 }); }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    const { member, accountIds } = await memberAndVisibleAccountIds(user.userId);
    const body = updateSchema.parse(await request.json());
    const [rule] = await db.select().from(categorizationRules).where(and(eq(categorizationRules.id, body.id), eq(categorizationRules.ownerMemberId, member.id))).limit(1);
    if (!rule) throw new Error("Regel nicht gefunden oder nicht bearbeitbar.");
    if (body.categoryId) {
      const [category] = await db.select({ id: categories.id }).from(categories).where(and(eq(categories.id, body.categoryId), eq(categories.householdId, member.householdId))).limit(1);
      if (!category) throw new Error("Kategorie nicht gefunden.");
    }
    await db.update(categorizationRules).set({ categoryId: body.categoryId, enabled: body.enabled, shared: body.shared, updatedAt: new Date() }).where(eq(categorizationRules.id, rule.id));
    let applied = 0;
    const categoryId = body.categoryId ?? rule.categoryId;
    if (body.applyToExisting && accountIds.length) {
      const changed = await db.update(transactions).set({ categoryId, categorizedBy: "local-rule", categorizationConfidence: "1.000", updatedAt: new Date() }).where(and(inArray(transactions.accountId, accountIds), eq(transactions.counterpartyNormalized, rule.value), notExists(db.select({ id: transactionSplits.id }).from(transactionSplits).where(eq(transactionSplits.transactionId, transactions.id))))).returning({ id: transactions.id });
      applied = changed.length;
    }
    await writeAudit("configuration", "Eine Zuordnungsregel wurde geändert.", { userId: user.userId, metadata: { ruleId: rule.id, applied } });
    return NextResponse.json({ ok: true, applied });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Regel konnte nicht geändert werden." }, { status: 400 }); }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireUser();
    const { member } = await memberAndVisibleAccountIds(user.userId);
    const body = deleteSchema.parse(await request.json());
    const deleted = await db.delete(categorizationRules).where(and(eq(categorizationRules.id, body.id), eq(categorizationRules.ownerMemberId, member.id))).returning({ id: categorizationRules.id });
    if (!deleted.length) throw new Error("Regel nicht gefunden oder nicht bearbeitbar.");
    await writeAudit("configuration", "Eine Zuordnungsregel wurde gelöscht.", { userId: user.userId, metadata: { ruleId: body.id } });
    return NextResponse.json({ ok: true });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Regel konnte nicht gelöscht werden." }, { status: 400 }); }
}
