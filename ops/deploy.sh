#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/app"
cd "$APP_DIR"

git fetch --all --prune
# Ensure we are on a local branch tracking origin/main, not detached HEAD
git checkout -B main origin/main

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


