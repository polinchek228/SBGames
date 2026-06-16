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

  // Test API directly on 443 from localhost
  const r1 = await exec("curl -sk -o /dev/null -w '%{http_code}' --connect-to api.sbgames.hyperionsearch.xyz:443:127.0.0.1:443 https://api.sbgames.hyperionsearch.xyz/auth/me 2>&1");
  console.log("Direct 443 (localhost):", r1);

  // Check what nginx is actually listening on 443 now
  const r2 = await exec("ss -tlnp | grep 443");
  console.log("Port 443 listeners:", r2);

  // Check nginx sites-enabled
  const r3 = await exec("cat /etc/nginx/sites-available/sbgames-api");
  console.log("API nginx config:\n", r3);

  // Check if 8443 still works (should redirect)
  const r4 = await exec("curl -sk -o /dev/null -w '%{http_code}' --connect-to api.sbgames.hyperionsearch.xyz:8443:127.0.0.1:8443 https://api.sbgames.hyperionsearch.xyz/auth/me 2>&1");
  console.log("Legacy 8443 (redirect):", r4);

  // Test from outside (through Cloudflare)
  const r5 = await exec("curl -sk -o /dev/null -w '%{http_code}' https://api.sbgames.hyperionsearch.xyz/auth/me 2>&1");
  console.log("External (Cloudflare):", r5);

  conn.end();
}

run().catch(e => { console.error(e.message); process.exit(1); });
