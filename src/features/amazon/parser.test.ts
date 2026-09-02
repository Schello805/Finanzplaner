import { describe, expect, it } from "vitest";
import { parseAmazonOrderHistory } from "./parser";

const header = "ASIN,Currency,Department,Order Date,Order ID,Order Status,Original Quantity,Product Name,Ship Date,Shipping Charge,Total Amount,Total Discounts,Unit Price,Unit Price Tax";
const first = 'A0001,EUR,Haushalt,2026-08-01T12:30:00Z,111-2222222-3333333,Delivered,1,"Artikel, eins",2026-08-02T08:00:00Z,0,30.00,-2.00,10.00,1.90';
const second = "A0002,EUR,Elektronik,2026-08-01T12:30:00Z,111-2222222-3333333,Delivered,2,Artikel zwei,2026-08-02T08:00:00Z,0,30.00,-2.00,8.00,1.52";

describe("Amazon Order History", () => {
  it("behält mehrere Artikel einer Bestellung getrennt", () => {
    const result = parseAmazonOrderHistory(`${header}\n${first}\n${second}`);
    expect(result.orderCount).toBe(1);
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({ currency: "EUR", quantity: 1, orderTotal: 30 });
    expect(result.items[0].productName).toBe("Artikel, eins");
  });

  it("erzeugt für wiederholte Dateien stabile Fingerabdrücke", () => {
    const one = parseAmazonOrderHistory(`${header}\n${first}`).items[0];
    const two = parseAmazonOrderHistory(`${header}\n${first}`).items[0];
    expect(one.fingerprint).toBe(two.fingerprint);
  });

  it("verwirft unbekannte private Exportfelder", () => {
    const privateHeader = `${header},Billing Address,Gift Message,Payment Method Type`;
    const result = parseAmazonOrderHistory(`${privateHeader}\n${first},Privat,Geheim,Karte`);
    expect(result.items[0]).not.toHaveProperty("Billing Address");
    expect(JSON.stringify(result.items[0])).not.toContain("Geheim");
  });

  it("meldet fehlende Amazon-Pflichtspalten verständlich", () => {
    expect(() => parseAmazonOrderHistory("Order ID,Product Name\n1,Test")).toThrow("Notwendige Spalten fehlen");
  });
});
