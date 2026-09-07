#!/usr/bin/env bash
set -euo pipefail
trap 'echo "FEHLER: Installation in Zeile ${LINENO} abgebrochen. Der Befehl war: ${BASH_COMMAND}" >&2' ERR

if [[ ${EUID} -ne 0 ]]; then echo "Bitte als root ausführen: sudo ./scripts/install-ubuntu.sh"; exit 1; fi
if ! grep -q 'Ubuntu 24.04' /etc/os-release; then echo "Hinweis: Offiziell unterstützt wird Ubuntu Server 24.04 LTS."; fi

APP_DIR="/opt/finanzplaner"
APP_USER="finanzplaner"
ENV_FILE="/etc/finanzplaner.env"

prompt_value() {
  local variable_name="$1" label="$2" default_value="$3" explanation="$4" value=""
  if [[ -n "${explanation}" ]]; then echo; echo "${explanation}"; fi
  if [[ -n "${default_value}" ]]; then
    read -r -p "${label} [${default_value}]: " value
  else
    read -r -p "${label} (erforderlich): " value
  fi
  printf -v "${variable_name}" '%s' "${value:-${default_value}}"
}

# Eine erneute Installation darf die Schlüssel vorhandener Daten niemals
# austauschen. Die Datei wird ausschließlich von root verwaltet und kann daher
# sicher als Quelle für die bereits erzeugten Werte verwendet werden.
if [[ -f "${ENV_FILE}" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a
fi

DETECTED_SUBNET="$(ip -4 route show scope link 2>/dev/null | awk '$1 ~ /^[0-9]+\./ && $1 ~ /\// {print $1; exit}')"
DEFAULT_SUBNET="${FINANZPLANER_SUBNET:-${DETECTED_SUBNET:-192.168.1.0/24}}"
APP_PORT="${PORT:-8080}"
ADMIN_EMAIL="${ADMIN_EMAIL:-}"
ADMIN_DISPLAY_NAME="${ADMIN_DISPLAY_NAME:-Administrator}"
LOCAL_SUBNET="${FINANZPLANER_SUBNET:-}"

if [[ -t 0 ]]; then
  echo
  echo "Finanzplaner – geführte Installation"
  echo "Die vorgeschlagenen Werte stehen in eckigen Klammern. Drücke Enter, um sie zu übernehmen."
  prompt_value LOCAL_SUBNET "Lokales Subnetz" "${DEFAULT_SUBNET}" "Die Firewall erlaubt Port ${APP_PORT} nur Geräten aus deinem Heimnetz. Beispiel: 192.168.1.0/24 umfasst üblicherweise 192.168.1.1 bis 192.168.1.254. Das verhindert Zugriffe aus fremden Netzen."
  prompt_value APP_PORT "HTTP-Port der App" "${APP_PORT}" "Port 8080 ist für eine lokale Installation normalerweise passend. Ändere ihn nur, wenn er bereits belegt ist."
  while [[ -z "${ADMIN_EMAIL}" ]]; do
    prompt_value ADMIN_EMAIL "E-Mail-Adresse des Administrators" "${ADMIN_EMAIL}" "Diese Adresse wird für Passwort-Reset und wichtige System-E-Mails verwendet. Sie bleibt lokal gespeichert."
    if [[ ! "${ADMIN_EMAIL}" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]]; then echo "Bitte eine gültige E-Mail-Adresse eingeben."; ADMIN_EMAIL=""; fi
  done
  prompt_value ADMIN_DISPLAY_NAME "Anzeigename des Administrators" "${ADMIN_DISPLAY_NAME}" "Der Anzeigename erscheint später in der Benutzer- und Protokollansicht."
  echo
  echo "Zusammenfassung"
  echo "  Subnetz:    ${LOCAL_SUBNET}"
  echo "  App-Port:   ${APP_PORT}"
  echo "  Admin-Mail: ${ADMIN_EMAIL}"
  echo "  Admin-Name: ${ADMIN_DISPLAY_NAME}"
  read -r -p "Installation mit diesen Angaben starten? [J/n]: " CONFIRM_INSTALL
  if [[ "${CONFIRM_INSTALL:-j}" =~ ^[Nn]$ ]]; then echo "Installation abgebrochen."; exit 0; fi
else
  LOCAL_SUBNET="${FINANZPLANER_SUBNET:-${DEFAULT_SUBNET}}"
  if [[ -z "${ADMIN_EMAIL}" ]]; then echo "FEHLER: Ohne interaktives Terminal muss ADMIN_EMAIL gesetzt sein." >&2; exit 1; fi
fi

if [[ ! "${APP_PORT}" =~ ^[0-9]+$ ]] || (( APP_PORT < 1024 || APP_PORT > 65535 )); then echo "FEHLER: Der Port muss zwischen 1024 und 65535 liegen." >&2; exit 1; fi
if [[ -z "${LOCAL_SUBNET}" ]]; then echo "FEHLER: Ein lokales Subnetz ist erforderlich." >&2; exit 1; fi
if [[ ! "${ADMIN_EMAIL}" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]]; then echo "FEHLER: ADMIN_EMAIL ist keine gültige E-Mail-Adresse." >&2; exit 1; fi
if [[ -n "${DATABASE_URL:-}" ]]; then
  DB_PASSWORD="$(printf '%s' "${DATABASE_URL}" | sed -E 's#^postgresql://finanzplaner:([^@]+)@.*#\1#')"
else
  DB_PASSWORD="$(openssl rand -base64 30 | tr -d '/+=' | head -c 32)"
fi
AUTH_SECRET="${AUTH_SECRET:-$(openssl rand -base64 48 | tr -d '\n')}"
ENCRYPTION_KEY="${ENCRYPTION_KEY:-$(openssl rand -base64 32 | tr -d '\n')}"
IP_ADDRESS="$(hostname -I | awk '{print $1}')"

# Der Quellcode wird vom unprivilegierten Dienstbenutzer gebaut. Root führt
# Updates aus; deshalb muss Git diesen bewusst festgelegten Pfad akzeptieren.
git config --global --get-all safe.directory 2>/dev/null | grep -Fxq "${APP_DIR}" || git config --global --add safe.directory "${APP_DIR}"

apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y ca-certificates curl gnupg postgresql postgresql-client ufw openssl git
install -d -m 0755 /etc/apt/keyrings
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor --yes -o /etc/apt/keyrings/nodesource.gpg
echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" > /etc/apt/sources.list.d/nodesource.list
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs

id -u "${APP_USER}" >/dev/null 2>&1 || useradd --system --home-dir "${APP_DIR}" --shell /usr/sbin/nologin "${APP_USER}"
install -d -o "${APP_USER}" -g "${APP_USER}" -m 0750 "${APP_DIR}"
if [[ "$(pwd)" != "${APP_DIR}" ]]; then cp -a . "${APP_DIR}/"; fi
chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}"

sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='finanzplaner'" | grep -q 1 || sudo -u postgres psql -c "CREATE USER finanzplaner WITH PASSWORD '${DB_PASSWORD}'"
sudo -u postgres psql -c "ALTER USER finanzplaner WITH PASSWORD '${DB_PASSWORD}'" >/dev/null
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='finanzplaner'" | grep -q 1 || sudo -u postgres createdb --owner=finanzplaner finanzplaner

cat > "${ENV_FILE}" <<EOF
NODE_ENV=production
PORT=${APP_PORT}
HOSTNAME=0.0.0.0
DATABASE_URL=postgresql://finanzplaner:${DB_PASSWORD}@127.0.0.1:5432/finanzplaner
AUTH_SECRET=${AUTH_SECRET}
ENCRYPTION_KEY=${ENCRYPTION_KEY}
APP_VERSION="v$(node -p "require('${APP_DIR}/package.json').version")"
APP_URL=http://${IP_ADDRESS}:${APP_PORT}
FINANZPLANER_SUBNET=${LOCAL_SUBNET}
ADMIN_EMAIL=${ADMIN_EMAIL@Q}
ADMIN_DISPLAY_NAME=${ADMIN_DISPLAY_NAME@Q}
EOF
chmod 0600 "${ENV_FILE}"

cd "${APP_DIR}"
set -a; source "${ENV_FILE}"; set +a
sudo -u "${APP_USER}" npm ci --prefer-offline --no-audit --no-fund
install -d -o "${APP_USER}" -g "${APP_USER}" -m 0750 /var/lib/finanzplaner
node -e 'const fs=require("node:fs"),crypto=require("node:crypto"),lock=JSON.parse(fs.readFileSync("package-lock.json","utf8"));delete lock.version;if(lock.packages?.[""])delete lock.packages[""].version;process.stdout.write(crypto.createHash("sha256").update(JSON.stringify(lock)).digest("hex")+"\n");' > /var/lib/finanzplaner/package-lock.sha256
chown "${APP_USER}:${APP_USER}" /var/lib/finanzplaner/package-lock.sha256
sudo -u "${APP_USER}" --preserve-env=DATABASE_URL npm run db:migrate
ADMIN_RESULT="$(sudo -u "${APP_USER}" --preserve-env=DATABASE_URL,ADMIN_EMAIL,ADMIN_DISPLAY_NAME node scripts/init-admin.mjs)"
sudo -u "${APP_USER}" --preserve-env=APP_VERSION npm run build

install -m 0644 deploy/finanzplaner.service /etc/systemd/system/finanzplaner.service
systemctl daemon-reload
systemctl enable --now finanzplaner
systemctl is-active --quiet finanzplaner
git rev-parse HEAD > /var/lib/finanzplaner/deployed-revision
chown "${APP_USER}:${APP_USER}" /var/lib/finanzplaner/deployed-revision

ufw allow OpenSSH >/dev/null
ufw allow from "${LOCAL_SUBNET}" to any port "${APP_PORT}" proto tcp
ufw --force enable >/dev/null

echo
echo "Finanzplaner wurde installiert."
echo "Adresse: http://${IP_ADDRESS}:${APP_PORT}"
echo "Benutzer: admin"
if [[ "${ADMIN_RESULT}" == INITIAL_ADMIN_PASSWORD=* ]]; then echo "Einmalpasswort: ${ADMIN_RESULT#INITIAL_ADMIN_PASSWORD=}"; else echo "Admin war bereits vorhanden; das Passwort wurde nicht geändert."; fi
echo "Beim ersten Login muss das Passwort geändert werden."
