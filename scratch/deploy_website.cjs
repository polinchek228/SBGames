#!/usr/bin/env node
const { Client } = require("ssh2");
const fs = require("fs");
const path = require("path");

const SERVER = "94.26.83.31", USER = "root", PASSWORD = "WJ1gaad33hNXRVJL9qti";
const DIST_DIR = path.join(__dirname, "..", "website", "dist");

async function run() {
  const conn = new Client();
  await new Promise((r, e) => conn.on("ready", r).on("error", e).connect({ host: SERVER, username: USER, password: PASSWORD, readyTimeout: 30000 }));
  console.log("[ssh] connected");

  const exec = (cmd) => new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let out = "";
      stream.on("data", (d) => { out += d; process.stdout.write(d); });
      stream.stderr.on("data", (d) => process.stderr.write(d));
      stream.on("close", (code) => resolve({ code, out }));
    });
  });

  const sftp = await new Promise((r, e) => conn.sftp((err, s) => err ? e(err) : r(s)));

  // 1. Remove duplicate config
  console.log("\n[nginx] Removing duplicate sbgames-site config...");
  await exec("rm -f /etc/nginx/sites-enabled/sbgames-site /etc/nginx/sites-available/sbgames-site");

  // 2. Upload dist/ to /var/www/sbgames
  console.log("[upload] Uploading dist/ to /var/www/sbgames...");
  await exec("mkdir -p /var/www/sbgames && rm -rf /var/www/sbgames/*");

  const uploadDir = async (localDir, remoteDir) => {
    const entries = fs.readdirSync(localDir, { withFileTypes: true });
    await exec(`mkdir -p ${remoteDir}`);
    for (const entry of entries) {
      const localPath = path.join(localDir, entry.name);
      const remotePath = `${remoteDir}/${entry.name}`;
      if (entry.isDirectory()) {
        await uploadDir(localPath, remotePath);
      } else {
        await new Promise((resolve, reject) => {
          fs.createReadStream(localPath)
            .pipe(sftp.createWriteStream(remotePath))
            .on("close", resolve)
            .on("error", reject);
        });
      }
    }
  };

  await uploadDir(DIST_DIR, "/var/www/sbgames");
  console.log("[upload] dist/ uploaded ✓");

  // 3. Reload nginx
  console.log("[nginx] Reloading...");
  const r = await exec("nginx -t 2>&1 && systemctl reload nginx");
  console.log(r.out);

  conn.end();
  console.log("\n✅ Website deployed to https://sbgames.hyperionsearch.xyz");
}
run().catch(e => { console.error("❌", e.message); process.exit(1); });
