const { Client } = require('ssh2');
const c = new Client();
c.on('ready', () => {
  c.exec([
    "echo tcfgd12 | sudo -S rm -f /etc/nginx/sites-enabled/sbgames-api",
    "echo tcfgd12 | sudo -S rm -f /etc/nginx/sites-enabled/games.sb-capital.group.bak",
    "echo tcfgd12 | sudo -S nginx -t 2>&1",
    "echo tcfgd12 | sudo -S systemctl reload nginx 2>&1",
    "curl -sk https://games.sb-capital.group/api/ -o /dev/null -w '%{http_code}' 2>&1"
  ].join(' && '), (e, s) => {
    let d = '';
    s.on('data', c => d += c);
    s.stderr.on('data', c => d += c);
    s.on('close', () => { console.log(d); c.end(); });
  });
}).on('error', e => { console.error(e.message); }).connect({ host: '62.77.154.84', port: 22, username: 'mnntn', password: 'tcfgd12' });
