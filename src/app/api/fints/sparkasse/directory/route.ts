import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { BANK_DIRECTORY_URL, findSparkasseByBlz } from "@/features/fints/bank-directory";
import { requireUser } from "@/lib/current-user";

const querySchema = z.string().regex(/^\d{8}$/);

export async function GET(request: NextRequest) {
  try {
    await requireUser();
    const blz = querySchema.parse(request.nextUrl.searchParams.get("blz"));
    const response = await fetch(BANK_DIRECTORY_URL, {
      next: { revalidate: 86_400 },
      signal: AbortSignal.timeout(8_000),
      headers: { Accept: "text/plain" },
    });
    if (!response.ok) throw new Error("Das FinTS-Bankverzeichnis ist gerade nicht erreichbar.");
    const bank = findSparkasseByBlz(await response.text(), blz);
    if (!bank) {
      return NextResponse.json(
        { error: "Für diese BLZ wurde keine vertrauenswürdige Sparkassen-FinTS-Adresse gefunden. Bitte trage sie manuell ein." },
        { status: 404 },
      );
    }
    return NextResponse.json({ bank, source: "HBCI4Java-Bankverzeichnis" });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "FinTS-Adresse konnte nicht ermittelt werden." },
      { status: 400 },
    );
  }
}
