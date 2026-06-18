const { Client } = require('ssh2');
const c = new Client();
c.on('ready', () => {
  c.exec("echo tcfgd12 | sudo -S nginx -T 2>&1 | grep -B5 -A15 'server_name games.sb-capital.group' | head -50 && echo '=== CURL ===' && curl -sk 'https://games.sb-capital.group/backgrounds/fon1.mp4' -o /dev/null -w 'HTTP %{http_code} Size: %{size_download} Type: %{content_type}\n' 2>&1 && echo '=== LOCAL ===' && curl -sk 'http://127.0.0.1:3000/backgrounds/fon1.mp4' -o /dev/null -w 'HTTP %{http_code} Size: %{size_download} Type: %{content_type}\n' 2>&1", (e, s) => {
    s.on('data', c => process.stdout.write(c));
    s.stderr.on('data', c => process.stderr.write(c));
    s.on('close', () => c.end());
  });
}).on('error', e => console.error(e.message))
  .connect({ host: '62.77.154.84', port: 22, username: 'mnntn', password: 'tcfgd12' });
