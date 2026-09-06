# Installation und Betrieb

## Proxmox-LXC

Empfohlen werden 2 CPU-Kerne, 4 GB RAM und 20 GB Speicher. Erstelle einen unprivilegierten Ubuntu-Server-24.04-LXC mit fester lokaler IP. Docker, Nesting und ein Reverse Proxy sind nicht erforderlich.

## Installation

```bash
apt-get update && apt-get install -y git
git clone https://github.com/Schello805/Finanzplaner.git /opt/finanzplaner
cd /opt/finanzplaner
chmod +x scripts/install-ubuntu.sh scripts/update.sh
./scripts/install-ubuntu.sh
```

Der Installer führt durch die notwendigen Angaben:

- lokales Subnetz, beispielsweise `192.168.1.0/24`; ein automatisch erkannter Wert wird vorgeschlagen und verständlich erklärt,
- HTTP-Port, standardmäßig `8080`,
- E-Mail-Adresse und Anzeigename des Administrators,
- abschließende Zusammenfassung vor Beginn der Installation.

Die Firewall öffnet den App-Port ausschließlich für das gewählte lokale Subnetz und bewahrt den SSH-Zugang. Prüfe anschließend bei Bedarf `ufw status verbose`.

Für eine automatisierte Installation ohne Terminal können dieselben Werte gesetzt werden:

```bash
ADMIN_EMAIL=admin@example.de ADMIN_DISPLAY_NAME="Michael" FINANZPLANER_SUBNET=192.168.1.0/24 PORT=8080 ./scripts/install-ubuntu.sh
```

## Dienste und Logs

```bash
systemctl status finanzplaner
journalctl -u finanzplaner -n 100 --no-pager
systemctl status postgresql
```

## Update

Ein Proxmox-Snapshot oder Backup wird empfohlen. Danach:

```bash
sudo /opt/finanzplaner/scripts/update.sh
```

Das Skript lädt ausschließlich Fast-Forward-Änderungen, installiert reproduzierbar aus `package-lock.json`, migriert die Datenbank, baut die Anwendung und prüft den Dienst. Am Ende zeigt es SemVer-Version, Git-Revision, Status, IP und Port.

## Abgebrochene Erstinstallation fortsetzen

Das Installationsskript ist wiederholbar. Falls eine ältere Version beim Datenbank-Migrationsschritt abgebrochen ist, aktualisiere zunächst den Checkout und starte es erneut:

Bei einer Wiederholung bleiben das Datenbankkennwort sowie der Anmelde- und Verschlüsselungsschlüssel aus `/etc/finanzplaner.env` unverändert. Dadurch bleiben bereits verschlüsselt gespeicherte Einstellungen und Importdaten lesbar.

```bash
cd /opt/finanzplaner
git pull --ff-only
./scripts/install-ubuntu.sh
```

Beim erneuten Lauf wird das Datenbankpasswort konsistent aktualisiert. Bereits angelegte Tabellen und ein vorhandener Admin-Benutzer werden nicht dupliziert.

## Wiederherstellung

Die Anwendung erstellt bewusst keine eigenen Backups. Stelle bei Problemen den vollständigen LXC über Proxmox wieder her. Datenbank und `/etc/finanzplaner.env` müssen stets gemeinsam auf denselben Zeitpunkt zurückgesetzt werden.

## HTTP-Hinweis

Ohne HTTPS sind Anmeldedaten und Finanzinhalte im Netzwerk nicht verschlüsselt. Der Betrieb ist ausschließlich für ein vertrauenswürdiges, nicht öffentlich erreichbares LAN vorgesehen. Nutze keine Router-Portfreigabe, kein UPnP und kein öffentliches WLAN.
