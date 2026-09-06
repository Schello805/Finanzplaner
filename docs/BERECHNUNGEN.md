# Verbindliche Berechnungsregeln

Finanzkennzahlen werden ausschließlich deterministisch im Servercode berechnet. Die KI erhält nur bereits berechnete, verdichtete Kategoriesummen und darf keine Dashboardwerte erzeugen oder verändern.

## Geldbeträge

- Auswertungen unterstützen derzeit ausschließlich EUR. Fremdwährungen werden beim Import mit einer verständlichen Meldung abgelehnt.
- Additionen, Vergleiche und Aufteilungen erfolgen intern in ganzen Cent. Erst für die Anzeige werden Werte wieder in Euro umgewandelt.
- Ausgaben werden positiv dargestellt. Erstattungen mindern die Ausgaben; interne Umbuchungen und bewusst ausgeschlossene Umsätze zählen nicht.
- Kategorieaufteilungen müssen den Umsatz centgenau ergeben. Andernfalls wird die Änderung abgelehnt.
- Amazon-Aufteilungen verwenden das Größte-Reste-Verfahren. Die Summe aller Artikelanteile entspricht dadurch immer exakt dem Bankumsatz und kein Anteil wird negativ.

## Monatsanalyse

- „Letzter Monat“ ist der letzte vollständig abgeschlossene Kalendermonat.
- „Aktueller Monat“ enthält nur die tatsächlich vorhandenen Buchungen. Es findet keine Hochrechnung statt.
- Der Durchschnitt umfasst bis zu zwölf vollständige Monate vor dem aktuellen Monat. Ein Monat ohne Buchung in einer vorhandenen Kategorie zählt für diese Kategorie mit null Euro.
- Gesamtsummen umfassen alle Kategorien. Die Top-5-Auswahl ist ausschließlich eine Darstellungsbegrenzung.
- Kategorien und Monatsverlauf verwenden dieselbe normalisierte Umsatzbasis. Eine serverseitige Integritätsprüfung bricht die Antwort ab, falls beide Summen wider Erwarten voneinander abweichen.

## Eingabevalidierung

- Kalenderdaten werden real geprüft; beispielsweise wird der 31. Februar nicht automatisch in den März verschoben.
- Leere Beträge, Beträge mit mehr als zwei Nachkommastellen und ungültige Währungscodes werden abgelehnt.
- Nullbuchungen und vorgemerkte Sparkassen-Umsätze werden nicht importiert.

Die Regressionstests in `src/features/analytics/calculations.test.ts`, `src/features/amazon/allocation.test.ts` und `src/features/import/parser.test.ts` sichern diese Regeln ab.
