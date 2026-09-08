import { describe, expect, it } from "vitest";
import { paypalActivity } from "./paypal-activity";
import { sparkasseCamtV8 } from "./sparkasse-camt-v8";
import { sparkasseCreditCard } from "./sparkasse-credit-card";
import { resolveImportTemplate } from "./template-detection";

const candidates = [sparkasseCamtV8, sparkasseCreditCard, paypalActivity].map(
  (template) => ({ storedId: `stored-${template.id}`, template }),
);

describe("Importvorlagen-Erkennung", () => {
  it("erkennt einen PayPal-Bericht trotz ausgewählter Kreditkartenvorlage", () => {
    const csv = [
      "Datum,Name,Typ,Status,Währung,Netto,Transaktionscode,Betreff",
      '05.09.2026,Beispiel GmbH,Zahlung,Abgeschlossen,EUR,"-12,34",PP-DEMO-1,Beispielartikel',
    ].join("\n");
    const selected = candidates.find((item) => item.template === sparkasseCreditCard)!;

    const result = resolveImportTemplate(
      new TextEncoder().encode(csv),
      selected,
      candidates,
    );

    expect(result.autoDetected).toBe(true);
    expect(result.template).toBe(paypalActivity);
    expect(result.parsed.transactions).toHaveLength(1);
  });

  it("behält die gewählte Vorlage, wenn sie zur Datei passt", () => {
    const csv = [
      "Buchungsdatum;Buchungsbetrag;Buchungswährung;Transaktionsbeschreibung;Transaktionsbeschreibung Zusatz",
      '03.09.2026;"-12,00";EUR;BEISPIEL HÄNDLER;TESTORT',
    ].join("\n");
    const selected = candidates.find((item) => item.template === sparkasseCreditCard)!;

    const result = resolveImportTemplate(
      new Uint8Array(Buffer.from(csv, "latin1")),
      selected,
      candidates,
    );

    expect(result.autoDetected).toBe(false);
    expect(result.template).toBe(sparkasseCreditCard);
  });

  it("erkennt einen Sparkassen-Kreditkartenexport trotz ausgewählter PayPal-Vorlage", () => {
    const csv = [
      "Umsatz getätigt von;Belegdatum;Buchungsdatum;Originalbetrag;Originalwährung;Umrechnungskurs;Buchungsbetrag;Buchungswährung;Transaktionsbeschreibung;Transaktionsbeschreibung Zusatz;Buchungsreferenz;Gebührenschlüssel;Länderkennzeichen;BAR-Entgelt+Buchungsreferenz;AEE+Buchungsreferenz;Abrechnungskennzeichen",
      'BEISPIELPERSON;01.09.26;03.09.26;"12,00";EUR;1,000000;"-12,00";EUR;BEISPIEL HÄNDLER;TESTORT;REF-DEMO-1;;DE;;;Belastung',
    ].join("\n");
    const selected = candidates.find((item) => item.template === paypalActivity)!;

    const result = resolveImportTemplate(
      new Uint8Array(Buffer.from(csv, "latin1")),
      selected,
      candidates,
    );

    expect(result.autoDetected).toBe(true);
    expect(result.template).toBe(sparkasseCreditCard);
    expect(result.parsed.transactions).toHaveLength(1);
  });
});
