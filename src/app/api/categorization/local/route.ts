import { NextRequest, NextResponse } from "next/server";
import { applyAutomaticAssignments } from "@/features/categorization/automatic-assignments";
import { writeAudit } from "@/lib/audit";
import { requireUser } from "@/lib/current-user";
import { memberAndVisibleAccountIds } from "@/lib/visible-accounts";

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const { member, accountIds } = await memberAndVisibleAccountIds(user.userId);
    const body = await request.json().catch(() => ({})) as { accountId?: string };
    if (body.accountId && !accountIds.includes(body.accountId))
      throw new Error("Das ausgewählte Konto ist nicht sichtbar.");
    const scopedAccountIds = body.accountId ? [body.accountId] : accountIds;
    const result = await applyAutomaticAssignments({
      householdId: member.householdId,
      ownerMemberId: member.id,
      visibleAccountIds: scopedAccountIds,
    });
    await writeAudit("categorization", "Sichere automatische Zuordnungen wurden manuell angewendet.", {
      userId: user.userId,
      metadata: { ...result, accountId: body.accountId ?? null },
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Lokale Erkennung konnte nicht ausgeführt werden." },
      { status: 400 },
    );
  }
}
