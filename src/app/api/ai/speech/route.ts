import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { systemSettings } from "@/db/schema";
import { extractGeminiPcm, GEMINI_TTS_MODEL, GEMINI_TTS_VOICE, pcmToWav } from "@/features/ai/speech";
import { requireUser } from "@/lib/current-user";
import { decryptSecret } from "@/lib/security";

const requestSchema = z.object({ text: z.string().trim().min(1).max(4_000) });

async function createSpeech(apiKey: string, text: string) {
  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
    method: "POST",
    headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: GEMINI_TTS_MODEL,
      input: `Sprich den folgenden deutschen Finanzüberblick ruhig, freundlich und natürlich. Lies Eurobeträge verständlich vor. Keine Einleitung hinzufügen.\n\n${text}`,
      response_format: { type: "audio" },
      generation_config: { speech_config: [{ voice: GEMINI_TTS_VOICE }] },
    }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!response.ok) throw new Error(`Google-Sprachausgabe fehlgeschlagen (${response.status}).`);
  return extractGeminiPcm(await response.json());
}

export async function POST(request: Request) {
  try {
    await requireUser();
    const { text } = requestSchema.parse(await request.json());
    const [setting] = await db.select({ secret: systemSettings.valueEncrypted }).from(systemSettings).where(eq(systemSettings.key, "ai.gemini")).limit(1);
    if (!setting?.secret) throw new Error("Für die hochwertige Sprachausgabe muss der Administrator einen Gemini-API-Schlüssel hinterlegen.");
    const apiKey = decryptSecret(setting.secret);
    let pcm: Buffer;
    try {
      pcm = await createSpeech(apiKey, text);
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes("(500)")) throw error;
      pcm = await createSpeech(apiKey, text);
    }
    return new Response(pcmToWav(pcm), {
      headers: { "Content-Type": "audio/wav", "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Sprachausgabe konnte nicht erstellt werden." }, { status: 400 });
  }
}
