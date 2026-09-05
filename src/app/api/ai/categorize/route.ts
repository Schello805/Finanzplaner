import { NextRequest, NextResponse } from "next/server";
import { and, count, eq, inArray, isNull, notExists } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { aiUsage, categories, systemSettings, transactions, transactionSplits, userPreferences } from "@/db/schema";
import { buildTransferPreview } from "@/features/ai/privacy";
import { categorizeWithAi, estimateCost } from "@/features/ai/provider";
import type { AiTransactionInput } from "@/features/ai/types";
import { writeAudit } from "@/lib/audit";
import { requireUser } from "@/lib/current-user";
import { decryptSecret } from "@/lib/security";
import { memberAndVisibleAccountIds } from "@/lib/visible-accounts";
import { learnMerchantRule, normalizeMerchant } from "@/features/categorization/merchant-rules";
type ProviderConfig = {
  model: string;
  inputPricePerMillion?: number;
  outputPricePerMillion?: number;
};
const AUTO_APPLY_CONFIDENCE = 0.75;
const AI_BATCH_SIZE = 25;
class AiConfigurationError extends Error {}
async function settings() {
  const rows = await db.select().from(systemSettings);
  const provider =
    (
      rows.find((r) => r.key === "ai.default")?.valueJson as {
        provider?: "openai" | "gemini";
      }
    )?.provider ?? "openai";
  const row = rows.find((r) => r.key === `ai.${provider}`);
  if (!row?.valueEncrypted)
    throw new AiConfigurationError(
      `${provider === "openai" ? "OpenAI" : "Gemini"} ist nicht vollständig eingerichtet.`,
    );
  try {
    return {
      provider,
      row,
      config: row.valueJson as unknown as ProviderConfig,
      apiKey: decryptSecret(row.valueEncrypted),
    };
  } catch {
    throw new AiConfigurationError(
      `${provider === "openai" ? "OpenAI" : "Gemini"} muss im Adminbereich erneut eingerichtet werden, weil der gespeicherte API-Schlüssel nicht mehr gelesen werden kann.`,
    );
  }
}
async function pending(userId: string, ids?: string[]) {
  const { member, accountIds } = await memberAndVisibleAccountIds(userId);
  if (!accountIds.length) return { member, rows: [], total: 0 };
  const baseFilters = [
    inArray(transactions.accountId, accountIds),
    isNull(transactions.categoryId),
    notExists(
      db
        .select({ id: transactionSplits.transactionId })
        .from(transactionSplits)
        .where(eq(transactionSplits.transactionId, transactions.id)),
    ),
  ];
  const [{ value: total }] = await db
    .select({ value: count() })
    .from(transactions)
    .where(and(...baseFilters));
  const filters = [...baseFilters];
  if (ids) filters.push(inArray(transactions.id, ids));
  const rows = await db
    .select({
      id: transactions.id,
      date: transactions.bookedOn,
      amount: transactions.amount,
      currency: transactions.currency,
      bookingType: transactions.bookingType,
      merchant: transactions.counterparty,
      purpose: transactions.purpose,
    })
    .from(transactions)
    .where(and(...filters))
    .limit(ids ? 100 : AI_BATCH_SIZE);
  return {
    member,
    total,
    rows: rows.map(
      (r) =>
        ({
          id: r.id,
          date: r.date,
          amount: Number(r.amount),
          currency: r.currency,
          bookingType: r.bookingType ?? undefined,
          merchant: r.merchant ?? undefined,
          purpose: r.purpose ?? undefined,
        }) satisfies AiTransactionInput,
    ),
  };
}
export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const mode =
      request.nextUrl.searchParams.get("privacyMode") === "full_text"
        ? "full_text"
        : "minimal";
    const { rows, total } = await pending(user.userId);
    if (!rows.length) return NextResponse.json({ count: 0, transactions: [] });
    let ai: Awaited<ReturnType<typeof settings>>;
    try {
      ai = await settings();
    } catch (error) {
      if (error instanceof AiConfigurationError) {
        return NextResponse.json({
          available: false,
          count: total,
          transactions: [],
          error: error.message,
        });
      }
      throw error;
    }
    const preview = buildTransferPreview(rows, mode);
    const price = {
      inputPerMillion: ai.config.inputPricePerMillion ?? 0,
      outputPerMillion: ai.config.outputPricePerMillion ?? 0,
    };
    return NextResponse.json({
      available: true,
      count: total,
      batchSize: rows.length,
      provider: ai.provider,
      model: ai.config.model,
      privacyMode: mode,
      transactions: preview,
      cost: estimateCost(preview, price, Math.max(300, rows.length * 80)),
    });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof Error
            ? e.message
            : "KI-Vorschau konnte nicht erstellt werden.",
      },
      { status: 400 },
    );
  }
}
const postSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
  privacyMode: z.enum(["minimal", "full_text"]),
});
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = postSchema.parse(await request.json());
    const { member, rows } = await pending(user.userId, body.ids);
    if (!rows.length)
      throw new Error("Keine nicht zugeordneten Umsätze gefunden.");
    const ai = await settings();
    const preview = buildTransferPreview(rows, body.privacyMode);
    const allowed = await db
      .select({ id: categories.id, name: categories.name })
      .from(categories)
      .where(eq(categories.householdId, member.householdId));
    const result = await categorizeWithAi(
      { provider: ai.provider, apiKey: ai.apiKey, model: ai.config.model },
      preview,
      allowed.map((c) => c.name),
    );
    if (!result.data.results.length)
      throw new Error("Die KI hat keine Zuordnung geliefert. Bitte starte die Analyse erneut.");
    const byName = new Map(
      allowed.map((c) => [c.name.toLocaleLowerCase("de-DE"), c.id]),
    );
    const [preferences] = await db.select({ automaticCategorization: userPreferences.automaticCategorization }).from(userPreferences).where(eq(userPreferences.userId, user.userId)).limit(1);
    const trustedAutomaticMode = preferences?.automaticCategorization ?? false;
    let applied = 0;
    const suggestions = [];
    const categoryProposalMap = new Map<string, { name: string; isIncome: boolean; transactionIds: string[]; confidence: number; reason: string }>();
    const visibleAccountIds = (await memberAndVisibleAccountIds(user.userId)).accountIds;
    for (const item of result.data.results) {
      if (!body.ids.includes(item.id)) continue;
      const categoryId = item.category
        ? byName.get(item.category.toLocaleLowerCase("de-DE"))
        : undefined;
      if (!categoryId) {
        const proposedName = (item.proposedCategory ?? item.category)?.trim();
        const source = rows.find((row) => row.id === item.id);
        if (proposedName && source && !/^(sonstiges?|andere?s?|diverses)$/i.test(proposedName)) {
          const key = `${source.amount >= 0 ? "income" : "expense"}:${proposedName.toLocaleLowerCase("de-DE")}`;
          const existing = categoryProposalMap.get(key);
          if (existing) {
            existing.transactionIds.push(item.id);
            existing.confidence = Math.max(existing.confidence, item.confidence);
          } else {
            categoryProposalMap.set(key, {
              name: proposedName,
              isIncome: source.amount >= 0,
              transactionIds: [item.id],
              confidence: item.confidence,
              reason: item.reason,
            });
          }
        }
        continue;
      }
      if (trustedAutomaticMode && item.confidence >= AUTO_APPLY_CONFIDENCE) {
        const source = rows.find((row) => row.id === item.id);
        await db
          .update(transactions)
          .set({
            categoryId,
            categorizationConfidence: item.confidence.toFixed(3),
            categorizedBy: `ai:${ai.provider}`,
            counterpartyNormalized: normalizeMerchant(source?.merchant),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(transactions.id, item.id),
              inArray(transactions.accountId, visibleAccountIds),
            ),
          );
        await learnMerchantRule({ householdId: member.householdId, ownerMemberId: member.id, visibleAccountIds, merchant: source?.merchant, categoryId });
        applied++;
      } else suggestions.push({ ...item, categoryId });
    }
    const inputCost =
      (result.usage.inputTokens * (ai.config.inputPricePerMillion ?? 0)) /
      1_000_000;
    const outputCost =
      (result.usage.outputTokens * (ai.config.outputPricePerMillion ?? 0)) /
      1_000_000;
    await db
      .insert(aiUsage)
      .values({
        householdId: member.householdId,
        userId: user.userId,
        provider: ai.provider,
        model: ai.config.model,
        purpose: "categorization",
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        estimatedCostEur: (inputCost + outputCost).toFixed(6),
      });
    await writeAudit(
      "ai",
      "Nicht zugeordnete Umsätze wurden mit KI analysiert.",
      {
        userId: user.userId,
        metadata: {
          provider: ai.provider,
          model: ai.config.model,
          count: rows.length,
          applied,
          suggestions: suggestions.length,
          automaticMode: trustedAutomaticMode,
        },
      },
    );
    return NextResponse.json({
      applied,
      suggestions,
      categoryProposals: [...categoryProposalMap.values()],
      automaticMode: trustedAutomaticMode,
      usage: result.usage,
      estimatedCostEur: inputCost + outputCost,
    });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof Error ? e.message : "KI-Kategorisierung fehlgeschlagen.",
      },
      { status: 400 },
    );
  }
}
