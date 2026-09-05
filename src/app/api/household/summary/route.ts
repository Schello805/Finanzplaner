import { NextResponse } from "next/server";
import { count, eq } from "drizzle-orm";
import { db } from "@/db";
import { householdMembers, households } from "@/db/schema";
import { requireUser } from "@/lib/current-user";
import { memberAndVisibleAccountIds } from "@/lib/visible-accounts";

export async function GET() {
  try {
    const user = await requireUser();
    const { member, accountIds } = await memberAndVisibleAccountIds(user.userId);
    const [[household], [members]] = await Promise.all([
      db.select({ name: households.name }).from(households).where(eq(households.id, member.householdId)).limit(1),
      db.select({ value: count() }).from(householdMembers).where(eq(householdMembers.householdId, member.householdId)),
    ]);
    return NextResponse.json({
      householdName: household?.name ?? "Familie",
      visibleAccountCount: accountIds.length,
      memberCount: Number(members.value),
      isAdmin: user.isAdmin,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Haushaltsübersicht konnte nicht geladen werden." },
      { status: 401 },
    );
  }
}
