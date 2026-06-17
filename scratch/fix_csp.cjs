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
      stream.on("close", (code) => resolve({ code, out }));
    });
  });

  // Add media-src to CSP in sbgames-web config
  const sed = `sed -i "s|connect-src 'self' https://api.hyperionsearch.xyz wss://api.hyperionsearch.xyz https://\\\\*.hyperionsearch.xyz;|connect-src 'self' https://api.hyperionsearch.xyz wss://api.hyperionsearch.xyz https://*.hyperionsearch.xyz; media-src 'self' https://api.hyperionsearch.xyz https://*.hyperionsearch.xyz blob:;|" /etc/nginx/sites-enabled/sbgames-web`;
  
  console.log("[fix] Updating CSP...");
  const r = await exec(sed);
  console.log(r.out);

  // Verify
  console.log("\n[verify] New CSP:");
  await exec("grep -i 'content-security-policy' /etc/nginx/sites-enabled/sbgames-web");

  // Reload
  console.log("\n[nginx] Reloading...");
  const r2 = await exec("nginx -t 2>&1 && systemctl reload nginx");
  console.log(r2.out);

  conn.end();
  console.log("\n✅ CSP updated with media-src");
}
run().catch(e => { console.error("❌", e.message); process.exit(1); });
