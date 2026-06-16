#!/usr/bin/env node
const { Client } = require("ssh2");
const conn = new Client();

async function run() {
  await new Promise((resolve, reject) => {
    conn.on("ready", resolve).on("error", reject).connect({
      host: "94.26.83.31", port: 22, username: "root",
      password: "WJ1gaad33hNXRVJL9qti", readyTimeout: 15000,
    });
  });
  console.log("connected");

  const exec = (cmd) => new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let out = "", errOut = "";
      stream.on("data", (d) => { out += d; });
      stream.stderr.on("data", (d) => { errOut += d; });
      stream.on("close", (code) => resolve({ code, out: out + errOut }));
    });
  });

  // 1) Rewrite the nginx site config for api to listen on 443 AND 8443 (keep 8443 for backward compat, redirect to 443)
  const nginxConf = `
# API vhost — ports 443 (primary) and 8443 (legacy redirect)
server {
    listen 443 ssl;
    server_name api.sbgames.hyperionsearch.xyz;

    ssl_certificate     /etc/letsencrypt/live/api.sbgames.hyperionsearch.xyz/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.sbgames.hyperionsearch.xyz/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;

    # Telegram webhook
    location /tg-webhook {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 30;
        limit_req zone=sbg_api burst=30 nodelay;
    }

    location / {
        include /etc/nginx/snippets/sbgames-security.conf;
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }
}

# Legacy 8443 → redirect to 443
server {
    listen 8443 ssl;
    server_name api.sbgames.hyperionsearch.xyz;

    ssl_certificate     /etc/letsencrypt/live/api.sbgames.hyperionsearch.xyz/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.sbgames.hyperionsearch.xyz/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;

    return 301 https://api.sbgames.hyperionsearch.xyz$request_uri;
}

# HTTP → HTTPS redirect
server {
    listen 80;
    server_name api.sbgames.hyperionsearch.xyz;
    return 301 https://api.sbgames.hyperionsearch.xyz$request_uri;
}
`;

  // Write the new nginx config
  const writeResult = await exec(`cat > /etc/nginx/sites-available/sbgames-api << 'NGINXEOF'${nginxConf}
NGINXEOF
echo "write done: $?"`);

  console.log("nginx config write:", writeResult.out);

  // 2) Test nginx config
  const testResult = await exec("nginx -t 2>&1");
  console.log("nginx test:", testResult.out);

  // 3) Reload nginx
  if (testResult.out.includes("successful")) {
    const reloadResult = await exec("systemctl reload nginx 2>&1 && echo 'nginx reloaded OK'");
    console.log("nginx reload:", reloadResult.out);
  } else {
    console.log("ERROR: nginx config test failed, NOT reloading");
  }

  // 4) Quick check — does port 443 now respond for api domain?
  const curlResult = await exec("curl -sk -o /dev/null -w '%{http_code}' https://api.sbgames.hyperionsearch.xyz/auth/me 2>&1");
  console.log("API on 443 status:", curlResult.out);

  conn.end();
  console.log("DONE");
}

run().catch(e => { console.error(e.message); process.exit(1); });
