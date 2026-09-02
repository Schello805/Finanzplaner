# Änderungsprotokoll

Dieses Projekt verwendet [Semantic Versioning](https://semver.org/lang/de/).

## [Unreleased]

- Funktionale Umsatzfilter für Kategorien und Buchungsarten sowie direkter Zugriff auf die Kategorieverwaltung
- Sichtbarkeitsschalter jetzt auch für zentral verwaltete KI-API-Schlüssel

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
- robuste automatische Trennzeichenerkennung für echte Sparkassen-CAMT-V8-Dateien
- responsive HTML-E-Mails mit Aktionsschaltfläche und Klartext-Alternative
- persönliche, dauerhaft gespeicherte KI-Einwilligungen und automatischer Kategorisierungslauf
- Umsatzdetails mit Notizen, Schlagwörtern und Ausschluss aus Analysen
- sicherer Passwort-Reset per einmaligem, 30 Minuten gültigem HTML-Mail-Link
- beschleunigte Updates durch Überspringen unveränderter Node-Abhängigkeiten
- persönliche Reset-E-Mail-Adresse im Benutzerprofil
- optionale TOTP-Zwei-Faktor-Anmeldung mit QR-Code und Authenticator-App
- entkoppelter, fehlertoleranter Loginpfad für Benutzer ohne aktivierte 2FA
- echte KI-Ausgabenhinweise aus datensparsamen Kategoriesummen mit Kostenanzeige und Sprachausgabe
- validierte Kategorieaufteilungen sowie Verknüpfung und Kennzeichnung von Erstattungen und Umbuchungen
- vollständige Adminverwaltung für eigene, testpflichtige Bank-Importvorlagen
- korrekte Analyseberechnung für Kategorieaufteilungen und ausgabenmindernde Erstattungen
- echter Importverlauf und persönliche Kategorienverwaltung
- Passwortanzeige auch bei Passwortwechsel, Einladung und SMTP-Konfiguration
- Admin-Steuerung für Benutzerstatus und Administratorrollen mit Schutz des letzten Admins
