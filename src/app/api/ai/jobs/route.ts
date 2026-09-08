import { after, NextRequest, NextResponse } from "next/server";
import { and, desc, eq, inArray, lt } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { aiJobs } from "@/db/schema";
import { runAmazonAiJob } from "@/features/ai/jobs";
import { getAmazonAiPreview } from "@/features/amazon/ai-service";
import { requireUser } from "@/lib/current-user";
import { memberAndVisibleAccountIds } from "@/lib/visible-accounts";

export const maxDuration = 3600;
const kindSchema = z.enum(["amazon"]);

const publicJob = (job: typeof aiJobs.$inferSelect) => ({
  id: job.id,
  kind: job.kind,
  status: job.status,
  totalItems: job.totalItems,
  processedItems: job.processedItems,
  appliedItems: job.appliedItems,
  suggestionItems: job.suggestionItems,
  proposalItems: job.proposalItems,
  rounds: job.rounds,
  estimatedCostEur: Number(job.estimatedCostEur),
  error: job.errorMessage,
  heartbeatAt: job.heartbeatAt,
  completedAt: job.completedAt,
});

async function latest(userId: string, kind: "amazon") {
  const [job] = await db.select().from(aiJobs).where(and(eq(aiJobs.userId, userId), eq(aiJobs.kind, kind))).orderBy(desc(aiJobs.createdAt)).limit(1);
  return job;
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const kind = kindSchema.catch("amazon").parse(request.nextUrl.searchParams.get("kind"));
    let job = await latest(user.userId, kind);
    if (job?.status === "running" && job.heartbeatAt && job.heartbeatAt < new Date(Date.now() - 5 * 60_000)) {
      const [recovered] = await db.update(aiJobs).set({ status: "queued", errorMessage: "Nach einem Neustart automatisch fortgesetzt.", updatedAt: new Date() }).where(and(eq(aiJobs.id, job.id), eq(aiJobs.status, "running"), lt(aiJobs.heartbeatAt, new Date(Date.now() - 5 * 60_000)))).returning();
      if (recovered) {
        job = recovered;
        after(() => runAmazonAiJob(job!.id));
      }
    } else if (job?.status === "queued") {
      after(() => runAmazonAiJob(job!.id));
    }
    return NextResponse.json(job ? publicJob(job) : null);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "KI-Auftrag konnte nicht geladen werden." }, { status: 400 });
  }
}

export async function POST() {
  try {
    const user = await requireUser();
    const { member } = await memberAndVisibleAccountIds(user.userId);
    const [active] = await db.select().from(aiJobs).where(and(eq(aiJobs.userId, user.userId), eq(aiJobs.kind, "amazon"), inArray(aiJobs.status, ["queued", "running", "paused"]))).orderBy(desc(aiJobs.createdAt)).limit(1);
    if (active) return NextResponse.json(publicJob(active));
    const preview = await getAmazonAiPreview(user.userId);
    if (!preview.total) throw new Error("Keine analysierbaren Amazon-Artikel vorhanden.");
    const [created] = await db.insert(aiJobs).values({ householdId: member.householdId, userId: user.userId, kind: "amazon", totalItems: preview.total }).onConflictDoNothing().returning();
    const job = created ?? await latest(user.userId, "amazon");
    if (!job) throw new Error("Der KI-Auftrag konnte nicht angelegt werden.");
    after(() => runAmazonAiJob(job.id));
    return NextResponse.json(publicJob(job), { status: 202 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "KI-Auftrag konnte nicht gestartet werden." }, { status: 400 });
  }
}

const patchSchema = z.object({ id: z.string().uuid(), action: z.enum(["pause", "resume"]) });

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    const body = patchSchema.parse(await request.json());
    const nextStatus = body.action === "pause" ? "paused" : "queued";
    const allowed = body.action === "pause" ? ["queued", "running"] as const : ["paused", "failed"] as const;
    const [job] = await db.update(aiJobs).set({ status: nextStatus, errorMessage: null, updatedAt: new Date() }).where(and(eq(aiJobs.id, body.id), eq(aiJobs.userId, user.userId), inArray(aiJobs.status, [...allowed]))).returning();
    if (!job) throw new Error("Der KI-Auftrag kann in diesem Zustand nicht geändert werden.");
    if (nextStatus === "queued") after(() => runAmazonAiJob(job.id));
    return NextResponse.json(publicJob(job));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "KI-Auftrag konnte nicht geändert werden." }, { status: 400 });
  }
}
