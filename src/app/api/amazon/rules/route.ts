import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { amazonItemRules, amazonOrderItems, categories } from "@/db/schema";
import {
  matchingProductRule,
  normalizeProductPattern,
  type AmazonProductRule,
} from "@/features/amazon/product-rules";
import { writeAudit } from "@/lib/audit";
import { requireUser } from "@/lib/current-user";
import { decryptSecret, encryptSecret } from "@/lib/security";
import { memberAndVisibleAccountIds } from "@/lib/visible-accounts";

const ruleSchema = z.object({
  pattern: z.string().trim().min(2).max(300),
  categoryId: z.string().uuid(),
});

const importSchema = z.object({
  rules: z
    .array(
      z.object({
        pattern: z.string().trim().min(2).max(300),
        category: z.string().trim().min(1).max(120),
      }),
    )
    .max(5000),
});

const deleteSchema = z.object({ id: z.string().uuid() });

async function getContext(userId: string) {
  const { member } = await memberAndVisibleAccountIds(userId);
  const categoryRows = await db
    .select({
      id: categories.id,
      name: categories.name,
      parentId: categories.parentId,
      isIncome: categories.isIncome,
    })
    .from(categories)
    .where(eq(categories.householdId, member.householdId));

  return { member, categoryRows };
}

async function getDecryptedRules(memberId: string): Promise<AmazonProductRule[]> {
  const rows = await db
    .select()
    .from(amazonItemRules)
    .where(eq(amazonItemRules.ownerMemberId, memberId));

  return rows.map((row) => ({
    id: row.id,
    pattern: decryptSecret(row.patternEncrypted),
    categoryId: row.categoryId,
    enabled: row.enabled,
  }));
}

