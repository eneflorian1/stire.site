#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/app"
cd "$APP_DIR"

git fetch --all --prune
git reset --hard origin/main
git pull --rebase

# Docker Compose (optional)
if [ -f "docker-compose.yml" ] || [ -f "compose.yml" ]; then
  docker compose pull
  docker compose up -d --remove-orphans
fi

# systemd service (rename to your service name if different)
if systemctl list-units --type=service | grep -q "stirix.service"; then
  sudo systemctl daemon-reload
  sudo systemctl restart stirix.service
fi

# PM2 (optional)
if command -v pm2 >/dev/null 2>&1; then
  pm2 start ecosystem.config.js || true
  pm2 reload all || true
  pm2 save || true
fi

echo "Deploy OK: $(date)"


