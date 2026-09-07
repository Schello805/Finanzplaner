# Hinweise zu Drittanbieter-Software

Der Finanzplaner verwendet Open-Source-Abhängigkeiten, deren jeweilige Lizenzbedingungen zusätzlich gelten. Die vollständige, versionsgenaue Liste befindet sich in `package-lock.json`.

Für die FinTS-Anbindung wird **lib-fints** verwendet:

- Projekt: <https://github.com/robocode13/lib-fints>
- Lizenz: GNU Lesser General Public License, Version 2.1 oder neuer (LGPL-2.1-or-later)
- Verwendung: FinTS-3.0-PIN/TAN-Kommunikation für Kontoinformationen und Umsatzabrufe

Am Quellcode von `lib-fints` werden durch dieses Projekt keine Änderungen vorgenommen. Die Bibliothek wird als eigenständige npm-Abhängigkeit eingebunden.
