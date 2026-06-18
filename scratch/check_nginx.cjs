const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  conn.exec('ls /etc/nginx/sites-available/ && echo "---" && ls /etc/nginx/sites-enabled/ && echo "---" && cat /etc/nginx/sites-available/games.sb-capital.group 2>/dev/null || echo "NOT FOUND"', { pty: true }, (err, stream) => {
    stream.on('data', d => process.stdout.write(d));
    stream.on('close', () => conn.end());
  });
}).connect({ host: '62.77.154.84', port: 22, username: 'mnntn', password: 'tcfgd12' });
