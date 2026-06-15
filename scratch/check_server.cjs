const { Client } = require("ssh2");

async function run() {
  const conn = new Client();
  await new Promise((resolve, reject) => {
    conn.on("ready", resolve).on("error", reject).connect({
      host: "94.26.83.31", port: 22, username: "root", password: "WJ1gaad33hNXRVJL9qti",
    });
  });

  const exec = (cmd) => new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let out = "", errOut = "";
      stream.on("data", (d) => { out += d; });
      stream.stderr.on("data", (d) => { errOut += d; });
      stream.on("close", (code) => resolve({ code, out, errOut }));
    });
  });

  // Check PM2 logs
  const logs = await exec("pm2 logs sbgames-auth --lines 20 --nostream 2>&1");
  console.log("PM2 LOGS:");
  console.log(logs.out || logs.errOut);

  // Check nginx config
  const nginx = await exec("cat /etc/nginx/sites-enabled/* 2>/dev/null | head -60 || echo 'no nginx sites'");
  console.log("\nNGINX CONFIG:");
  console.log(nginx.out || nginx.errOut);

  // Direct curl test on the server
  const curl = await exec("curl -sk https://localhost:3443/backgrounds/fon1.mp4 -o /dev/null -w '%{http_code}' 2>&1");
  console.log("\nCURL TEST (direct to 3443):", curl.out || curl.errOut);

  const curl2 = await exec("curl -sk http://localhost:3000/backgrounds/fon1.mp4 -o /dev/null -w '%{http_code}' 2>&1");
  console.log("CURL TEST (direct to 3000):", curl2.out || curl2.errOut);

  conn.end();
}

run().catch(e => console.error(e));
