# Änderungsprotokoll

Dieses Projekt verwendet [Semantic Versioning](https://semver.org/lang/de/).

## [0.8.3] - 2026-09-08

- Die Amazon-KI analysiert nur noch Artikel aus dem Zeitraum, der durch importierte Amazon-Bankbuchungen abgedeckt ist.
- Das 21-tägige Abgleichfenster vor der ersten und nach der letzten Bankbuchung wird berücksichtigt, damit zeitversetzte Belastungen nicht verloren gehen.
- Ohne eine importierte Amazon-Bankbuchung wird keine kostenpflichtige Artikelanalyse gestartet.
- Die Oberfläche nennt den berücksichtigten Zeitraum und zeigt, wie viele ältere oder spätere Artikel bewusst keine KI-Kosten verursachen.
- Regressionstests sichern leere Zeiträume sowie Monats- und Jahresgrenzen ab.

## [0.8.2] - 2026-09-08

- Die Amazon-Abstimmung berechnet ihre Summen nun über den vollständigen Import statt nur über die ersten 1.000 Artikel.
- Offene Amazon-Zahlungen werden serverseitig in Seiten zu je 100 Bestellgruppen geladen; dadurch bleiben auch große Importe vollständig und bedienbar.
- Die Oberfläche unterscheidet ausdrücklich zwischen einzelnen, noch nicht KI-analysierten Artikeln und offenen Bestell- beziehungsweise Zahlungsgruppen.
- Filter zeigen nun vollständige Gesamtzahlen für offene Zahlungen mit und ohne passende Bankbuchung.

## [0.8.1] - 2026-09-08

- Korrigiert einen schwerwiegenden Analysefehler: Unsichere KI-Zuordnungen unter 95 Prozent wurden mitsamt ihrem Betrag aus Monatsgesamtwert und Ausgabenverlauf entfernt.
- Jede echte Ausgabe zählt nun unabhängig von ihrer Kategorisierungssicherheit vollständig in Monatswert, Verlauf und Gesamtsumme.
- Bei unsicheren KI-Treffern bleibt ausschließlich die Kategorie offen; der Betrag erscheint bis zur Bestätigung unter „Nicht zugeordnet“.
- Kategorie-Drill-down und KI-Sparanalyse verwenden dieselbe korrigierte Datenbasis.
- Ein zusätzlicher Rechentest schützt die Trennung zwischen sicherem Geldbetrag und unsicherer Kategorie dauerhaft ab.

## [0.8.0] - 2026-09-08

- Die Analyse erkennt nun ausschließlich durchgängige mehrmonatige Anstiege und Rückgänge und zeigt die zugrunde liegende Wertefolge direkt an.
- Eine neue Mehrkostenansicht priorisiert die drei größten Abweichungen vom Monatsdurchschnitt und weist ihre rechnerische Jahreswirkung transparent aus.
- Hauptkategorien enthalten in der Analyse nun auch ihre Unterkategorien; dadurch stimmen Übersicht, Ringdiagramm, Trends und KI-Hinweise fachlich überein.
- Jede Top-, Trend- und Mehrkostenkategorie öffnet einen Drill-down mit Unterkategorie, Datum, Betrag, Konto, Empfänger und vollständigem Buchungstext.
- Die vollständige Kategorienübersicht ist direkt aus der Analyse erreichbar. Auch Segmente im Ringdiagramm öffnen die zugehörigen Buchungen.
- Der Monatsarbeitsablauf steht kompakt nach der Finanzanalyse, sodass Kosten, Veränderungen und Sparansätze zuerst sichtbar sind.
- Die Amazon-Artikelmatrix besitzt eine Detailansicht mit allen Bestellvorkommen, KI-Begründungen, Sicherheitswerten und verknüpften Bankbuchungen.
- Eindeutige lokale Stichwort-, Abo-, Händler- und Artikelregeln werden weiterhin vor der KI angewendet und bleiben jederzeit änderbar.
- Automatische Händlerregeln werden nur noch aus ausdrücklich manuell bestätigten Buchungen gelernt. Breite Altregeln für Amazon, PayPal und andere Sammelzahler werden nicht mehr angewendet.
- Trend-, Monats- und KI-Auswertungen verwenden dieselben Ausschluss-, Sicherheits-, Erstattungs-, Umbuchungs- und Hierarchieregeln.

## [0.7.7] - 2026-09-08

- Der Amazon-Matrixexport enthält nun neben bewusst gespeicherten Platzhaltern auch sämtliche eindeutig kategorisierten Artikel als exakte portable Regeln.
- Der Export weist getrennt aus, wie viele Regeln ausdrücklich angelegt und wie viele aus vorhandenen Matrixzuordnungen gewonnen wurden.
- Die Artikelmatrix kann nach zugeordneten, nicht zugeordneten und teilweise zugeordneten Artikeln gefiltert werden.
- Als Sortierung stehen „Nicht zugeordnet zuerst“, „Zugeordnet zuerst“ und „Artikelname A–Z“ zur Verfügung.
- Unterschiedlich kategorisierte Vorkommen desselben Artikels werden sichtbar als teilweise zugeordnet markiert und erst nach einer eindeutigen Entscheidung exportiert.

## [0.7.6] - 2026-09-08

- KI-Kategorien müssen nun den tatsächlichen Verwendungszweck beschreiben, nicht Händler, Zahlungsweg oder Bezugsquelle.
- Begriffe wie „Online-Marktplatzkäufe“, „Lokaler Einzelhandel“, „Fachhandel“, „Onlinehandel“ und „Zahlungsanbieter“ sind als neue Kategorien gesperrt.
- Bereits vorhandene unspezifische Bezugsquellen-Kategorien werden der KI nicht mehr als mögliche Zuordnungsziele angeboten.
- Neue Kategorien werden nur noch ab mindestens 75 Prozent Sicherheit vorgeschlagen. Bei unklarem Verwendungszweck bleibt ein Umsatz bewusst ungeklärt.

## [0.7.5] - 2026-09-07

- Eine neue Amazon-Artikelmatrix zeigt jeden unterschiedlichen Produktnamen, seine Häufigkeit und die zugeordnete Kategorie; Änderungen erzeugen eine dauerhaft gültige exakte Artikelregel.
- Flexible Platzhalterregeln unterstützen unter anderem `Filament*` und `*Filament*`; exakte und längere Regeln haben zuverlässig Vorrang.
- Artikelregeln werden vor der KI auf bestehende sowie neue Amazon-Importe angewendet und überschreiben keine spezifischere Regel.
- Das Zuordnungswissen lässt sich als JSON exportieren und wieder importieren. Fehlende oder mehrdeutige Kategorien werden sicher übersprungen statt automatisch erzeugt.
- Produktnamen und Regelmuster bleiben verschlüsselt in der lokalen Datenbank gespeichert.

## [0.7.4] - 2026-09-07

- Korrigiert den fehlerhaften Zeitstempel der Amazon-Stapelverarbeitungsmigration, durch den PostgreSQL die neuen Vorschlagsspalten übersprungen hat.
- Das Updateskript prüft die Datenbankmigrationen nun auch dann, wenn die installierte Git-Revision bereits aktuell erscheint.
- Installation und Update vergleichen die erwartete mit der tatsächlich ausgeführten Anzahl an Migrationen und verhindern einen Start mit veraltetem Datenbankschema.

## [0.7.3] - 2026-09-07

- Ein Klick analysiert nun alle noch offenen Amazon-Artikel automatisch in stabilen 25er-Paketen; manuelle Einzelrunden entfallen.
- Ein Fortschrittsfenster zeigt verarbeitete Artikel, Gesamtzahl, Runden und automatisch übernommene sehr sichere Treffer.
- Der Stapellauf kann nach der aktuellen Runde pausiert und später ohne Doppelanalyse fortgesetzt werden.
- KI-Vorschläge, Sicherheitswerte, Begründungen und vorgeschlagene neue Kategorien werden dauerhaft gespeichert und überstehen einen Seitenwechsel.
- Die Kostenschätzung bezieht sich sichtbar auf den gesamten Stapellauf statt nur auf die nächste Runde.

## [0.7.2] - 2026-09-07

- Amazon-Bestellungen werden nur bei genau einem sehr sicheren Banktreffer automatisch vorausgewählt; mehrere mögliche Treffer erfordern eine bewusste Auswahl.
- Der Trefferhinweis erklärt sichtbar Übereinstimmung, Abstand in Tagen und Sicherheit.
- Ohne passende Bankbuchung bleibt die erkannte Artikelkategorie erhalten, der Geldfluss aber ausdrücklich als offen markiert.
- Beim Verknüpfen prüft der Server erneut den Amazon-Bezug, den centgenauen Betrag, die Währung und das 21-Tage-Fenster.
- Dieselbe Bankbuchung kann nicht mehr versehentlich mehreren Amazon-Bestellungen zugeordnet werden.

## [0.7.1] - 2026-09-07

- Die Startseite zeigt zuerst genau den nächsten sinnvollen Arbeitsschritt; der vollständige Monatsablauf bleibt bei Bedarf aufklappbar.
- Die Trefferzahl einer gelernten Regel öffnet nun die referenzierenden Buchungen mit Datum, Betrag, Buchungstext, Konto, Kategorie und Zuordnungsherkunft.
- Der Vollständigkeits- und Löschabgleich eines Imports verwendet nur noch frühere Importe derselben Datenquelle. Ein PayPal-Export kann damit keine Sparkassen-Umsätze mehr fälschlich als fehlend melden.
- Importvorschau und Hinweise nennen die erkannte Datenquelle und erklären, wenn noch keine passende Vergleichsbasis existiert.
- Manuelle und ältere Buchungen ohne Zuordnungsherkunft bleiben zuverlässig in den Auswertungen enthalten.

## [0.7.0] - 2026-09-07

- Die Sicherheitsgrenzen sind zentral vereinheitlicht: „sehr sicher“ beginnt erst bei 95 Prozent, „wahrscheinlich“ bei 75 Prozent.
- Standardmäßig muss jeder KI-Vorschlag bestätigt werden; die frühere automatische Übernahme ab 70 Prozent wurde vollständig entfernt.
- Optional können Benutzer ausschließlich KI-Ergebnisse ab 95 Prozent automatisch übernehmen lassen.
- Automatisch übernommene KI-Ergebnisse erzeugen keine Lernregeln mehr. Erst eine ausdrückliche Bestätigung oder Korrektur darf für die Zukunft gelernt werden.
- Sammelbestätigungen für Bank- und Amazon-Vorschläge können unmittelbar vollständig rückgängig gemacht werden und erzeugen bewusst keine versteckten Lernregeln.
- Frühere Einstellungen zur 70-Prozent-Übernahme werden sicher auf „jeden Vorschlag bestätigen“ zurückgestuft.
- Unsichere ältere KI-Zuordnungen unter 95 Prozent werden bis zur Bestätigung aus der Finanzanalyse ausgeschlossen.
- Die Analyseseite zeigt eine Datenqualitätsleiste mit bestätigten Zuordnungen, sehr sicheren Automatiken, offenen Prüfungen und nicht zugeordneten Umsätzen.
- Die Qualitätsanzeige berücksichtigt den gewählten Kontofilter und verlinkt direkt zu den noch notwendigen Prüfungen.
- Eigene Tests schützen die zentralen Sicherheitsgrenzen vor späteren unbeabsichtigten Änderungen.

## [0.6.10] - 2026-09-07

- Amazon-Vorschläge besitzen dieselben sichtbaren Sicherheitsstufen wie Bankumsätze und lassen sich danach filtern.
- Eine zentrale Aktionskarte oberhalb der Bestellungen übernimmt wahlweise nur sehr sichere oder alle sichtbaren Vorschläge; irreführende Schaltflächen in einzelnen Bestellungen entfallen.
- Vorgeschlagene Kategorien sind im Auswahlfeld sichtbar vorausgewählt, werden aber erst nach Bestätigung gespeichert.
- Amazon-Bestellungen mit sicheren Vorschlägen erscheinen zuerst.
- Filament wird sehr sicher als 3D-Druck erkannt; Lebensmittelmotten werden nicht mehr fälschlich als Lebensmittel eingeordnet.

## [0.6.9] - 2026-09-07

- Die Kategorienverwaltung verwendet auf Smartphones echte Kartenzeilen statt zusammengedrückter Desktop-Zeilen.
- Kategoriename und Beschreibung erhalten die volle Breite; Anzahl, Bearbeiten und Löschen stehen übersichtlich in einer eigenen Aktionszeile.
- Unterkategorien bleiben klar eingerückt, ohne dass Namen oder Beschreibung buchstabenweise umbrechen.
- Bearbeiten- und Löschen-Schaltflächen besitzen mobil ausreichend große Touch-Flächen.

## [0.6.8] - 2026-09-07

- KI-Vorschläge lassen sich wahlweise nur ab 90 Prozent Sicherheit oder vollständig gesammelt übernehmen.
- Eine Zusammenfassung zeigt vor der Entscheidung die Anzahl sehr sicherer, wahrscheinlicher und prüfbedürftiger Vorschläge.
- Jeder Vorschlag trägt eine deutlich sichtbare, farbige Sicherheitsstufe und weiterhin den exakten Prozentwert.
- Die Beschriftung macht klar, dass „Alle Vorschläge“ auch weniger sichere Ergebnisse umfasst; neue Kategorien bleiben weiterhin von Sammelaktionen ausgeschlossen.

## [0.6.7] - 2026-09-07

- Im Kategorie-Auswahlfeld eines KI-Vorschlags kann direkt eine neue Kategorie angelegt werden, ohne die laufende Prüfung zu verlassen.
- Die direkte Anlage unterstützt Haupt- und Unterkategorien sowie die korrekte Trennung von Einnahmen und Ausgaben.
- Nach dem Anlegen bleibt die neue Kategorie im Vorschlag ausgewählt und wird erst mit „Übernehmen“ endgültig dem Umsatz zugeordnet.

## [0.6.6] - 2026-09-07

- Der Dialog zur manuellen Kategoriezuordnung erklärt eindeutig den Unterschied zwischen einmaliger, zukünftiger und rückwirkender Zuordnung.
- Richtungssymbole machen den zeitlichen Wirkungsbereich der drei Optionen auf einen Blick sichtbar.
- Vor einer rückwirkenden Änderung wird die exakte Anzahl der betroffenen Umsätze des Kontos angezeigt.
- Bei Sammelzahlungsanbietern ohne eindeutiges Stichwort werden nicht ausführbare Regeloptionen verständlich deaktiviert.

## [0.6.5] - 2026-09-07

- Die Eingabe- und Auswahlfelder des Sparkassen-Assistenten sind auf Smartphones nun klar durch Hintergrund, Rahmen und ausreichende Höhe erkennbar.
- Fokus, Hoverzustand, Platzhalter und deaktivierte Felder besitzen konsistente, kontrastreiche Zustände im Hell- und Dunkelmodus.
- Die Schriftgröße mobiler Formularfelder verhindert das automatische Hineinzoomen von Safari unter iOS.

## [0.6.4] - 2026-09-07

- Der beim Update auf 0.6.3 sichtbare `EACCES`-Fehler ist behoben: Das Updateskript lässt npm keine von `root` verwalteten Manifestdateien mehr verändern.
- Abhängigkeiten werden anhand des tatsächlichen Paketbaums statt anhand der gesamten `package-lock.json` verglichen; reine Versionsänderungen lösen keine Neuinstallation von über 500 Paketen mehr aus.
- Bei echten Abhängigkeitsänderungen bleibt das reproduzierbare und schreibgeschützte `npm ci` erhalten.
- Vorhandene alte Paket-Hashmarken werden automatisch über die Git-Historie erkannt und einmalig auf das neue Format migriert.
- Ändert ein Release das Updateskript selbst, startet es nach dem Git-Abruf einmal automatisch neu und arbeitet garantiert mit der neuen Logik weiter.

## [0.6.3] - 2026-09-07

- Der Monatsablauf erkennt eine eingerichtete Sparkassen-Verbindung und führt dann direkt zum Bankabruf statt weiterhin pauschal zum CSV-Import.
- Die Sparkassen-Seite trennt den täglichen Umsatzabruf klar von der selten benötigten Neueinrichtung der Zugangsdaten.
- Die KI übernimmt Vorschläge nur noch automatisch, wenn der Benutzer die automatische Übernahme tatsächlich aktiviert hat; die gewählte Vertrauensgrenze wird korrekt berücksichtigt.
- KI- und manuelle Zuordnungen verhindern eine fachliche Vermischung von Einnahmen- und Ausgabenkategorien.
- Kategoriehierarchien können keine Kreisläufe mehr bilden und nicht unter eigene Unterkategorien verschoben werden.
- Hauptkategorien mit Unterkategorien lassen sich nicht versehentlich zwischen Einnahmen und Ausgaben umwandeln; auch beim Löschen bleiben beide Bereiche getrennt.
- Bei leeren oder fehlerhaften Analysedaten werden keine irreführenden Null-Kennzahlen und leeren Diagramme mehr angezeigt.
- Die Testsuite umfasst nun 102 Prüfungen einschließlich der neuen Hierarchie-Sicherungen.

## [0.6.2] - 2026-09-07

- Die Schnellprüfung verwendet nun die letzte nachweislich erfolgreich gebaute und gestartete Revision statt nur des aktuellen Git-Stands.
- Nach einem abgebrochenen Build wird derselbe Stand beim nächsten Aufruf zuverlässig erneut verarbeitet.
- Ist die Revision aktuell, der Dienst aber gestoppt, startet das Updateskript ihn wieder und prüft den Status.
- Eine veraltete Sonderprüfung für eine einzelne frühere Datenbankspalte wurde entfernt; maßgeblich ist vollständig und einheitlich der Erfolg aller Drizzle-Migrationen.
- Erstinstallationen speichern ihren erfolgreich bereitgestellten Stand, sodass der erste spätere Updateaufruf ohne neue Version ebenfalls schnell endet.

## [0.6.1] - 2026-09-07

- Das Updateskript beendet einen erneuten Aufruf ohne neue GitHub-Revision sofort, statt Migration und Produktionsbuild unnötig zu wiederholen.
- Bei geänderten Abhängigkeiten aktualisiert npm eine bestehende Installation inkrementell; eine Erstinstallation bleibt mit `npm ci` vollständig reproduzierbar.
- Zeitangaben für Paketinstallation, Migration und Build machen langsame Schritte auf dem LXC nachvollziehbar.

## [0.6.0] - 2026-09-07

- Ein geführter Assistent verbindet zunächst Sparkassenkonten direkt und ausschließlich lesend über FinTS 3.0.
- Hilfetexte erklären Produkt-ID, BLZ, FinTS-Adresse, Anmeldename, PIN und TAN-Verfahren unmittelbar am jeweiligen Eingabefeld.
- PIN und Bankparameter werden verschlüsselt in der lokalen Installation gespeichert und niemals an einen KI-Anbieter übertragen.
- pushTAN-/App-Freigaben sowie klassische TAN-Verfahren werden sowohl bei der Einrichtung als auch beim Umsatzabruf unterstützt.
- Ein manueller Abruf importiert die letzten 90 Tage, überspringt vorhandene Buchungen und Nullbuchungen und wendet anschließend sichere lokale Regeln an.
- Der Abruf zeigt verständlich, wie viele Umsätze neu, bereits vorhanden und lokal kategorisiert wurden.
- Die Integration unterstützt ausschließlich Kontoinformationen und Umsätze; Überweisungen oder andere Zahlungsfunktionen sind nicht implementiert.

## [0.5.4] - 2026-09-07

- Administratoren können unter „Systemstatus“ den gesamten finanziellen Arbeitsbestand eines Haushalts kontrolliert zurücksetzen.
- Gelöscht werden Umsätze, Importverläufe, Amazon-Bestellungen, gelernte Regeln, wiederkehrende Kosten, KI-Kostenhistorie und individuelle Kategorien.
- Anschließend wird der schlanke Standard-Kategorienbaum vollständig neu angelegt.
- Konten samt Profilbildern, Benutzer, Rollen, Freigaben, Passwörter, persönliche Einstellungen, KI-/SMTP-Konfiguration und Importvorlagen bleiben erhalten.
- Die endgültige Aktion erfordert die explizite Eingabe „ALLES LÖSCHEN“ und wird im Systemprotokoll dokumentiert.

## [0.5.3] - 2026-09-07

- Der neue Adminbereich „Hilfe & Ablauf“ zeigt den vollständigen Verarbeitungsweg grafisch vom Bankimport bis zur fertigen Analyse.
- Die Hilfe erklärt, warum eine Amazon-Bankbuchung noch nicht die enthaltenen Artikel und möglichen Kategorieaufteilungen beschreibt.
- Eine Analyse gilt erst als vollständig, wenn neben Bankumsätzen und KI-Prüfungen auch alle Amazon-Artikel abgestimmt wurden.
- KI-Vorschläge dürfen neue Kategorien ausschließlich nach ausdrücklicher Einzelbestätigung anlegen; die Sammelbestätigung übernimmt nur vorhandene Kategorien.
- Die Kategorie-API verhindert haushaltsweit doppelte Namen – unabhängig davon, ob die Anlage aus der Oberfläche oder einem KI-Ablauf stammt.
- „Sonstiges“, „Einkäufe“, „Shopping“ und daraus gebildete unspezifische Sammelkategorien werden zentral blockiert und von KI-Vorschlägen verworfen.
- Eine einmalige Migration führt vorhandene gleichnamige Dubletten samt Zuordnungen zusammen. Frühere verbotene Sammelkategorien werden entfernt und ihre Buchungen zur sauberen Neuzuordnung geöffnet.

## [0.5.2] - 2026-09-07

- Nicht kategorisierte Amazon-Artikel können nun mit derselben konfigurierten KI wie Bankumsätze analysiert werden.
- Die Analyse verarbeitet überschaubare Stapel mit jeweils bis zu 25 Artikeln und zeigt Anbieter, Modell, Rundenzahl und geschätzte Kosten.
- Während des API-Aufrufs zeigt die App einen eindeutigen Ladebildschirm; anschließend werden automatisch übernommene und noch zu bestätigende Vorschläge getrennt ausgewiesen.
- Die persönliche KI-Vertrauensgrenze gilt auch für Amazon: Je nach Einstellung werden Treffer ab 90 oder 70 Prozent automatisch übernommen oder grundsätzlich zur Bestätigung vorgelegt.
- KI-Vorschläge zeigen Kategorie, Sicherheit und Begründung direkt am jeweiligen Artikel und können einzeln oder je Bestellung gemeinsam bestätigt werden.
- Unpassende Sammelkategorien wie „Sonstiges“ werden auch für Amazon niemals vorgeschlagen.

## [0.5.1] - 2026-09-07

- Die Migration der persönlichen KI-Bestätigungsgrenze besitzt nun garantiert eine neuere Reihenfolge als alle vorherigen Migrationen. Bestehende Installationen erhalten die zuvor übersprungene Spalte beim Update zuverlässig.
- Das Updateskript prüft die erforderliche Datenbankspalte unmittelbar nach der Migration und verhindert einen Neustart mit unvollständigem Schema.
- Umsatz- und Systemprotokolltabellen werden auf Smartphones als lesbare Karten statt als überbreite Desktoptabellen dargestellt.
- Seitenaktionen, Filter, lange Buchungstexte, Auswahlfelder und Dialoge passen sich kleinen Displays an; Dialoge bleiben scrollbar und ihre Hauptaktionen vollständig erreichbar.
- Abstände, Kartenradien und die untere Sicherheitszone wurden für schmale Smartphones optimiert.

## [0.5.0] - 2026-09-07

- Der Monatsablauf führt nun sichtbar durch Import, sichere lokale Zuordnung, KI-Restanalyse, persönliche Prüfung, ergänzende Sammelzahlungsimporte und die fertige Analyse.
- KI-Restmengen werden in transparenten 25er-Runden verarbeitet. Runde, Gesamtfortschritt und bearbeitete Umsätze bleiben sichtbar; die automatische Analyse arbeitet alle Runden nacheinander ab.
- Ein blockierender Ladebildschirm zeigt während jedes KI-Aufrufs eindeutig, dass die Verarbeitung läuft und die Seite geöffnet bleiben soll.
- Jeder Benutzer legt selbst fest, ob alle KI-Vorschläge bestätigt werden müssen oder Treffer ab 90 beziehungsweise 70 Prozent automatisch übernommen werden dürfen.
- Prüfpflichtige Vorschläge blockieren nicht mehr die Analyse der nächsten 25 Umsätze und werden bis zur gemeinsamen oder einzelnen Entscheidung gesammelt.
- Offene Amazon-, PayPal- und Kreditkarten-Sammelzahlungen werden getrennt ausgewiesen und führen direkt zum passenden Zusatzimport.
- Die Analyseseite zeigt den vollständigen Arbeitsstand in sechs logisch aufeinanderfolgenden Schritten.
- Bestätigte KI-Vorschläge werden nun als lokale Regeln gelernt und bei späteren Importen ohne erneuten API-Aufruf angewendet.
- Für eindeutige Händler bleibt die bewährte Händlerregel bestehen. Bei Sammelabrechnern wie Amazon, PayPal, Klarna, Apple oder Google lernt die App ausschließlich die sichere Kombination aus Händler und einem aussagekräftigen Begriff im Buchungstext, etwa „Amazon + Filament“.
- Allgemeine Wörter, reine Nummern und Zahlungsreferenzen werden nicht als Lernbegriffe akzeptiert. Fehlt ein sicherer Begriff, wird bewusst keine zu breite Regel angelegt.
- Kombinierte Regeln erscheinen verständlich in „Gelernte Regeln“ und lassen sich dort pausieren, löschen, einer anderen Kategorie zuordnen oder kontrolliert rückwirkend anwenden.
- Auch beim gemeinsamen Bestätigen eines KI-Stapels und beim Anlegen einer von der KI vorgeschlagenen Kategorie wird die passende lokale Regel gespeichert.

## [0.4.15] - 2026-09-07

- Die Markierung nicht zugeordneter Umsätze verwendet jetzt eigene kontrastreiche Farben für Hell- und Dunkelmodus. Zeilentext, Zusatztext und Betrag bleiben auf der Hervorhebung lesbar.
- Auch der aktive Offen-Filter und das Kategorieauswahlfeld nutzen dieselben barriereärmeren semantischen Farben.

## [0.4.14] - 2026-09-07

- Gängige eindeutig benannte Abodienste wie Spotify, Netflix, Disney+, iCloud, Microsoft 365, Amazon Prime, DAZN und weitere werden lokal ohne KI-Kosten erkannt.
- Die Zuordnung verwendet vorhandene Kategorien namens „Abos“, „Abonnements“ oder „Streaming & Software“. Neue Installationen erhalten dafür die Unterkategorie „Abonnements“.
- Eindeutige Händler werden als kontobezogene Regel gespeichert; Abos im Verwendungszweck eines Sammelzahlers wie PayPal werden bei jedem Import sicher neu erkannt.
- Bekannte Abos erscheinen bereits nach der ersten Buchung in der Abo-Übersicht. Mehrdeutige Texte wie „APPLE.COM/BILL“ werden bewusst nicht pauschal zugeordnet.

## [0.4.13] - 2026-09-07

- Die Kategorie heißt nun eindeutig „Interne Umbuchung (nicht auswerten)“ und erklärt ihre Wirkung direkt in der Kategorien- und Umsatzansicht.
- Die Auswahl dieser Kategorie kennzeichnet eine Geldverschiebung automatisch als Transfer und schließt sie unabhängig von ihrer Richtung aus Einnahmen, Ausgaben, KI-Hinweisen und wiederkehrenden Kosten aus.
- Centgleiche Gegenbuchungen verschiedener Konten können verbunden werden; auch zunächst einseitig markierte Umbuchungen bleiben nach späteren Kontenimporten auffindbar. Verknüpfte Paare werden nicht erneut vorgeschlagen.

## [0.4.12] - 2026-09-07

- Jeder Benutzer kann im persönlichen Sicherheitsbereich sein eigenes Passwort ändern. Die Passwortregeln, Leakprüfung, Sichtbarkeitsumschaltung und bestehende Sitzungserneuerung gelten dabei auch für Administratoren.
- Die eigene E-Mail-Adresse lässt sich im Profil ändern; zum Schutz des Passwort-Reset-Kanals muss die Änderung mit dem aktuellen Passwort bestätigt werden.

- Neue Haushalte erhalten einen bewusst kleinen deutschen Kategorienbaum mit sinnvollen Hauptkategorien und wenigen Beispiel-Unterkategorien; „Einkäufe“ und Auffangkategorien sind nicht enthalten.
- Kategorien werden innerhalb ihrer Hierarchie alphabetisch angezeigt. Die einmalige Bestandsbereinigung läuft nur als Migration; später gelöschte Standardkategorien werden durch Updates nicht erneut angelegt.
- PayPal-Aktivitätsberichte können über eine mitgelieferte deutsch/englische CSV-Vorlage importiert werden. Kreditkarten-CSV werden über CAMT V8 oder eine anbieterspezifische Admin-Vorlage eingelesen.
- Von npm und Build-Werkzeugen im Installationsverzeichnis erzeugte `.npm/`- und `.config/`-Verzeichnisse gelten nicht mehr fälschlich als lokale Quellcodeänderungen und blockieren das Updateskript nicht mehr.

- Das Updateskript erkennt nach einer veröffentlichten Historienbereinigung auseinanderlaufende Commit-Verläufe. Bei einem unveränderten Installationsverzeichnis richtet es sich automatisch und sicher wieder an `origin/main` aus; lokale Änderungen führen weiterhin zum Abbruch.

- Die Amazon-Abstimmung lässt sich danach filtern, ob eine passende Bankbuchung gefunden wurde oder noch fehlt.
- Fehlende Kategorien können direkt in der Umsatz- und Amazon-Zuordnung angelegt werden. Die aktuelle Arbeitsposition bleibt erhalten und die neue Kategorie wird unmittelbar übernommen.

- Einzelne Ergebnisse eines KI-Stapels lassen sich mit „Später prüfen“ zurückstellen. Sie werden nicht im nächsten 25er-Stapel erneut gesendet, sind über einen eigenen Umsatzfilter auffindbar und können dort wieder für die KI freigegeben werden.

- Wiederkehrende Kosten sind in „Abonnements“ und „Regelmäßige Zahlungen“ getrennt. Die App sortiert bestehende Treffer vor, erlaubt jederzeit die manuelle Verschiebung und zeigt für Abos geschätzte Jahreskosten.

- Reale Transaktionsfragmente wurden in Tests durch vollständig synthetische Werte ersetzt. Zusätzliche Git-Ausschlussregeln schützen lokale Umgebungsdateien, Archive, Datenbankabbilder und Sicherungsdateien vor versehentlichem Einchecken.

- Der Ubuntu-Installer führt jetzt verständlich durch Subnetz, Port, Admin-E-Mail und Anzeigename, erklärt die Firewall-Einschränkung und zeigt vor dem Start eine Zusammenfassung.
- Die Admin-E-Mail wird schon bei der Installation gespeichert und steht damit sofort für den Passwort-Reset bereit. Unbeaufsichtigte Installationen bleiben über Umgebungsvariablen möglich.

- Dieselbe eindeutige Bankreferenz wird nun auch dann als sichere Dublette erkannt, wenn die Bank den Buchungstag zwischen zwei Exporten verschiebt; Uhrzeiten spielen dabei keine Rolle.
- Bereits gespeicherte Referenzdubletten erscheinen unter „Datenqualität“ mit beiden Buchungstagen und können dort nach ausdrücklicher Bestätigung bereinigt werden.

- Mehrkonten-Workflow nach Nutzersicht geprüft: Bei mehreren Konten verlangt der Import jetzt eine bewusste Zielkontowahl und öffnet danach direkt die Umsätze dieses Kontos.
- Umsatzprüfung, lokale Regeln und KI-Zuordnung können auf ein einzelnes Konto begrenzt werden; der neue Kontofilter verhindert Vermischungen beim Monatsabschluss.
- Datenqualitäts-Kacheln öffnen direkt die passende Prüfliste. Der Amazon-Abgleich ist im Monatsablauf eindeutig als optional gekennzeichnet.
- Irreführende, nicht anklickbare Elemente in der Analyse wurden bereinigt.

## [0.4.1] - 2026-09-06

- Neue Gemeinschaftskonten benötigen eine formal gültige IBAN, damit spätere CSV-Importe dem Zielkonto sicher zugeordnet werden können. Die Oberfläche erklärt die verschlüsselte Speicherung.
- Der geheime IBAN-Fingerabdruck wird nicht mehr an den Browser übertragen; Konto-Freigaben werden ausschließlich für sichtbare Konten geladen.
- Profilbilder gemeinsamer und persönlicher Konten werden zusätzlich serverseitig gegen Kontosichtbarkeit, Eigentum und Erwachsenenstatus geprüft.
- Widersprüchliche freigegebene Händlerregeln werden erkannt, sichtbar gemeldet und bis zur Korrektur nicht automatisch angewendet.
- Vorschläge für interne Umbuchungen zeigen beide Buchungstexte zur sicheren manuellen Entscheidung.
- Der Gemeinschaftskonto-Workflow besteht Typprüfung, Lint, Produktions-Build und 69 Regressionstests.

## [0.4.0] - 2026-09-06

- Die zentrale Kontoberechtigung ist als getestete Sicherheitsregel gekapselt: Erwachsene sehen Gemeinschaftskonten, eigene Konten, betreute Kinderkonten und ausdrücklich freigegebene Partnerkonten; Kinder sehen weder Gemeinschafts- noch fremde Privatkonten.
- Bankimporte prüfen die Kontoreferenz gegen die hinterlegte Zielkonto-IBAN, blockieren falsche beziehungsweise gemischte Kontodateien und kennzeichnen eine mangels IBAN nicht mögliche Prüfung sichtbar.
- Identische IBANs können innerhalb eines Haushalts nicht als zwei Konten angelegt werden; Kinderkonten benötigen zwingend ein gültiges, betreutes Kinderprofil.
- Händlerregeln sind standardmäßig an ihr Ursprungskonto gebunden. Nur eine ausdrückliche Familienfreigabe erweitert sie auf freigegebene Konten; bestehende Regeln werden bei der Migration ihrem bisherigen Konto zugeordnet.
- Die Datenqualität schlägt centgleiche Gegenbuchungen verschiedener sichtbarer Konten als mögliche interne Umbuchung vor. Erst die Bestätigung verknüpft und entfernt beide Seiten gemeinsam aus den Analysen.
- Mehrkonten-, Import- und Umbuchungsregeln werden mit 15 zusätzlichen Regressionstests abgesichert; ein manueller Abnahmeplan dokumentiert die verbleibenden Ende-zu-Ende-Prüfungen.

## [0.3.5] - 2026-09-06

- Die Einstellungsübersicht nutzt am Desktop ein platzsparendes dreispaltiges Kartenraster und bleibt auf kleinen Bildschirmen responsiv.
- Die Datenqualität zeigt je Konto einen transparent berechneten Prüfstand aus sicheren, manuellen, unsicheren und offenen Zuordnungen.
- Nach einem Import erscheint eine feste Abschlussprüfung mit neuen Umsätzen, Dubletten, ignorierten Vormerkungen beziehungsweise Nullbuchungen und noch zu klärenden Fällen.
- Ein reproduzierbarer Stichprobenfilter legt einen kleinen Teil der sehr sicheren Zuordnungen zur manuellen Qualitätskontrolle vor.
- Erkannte wiederkehrende Kosten lassen sich dauerhaft ausblenden. Die zugrunde liegenden Umsätze bleiben erhalten und der Vorgang wird protokolliert.

## [0.3.4] - 2026-09-06

- Umsätze lassen sich nach Sicherheitsstufe filtern, einschließlich einer gemeinsamen Prüfliste für „Wahrscheinlich“ und „Bitte prüfen“.
- Maschinell zugeordnete Umsätze können ohne Änderung am Dropdown direkt bestätigt werden und gelten danach nachvollziehbar als manuell geprüft.

## [0.3.3] - 2026-09-06

- Das Verteilungsdiagramm beschriftet jedes Ringsegment direkt über eine Führungslinie mit Kategorie, Eurobetrag und Prozentanteil. Die separate Legende unter dem Diagramm entfällt.

## [0.3.2] - 2026-09-06

- Sämtliche Analysepfade verwenden eine gemeinsame, centgenaue Umsatznormalisierung für Ausgaben, Erstattungen und Kategorieaufteilungen. Monatsverlauf, Kategorien und KI-Zusammenfassung stimmen dadurch rechnerisch überein.
- Die 12-Monats-Basis berücksichtigt historische Kategorien und echte Nullmonate vollständig. Eine serverseitige Integritätsprüfung erkennt künftig Abweichungen zwischen Monats- und Kategoriesumme sofort.
- Importdaten werden strenger geprüft: unmögliche Kalenderdaten, leere oder übergenaue Beträge und andere Währungen als EUR werden nicht mehr stillschweigend verfälscht.
- Amazon-Bestellsummen werden mit dem Größte-Reste-Verfahren garantiert centgenau und ohne negative Restpositionen verteilt; Split- und Betragsvergleiche erfolgen ebenfalls in ganzen Cent.
- KI-Kosten werden nur noch bei administrativ hinterlegten Europreisen angezeigt. Fehlende Preise erscheinen nicht länger als null Euro und Dollarpreise werden nicht als Euro ausgegeben.
- Händlernormalisierung entfernt Rechtsformen nur als eigenständige Wörter und beschädigt keine realen Händlernamen mehr.
- Die verbindlichen Rechenregeln und Grenzen sind in `docs/BERECHNUNGEN.md` dokumentiert und durch Regressionstests abgesichert.

## [0.3.1] - 2026-09-06

- Monatskennzahlen werden wieder aus allen Kategorien berechnet. Die Top-5-Begrenzung gilt nur für die Rangliste; der Ring fasst kleinere Kategorien transparent als „Weitere Kategorien“ zusammen.

## [0.3.0] - 2026-09-06

- Gelernte Händlerregeln können korrigiert, pausiert, geteilt oder gelöscht und wahlweise nur künftig oder zusätzlich rückwirkend angewendet werden.
- Wiederkehrende Kosten und Preisänderungen sowie eine kontoabhängige Datenqualitätsübersicht sind in den Einstellungen verfügbar.
- Kategoriezuordnungen zeigen verständliche Vertrauensstufen; Amazon-Abgleiche bewerten Betrag und zeitliche Nähe.
- Die nicht belastbare Hochrechnung des laufenden Monats wurde vollständig entfernt.

## [0.2.6] - 2026-09-05

- Die einfache Browserstimme wurde durch eine natürliche deutsche Gemini-TTS-Ausgabe ersetzt. Der zentral gespeicherte Gemini-Schlüssel bleibt auf dem Server; bei einem seltenen Anbieterfehler erfolgt automatisch ein zweiter Versuch.

## [0.2.5] - 2026-09-05

- KI-Ausgabenhinweise zeigen höchstens drei nach Euro-Abweichung priorisierte Sparchancen als kompakte Karten mit Icons. Fehlende `gpt-5-mini`-Preise werden mit dem offiziellen Modellpreis ergänzt; Kleinstbeträge erscheinen nicht mehr als 0,0000 €.

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
