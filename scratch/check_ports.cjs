const { Client } = require('ssh2');
const c = new Client();
c.on('ready', () => {
  c.exec("echo tcfgd12 | sudo -S ss -tlnp 2>&1 | grep -E ':443|:8443|:3000'", (e, s) => {
    let d = '';
    s.on('data', c => d += c);
    s.stderr.on('data', c => d += c);
    s.on('close', () => { console.log(d); c.end(); });
  });
}).on('error', e => { console.error(e.message); }).connect({ host: '62.77.154.84', port: 22, username: 'mnntn', password: 'tcfgd12' });
