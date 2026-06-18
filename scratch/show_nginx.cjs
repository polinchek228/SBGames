const { Client } = require('ssh2');
const c = new Client();
c.on('ready', () => {
  c.exec("cat /etc/nginx/sites-available/games.sb-capital.group", (e, s) => {
    s.on('data', c => process.stdout.write(c));
    s.on('close', () => c.end());
  });
}).on('error', e => console.error(e.message))
  .connect({ host: '62.77.154.84', port: 22, username: 'mnntn', password: 'tcfgd12' });
