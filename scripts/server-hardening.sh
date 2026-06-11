#!/bin/bash
# Server hardening — запускать на VPS
set -e

echo "=== [1/8] UFW ==="
ufw --force delete allow 8080/tcp 2>/dev/null || true
ufw allow 3443/tcp comment 'API SSL' 2>/dev/null || true
ufw allow 8443/tcp comment 'API proxied' 2>/dev/null || true
ufw --force reload
echo "[+] UFW: $(ufw status | head -3)"

echo "=== [2/8] SSH ==="
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/^#\?X11Forwarding.*/X11Forwarding no/' /etc/ssh/sshd_config
test -f /root/.ssh/id_rsa || ssh-keygen -q -t rsa -b 4096 -N '' -f /root/.ssh/id_rsa
echo "SSH pubkey:"
cat /root/.ssh/id_rsa.pub

echo "=== [3/8] nginx hardening ==="
cat > /etc/nginx/conf.d/00-hardening.conf <<'NGINX'
limit_req_zone  $binary_remote_addr zone=sbg_auth:10m     rate=5r/m;
limit_req_zone  $binary_remote_addr zone=sbg_payment:10m  rate=2r/m;
limit_req_zone  $binary_remote_addr zone=sbg_api:10m      rate=60r/m;
limit_req_zone  $binary_remote_addr zone=sbg_ws:10m       rate=10r/s;
limit_conn_zone $binary_remote_addr zone=sbg_conn:10m;

map $http_user_agent $is_bad_bot {
    default                 0;
    ~*(sqlmap|nikto|nmap)   1;
    ~*(masscan|zgrab)       1;
    ~*(dirbuster|hydra)     1;
    ~*(python-requests/2\.[0-3]) 1;
    ~*(curl/7\.[0-5]\.|wget/1\.1[0-9]\.) 1;
    ~*(ahrefsbot|mj12bot|petalbot|semrush) 1;
    ""                      1;
}
NGINX

cat > /etc/nginx/snippets/sbgames-security.conf <<'NGINX'
limit_req zone=sbg_api burst=20 nodelay;
limit_conn sbg_conn 30;
if ($is_bad_bot) { return 444; }
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "no-referrer" always;
add_header Permissions-Policy "geolocation=(), camera=(), microphone=(), payment=()" always;
add_header Cross-Origin-Opener-Policy "same-origin" always;
add_header Cross-Origin-Resource-Policy "cross-origin" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Content-Security-Policy "default-src 'none'; frame-ancestors 'none'; base-uri 'none'" always;
server_tokens off;
NGINX

for v in /etc/nginx/sites-enabled/sbgames-api /etc/nginx/sites-enabled/sbgames-web; do
  if [ -f "$v" ] && ! grep -q "sbgames-security" "$v"; then
    sed -i '/server {/a\    include /etc/nginx/snippets/sbgames-security.conf;' "$v"
  fi
done

echo "=== [4/8] fail2ban ==="
cat > /etc/fail2ban/jail.d/sbgames.conf <<'F2B'
[sbgames-brute]
enabled  = true
port     = 3000,3443,8443,443
filter   = sbgames-brute
logpath  = /root/.pm2/logs/sbgames-auth-out.log
           /root/.pm2/logs/sbgames-auth-error.log
maxretry = 6
bantime  = 3600
findtime = 300
action   = iptables-allports[name=sbgames]

[sbgames-ddos]
enabled  = true
port     = http,https
filter   = nginx-dos
logpath  = /var/log/nginx/access.log
maxretry = 100
bantime  = 600
findtime = 60

[sshd]
enabled  = true
maxretry = 3
bantime  = 86400
findtime = 600
F2B

cat > /etc/fail2ban/filter.d/sbgames-brute.conf <<'F2B'
[Definition]
failregex = \[security\] blocked <HOST>
            .*POST /auth/tg-login.* 4[0-9][0-9].*
ignoreregex =
F2B

cat > /etc/fail2ban/filter.d/nginx-dos.conf <<'F2B'
[Definition]
failregex = ^<HOST> -.*"(GET|POST).*HTTP/.*" (403|429|444) .*$
ignoreregex =
F2B

systemctl restart fail2ban
echo "[+] fail2ban: $(fail2ban-client status 2>/dev/null | grep 'Jail list')"

echo "=== [5/8] Payment anti-fraud ==="
cd /opt/sbgames-auth
cat > payment-guard.js <<'GUARD'
const payByUser = new Map();
const payByIP   = new Map();
const HOUR = 60 * 60 * 1000;

