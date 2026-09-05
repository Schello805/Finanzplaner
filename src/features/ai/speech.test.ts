import { describe, expect, it } from "vitest";
import { extractGeminiPcm, pcmToWav } from "./speech";

describe("Gemini-Sprachausgabe", () => {
  it("verpackt PCM als abspielbare WAV-Datei", () => {
    const wav = pcmToWav(Buffer.from([1, 2, 3, 4]));
    expect(wav.subarray(0, 4).toString()).toBe("RIFF");
    expect(wav.subarray(8, 12).toString()).toBe("WAVE");
    expect(wav.readUInt32LE(40)).toBe(4);
    expect(wav.length).toBe(48);
  });

  it("liest die Audiodaten aus der Interactions-Antwort", () => {
    expect(extractGeminiPcm({ interaction: { output_audio: { data: "AQID" } } })).toEqual(Buffer.from([1, 2, 3]));
  });
});
