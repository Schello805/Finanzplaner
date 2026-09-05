import { NextResponse } from "next/server";
import { and, count, eq, inArray, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { amazonOrderItems, categories, categorizationRules, transactions, transactionSplits } from "@/db/schema";
import { requireUser } from "@/lib/current-user";
import { memberAndVisibleAccountIds } from "@/lib/visible-accounts";
import { writeAudit } from "@/lib/audit";
export async function GET() {
  try {
    const user = await requireUser();
    const { member } = await memberAndVisibleAccountIds(user.userId);
    const rows = await db
      .select()
      .from(categories)
      .where(
        or(
          eq(categories.householdId, member.householdId),
          isNull(categories.householdId),
        ),
      );
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof Error
            ? e.message
            : "Kategorien konnten nicht geladen werden.",
      },
      { status: 400 },
    );
  }
}
const categorySchema = z.object({
  name: z.string().trim().min(2).max(60),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  icon: z.string().trim().min(1).max(40).default("Tag"),
  isIncome: z.boolean().default(false),
  parentId: z.string().uuid().nullable().optional(),
});
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const { member } = await memberAndVisibleAccountIds(user.userId);
    const body = categorySchema.parse(await request.json());
    if (body.parentId) {
      const [parent] = await db
        .select()
        .from(categories)
        .where(
          and(
            eq(categories.id, body.parentId),
            eq(categories.householdId, member.householdId),
          ),
        )
        .limit(1);
      if (!parent) throw new Error("Übergeordnete Kategorie nicht gefunden.");
    }
    const slug = `${body.name
      .toLocaleLowerCase("de-DE")
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")}-${Date.now().toString(36)}`;
    const [row] = await db
      .insert(categories)
      .values({
        householdId: member.householdId,
        name: body.name,
        slug,
        color: body.color,
        icon: body.icon,
        isIncome: body.isIncome,
        parentId: body.parentId ?? null,
      })
      .returning();
    await writeAudit("configuration", "Eine Kategorie wurde angelegt.", {
      userId: user.userId,
      metadata: { categoryId: row.id, name: row.name },
    });
    return NextResponse.json(row, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Kategorie konnte nicht angelegt werden.",
      },
      { status: 400 },
    );
  }
}
const updateSchema = categorySchema.extend({ id: z.string().uuid() });
export async function PUT(request: Request) {
  try {
    const user = await requireUser();
    const { member } = await memberAndVisibleAccountIds(user.userId);
    const body = updateSchema.parse(await request.json());
    if (body.parentId === body.id)
      throw new Error(
        "Eine Kategorie kann nicht sich selbst untergeordnet werden.",
      );
    const [row] = await db
      .update(categories)
      .set({
        name: body.name,
        color: body.color,
        icon: body.icon,
        isIncome: body.isIncome,
        parentId: body.parentId ?? null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(categories.id, body.id),
          eq(categories.householdId, member.householdId),
        ),
      )
      .returning();
    if (!row) throw new Error("Kategorie nicht gefunden.");
    await writeAudit("configuration", "Eine Kategorie wurde geändert.", {
      userId: user.userId,
      metadata: { categoryId: row.id, name: row.name },
    });
    return NextResponse.json(row);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Kategorie konnte nicht gespeichert werden.",
      },
      { status: 400 },
    );
  }
}

const deleteSchema = z.object({
  id: z.string().uuid(),
  resolution: z.enum(["move", "uncategorize"]).optional(),
  replacementCategoryId: z.string().uuid().nullable().optional(),
});
export async function DELETE(request: Request) {
  try {
    const user = await requireUser();
    const { member } = await memberAndVisibleAccountIds(user.userId);
    const body = deleteSchema.parse(await request.json());
    const [target] = await db.select().from(categories).where(and(eq(categories.id, body.id), eq(categories.householdId, member.householdId))).limit(1);
    if (!target) throw new Error("Kategorie nicht gefunden.");
    const [[direct], [split], [amazon], [rules], [children]] = await Promise.all([
      db.select({ value: count() }).from(transactions).where(eq(transactions.categoryId, target.id)),
      db.select({ value: count() }).from(transactionSplits).where(eq(transactionSplits.categoryId, target.id)),
      db.select({ value: count() }).from(amazonOrderItems).where(eq(amazonOrderItems.categoryId, target.id)),
      db.select({ value: count() }).from(categorizationRules).where(eq(categorizationRules.categoryId, target.id)),
      db.select({ value: count() }).from(categories).where(eq(categories.parentId, target.id)),
    ]);
    const impact = { transactions: Number(direct.value), splits: Number(split.value), amazonItems: Number(amazon.value), rules: Number(rules.value), childCategories: Number(children.value) };
    const hasUsage = Object.values(impact).some((value) => value > 0);
    if (hasUsage && !body.resolution) return NextResponse.json({ requiresDecision: true, impact }, { status: 409 });
    let replacementId: string | null = null;
    if (body.resolution === "move") {
      if (!body.replacementCategoryId || body.replacementCategoryId === target.id) throw new Error("Bitte eine andere Zielkategorie auswählen.");
      const [replacement] = await db.select({ id: categories.id }).from(categories).where(and(eq(categories.id, body.replacementCategoryId), eq(categories.householdId, member.householdId))).limit(1);
      if (!replacement) throw new Error("Zielkategorie nicht gefunden.");
      replacementId = replacement.id;
    }
    await db.transaction(async (tx) => {
      const affectedSplits = await tx.select({ transactionId: transactionSplits.transactionId }).from(transactionSplits).where(eq(transactionSplits.categoryId, target.id));
      if (replacementId) {
        await tx.update(transactions).set({ categoryId: replacementId, updatedAt: new Date() }).where(eq(transactions.categoryId, target.id));
        await tx.update(transactionSplits).set({ categoryId: replacementId }).where(eq(transactionSplits.categoryId, target.id));
        await tx.update(amazonOrderItems).set({ categoryId: replacementId, updatedAt: new Date() }).where(eq(amazonOrderItems.categoryId, target.id));
        await tx.update(categorizationRules).set({ categoryId: replacementId, updatedAt: new Date() }).where(eq(categorizationRules.categoryId, target.id));
      } else {
        await tx.update(transactions).set({ categoryId: null, categorizedBy: null, categorizationConfidence: null, updatedAt: new Date() }).where(eq(transactions.categoryId, target.id));
        if (affectedSplits.length) {
          const ids = [...new Set(affectedSplits.map((row) => row.transactionId))];
          await tx.delete(transactionSplits).where(inArray(transactionSplits.transactionId, ids));
          await tx.update(transactions).set({ categoryId: null, categorizedBy: null, categorizationConfidence: null, updatedAt: new Date() }).where(inArray(transactions.id, ids));
        }
        await tx.update(amazonOrderItems).set({ categoryId: null, updatedAt: new Date() }).where(eq(amazonOrderItems.categoryId, target.id));
        await tx.delete(categorizationRules).where(eq(categorizationRules.categoryId, target.id));
      }
      await tx.update(categories).set({ parentId: null, updatedAt: new Date() }).where(eq(categories.parentId, target.id));
      await tx.delete(categories).where(eq(categories.id, target.id));
    });
    await writeAudit("configuration", "Eine Kategorie wurde gelöscht.", { userId: user.userId, metadata: { categoryId: target.id, name: target.name, resolution: replacementId ? "move" : "uncategorize", ...impact } });
    return NextResponse.json({ ok: true, impact });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Kategorie konnte nicht gelöscht werden." }, { status: 400 });
  }
}
