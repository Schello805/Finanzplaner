import type { FinTSConfig } from "lib-fints";

export function selectTanDevice(config: FinTSConfig, input?: string) {
  const method = config.selectedTanMethod;
  if (!method) throw new Error("Bitte wähle ein gültiges TAN-Verfahren.");
  // Clear an earlier selection when changing methods or retrying without a name.
  config.tanMediaName = undefined;
  if (method.tanMediaRequirement === 0) return undefined;
  const name = input?.trim() || (method.activeTanMedia.length === 1 ? method.activeTanMedia[0] : undefined);
  if (!name && method.tanMediaRequirement === 2) {
    throw new Error("Bitte gib die bei der Sparkasse hinterlegte TAN-Gerätebezeichnung ein. Der allgemeine iPhone-Gerätename kann davon abweichen.");
  }
  if (name && (name.length > 32 || /[\r\n]/.test(name))) {
    throw new Error("Die TAN-Gerätebezeichnung darf maximal 32 Zeichen und keine Zeilenumbrüche enthalten.");
  }
  if (name && method.activeTanMedia.length) config.selectTanMedia(name);
  else config.tanMediaName = name;
  return name;
}
