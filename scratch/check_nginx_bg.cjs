const { Client } = require('ssh2');
const c = new Client();
c.on('ready', () => {
  c.exec("echo tcfgd12 | sudo -S nginx -T 2>&1 | grep -A2 'location /backgrounds'", (e, s) => {
    s.on('data', c => process.stdout.write(c));
    s.stderr.on('data', c => process.stderr.write(c));
    s.on('close', () => c.end());
  });
}).on('error', e => console.error(e.message))
  .connect({ host: '62.77.154.84', port: 22, username: 'mnntn', password: 'tcfgd12' });
