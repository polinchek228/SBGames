const { Client } = require('ssh2');
const c = new Client();

// Copy fon1-fon7 as fon8-fon19 on server
const cmds = [];
for (let i = 8; i <= 19; i++) {
  const src = `fon${((i - 1) % 7) + 1}.mp4`;
  const dst = `fon${i}.mp4`;
  cmds.push(`cp /opt/sbgames/backgrounds/${src} /opt/sbgames/backgrounds/${dst}`);
}

c.on('ready', () => {
  c.exec(cmds.join(' && ') + ' && ls -la /opt/sbgames/backgrounds/', (e, stream) => {
    stream.on('data', d => process.stdout.write(d));
    stream.stderr.on('data', d => process.stdout.write(d));
    stream.on('close', () => c.end());
  });
}).connect({ host: '62.77.154.84', port: 22, username: 'mnntn', password: 'tcfgd12' });
