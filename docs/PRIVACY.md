# Datenschutzkonzept

Finanzplaner ist für den lokalen Familienbetrieb bestimmt. Es findet keine Telemetrie statt.

## Lokal gespeicherte Daten

Normalisierte Umsätze, Kategorien, Regeln und Analyseergebnisse liegen in PostgreSQL. IBANs werden verschlüsselt gespeichert und nur maskiert angezeigt. Suchfingerprints sind nicht umkehrbar. Original-CSV-Dateien werden nach erfolgreichem Import gelöscht.

Amazon-Bestellexporte werden nur im Arbeitsspeicher verarbeitet. Gespeichert werden ausschließlich die für Artikelkategorisierung und Bankabgleich notwendigen Felder. Bestellnummern und Artikelnamen sind mit AES-256-GCM verschlüsselt. Liefer- und Rechnungsadressen, Zahlungsdetails, Trackingnummern, Geschenknachrichten, Empfängerkontakte und Seriennummern werden nicht übernommen.

## KI-Anbieter

OpenAI und Gemini sind optional. Der Administrator hinterlegt zentrale API-Schlüssel verschlüsselt. Genau ein Anbieter ist Standard; ein automatischer stiller Anbieterwechsel findet nicht statt.

Vor manuellen Aufrufen zeigt die App:

- Zweck, Anbieter und Modell;
- exakten bereinigten Datensatz;
- voraussichtliche Tokenmenge und Kostenspanne;
- gewählten Datenschutzmodus.

Im datensparsamen Modus werden Identifikatoren und erkennbare Personennamen entfernt. Der erweiterte Modus kann vollständige Buchungstexte enthalten, entfernt aber weiterhin IBANs und technische Geheimnisse. Rohe Prompts und Antworten werden nicht dauerhaft gespeichert.

## Protokoll

Es gibt ein gemeinsames, filter- und sortierbares Adminprotokoll mit 90 Tagen Aufbewahrung. Passwörter, API-Schlüssel, IBANs, Verwendungszwecke, Prompts und KI-Rohantworten sind ausgeschlossen.

## E-Mail

SMTP-Nachrichten enthalten keine Kontostände oder Buchungsdetails. Sie dienen Einladungen, Passwort-Reset, Sicherheits- und Systemmeldungen.
