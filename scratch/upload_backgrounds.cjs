#!/usr/bin/env node
/**
 * Upload background videos to the SB Games server.
 * Usage: node scratch/upload_backgrounds.js
 *
 * Connects via SSH2, creates /opt/sbgames-auth/backgrounds/,
 * uploads fon1-7.mp4, and restarts the PM2 process.
 */
const { Client } = require("ssh2");
const fs = require("fs");
const path = require("path");

const SERVER   = "94.26.83.31";
const PORT     = 22;
const USER     = "root";
const PASSWORD = "WJ1gaad33hNXRVJL9qti";
const REMOTE_DIR = "/opt/sbgames-auth/backgrounds";

// Files to upload from public/
const FILES = [
  "fon1.mp4", "fon2.mp4", "fon3.mp4",
  "fon4.mp4", "fon5.mp4", "fon6.mp4", "fon7.mp4",
];

const LOCAL_DIR = path.join(__dirname, "..", "public");

async function run() {
  const conn = new Client();

  await new Promise((resolve, reject) => {
    conn.on("ready", resolve).on("error", reject).connect({
      host: SERVER, port: PORT, username: USER, password: PASSWORD,
      readyTimeout: 30000,
    });
  });
  console.log(`[ssh] connected to ${SERVER}`);

  // Helper: exec command
  const exec = (cmd) => new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let out = "", errOut = "";
      stream.on("data", (d) => { out += d; });
      stream.stderr.on("data", (d) => { errOut += d; });
      stream.on("close", (code) => {
        resolve({ code, out, errOut });
      });
    });
  });

  // Create remote directory
  console.log("[ssh] creating backgrounds directory...");
  await exec(`mkdir -p ${REMOTE_DIR}`);

  // Upload each file via SFTP
  const sftp = await new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => err ? reject(err) : resolve(sftp));
  });

  for (const file of FILES) {
    const localPath  = path.join(LOCAL_DIR, file);
    const remotePath = `${REMOTE_DIR}/${file}`;

    if (!fs.existsSync(localPath)) {
      console.log(`[skip] ${file} not found locally`);
      continue;
    }

    const sizeMB = (fs.statSync(localPath).size / (1024 * 1024)).toFixed(1);
    console.log(`[upload] ${file} (${sizeMB} MB)...`);

    await new Promise((resolve, reject) => {
      const readStream  = fs.createReadStream(localPath);
      const writeStream = sftp.createWriteStream(remotePath);
      writeStream.on("close", () => resolve());
      writeStream.on("error", (e) => reject(e));
      readStream.on("error", (e) => reject(e));
      readStream.pipe(writeStream);
    });

    console.log(`[upload] ${file} ✓`);
  }

  // Restart server
  console.log("[ssh] restarting sbgames-auth via PM2...");
  const restart = await exec("cd /opt/sbgames-auth && pm2 restart sbgames-auth 2>&1 || pm2 start server_index.js --name sbgames-auth 2>&1");
  console.log(restart.out || restart.errOut);

  // Verify backgrounds directory
  const verify = await exec(`ls -la ${REMOTE_DIR}/`);
  console.log("[verify] remote files:");
  console.log(verify.out);

  conn.end();
  console.log("\n✅ Backgrounds uploaded! Videos now stream from the server.");
}

run().catch((e) => {
  console.error("❌ Upload failed:", e.message);
  process.exit(1);
});
