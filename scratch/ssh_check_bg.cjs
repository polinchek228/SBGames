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

  // Check backgrounds folder
  const bg = await exec("ls -la /opt/sbgames-auth/public/backgrounds/ 2>/dev/null || echo 'FOLDER NOT FOUND'");
  console.log("=== backgrounds/ ===\n" + bg);

  // Check frames folder
  const frames = await exec("ls -la /opt/sbgames-auth/public/frames/ 2>/dev/null || echo 'FOLDER NOT FOUND'");
  console.log("\n=== frames/ ===\n" + frames);

  // Check what public folder contains
  const pub = await exec("ls -la /opt/sbgames-auth/public/ 2>/dev/null || echo 'FOLDER NOT FOUND'");
  console.log("\n=== public/ ===\n" + pub);

  // Check nginx static serving config
  const nginx = await exec("cat /etc/nginx/sites-available/sbgames-api");
  console.log("\n=== nginx bg config ===\n" + nginx);

  // Test actual request for a background
  const testBg = await exec("curl -sI 'https://api.hyperionsearch.xyz/backgrounds/fon1.mp4' 2>&1 | head -10");
  console.log("\n=== Test bg request ===\n" + testBg);

  // Test frame request
  const testFrame = await exec("curl -sI 'https://api.hyperionsearch.xyz/frames/frame.png' 2>&1 | head -10");
  console.log("\n=== Test frame request ===\n" + testFrame);

  conn.end();
}

run().catch(e => { console.error(e.message); process.exit(1); });
