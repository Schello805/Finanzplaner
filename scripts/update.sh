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
if [[ -n "$(git status --porcelain --untracked-files=all)" ]]; then
  echo "FEHLER: Im Installationsverzeichnis befinden sich lokale Änderungen." >&2
  echo "Das Update wurde abgebrochen, damit keine Dateien überschrieben werden." >&2
  git status --short >&2
  exit 1
fi
git fetch --prune origin main
if git merge-base --is-ancestor HEAD origin/main; then
  git merge --ff-only origin/main
elif git merge-base --is-ancestor origin/main HEAD; then
  echo "FEHLER: Die Installation enthält lokale, noch nicht veröffentlichte Commits." >&2
  echo "Das Update wurde ohne Änderungen abgebrochen." >&2
  exit 1
else
  echo "Die Git-Historie wurde auf GitHub bereinigt. Die unveränderte Installation wird sicher auf den neuen Verlauf umgestellt …"
  git reset --hard origin/main
fi
REVISION="$(git rev-parse --short=7 HEAD)"
VERSION="v$(node -p "require('./package.json').version")"
REMOTE_REVISION="$(git rev-parse --short=7 origin/main)"
if [[ "${REVISION}" != "${REMOTE_REVISION}" ]]; then
  echo "FEHLER: Lokaler Stand ${REVISION} entspricht nicht GitHub ${REMOTE_REVISION}." >&2
  exit 1
fi
if [[ "${PREVIOUS_REVISION}" == "${REVISION}" ]]; then
  IP_ADDRESS="$(hostname -I | awk '{print $1}')"
  set -a; source /etc/finanzplaner.env; set +a
  echo
  echo "Bereits aktuell – Installation, Migration und Build werden übersprungen."
  echo "Revision: ${REVISION}"
  echo "Version: ${VERSION}"
  echo "Dienststatus: $(systemctl is-active finanzplaner)"
  echo "Adresse: http://${IP_ADDRESS}:${PORT:-8080}"
  exit 0
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
  echo "Abhängigkeiten haben sich geändert – nur Änderungen werden installiert."
  DEPENDENCY_START="${SECONDS}"
  if [[ -d node_modules ]]; then
    # Anders als `npm ci` löscht `npm install` nicht vorab alle vorhandenen
    # Pakete. Die Sperrdatei bleibt maßgeblich, während unveränderte Pakete
    # aus node_modules wiederverwendet werden.
    sudo -u "${APP_USER}" npm install --prefer-offline --no-audit --no-fund --include=dev
  else
    sudo -u "${APP_USER}" npm ci --prefer-offline --no-audit --no-fund
  fi
  if ! git diff --quiet -- package-lock.json package.json; then
    echo "FEHLER: npm wollte die festgeschriebenen Abhängigkeiten verändern." >&2
    echo "Das Update wird vor Migration und Neustart abgebrochen." >&2
    exit 1
  fi
  printf '%s\n' "${CURRENT_LOCK_HASH}" > "${LOCK_STAMP}"
  chown "${APP_USER}:${APP_USER}" "${LOCK_STAMP}"
  echo "Pakete fertig nach $((SECONDS-DEPENDENCY_START)) Sekunden."
else
  echo "Abhängigkeiten unverändert – Paketinstallation wird übersprungen."
fi
MIGRATION_START="${SECONDS}"
sudo -u "${APP_USER}" --preserve-env=DATABASE_URL npm run db:migrate
echo "Datenbankprüfung fertig nach $((SECONDS-MIGRATION_START)) Sekunden."
if ! sudo -u "${APP_USER}" --preserve-env=DATABASE_URL psql "${DATABASE_URL}" -Atqc "SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='user_preferences' AND column_name='ai_auto_accept_level'" | grep -qx 1; then
  echo "FEHLER: Die Datenbankmigration für die KI-Bestätigungsgrenze wurde nicht angewendet." >&2
  echo "Der Dienst wird zum Schutz vor einer fehlerhaften Aktualisierung nicht neu gestartet." >&2
  exit 1
fi
BUILD_START="${SECONDS}"
sudo -u "${APP_USER}" --preserve-env=APP_VERSION npm run build
echo "Anwendung fertig gebaut nach $((SECONDS-BUILD_START)) Sekunden."
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
echo "Adresse: http://${IP_ADDRESS}:${PORT:-8080}"
