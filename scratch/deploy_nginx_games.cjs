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
    }).on('error', e => { reject(e); })
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
    // 1. Upload nginx config
    console.log('1. Uploading nginx config...');
    await uploadFile(SERVER, USER, PASS, 'games-sb-capital.conf', '/tmp/games-sb-capital.conf');
    const nginx = await runSSH(SERVER, USER, PASS,
      "echo tcfgd12 | sudo -S cp /tmp/games-sb-capital.conf /etc/nginx/sites-available/games.sb-capital.group && " +
      "echo tcfgd12 | sudo -S nginx -t 2>&1 && " +
      "echo tcfgd12 | sudo -S systemctl reload nginx 2>&1");
    console.log(nginx);

    // 2. Verify server responds
    console.log('2. Testing...');
    const test = await runSSH(SERVER, USER, PASS,
      "curl -sk https://127.0.0.1:3000/api/ping 2>&1 || curl -s http://127.0.0.1:3000/api/ping 2>&1");
    console.log('Server response:', test);

    // 3. Test via nginx
    const testNginx = await runSSH(SERVER, USER, PASS,
      "curl -sk https://127.0.0.1/api/ping -H 'Host: games.sb-capital.group' 2>&1");
    console.log('Nginx response:', testNginx);

    console.log('\nDone!');
  } catch (e) {
    console.error('FAILED:', e.message);
  }
})();
