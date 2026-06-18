const { Client } = require('ssh2');
const c = new Client();
c.on('ready', () => {
  c.exec("echo tcfgd12 | sudo -S mkdir -p /opt/sbgames/frames /opt/sbgames/icons && echo tcfgd12 | sudo -S chmod -R 777 /opt/sbgames/frames /opt/sbgames/icons && echo '=== backgrounds ===' && ls /opt/sbgames/backgrounds/ && echo '=== frames ===' && ls /opt/sbgames/frames/ && echo '=== icons ===' && ls /opt/sbgames/icons/", (e, s) => {
    let d = '';
    s.on('data', c => process.stdout.write(c));
    s.stderr.on('data', c => process.stderr.write(c));
    s.on('close', () => c.end());
  });
}).on('error', e => console.error(e.message))
  .connect({ host: '62.77.154.84', port: 22, username: 'mnntn', password: 'tcfgd12' });
