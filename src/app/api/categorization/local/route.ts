import { NextResponse } from "next/server";
import { applyMerchantRules } from "@/features/categorization/merchant-rules";
import { writeAudit } from "@/lib/audit";
import { requireUser } from "@/lib/current-user";
import { memberAndVisibleAccountIds } from "@/lib/visible-accounts";

export async function POST() {
  try {
    const user = await requireUser();
    const { member, accountIds } = await memberAndVisibleAccountIds(user.userId);
    const result = await applyMerchantRules({
      householdId: member.householdId,
      ownerMemberId: member.id,
      visibleAccountIds: accountIds,
    });
    await writeAudit("categorization", "Gelernte lokale Händlerregeln wurden manuell angewendet.", {
      userId: user.userId,
      metadata: result,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Lokale Erkennung konnte nicht ausgeführt werden." },
      { status: 400 },
    );
  }
}
