import { decodeBankCsv } from "./decode";
import { parseBankCsv } from "./parser";
import type { ImportResult, ImportTemplate } from "./types";

export interface ImportTemplateCandidate {
  storedId: string;
  template: ImportTemplate;
}

export interface ResolvedImport {
  storedId: string;
  template: ImportTemplate;
  parsed: ImportResult;
  autoDetected: boolean;
}

function parseCandidate(bytes: Uint8Array, candidate: ImportTemplateCandidate) {
  return parseBankCsv(
    decodeBankCsv(bytes, candidate.template.encoding),
    candidate.template,
  );
}

/**
 * Keeps an explicitly selected source whenever it fits. If its required
 * columns are absent, exactly one fitting active template may replace it.
 * Ambiguous detections stay blocked instead of risking a wrong import.
 */
export function resolveImportTemplate(
  bytes: Uint8Array,
  selected: ImportTemplateCandidate,
  candidates: ImportTemplateCandidate[],
): ResolvedImport {
  try {
    return {
      ...selected,
      parsed: parseCandidate(bytes, selected),
      autoDetected: false,
    };
  } catch (selectedError) {
    const message = selectedError instanceof Error ? selectedError.message : "";
    if (!message.startsWith("Notwendige Spalten fehlen:")) throw selectedError;

    const matches: Array<ImportTemplateCandidate & { parsed: ImportResult }> = [];
    for (const candidate of candidates) {
      if (candidate.storedId === selected.storedId) continue;
      try {
        matches.push({ ...candidate, parsed: parseCandidate(bytes, candidate) });
      } catch {
        // A format candidate is expected to fail when its columns do not fit.
      }
    }
    if (matches.length !== 1) throw selectedError;
    return { ...matches[0], autoDetected: true };
  }
}
