#!/usr/bin/env node
/**
 * Upload built Vite dist/ to server and configure Nginx + SSL for sbgames.hyperionsearch.xyz
 * Usage: node scratch/setup_website.cjs
 */
const { Client } = require("ssh2");
const fs = require("fs");
const path = require("path");

const SERVER   = "94.26.83.31";
const PORT     = 22;
const USER     = "root";
const PASSWORD = "WJ1gaad33hNXRVJL9qti";
const REMOTE_DIR = "/opt/sbgames-auth";
const DIST_DIR = path.join(__dirname, "..", "dist");

const NGINX_CONF = `server {
    listen 80;
    server_name sbgames.hyperionsearch.xyz;

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name sbgames.hyperionsearch.xyz;

    ssl_certificate /etc/letsencrypt/live/sbgames.hyperionsearch.xyz/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/sbgames.hyperionsearch.xyz/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    root ${REMOTE_DIR}/site/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /backgrounds/ {
        alias ${REMOTE_DIR}/public/backgrounds/;
        add_header Access-Control-Allow-Origin *;
        expires 30d;
    }
}
`;

async function run() {
  const conn = new Client();

  await new Promise((resolve, reject) => {
    conn.on("ready", resolve).on("error", reject).connect({
      host: SERVER, port: PORT, username: USER, password: PASSWORD,
      readyTimeout: 30000,
    });
  });
  console.log(`[ssh] connected to ${SERVER}`);

  const exec = (cmd) => new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let out = "", errOut = "";
      stream.on("data", (d) => { out += d; process.stdout.write(d); });
      stream.stderr.on("data", (d) => { errOut += d; process.stderr.write(d); });
      stream.on("close", (code) => resolve({ code, out, errOut }));
    });
  });

  const sftp = await new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => err ? reject(err) : resolve(sftp));
  });

  // 1. Create remote directories
  console.log("\n[setup] Creating remote directories...");
  await exec(`mkdir -p ${REMOTE_DIR}/site/dist`);

  // 2. Upload dist/ files recursively
  console.log("[upload] Uploading dist/ files...");
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

  if (!fs.existsSync(DIST_DIR)) {
    console.error("❌ dist/ directory not found. Run 'npx vite build' first.");
    process.exit(1);
  }
  await uploadDir(DIST_DIR, `${REMOTE_DIR}/site/dist`);
  console.log("[upload] dist/ uploaded ✓");

  // 3. Install certbot if needed & get cert
  console.log("\n[ssl] Checking/installing certbot...");
  await exec("which certbot || (apt-get update -qq && apt-get install -y -qq certbot python3-certbot-nginx)");
  console.log("[ssl] Requesting certificate...");
  const certResult = await exec(
    `certbot certonly --nginx -d sbgames.hyperionsearch.xyz --non-interactive --agree-tos --email admin@hyperionsearch.xyz 2>&1 || echo "CERT_EXISTS"`
  );
  console.log(certResult.out);

  // 4. Write Nginx config
  console.log("\n[nginx] Writing config...");
  const confPath = "/etc/nginx/sites-available/sbgames-site";
  const confContent = NGINX_CONF;
  
  await new Promise((resolve, reject) => {
    const ws = sftp.createWriteStream(confPath);
    ws.on("close", resolve).on("error", reject);
    ws.end(confContent);
  });
  console.log("[nginx] Config written ✓");

  // 5. Enable site & reload
  console.log("[nginx] Enabling site & reloading...");
  const r = await exec(`
    ln -sf /etc/nginx/sites-available/sbgames-site /etc/nginx/sites-enabled/sbgames-site && \
    nginx -t 2>&1 && \
    systemctl reload nginx
  `);
  console.log(r.out || r.errOut);

  conn.end();
  console.log("\n✅ Website setup complete! https://sbgames.hyperionsearch.xyz");
}

run().catch((e) => {
  console.error("❌ Setup failed:", e.message);
  process.exit(1);
});
