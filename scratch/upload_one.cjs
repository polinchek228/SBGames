const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const NEW = { host: '62.77.154.84', port: 22, username: 'mnntn', password: 'tcfgd12' };
const FILE = process.argv[2];
const DEST = process.argv[3] || '/opt/sbgames/backgrounds/';

if (!FILE) { console.log('Usage: node upload_one.cjs <local_file> [remote_dir]'); process.exit(1); }

const stat = fs.statSync(FILE);
console.log(`Uploading ${path.basename(FILE)} (${(stat.size/1024/1024).toFixed(1)}MB) to ${DEST}...`);

const c = new Client();
c.on('ready', () => {
  c.sftp((err, sftp) => {
    if (err) { console.error('SFTP err:', err); c.end(); process.exit(1); }
    const remotePath = DEST + path.basename(FILE);
    const stream = sftp.createWriteStream(remotePath);
    stream.on('close', () => { console.log('Done!'); c.end(); process.exit(0); });
    stream.on('error', e => { console.error('Write err:', e.message); c.end(); process.exit(1); });
    fs.createReadStream(FILE).pipe(stream);
  });
}).on('error', e => { console.error('Connect err:', e.message); process.exit(1); })
  .connect(NEW);
