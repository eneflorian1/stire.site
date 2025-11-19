#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${1:-}"
if [ -z "$APP_DIR" ]; then
  APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
fi

BRANCH="${BRANCH:-main}"
SERVICE_NAME="${SERVICE_NAME:-stire-site}"
NPM_INSTALL_CMD="${NPM_INSTALL_CMD:-ci}"
NPM_INSTALL_FALLBACK_CMD="${NPM_INSTALL_FALLBACK_CMD:-install}"
NPM_INSTALL_JOBS="${NPM_INSTALL_JOBS:-2}"

if [ ! -d "$APP_DIR/.git" ]; then
  echo "[deploy] $APP_DIR does not look like a git repository" >&2
  exit 1
fi

cd "$APP_DIR"

echo "[deploy] Working directory: $APP_DIR"

git config --global --add safe.directory "$APP_DIR" >/dev/null 2>&1 || true

SUDO_CMD=""
if [ "$EUID" -ne 0 ] && command -v sudo >/dev/null 2>&1; then
  SUDO_CMD="sudo"
fi

run_root() {
  if [ -n "$SUDO_CMD" ]; then
    "$SUDO_CMD" "$@"
  else
    "$@"
  fi
}

run_npm_install() {
  local subcmd="$1"
  shift
  npm "$subcmd" "$@"
}

ENV_FILE="$APP_DIR/.env.production"
if [ -n "${SITE_BASE_URL:-}" ] && [ -n "${GOOGLE_APPLICATION_CREDENTIALS_JSON:-}" ]; then
  echo "[deploy] Refreshing $ENV_FILE from environment"
  umask 077
  cat > "$ENV_FILE" <<EOF
SITE_BASE_URL='${SITE_BASE_URL}'
GOOGLE_APPLICATION_CREDENTIALS_JSON='${GOOGLE_APPLICATION_CREDENTIALS_JSON}'
EOF
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "[deploy] Missing $ENV_FILE. Provide SITE_BASE_URL and GOOGLE_APPLICATION_CREDENTIALS_JSON." >&2
  exit 1
fi

if command -v systemctl >/dev/null 2>&1; then
  echo "[deploy] Stopping $SERVICE_NAME"
  run_root systemctl stop "$SERVICE_NAME" >/dev/null 2>&1 || true
fi

echo "[deploy] Fetching $BRANCH"
git fetch origin "$BRANCH" --prune

echo "[deploy] Resetting local branch"
git reset --hard HEAD
git checkout -B "$BRANCH" "origin/$BRANCH"

NPM_INSTALL_FLAGS=(--no-audit --no-fund)
if [ -n "${NPM_EXTRA_INSTALL_FLAGS:-}" ]; then
  # shellcheck disable=SC2206
  EXTRA_FLAGS=(${NPM_EXTRA_INSTALL_FLAGS})
  NPM_INSTALL_FLAGS+=("${EXTRA_FLAGS[@]}")
fi

export npm_config_audit=false
export npm_config_fund=false
export npm_config_progress=false
export npm_config_jobs="$NPM_INSTALL_JOBS"

echo "[deploy] Installing npm dependencies (npm $NPM_INSTALL_CMD, jobs=$npm_config_jobs)"
if ! run_npm_install "$NPM_INSTALL_CMD" "${NPM_INSTALL_FLAGS[@]}"; then
  rc=$?
  echo "[deploy] npm $NPM_INSTALL_CMD failed with exit $rc. Retrying with npm $NPM_INSTALL_FALLBACK_CMD (jobs=1)..." >&2
  rm -rf node_modules
  export npm_config_jobs=1
  if ! run_npm_install "$NPM_INSTALL_FALLBACK_CMD" "${NPM_INSTALL_FLAGS[@]}"; then
    echo "[deploy] npm $NPM_INSTALL_FALLBACK_CMD also failed" >&2
    exit "$rc"
  fi
fi

echo "[deploy] Building Next.js app"
set -a
. "$ENV_FILE"
set +a
npm run build

if command -v systemctl >/dev/null 2>&1; then
  echo "[deploy] Starting $SERVICE_NAME"
  run_root systemctl daemon-reload
  run_root systemctl restart "$SERVICE_NAME"
  run_root systemctl enable "$SERVICE_NAME" >/dev/null 2>&1 || true
fi

if command -v nginx >/dev/null 2>&1 && command -v systemctl >/dev/null 2>&1; then
  echo "[deploy] Reloading nginx"
  run_root systemctl reload nginx || true
fi

echo "[deploy] Done"
