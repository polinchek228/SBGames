const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

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

function uploadDir(host, user, pass, localDir, remoteDir) {
  return new Promise((resolve, reject) => {
    const c = new Client();
    c.on('ready', () => {
      c.sftp((err, sftp) => {
        if (err) { c.end(); reject(err); return; }
        
        function uploadRecursive(local, remote, cb) {
          const items = fs.readdirSync(local);
          let pending = items.length;
          if (pending === 0) { cb(); return; }
          
          items.forEach(item => {
            const localPath = path.join(local, item);
            const remotePath = remote + '/' + item;
            const stat = fs.statSync(localPath);
            
            if (stat.isDirectory()) {
              sftp.mkdir(remotePath, (err) => {
                if (err && err.code !== 4) { console.log('mkdir err:', err.message); }
                uploadRecursive(localPath, remotePath, () => { if (--pending === 0) cb(); });
              });
            } else {
              const stream = sftp.createWriteStream(remotePath);
              stream.on('close', () => { if (--pending === 0) cb(); });
              stream.on('error', e => { console.log('upload err:', e.message); if (--pending === 0) cb(); });
              fs.createReadStream(localPath).pipe(stream);
            }
          });
        }
        
        uploadRecursive(localDir, remoteDir, () => { c.end(); resolve(); });
      });
    }).on('error', e => reject(e))
      .connect({ host, port: 22, username: user, password: pass });
  });
}

(async () => {
  try {
    // 1. Upload backgrounds
    console.log('1. Uploading backgrounds...');
    const bgDir = 'public/backgrounds';
    if (fs.existsSync(bgDir)) {
      await uploadDir(SERVER, USER, PASS, bgDir, '/opt/sbgames/backgrounds');
      console.log('  backgrounds uploaded');
    } else {
      console.log('  no backgrounds dir found');
    }

    // 2. Upload public (frames, icons)
    console.log('2. Uploading frames/icons...');
    const publicDir = 'public';
    if (fs.existsSync(path.join(publicDir, 'frames'))) {
      await uploadDir(SERVER, USER, PASS, path.join(publicDir, 'frames'), '/opt/sbgames/frames');
      console.log('  frames uploaded');
    }
    if (fs.existsSync(path.join(publicDir, 'icons'))) {
      await uploadDir(SERVER, USER, PASS, path.join(publicDir, 'icons'), '/opt/sbgames/icons');
      console.log('  icons uploaded');
    }

    // 3. Create symlinks in nginx-accessible path
    console.log('3. Symlinking backgrounds...');
    const symlink = await runSSH(SERVER, USER, PASS,
      "echo tcfgd12 | sudo -S ln -sf /opt/sbgames/backgrounds /var/www/sbgames-backgrounds 2>&1 && echo ok");
    console.log(symlink);

    // 4. Create background files route on server
    console.log('4. Setting up static file serving...');
    const nginxBg = await runSSH(SERVER, USER, PASS,
      "echo tcfgd12 | sudo -S bash -c 'cat > /etc/nginx/sites-available/sbgames-static << \"EOF\"\n" +
      "server {\n" +
      "  listen 8888;\n" +
      "  server_name _;\n" +
      "  location /backgrounds/ { alias /opt/sbgames/backgrounds/; add_header Access-Control-Allow-Origin *; }\n" +
      "  location /frames/ { alias /opt/sbgames/frames/; add_header Access-Control-Allow-Origin *; }\n" +
      "  location /icons/ { alias /opt/sbgames/icons/; add_header Access-Control-Allow-Origin *; }\n" +
      "}\n" +
      "EOF' 2>&1 && echo tcfgd12 | sudo -S ln -sf /etc/nginx/sites-available/sbgames-static /etc/nginx/sites-enabled/sbgames-static && echo tcfgd12 | sudo -S nginx -t 2>&1 && echo tcfgd12 | sudo -S systemctl reload nginx 2>&1");
    console.log(nginxBg);

    console.log('\nDone!');
  } catch (e) {
    console.error('FAILED:', e.message);
  }
})();
