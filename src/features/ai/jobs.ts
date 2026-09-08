import "server-only";

import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { aiJobs } from "@/db/schema";
import { processAmazonAiBatch } from "@/features/amazon/ai-service";
import { writeAudit } from "@/lib/audit";

export async function runAmazonAiJob(jobId: string) {
  const [job] = await db
    .update(aiJobs)
    .set({ status: "running", startedAt: new Date(), heartbeatAt: new Date(), updatedAt: new Date() })
    .where(and(eq(aiJobs.id, jobId), eq(aiJobs.status, "queued")))
    .returning();
  if (!job) return;

  try {
    while (true) {
      const [state] = await db.select({ status: aiJobs.status }).from(aiJobs).where(eq(aiJobs.id, jobId)).limit(1);
      if (!state || state.status === "paused") return;
      const result = await processAmazonAiBatch(job.userId);
      if (!result.analyzedIds.length) {
        await db.update(aiJobs).set({ status: "completed", completedAt: new Date(), heartbeatAt: new Date(), updatedAt: new Date() }).where(eq(aiJobs.id, jobId));
        await writeAudit("ai-job", "Amazon-KI-Auftrag wurde abgeschlossen.", { userId: job.userId, metadata: { jobId } });
        return;
      }
      await db.update(aiJobs).set({
        processedItems: sql`${aiJobs.processedItems} + ${result.analyzedIds.length}`,
        appliedItems: sql`${aiJobs.appliedItems} + ${result.applied}`,
        suggestionItems: sql`${aiJobs.suggestionItems} + ${result.suggestions.length}`,
        proposalItems: sql`${aiJobs.proposalItems} + ${result.categoryProposals.length}`,
        rounds: sql`${aiJobs.rounds} + 1`,
        estimatedCostEur: sql`${aiJobs.estimatedCostEur} + ${result.estimatedCostEur ?? 0}`,
        heartbeatAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(aiJobs.id, jobId));
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    await db.update(aiJobs).set({ status: "failed", errorMessage: message.slice(0, 500), heartbeatAt: new Date(), updatedAt: new Date() }).where(eq(aiJobs.id, jobId));
    await writeAudit("ai-job", "Amazon-KI-Auftrag wurde angehalten.", { userId: job.userId, level: "error", metadata: { jobId, error: message.slice(0, 200) } });
  }
}
