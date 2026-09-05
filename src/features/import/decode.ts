import type { ImportTemplate } from "./types";

export function decodeBankCsv(
  bytes: Uint8Array,
  configuredEncoding: ImportTemplate["encoding"],
) {
  const encoding = configuredEncoding === "utf-8-sig" ? "utf-8" : configuredEncoding;
  if (encoding !== "utf-8") return new TextDecoder(encoding).decode(bytes);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    // Viele Sparkassen-Exporte sind trotz UTF-8-Vorlage noch Windows-1252.
    return new TextDecoder("windows-1252").decode(bytes);
  }
}
