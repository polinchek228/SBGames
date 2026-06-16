#!/bin/bash
# deploy-nginx.sh — Run on the server as root to fix WebSocket + nginx config
# Usage: sudo bash deploy-nginx.sh

set -e

echo "=== SBGames Nginx Fix ==="

# 1. Install nginx if not present
if ! command -v nginx &> /dev/null; then
    echo "[1/5] Installing nginx..."
    apt-get update -qq && apt-get install -y -qq nginx
else
    echo "[1/5] nginx already installed"
fi

# 2. Copy nginx config
echo "[2/5] Installing nginx config..."
cp /root/sbgames-nginx.conf /etc/nginx/sites-available/sbgames

# 3. Enable site, disable default
echo "[3/5] Enabling site..."
ln -sf /etc/nginx/sites-available/sbgames /etc/nginx/sites-enabled/sbgames
rm -f /etc/nginx/sites-enabled/default

# 4. Test config
echo "[4/5] Testing nginx config..."
nginx -t

# 5. Reload nginx
echo "[5/5] Reloading nginx..."
systemctl reload nginx || service nginx reload

echo ""
echo "=== Done! ==="
echo "WebSocket should now work on wss://api.sbgames.hyperionsearch.xyz:8443/"
echo ""
echo "Check status:"
echo "  curl -s http://127.0.0.1:3000/health"
echo "  nginx -t"
echo "  systemctl status nginx"
