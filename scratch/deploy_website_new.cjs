const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const SERVER = '62.77.154.84';
const USER = 'mnntn';
const PASS = 'tcfgd12';
const DIST_DIR = path.join(__dirname, '..', 'website', 'dist');
const REMOTE_DIR = '/var/www/sbgames';

function runSSH(cmd) {
  return new Promise((resolve, reject) => {
    const c = new Client();
    c.on('ready', () => {
      c.exec(cmd, (e, s) => {
        let d = '';
        s.on('data', c => { d += c; process.stdout.write(c); });
        s.stderr.on('data', c => { d += c; process.stderr.write(c); });
        s.on('close', () => { c.end(); resolve(d); });
      });
    }).on('error', e => reject(e))
      .connect({ host: SERVER, port: 22, username: USER, password: PASS, readyTimeout: 30000 });
  });
}

function sftpUpload(localPath, remotePath) {
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
      .connect({ host: SERVER, port: 22, username: USER, password: PASS, readyTimeout: 30000 });
  });
}

async function uploadDir(localDir, remoteDir) {
  const entries = fs.readdirSync(localDir, { withFileTypes: true });
  await runSSH(`mkdir -p ${remoteDir}`);
  for (const entry of entries) {
    const localPath = path.join(localDir, entry.name);
    const remotePath = `${remoteDir}/${entry.name}`;
    if (entry.isDirectory()) {
      await uploadDir(localPath, remotePath);
    } else {
      await sftpUpload(localPath, remotePath);
      console.log(`  uploaded: ${entry.name}`);
    }
  }
}

(async () => {
  try {
    console.log('1. Cleaning remote dist...');
    await runSSH(`rm -rf ${REMOTE_DIR}/*`);

    console.log('2. Uploading website dist/...');
    await uploadDir(DIST_DIR, REMOTE_DIR);

    console.log('\nDone!');
  } catch (e) {
    console.error('FAILED:', e.message);
  }
})();
