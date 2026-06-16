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
  console.log("connected\n");

  const exec = (cmd) => new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let out = "", errOut = "";
      stream.on("data", (d) => { out += d; });
      stream.stderr.on("data", (d) => { errOut += d; });
      stream.on("close", () => resolve(out + errOut));
    });
  });

  const cmd = `
    echo "=== NGINX SITES ==="
    ls -la /etc/nginx/sites-enabled/ 2>/dev/null
    echo "=== NGINX CONF.D ==="
    ls -la /etc/nginx/conf.d/ 2>/dev/null
    echo "=== SITES-ENABLED CONTENTS ==="
    cat /etc/nginx/sites-enabled/* 2>/dev/null
    echo "=== CONF.D CONTENTS ==="
    cat /etc/nginx/conf.d/*.conf 2>/dev/null
    echo "=== PORTS ==="
    ss -tlnp 2>/dev/null | head -30
    echo "=== CERTS ==="
    ls /etc/letsencrypt/live/ 2>/dev/null
    echo "=== PM2 ==="
    pm2 list 2>/dev/null
    echo "=== SERVER_INDEX location ==="
    find /opt/sbgames-auth -name "*.js" -maxdepth 1 2>/dev/null
    cat /opt/sbgames-auth/server_index.js 2>/dev/null | head -50
  `;

  const result = await exec(cmd);
  console.log(result);
  conn.end();
}

run().catch(e => { console.error(e.message); process.exit(1); });
