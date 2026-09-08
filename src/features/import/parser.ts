import { createHash } from "node:crypto";
import Papa from "papaparse";
import type { CanonicalField, ImportResult, ImportTemplate, ParsedTransaction } from "./types";

const normalize = (value?: string | null) => (value ?? "").replace(/\s+/g, " ").trim();
const normalizeMalformedCsvValue = (value?: string | null) =>
  normalize(value).replace(/^"/, "").replace(/"$/, "").replaceAll('""', '"').trim();
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

function toIsoDate(value: string, format: ImportTemplate["dateFormat"]): string {
  const clean = normalize(value);
  let iso:string;
  if (format === "yyyy-MM-dd" && /^\d{4}-\d{2}-\d{2}$/.test(clean)) iso=clean;
  else {
    const match = /^(\d{2})\.(\d{2})\.(\d{2}|\d{4})$/.exec(clean);
    if (!match) throw new Error(`Ungültiges Datum: ${clean || "(leer)"}`);
    const year=match[3].length===2?(Number(match[3])>=70?`19${match[3]}`:`20${match[3]}`):match[3];
    iso=`${year}-${match[2]}-${match[1]}`;
  }
  const parsed=new Date(`${iso}T12:00:00Z`);
  if(Number.isNaN(parsed.getTime())||parsed.toISOString().slice(0,10)!==iso)throw new Error(`Ungültiges Datum: ${clean || "(leer)"}`);
  return iso;
}

function toAmount(value: string, decimalSeparator: "," | "."): number {
  const clean = normalize(value).replace(/\s/g, "");
  if(!clean)throw new Error("Ungültiger Betrag: (leer)");
  const normalized = decimalSeparator === "," ? clean.replace(/\./g, "").replace(",", ".") : clean.replace(/,/g, "");
  const amount = Number(normalized);
  if (!Number.isFinite(amount)) throw new Error(`Ungültiger Betrag: ${value || "(leer)"}`);
  if(Math.abs(amount*100-Math.round(amount*100))>=1e-8)throw new Error(`Betrag hat mehr als zwei Nachkommastellen: ${value}`);
  return amount;
}

const aliases = (header?: string) => (header ?? "").split("|").map(normalize).filter(Boolean);
function resolveHeader(headers: string[], configured?: string) {
  return aliases(configured).find((alias) => headers.includes(alias));
}
function get(row: Record<string, string>, template: ImportTemplate, field: CanonicalField) {
  const header = resolveHeader(Object.keys(row), template.columns[field]);
  return header ? normalize(row[header]) : "";
}

export function parseBankCsv(input: string, template: ImportTemplate): ImportResult {
  const headerRow = Math.max(1, template.headerRow ?? 1);
  const source = input.replace(/^\uFEFF/, "").split(/\r?\n/).slice(headerRow - 1).join("\n");
  const delimiters = [...new Set([template.delimiter, ";", ",", "\t"] )];
  const candidates = delimiters.map(delimiter => Papa.parse<Record<string, string>>(source, { header: true, delimiter, skipEmptyLines: template.skipEmptyLines ?? false }));
  let parsed = candidates.find(candidate => template.requiredFields.every(field => Boolean(resolveHeader(candidate.meta.fields ?? [], template.columns[field])))) ?? candidates[0];
  let toleratedMalformedQuotes = false;
  if (parsed.errors.some((error) => error.type === "Quotes")) {
    const fallback = Papa.parse<Record<string, string>>(source, {
      header: true,
      delimiter: parsed.meta.delimiter || template.delimiter,
      quoteChar: "\0",
      escapeChar: "\0",
      skipEmptyLines: template.skipEmptyLines ?? false,
      transform: normalizeMalformedCsvValue,
      transformHeader: normalizeMalformedCsvValue,
    });
    const fallbackHasRequiredFields = template.requiredFields.every((field) =>
      Boolean(resolveHeader(fallback.meta.fields ?? [], template.columns[field])),
    );
    if (fallbackHasRequiredFields) {
      parsed = fallback;
      toleratedMalformedQuotes = true;
    }
  }
  if (parsed.errors.some((e) => e.type === "Delimiter" || e.type === "Quotes")) throw new Error(`CSV konnte nicht gelesen werden: ${parsed.errors.find(e => e.type === "Delimiter" || e.type === "Quotes")?.message}`);
  const headers = parsed.meta.fields ?? [];
  const missing = template.requiredFields.filter((field) => !resolveHeader(headers, template.columns[field]));
  if (missing.length) throw new Error(`Notwendige Spalten fehlen: ${missing.map(f => template.columns[f] ?? f).join(", ")}`);

  const transactions: ParsedTransaction[] = [];
  const warnings: string[] = toleratedMalformedQuotes
    ? ["Die Datei enthielt fehlerhafte Anführungszeichen und wurde deshalb im toleranten CSV-Modus gelesen."]
    : [];
  let skippedEmptyRows = 0;
  parsed.data.forEach((row, index) => {
    if (!Object.values(row).some((value) => normalize(value))) { skippedEmptyRows++; return; }
    if (template.rowFilter) {
      const filterHeader = resolveHeader(headers, template.rowFilter.column);
      const value = filterHeader ? normalize(row[filterHeader]).toLocaleLowerCase("de-DE") : "";
      const allowed = template.rowFilter.allowedValues.map((item) => normalize(item).toLocaleLowerCase("de-DE"));
      if (!allowed.includes(value)) return;
    }
    try {
      const amount = toAmount(get(row, template, "amount"), template.decimalSeparator);
      const bookedOn = toIsoDate(get(row, template, "bookedOn"), template.dateFormat);
      const valued = get(row, template, "valuedOn");
      const tx = {
        accountReference: get(row, template, "account"),
        bookedOn,
        valuedOn: valued ? toIsoDate(valued, template.dateFormat) : undefined,
        bookingType: get(row, template, "bookingType") || undefined,
        purpose: get(row, template, "purpose") || undefined,
        creditorId: get(row, template, "creditorId") || undefined,
        mandateReference: get(row, template, "mandateReference") || undefined,
        endToEndReference: get(row, template, "endToEndReference") || undefined,
        counterparty: get(row, template, "counterparty") || undefined,
        counterpartyAccount: get(row, template, "counterpartyAccount") || undefined,
        bic: get(row, template, "bic") || undefined,
        amount,
        currency: get(row, template, "currency").toUpperCase(),
        direction: amount < 0 ? "expense" as const : "income" as const,
        bankReference: get(row, template, "endToEndReference") || undefined,
        originalData: row,
      };
      if(!/^[A-Z]{3}$/.test(tx.currency))throw new Error(`Ungültige Währung: ${tx.currency||"(leer)"}`);
      if(tx.currency!=="EUR")throw new Error(`Nicht unterstützte Währung: ${tx.currency}. Auswertungen sind derzeit ausschließlich in EUR möglich.`);
      const identity = [tx.accountReference, tx.bookedOn, tx.valuedOn, amount.toFixed(2), tx.currency, tx.counterpartyAccount, tx.counterparty, tx.purpose, tx.bankReference].map(v => normalize(String(v ?? "")).toLocaleLowerCase("de-DE")).join("|");
      transactions.push({ ...tx, fingerprint: sha256(identity) });
    } catch (error) { warnings.push(`Zeile ${index + headerRow + 1}: ${error instanceof Error ? error.message : "Unbekannter Fehler"}`); }
  });
  if (!transactions.length && warnings.length) throw new Error(`Keine gültigen Umsätze erkannt. ${warnings[0]}`);
  return { transactions, warnings, skippedEmptyRows };
}

