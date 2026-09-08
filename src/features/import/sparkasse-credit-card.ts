import type { ImportTemplate } from "./types";

/** Sparkassen credit-card CSV exported separately from the CAMT account statement. */
export const sparkasseCreditCard: ImportTemplate = {
  id: "builtin-sparkasse-credit-card",
  name: "Sparkassen-Kreditkartenumsätze",
  bankName: "Sparkasse Kreditkarte",
  delimiter: ";",
  encoding: "iso-8859-1",
  dateFormat: "dd.MM.yyyy",
  decimalSeparator: ",",
  requiredFields: ["bookedOn", "counterparty", "amount", "currency"],
  columns: {
    bookedOn: "Buchungsdatum",
    valuedOn: "Belegdatum",
    bookingType: "Abrechnungskennzeichen",
    counterparty: "Transaktionsbeschreibung",
    purpose: "Transaktionsbeschreibung Zusatz",
    endToEndReference: "Buchungsreferenz",
    amount: "Buchungsbetrag",
    currency: "Buchungswährung",
    info: "Gebührenschlüssel",
  },
};
