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

  // Check sbgames-web file content
  const r1 = await exec("cat /etc/nginx/sites-enabled/sbgames-web");
  console.log("=== sbgames-web ===\n" + r1);

  // Check what DNS resolves to
  const r2 = await exec("dig +short api.sbgames.hyperionsearch.xyz 2>/dev/null || nslookup api.sbgames.hyperionsearch.xyz 2>/dev/null");
  console.log("=== DNS api ===\n" + r2);

  // Check our server's public IP
  const r3 = await exec("curl -s ifconfig.me");
  console.log("=== Server IP ===\n" + r3);

  // Check if sbgames.hyperionsearch.xyz is working
  const r4 = await exec("curl -sk -o /dev/null -w '%{http_code}' --connect-to sbgames.hyperionsearch.xyz:443:127.0.0.1:443 https://sbgames.hyperionsearch.xyz/ 2>&1");
  console.log("=== sbgames direct 443 ===\n" + r4);

  // Check the security snippet
  const r5 = await exec("cat /etc/nginx/snippets/sbgames-security.conf 2>/dev/null");
  console.log("=== sbgames-security.conf ===\n" + r5);

  // Check the web snippet
  const r6 = await exec("cat /etc/nginx/snippets/sbgames-web.conf 2>/dev/null");
  console.log("=== sbgames-web.conf ===\n" + r6);

  conn.end();
}

run().catch(e => { console.error(e.message); process.exit(1); });