export function findDuplicates(incoming: ParsedTransaction[], existing: ParsedTransaction[]) {
  const exactFingerprints = new Set(existing.map((tx) => tx.fingerprint));
  const accepted: ParsedTransaction[] = [];
  const exact: ParsedTransaction[] = [];
  const suspected: Array<{ incoming: ParsedTransaction; existing: ParsedTransaction }> = [];
  for (const tx of incoming) {
    if (exactFingerprints.has(tx.fingerprint)) { exact.push(tx); continue; }
    const newReference = normalize(tx.bankReference).toLocaleLowerCase("de-DE");
    const hasStableReference = newReference.length >= 6 && !/^(notprovided|nicht angegeben|n\/a)$/.test(newReference);
    // Banken können den Buchungstag zwischen zwei Exporten korrigieren. Eine
    // eindeutige Bankreferenz ist deshalb stärker als das Datum.
    const candidate = existing.find((old) => {
      const sameCore = old.amount === tx.amount && old.currency === tx.currency;
      const oldReference = normalize(old.bankReference).toLocaleLowerCase("de-DE");
      if (sameCore && hasStableReference && oldReference === newReference) return true;
      return sameCore && old.bookedOn === tx.bookedOn && normalize(old.counterparty).toLowerCase() === normalize(tx.counterparty).toLowerCase();
    });
    if (candidate) {
      const oldReference = normalize(candidate.bankReference).toLocaleLowerCase("de-DE");
      const stableReference = oldReference.length >= 6 && newReference === oldReference && !/^(notprovided|nicht angegeben|n\/a)$/.test(oldReference);
      const oldPurpose = normalize(candidate.purpose).toLocaleLowerCase("de-DE");
      const stablePurpose = oldPurpose.length >= 5 && oldPurpose === normalize(tx.purpose).toLocaleLowerCase("de-DE");
      if (stableReference || stablePurpose) exact.push(tx);
      else suspected.push({ incoming: tx, existing: candidate });
    } else { accepted.push(tx); exactFingerprints.add(tx.fingerprint); }
  }
  return { accepted, exact, suspected };
}

/** Sparkasse uses this explicit recipient marker for transactions that are not final yet. */
export function isPendingTransaction(transaction: { counterparty?: string | null; bookingType?: string | null; purpose?: string | null; originalData?: Record<string, string> }) {
  const counterparty = normalize(transaction.counterparty).normalize("NFKC");
  const bankInfo = Object.entries(transaction.originalData ?? {}).find(([key]) => normalize(key).toLocaleLowerCase("de-DE") === "info")?.[1];
  if (/vorgemerkt/i.test(normalize(bankInfo))) return true;
  if (/^\*\*\s*unbekannt(?:\s|$)/i.test(counterparty)) return true;
  return !counterparty && /sonstiger einzug/i.test(normalize(transaction.bookingType)) && /^mo\s/i.test(normalize(transaction.purpose));
}

export function fingerprintFile(content: Uint8Array) { return createHash("sha256").update(content).digest("hex"); }
