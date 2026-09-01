import type { ImportTemplate } from "./types";

export const sparkasseCamtV8: ImportTemplate = {
  id: "builtin-sparkasse-camt-v8",
  name: "Sparkasse CSV-CAMT V8",
  bankName: "Sparkasse",
  delimiter: ",",
  encoding: "utf-8-sig",
  dateFormat: "dd.MM.yyyy",
  decimalSeparator: ",",
  requiredFields: ["account", "bookedOn", "amount", "currency"],
  columns: {
    account: "Auftragskonto",
    bookedOn: "Buchungstag",
    valuedOn: "Valutadatum",
    bookingType: "Buchungstext",
    purpose: "Verwendungszweck",
    creditorId: "Glaeubiger ID",
    mandateReference: "Mandatsreferenz",
    endToEndReference: "Kundenreferenz (End-to-End)",
    counterparty: "Beguenstigter/Zahlungspflichtiger",
    counterpartyAccount: "Kontonummer/IBAN",
    bic: "BIC (SWIFT-Code)",
    amount: "Betrag",
    currency: "Waehrung",
    info: "Info",
  },
};
