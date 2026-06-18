const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const NEW = { host: '62.77.154.84', port: 22, username: 'mnntn', password: 'tcfgd12' };
const WEBSITE = path.join(__dirname, '..', 'website', 'dist');

if (!fs.existsSync(WEBSITE)) {
  console.error('website/dist not found');
  process.exit(1);
}

const files = [];
function walk(dir, rel) {
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    const r = rel ? rel + '/' + f : f;
    if (fs.statSync(full).isDirectory()) walk(full, r);
    else files.push({ local: full, remote: r });
  }
}
walk(WEBSITE, '');
console.log(`Uploading ${files.length} website files...`);

const c = new Client();
c.on('ready', () => {
  c.sftp((err, sftp) => {
    if (err) { console.error('SFTP err:', err); c.end(); process.exit(1); }
    
    c.exec("mkdir -p /var/www/games-site", (e, s) => {
      s.on('close', () => {
        let pending = files.length;
        files.forEach(({ local, remote }) => {
          const rp = '/var/www/games-site/' + remote;
          const dirParts = rp.split('/').slice(0, -1).join('/');
          c.exec(`mkdir -p ${dirParts}`, () => {});
          
          const stream = sftp.createWriteStream(rp);
          stream.on('close', () => {
            if (--pending === 0) {
              console.log('All website files uploaded!');
              c.end();
            }
          });
          stream.on('error', e => { console.log(`err ${remote}: ${e.message}`); if (--pending === 0) c.end(); });
          fs.createReadStream(local).pipe(stream);
        });
      });
    });
  });
}).on('error', e => console.error(e.message))
  .connect(NEW);
