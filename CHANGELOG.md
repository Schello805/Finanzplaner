# Änderungsprotokoll

Dieses Projekt verwendet [Semantic Versioning](https://semver.org/lang/de/).

## [Unreleased]

### Hinzugefügt

- initiale responsive PWA und Analyseoberfläche
- PostgreSQL-Datenmodell für Haushalte, Erwachsene, Kinder, Konten und Umsätze
- Sparkasse CSV-CAMT-V8-Parser und Dublettenerkennung
- OpenAI- und Gemini-Adapter mit Datenschutzfilter und Kostenschätzung
- native Ubuntu-Installation mit systemd, PostgreSQL und UFW
- buildbasierte Revision im Footer
- geführte Ersteinrichtung mit Haushalt und Standardkategorien
- persistente Kontoanlage für persönliche und gemeinsame Konten
- durchgängige CSV-Importvorschau mit verschlüsselten Originalfeldern
- Datenbank-Endpunkte für verwaltete Kinderprofile und Sorgeberechtigte
- wiederholbarer Ubuntu-Installer mit korrekter Übergabe der Datenbankverbindung an Migrationen
- gut sichtbare Update-Anleitung direkt in der README
- Update ohne Backup-Rückfrage und automatische Git-Freigabe des festen Installationspfads
- einblendbares Passwortfeld mit zugänglicher Augen-Schaltfläche bei der Anmeldung
- gezielte, widerrufbare Freigabe persönlicher Konten an andere Erwachsene im Haushalt
