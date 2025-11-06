#!/usr/bin/env bash
set -euo pipefail

# Detect folder name (domain) - assumes script is run from project root
PROJECT_DIR="$(pwd)"
PROJECT_NAME="$(basename "$PROJECT_DIR")"
DOMAIN="$PROJECT_NAME"

echo "=========================================="
echo "Stirix Setup Script"
echo "=========================================="
echo "Project directory: $PROJECT_DIR"
echo "Detected domain: $DOMAIN"
echo "=========================================="

# Check if running as root (for nginx setup)
if [ "$EUID" -eq 0 ]; then
    SUDO=""
else
    SUDO="sudo"
    echo "Note: Some operations require sudo privileges"
fi

# 1. Python virtual environment setup
echo ""
echo "[1/8] Setting up Python virtual environment..."
if [ ! -d "server/.venv" ]; then
    python3 -m venv server/.venv
    echo "✓ Virtual environment created at $PROJECT_DIR/server/.venv"
else
    echo "✓ Virtual environment already exists at $PROJECT_DIR/server/.venv"
fi

# Get absolute path to Python and pip in venv
VENV_PYTHON="$PROJECT_DIR/server/.venv/bin/python"
VENV_PIP="$PROJECT_DIR/server/.venv/bin/pip"
if [ ! -f "$VENV_PYTHON" ]; then
    # Try Windows path
    VENV_PYTHON="$PROJECT_DIR/server/.venv/Scripts/python.exe"
    VENV_PIP="$PROJECT_DIR/server/.venv/Scripts/pip.exe"
fi

# Verify venv Python exists
if [ ! -f "$VENV_PYTHON" ]; then
    echo "✗ Error: Python not found in venv at $VENV_PYTHON"
    echo "  Virtual environment may not be set up correctly"
    exit 1
fi

echo "Using Python: $VENV_PYTHON"

# Upgrade pip using venv pip
echo "Upgrading pip..."
$VENV_PIP install --upgrade pip --quiet

# 2. Install backend requirements
echo ""
echo "[2/8] Installing backend requirements..."
echo "Installing packages from server/requirements.txt..."
$VENV_PIP install -r server/requirements.txt --quiet

# Verify uvicorn is installed
echo "Verifying uvicorn installation..."
if $VENV_PYTHON -m uvicorn --version >/dev/null 2>&1; then
    echo "✓ Backend dependencies installed (uvicorn verified)"
else
    echo "⚠ Warning: uvicorn may not be installed correctly"
    echo "  Attempting to install uvicorn directly..."
    $VENV_PIP install uvicorn[standard] --quiet
    echo "✓ Backend dependencies installed"
fi

# 3. Install Node.js dependencies (if npm is available)
echo ""
echo "[3/8] Setting up frontend..."
if command -v npm >/dev/null 2>&1; then
    if [ -d "$PROJECT_DIR/frontend" ]; then
        cd "$PROJECT_DIR/frontend"
        npm ci --silent
        echo "✓ Frontend dependencies installed"
        npm run build
        echo "✓ Frontend built"
        cd "$PROJECT_DIR"
    else
        echo "⚠ Frontend directory not found, skipping"
    fi
else
    echo "⚠ npm not found, skipping frontend setup"
    echo "  Install Node.js to build the frontend"
fi

# 4. Install PM2 globally
echo ""
echo "[4/8] Installing PM2..."
if command -v pm2 >/dev/null 2>&1; then
    echo "✓ PM2 already installed"
else
    if command -v npm >/dev/null 2>&1; then
        npm install -g pm2 --silent
        echo "✓ PM2 installed globally"
    else
        echo "⚠ npm not found, cannot install PM2"
        echo "  Please install Node.js first, then run: npm install -g pm2"
        exit 1
    fi
fi

# 5. Create PM2 ecosystem config
echo ""
echo "[5/8] Creating PM2 ecosystem configuration..."

# Ensure we're in project root
cd "$PROJECT_DIR"

# VENV_PYTHON should already be set from step 1
if [ ! -f "$VENV_PYTHON" ]; then
    echo "✗ Error: Python not found in venv at $VENV_PYTHON"
    exit 1
fi

echo "Creating ecosystem.config.js in $PROJECT_DIR"
cat > "$PROJECT_DIR/ecosystem.config.js" <<EOF
module.exports = {
  apps: [
    {
      name: 'stirix-api',
      script: '$VENV_PYTHON',
      args: '-m uvicorn app:app --host 127.0.0.1 --port 8000 --workers 2',
      cwd: '$PROJECT_DIR/server',
      interpreter: 'none',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PYTHONUNBUFFERED: '1',
        DATABASE_URL: 'sqlite:///./news.db',
        API_KEY: 'prodkey'
      },
      error_file: '$PROJECT_DIR/logs/pm2-api-error.log',
      out_file: '$PROJECT_DIR/logs/pm2-api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true
    }
  ]
};
EOF
echo "✓ PM2 ecosystem.config.js created at $PROJECT_DIR/ecosystem.config.js"

# Verify file was created
if [ ! -f "$PROJECT_DIR/ecosystem.config.js" ]; then
    echo "✗ Error: Failed to create ecosystem.config.js"
    exit 1
fi

# Create logs directory
mkdir -p "$PROJECT_DIR/logs"

# 6. Setup Nginx configuration
echo ""
echo "[6/8] Setting up Nginx configuration..."

