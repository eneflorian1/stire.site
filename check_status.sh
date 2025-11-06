#!/usr/bin/env bash

echo "=========================================="
echo "Stirix Status Check"
echo "=========================================="

# Check PM2 status
echo ""
echo "PM2 Status:"
pm2 list | grep stirix-api || echo "  ⚠ stirix-api not found in PM2"

# Check if port 8000 is in use
echo ""
echo "Port 8000 Status:"
if command -v lsof >/dev/null 2>&1; then
    PORT_INFO=$(lsof -i:8000 2>/dev/null || echo "  ✓ Port 8000 is free")
    echo "$PORT_INFO"
elif command -v netstat >/dev/null 2>&1; then
    PORT_INFO=$(netstat -tuln | grep :8000 || echo "  ✓ Port 8000 is free")
    echo "$PORT_INFO"
else
    echo "  ⚠ Cannot check port (lsof/netstat not available)"
fi

# Check API health
echo ""
echo "API Health Check:"
if curl -s -f http://127.0.0.1:8000/health >/dev/null 2>&1; then
    HEALTH_RESPONSE=$(curl -s http://127.0.0.1:8000/health)
    echo "  ✓ API is responding: $HEALTH_RESPONSE"
else
    echo "  ✗ API is not responding"
fi

# Check database
echo ""
echo "Database Status:"
PROJECT_DIR="$(pwd)"
if [ -f "$PROJECT_DIR/server/news.db" ]; then
    DB_SIZE=$(du -h "$PROJECT_DIR/server/news.db" | cut -f1)
    echo "  ✓ Database exists: $PROJECT_DIR/server/news.db ($DB_SIZE)"
else
    echo "  ⚠ Database not found: $PROJECT_DIR/server/news.db"
fi

# Check venv
echo ""
echo "Virtual Environment:"
if [ -f "$PROJECT_DIR/server/.venv/bin/python" ]; then
    PYTHON_VERSION=$("$PROJECT_DIR/server/.venv/bin/python" --version 2>&1)
    echo "  ✓ Venv Python: $PYTHON_VERSION"
    
    # Check if uvicorn is installed
    if "$PROJECT_DIR/server/.venv/bin/python" -m uvicorn --version >/dev/null 2>&1; then
        UVICORN_VERSION=$("$PROJECT_DIR/server/.venv/bin/python" -m uvicorn --version 2>&1)
        echo "  ✓ uvicorn installed: $UVICORN_VERSION"
    else
        echo "  ✗ uvicorn not found in venv"
    fi
else
    echo "  ✗ Venv not found at $PROJECT_DIR/server/.venv"
fi

# Check PM2 logs (last 10 lines)
echo ""
echo "Recent PM2 Logs (last 10 lines):"
echo "----------------------------------------"
pm2 logs stirix-api --lines 10 --nostream 2>/dev/null || echo "  No logs available"

echo ""
echo "=========================================="
echo "Quick Fixes:"
echo "=========================================="
echo "  pm2 restart stirix-api     - Restart the application"
echo "  pm2 logs stirix-api         - View full logs"
echo "  pm2 delete stirix-api       - Remove from PM2"
echo "  ./setup.sh                  - Re-run setup"
echo "=========================================="

