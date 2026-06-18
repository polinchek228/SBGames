const { Client } = require('ssh2');
const c = new Client();
c.on('ready', () => {
  c.exec("pm2 list 2>&1 | grep sbgames-auth && echo === && curl -s http://127.0.0.1:3000/ -o /dev/null -w '%{http_code}' 2>&1", (e, s) => {
    let d = '';
    s.on('data', c => d += c);
    s.stderr.on('data', c => d += c);
    s.on('close', () => { console.log(d); c.end(); });
  });
}).on('error', e => { console.error(e.message); }).connect({ host: '62.77.154.84', port: 22, username: 'mnntn', password: 'tcfgd12' });