# Check if nginx is installed
if ! command -v nginx >/dev/null 2>&1; then
    echo "⚠ Nginx not found. Skipping Nginx setup."
    echo "  Install Nginx first: $SUDO apt-get install -y nginx"
    echo "  Then manually copy the config from ops/nginx/stirix.site"
else
NGINX_SITES_AVAILABLE="/etc/nginx/sites-available"
NGINX_SITES_ENABLED="/etc/nginx/sites-enabled"
NGINX_CONFIG_FILE="$NGINX_SITES_AVAILABLE/$DOMAIN"

# Create nginx config from template
if [ -f "ops/nginx/stirix.site" ]; then
    # Use existing template and replace domain
    sed "s/stirix\.site/$DOMAIN/g" ops/nginx/stirix.site > "/tmp/nginx_${DOMAIN}.conf"
    # Also replace www.stirix.site with www.$DOMAIN
    sed -i "s/www\.stirix\.site/www.$DOMAIN/g" "/tmp/nginx_${DOMAIN}.conf"
    # Replace /opt/app with actual project directory
    sed -i "s|/opt/app|$PROJECT_DIR|g" "/tmp/nginx_${DOMAIN}.conf"
else
    # Create new nginx config
    cat > "/tmp/nginx_${DOMAIN}.conf" <<NGINX_EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

    client_max_body_size 20m;

    # Serve React build from Vite
    root $PROJECT_DIR/frontend/dist;
    index index.html;

    # SPA fallback
    location / {
        try_files \$uri /index.html;
    }

    # Backend API (frontend expects /api prefix)
    location /api/ {
        proxy_pass         http://127.0.0.1:8000/;
        proxy_http_version 1.1;
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_read_timeout 120s;
    }

    # Health check (direct to backend)
    location /health {
        proxy_pass http://127.0.0.1:8000/health;
    }
}
NGINX_EOF
fi

# Copy to nginx sites-available
$SUDO cp "/tmp/nginx_${DOMAIN}.conf" "$NGINX_CONFIG_FILE"
rm "/tmp/nginx_${DOMAIN}.conf"

# Create symlink in sites-enabled
$SUDO ln -sf "$NGINX_CONFIG_FILE" "$NGINX_SITES_ENABLED/$DOMAIN"

# Test nginx configuration
if $SUDO nginx -t 2>/dev/null; then
    echo "✓ Nginx configuration created and validated"
    echo "  Config: $NGINX_CONFIG_FILE"
    echo "  Domain: $DOMAIN www.$DOMAIN"
    echo "  Run '$SUDO systemctl reload nginx' to apply changes"
else
    echo "⚠ Nginx configuration test failed"
    echo "  Please check the configuration manually"
fi
fi

# 7. Run deploy script
echo ""
echo "[7/8] Running deploy script..."
if [ -f "ops/deploy.sh" ]; then
    chmod +x ops/deploy.sh
    bash ops/deploy.sh || {
        echo "⚠ Deploy script had issues, continuing anyway..."
    }
    echo "✓ Deploy script executed"
else
    echo "⚠ Deploy script not found, skipping"
fi

# 8. Start with PM2
echo ""
echo "[8/8] Starting application with PM2..."

# Ensure we're in project root
cd "$PROJECT_DIR"

# Verify ecosystem.config.js exists
if [ ! -f "$PROJECT_DIR/ecosystem.config.js" ]; then
    echo "✗ Error: ecosystem.config.js not found at $PROJECT_DIR/ecosystem.config.js"
    exit 1
fi

# Verify venv Python exists
if [ ! -f "$VENV_PYTHON" ]; then
    echo "✗ Error: Python not found in venv at $VENV_PYTHON"
    exit 1
fi

# Stop existing PM2 processes if any
pm2 delete stirix-api 2>/dev/null || true

# Start the application
echo "Starting stirix-api with PM2..."
pm2 start "$PROJECT_DIR/ecosystem.config.js"

# Wait a moment and verify it started
sleep 2
if pm2 list | grep -q "stirix-api.*online"; then
    echo "✓ Application started successfully with PM2"
else
    echo "⚠ Warning: Application may not be running correctly"
    echo "  Check logs with: pm2 logs stirix-api"
fi

pm2 save

echo ""
echo "=========================================="
echo "Setup Complete!"
echo "=========================================="
echo "Domain: $DOMAIN"
echo "Backend: Running on PM2 (stirix-api)"
echo "Frontend: Built and served via Nginx"
echo "Virtual Environment: $PROJECT_DIR/server/.venv"
echo ""
echo "PM2 Commands:"
echo "  pm2 status          - Check status"
echo "  pm2 logs stirix-api - View logs"
echo "  pm2 restart stirix-api - Restart backend"
echo "  pm2 stop stirix-api - Stop backend"
echo ""
echo "Nginx Commands:"
echo "  $SUDO nginx -t              - Test configuration"
echo "  $SUDO systemctl reload nginx - Reload Nginx"
echo ""
echo "Manual Backend (for testing):"
echo "  $VENV_PYTHON -m uvicorn app:app --reload --port 8000"
echo "  (run from: $PROJECT_DIR/server)"
echo ""
echo "Next steps:"
echo "  1. Update DNS to point $DOMAIN to this server"
echo "  2. Run: $SUDO systemctl reload nginx"
echo "  3. (Optional) Setup SSL: $SUDO certbot --nginx -d $DOMAIN -d www.$DOMAIN"
echo "=========================================="

