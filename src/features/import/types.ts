export type CanonicalField = "account" | "bookedOn" | "valuedOn" | "bookingType" | "purpose" | "creditorId" | "mandateReference" | "endToEndReference" | "counterparty" | "counterpartyAccount" | "bic" | "amount" | "currency" | "info";

export interface ImportTemplate {
  id: string;
  name: string;
  bankName: string;
  delimiter: string;
  encoding: "utf-8" | "utf-8-sig" | "windows-1252" | "iso-8859-1";
  dateFormat: "dd.MM.yyyy" | "yyyy-MM-dd";
  decimalSeparator: "," | ".";
  columns: Partial<Record<CanonicalField, string>>;
  requiredFields: CanonicalField[];
}

export interface ParsedTransaction {
  accountReference: string;
  bookedOn: string;
  valuedOn?: string;
  bookingType?: string;
  purpose?: string;
  creditorId?: string;
  mandateReference?: string;
  endToEndReference?: string;
  counterparty?: string;
  counterpartyAccount?: string;
  bic?: string;
  amount: number;
  currency: string;
  direction: "income" | "expense";
  bankReference?: string;
  fingerprint: string;
  originalData: Record<string, string>;
}

export interface ImportResult {
  transactions: ParsedTransaction[];
  warnings: string[];
  skippedEmptyRows: number;
}
