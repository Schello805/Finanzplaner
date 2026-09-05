export const GEMINI_TTS_MODEL = "gemini-3.1-flash-tts-preview";
export const GEMINI_TTS_VOICE = "Sulafat";

export function pcmToWav(pcm: Buffer, sampleRate = 24_000, channels = 1, bitsPerSample = 16) {
  const header = Buffer.alloc(44);
  const byteRate = sampleRate * channels * bitsPerSample / 8;
  const blockAlign = channels * bitsPerSample / 8;
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

type GeminiSpeechResponse = {
  interaction?: { output_audio?: { data?: string }; outputAudio?: { data?: string } };
  output_audio?: { data?: string };
  outputAudio?: { data?: string };
};

export function extractGeminiPcm(body: GeminiSpeechResponse) {
  const encoded = body.interaction?.output_audio?.data
    ?? body.interaction?.outputAudio?.data
    ?? body.output_audio?.data
    ?? body.outputAudio?.data;
  if (!encoded) throw new Error("Google hat keine Audiodaten zurückgegeben.");
  return Buffer.from(encoded, "base64");
}
