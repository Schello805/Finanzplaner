# Installation und Betrieb

## Proxmox-LXC

Empfohlen werden 2 CPU-Kerne, 4 GB RAM und 20 GB Speicher. Erstelle einen unprivilegierten Ubuntu-Server-24.04-LXC mit fester lokaler IP. Docker, Nesting und ein Reverse Proxy sind nicht erforderlich.

## Installation

```bash
apt-get update && apt-get install -y git
git clone https://github.com/Schello805/Finanzplaner.git /opt/finanzplaner
cd /opt/finanzplaner
chmod +x scripts/install-ubuntu.sh scripts/update.sh
FINANZPLANER_SUBNET=192.168.1.0/24 ./scripts/install-ubuntu.sh
```

Passe das Beispielsubnetz an dein Heimnetz an. Ohne `FINANZPLANER_SUBNET` öffnet das Skript Port 8080 allgemein und gibt eine Warnung aus. Prüfe anschließend `ufw status verbose`.

## Dienste und Logs

```bash
systemctl status finanzplaner
journalctl -u finanzplaner -n 100 --no-pager
systemctl status postgresql
```

## Update

Erstelle zuerst einen Proxmox-Snapshot oder ein Backup. Danach:

```bash
sudo /opt/finanzplaner/scripts/update.sh
```

Das Skript fragt nach der Sicherungsbestätigung, lädt ausschließlich Fast-Forward-Änderungen, installiert reproduzierbar aus `package-lock.json`, migriert die Datenbank, baut die Anwendung und prüft den Dienst. Am Ende zeigt es Revision, Status, IP und Port.

## Wiederherstellung

Die Anwendung erstellt bewusst keine eigenen Backups. Stelle bei Problemen den vollständigen LXC über Proxmox wieder her. Datenbank und `/etc/finanzplaner.env` müssen stets gemeinsam auf denselben Zeitpunkt zurückgesetzt werden.

## HTTP-Hinweis

Ohne HTTPS sind Anmeldedaten und Finanzinhalte im Netzwerk nicht verschlüsselt. Der Betrieb ist ausschließlich für ein vertrauenswürdiges, nicht öffentlich erreichbares LAN vorgesehen. Nutze keine Router-Portfreigabe, kein UPnP und kein öffentliches WLAN.
