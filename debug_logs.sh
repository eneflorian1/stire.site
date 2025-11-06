#!/usr/bin/env bash

echo "=========================================="
echo "Stirix Debug - Full Error Logs"
echo "=========================================="

echo ""
echo "Checking for errors in PM2 logs..."
echo "----------------------------------------"

# Get all error logs
pm2 logs stirix-api --err --lines 100 --nostream 2>/dev/null | grep -i "error\|exception\|failed\|traceback" || echo "No errors found in recent logs"

echo ""
echo "=========================================="
echo "Full Error Log File:"
echo "=========================================="
if [ -f "/var/www/stire.site/logs/pm2-api-error.log" ]; then
    echo "Last 50 lines of error log:"
    tail -50 /var/www/stire.site/logs/pm2-api-error.log | grep -A 5 -B 5 -i "error\|exception\|failed" || tail -50 /var/www/stire.site/logs/pm2-api-error.log
else
    PROJECT_DIR="$(pwd)"
    if [ -f "$PROJECT_DIR/logs/pm2-api-error.log" ]; then
        echo "Last 50 lines of error log:"
        tail -50 "$PROJECT_DIR/logs/pm2-api-error.log" | grep -A 5 -B 5 -i "error\|exception\|failed" || tail -50 "$PROJECT_DIR/logs/pm2-api-error.log"
    else
        echo "Error log file not found"
    fi
fi

echo ""
echo "=========================================="
echo "Testing API Endpoints:"
echo "=========================================="

echo "Health endpoint:"
curl -s http://127.0.0.1:8000/health || echo "  ✗ Failed"

echo ""
echo "Articles endpoint:"
ARTICLES_RESPONSE=$(curl -s http://127.0.0.1:8000/articles 2>&1)
if echo "$ARTICLES_RESPONSE" | grep -q "error\|Error\|ERROR"; then
    echo "  ✗ Error in response:"
    echo "$ARTICLES_RESPONSE" | head -20
else
    ARTICLE_COUNT=$(echo "$ARTICLES_RESPONSE" | grep -o '"id"' | wc -l)
    echo "  ✓ Response OK (found $ARTICLE_COUNT articles)"
fi

echo ""
echo "Categories endpoint:"
CATEGORIES_RESPONSE=$(curl -s http://127.0.0.1:8000/categories 2>&1)
if echo "$CATEGORIES_RESPONSE" | grep -q "error\|Error\|ERROR"; then
    echo "  ✗ Error in response:"
    echo "$CATEGORIES_RESPONSE" | head -20
else
    echo "  ✓ Response OK"
fi

echo ""
echo "=========================================="
echo "Database Check:"
echo "=========================================="
PROJECT_DIR="$(pwd)"
DB_FILE="$PROJECT_DIR/server/news.db"
if [ -f "$DB_FILE" ]; then
    echo "Database file: $DB_FILE"
    echo "Size: $(du -h "$DB_FILE" | cut -f1)"
    echo "Permissions: $(ls -l "$DB_FILE" | awk '{print $1, $3, $4}')"
    
    # Try to check if database is accessible
    if command -v sqlite3 >/dev/null 2>&1; then
        echo ""
        echo "Database tables:"
        sqlite3 "$DB_FILE" ".tables" 2>/dev/null || echo "  ⚠ Cannot read database (may need permissions)"
        
        echo ""
        echo "Article count:"
        sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM article;" 2>/dev/null || echo "  ⚠ Cannot query articles table"
    fi
else
    echo "  ✗ Database file not found: $DB_FILE"
fi

echo ""
echo "=========================================="