function checkPaymentAllowed(userId, ip) {
  const now = Date.now();
  if (userId) {
    const arr = (payByUser.get(userId) || []).filter(t => now - t < HOUR);
    if (arr.length >= 5) return { ok: false, msg: "Лимит заявок на пополнение: 5 в час" };
  }
  const arr2 = (payByIP.get(ip) || []).filter(t => now - t < HOUR);
  if (arr2.length >= 10) return { ok: false, msg: "Слишком много заявок с этого IP" };
  return { ok: true };
}

function recordPayment(userId, ip) {
  const now = Date.now();
  if (userId) {
    const arr = payByUser.get(userId) || [];
    arr.push(now);
    payByUser.set(userId, arr);
  }
  const arr2 = payByIP.get(ip) || [];
  arr2.push(now);
  payByIP.set(ip, arr2);
}

module.exports = { checkPaymentAllowed, recordPayment };
GUARD

# Подключаем guard в index.js
if ! grep -q "payment-guard" index.js; then
  sed -i '1i const payGuard = require("./payment-guard.js");' index.js
fi

# Добавляем guard в /payments/create
if ! grep -q "payGuard.checkPaymentAllowed" index.js; then
  python3 <<'PY'
import re
with open('/opt/sbgames-auth/index.js') as f:
    s = f.read()

old = '''app.post("/payments/create", async (req, res) => {
  const token  = (req.headers.authorization || "").replace("Bearer ", "");
  const amount = parseInt(req.body.amount, 10);
  const method = req.body.method || "card_ru";
  if (!amount || amount < 50) return res.status(400).json({ message: "Минимальная сумма — 50 СБТ" });
  let userId = null;
  if (token) { const p = verifyToken(token); if (p) userId = p.sub; }
  const invoiceId = invoiceCounter++;
  invoices.set(invoiceId, { userId, amount, method, createdAt: Date.now(), status: "pending" });
  res.json({ url: `https://t.me/${BOT_USERNAME}?start=pay_${invoiceId}_${amount}_${method}` });
});'''

new = '''app.post("/payments/create", async (req, res) => {
  const token  = (req.headers.authorization || "").replace("Bearer ", "");
  const amount = parseInt(req.body.amount, 10);
  const method = req.body.method || "card_ru";
  const ip     = getIP(req);
  let userId = null;
  if (token) { const p = verifyToken(token); if (p) userId = p.sub; }
  const guard = payGuard.checkPaymentAllowed(userId, ip);
  if (!guard.ok) return res.status(429).json({ message: guard.msg });
  if (!amount || amount < 50) return res.status(400).json({ message: "Минимальная сумма — 50 СБТ" });
  payGuard.recordPayment(userId, ip);
  const invoiceId = invoiceCounter++;
  invoices.set(invoiceId, { userId, amount, method, createdAt: Date.now(), status: "pending" });
  res.json({ url: `https://t.me/${BOT_USERNAME}?start=pay_${invoiceId}_${amount}_${method}` });
});'''

if old in s:
    s = s.replace(old, new)
    with open('/opt/sbgames-auth/index.js', 'w') as f:
        f.write(s)
    print("[+] payment guard integrated")
else:
    print("[-] /payments/create not found, skipping")
PY
fi

node -c index.js && echo "[+] syntax OK"
pm2 restart sbgames-auth --update-env
sleep 2
pm2 show sbgames-auth | grep -E 'status|restarts|uptime'

echo "=== [6/8] Monitor cron ==="
cat > /usr/local/bin/sbgames-monitor.sh <<'CRON'
#!/bin/bash
STATUS=$(curl -sk -o /dev/null -w "%{http_code}" https://api.sbgames.hyperionsearch.xyz:8443/ 2>/dev/null || echo "000")
if [ "$STATUS" != "200" ] && [ "$STATUS" != "401" ] && [ "$STATUS" != "403" ]; then
  pm2 restart sbgames-auth 2>/dev/null
  echo "[$(date)] Server down (HTTP $STATUS), restarted" >> /var/log/sbgames-monitor.log
fi
# Очистка fail2ban
fail2ban-client unban --all 2>/dev/null || true
CRON
chmod +x /usr/local/bin/sbgames-monitor.sh
(crontab -l 2>/dev/null; echo "*/2 * * * * /usr/local/bin/sbgames-monitor.sh") | crontab -

echo "=== [7/8] nginx reload ==="
nginx -t 2>&1 | tail -2 && systemctl reload nginx && echo "[+] nginx OK"

echo "=== [8/8] Финальная проверка ==="
echo "--- UFW ---"
ufw status | head -8
echo "--- fail2ban ---"
fail2ban-client status | tail -3
echo "--- port scan (только наши) ---"
ss -tlnp | grep -E ":(22|80|443|3000|3443|8443)" | head

echo ""
echo "=============================="
echo " Hardening complete!"
echo "=============================="
