import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { householdMembers } from "@/db/schema";
import { runHouseholdIntegrityCheck } from "@/features/integrity/service";
import { requireAdmin } from "@/lib/current-user";

export async function GET() {
  try {
    const admin = await requireAdmin();
    const [member] = await db.select({ householdId: householdMembers.householdId }).from(householdMembers).where(eq(householdMembers.userId, admin.userId)).limit(1);
    if (!member) throw new Error("Kein Haushalt eingerichtet.");
    return NextResponse.json(await runHouseholdIntegrityCheck(member.householdId));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Integritätsprüfung fehlgeschlagen." }, { status: 400 });
  }
}
