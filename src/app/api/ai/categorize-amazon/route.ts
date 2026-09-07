import { NextRequest, NextResponse } from "next/server";
import { and, count, eq, inArray, isNull, notInArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { aiUsage, amazonOrderItems, categories, systemSettings, userPreferences } from "@/db/schema";
import { categorizeWithAi, estimateCost, resolveModelPrice } from "@/features/ai/provider";
import type { AiTransactionInput } from "@/features/ai/types";
import { writeAudit } from "@/lib/audit";
import { requireUser } from "@/lib/current-user";
import { decryptSecret } from "@/lib/security";
import { memberAndVisibleAccountIds } from "@/lib/visible-accounts";
import { isForbiddenCategoryName, normalizeCategoryName } from "@/features/categories/policy";

const BATCH_SIZE = 25;
type ProviderConfig = { model: string; inputPricePerMillion?: number; outputPricePerMillion?: number };
const threshold = (level: "none" | "very_safe" | "likely" | null | undefined) => level === "likely" ? 0.7 : level === "very_safe" ? 0.9 : 1.01;

async function aiSettings() {
  const rows = await db.select().from(systemSettings);
  const provider = ((rows.find((row) => row.key === "ai.default")?.valueJson as { provider?: "openai" | "gemini" } | null)?.provider ?? "openai");
  const row = rows.find((item) => item.key === `ai.${provider}`);
  if (!row?.valueEncrypted) throw new Error(`${provider === "openai" ? "OpenAI" : "Gemini"} ist nicht vollständig eingerichtet.`);
  return { provider, apiKey: decryptSecret(row.valueEncrypted), config: row.valueJson as ProviderConfig };
}

async function pending(userId: string, ids?: string[], excludedIds: string[] = []) {
  const { member } = await memberAndVisibleAccountIds(userId);
  const base = [eq(amazonOrderItems.ownerMemberId, member.id), isNull(amazonOrderItems.categoryId)];
  const [{ value: total }] = await db.select({ value: count() }).from(amazonOrderItems).where(and(...base));
  const filters = [...base];
  if (ids) filters.push(inArray(amazonOrderItems.id, ids));
  else if (excludedIds.length) filters.push(notInArray(amazonOrderItems.id, excludedIds));
  const databaseRows = await db.select({ id: amazonOrderItems.id, date: amazonOrderItems.orderDate, amount: amazonOrderItems.unitPrice, tax: amazonOrderItems.unitTax, quantity: amazonOrderItems.quantity, currency: amazonOrderItems.currency, productName: amazonOrderItems.productNameEncrypted, department: amazonOrderItems.department }).from(amazonOrderItems).where(and(...filters)).limit(ids ? 100 : BATCH_SIZE);
  const rows = databaseRows.map((row) => ({
    id: row.id,
    date: row.date,
    amount: -Math.abs((Number(row.amount) + Number(row.tax)) * Number(row.quantity)),
    currency: row.currency,
    bookingType: "Amazon-Artikel",
    merchant: "Amazon",
    purpose: `${decryptSecret(row.productName)}${row.department ? ` · Bereich: ${row.department}` : ""}`,
  } satisfies AiTransactionInput));
  return { member, total, rows };
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const excludedIds = (request.nextUrl.searchParams.get("exclude") ?? "").split(",").filter((id) => z.string().uuid().safeParse(id).success).slice(0, 1000);
    const { rows, total } = await pending(user.userId, undefined, excludedIds);
    if (!rows.length) return NextResponse.json({ available: true, count: total, batchSize: 0, items: [] });
    const ai = await aiSettings();
    const price = resolveModelPrice(ai.provider, ai.config.model, ai.config);
    return NextResponse.json({ available: true, count: total, batchSize: rows.length, totalRounds: Math.ceil(total / BATCH_SIZE), remainingAfterBatch: Math.max(0, total - excludedIds.length - rows.length), provider: ai.provider, model: ai.config.model, items: rows.map(({ id }) => ({ id })), cost: price ? estimateCost(rows, price, Math.max(300, rows.length * 80)) : null });
  } catch (error) {
    return NextResponse.json({ available: false, error: error instanceof Error ? error.message : "Amazon-KI-Vorschau fehlgeschlagen." }, { status: 400 });
  }
}

const postSchema = z.object({ ids: z.array(z.string().uuid()).min(1).max(100) });
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = postSchema.parse(await request.json());
    const { member, rows } = await pending(user.userId, body.ids);
    if (!rows.length) throw new Error("Keine offenen Amazon-Artikel gefunden.");
    const ai = await aiSettings();
    const allowed = await db.select({ id: categories.id, name: categories.name }).from(categories).where(and(eq(categories.householdId, member.householdId), eq(categories.isIncome, false)));
    const result = await categorizeWithAi({ provider: ai.provider, apiKey: ai.apiKey, model: ai.config.model }, rows, allowed.map((category) => category.name));
    const byName = new Map(allowed.map((category) => [normalizeCategoryName(category.name), category.id]));
    const [preferences] = await db.select({ level: userPreferences.aiAutoAcceptLevel }).from(userPreferences).where(eq(userPreferences.userId, user.userId)).limit(1);
    const autoThreshold = threshold(preferences?.level as "none" | "very_safe" | "likely" | undefined);
    const suggestions: Array<{ id: string; categoryId: string; category: string; confidence: number; reason: string }> = [];
    const categoryProposals: Array<{ id: string; name: string; confidence: number; reason: string }> = [];
    let applied = 0;
    for (const item of result.data.results) {
      if (!body.ids.includes(item.id)) continue;
      const categoryId = item.category ? byName.get(normalizeCategoryName(item.category)) : undefined;
      if (!categoryId) {
        const name = (item.proposedCategory ?? item.category)?.trim();
        if (name && !isForbiddenCategoryName(name) && !/^(andere?s?|diverses)$/i.test(name)) categoryProposals.push({ id: item.id, name, confidence: item.confidence, reason: item.reason });
      } else if (item.confidence >= autoThreshold) {
        const updated = await db.update(amazonOrderItems).set({ categoryId, updatedAt: new Date() }).where(and(eq(amazonOrderItems.id, item.id), eq(amazonOrderItems.ownerMemberId, member.id), isNull(amazonOrderItems.categoryId))).returning({ id: amazonOrderItems.id });
        applied += updated.length;
      } else suggestions.push({ id: item.id, categoryId, category: item.category!, confidence: item.confidence, reason: item.reason });
    }
    const price = resolveModelPrice(ai.provider, ai.config.model, ai.config);
    const estimatedCostEur = price ? result.usage.inputTokens * price.inputPerMillion / 1_000_000 + result.usage.outputTokens * price.outputPerMillion / 1_000_000 : null;
    await db.insert(aiUsage).values({ householdId: member.householdId, userId: user.userId, provider: ai.provider, model: ai.config.model, purpose: "amazon-categorization", inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens, estimatedCostEur: estimatedCostEur?.toFixed(6) });
    await writeAudit("ai", "Amazon-Artikel wurden mit KI kategorisiert.", { userId: user.userId, metadata: { count: rows.length, applied, suggestions: suggestions.length, provider: ai.provider } });
    return NextResponse.json({ applied, suggestions, categoryProposals, analyzedIds: body.ids, usage: result.usage, estimatedCostEur, pricingAvailable: Boolean(price) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Amazon-KI-Kategorisierung fehlgeschlagen." }, { status: 400 });
  }
}
