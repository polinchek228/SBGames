#!/usr/bin/env node
const { Client } = require("ssh2");
const SERVER = "94.26.83.31", USER = "root", PASSWORD = "WJ1gaad33hNXRVJL9qti";

async function run() {
  const conn = new Client();
  await new Promise((r, e) => conn.on("ready", r).on("error", e).connect({ host: SERVER, username: USER, password: PASSWORD, readyTimeout: 30000 }));

  const exec = (cmd) => new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let out = "";
      stream.on("data", (d) => { out += d; });
      stream.stderr.on("data", (d) => process.stderr.write(d));
      stream.on("close", () => resolve(out));
    });
  });

  console.log("=== sbgames-web.conf snippet ===");
  console.log(await exec("cat /etc/nginx/snippets/sbgames-web.conf 2>/dev/null || echo 'FILE NOT FOUND'"));
  
  console.log("\n=== CSP in sbgames-web ===");
  console.log(await exec("grep -i 'content-security-policy\\|media-src' /etc/nginx/sites-enabled/sbgames-web"));

  conn.end();
}
run().catch(e => { console.error(e.message); process.exit(1); });
