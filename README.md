# Finanzplaner

Finanzplaner ist eine private, deutschsprachige Ausgabenanalyse für Familien. Die Anwendung importiert Kontoauszüge, entfernt Dubletten, ordnet Umsätze Kategorien zu und zeigt verständlich, wofür Geld ausgegeben wurde. Persönliche Konten, Gemeinschaftskonten und verwaltete Kinderkonten werden mit getrennten Berechtigungen abgebildet.

> Status: aktive Entwicklung. Vor dem produktiven Einsatz mit echten Finanzdaten bitte die Sicherheitshinweise prüfen.

## Wichtigste Funktionen

- Sparkasse CSV-CAMT V8 und PayPal-Aktivitätsbericht als mitgelieferte Importvorlagen
- Kreditkarten-CSV über CAMT V8 oder eine einmalig im Adminbereich definierte anbieterspezifische Vorlage
- Amazon-„Order History.csv“-Import mit artikelweiser Kategorisierung und Zuordnung zu Bankbuchungen
- visueller, versionierter Importformat-Designer für weitere Banken
- exakte Dubletten automatisch überspringen, Verdachtsfälle manuell entscheiden
- persönliche, gemeinsame und verwaltete Kinderkonten
- Kategorien, Unterkategorien, Tags, Aufteilungen, Rückerstattungen und Umbuchungen
- interne Geldverschiebungen paarweise verknüpfen und konsequent aus Einnahmen, Ausgaben, KI-Analyse und wiederkehrenden Kosten ausschließen
- bearbeitbare Händlerregeln mit wahlweise zukünftiger oder rückwirkender Anwendung
- Erkennung wiederkehrender Kosten, Abos und auffälliger Preisänderungen
- Datenqualitätsübersicht mit Importstand, Zeiträumen und offenen Zuordnungen je Konto
- Top-5-Analyse: letzter vollständiger Monat gegen den Durchschnitt der vorherigen zwölf Monate
- aktueller Monat als Anteil des üblichen Monatswerts
- optionale OpenAI- oder Gemini-Kategorisierung mit Übertragungsvorschau
- natürliche deutsche Sprachausgabe über Gemini TTS
- zentrale Administration ohne Zugriff auf private Finanzinhalte
- installierbare PWA für Desktop, Tablet und Smartphone

## Zielplattform

- unprivilegierter Proxmox-LXC
- Ubuntu Server 24.04 LTS
- native Installation ohne Docker und Reverse Proxy
- HTTP auf Port 8080, ausschließlich in einem vertrauenswürdigen lokalen Netz
- PostgreSQL auf `127.0.0.1`

HTTP verschlüsselt Passwörter und Finanzdaten nicht. Der vorgesehene Betrieb setzt deshalb ein isoliertes, vertrauenswürdiges Heimnetz und eine auf das lokale Subnetz begrenzte Firewall-Regel voraus. Niemals öffentlich ins Internet weiterleiten.

## Empfohlener Monatsablauf

1. Auf der Analyseseite „Neuen Kontoauszug auswerten“ wählen und die aktuelle Bank-CSV importieren.
2. Die Vorschau prüft Dubletten, Vormerkungen und im neuen Export fehlende Buchungen. Löschungen erfolgen ausschließlich nach Auswahl und Rückfrage.
3. Bereits bestätigte Händler, gelernte Kombinationen aus Händler und Buchungstext sowie eindeutige Abos werden lokal und ohne API-Kosten zugeordnet. Nur der verbleibende Rest wird an die KI übergeben.
4. Die KI arbeitet transparent in Stapeln zu je 25 Umsätzen. Runde und Gesamtfortschritt sind sichtbar; mit aktivierter Automatik laufen alle Stapel nacheinander durch.
5. In den persönlichen KI-Einstellungen festlegen, ob alle Vorschläge bestätigt werden oder Treffer ab 90 beziehungsweise 70 Prozent automatisch übernommen werden dürfen. Andere Vorschläge einzeln, gesammelt oder später prüfen.
6. Weist die App danach offene Amazon-, PayPal- oder Kreditkarten-Sammelzahlungen aus, den passenden Zusatzexport hochladen oder die Buchung manuell zuordnen. Amazon verwendet dafür `Order History.csv`.
7. Zur Analyseseite zurückkehren. Sie vergleicht den letzten vollständigen Monat mit bis zu zwölf Vormonaten und zeigt den aktuellen Monat als Anteil des üblichen Monatswerts. Eine spekulative Hochrechnung wird bewusst nicht angezeigt.

Amazon und PayPal gelten als Sammelzahlungsanbieter und erhalten bewusst keine pauschale lokale Händlerregel. Amazon-Artikel werden stattdessen einzeln über den Bestellimport zugeordnet.

Überweisungen zwischen eigenen Konten – regelmäßige Haushaltsbeiträge ebenso wie einmalige Nachzahlungen – werden als „Interne Umbuchung (nicht auswerten)“ markiert. Sie bleiben in beiden Konten nachvollziehbar sichtbar, fließen aber nicht in die Analyse ein. Nur eine spätere Zahlung an einen externen Empfänger zählt als Ausgabe.

