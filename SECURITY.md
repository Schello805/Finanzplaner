# Sicherheit

## Schwachstellen melden

Bitte veröffentliche vermutete Sicherheitslücken nicht als öffentliches Issue. Kontaktiere den Maintainer zunächst privat über das GitHub-Profil von [Michael Schellenberger](https://github.com/Schello805). Gib betroffene Revision, reproduzierbare Schritte und mögliche Auswirkungen an, aber keine echten Finanzdaten oder Zugangsdaten.

## Sicherheitsmodell

- Argon2id für Passwörter
- mindestens acht Zeichen und HIBP-Prüfung via k-Anonymity
- AES-256-GCM für API-Schlüssel und IBANs
- HTTP-only/SameSite-Sitzungscookies
- PostgreSQL ausschließlich auf localhost
- bereinigte Logs mit 90 Tagen Aufbewahrung
- Adminrolle ohne automatischen Finanzzugriff

Die optionale 2FA und serverseitige Rate-Limitierung sind vor einem stabilen Release vollständig zu verifizieren. HTTP im LAN schützt nicht gegen Mitschneiden durch andere Geräte im selben Netz.
