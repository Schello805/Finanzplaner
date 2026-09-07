#!/usr/bin/env bash
set -euo pipefail
trap 'echo "FEHLER: Update in Zeile ${LINENO} abgebrochen. Der Befehl war: ${BASH_COMMAND}" >&2' ERR
if [[ ${EUID} -ne 0 ]]; then echo "Bitte als root ausführen: sudo /opt/finanzplaner/scripts/update.sh"; exit 1; fi
APP_DIR="/opt/finanzplaner"
APP_USER="finanzplaner"
STATE_DIR="/var/lib/finanzplaner"
LOCK_STAMP="${STATE_DIR}/package-lock.sha256"
DEPLOYMENT_STAMP="${STATE_DIR}/deployed-revision"
install -d -o "${APP_USER}" -g "${APP_USER}" -m 0750 "${STATE_DIR}"
git config --global --get-all safe.directory 2>/dev/null | grep -Fxq "${APP_DIR}" || git config --global --add safe.directory "${APP_DIR}"
cd "${APP_DIR}"
PREVIOUS_REVISION="$(git rev-parse --short=7 HEAD)"
DEPLOYED_REVISION="$(cat "${DEPLOYMENT_STAMP}" 2>/dev/null || true)"
echo "Lokaler Quellcode vor dem Abruf: ${PREVIOUS_REVISION}"
if [[ -n "${DEPLOYED_REVISION}" ]]; then echo "Erfolgreich bereitgestellte Revision: ${DEPLOYED_REVISION:0:7}"; fi
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
FULL_REVISION="$(git rev-parse HEAD)"
VERSION="v$(node -p "require('./package.json').version")"
REMOTE_REVISION="$(git rev-parse --short=7 origin/main)"
if [[ "${REVISION}" != "${REMOTE_REVISION}" ]]; then
  echo "FEHLER: Lokaler Stand ${REVISION} entspricht nicht GitHub ${REMOTE_REVISION}." >&2
  exit 1
fi
if [[ "${DEPLOYED_REVISION}" == "${FULL_REVISION}" ]]; then
  IP_ADDRESS="$(hostname -I | awk '{print $1}')"
  set -a; source /etc/finanzplaner.env; set +a
  if ! systemctl is-active --quiet finanzplaner; then
    echo "Der Code ist aktuell, aber der Dienst läuft nicht – Dienst wird neu gestartet."
    systemctl restart finanzplaner
    sleep 2
    systemctl is-active --quiet finanzplaner
  fi
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
    echo "Die beiden von npm veränderten Manifestdateien werden auf den geprüften Git-Stand zurückgesetzt." >&2
    git restore --source=HEAD -- package-lock.json package.json
    echo "Das Update wird vor Migration und Neustart abgebrochen und kann anschließend erneut aufgerufen werden." >&2
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
BUILD_START="${SECONDS}"
sudo -u "${APP_USER}" --preserve-env=APP_VERSION npm run build
echo "Anwendung fertig gebaut nach $((SECONDS-BUILD_START)) Sekunden."
systemctl restart finanzplaner
sleep 2
systemctl is-active --quiet finanzplaner
printf '%s\n' "${FULL_REVISION}" > "${DEPLOYMENT_STAMP}"
chown "${APP_USER}:${APP_USER}" "${DEPLOYMENT_STAMP}"
IP_ADDRESS="$(hostname -I | awk '{print $1}')"
echo
echo "Update erfolgreich."
echo "Vorherige Revision: ${PREVIOUS_REVISION}"
echo "Revision: ${REVISION}"
echo "Version: ${VERSION}"
echo "Dienststatus: $(systemctl is-active finanzplaner)"
echo "Adresse: http://${IP_ADDRESS}:${PORT:-8080}"
