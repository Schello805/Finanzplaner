import { createHash } from "node:crypto";
import Papa from "papaparse";
import type { CanonicalField, ImportResult, ImportTemplate, ParsedTransaction } from "./types";

const normalize = (value?: string) => (value ?? "").replace(/\s+/g, " ").trim();
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

function toIsoDate(value: string, format: ImportTemplate["dateFormat"]): string {
  const clean = normalize(value);
  if (format === "yyyy-MM-dd" && /^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
  const match = /^(\d{2})\.(\d{2})\.(\d{2}|\d{4})$/.exec(clean);
  if (!match) throw new Error(`Ungültiges Datum: ${clean || "(leer)"}`);
  const year=match[3].length===2?(Number(match[3])>=70?`19${match[3]}`:`20${match[3]}`):match[3];
  return `${year}-${match[2]}-${match[1]}`;
}

function toAmount(value: string, decimalSeparator: "," | "."): number {
  const clean = normalize(value).replace(/\s/g, "");
  const normalized = decimalSeparator === "," ? clean.replace(/\./g, "").replace(",", ".") : clean.replace(/,/g, "");
  const amount = Number(normalized);
  if (!Number.isFinite(amount)) throw new Error(`Ungültiger Betrag: ${value || "(leer)"}`);
  return amount;
}

function get(row: Record<string, string>, template: ImportTemplate, field: CanonicalField) {
  const header = template.columns[field];
  return header ? normalize(row[header]) : "";
}

export function parseBankCsv(input: string, template: ImportTemplate): ImportResult {
  const source = input.replace(/^\uFEFF/, "");
  const delimiters = [...new Set([template.delimiter, ";", ",", "\t"] )];
  const candidates = delimiters.map(delimiter => Papa.parse<Record<string, string>>(source, { header: true, delimiter, skipEmptyLines: false }));
  const parsed = candidates.find(candidate => template.requiredFields.every(field => (candidate.meta.fields ?? []).includes(template.columns[field] ?? ""))) ?? candidates[0];
  if (parsed.errors.some((e) => e.type === "Delimiter" || e.type === "Quotes")) throw new Error(`CSV konnte nicht gelesen werden: ${parsed.errors.find(e => e.type === "Delimiter" || e.type === "Quotes")?.message}`);
  const headers = parsed.meta.fields ?? [];
  const missing = template.requiredFields.filter((field) => !headers.includes(template.columns[field] ?? ""));
  if (missing.length) throw new Error(`Notwendige Spalten fehlen: ${missing.map(f => template.columns[f] ?? f).join(", ")}`);

  const transactions: ParsedTransaction[] = [];
  const warnings: string[] = [];
  let skippedEmptyRows = 0;
  parsed.data.forEach((row, index) => {
    if (!Object.values(row).some((value) => normalize(value))) { skippedEmptyRows++; return; }
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
      const identity = [tx.accountReference, tx.bookedOn, tx.valuedOn, amount.toFixed(2), tx.currency, tx.counterpartyAccount, tx.counterparty, tx.purpose, tx.bankReference].map(v => normalize(String(v ?? "")).toLocaleLowerCase("de-DE")).join("|");
      transactions.push({ ...tx, fingerprint: sha256(identity) });
    } catch (error) { warnings.push(`Zeile ${index + 2}: ${error instanceof Error ? error.message : "Unbekannter Fehler"}`); }
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
    const candidate = existing.find((old) => old.bookedOn === tx.bookedOn && old.amount === tx.amount && old.currency === tx.currency && normalize(old.counterparty).toLowerCase() === normalize(tx.counterparty).toLowerCase());
    if (candidate) suspected.push({ incoming: tx, existing: candidate }); else { accepted.push(tx); exactFingerprints.add(tx.fingerprint); }
  }
  return { accepted, exact, suspected };
}

export function fingerprintFile(content: Uint8Array) { return createHash("sha256").update(content).digest("hex"); }
