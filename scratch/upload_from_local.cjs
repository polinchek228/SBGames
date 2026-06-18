const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const NEW = { host: '62.77.154.84', port: 22, username: 'mnntn', password: 'tcfgd12' };
const SRC = 'C:\\Users\\EFSEEa\\Documents\\GitHub\\SBGames\\.kilo\\worktrees\\courageous-hacksaw';

function uploadDir(connOpts, localDir, remoteDir) {
  return new Promise((resolve, reject) => {
    const c = new Client();
    c.on('ready', () => {
      c.sftp((err, sftp) => {
        if (err) { c.end(); reject(err); return; }
        let pending = 1;
        
        function ensureDir(cb) {
          sftp.mkdir(remoteDir, (err) => { cb(); });
        }
        
        ensureDir(() => {
          const items = fs.readdirSync(localDir);
          pending = items.length;
          if (pending === 0) { c.end(); resolve(); return; }
          
          items.forEach(item => {
            const lp = path.join(localDir, item);
            const rp = remoteDir + '/' + item;
            const stat = fs.statSync(lp);
            if (stat.isDirectory()) {
              sftp.mkdir(rp, () => {});
              const subItems = fs.readdirSync(lp);
              subItems.forEach(si => {
                const subLp = path.join(lp, si);
                const subRp = rp + '/' + si;
                const subStat = fs.statSync(subLp);
                if (subStat.isFile()) {
                  const stream = sftp.createWriteStream(subRp);
                  stream.on('close', () => { console.log(`  ${si} (${(subStat.size/1024/1024).toFixed(1)}MB)`); if (--pending === 0) { c.end(); resolve(); }});
                  stream.on('error', e => { console.log(`  err ${si}: ${e.message}`); if (--pending === 0) { c.end(); resolve(); }});
                  fs.createReadStream(subLp).pipe(stream);
                } else { if (--pending === 0) { c.end(); resolve(); } }
              });
            } else if (stat.isFile()) {
              const stream = sftp.createWriteStream(rp);
              stream.on('close', () => { console.log(`  ${item} (${(stat.size/1024/1024).toFixed(1)}MB)`); if (--pending === 0) { c.end(); resolve(); }});
              stream.on('error', e => { console.log(`  err ${item}: ${e.message}`); if (--pending === 0) { c.end(); resolve(); }});
              fs.createReadStream(lp).pipe(stream);
            } else { if (--pending === 0) { c.end(); resolve(); } }
          });
        });
      });
    }).on('error', reject).connect(connOpts);
  });
}

(async () => {
  try {
    // 1. Upload backgrounds (mp4 files in public/)
    console.log('1. Uploading backgrounds...');
    const bgSrc = path.join(SRC, 'public');
    const bgFiles = fs.readdirSync(bgSrc).filter(f => f.endsWith('.mp4'));
    console.log(`  Found ${bgFiles.length} mp4 files`);
    
    await new Promise((resolve, reject) => {
      const c = new Client();
      c.on('ready', () => {
        c.exec('mkdir -p /opt/sbgames/backgrounds /opt/sbgames/frames /opt/sbgames/icons', (e, s) => {
          s.on('close', () => { c.end(); resolve(); });
        });
      }).on('error', reject).connect(NEW);
    });

    await new Promise((resolve, reject) => {
      const c = new Client();
      c.on('ready', () => {
        c.sftp((err, sftp) => {
          if (err) { c.end(); reject(err); return; }
          let pending = bgFiles.length;
          if (pending === 0) { c.end(); resolve(); return; }
          bgFiles.forEach(f => {
            const lp = path.join(bgSrc, f);
            const rp = '/opt/sbgames/backgrounds/' + f;
            const stat = fs.statSync(lp);
            const stream = sftp.createWriteStream(rp);
            stream.on('close', () => { console.log(`  ${f} (${(stat.size/1024/1024).toFixed(1)}MB)`); if (--pending === 0) { c.end(); resolve(); }});
            stream.on('error', e => { console.log(`  err: ${e.message}`); if (--pending === 0) { c.end(); resolve(); }});
            fs.createReadStream(lp).pipe(stream);
          });
        });
      }).on('error', reject).connect(NEW);
    });

    // 2. Upload frames
    console.log('\n2. Uploading frames...');
    const frames = fs.readdirSync(bgSrc).filter(f => f.startsWith('frame') && f.endsWith('.png'));
    console.log(`  Found ${frames.length} frame files`);
    await new Promise((resolve, reject) => {
      const c = new Client();
      c.on('ready', () => {
        c.sftp((err, sftp) => {
          if (err) { c.end(); reject(err); return; }
          let pending = frames.length;
          if (pending === 0) { c.end(); resolve(); return; }
          frames.forEach(f => {
            const lp = path.join(bgSrc, f);
            const rp = '/opt/sbgames/frames/' + f;
            const stream = sftp.createWriteStream(rp);
            stream.on('close', () => { console.log(`  ${f}`); if (--pending === 0) { c.end(); resolve(); }});
            stream.on('error', e => { if (--pending === 0) { c.end(); resolve(); }});
            fs.createReadStream(lp).pipe(stream);
          });
        });
      }).on('error', reject).connect(NEW);
    });

    // 3. Upload icons
    console.log('\n3. Uploading icons...');
    const iconDir = path.join(SRC, 'public', 'icons');
    if (fs.existsSync(iconDir)) {
      const icons = fs.readdirSync(iconDir);
      console.log(`  Found ${icons.length} icon files`);
      await new Promise((resolve, reject) => {
        const c = new Client();
        c.on('ready', () => {
          c.sftp((err, sftp) => {
            if (err) { c.end(); reject(err); return; }
            let pending = icons.length;
            if (pending === 0) { c.end(); resolve(); return; }
            icons.forEach(f => {
              const lp = path.join(iconDir, f);
              const rp = '/opt/sbgames/icons/' + f;
              const stream = sftp.createWriteStream(rp);
              stream.on('close', () => { console.log(`  ${f}`); if (--pending === 0) { c.end(); resolve(); }});
              stream.on('error', e => { if (--pending === 0) { c.end(); resolve(); }});
              fs.createReadStream(lp).pipe(stream);
            });
          });
        }).on('error', reject).connect(NEW);
      });
    }

    // 4. Verify
    console.log('\n4. Verifying...');
    const verify = await new Promise((resolve, reject) => {
      const c = new Client();
      c.on('ready', () => {
        c.exec('ls -la /opt/sbgames/backgrounds/ /opt/sbgames/frames/ /opt/sbgames/icons/', (e, s) => {
          let d = '';
          s.on('data', c => d += c);
          s.on('close', () => { c.end(); resolve(d); });
        });
      }).on('error', reject).connect(NEW);
    });
    console.log(verify);

    console.log('Done!');
  } catch (e) {
    console.error('FAILED:', e.message);
  }
})();
