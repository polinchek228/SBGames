const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const NEW = { host: '62.77.154.84', port: 22, username: 'mnntn', password: 'tcfgd12' };
const SRC = 'C:\\Users\\EFSEEa\\Documents\\GitHub\\SBGames\\.kilo\\worktrees\\courageous-hacksaw\\public';

const dirs = {
  'frames': { local: SRC, remote: '/opt/sbgames/frames/', filter: f => f.startsWith('frame') && f.endsWith('.png') },
  'icons': { local: path.join(SRC, 'icons'), remote: '/opt/sbgames/icons/', filter: f => f.endsWith('.png') }
};

const key = process.argv[2] || 'frames';
const cfg = dirs[key];
if (!cfg) { console.log('Usage: node upload_small.cjs [frames|icons]'); process.exit(1); }

const files = fs.readdirSync(cfg.local).filter(cfg.filter);
console.log(`Uploading ${files.length} files to ${cfg.remote}...`);

const c = new Client();
c.on('ready', () => {
  c.sftp((err, sftp) => {
    if (err) { console.error('SFTP err:', err); c.end(); process.exit(1); }
    let pending = files.length;
    if (pending === 0) { c.end(); process.exit(0); }
    files.forEach(f => {
      const lp = path.join(cfg.local, f);
      const rp = cfg.remote + f;
      const stream = sftp.createWriteStream(rp);
      stream.on('close', () => { console.log(`  ${f}`); if (--pending === 0) { c.end(); process.exit(0); }});
      stream.on('error', e => { console.log(`  err ${f}: ${e.message}`); if (--pending === 0) { c.end(); process.exit(1); }});
      fs.createReadStream(lp).pipe(stream);
    });
  });
}).on('error', e => { console.error('Connect err:', e.message); process.exit(1); })
  .connect(NEW);