## Installation

Im neuen Ubuntu-24.04-LXC als `root`:

```bash
apt-get update && apt-get install -y git
git clone https://github.com/Schello805/Finanzplaner.git /opt/finanzplaner
cd /opt/finanzplaner
./scripts/install-ubuntu.sh
```

Der geführte Assistent fragt nach lokalem Subnetz (mit erkanntem Beispielwert und Erklärung), App-Port, Admin-E-Mail und Anzeigename. Danach installiert das Skript Node.js, PostgreSQL und UFW, begrenzt den Zugriff per Firewall auf dein Heimnetz, erstellt den Benutzer `admin` mit einem zufälligen Einmalpasswort und zeigt anschließend IP, Port und Zugangsdaten. Das Passwort muss beim ersten Login geändert werden.

Ausführliche Hinweise: [docs/INSTALLATION.md](docs/INSTALLATION.md)

## Updates

Ein Proxmox-Snapshot oder vollständiges LXC-Backup vor dem Update wird empfohlen, aber vom Skript nicht vorausgesetzt. Starte im Container:

```bash
sudo /opt/finanzplaner/scripts/update.sh
```

Das Updateskript installiert Node-Abhängigkeiten nur dann neu, wenn sich die Sperrdatei geändert hat. Datenbankmigrationen, Produktionsbuild, Neustart und Dienstprüfung werden weiterhin bei jedem Update zuverlässig ausgeführt.

Das Skript lädt den aktuellen `main`-Stand, installiert exakt die festgeschriebenen Abhängigkeiten, führt Datenbankmigrationen aus, baut die App neu und startet den Dienst. Nach erfolgreichem Abschluss zeigt es die SemVer-Version, technische Git-Revision, Dienststatus sowie IP-Adresse und Port an. Der Footer verwendet die echte Release-Version. Updates werden niemals automatisch installiert.

Wenn eine ältere Erstinstallation abgebrochen ist, verwende stattdessen erneut den Installationsbefehl aus dem vorherigen Abschnitt.

## Lokale Entwicklung

Voraussetzungen: Node.js 20.19 oder neuer und PostgreSQL 16 oder neuer.

```bash
cp .env.example .env
npm install
npm run db:migrate
node scripts/init-admin.mjs
npm run dev
```

Qualitätsprüfungen:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

## Datenschutz

Die Original-CSV wird nur temporär verarbeitet und nicht als Datei gespeichert. Normalisierte Umsätze verbleiben in der lokalen PostgreSQL-Datenbank. Beim Amazon-Import werden Bestellnummer und Artikelname verschlüsselt; Adressen, Zahlungsdetails, Tracking, Geschenknachrichten und Seriennummern werden verworfen. KI-Aufrufe sind optional. Vor einer manuellen Anfrage zeigt die App den bereinigten Datensatz und eine Kostenschätzung. IBANs, API-Schlüssel und technische Geheimnisse werden nie an einen KI-Anbieter gesendet.

Details stehen in [docs/PRIVACY.md](docs/PRIVACY.md) und [SECURITY.md](SECURITY.md).

## Sparkasse direkt verbinden

Unter **Einstellungen → Sparkasse verbinden** führt ein Assistent durch die lesende FinTS-Einrichtung. Benötigt werden eine einmalig für den Finanzplaner registrierte FinTS-Produkt-ID, die BLZ und FinTS-URL der Sparkasse sowie die üblichen Online-Banking-Zugangsdaten. Alle Felder enthalten Hilfetexte zur Beschaffung der Angaben. Nach der Kontozuordnung können die letzten 90 Tage direkt abgerufen werden; Dubletten werden nicht erneut angelegt und sichere lokale Regeln sofort angewendet.

Der Finanzplaner implementiert keine Überweisungen. Zugangsdaten werden lokal verschlüsselt gespeichert und nur direkt an den konfigurierten HTTPS-Endpunkt der Sparkasse übertragen. Je nach Sparkasse kann für Einrichtung oder Abruf eine TAN beziehungsweise eine Freigabe in der pushTAN-App erforderlich sein.

## Dokumentation

- [Architektur](docs/ARCHITECTURE.md)
- [Verbindliche Berechnungsregeln](docs/BERECHNUNGEN.md)
- [Mehrkonten-Prüfplan](docs/MEHRKONTEN-PRUEFPLAN.md)
- [Installation und Updates](docs/INSTALLATION.md)
- [Berechtigungsmodell](docs/PERMISSIONS.md)
- [Datenschutz](docs/PRIVACY.md)
- [Beitragen](CONTRIBUTING.md)
- [Änderungen](CHANGELOG.md)
- [Hinweise zu Drittanbieter-Software](THIRD_PARTY_NOTICES.md)

## Lizenz

Copyright 2026 Michael Schellenberger. Der Quellcode ist unter der [PolyForm Noncommercial License 1.0.0](LICENSE) für nichtkommerzielle Zwecke verfügbar. Wegen des Verbots kommerzieller Nutzung handelt es sich rechtlich um „source-available“, nicht um eine OSI-zertifizierte Open-Source-Lizenz.
