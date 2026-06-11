#!/usr/bin/env bash
# Запускать один раз на сервере: bash scripts/setup-server.sh

set -e
cd "$(dirname "$0")/.."

echo "[*] Генерируем .env..."

BOT_TOKEN="${BOT_TOKEN:-8703318210:AAEG9Zj12W7i6hfPnIqLXeedcZrDwH-2Os8}"
JWT_SECRET=$(openssl rand -hex 48)
ADMIN_TG_IDS="${ADMIN_TG_IDS:-8092106401}"
ADMIN_USERNAMES="${ADMIN_USERNAMES:-efseea}"

cat > .env <<EOF
BOT_TOKEN=${BOT_TOKEN}
JWT_SECRET=${JWT_SECRET}
ADMIN_TG_IDS=${ADMIN_TG_IDS}
ADMIN_USERNAMES=${ADMIN_USERNAMES}
PORT=3000
PORT_SSL=3443
BOT_USERNAME=sbgamescbot
NODE_ENV=production
EOF

chmod 600 .env
echo "[+] .env создан (JWT_SECRET свежесгенерирован)"

echo "[*] Устанавливаем зависимости..."
npm ci --omit=dev

echo "[*] Настраиваем systemd сервис..."
SERVICE_FILE=/etc/systemd/system/sbgames.service
cat > $SERVICE_FILE <<EOF
[Unit]
Description=SBGames Server
After=network.target redis.service

[Service]
Type=simple
User=www-data
WorkingDirectory=$(pwd)
EnvironmentFile=$(pwd)/.env
ExecStart=/usr/bin/node server_index.js
Restart=on-failure
RestartSec=5
# Hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$(pwd)
CapabilityBoundingSet=
AmbientCapabilities=
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable sbgames
systemctl restart sbgames
echo "[+] Сервис запущен"

echo "[*] Настраиваем fail2ban..."
cat > /etc/fail2ban/jail.d/sbgames.conf <<'EOF'
[sbgames-auth]
enabled  = true
port     = 3000,3443
filter   = sbgames-auth
logpath  = /var/log/sbgames.log
maxretry = 10
bantime  = 1800
findtime = 300
EOF

cat > /etc/fail2ban/filter.d/sbgames-auth.conf <<'EOF'
[Definition]
failregex = \[security\] blocked <HOST>
            .*"ip":"<HOST>".*429
ignoreregex =
EOF

systemctl reload fail2ban 2>/dev/null || true
echo "[+] fail2ban настроен"

echo "[*] Проверяем nginx..."
if command -v nginx &>/dev/null; then
  cat > /etc/nginx/sites-available/sbgames <<'NGINX'
limit_req_zone $binary_remote_addr zone=sbgames_api:10m rate=30r/m;
limit_conn_zone $binary_remote_addr zone=sbgames_conn:10m;

server {
    listen 80;
    server_name sbgames.hyperionsearch.xyz;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name sbgames.hyperionsearch.xyz;

    ssl_certificate     /etc/ssl/certs/sbgames.crt;
    ssl_certificate_key /etc/ssl/private/sbgames.key;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache   shared:SSL:10m;
    ssl_session_timeout 1d;
    ssl_stapling        on;
    ssl_stapling_verify on;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy no-referrer always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;

    # Rate limiting
    limit_req  zone=sbgames_api burst=10 nodelay;
    limit_conn sbgames_conn 20;

    # Block bad bots & scanners
    if ($http_user_agent ~* "(sqlmap|nikto|nmap|masscan|zgrab|dirbuster|hydra|curl/7\.[0-5])") {
        return 444;
    }

    # Static site
    root /var/www/sbgames;
    index index.html;
    try_files $uri $uri/ /index.html;

    location ~* \.(js|css|png|jpg|woff2?)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}

server {
    listen 8443 ssl http2;
    server_name api.sbgames.hyperionsearch.xyz;

    ssl_certificate     /etc/ssl/certs/sbgames.crt;
    ssl_certificate_key /etc/ssl/private/sbgames.key;
    ssl_protocols       TLSv1.2 TLSv1.3;

    # Proxy to Node
    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;

        # Limit body size
        client_max_body_size 64k;

        # Block scanners at nginx level too
        limit_req  zone=sbgames_api burst=20 nodelay;
        limit_conn sbgames_conn 10;
    }
}
NGINX

  ln -sf /etc/nginx/sites-available/sbgames /etc/nginx/sites-enabled/sbgames
  nginx -t && systemctl reload nginx
  echo "[+] nginx настроен"
fi

echo ""
echo "=============================="
echo " Установка завершена!"
echo " JWT_SECRET сохранён в .env"
echo "=============================="
