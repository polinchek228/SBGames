const { Client } = require('ssh2');
const fs = require('fs');

const SERVER = '62.77.154.84';
const USER = 'mnntn';
const PASS = 'tcfgd12';

function runSSH(host, user, pass, cmd) {
  return new Promise((resolve, reject) => {
    const c = new Client();
    c.on('ready', () => {
      c.exec(cmd, (e, s) => {
        let d = '';
        s.on('data', c => d += c);
        s.stderr.on('data', c => d += c);
        s.on('close', () => { c.end(); resolve(d); });
      });
    }).on('error', e => { console.error(e.message); reject(e); })
      .connect({ host, port: 22, username: user, password: pass });
  });
}

function uploadFile(host, user, pass, localPath, remotePath) {
  return new Promise((resolve, reject) => {
    const c = new Client();
    c.on('ready', () => {
      c.sftp((err, sftp) => {
        if (err) { c.end(); reject(err); return; }
        const stream = sftp.createWriteStream(remotePath);
        stream.on('close', () => { c.end(); resolve(); });
        stream.on('error', e => { c.end(); reject(e); });
        fs.createReadStream(localPath).pipe(stream);
      });
    }).on('error', e => reject(e))
      .connect({ host, port: 22, username: user, password: pass });
  });
}

(async () => {
  try {
    // 1. Generate self-signed SSL cert
    console.log('1. Generating SSL cert...');
    const ssl = await runSSH(SERVER, USER, PASS,
      "echo tcfgd12 | sudo -S openssl req -x509 -nodes -days 3650 -newkey rsa:2048 " +
      "-keyout /etc/ssl/private/sbgames.key -out /etc/ssl/certs/sbgames.crt " +
      "-subj '/CN=api.hyperionsearch.xyz' 2>&1");
    console.log(ssl);

    // 2. Upload nginx config
    console.log('2. Uploading nginx config...');
    await uploadFile(SERVER, USER, PASS, 'sbgames-api.conf', '/tmp/sbgames-api.conf');
    const nginxSetup = await runSSH(SERVER, USER, PASS,
      "echo tcfgd12 | sudo -S cp /tmp/sbgames-api.conf /etc/nginx/sites-available/sbgames-api && " +
      "echo tcfgd12 | sudo -S ln -sf /etc/nginx/sites-available/sbgames-api /etc/nginx/sites-enabled/sbgames-api && " +
      "echo tcfgd12 | sudo -S nginx -t 2>&1 && " +
      "echo tcfgd12 | sudo -S systemctl reload nginx 2>&1");
    console.log(nginxSetup);

    // 3. npm install
    console.log('3. npm install...');
    const npmInstall = await runSSH(SERVER, USER, PASS,
      "cd /opt/sbgames-auth && npm install --production 2>&1 | tail -10");
    console.log(npmInstall);

    // 4. Create backgrounds directory + upload existing backgrounds
    console.log('4. Creating backgrounds dir...');
    const bgDir = await runSSH(SERVER, USER, PASS,
      "echo tcfgd12 | sudo -S mkdir -p /opt/sbgames/backgrounds && " +
      "echo tcfgd12 | sudo -S chown mnntn:mnntn /opt/sbgames/backgrounds && echo done");
    console.log(bgDir);

    // 5. Start with PM2
    console.log('5. Starting PM2...');
    const pm2Start = await runSSH(SERVER, USER, PASS,
      "cd /opt/sbgames-auth && pm2 delete sbgames-auth 2>/dev/null; pm2 start server_index.js --name sbgames-auth --max-memory-restart 200M 2>&1");
    console.log(pm2Start);

    // 6. Check if it's running
    console.log('6. Checking status...');
    const status = await runSSH(SERVER, USER, PASS,
      "sleep 3 && pm2 list 2>&1 | grep sbgames-auth && echo --- && pm2 logs sbgames-auth --lines 5 --nostream 2>&1 | grep -v TAILING");
    console.log(status);

    console.log('\nDone!');
  } catch (e) {
    console.error('FAILED:', e.message);
  }
})();
