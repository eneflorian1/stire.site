#!/usr/bin/env bash
set -euo pipefail

# Lightweight helper to (re)deploy the nginx vhost from ops/nginx/stire.site.conf
# without re-running the full setup (Node/PM2/etc.).
#
# Usage (on server, from project root):
#   DOMAIN=stire.site SERVICE_USER=www-data APP_PORT=3000 ./ops/sync-nginx.sh

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OPS_DIR="$PROJECT_DIR/ops"
SERVICE_NAME="${SERVICE_NAME:-stire-site}"
PM2_APP_NAME="${PM2_APP_NAME:-$SERVICE_NAME}"
SERVICE_USER="${SERVICE_USER:-$(id -un)}"
DOMAIN="${DOMAIN:-stire.site}"
APP_PORT="${APP_PORT:-3000}"

SUDO_CMD=""
if [ "$EUID" -ne 0 ]; then
  if command -v sudo >/dev/null 2>&1; then
    SUDO_CMD="sudo"
  else
    echo "[sync-nginx] Please run as root or install sudo, or set SUDO_CMD env." >&2
    exit 1
  fi
fi

run_root() {
  if [ -n "$SUDO_CMD" ]; then
    "$SUDO_CMD" "$@"
  else
    "$@"
  fi
}

render_template() {
  local src="$1"
  local dest="$2"
  envsubst '${PROJECT_DIR} ${SERVICE_USER} ${APP_PORT} ${SERVICE_NAME} ${DOMAIN}' < "$src" > "$dest"
}

export PROJECT_DIR SERVICE_USER APP_PORT SERVICE_NAME DOMAIN

NGINX_TEMPLATE="$OPS_DIR/nginx/stire.site.conf"
if [ ! -f "$NGINX_TEMPLATE" ]; then
  echo "[sync-nginx] Missing nginx template at $NGINX_TEMPLATE" >&2
  exit 1
fi

echo "[sync-nginx] Rendering nginx config for domain: $DOMAIN"
TMP_CONF="/tmp/${DOMAIN}.conf"
render_template "$NGINX_TEMPLATE" "$TMP_CONF"

echo "[sync-nginx] Installing to /etc/nginx/sites-available/$DOMAIN.conf"
run_root mv "$TMP_CONF" "/etc/nginx/sites-available/${DOMAIN}.conf"
run_root ln -sf "/etc/nginx/sites-available/${DOMAIN}.conf" "/etc/nginx/sites-enabled/${DOMAIN}.conf"

echo "[sync-nginx] Testing nginx configuration..."
run_root nginx -t

echo "[sync-nginx] Reloading nginx..."
run_root systemctl reload nginx

echo "[sync-nginx] Done. Nginx config for $DOMAIN has been updated."


