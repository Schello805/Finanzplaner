#!/usr/bin/env bash
set -euo pipefail
if [[ ${EUID} -ne 0 ]]; then echo "Bitte als root ausführen: sudo /opt/finanzplaner/scripts/update.sh"; exit 1; fi
APP_DIR="/opt/finanzplaner"
APP_USER="finanzplaner"
read -r -p "Wurde ein aktueller Proxmox-Snapshot oder ein Backup erstellt? [j/N] " CONFIRM
[[ "${CONFIRM,,}" == "j" || "${CONFIRM,,}" == "ja" ]] || { echo "Update abgebrochen."; exit 1; }
cd "${APP_DIR}"
git fetch --tags --prune
git pull --ff-only
REVISION="$(git describe --tags --always | sed 's/^v//')"
sed -i "s/^APP_VERSION=.*/APP_VERSION=${REVISION}/" /etc/finanzplaner.env
set -a; source /etc/finanzplaner.env; set +a
sudo -u "${APP_USER}" npm ci
sudo -u "${APP_USER}" npm run db:migrate
sudo -u "${APP_USER}" --preserve-env=APP_VERSION npm run build
systemctl restart finanzplaner
sleep 2
systemctl is-active --quiet finanzplaner
IP_ADDRESS="$(hostname -I | awk '{print $1}')"
echo
echo "Update erfolgreich."
echo "Revision: ${REVISION}"
echo "Dienststatus: $(systemctl is-active finanzplaner)"
echo "Adresse: http://${IP_ADDRESS}:8080"
