const { Client } = require('ssh2');
const fs = require('fs');

const OLD = { host: '94.26.83.31', port: 22, username: 'root', password: 'WJ1gaad33hNXRVJL9qti' };
const NEW = { host: '62.77.154.84', port: 22, username: 'mnntn', password: 'tcfgd12' };

function listRemote(connOpts, dir) {
  return new Promise((resolve, reject) => {
    const c = new Client();
    c.on('ready', () => {
      c.exec(`ls -1 ${dir} 2>&1`, (e, s) => {
        let d = '';
        s.on('data', c => d += c);
        s.on('close', () => { c.end(); resolve(d.trim().split('\n').filter(Boolean)); });
      });
    }).on('error', reject).connect(connOpts);
  });
}

function downloadFile(connOpts, remotePath) {
  return new Promise((resolve, reject) => {
    const c = new Client();
    c.on('ready', () => {
      c.sftp((err, sftp) => {
        if (err) { c.end(); reject(err); return; }
        const chunks = [];
        const stream = sftp.createReadStream(remotePath);
        stream.on('data', chunk => chunks.push(chunk));
        stream.on('end', () => { c.end(); resolve(Buffer.concat(chunks)); });
        stream.on('error', e => { c.end(); reject(e); });
      });
    }).on('error', reject).connect(connOpts);
  });
}

function uploadFile(connOpts, data, remotePath) {
  return new Promise((resolve, reject) => {
    const c = new Client();
    c.on('ready', () => {
      c.sftp((err, sftp) => {
        if (err) { c.end(); reject(err); return; }
        const stream = sftp.createWriteStream(remotePath);
        stream.on('close', () => { c.end(); resolve(); });
        stream.on('error', e => { c.end(); reject(e); });
        stream.end(data);
      });
    }).on('error', reject).connect(connOpts);
  });
}

(async () => {
  try {
    const remoteDir = '/opt/sbgames/backgrounds';
    const files = await listRemote(OLD, remoteDir);
    const mp4Files = files.filter(f => f.endsWith('.mp4'));
    console.log(`Found ${mp4Files.length} mp4 files on old server`);

    // Ensure target dir
    await new Promise((resolve, reject) => {
      const c = new Client();
      c.on('ready', () => {
        c.exec(`mkdir -p ${remoteDir}`, (e, s) => {
          s.on('close', () => { c.end(); resolve(); });
        });
      }).on('error', reject).connect(NEW);
    });

    for (let i = 0; i < mp4Files.length; i++) {
      const f = mp4Files[i];
      console.log(`[${i+1}/${mp4Files.length}] Downloading ${f}...`);
      const data = await downloadFile(OLD, `${remoteDir}/${f}`);
      console.log(`  Uploading to new server (${(data.length/1024/1024).toFixed(1)}MB)...`);
      await uploadFile(NEW, data, `${remoteDir}/${f}`);
    }

    // Also copy frames and icons
    for (const dir of ['frames', 'icons']) {
      const remoteOld = `/opt/sbgames/${dir}`;
      const remoteNew = `/opt/sbgames/${dir}`;
      try {
        const files = await listRemote(OLD, remoteOld);
        console.log(`\nFound ${files.length} files in ${dir}/`);
        await new Promise((resolve, reject) => {
          const c = new Client();
          c.on('ready', () => {
            c.exec(`mkdir -p ${remoteNew}`, (e, s) => {
              s.on('close', () => { c.end(); resolve(); });
            });
          }).on('error', reject).connect(NEW);
        });
        for (const f of files) {
          const data = await downloadFile(OLD, `${remoteOld}/${f}`);
          await uploadFile(NEW, data, `${remoteNew}/${f}`);
          console.log(`  ${f} done`);
        }
      } catch (e) {
        console.log(`  ${dir} not found or empty`);
      }
    }

    console.log('\nAll assets uploaded!');
  } catch (e) {
    console.error('FAILED:', e.message);
  }
})();
