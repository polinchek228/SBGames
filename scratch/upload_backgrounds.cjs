#!/usr/bin/env node
const { Client } = require("ssh2");
const fs = require("fs");
const path = require("path");

const downloads = path.join(process.env.USERPROFILE, "Downloads");
const files = [
  "2c41221bc39d4b87682307a664c39cf3a17156bb.mp4",
  "36ef79f8270e768bd365eac7d32e5f78246df91a.mp4",
  "6345416eef48f0a2a00e7f61c6ca926c838db04f.mp4",
  "7a607efd136dec22f3e73ff1f577788f8d1f99e3.mp4",
  "8786bd5c1b5026b9759927f82416e60787e459c9.mp4",
  "c588325b959d8f9abe102f95dbffee8b2b069761.mp4",
  "e0784baa9c5e1fc47cf4577a40b14a954204cbf5.mp4",
  "e524b0dc6aa2e64e1525df0db6e7701e3cd28160.mp4",
  "e8e8381b784e01defa002fdfca3c05810e667396.mp4",
  "ecaec9741996bd52333b5d0848504d840b1a5206.mp4",
  "f8401a4804ea458142ca8e1e80494d5a48cc1279.mp4",
  "fdc6faed91add24b6519612f9b9143bebb443e85.mp4",
];

async function run() {
  const conn = new Client();
  await new Promise((resolve, reject) => {
    conn.on("ready", resolve).on("error", reject).connect({
      host: "94.26.83.31", port: 22, username: "root",
      password: "WJ1gaad33hNXRVJL9qti", readyTimeout: 30000,
    });
  });
  console.log("[ssh] connected");

  const sftp = await new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => err ? reject(err) : resolve(sftp));
  });

  // Try uploading first file to test
  const testLocal = path.join(downloads, files[0]);
  const testRemote = "/opt/sbgames-auth/public/backgrounds/fon8.mp4";
  console.log(`[test] uploading ${files[0]}...`);
  
  await new Promise((resolve, reject) => {
    const read = fs.createReadStream(testLocal);
    const write = sftp.createWriteStream(testRemote);
    write.on("close", () => { console.log("[test] first file done"); resolve(); });
    write.on("error", (e) => { console.error("[test] write error:", e.message); reject(e); });
    read.on("error", (e) => { console.error("[test] read error:", e.message); reject(e); });
    read.pipe(write);
  });

  // Upload remaining
  for (let i = 1; i < files.length; i++) {
    const localPath = path.join(downloads, files[i]);
    const remoteName = `fon${i + 8}.mp4`;
    const remotePath = `/opt/sbgames-auth/public/backgrounds/${remoteName}`;
    const size = fs.statSync(localPath).size;
    process.stdout.write(`[${i + 1}/${files.length}] ${remoteName} (${(size / 1024 / 1024).toFixed(1)}MB)... `);
    await new Promise((resolve, reject) => {
      fs.createReadStream(localPath)
        .pipe(sftp.createWriteStream(remotePath))
        .on("close", resolve)
        .on("error", reject);
    });
    console.log("done");
  }

  conn.end();
  console.log("\n✅ All uploaded!");
}

run().catch(e => { console.error("❌", e.message); process.exit(1); });
