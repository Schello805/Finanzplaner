import { describe, expect, it } from "vitest";
import { findDuplicates, isPendingTransaction, parseBankCsv } from "./parser";
import { sparkasseCamtV8 } from "./sparkasse-camt-v8";
import { paypalActivity } from "./paypal-activity";
import { sparkasseCreditCard } from "./sparkasse-credit-card";

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
  it("behandelt gleiche Buchungen trotz geändertem Dateifingerabdruck als sichere Dublette", () => {
    const tx = parseBankCsv(`${header}\n${row}`, sparkasseCamtV8).transactions[0];
    const changed = { ...tx, fingerprint: "anderer-export-fingerprint" };
    expect(findDuplicates([changed], [tx])).toMatchObject({ exact: [changed], suspected: [] });
  });
  it("erkennt dieselbe Bankreferenz auch bei nachträglich verschobenem Buchungstag", () => {
    const tx = parseBankCsv(`${header}\n${row}`, sparkasseCamtV8).transactions[0];
    const shifted = { ...tx, bookedOn: "2026-08-02", valuedOn: "2026-08-02", fingerprint: "shifted" };
    expect(findDuplicates([shifted], [tx])).toMatchObject({ exact: [shifted], accepted: [], suspected: [] });
  });
  it("verwechselt generische Referenzen an verschiedenen Tagen nicht mit Dubletten", () => {
    const tx = parseBankCsv(`${header}\n${row.replace("REF-001", "NOTPROVIDED")}`, sparkasseCamtV8).transactions[0];
    const later = { ...tx, bookedOn: "2026-08-02", valuedOn: "2026-08-02", fingerprint: "later" };
    expect(findDuplicates([later], [tx]).accepted).toEqual([later]);
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
  it("verwirft unmögliche Kalendertage statt sie in einen anderen Monat zu verschieben",()=>{
    const invalid=row.replaceAll("01.08.2026","31.02.2026");
    expect(()=>parseBankCsv(`${header}\n${invalid}`,sparkasseCamtV8)).toThrow("Ungültiges Datum");
  });
  it("behandelt einen leeren Betrag nicht als Nullbuchung",()=>{
    const invalid=row.replace('"-42,50"','');
    expect(()=>parseBankCsv(`${header}\n${invalid}`,sparkasseCamtV8)).toThrow("Ungültiger Betrag");
  });
  it("verhindert das Addieren unterschiedlicher Währungen",()=>{
    const invalid=row.replace(",EUR,",",USD,");
    expect(()=>parseBankCsv(`${header}\n${invalid}`,sparkasseCamtV8)).toThrow("ausschließlich in EUR");
  });
  it("erkennt nur den eindeutigen Sparkassen-Platzhalter als vorgemerkt", () => {
    expect(isPendingTransaction({ counterparty: "**Unbekannt" })).toBe(true);
    expect(isPendingTransaction({ counterparty: "  ** unbekannt vorgemerkt " })).toBe(true);
    expect(isPendingTransaction({ counterparty: "Unbekannt" })).toBe(false);
    expect(isPendingTransaction({ counterparty: undefined })).toBe(false);
    expect(isPendingTransaction({ counterparty: undefined, originalData: { Info: "Umsatz vorgemerkt" } })).toBe(true);
    expect(isPendingTransaction({ counterparty: undefined, bookingType: "SONSTIGER EINZUG", purpose: "MO 12345678 0101" })).toBe(true);
    expect(isPendingTransaction({ counterparty: undefined, bookingType: "ENTGELTABSCHLUSS", purpose: "Pauschalen" })).toBe(false);
  });
});

describe("PayPal-Aktivitätsbericht", () => {
  it("importiert nur abgeschlossene Bewegungen und nutzt die eindeutige Transaktionsnummer", () => {
    const csv = [
      "Datum,Name,Typ,Status,Währung,Netto,Transaktionscode,Betreff",
      '05.09.2026,Beispiel GmbH,Zahlung,Abgeschlossen,EUR,"-12,34",PAYPAL-123,Einkauf',
      '06.09.2026,Offene Zahlung,Zahlung,Offen,EUR,"-3,00",PAYPAL-456,Offen',
    ].join("\n");
    const result = parseBankCsv(csv, paypalActivity);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0]).toMatchObject({
      amount: -12.34,
      counterparty: "Beispiel GmbH",
      bankReference: "PAYPAL-123",
    });
  });

  it("akzeptiert die offiziellen englischen Spaltennamen", () => {
    const csv = 'Date,Name,Type,Status,Currency,Net,Transaction ID,Subject\n05.09.2026,Example Ltd,Payment,Completed,EUR,"-1,25",TX-1,Order';
    expect(parseBankCsv(csv, paypalActivity).transactions).toHaveLength(1);
  });
});

describe("Sparkassen-Kreditkartenumsätze", () => {
  it("übernimmt Händler, Zusatztext, Referenz und gebuchten Eurobetrag", () => {
    const csv = [
      "Umsatz getätigt von;Belegdatum;Buchungsdatum;Originalbetrag;Originalwährung;Umrechnungskurs;Buchungsbetrag;Buchungswährung;Transaktionsbeschreibung;Transaktionsbeschreibung Zusatz;Buchungsreferenz;Gebührenschlüssel;Länderkennzeichen;BAR-Entgelt+Buchungsreferenz;AEE+Buchungsreferenz;Abrechnungskennzeichen",
      "MICHAEL;01.09.26;03.09.26;12,00;EUR;1,000000;-12,00;EUR;BEISPIEL HÄNDLER;NÜRNBERG;REF-123456;;DE;;;Belastung",
    ].join("\n");
    expect(parseBankCsv(csv, sparkasseCreditCard).transactions[0]).toMatchObject({
      bookedOn: "2026-09-03",
      valuedOn: "2026-09-01",
      counterparty: "BEISPIEL HÄNDLER",
      purpose: "NÜRNBERG",
      bankReference: "REF-123456",
      amount: -12,
      currency: "EUR",
      direction: "expense",
    });
  });

  it("behandelt eine positive Kartengutschrift als Einnahme", () => {
    const csv = "Buchungsdatum;Buchungsbetrag;Buchungswährung;Transaktionsbeschreibung\n03.09.2026;12,00;EUR;ERSTATTUNG HÄNDLER";
    expect(parseBankCsv(csv, sparkasseCreditCard).transactions[0].direction).toBe("income");
  });
});
