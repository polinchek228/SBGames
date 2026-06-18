const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const NEW = { host: '62.77.154.84', port: 22, username: 'mnntn', password: 'tcfgd12' };
const WEBSITE_DIST = path.join(__dirname, '..', 'website', 'dist');

if (!fs.existsSync(WEBSITE_DIST)) {
  console.error('website/dist not found. Run: cd website; npx vite build');
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
walk(WEBSITE_DIST, '');
console.log(`Uploading ${files.length} website files...`);

const c = new Client();
c.on('ready', () => {
  c.sftp((err, sftp) => {
    if (err) { console.error('SFTP err:', err); c.end(); process.exit(1); }
    
    // Create target dir
    c.exec("echo tcfgd12 | sudo -S mkdir -p /var/www/games.sb-capital.group && echo tcfgd12 | sudo -S chown -R mnntn:mnntn /var/www/games.sb-capital.group", (e, s) => {
      s.on('close', () => {
        let pending = files.length;
        files.forEach(({ local, remote }) => {
          const rp = '/var/www/games.sb-capital.group/' + remote;
          const parts = rp.split('/');
          // Ensure dir
          const dirParts = parts.slice(0, -1).join('/');
          c.exec(`mkdir -p ${dirParts}`, () => {});
          
          const stat = fs.statSync(local);
          const stream = sftp.createWriteStream(rp);
          stream.on('close', () => {
            if (--pending === 0) {
              console.log('All website files uploaded!');
              // Reload nginx
              c.exec("echo tcfgd12 | sudo -S nginx -t 2>&1 && echo tcfgd12 | sudo -S systemctl reload nginx 2>&1 && echo '=== RELOADED ===' && curl -skI https://games.sb-capital.group/ 2>&1 | head -5", (e, s2) => {
                s2.on('data', c => process.stdout.write(c));
                s2.on('close', () => c.end());
              });
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
