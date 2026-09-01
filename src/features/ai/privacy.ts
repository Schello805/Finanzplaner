import type { AiTransactionInput } from "./types";

const iban = /\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]){11,30}\b/gi;
const references = /\b(?:MANDAT|EREF|CRED|SVWZ|IBAN|BIC)[:+ ]?[A-Z0-9_-]{5,}\b/gi;
const longDigits = /\b\d{7,}\b/g;
export function sanitizeTransaction(input: AiTransactionInput, mode: "minimal" | "full_text"): AiTransactionInput {
  const clean = (value?: string) => value?.replace(references,"[entfernt]").replace(iban,"[entfernt]").replace(longDigits,"[entfernt]").slice(0, mode === "minimal" ? 160 : 600);
  return { id:input.id, date:input.date, amount:input.amount, currency:input.currency, bookingType:clean(input.bookingType), merchant:clean(input.merchant), purpose: mode === "full_text" ? clean(input.purpose) : clean(input.purpose)?.replace(/\b[A-ZÄÖÜ][a-zäöüß]+\s+[A-ZÄÖÜ][a-zäöüß]+\b/g,"[Name entfernt]") };
}

export function buildTransferPreview(inputs: AiTransactionInput[], mode: "minimal" | "full_text") { return inputs.map(input=>sanitizeTransaction(input,mode)); }
