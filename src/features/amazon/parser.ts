import { createHash } from "node:crypto";
import Papa from "papaparse";
import type { AmazonOrderImportResult, AmazonOrderItem } from "./types";

const requiredHeaders = [
  "ASIN",
  "Currency",
  "Order Date",
  "Order ID",
  "Order Status",
  "Original Quantity",
  "Product Name",
  "Total Amount",
  "Unit Price",
] as const;

const clean = (value: unknown) => String(value ?? "").trim();
const optional = (value: unknown) => {
  const result = clean(value);
  return !result || /^(not available|n\/a)$/i.test(result) ? undefined : result;
};
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

function number(value: unknown, field: string) {
  const raw = clean(value).replace(/[^0-9,.-]/g, "");
  const normalized = raw.includes(",") && !raw.includes(".")
    ? raw.replace(",", ".")
    : raw.replace(/,/g, "");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) throw new Error(`${field} ist ungültig.`);
  return parsed;
}

function isoDate(value: unknown, field: string) {
  const raw = clean(value);
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/.exec(raw);
  if (!match) throw new Error(`${field} ist ungültig.`);
  return `${match[1]}-${match[2]}-${match[3]}`;
}

export function parseAmazonOrderHistory(input: string): AmazonOrderImportResult {
  const parsed = Papa.parse<Record<string, string>>(input.replace(/^\uFEFF/, ""), {
    header: true,
    skipEmptyLines: true,
  });
  const headers = parsed.meta.fields ?? [];
  const missing = requiredHeaders.filter((header) => !headers.includes(header));
  if (missing.length) {
    throw new Error(`Amazon-CSV: Notwendige Spalten fehlen: ${missing.join(", ")}`);
  }
  const structuralError = parsed.errors.find((error) =>
    error.type === "Delimiter" || error.type === "Quotes",
  );
  if (structuralError) throw new Error(`Amazon-CSV konnte nicht gelesen werden: ${structuralError.message}`);

  const items: AmazonOrderItem[] = [];
  const warnings: string[] = [];
  parsed.data.forEach((row, index) => {
    try {
      const orderId = clean(row["Order ID"]);
      const asin = clean(row.ASIN);
      const productName = clean(row["Product Name"]);
      if (!orderId || !asin || !productName) throw new Error("Bestell-ID, ASIN oder Artikelname fehlt.");
      const orderDate = isoDate(row["Order Date"], "Bestelldatum");
      const shipDateValue = optional(row["Ship Date"]);
      const quantity = number(row["Original Quantity"], "Menge");
      const unitPrice = number(row["Unit Price"], "Einzelpreis");
      const unitTax = number(row["Unit Price Tax"], "Steuer");
      const orderTotal = number(row["Total Amount"], "Bestellsumme");
      const shippingCharge = number(row["Shipping Charge"], "Versandkosten");
      const totalDiscounts = number(row["Total Discounts"], "Rabatt");
      const currency = clean(row.Currency).toUpperCase();
      if (!currency) throw new Error("Währung fehlt.");
      const identity = [orderId, asin, orderDate, shipDateValue, quantity, unitPrice, orderTotal, productName]
        .map((part) => clean(part).toLocaleLowerCase("de-DE"))
        .join("|");
      items.push({
        orderId,
        orderDate,
        shipDate: shipDateValue ? isoDate(shipDateValue, "Versanddatum") : undefined,
        asin,
        productName,
        department: optional(row.Department),
        status: clean(row["Order Status"]),
        quantity,
        unitPrice,
        unitTax,
        orderTotal,
        shippingCharge,
        totalDiscounts,
        currency,
        fingerprint: hash(identity),
      });
    } catch (error) {
      warnings.push(`Zeile ${index + 2}: ${error instanceof Error ? error.message : "Unbekannter Fehler"}`);
    }
  });
  if (!items.length) {
    throw new Error(`Keine gültigen Amazon-Bestellungen erkannt.${warnings[0] ? ` ${warnings[0]}` : ""}`);
  }
  return { items, orderCount: new Set(items.map((item) => item.orderId)).size, warnings };
}
