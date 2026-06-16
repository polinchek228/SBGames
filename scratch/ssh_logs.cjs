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

  // 1) Check PM2 logs for sbgames-auth
  const logs = await exec("pm2 logs sbgames-auth --lines 50 --nostream 2>&1");
  console.log("=== PM2 LOGS ===\n" + logs);

  // 2) Check if API responds on 443 via Cloudflare
  const test = await exec("curl -sk -o /dev/null -w '%{http_code}' -H 'Host: api.hyperionsearch.xyz' https://127.0.0.1/auth/me 2>&1");
  console.log("\n=== Direct 127.0.0.1 === " + test);

  // 3) Test with proper host header
  const test2 = await exec("curl -sk 'https://api.hyperionsearch.xyz/auth/me' -w '\\nHTTP %{http_code}' 2>&1");
  console.log("=== External API === " + test2);

  // 4) Check nginx access log for recent requests
  const accessLog = await exec("tail -20 /var/log/nginx/access.log 2>/dev/null | grep -i 'api.hyperionsearch\\|auth' 2>/dev/null || tail -20 /var/log/nginx/access.log");
  console.log("\n=== NGINX ACCESS LOG ===\n" + accessLog);

  // 5) Check nginx error log
  const errorLog = await exec("tail -10 /var/log/nginx/error.log 2>/dev/null");
  console.log("\n=== NGINX ERROR LOG ===\n" + errorLog);

  conn.end();
}

run().catch(e => { console.error(e.message); process.exit(1); });
