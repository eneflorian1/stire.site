#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${1:-}"
if [ -z "$APP_DIR" ]; then
  APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
fi

BRANCH="${BRANCH:-main}"
SERVICE_NAME="${SERVICE_NAME:-stire-site}"
PM2_APP_NAME="${PM2_APP_NAME:-$SERVICE_NAME}"
APP_PORT="${APP_PORT:-3000}"
NPM_INSTALL_CMD="${NPM_INSTALL_CMD:-ci}"
NPM_INSTALL_FALLBACK_CMD="${NPM_INSTALL_FALLBACK_CMD:-install}"
NPM_INSTALL_JOBS="${NPM_INSTALL_JOBS:-1}"

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

ensure_pm2() {
  if command -v pm2 >/dev/null 2>&1; then
    return
  fi
  echo "[deploy] PM2 not found. Installing globally..."
  if npm install -g pm2 >/dev/null 2>&1; then
    echo "[deploy] PM2 installed."
  else
    echo "[deploy] Failed to install PM2 globally. Please install pm2 and rerun deploy." >&2
    exit 1
  fi
}

start_or_reload_pm2() {
  ensure_pm2
  if pm2 describe "$PM2_APP_NAME" >/dev/null 2>&1; then
    echo "[deploy] Reloading PM2 app $PM2_APP_NAME"
    pm2 reload "$PM2_APP_NAME" --update-env
  else
    echo "[deploy] Starting PM2 app $PM2_APP_NAME"
    pm2 start npm --name "$PM2_APP_NAME" -- run start -- --hostname 127.0.0.1 --port "$APP_PORT"
  fi
  pm2 save >/dev/null 2>&1 || true
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

echo "[deploy] Fetching $BRANCH"
git fetch origin "$BRANCH" --prune

echo "[deploy] Resetting local branch"
git reset --hard HEAD
git checkout -B "$BRANCH" "origin/$BRANCH"

DEPLOY_CACHE_DIR="$APP_DIR/.deploy-cache"
LOCK_HASH_FILE="$DEPLOY_CACHE_DIR/package-lock.hash"
CURRENT_LOCK_HASH="$(git rev-parse HEAD:package-lock.json 2>/dev/null || true)"
INSTALL_REASON=""
NEED_INSTALL=1

if [ "${FORCE_INSTALL_DEPS:-0}" = "1" ]; then
  INSTALL_REASON="forced via FORCE_INSTALL_DEPS"
elif [ ! -d node_modules ]; then
  INSTALL_REASON="node_modules directory missing"
elif [ -z "$CURRENT_LOCK_HASH" ]; then
  INSTALL_REASON="package-lock.json not found in repo"
elif [ ! -f "$LOCK_HASH_FILE" ]; then
  INSTALL_REASON="no cached package-lock hash"
else
  LAST_LOCK_HASH="$(cat "$LOCK_HASH_FILE")"
  if [ "$LAST_LOCK_HASH" = "$CURRENT_LOCK_HASH" ]; then
    NEED_INSTALL=0
  else
    INSTALL_REASON="package-lock.json changed"
  fi
fi

if [ "$NEED_INSTALL" -eq 1 ]; then
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

  if [ -n "$INSTALL_REASON" ]; then
    echo "[deploy] Installing npm dependencies ($INSTALL_REASON)"
  else
    echo "[deploy] Installing npm dependencies"
  fi
  echo "[deploy] npm command: npm $NPM_INSTALL_CMD (jobs=$npm_config_jobs)"

  if ! run_npm_install "$NPM_INSTALL_CMD" "${NPM_INSTALL_FLAGS[@]}"; then
    base_rc=$?
    echo "[deploy] npm $NPM_INSTALL_CMD failed with exit $base_rc. Retrying with npm $NPM_INSTALL_FALLBACK_CMD (jobs=1)..." >&2
    rm -rf node_modules
    export npm_config_jobs=1
    if ! run_npm_install "$NPM_INSTALL_FALLBACK_CMD" "${NPM_INSTALL_FLAGS[@]}"; then
      fallback_rc=$?
      echo "[deploy] npm $NPM_INSTALL_FALLBACK_CMD also failed (exit $fallback_rc)" >&2
      exit "$fallback_rc"
    fi
  fi

  if [ -n "$CURRENT_LOCK_HASH" ]; then
    mkdir -p "$DEPLOY_CACHE_DIR"
    printf '%s' "$CURRENT_LOCK_HASH" > "$LOCK_HASH_FILE"
  fi
else
  echo "[deploy] package-lock.json unchanged and node_modules present; skipping npm install (set FORCE_INSTALL_DEPS=1 to override)"
fi

echo "[deploy] Building Next.js app"
set -a
. "$ENV_FILE"
set +a
npm run build

start_or_reload_pm2

if command -v nginx >/dev/null 2>&1 && command -v systemctl >/dev/null 2>&1; then
  echo "[deploy] Reloading nginx"
  run_root systemctl reload nginx || true
fi

echo "[deploy] Done"