async function applyRulesToExistingItems(memberId: string) {
  const [rules, items] = await Promise.all([
    getDecryptedRules(memberId),
    db
      .select({
        id: amazonOrderItems.id,
        name: amazonOrderItems.productNameEncrypted,
      })
      .from(amazonOrderItems)
      .where(eq(amazonOrderItems.ownerMemberId, memberId)),
  ]);

  const idsByCategory = new Map<string, string[]>();
  for (const item of items) {
    const match = matchingProductRule(rules, decryptSecret(item.name));
    if (!match) continue;
    idsByCategory.set(match.categoryId, [
      ...(idsByCategory.get(match.categoryId) ?? []),
      item.id,
    ]);
  }

  let matched = 0;
  for (const [categoryId, ids] of idsByCategory) {
    for (let offset = 0; offset < ids.length; offset += 500) {
      const part = ids.slice(offset, offset + 500);
      await db
        .update(amazonOrderItems)
        .set({
          categoryId,
          aiSuggestedCategoryId: null,
          aiSuggestedCategoryName: null,
          aiSuggestionConfidence: null,
          aiSuggestionReason: null,
          aiAnalyzedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(amazonOrderItems.ownerMemberId, memberId),
            inArray(amazonOrderItems.id, part),
          ),
        );
      matched += part.length;
    }
  }

  return matched;
}

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { member, categoryRows } = await getContext(user.userId);
    const [rules, itemRows] = await Promise.all([
      getDecryptedRules(member.id),
      db
        .select({
          id: amazonOrderItems.id,
          name: amazonOrderItems.productNameEncrypted,
          categoryId: amazonOrderItems.categoryId,
        })
        .from(amazonOrderItems)
        .where(eq(amazonOrderItems.ownerMemberId, member.id)),
    ]);

    const url = new URL(request.url);
    const search = normalizeProductPattern(url.searchParams.get("search") ?? "");
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
    const catalog = new Map<
      string,
      {
        id: string;
        name: string;
        categoryId: string | null;
        rule: AmazonProductRule | null;
        occurrences: number;
      }
    >();

    for (const item of itemRows) {
      const name = decryptSecret(item.name);
      const key = normalizeProductPattern(name);
      const known = catalog.get(key);
      if (known) {
        known.occurrences += 1;
        continue;
      }
      catalog.set(key, {
        id: item.id,
        name,
        categoryId: item.categoryId,
        rule: matchingProductRule(rules, name),
        occurrences: 1,
      });
    }

    const filteredItems = [...catalog.values()]
      .filter((item) => !search || normalizeProductPattern(item.name).includes(search))
      .sort((a, b) => a.name.localeCompare(b.name, "de"));
    const pageSize = 100;

    return NextResponse.json({
      rules,
      categories: categoryRows,
      items: filteredItems.slice((page - 1) * pageSize, page * pageSize),
      total: filteredItems.length,
      page,
      pageSize,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Artikelregeln konnten nicht geladen werden." },
      { status: 400 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const { member, categoryRows } = await getContext(user.userId);
    const raw: unknown = await request.json();

    if (typeof raw === "object" && raw !== null && "rules" in raw) {
      const body = importSchema.parse(raw);
      const expenseCategoriesByName = new Map<string, string[]>();
      for (const category of categoryRows.filter((item) => !item.isIncome)) {
        const key = normalizeProductPattern(category.name);
        expenseCategoriesByName.set(key, [
          ...(expenseCategoriesByName.get(key) ?? []),
          category.id,
        ]);
      }

      const existingByPattern = new Map(
        (await getDecryptedRules(member.id)).map((rule) => [
          normalizeProductPattern(rule.pattern),
          rule,
        ]),
      );
      let imported = 0;
      let skipped = 0;

      for (const entry of body.rules) {
        const categoryIds = expenseCategoriesByName.get(
          normalizeProductPattern(entry.category),
        );
        // Mehrdeutige oder fehlende Kategorien werden nie automatisch erzeugt/geraten.
        if (!categoryIds || categoryIds.length !== 1) {
          skipped += 1;
          continue;
        }

        const patternKey = normalizeProductPattern(entry.pattern);
        const duplicate = existingByPattern.get(patternKey);
        if (duplicate) {
          await db
            .update(amazonItemRules)
            .set({ categoryId: categoryIds[0], enabled: true, updatedAt: new Date() })
            .where(eq(amazonItemRules.id, duplicate.id));
          duplicate.categoryId = categoryIds[0];
          duplicate.enabled = true;
        } else {
          const [created] = await db
            .insert(amazonItemRules)
            .values({
              householdId: member.householdId,
              ownerMemberId: member.id,
              patternEncrypted: encryptSecret(entry.pattern),
              categoryId: categoryIds[0],
            })
            .returning({ id: amazonItemRules.id });
          existingByPattern.set(patternKey, {
            id: created.id,
            pattern: entry.pattern,
            categoryId: categoryIds[0],
            enabled: true,
          });
        }
        imported += 1;
      }

      const matched = await applyRulesToExistingItems(member.id);
      await writeAudit("configuration", "Amazon-Artikelregeln wurden importiert.", {
        userId: user.userId,
        metadata: { imported, skipped, matched },
      });
      return NextResponse.json({ imported, skipped, matched });
    }

    const body = ruleSchema.parse(raw);
    if (!categoryRows.some((category) => category.id === body.categoryId && !category.isIncome)) {
      throw new Error("Ausgabenkategorie nicht gefunden.");
    }

    const existingRules = await getDecryptedRules(member.id);
    const duplicate = existingRules.find(
      (rule) =>
        normalizeProductPattern(rule.pattern) === normalizeProductPattern(body.pattern),
    );
    let id: string;

    if (duplicate) {
      id = duplicate.id;
      await db
        .update(amazonItemRules)
        .set({ categoryId: body.categoryId, enabled: true, updatedAt: new Date() })
        .where(eq(amazonItemRules.id, id));
    } else {
      const [created] = await db
        .insert(amazonItemRules)
        .values({
          householdId: member.householdId,
          ownerMemberId: member.id,
          patternEncrypted: encryptSecret(body.pattern),
          categoryId: body.categoryId,
        })
        .returning({ id: amazonItemRules.id });
      id = created.id;
    }

    // Immer alle Regeln neu auswerten, damit exakte/längere Regeln Vorrang behalten.
    const matched = await applyRulesToExistingItems(member.id);
    await writeAudit("configuration", "Eine Amazon-Artikelregel wurde gespeichert.", {
      userId: user.userId,
      metadata: { ruleId: id, matched },
    });
    return NextResponse.json({ id, matched });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Artikelregel konnte nicht gespeichert werden." },
      { status: 400 },
    );
  }
}

export async function PUT() {
  try {
    const user = await requireUser();
    const { member } = await memberAndVisibleAccountIds(user.userId);
    const matched = await applyRulesToExistingItems(member.id);
    await writeAudit("configuration", "Amazon-Artikelregeln wurden erneut angewendet.", {
      userId: user.userId,
      metadata: { matched },
    });
    return NextResponse.json({ matched });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Regeln konnten nicht angewendet werden." },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireUser();
    const { member } = await memberAndVisibleAccountIds(user.userId);
    const body = deleteSchema.parse(await request.json());
    const deleted = await db
      .delete(amazonItemRules)
      .where(
        and(
          eq(amazonItemRules.id, body.id),
          eq(amazonItemRules.ownerMemberId, member.id),
        ),
      )
      .returning({ id: amazonItemRules.id });

    if (!deleted.length) throw new Error("Regel nicht gefunden.");
    await writeAudit("configuration", "Eine Amazon-Artikelregel wurde gelöscht.", {
      userId: user.userId,
      metadata: { ruleId: body.id },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Regel konnte nicht gelöscht werden." },
      { status: 400 },
    );
  }
}
