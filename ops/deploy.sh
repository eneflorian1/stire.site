#!/usr/bin/env bash
set -euo pipefail

# Detect project directory - accept parameter or auto-detect
if [ -n "${1:-}" ]; then
    # Use provided directory
    APP_DIR="$1"
elif [ -f "setup.sh" ] || [ -f "ops/deploy.sh" ]; then
    # We're in the project root or ops directory
    if [ -f "setup.sh" ]; then
        APP_DIR="$(pwd)"
    else
        # We're in ops/ directory, go up one level
        APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
    fi
else
    # Try to find project root by looking for setup.sh or ecosystem.config.js
    SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
    if [ -f "$SCRIPT_DIR/../setup.sh" ]; then
        APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
    elif [ -f "$SCRIPT_DIR/../ecosystem.config.js" ]; then
        APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
    else
        # Fallback to /opt/app if nothing found
        APP_DIR="/opt/app"
        echo "⚠ Warning: Could not auto-detect project directory, using default: $APP_DIR"
    fi
fi

echo "Using project directory: $APP_DIR"
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

# Derive admin API key once so backend (API_KEY) and frontend (VITE_API_KEY) stay in sync
ADMIN_API_KEY_ENV="${API_KEY:-}"

# Try to read from systemd service if not explicitly provided
if [ -z "$ADMIN_API_KEY_ENV" ] && command -v systemctl >/dev/null 2>&1; then
  if systemctl list-units --type=service | grep -q "stirix.service"; then
    SERVICE_FRAGMENT="$(systemctl show -p FragmentPath stirix.service 2>/dev/null | cut -d= -f2 || true)"
    if [ -n "$SERVICE_FRAGMENT" ] && [ -f "$SERVICE_FRAGMENT" ]; then
      ADMIN_API_KEY_ENV="$(grep -E '^Environment=API_KEY=' "$SERVICE_FRAGMENT" 2>/dev/null | sed 's/^Environment=API_KEY=//' || true)"
    fi
  fi
fi

# Fallback: try PM2 ecosystem.config.js if present (setup.sh creates it)
if [ -z "$ADMIN_API_KEY_ENV" ] && [ -f "$APP_DIR/ecosystem.config.js" ]; then
  ADMIN_API_KEY_ENV="$(grep -E 'API_KEY' "$APP_DIR/ecosystem.config.js" 2>/dev/null | head -1 | sed \"s/.*API_KEY: '\\([^']*\\)'.*/\\1/\" || true)"
fi

# Final fallback for safety (matches backend default)
if [ -z "$ADMIN_API_KEY_ENV" ]; then
  ADMIN_API_KEY_ENV="devkey"
fi

# Build React frontend (Vite) if Node is available
if command -v npm >/dev/null 2>&1; then
  if [ -d "frontend" ]; then
    echo "Building frontend..."
    (
      cd frontend
      npm ci
      # Inject the same admin API key used by the backend so /autoposter and /settings calls work in prod
      VITE_API_KEY="$ADMIN_API_KEY_ENV" npm run build
    )
  fi
else
  echo "npm not found; skipping frontend build"
fi

# Update Nginx configuration if template exists
if [ -f "$APP_DIR/ops/nginx/stirix.site" ] && command -v nginx >/dev/null 2>&1; then
  echo "Updating Nginx configuration..."
  
  # Detect domain from project directory name (same as setup.sh)
  PROJECT_NAME="$(basename "$APP_DIR")"
  DOMAIN="$PROJECT_NAME"
  
  NGINX_SITES_AVAILABLE="/etc/nginx/sites-available"
  NGINX_SITES_ENABLED="/etc/nginx/sites-enabled"
  NGINX_CONFIG_FILE="$NGINX_SITES_AVAILABLE/$DOMAIN"
  
  # Create nginx config from template
  if [ -f "$APP_DIR/ops/nginx/stirix.site" ]; then
    # Use existing template and replace domain
    sed "s/stirix\.site/$DOMAIN/g" "$APP_DIR/ops/nginx/stirix.site" > "/tmp/nginx_${DOMAIN}.conf"
    # Also replace www.stirix.site with www.$DOMAIN
    sed -i "s/www\.stirix\.site/www.$DOMAIN/g" "/tmp/nginx_${DOMAIN}.conf"
    # Also replace stire.site if present
    sed -i "s/stire\.site/$DOMAIN/g" "/tmp/nginx_${DOMAIN}.conf"
    sed -i "s/www\.stire\.site/www.$DOMAIN/g" "/tmp/nginx_${DOMAIN}.conf"
    # Replace /opt/app with actual project directory
    sed -i "s|/opt/app|$APP_DIR|g" "/tmp/nginx_${DOMAIN}.conf"
    
    # If SSL certificates exist (Certbot), uncomment SSL directives in HTTPS server block
    if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
      echo "SSL certificates found, enabling SSL configuration..."
      sed -i "s|# ssl_certificate|ssl_certificate|g" "/tmp/nginx_${DOMAIN}.conf"
      sed -i "s|# ssl_certificate_key|ssl_certificate_key|g" "/tmp/nginx_${DOMAIN}.conf"
      sed -i "s|# include /etc/letsencrypt|include /etc/letsencrypt|g" "/tmp/nginx_${DOMAIN}.conf"
      sed -i "s|# ssl_dhparam|ssl_dhparam|g" "/tmp/nginx_${DOMAIN}.conf"
    fi
    
    # Copy to nginx sites-available
    sudo cp "/tmp/nginx_${DOMAIN}.conf" "$NGINX_CONFIG_FILE"
    rm "/tmp/nginx_${DOMAIN}.conf"
    
    # Create symlink in sites-enabled
    sudo ln -sf "$NGINX_CONFIG_FILE" "$NGINX_SITES_ENABLED/$DOMAIN"
    
    # Test and reload nginx
    if sudo nginx -t 2>/dev/null; then
      sudo systemctl reload nginx
      echo "✓ Nginx configuration updated and reloaded"
    else
      echo "⚠ Nginx configuration test failed, not reloading"
      echo "  Check with: sudo nginx -t"
    fi
  fi
fi

# systemd service (rename to your service name if different)
if systemctl list-units --type=service | grep -q "stirix.service"; then
  sudo systemctl daemon-reload
  sudo systemctl restart stirix.service
fi

# PM2 (optional)
if command -v pm2 >/dev/null 2>&1; then
  # Start only if a local ecosystem.config.js exists to avoid noisy errors
  if [ -f "$APP_DIR/ecosystem.config.js" ]; then
    pm2 start "$APP_DIR/ecosystem.config.js" || true
  fi
  pm2 reload all || true
  pm2 save || true
fi

echo "Deploy OK: $(date)"


