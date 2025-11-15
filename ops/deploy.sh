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

# Python virtual environment + backend dependencies
BACKEND_DIR="$APP_DIR/server"
VENV_DIR="$BACKEND_DIR/venv"

if command -v python3 >/dev/null 2>&1; then
  echo "Ensuring Python virtual environment exists at: $VENV_DIR"
  if [ ! -d "$VENV_DIR" ]; then
    python3 -m venv "$VENV_DIR"
    echo "✓ Created virtual environment at $VENV_DIR"
  else
    echo "✓ Virtual environment already exists at $VENV_DIR"
  fi

  VENV_PIP="$VENV_DIR/bin/pip"
  if [ -x "$VENV_PIP" ] && [ -f "$BACKEND_DIR/requirements.txt" ]; then
    echo "Installing backend requirements..."
    "$VENV_PIP" install --upgrade pip
    "$VENV_PIP" install -r "$BACKEND_DIR/requirements.txt"
    echo "✓ Backend dependencies installed/updated"
  else
    echo "⚠ Could not find pip in venv or requirements.txt in $BACKEND_DIR"
  fi
else
  echo "⚠ python3 not found; skipping backend virtualenv/deps setup"
fi

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
  
  # Domain configuration:
  # - By default, this project is meant for stire.site
  # - You can override with DOMAIN_OVERRIDE env if you reuse the deploy script
  DOMAIN="${DOMAIN_OVERRIDE:-stire.site}"
  
  NGINX_SITES_AVAILABLE="/etc/nginx/sites-available"
  NGINX_SITES_ENABLED="/etc/nginx/sites-enabled"
  NGINX_CONFIG_FILE="$NGINX_SITES_AVAILABLE/$DOMAIN"
  
  # Create nginx config from template
  if [ -f "$APP_DIR/ops/nginx/stire.site" ]; then
    # Use existing template and replace domain
    sed "s/stire\.site/$DOMAIN/g" "$APP_DIR/ops/nginx/stire.site" > "/tmp/nginx_${DOMAIN}.conf"
    # Also replace www.stire.site with www.$DOMAIN
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
    # Disable default site if present
    sudo rm -f "$NGINX_SITES_ENABLED/default" 2>/dev/null || true
    
    # Test and reload nginx
    if sudo nginx -t 2>/dev/null; then
      sudo systemctl reload nginx
      echo "✓ Nginx configuration updated and reloaded"
    else
      echo "⚠ Nginx configuration test failed, not reloading"
      echo "  Check with: sudo nginx -t"
    fi

    # Automatic SSL with Certbot (optional)
    # Requires:
    #  - DNS already pointing $DOMAIN and www.$DOMAIN to this server
    #  - certbot installed
    #  - CERTBOT_EMAIL environment variable set (from GitHub Actions secret)
    if [ -n "${CERTBOT_EMAIL:-}" ] && command -v certbot >/dev/null 2>&1; then
      if [ ! -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
        echo "No SSL certificate found for $DOMAIN, attempting to obtain one with Certbot..."
        sudo certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" \
          --non-interactive --agree-tos --email "$CERTBOT_EMAIL" --redirect || \
          echo "⚠ Certbot failed; site will continue to run on HTTP only"
      else
        echo "✓ SSL certificate already exists for $DOMAIN (Certbot step skipped)"
      fi
    else
      echo "Certbot auto-SSL not run (missing CERTBOT_EMAIL or certbot command)."
    fi
  fi
fi

# systemd service - ensure API is running via systemd
SERVICE_NAME="${SERVICE_NAME_OVERRIDE:-stire.site}"
SERVICE_UNIT="/etc/systemd/system/${SERVICE_NAME}.service"

if [ -f "$APP_DIR/ops/systemd/stire.service" ] && command -v systemctl >/dev/null 2>&1; then
  echo "Configuring systemd service: $SERVICE_NAME"
  TMP_SERVICE="/tmp/${SERVICE_NAME}.service"
  # Use service template and replace /opt/app with actual APP_DIR
  sed "s|/opt/app|$APP_DIR|g" "$APP_DIR/ops/systemd/stire.service" > "$TMP_SERVICE"
  # Default to running as root (adjust in template if you change user)
  sed -i "s|^User=YOUR_USER|User=root|" "$TMP_SERVICE"

  sudo cp "$TMP_SERVICE" "$SERVICE_UNIT"
  rm -f "$TMP_SERVICE"

  sudo systemctl daemon-reload
  sudo systemctl enable "$SERVICE_NAME"
  sudo systemctl restart "$SERVICE_NAME"
  echo "✓ systemd service $SERVICE_NAME restarted"
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


