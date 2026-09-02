import { describe, expect, it } from "vitest";
import { findDuplicates, parseBankCsv } from "./parser";
import { sparkasseCamtV8 } from "./sparkasse-camt-v8";

const header = "Auftragskonto,Buchungstag,Valutadatum,Buchungstext,Verwendungszweck,Glaeubiger ID,Mandatsreferenz,Kundenreferenz (End-to-End),Sammlerreferenz,Lastschrift Ursprungsbetrag,Auslagenersatz Ruecklastschrift,Beguenstigter/Zahlungspflichtiger,Kontonummer/IBAN,BIC (SWIFT-Code),Betrag,Waehrung,Info";
const row = 'DE00123456780000000000,01.08.2026,01.08.2026,KARTENZAHLUNG,"Einkauf Testmarkt",,,REF-001,,,,Testmarkt,DE00999999999999999999,TESTDEFFXXX,"-42,50",EUR,Umsatz gebucht';

describe("Sparkasse CAMT V8", () => {
  it("parst Beträge, Daten und Leerzeilen robust", () => {
    const result = parseBankCsv(`\uFEFF${header}\n${row}\n,,,,,,,,,,,,,,,,\n`, sparkasseCamtV8);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0]).toMatchObject({ amount: -42.5, bookedOn: "2026-08-01", direction: "expense", currency: "EUR" });
    expect(result.skippedEmptyRows).toBeGreaterThan(0);
  });
  it("filtert exakte Dubletten", () => {
    const tx = parseBankCsv(`${header}\n${row}`, sparkasseCamtV8).transactions[0];
    expect(findDuplicates([tx], [tx]).exact).toHaveLength(1);
  });
  it("erkennt das von der Sparkasse verwendete Semikolon auch bei einer alten Vorlageneinstellung", () => {
    const semicolonHeader = header.replaceAll(",", ";");
    const semicolonRow = 'DE00123456780000000000;01.08.2026;01.08.2026;KARTENZAHLUNG;"Einkauf, Testmarkt";;;REF-001;;;;Testmarkt;DE00999999999999999999;TESTDEFFXXX;"-42,50";EUR;Umsatz gebucht';
    const result = parseBankCsv(`${semicolonHeader}\n${semicolonRow}`, {...sparkasseCamtV8, delimiter: ","});
    expect(result.transactions[0]).toMatchObject({amount: -42.5, purpose: "Einkauf, Testmarkt"});
  });
  it("verarbeitet das zweistellige Jahr aus aktuellen Sparkassen-Exporten", () => {
    const shortDateRow = row.replaceAll("01.08.2026", "01.08.26");
    expect(parseBankCsv(`${header}\n${shortDateRow}`, sparkasseCamtV8).transactions[0].bookedOn).toBe("2026-08-01");
  });
  it("bricht bei fehlenden Pflichtspalten verständlich ab", () => {
    expect(() => parseBankCsv("Datum,Betrag\n01.08.2026,-2", sparkasseCamtV8)).toThrow("Notwendige Spalten fehlen");
  });
  it("überspringt Vorspannzeilen bis zur konfigurierten Kopfzeile", () => {
    const result = parseBankCsv(`Export der Musterbank\nErstellt am 02.09.2026\n${header}\n${row}`, {
      ...sparkasseCamtV8,
      headerRow: 3,
    });
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].amount).toBe(-42.5);
  });
  it("meldet die ursprüngliche CSV-Zeilennummer trotz Vorspann", () => {
    const invalid = row.replace('"-42,50"', "ungültig");
    expect(() => parseBankCsv(`Hinweis\n${header}\n${invalid}`, {...sparkasseCamtV8, headerRow: 2})).toThrow("Zeile 3");
  });
});
