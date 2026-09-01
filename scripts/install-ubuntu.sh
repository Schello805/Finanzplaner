#!/usr/bin/env bash
set -euo pipefail
trap 'echo "FEHLER: Installation in Zeile ${LINENO} abgebrochen. Der Befehl war: ${BASH_COMMAND}" >&2' ERR

if [[ ${EUID} -ne 0 ]]; then echo "Bitte als root ausführen: sudo ./scripts/install-ubuntu.sh"; exit 1; fi
if ! grep -q 'Ubuntu 24.04' /etc/os-release; then echo "Hinweis: Offiziell unterstützt wird Ubuntu Server 24.04 LTS."; fi

APP_DIR="/opt/finanzplaner"
APP_USER="finanzplaner"
APP_PORT="8080"
DB_PASSWORD="$(openssl rand -base64 30 | tr -d '/+=' | head -c 32)"
AUTH_SECRET="$(openssl rand -base64 48 | tr -d '\n')"
ENCRYPTION_KEY="$(openssl rand -base64 32 | tr -d '\n')"

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

cat > /etc/finanzplaner.env <<EOF
NODE_ENV=production
PORT=${APP_PORT}
HOSTNAME=0.0.0.0
DATABASE_URL=postgresql://finanzplaner:${DB_PASSWORD}@127.0.0.1:5432/finanzplaner
AUTH_SECRET=${AUTH_SECRET}
ENCRYPTION_KEY=${ENCRYPTION_KEY}
APP_VERSION=$(git -C "${APP_DIR}" describe --tags --always 2>/dev/null | sed 's/^v//' || echo dev)
EOF
chmod 0600 /etc/finanzplaner.env

cd "${APP_DIR}"
set -a; source /etc/finanzplaner.env; set +a
sudo -u "${APP_USER}" npm ci
sudo -u "${APP_USER}" --preserve-env=DATABASE_URL npm run db:migrate
ADMIN_RESULT="$(sudo -u "${APP_USER}" --preserve-env=DATABASE_URL node scripts/init-admin.mjs)"
sudo -u "${APP_USER}" --preserve-env=APP_VERSION npm run build

install -m 0644 deploy/finanzplaner.service /etc/systemd/system/finanzplaner.service
systemctl daemon-reload
systemctl enable --now finanzplaner

ufw allow OpenSSH >/dev/null
LOCAL_SUBNET="${FINANZPLANER_SUBNET:-}"
if [[ -n "${LOCAL_SUBNET}" ]]; then ufw allow from "${LOCAL_SUBNET}" to any port "${APP_PORT}" proto tcp; else ufw allow "${APP_PORT}/tcp"; echo "WARNUNG: Port ${APP_PORT} ist nicht auf ein Subnetz eingeschränkt. Setze FINANZPLANER_SUBNET und passe UFW an."; fi
ufw --force enable >/dev/null

IP_ADDRESS="$(hostname -I | awk '{print $1}')"
echo
echo "Finanzplaner wurde installiert."
echo "Adresse: http://${IP_ADDRESS}:${APP_PORT}"
echo "Benutzer: admin"
if [[ "${ADMIN_RESULT}" == INITIAL_ADMIN_PASSWORD=* ]]; then echo "Einmalpasswort: ${ADMIN_RESULT#INITIAL_ADMIN_PASSWORD=}"; else echo "Admin war bereits vorhanden; das Passwort wurde nicht geändert."; fi
echo "Beim ersten Login muss das Passwort geändert werden."
