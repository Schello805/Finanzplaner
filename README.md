# Finanzplaner

Finanzplaner ist eine private, deutschsprachige Ausgabenanalyse für Familien. Die Anwendung importiert Kontoauszüge, entfernt Dubletten, ordnet Umsätze Kategorien zu und zeigt verständlich, wofür Geld ausgegeben wurde. Persönliche Konten, Gemeinschaftskonten und verwaltete Kinderkonten werden mit getrennten Berechtigungen abgebildet.

> Status: frühe Entwicklung (`0.1.0`). Ersteinrichtung, Kontoanlage und Sparkassen-Import sind bereits mit PostgreSQL verbunden. Vor dem produktiven Einsatz mit echten Finanzdaten bitte die offenen Punkte und Sicherheitshinweise prüfen.

## Wichtigste Funktionen

- Sparkasse CSV-CAMT V8 als mitgelieferte Importvorlage
- visueller, versionierter Importformat-Designer für weitere Banken
- exakte Dubletten automatisch überspringen, Verdachtsfälle manuell entscheiden
- persönliche, gemeinsame und verwaltete Kinderkonten
- Kategorien, Unterkategorien, Tags, Aufteilungen, Rückerstattungen und Umbuchungen
- Top-5-Analyse: letzter vollständiger Monat gegen den Durchschnitt der vorherigen zwölf Monate
- aktueller Monat als Anteil des üblichen Monatswerts
- optionale OpenAI- oder Gemini-Kategorisierung mit Übertragungsvorschau
- lokale Sprachausgabe über den Browser
- zentrale Administration ohne Zugriff auf private Finanzinhalte
- installierbare PWA für Desktop, Tablet und Smartphone

## Zielplattform

- unprivilegierter Proxmox-LXC
- Ubuntu Server 24.04 LTS
- native Installation ohne Docker und Reverse Proxy
- HTTP auf Port 8080, ausschließlich in einem vertrauenswürdigen lokalen Netz
- PostgreSQL auf `127.0.0.1`

HTTP verschlüsselt Passwörter und Finanzdaten nicht. Der vorgesehene Betrieb setzt deshalb ein isoliertes, vertrauenswürdiges Heimnetz und eine auf das lokale Subnetz begrenzte Firewall-Regel voraus. Niemals öffentlich ins Internet weiterleiten.

## Installation

Im neuen Ubuntu-24.04-LXC als `root`:

```bash
apt-get update && apt-get install -y git
git clone https://github.com/Schello805/Finanzplaner.git /opt/finanzplaner
cd /opt/finanzplaner
FINANZPLANER_SUBNET=192.168.1.0/24 ./scripts/install-ubuntu.sh
```

Das Skript installiert Node.js, PostgreSQL und UFW, erstellt den Benutzer `admin` mit einem zufälligen Einmalpasswort und zeigt anschließend IP, Port und Zugangsdaten. Das Passwort muss beim ersten Login geändert werden.

Ausführliche Hinweise: [docs/INSTALLATION.md](docs/INSTALLATION.md)

## Updates

Ein Proxmox-Snapshot oder vollständiges LXC-Backup vor dem Update wird empfohlen, aber vom Skript nicht vorausgesetzt. Starte im Container:

```bash
sudo /opt/finanzplaner/scripts/update.sh
```

Das Updateskript installiert Node-Abhängigkeiten nur dann neu, wenn sich die Sperrdatei geändert hat. Datenbankmigrationen, Produktionsbuild, Neustart und Dienstprüfung werden weiterhin bei jedem Update zuverlässig ausgeführt.

Das Skript lädt den aktuellen `main`-Stand, installiert exakt die festgeschriebenen Abhängigkeiten, führt Datenbankmigrationen aus, baut die App neu und startet den Dienst. Nach erfolgreichem Abschluss zeigt es Revision, Dienststatus sowie IP-Adresse und Port an. Updates werden niemals automatisch installiert.

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

Die Original-CSV wird nur temporär verarbeitet und nach erfolgreichem Import entfernt. Normalisierte Umsätze verbleiben in der lokalen PostgreSQL-Datenbank. KI-Aufrufe sind optional. Vor einer manuellen Anfrage zeigt die App den bereinigten Datensatz und eine Kostenschätzung. IBANs, API-Schlüssel und technische Geheimnisse werden nie an einen KI-Anbieter gesendet.

Details stehen in [docs/PRIVACY.md](docs/PRIVACY.md) und [SECURITY.md](SECURITY.md).

## Dokumentation

- [Architektur](docs/ARCHITECTURE.md)
- [Installation und Updates](docs/INSTALLATION.md)
- [Berechtigungsmodell](docs/PERMISSIONS.md)
- [Datenschutz](docs/PRIVACY.md)
- [Beitragen](CONTRIBUTING.md)
- [Änderungen](CHANGELOG.md)

## Lizenz

Copyright 2026 Michael Schellenberger. Der Quellcode ist unter der [PolyForm Noncommercial License 1.0.0](LICENSE) für nichtkommerzielle Zwecke verfügbar. Wegen des Verbots kommerzieller Nutzung handelt es sich rechtlich um „source-available“, nicht um eine OSI-zertifizierte Open-Source-Lizenz.
