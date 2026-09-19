import type { FinTSConfig } from "lib-fints";

export function selectTanDevice(config: FinTSConfig, input?: string) {
  const method = config.selectedTanMethod;
  if (!method) throw new Error("Bitte wähle ein gültiges TAN-Verfahren.");
  // Clear an earlier selection when changing methods or retrying without a name.
  config.tanMediaName = undefined;
  if (method.tanMediaRequirement === 0) return undefined;
  const name = input?.trim() || (method.activeTanMedia.length === 1 ? method.activeTanMedia[0] : undefined);
  if (!name && method.tanMediaRequirement === 2) {
    throw new Error("Die Sparkasse hat kein registriertes TAN-Gerät über FinTS geliefert.");
  }
  if (name && (name.length > 32 || /[\r\n]/.test(name))) {
    throw new Error("Die TAN-Gerätebezeichnung darf maximal 32 Zeichen und keine Zeilenumbrüche enthalten.");
  }
  if (name && !method.activeTanMedia.includes(name)) {
    throw new Error("Das ausgewählte TAN-Gerät wurde von der Sparkasse nicht als aktiv gemeldet.");
  }
  if (name) config.selectTanMedia(name);
  return name;
}
