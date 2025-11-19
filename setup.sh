#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
OPS_DIR="$PROJECT_DIR/ops"
SERVICE_NAME="${SERVICE_NAME:-stire-site}"
SERVICE_USER="${SERVICE_USER:-$(id -un)}"
DOMAIN="${DOMAIN:-stire.site}"
APP_PORT="${APP_PORT:-3000}"
NODE_MAJOR="${NODE_MAJOR:-20}"

if [ ! -d "$OPS_DIR" ]; then
  echo "[setup] Missing ops directory at $OPS_DIR" >&2
  exit 1
fi

if ! id -u "$SERVICE_USER" >/dev/null 2>&1; then
  echo "[setup] User '$SERVICE_USER' does not exist. Create it first or run with SERVICE_USER=<user>." >&2
  exit 1
fi

if ! command -v apt-get >/dev/null 2>&1; then
  echo "[setup] This script currently supports Debian/Ubuntu hosts (apt-get is required)." >&2
  exit 1
fi

SUDO_CMD=""
if [ "$EUID" -ne 0 ]; then
  if command -v sudo >/dev/null 2>&1; then
    SUDO_CMD="sudo"
  else
    echo "[setup] Please run as root or install sudo." >&2
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

run_as_service_user() {
  local cmd="$1"
  if [ "$(id -un)" = "$SERVICE_USER" ]; then
    bash -lc "$cmd"
    return
  fi

  if command -v sudo >/dev/null 2>&1; then
    sudo -u "$SERVICE_USER" bash -lc "$cmd"
  else
    su - "$SERVICE_USER" -c "$cmd"
  fi
}

render_template() {
  local src="$1"
  local dest="$2"
  envsubst '${PROJECT_DIR} ${SERVICE_USER} ${APP_PORT} ${SERVICE_NAME} ${DOMAIN}' < "$src" > "$dest"
}

log_step() {
  echo
  echo "==> $1"
}

export PROJECT_DIR SERVICE_USER APP_PORT SERVICE_NAME DOMAIN

log_step "Installing base packages"
run_root apt-get update
run_root apt-get install -y --no-install-recommends \
  ca-certificates curl git nginx python3-certbot-nginx \
  build-essential pkg-config unzip gettext-base

log_step "Installing Node.js ${NODE_MAJOR}.x"
INSTALLED_MAJOR=""
if command -v node >/dev/null 2>&1; then
  INSTALLED_MAJOR="$(node -v | sed 's/^v//; s/\..*$//')"
fi
if [ -z "$INSTALLED_MAJOR" ] || [ "$INSTALLED_MAJOR" -lt "$NODE_MAJOR" ]; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | run_root bash
  run_root apt-get install -y --no-install-recommends nodejs
fi
node -v
npm -v

log_step "Preparing working tree"
mkdir -p "$PROJECT_DIR/data" "$PROJECT_DIR/public" "$PROJECT_DIR/.logs"
run_root chown -R "$SERVICE_USER:$SERVICE_USER" "$PROJECT_DIR"

log_step "Installing npm dependencies"
run_as_service_user "cd '$PROJECT_DIR' && npm ci --no-audit --no-fund"
run_as_service_user "cd '$PROJECT_DIR' && npx next telemetry disable >/dev/null 2>&1 || true"

log_step "Building production bundle"
run_as_service_user "cd '$PROJECT_DIR' && npm run build"

log_step "Ensuring .env.production exists"
run_as_service_user "cd '$PROJECT_DIR' && touch .env.production"
run_root chmod 600 "$PROJECT_DIR/.env.production"
run_root chown "$SERVICE_USER:$SERVICE_USER" "$PROJECT_DIR/.env.production"

SYSTEMD_TEMPLATE="$OPS_DIR/systemd/stire-site.service"
if [ ! -f "$SYSTEMD_TEMPLATE" ]; then
  echo "[setup] Missing systemd template at $SYSTEMD_TEMPLATE" >&2
  exit 1
fi

log_step "Configuring systemd service ($SERVICE_NAME)"
render_template "$SYSTEMD_TEMPLATE" "/tmp/${SERVICE_NAME}.service"
run_root mv "/tmp/${SERVICE_NAME}.service" "/etc/systemd/system/${SERVICE_NAME}.service"
run_root systemctl daemon-reload
run_root systemctl enable --now "$SERVICE_NAME"

NGINX_TEMPLATE="$OPS_DIR/nginx/stire.site"
if [ ! -f "$NGINX_TEMPLATE" ]; then
  echo "[setup] Missing nginx template at $NGINX_TEMPLATE" >&2
  exit 1
fi

log_step "Configuring nginx for $DOMAIN"
render_template "$NGINX_TEMPLATE" "/tmp/${DOMAIN}.conf"
run_root mv "/tmp/${DOMAIN}.conf" "/etc/nginx/sites-available/${DOMAIN}.conf"
run_root ln -sf "/etc/nginx/sites-available/${DOMAIN}.conf" "/etc/nginx/sites-enabled/${DOMAIN}.conf"
run_root nginx -t
run_root systemctl reload nginx

log_step "Setup complete"
echo " Project directory : $PROJECT_DIR"
echo " Systemd service   : $SERVICE_NAME"
echo " Service user      : $SERVICE_USER"
echo " Domain            : $DOMAIN"
echo " HTTP proxy port   : $APP_PORT"
echo
cat <<'EOT'
Next steps:
  1. Update .env.production with the production SITE_BASE_URL and GOOGLE_APPLICATION_CREDENTIALS_JSON values.
  2. Run 'sudo certbot --nginx -d <domain> -d www.<domain>' when you are ready to enable HTTPS.
  3. Push your code to GitHub and configure the secrets listed in .github/workflows/deploy.yml for auto-deploy.
  4. Trigger a GitHub Actions deploy (push to main) after you add the secrets.
EOT
