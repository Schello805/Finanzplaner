#!/usr/bin/env bash
set -euo pipefail
if [[ ${EUID} -ne 0 ]]; then echo "Bitte als root ausführen: sudo /opt/finanzplaner/scripts/update.sh"; exit 1; fi
APP_DIR="/opt/finanzplaner"
APP_USER="finanzplaner"
git config --global --get-all safe.directory 2>/dev/null | grep -Fxq "${APP_DIR}" || git config --global --add safe.directory "${APP_DIR}"
cd "${APP_DIR}"
PREVIOUS_REVISION="$(git rev-parse --short=7 HEAD)"
echo "Installierte Revision: ${PREVIOUS_REVISION}"
echo "Aktueller Stand wird von GitHub abgerufen …"
git pull --ff-only --prune origin main
REVISION="$(git rev-parse --short=7 HEAD)"
VERSION="v$(node -p "require('./package.json').version")"
REMOTE_REVISION="$(git rev-parse --short=7 origin/main)"
if [[ "${REVISION}" != "${REMOTE_REVISION}" ]]; then
  echo "FEHLER: Lokaler Stand ${REVISION} entspricht nicht GitHub ${REMOTE_REVISION}." >&2
  exit 1
fi
echo "Zu installierende Version: ${VERSION} (Revision ${REVISION})"
sed -i "s/^APP_VERSION=.*/APP_VERSION=${VERSION}/" /etc/finanzplaner.env
set -a; source /etc/finanzplaner.env; set +a
STATE_DIR="/var/lib/finanzplaner"
LOCK_STAMP="${STATE_DIR}/package-lock.sha256"
install -d -o "${APP_USER}" -g "${APP_USER}" -m 0750 "${STATE_DIR}"
CURRENT_LOCK_HASH="$(sha256sum package-lock.json | awk '{print $1}')"
SAVED_LOCK_HASH="$(cat "${LOCK_STAMP}" 2>/dev/null || true)"
if [[ ! -d node_modules || "${CURRENT_LOCK_HASH}" != "${SAVED_LOCK_HASH}" ]]; then
  echo "Abhängigkeiten haben sich geändert – Pakete werden installiert."
  sudo -u "${APP_USER}" npm ci --prefer-offline --no-audit --no-fund
  printf '%s\n' "${CURRENT_LOCK_HASH}" > "${LOCK_STAMP}"
  chown "${APP_USER}:${APP_USER}" "${LOCK_STAMP}"
else
  echo "Abhängigkeiten unverändert – Paketinstallation wird übersprungen."
fi
sudo -u "${APP_USER}" --preserve-env=DATABASE_URL npm run db:migrate
sudo -u "${APP_USER}" --preserve-env=APP_VERSION npm run build
systemctl restart finanzplaner
sleep 2
systemctl is-active --quiet finanzplaner
IP_ADDRESS="$(hostname -I | awk '{print $1}')"
echo
echo "Update erfolgreich."
echo "Vorherige Revision: ${PREVIOUS_REVISION}"
echo "Revision: ${REVISION}"
echo "Version: ${VERSION}"
echo "Dienststatus: $(systemctl is-active finanzplaner)"
echo "Adresse: http://${IP_ADDRESS}:8080"
