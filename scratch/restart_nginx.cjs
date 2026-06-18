const { Client } = require('ssh2');
const c = new Client();
c.on('ready', () => {
  c.exec([
    "echo tcfgd12 | sudo -S nginx -t 2>&1",
    "echo tcfgd12 | sudo -S systemctl restart nginx 2>&1",
    "sleep 2",
    "curl -sk https://games.sb-capital.group/ -o /dev/null -w 'https: %{http_code}\\n' 2>&1",
    "curl -s http://127.0.0.1:3000/ -o /dev/null -w 'direct: %{http_code}\\n' 2>&1"
  ].join(' && '), (e, s) => {
    let d = '';
    s.on('data', c => d += c);
    s.stderr.on('data', c => d += c);
    s.on('close', () => { console.log(d); c.end(); });
  });
}).on('error', e => { console.error(e.message); }).connect({ host: '62.77.154.84', port: 22, username: 'mnntn', password: 'tcfgd12' });
