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
    const config = await runSSH(SERVER, USER, PASS, 'cat /etc/nginx/sites-available/games.sb-capital.group');

    // Replace broad /affiliate/ with specific API-only routes
    const oldBlock = [
      '    # Affiliate / Referral system routes → Express',
      '    location /affiliate/ {',
      '        proxy_pass http://127.0.0.1:3000;',
      '        proxy_http_version 1.1;',
      '        proxy_set_header Host $host;',
      '        proxy_set_header X-Real-IP $remote_addr;',
      '        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;',
      '        proxy_set_header X-Forwarded-Proto $scheme;',
      '    }',
    ].join('\n');

    const newBlock = [
      '    # Affiliate API routes only (SPA pages go to catch-all index.html)',
      '    location /affiliate/stats {',
      '        proxy_pass http://127.0.0.1:3000;',
      '        proxy_http_version 1.1;',
      '        proxy_set_header Host $host;',
      '        proxy_set_header X-Real-IP $remote_addr;',
      '        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;',
      '        proxy_set_header X-Forwarded-Proto $scheme;',
      '    }',
      '    location /affiliate/code {',
      '        proxy_pass http://127.0.0.1:3000;',
      '        proxy_http_version 1.1;',
      '        proxy_set_header Host $host;',
      '        proxy_set_header X-Real-IP $remote_addr;',
      '        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;',
      '        proxy_set_header X-Forwarded-Proto $scheme;',
      '    }',
      '    location /affiliate/payout {',
      '        proxy_pass http://127.0.0.1:3000;',
      '        proxy_http_version 1.1;',
      '        proxy_set_header Host $host;',
      '        proxy_set_header X-Real-IP $remote_addr;',
      '        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;',
      '        proxy_set_header X-Forwarded-Proto $scheme;',
      '    }',
      '    location /affiliate/register {',
      '        proxy_pass http://127.0.0.1:3000;',
      '        proxy_http_version 1.1;',
      '        proxy_set_header Host $host;',
      '        proxy_set_header X-Real-IP $remote_addr;',
      '        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;',
      '        proxy_set_header X-Forwarded-Proto $scheme;',
      '    }',
    ].join('\n');

    if (!config.includes(oldBlock)) {
      console.log('ERROR: old affiliate block not found, aborting');
      return;
    }

    const newConfig = config.replace(oldBlock, newBlock);
    const tmpLocal = __dirname + '/_nginx_fix.conf';
    fs.writeFileSync(tmpLocal, newConfig);

    console.log('1. Uploading fixed config...');
    await uploadFile(SERVER, USER, PASS, tmpLocal, '/tmp/_nginx_fix.conf');

    console.log('2. Testing nginx...');
    const test = await runSSH(SERVER, USER, PASS,
      `echo '${PASS}' | sudo -S cp /tmp/_nginx_fix.conf /etc/nginx/sites-available/games.sb-capital.group && echo '${PASS}' | sudo -S nginx -t 2>&1`);
    console.log(test);

    if (test.includes('successful')) {
      console.log('3. Reloading nginx...');
      await runSSH(SERVER, USER, PASS, `echo '${PASS}' | sudo -S systemctl reload nginx 2>&1`);
      console.log('✅ Done!');
    } else {
      console.log('❌ Nginx test failed!');
    }

    fs.unlinkSync(tmpLocal);
  } catch (e) {
    console.error('FAILED:', e.message);
  }
})();
