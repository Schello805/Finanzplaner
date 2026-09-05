import { NextResponse } from "next/server";
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { aiUsage, categories, systemSettings, transactions } from "@/db/schema";
import { categoryComparison, type MonthlyCategoryTotal } from "@/features/analytics/calculations";
import { estimateCost, generateInsightsWithAi, resolveModelPrice } from "@/features/ai/provider";
import { requireUser } from "@/lib/current-user";
import { decryptSecret } from "@/lib/security";
import { memberAndVisibleAccountIds } from "@/lib/visible-accounts";
import { writeAudit } from "@/lib/audit";

type ProviderConfig = { model: string; inputPricePerMillion?: number; outputPricePerMillion?: number };
const monthKey = (date: Date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
const shift = (date: Date, months: number) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));

async function context(userId: string) {
  const { member, accountIds } = await memberAndVisibleAccountIds(userId);
  if (!accountIds.length) throw new Error("Noch keine sichtbaren Konten vorhanden.");
  const now = new Date();
  const currentMonth = monthKey(now);
  const lastMonth = monthKey(shift(now, -1));
  const from = `${monthKey(shift(now, -13))}-01`;
  const rows = await db
    .select({ bookedOn: transactions.bookedOn, amount: transactions.amount, categoryId: transactions.categoryId, categoryName: categories.name })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(and(
      inArray(transactions.accountId, accountIds),
      eq(transactions.direction, "expense"),
      eq(transactions.excludedFromAnalysis, false),
      sql`${transactions.amount} <> 0`,
      gte(transactions.bookedOn, from),
    ));
  const normalized: MonthlyCategoryTotal[] = rows.map((row) => ({ month: row.bookedOn.slice(0, 7), categoryId: row.categoryId ?? "uncategorized", categoryName: row.categoryName ?? "Nicht zugeordnet", amount: Number(row.amount) }));
  const comparisons = categoryComparison(normalized, lastMonth, currentMonth)
    .filter((item) => item.last > 0 || item.current > 0)
    .map((item) => ({
      name: item.categoryName,
      lastMonthEur: item.last,
      monthlyAverageEur: item.average,
      potentialEur: item.average === null ? 0 : Math.max(0, Math.round((item.last - item.average) * 100) / 100),
      deviationPercent: item.deltaPercent === null ? null : Math.round(item.deltaPercent * 10) / 10,
      historyMonths: item.historyMonths,
    }))
    .sort((a, b) => b.potentialEur - a.potentialEur || b.lastMonthEur - a.lastMonthEur)
    .slice(0, 8);
  if (!comparisons.length) throw new Error("Für KI-Hinweise sind noch nicht genügend Ausgaben vorhanden.");
  const input = { analyzedMonth: lastMonth, instruction: "Priorisiere die größten potentialEur-Werte. potentialEur ist eine datenbasierte Abweichung, keine garantierte Ersparnis.", categories: comparisons };
  const settingsRows = await db.select().from(systemSettings);
  const provider = ((settingsRows.find((row) => row.key === "ai.default")?.valueJson as { provider?: "openai" | "gemini" })?.provider ?? "openai");
  const providerRow = settingsRows.find((row) => row.key === `ai.${provider}`);
  if (!providerRow?.valueEncrypted) throw new Error(`${provider === "openai" ? "OpenAI" : "Gemini"} ist nicht vollständig eingerichtet.`);
  const config = providerRow.valueJson as unknown as ProviderConfig;
  const price = resolveModelPrice(provider, config.model, config);
  return { member, input, comparisons, provider, config, price, apiKey: decryptSecret(providerRow.valueEncrypted) };
}

export async function GET() {
  try {
    const user = await requireUser();
    const data = await context(user.userId);
    return NextResponse.json({ provider: data.provider, model: data.config.model, data: data.input, cost: data.price ? estimateCost(data.input, data.price, 280) : null, pricingSource: data.price?.source ?? null });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Vorschau konnte nicht erstellt werden." }, { status: 400 });
  }
}

export async function POST() {
  try {
    const user = await requireUser();
    const data = await context(user.userId);
    const result = await generateInsightsWithAi({ provider: data.provider, model: data.config.model, apiKey: data.apiKey }, data.input);
    const cost = data.price ? result.usage.inputTokens * data.price.inputPerMillion / 1_000_000 + result.usage.outputTokens * data.price.outputPerMillion / 1_000_000 : null;
    const potentialByCategory = new Map(data.comparisons.map((item) => [item.name.toLocaleLowerCase("de-DE"), item.potentialEur]));
    const response = {
      ...result.data,
      opportunities: result.data.opportunities.map((item) => ({ ...item, potentialEur: potentialByCategory.get(item.category.toLocaleLowerCase("de-DE")) ?? 0 })),
      usage: result.usage,
      estimatedCostEur: cost,
      pricingAvailable: cost !== null,
    };
    await db.insert(aiUsage).values({ householdId: data.member.householdId, userId: user.userId, provider: data.provider, model: data.config.model, purpose: "insights", inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens, estimatedCostEur: cost?.toFixed(6) });
    await writeAudit("ai", "Verdichtete Ausgabensummen wurden für priorisierte Sparhinweise ausgewertet.", { userId: user.userId, metadata: { provider: data.provider, model: data.config.model, estimatedCostEur: cost === null ? null : Number(cost.toFixed(6)) } });
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "KI-Hinweise konnten nicht erstellt werden." }, { status: 400 });
  }
}
