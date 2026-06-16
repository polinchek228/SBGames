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

  // Fix CSP in sbgames-web: remove :8443
  const fix1 = await exec(`sed -i 's|https://api.sbgames.hyperionsearch.xyz:8443|https://api.sbgames.hyperionsearch.xyz|g' /etc/nginx/sites-enabled/sbgames-web && sed -i 's|wss://api.sbgames.hyperionsearch.xyz:8443|wss://api.sbgames.hyperionsearch.xyz|g' /etc/nginx/sites-enabled/sbgames-web && echo "CSP fixed"`);
  console.log("Fix CSP:", fix1);

  // Test & reload nginx
  const test = await exec("nginx -t 2>&1");
  console.log("nginx test:", test);
  if (test.includes("successful")) {
    const reload = await exec("systemctl reload nginx 2>&1 && echo 'reloaded OK'");
    console.log("reload:", reload);
  }

  // Verify CSP
  const check = await exec("grep connect-src /etc/nginx/sites-enabled/sbgames-web");
  console.log("CSP check:", check);

  conn.end();
}

run().catch(e => { console.error(e.message); process.exit(1); });
