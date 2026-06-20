const { Client } = require('ssh2');
const fs = require('fs');

const SERVER = '62.77.154.84';
const USER = 'mnntn';
const PASS = 'tcfgd12';

function runSSH(host, user, pass, cmd, useSudo = false) {
  return new Promise((resolve, reject) => {
    const c = new Client();
    c.on('ready', () => {
      const fullCmd = useSudo ? `echo '${pass}' | sudo -S bash -c '${cmd.replace(/'/g, "'\\''")}'` : cmd;
      c.exec(fullCmd, (e, s) => {
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
    console.log('1. Reading nginx config...');
    const config = await runSSH(SERVER, USER, PASS, 'cat /etc/nginx/sites-available/games.sb-capital.group');
    
    if (config.includes('/affiliate/')) {
      console.log('   Affiliate proxy blocks already present!');
      console.log('\nDone!');
      return;
    }

    const marker = '# Website static files (catch-all)';
    const affiliateBlock = [
      '',
      '    # Affiliate / Referral system routes → Express',
      '    location /affiliate/ {',
      '        proxy_pass http://127.0.0.1:3000;',
      '        proxy_http_version 1.1;',
      '        proxy_set_header Host $host;',
      '        proxy_set_header X-Real-IP $remote_addr;',
      '        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;',
      '        proxy_set_header X-Forwarded-Proto $scheme;',
      '    }',
      '    location /invite/ {',
      '        proxy_pass http://127.0.0.1:3000;',
      '        proxy_http_version 1.1;',
      '        proxy_set_header Host $host;',
      '        proxy_set_header X-Real-IP $remote_addr;',
      '        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;',
      '        proxy_set_header X-Forwarded-Proto $scheme;',
      '    }',
      ''
    ].join('\n');
    
    const newConfig = config.replace(marker, affiliateBlock + '\n' + marker);
    const tmpLocal = __dirname + '/_nginx_new.conf';
    fs.writeFileSync(tmpLocal, newConfig);
    
    console.log('2. Uploading updated config...');
    await uploadFile(SERVER, USER, PASS, tmpLocal, '/tmp/_nginx_new.conf');
    
    console.log('3. Moving config and reloading nginx (with sudo -S)...');
    const moveResult = await runSSH(SERVER, USER, PASS,
      'cp /etc/nginx/sites-available/games.sb-capital.group /etc/nginx/sites-available/games.sb-capital.group.bak', true);
    console.log('   backup:', moveResult.trim());

    const cpResult = await runSSH(SERVER, USER, PASS,
      'cp /tmp/_nginx_new.conf /etc/nginx/sites-available/games.sb-capital.group', true);
    console.log('   copy:', cpResult.trim());

    const testResult = await runSSH(SERVER, USER, PASS, 'nginx -t', true);
    console.log('   test:', testResult.trim());

    if (testResult.includes('successful')) {
      const reloadResult = await runSSH(SERVER, USER, PASS, 'systemctl reload nginx', true);
      console.log('   reload:', reloadResult.trim());
      console.log('\n✅ Nginx updated and reloaded!');
    } else {
      console.log('\n❌ Nginx test failed, restoring backup...');
      await runSSH(SERVER, USER, PASS,
        'cp /etc/nginx/sites-available/games.sb-capital.group.bak /etc/nginx/sites-available/games.sb-capital.group', true);
    }
    
    fs.unlinkSync(tmpLocal);
    console.log('\nDone!');
  } catch (e) {
    console.error('FAILED:', e.message);
  }
})();
