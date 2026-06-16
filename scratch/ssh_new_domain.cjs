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

  const exec = (cmd) => new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let out = "", errOut = "";
      stream.on("data", (d) => { out += d; });
      stream.stderr.on("data", (d) => { errOut += d; });
      stream.on("close", () => resolve(out + errOut));
    });
  });

  // 1) Get SSL cert for api.hyperionsearch.xyz
  console.log("=== Getting SSL cert ===");
  const cert = await exec("certbot certonly --nginx -d api.hyperionsearch.xyz --non-interactive --agree-tos --email efseea@gmail.com 2>&1");
  console.log(cert);

  // 2) Write new nginx config for api.hyperionsearch.xyz
  const nginxConf = `
server {
    listen 443 ssl;
    server_name api.hyperionsearch.xyz;

    ssl_certificate     /etc/letsencrypt/live/api.hyperionsearch.xyz/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.hyperionsearch.xyz/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;

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

# Legacy 8443 → redirect
server {
    listen 8443 ssl;
    server_name api.sbgames.hyperionsearch.xyz api.hyperionsearch.xyz;

    ssl_certificate     /etc/letsencrypt/live/api.hyperionsearch.xyz/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.hyperionsearch.xyz/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;

    return 301 https://api.hyperionsearch.xyz$request_uri;
}

server {
    listen 80;
    server_name api.hyperionsearch.xyz api.sbgames.hyperionsearch.xyz;
    return 301 https://api.hyperionsearch.xyz$request_uri;
}
`;

  const write = await exec(`cat > /etc/nginx/sites-available/sbgames-api << 'NGINXEOF'${nginxConf}
NGINXEOF
echo "write: $?"`);
  console.log("=== Write nginx:", write);

  // 3) Test & reload
  const test = await exec("nginx -t 2>&1");
  console.log("=== nginx test:", test);
  if (test.includes("successful")) {
    const reload = await exec("systemctl reload nginx 2>&1 && echo 'reloaded OK'");
    console.log("=== reload:", reload);
  }

  // 4) Update CSP in sbgames-web
  const fixCsp = await exec("sed -i 's|api.sbgames.hyperionsearch.xyz|api.hyperionsearch.xyz|g' /etc/nginx/sites-enabled/sbgames-web && echo CSP fixed");
  console.log("=== Fix CSP:", fixCsp);

  const test2 = await exec("nginx -t 2>&1 && systemctl reload nginx 2>&1 && echo 'reloaded after CSP fix'");
  console.log("=== reload after CSP:", test2);

  // 5) Test API on 443
  const curl = await exec("curl -sk -o /dev/null -w '%{http_code}' --connect-to api.hyperionsearch.xyz:443:127.0.0.1:443 https://api.hyperionsearch.xyz/auth/me 2>&1");
  console.log("=== API test:", curl);

  conn.end();
}

run().catch(e => { console.error(e.message); process.exit(1); });
