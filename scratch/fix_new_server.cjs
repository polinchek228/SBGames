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
    // Upload fixed package.json
    console.log('1. Uploading package.json...');
    await uploadFile(SERVER, USER, PASS, 'server_package.json', '/opt/sbgames-auth/package.json');

    // Reinstall deps
    console.log('2. Reinstalling npm deps...');
    const npm = await runSSH(SERVER, USER, PASS,
      "cd /opt/sbgames-auth && rm -rf node_modules && npm install --production 2>&1 | tail -10");
    console.log(npm);

    // Restart PM2
    console.log('3. Restarting PM2...');
    const pm2 = await runSSH(SERVER, USER, PASS,
      "cd /opt/sbgames-auth && pm2 restart sbgames-auth 2>&1");
    console.log(pm2);

    // Wait and check
    console.log('4. Checking...');
    const status = await runSSH(SERVER, USER, PASS,
      "sleep 4 && pm2 logs sbgames-auth --lines 10 --nostream 2>&1 | grep -v TAILING");
    console.log(status);

    console.log('\nDone!');
  } catch (e) {
    console.error('FAILED:', e.message);
  }
})();
