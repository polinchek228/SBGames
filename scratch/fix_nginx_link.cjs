const { Client } = require('ssh2');
const c = new Client();
c.on('ready', () => {
  c.exec("echo tcfgd12 | sudo -S rm /etc/nginx/sites-enabled/games.sb-capital.group && echo tcfgd12 | sudo -S ln -s /etc/nginx/sites-available/games.sb-capital.group /etc/nginx/sites-enabled/games.sb-capital.group && echo tcfgd12 | sudo -S nginx -t 2>&1 && echo tcfgd12 | sudo -S systemctl reload nginx 2>&1 && echo '=== RELOADED ===' && sleep 1 && curl -skI https://games.sb-capital.group/backgrounds/fon1.mp4 2>&1 | head -10", (e, s) => {
    s.on('data', c => process.stdout.write(c));
    s.stderr.on('data', c => process.stderr.write(c));
    s.on('close', () => c.end());
  });
}).on('error', e => console.error(e.message))
  .connect({ host: '62.77.154.84', port: 22, username: 'mnntn', password: 'tcfgd12' });
