# Änderungsprotokoll

Dieses Projekt verwendet [Semantic Versioning](https://semver.org/lang/de/).

## [Unreleased]

## [0.2.4] - 2026-09-05

- Die Hochrechnung des laufenden Monats folgt jetzt dem tatsächlichen Ausgabenverlauf der letzten bis zu zwölf vollständigen Monate statt einer linearen Kalendertag-Multiplikation. Zukünftige Buchungen werden ausgeschlossen; Ring- und Balkendiagramm zeigen Werte direkt an.
## [0.2.3] - 2026-09-05

- Vorgemerkte Sparkassen-Zeilen werden nun am Feld `Info: Umsatz vorgemerkt` erkannt; 0,00-€-Zeilen werden ebenfalls nicht importiert. Bereits gespeicherte Vormerkungen und Nullbuchungen lassen sich gezielt bereinigen.
- Das Update entfernt bereits gespeicherte Vormerkungen und Nullbuchungen einmalig. Gebuchte Zinsen und Kontoführungsgebühren ohne Empfänger bleiben erhalten und werden in der Umsatzliste verständlich benannt.
## [0.2.2] - 2026-09-05

- Tages- und Teilauszüge erzeugen keine unsicheren Löschvorschläge mehr; der Import zeigt stattdessen einen Sicherheitshinweis und prüft neue Umsätze sowie Dubletten weiterhin normal.
- Buchungen mit übereinstimmendem Datum, Betrag, Währung, Empfänger und stabiler Referenz oder identischem Verwendungszweck gelten auch bei verändertem Exportfingerabdruck als sichere Dubletten.
## [0.2.1] - 2026-09-05

- Der Bestandsabgleich meldet Buchungen nicht mehr fälschlich als fehlend, wenn Sparkasse Empfänger oder Buchungstext anders formatiert; entscheidend sind Datum, Betrag und Währung.
## [0.2.0] - 2026-09-05

- Der Monatsworkflow führt jetzt sichtbar von Import über Bestandsprüfung und bestätigbare Kategorien bis zur Analyse. Lokale Erkennung, KI-Prüfliste, Analysehochrechnung und Amazon-Kategorievorschläge wurden erweitert; der Footer verwendet echte SemVer-Revisionsnummern.
- Sparkassen-Umsätze mit dem Empfänger `**Unbekannt` werden als vorgemerkt erkannt, nicht importiert und in Vorschau sowie Ergebnis sichtbar gezählt.
- Die Importvorschau erkennt bereits früher gespeicherte Vormerkungen auf dem Zielkonto und bietet ihre gezielte, bestätigungspflichtige Bereinigung an.
- Innerhalb des vom neuen Kontoauszug abgedeckten Zeitraums werden auch andere zuvor gespeicherte, nun fehlende Umsätze zur einzeln bestätigten Löschung vorgeschlagen.
- Bereits importierte Dateien dürfen erneut als schreibgeschützte Vorschau geprüft werden, damit Bestandsvergleich und Bereinigung erreichbar bleiben; ein doppelter Import bleibt gesperrt.
- Das Updateskript gleicht den lokalen Stand ausdrücklich mit `origin/main` ab, zeigt vorherige und neue Revision und der Footer verlinkt Commit-Revisionen korrekt.
- Für jedes Konto kann ein optionales, lokal gespeichertes Profilbild hinterlegt, geändert und entfernt werden. KI-Kategorien werden standardmäßig einzeln oder gesammelt bestätigt; nur die persönliche Vertrauenseinstellung erlaubt eine automatische Übernahme. Unspezifische neue Kategorien wie „Sonstiges“ werden nicht vorgeschlagen.
- Wenn keine bestehende Kategorie fachlich passt, kann die KI neue Einnahme- oder Ausgabenkategorien gebündelt vorschlagen; angelegt und zugeordnet werden sie erst nach Bestätigung. Sparkassen-Dateien mit abweichender Windows-Zeichenkodierung werden automatisch erkannt.
- Kategorie-Dropdowns bei Umsätzen, Filtern und Aufteilungen trennen Einnahmen und Ausgaben und zeigen Unterkategorien eingerückt unter ihrer Hauptkategorie.
- Verwendungszwecke werden in der Umsatzliste zweizeilig dargestellt und sind zusätzlich vollständig als Browser-Hinweis verfügbar.
- Die Kategorienverwaltung trennt Ausgaben und Einnahmen in eigene hierarchische Abschnitte und exportiert die sichtbare Struktur als lesbare JSON-Datei.
- Kategorien werden als Hierarchie dargestellt; Unterkategorien stehen eingerückt direkt unter ihrer jeweiligen Hauptkategorie.
- Nicht zugeordnete Umsätze sind in der Umsatzliste dezent rot markiert und über einen Schnellfilter erreichbar; aufgeteilte Buchungen gelten dabei nicht länger fälschlich als offen.
- Die Kategorienübersicht zeigt je Kategorie die Anzahl direkt oder über Aufteilungen zugeordneter sichtbarer Umsätze.
- KI-Kategorisierung verarbeitet offene Umsätze in stabilen 25er-Stapeln, besitzt ein längeres Antwortfenster und meldet Zeitüberschreitungen verständlich und ohne Teiländerungen.
- Der manuelle Regellauf lernt auch bereits vor Einführung der Händlerregeln kategorisierte Umsätze; KI-Ergebnisse bleiben sichtbar und ausreichend eindeutige Vorschläge werden automatisch übernommen.
- Anmeldungen bleiben mit einem für mobile Browser geeigneten First-Party-Cookie jetzt 30 Tage lang über Seiten-Neuladungen erhalten.
- Wiederholte Installationsläufe bewahren Datenbank-, Anmelde- und Verschlüsselungsschlüssel; nicht mehr lesbare KI-Schlüssel führen zu einer verständlichen Neueinrichtungs-Anweisung.
- Gelernte Händler-Zuordnungen lassen sich jederzeit erneut auf alle offenen Umsätze anwenden – ohne Datei-Upload und ohne KI-Kosten.
- Datenbasierter Monatsablauf führt von Import über offene Kategorien und Amazon-Abgleich zur Analyse
- Kategorien können umbenannt und kontrolliert gelöscht werden; bestehende Zuordnungen werden verschoben oder bewusst entfernt
- Bestätigte Händlerzuordnungen werden lokal gelernt und bei künftigen sowie offenen Umsätzen automatisch wiederverwendet
- Seitenleiste zeigt den echten Haushaltsnamen sowie reale sichtbare Konten- und Mitgliederzahlen; Adminnavigation nur für Administratoren
- Fehlende KI-Anbieterkonfiguration wird als regulärer Verfügbarkeitsstatus statt als fehlerhafte HTTP-Anfrage behandelt
- Amazon-Artikel lassen sich einzeln kategorisieren, mit betragsgleichen Bankumsätzen abstimmen und centgenau als Umsatzaufteilung übernehmen
- Datenschutzsparsame Parser-Grundlage für Amazons „Order History.csv“ mit Mehrfachartikeln und Dublettenfingerabdrücken
- Unsichere KI-Kategorisierungsvorschläge können einzeln geprüft und übernommen werden
- Manueller KI-Start ist bei offenen Umsätzen sofort sichtbar; Import wechselt anschließend zur automatischen oder manuellen Kategorisierung
- Verständlicher Hinweis, wenn der zentrale KI-Anbieter noch nicht eingerichtet wurde
- Konfigurierbare CSV-Kopfzeile und Leerzeilenbehandlung werden bei Vorlagentest und Import vollständig berücksichtigt
- Nicht angeschlossenen Benachrichtigungs-Platzhalter aus den Einstellungen entfernt
- Reale Kontofilter und dynamische Monatsbezeichnungen auf der Analyse-Startseite
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
