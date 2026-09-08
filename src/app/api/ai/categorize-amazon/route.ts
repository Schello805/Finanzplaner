import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { estimateCost } from "@/features/ai/provider";
import { AMAZON_AI_BATCH_SIZE, getAmazonAiPreview, processAmazonAiBatch } from "@/features/amazon/ai-service";
import { requireUser } from "@/lib/current-user";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const excludedIds = (request.nextUrl.searchParams.get("exclude") ?? "")
      .split(",")
      .filter((id) => z.string().uuid().safeParse(id).success)
      .slice(0, 1000);
    const state = await getAmazonAiPreview(user.userId, excludedIds);
    if (!state.rows.length) {
      return NextResponse.json({
        available: true,
        count: state.total,
        totalPending: state.totalPending,
        coverageItems: state.coverageItems,
        excludedOutsideCoverage: state.excludedOutsideCoverage,
        coverage: state.coverage,
        batchSize: 0,
        totalRounds: 0,
        items: [],
      });
    }
    return NextResponse.json({
      available: true,
      count: state.total,
      totalPending: state.totalPending,
      coverageItems: state.coverageItems,
      excludedOutsideCoverage: state.excludedOutsideCoverage,
      coverage: state.coverage,
      batchSize: state.rows.length,
      totalRounds: Math.ceil(state.total / AMAZON_AI_BATCH_SIZE),
      remainingAfterBatch: Math.max(0, state.total - excludedIds.length - state.rows.length),
      provider: state.provider,
      model: state.model,
      items: state.rows.map(({ id }) => ({ id })),
      cost: state.price ? estimateCost(state.rows, state.price, Math.max(300, state.rows.length * 80)) : null,
    });
  } catch (error) {
    return NextResponse.json({ available: false, error: error instanceof Error ? error.message : "Amazon-KI-Vorschau fehlgeschlagen." }, { status: 400 });
  }
}

const postSchema = z.object({ ids: z.array(z.string().uuid()).min(1).max(100) });

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = postSchema.parse(await request.json());
    const result = await processAmazonAiBatch(user.userId, body.ids);
    if (!result.analyzedIds.length) throw new Error("Keine offenen Amazon-Artikel gefunden.");
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Amazon-KI-Kategorisierung fehlgeschlagen." }, { status: 400 });
  }
}
