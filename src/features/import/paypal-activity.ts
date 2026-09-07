import type { ImportTemplate } from "./types";

/** PayPal activity export. Header aliases support German and English exports. */
export const paypalActivity: ImportTemplate = {
  id: "builtin-paypal-activity",
  name: "PayPal-Aktivitätsbericht",
  bankName: "PayPal",
  delimiter: ",",
  encoding: "utf-8-sig",
  dateFormat: "dd.MM.yyyy",
  decimalSeparator: ",",
  requiredFields: ["bookedOn", "counterparty", "amount", "currency"],
  columns: {
    bookedOn: "Datum|Date",
    bookingType: "Typ|Type",
    purpose: "Betreff|Subject|Artikelbezeichnung|Item Title",
    counterparty: "Name",
    endToEndReference: "Transaktionscode|Transaction ID",
    amount: "Netto|Net",
    currency: "Währung|Currency",
    info: "Status",
  },
  rowFilter: {
    column: "Status",
    allowedValues: ["Abgeschlossen", "Completed", "Bezahlt", "Paid", "Erstattet", "Refunded"],
  },
};
