#!/usr/bin/env node
/**
 * Deploy updated server_index.js to the SB Games server.
 * Usage: node scratch/deploy_server.cjs
 */
const { Client } = require("ssh2");
const fs = require("fs");
const path = require("path");

const SERVER   = "94.26.83.31";
const PORT     = 22;
const USER     = "root";
const PASSWORD = "WJ1gaad33hNXRVJL9qti";
const REMOTE_DIR = "/opt/sbgames-auth";

async function run() {
  const conn = new Client();

  await new Promise((resolve, reject) => {
    conn.on("ready", resolve).on("error", reject).connect({
      host: SERVER, port: PORT, username: USER, password: PASSWORD,
      readyTimeout: 30000,
    });
  });
  console.log(`[ssh] connected to ${SERVER}`);

  // Upload server_index.js
  const localFile = path.join(__dirname, "..", "server_index.js");
  const remotePath = `${REMOTE_DIR}/server_index.js`;

  const sftp = await new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => err ? reject(err) : resolve(sftp));
  });

  console.log("[upload] server_index.js...");
  await new Promise((resolve, reject) => {
    fs.createReadStream(localFile)
      .pipe(sftp.createWriteStream(remotePath))
      .on("close", resolve)
      .on("error", reject);
  });
  console.log("[upload] server_index.js ✓");

  // Restart
  const exec = (cmd) => new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let out = "", errOut = "";
      stream.on("data", (d) => { out += d; });
      stream.stderr.on("data", (d) => { errOut += d; });
      stream.on("close", (code) => resolve({ code, out, errOut }));
    });
  });

  console.log("[ssh] restarting sbgames-auth...");
  const r = await exec("pm2 restart sbgames-auth 2>&1");
  console.log(r.out || r.errOut);

  conn.end();
  console.log("✅ Server updated and restarted!");
}

run().catch((e) => {
  console.error("❌ Deploy failed:", e.message);
  process.exit(1);
});
