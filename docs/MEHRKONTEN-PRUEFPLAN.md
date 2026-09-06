# Mehrkonten-Prüfplan

Dieser Prüfplan ist vor und nach dem Hinzufügen weiterer echter Konten auszuführen. Automatisierte Kernfälle laufen mit `npm test`.

## Automatisch abgesichert

- Persönliche Konten bleiben ohne Freigabe unsichtbar; Gemeinschafts-, eigene und betreute Kinderkonten folgen dem Berechtigungsmodell.
- Importdateien mit einer fremden oder mehreren Kontoreferenzen werden blockiert. Fehlt beim Zielkonto die IBAN, wird die fehlende Prüfung sichtbar gemeldet.
- Umsatz- und Dateidubletten sind durch kontoabhängige Datenbankschlüssel und kontogefilterte Vergleiche getrennt.
- Händlerregeln gelten standardmäßig nur für das Ursprungskonto. Eine Anwendung auf freigegebene Familienkonten erfordert den sichtbaren Schalter „Auf freigegebene Familienkonten anwenden“.
- Analysen, KI-Hinweise, wiederkehrende Kosten, Amazon-Abgleich und Datenqualität verwenden ausschließlich die serverseitig ermittelten sichtbaren Konten.
- Interne Umbuchungen werden nur als Vorschlag erkannt, wenn Betrag, Gegenrichtung und Währung centgenau stimmen, beide Konten verschieden und die Buchungen höchstens drei Tage auseinanderliegen. Beide Seiten werden erst nach Bestätigung ausgeschlossen.

## Abnahme mit Testkonto

1. Ein persönliches Testkonto für den zweiten Erwachsenen anlegen, aber nicht freigeben.
2. Als erster Erwachsener prüfen, dass Konto und Umsätze in keiner Liste, Analyse oder API-Antwort erscheinen.
3. Konto freigeben und prüfen, dass es sofort in Kontofiltern erscheint; Freigabe anschließend wieder entziehen.
4. Auf beiden Konten eine betragsgleiche Händlerbuchung importieren. Beide müssen bestehen bleiben.
5. Eine CSV absichtlich für das falsche Zielkonto auswählen. Der Import muss vor der Vorschau stoppen.
6. Einen Händler auf Konto A kategorisieren. Die Regel darf Konto B nur bei aktivierter Familienfreigabe verändern.
7. Eine Überweisung von Konto A nach Konto B importieren und den Vorschlag unter „Datenqualität“ bestätigen. Beide Buchungen dürfen danach nicht mehr in Ausgaben oder Einnahmen zählen.
8. Einzelkonto- und Gesamtfilter vergleichen; die Gesamtzahl muss der Summe der einzeln sichtbaren Konten entsprechen.

## Offene Roadmap

- Browsergestützte Ende-zu-Ende-Tests mit einer isolierten Testdatenbank, sobald eine separate Testinstallation vorgesehen ist.
- Optionaler Export eines anonymisierten Diagnosepakets für Supportfälle.
