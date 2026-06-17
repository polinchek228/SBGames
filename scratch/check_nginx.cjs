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
      stream.on("data", (d) => { out += d; process.stdout.write(d); });
      stream.stderr.on("data", (d) => process.stderr.write(d));
      stream.on("close", () => resolve(out));
    });
  });

  // Find conflicting configs
  await exec("grep -rl 'sbgames.hyperionsearch.xyz' /etc/nginx/sites-enabled/ 2>/dev/null");
  await exec("cat /etc/nginx/sites-enabled/sbgames-site 2>/dev/null | head -5");
  
  // Check DNS
  await exec("dig +short sbgames.hyperionsearch.xyz 2>/dev/null || nslookup sbgames.hyperionsearch.xyz 2>/dev/null | grep Address");

  conn.end();
}
run().catch(e => { console.error(e.message); process.exit(1); });
