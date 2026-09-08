export type AssignmentOrigin =
  | "manual"
  | "local-rule"
  | "local-keyword"
  | "amazon"
  | "amazon-split"
  | `ai:${string}`
  | string
  | null
  | undefined;

export const ASSIGNMENT_PIPELINE = [
  {
    priority: 1,
    title: "Manuelle Entscheidung",
    detail: "Bestätigte Kategorien, Aufteilungen, Umbuchungen und Ausschlüsse werden niemals automatisch überschrieben.",
  },
  {
    priority: 2,
    title: "Bestätigte Regeln",
    detail: "Händler-, Buchungstext- und Amazon-Artikelregeln wenden dein gespeichertes Wissen an.",
  },
  {
    priority: 3,
    title: "Sichere Systemerkennung",
    detail: "Eindeutige Anbieter und Buchungstexte, zum Beispiel bekannte Abonnements, werden lokal erkannt.",
  },
  {
    priority: 4,
    title: "KI-Vorschlag",
    detail: "Nur die verbleibende Restmenge wird analysiert. Die eingestellte Sicherheitsgrenze entscheidet über automatische Übernahme oder Prüfung.",
  },
  {
    priority: 5,
    title: "Manuelle Prüfung",
    detail: "Unklare oder widersprüchliche Fälle bleiben offen, statt geraten zu werden.",
  },
] as const;

export function assignmentExplanation(origin: AssignmentOrigin, confidence?: number | string | null) {
  const numericConfidence = Number(confidence ?? 0);
  if (origin === "manual") return { short: "Manuell bestätigt", detail: "Diese Kategorie wurde von dir festgelegt und wird von der Automatik nicht überschrieben." };
  if (origin === "local-rule") return { short: "Gespeicherte Regel", detail: "Ein von dir bestätigter Händler oder Buchungstext hat exakt zu einer gespeicherten Regel gepasst." };
  if (origin === "local-keyword") return { short: "Sicher erkannt", detail: "Ein eindeutiger Anbieter oder Begriff im Buchungstext wurde lokal erkannt, ohne Daten an eine KI zu senden." };
  if (origin === "amazon") return { short: "Amazon-Artikel", detail: "Die Kategorie stammt aus den zugeordneten Artikeln der verknüpften Amazon-Bestellung." };
  if (origin === "amazon-split") return { short: "Amazon-Aufteilung", detail: "Die Bankbuchung wurde anhand mehrerer Amazon-Artikel auf verschiedene Kategorien aufgeteilt." };
  if (origin?.startsWith("ai:")) {
    const percent = Number.isFinite(numericConfidence) ? Math.round(numericConfidence * 100) : 0;
    return { short: `KI-Vorschlag${percent ? ` · ${percent} %` : ""}`, detail: "Die KI hat nur eine vorhandene Kategorie vorgeschlagen. Du kannst die Zuordnung jederzeit ändern oder bestätigen." };
  }
  return { short: "Zuordnung vorhanden", detail: "Für diese Zuordnung ist keine ältere Herkunftsinformation gespeichert." };
}

export function mayApplyAutomaticAssignment(input: {
  categoryId?: string | null;
  hasSplits?: boolean;
  excluded?: boolean;
  specialType?: string | null;
}) {
  return !input.categoryId && !input.hasSplits && !input.excluded && input.specialType !== "transfer";
}

export function shouldLearnAssignmentRule(ruleMode:unknown){
  return ruleMode==="future"||ruleMode==="all";
}
