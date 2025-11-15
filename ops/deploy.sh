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

# Build React frontend (Vite) if Node is available
if command -v npm >/dev/null 2>&1; then
  if [ -d "frontend" ]; then
    echo "Building frontend..."
    (cd frontend && npm ci && npm run build)
  fi
else
  echo "npm not found; skipping frontend build"
fi

# Update Nginx configuration if template exists
if [ -f "$APP_DIR/ops/nginx/stire.site" ] && command -v nginx >/dev/null 2>&1; then
  echo "Updating Nginx configuration..."
  
  # Detect domain from project directory name (same as setup.sh)
  PROJECT_NAME="$(basename "$APP_DIR")"
  DOMAIN="$PROJECT_NAME"
  
  NGINX_SITES_AVAILABLE="/etc/nginx/sites-available"
  NGINX_SITES_ENABLED="/etc/nginx/sites-enabled"
  NGINX_CONFIG_FILE="$NGINX_SITES_AVAILABLE/$DOMAIN"
  
  # Create nginx config from template
  if [ -f "$APP_DIR/ops/nginx/stire.site" ]; then
    # Use existing template and replace domain
    sed "s/stire\.site/$DOMAIN/g" "$APP_DIR/ops/nginx/stire.site" > "/tmp/nginx_${DOMAIN}.conf"
    # Also replace www.stire.site with www.$DOMAIN
    sed -i "s/www\.stire\.site/www.$DOMAIN/g" "/tmp/nginx_${DOMAIN}.conf"
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
# PM2 (optional) - only if ecosystem.config.js exists
if command -v pm2 >/dev/null 2>&1; then
  if [ -f "ecosystem.config.js" ]; then
    pm2 start ecosystem.config.js || true
  else
    echo "ecosystem.config.js not found; skipping PM2 start"
  fi
  pm2 reload all || true
  pm2 save || true
fi

echo "Deploy OK: $(date)"


