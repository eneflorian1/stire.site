#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/app"
cd "$APP_DIR"

git fetch --all --prune

# Clean any local changes and untracked files that could block checkout
git reset --hard || true
# Remove untracked (but keep ignored files like envs)
git clean -fd || true

# Ensure we are on a local branch tracking origin/main, not detached HEAD
git checkout -B main origin/main

# Docker Compose (optional)
if [ -f "docker-compose.yml" ] || [ -f "compose.yml" ]; then
  docker compose pull
  docker compose up -d --remove-orphans
fi

# Build React frontend (Vite) if Node is available
if command -v npm >/dev/null 2>&1; then
  if [ -d "frontend" ]; then
    echo "Building frontend..."
    (cd frontend && npm ci && npm run build)
  fi
else
  echo "npm not found; skipping frontend build"
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


