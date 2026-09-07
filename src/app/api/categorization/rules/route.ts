import { NextResponse } from "next/server";
import { and, eq, inArray, notExists, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { accounts, categorizationRules, categories, transactions, transactionSplits } from "@/db/schema";
import { requireUser } from "@/lib/current-user";
import { memberAndVisibleAccountIds } from "@/lib/visible-accounts";
import { writeAudit } from "@/lib/audit";
import { COMPOUND_RULE_FIELD, compoundRuleLabel, matchesCompoundRule, parseCompoundRule } from "@/features/categorization/compound-rules";

const updateSchema = z.object({ id: z.string().uuid(), categoryId: z.string().uuid().optional(), enabled: z.boolean().optional(), shared: z.boolean().optional(), applyToExisting: z.boolean().default(false) });
const deleteSchema = z.object({ id: z.string().uuid() });

export async function GET() {
  try {
    const user = await requireUser();
    const { member, accountIds } = await memberAndVisibleAccountIds(user.userId);
    const rows = await db.select({ id: categorizationRules.id, field:categorizationRules.field, operator:categorizationRules.operator, value: categorizationRules.value, accountId:categorizationRules.accountId,accountName:accounts.name,categoryId: categorizationRules.categoryId, categoryName: categories.name, enabled: categorizationRules.enabled, shared: categorizationRules.shared, ownerMemberId: categorizationRules.ownerMemberId, updatedAt: categorizationRules.updatedAt })
      .from(categorizationRules).innerJoin(categories, eq(categorizationRules.categoryId, categories.id)).leftJoin(accounts,eq(categorizationRules.accountId,accounts.id))
      .where(and(eq(categorizationRules.householdId, member.householdId), or(eq(categorizationRules.shared,true),and(eq(categorizationRules.ownerMemberId,member.id),accountIds.length?inArray(categorizationRules.accountId,accountIds):sql`false`))));
    const transactionRows = accountIds.length ? await db.select({accountId:transactions.accountId,merchant:transactions.counterparty,counterpartyNormalized:transactions.counterpartyNormalized,purpose:transactions.purpose}).from(transactions).where(inArray(transactions.accountId,accountIds)) : [];
    const conflicts=new Set(rows.filter(row=>rows.some(other=>other.id!==row.id&&other.value===row.value&&other.categoryId!==row.categoryId&&(row.shared||other.shared))).map(row=>row.value));
    return NextResponse.json(rows.map((row) => { const compound=row.field===COMPOUND_RULE_FIELD?parseCompoundRule(row.value):null; const matchedTransactions=transactionRows.filter(transaction=>(row.shared||transaction.accountId===row.accountId)&&(compound?matchesCompoundRule(compound,transaction):transaction.counterpartyNormalized===row.value)).length; return { ...row,displayValue:row.field===COMPOUND_RULE_FIELD?compoundRuleLabel(row.value):row.value,ruleKind:row.field===COMPOUND_RULE_FIELD?"Händler + Buchungstext":"Händler",accountName:row.shared?null:row.accountName,conflict:conflicts.has(row.value),matchedTransactions,editable:row.ownerMemberId===member.id }; }));
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
    await db.update(categorizationRules).set({ categoryId: body.categoryId, enabled: body.enabled, shared: member.kind==="adult"?body.shared:false, updatedAt: new Date() }).where(eq(categorizationRules.id, rule.id));
    let applied = 0;
    const categoryId = body.categoryId ?? rule.categoryId;
    if (body.applyToExisting && accountIds.length) {
      const targetIds=body.shared?accountIds:rule.accountId&&accountIds.includes(rule.accountId)?[rule.accountId]:[];
      if (targetIds.length && rule.field===COMPOUND_RULE_FIELD) {
        const compound=parseCompoundRule(rule.value);
        const candidates=compound?await db.select({id:transactions.id,merchant:transactions.counterparty,purpose:transactions.purpose}).from(transactions).where(and(inArray(transactions.accountId,targetIds),notExists(db.select({id:transactionSplits.id}).from(transactionSplits).where(eq(transactionSplits.transactionId,transactions.id))))):[];
        const ids=compound?candidates.filter(row=>matchesCompoundRule(compound,row)).map(row=>row.id):[];
        if(ids.length)await db.update(transactions).set({categoryId,categorizedBy:"local-rule",categorizationConfidence:"1.000",updatedAt:new Date()}).where(inArray(transactions.id,ids));
        applied=ids.length;
      } else {
        const changed = targetIds.length?await db.update(transactions).set({ categoryId, categorizedBy: "local-rule", categorizationConfidence: "1.000", updatedAt: new Date() }).where(and(inArray(transactions.accountId, targetIds), eq(transactions.counterpartyNormalized, rule.value), notExists(db.select({ id: transactionSplits.id }).from(transactionSplits).where(eq(transactionSplits.transactionId, transactions.id))))).returning({ id: transactions.id }):[];
        applied = changed.length;
      }
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
