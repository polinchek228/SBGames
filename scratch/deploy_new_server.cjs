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
    console.log('1. Uploading server_index.js...');
    await uploadFile(SERVER, USER, PASS, 'server_index.js', '/opt/sbgames-auth/server_index.js');

    console.log('2. Clearing logs and restarting...');
    const restart = await runSSH(SERVER, USER, PASS,
      "echo > /home/mnntn/.pm2/logs/sbgames-auth-error.log && " +
      "echo > /home/mnntn/.pm2/logs/sbgames-auth-out.log && " +
      "pm2 restart sbgames-auth 2>&1");
    console.log(restart);

    console.log('3. Checking status...');
    const status = await runSSH(SERVER, USER, PASS,
      "sleep 4 && pm2 logs sbgames-auth --lines 15 --nostream 2>&1 | grep -v TAILING");
    console.log(status);

    console.log('\nDone!');
  } catch (e) {
    console.error('FAILED:', e.message);
  }
})();
