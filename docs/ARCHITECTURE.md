# Architektur

Finanzplaner ist ein modularer TypeScript-Monolith. Diese Struktur hält Installation und Betrieb im einzelnen LXC einfach, trennt Fachlogik aber so, dass Module später als Dienste ausgelagert werden können.

## Bausteine

- **Next.js:** serverseitige Weboberfläche, PWA und HTTP-API
- **PostgreSQL:** Benutzer, Haushalte, Konten, normalisierte Umsätze und Konfiguration
- **Drizzle ORM:** typisiertes Schema und versionierte Migrationen
- **systemd:** Prozessverwaltung und Neustart bei Fehlern
- **UFW:** Begrenzung des HTTP-Zugriffs auf das lokale Subnetz

## Fachmodule

- `src/features/import`: deklarative Bankvorlagen, Parser, Normalisierung und Dubletten
- `src/features/analytics`: deterministische Monats- und Kategorieauswertungen
- `src/features/ai`: Datenschutzfilter, Anbieteradapter und Kostenschätzung
- `src/lib/security`: Argon2id, AES-256-GCM, HIBP-k-Anonymity und Fingerprints
- `src/db`: Datenmodell und Relationen

## Datenfluss beim Import

1. Dateityp und Größe prüfen.
2. Dateifingerabdruck mit früheren Imports vergleichen.
3. passende, aktivierte Importvorlage auswählen.
4. alle Zeilen in einer Datenbanktransaktion validieren und normalisieren.
5. eindeutige Bankreferenzen und stabile Fingerprints vergleichen.
6. exakte Dubletten überspringen; ähnliche Buchungen zur Prüfung stellen.
7. bestätigte Händlerregeln und eindeutige Buchungstexte lokal anwenden.
8. verbleibende Vorschläge einzeln oder gesammelt bestätigen lassen.
9. temporäre Originaldatei entfernen.
10. optional nicht zugeordnete Umsätze nach Einwilligung an KI übergeben.

## Vertrauensgrenzen

CSV-Felder und KI-Ausgaben gelten immer als nicht vertrauenswürdige Daten. CSV-Inhalte werden nie als Prompt-Anweisungen interpretiert. KI-Antworten müssen ein festes Schema erfüllen und dürfen Betrag, Datum oder Umsatz-ID nicht verändern. Finanzberechnungen entstehen ausschließlich lokal.

## Revisionen

`APP_VERSION` wird beim Installieren oder Aktualisieren aus der SemVer-Version in `package.json` erzeugt. Der Footer verlinkt auf das gleichnamige GitHub-Release. Das Updateskript zeigt zusätzlich den exakten Git-Commit für die technische Nachvollziehbarkeit an.
