const ibanPattern = /\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]){11,30}\b/gi;
const secretPattern = /\b(?:sk-[A-Za-z0-9_-]{16,}|AIza[A-Za-z0-9_-]{20,})\b/g;
const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

export function redactSensitiveText(value: string) {
  return value.replace(ibanPattern, "[IBAN entfernt]").replace(secretPattern, "[API-Schlüssel entfernt]").replace(emailPattern, "[E-Mail entfernt]");
}

export function sanitizeLogMetadata(input: Record<string, unknown>): Record<string,string|number|boolean|null> {
  return Object.fromEntries(Object.entries(input).filter(([key]) => !/(password|secret|token|purpose|iban|account|prompt|response)/i.test(key)).map(([key, value]) => [key, typeof value === "string" ? redactSensitiveText(value).slice(0, 500) : typeof value === "number" || typeof value === "boolean" || value === null ? value : String(value).slice(0,500)]));
}
