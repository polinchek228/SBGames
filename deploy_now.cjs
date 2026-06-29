// Быстрый деплой серверных файлов + сайта через SSH
// Запуск: node deploy_now.cjs
// Требуется: npm install ssh2 (уже в package.json)

const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const conn = new Client();

const SERVER = '62.77.154.84';
const USER = 'mnntn';
const PASS = 'tcfgd12';
const REMOTE_DIR = '/opt/sbgames-auth';

const FILES_TO_UPLOAD = [
  { local: 'server_index.js', remote: `${REMOTE_DIR}/server_index.js` },
  { local: 'server/package.json', remote: `${REMOTE_DIR}/package.json` },
];

// Upload a directory recursively via sftp
async function uploadDir(sftp, localDir, remoteDir) {
  await new Promise((resolve, reject) => sftp.mkdir(remoteDir, (err) => resolve())); // ignore exists
  const entries = fs.readdirSync(localDir, { withFileTypes: true });
  for (const e of entries) {
    const lp = path.join(localDir, e.name);
    const rp = `${remoteDir}/${e.name}`;
    if (e.isDirectory()) {
      await uploadDir(sftp, lp, rp);
    } else {
      await new Promise((resolve, reject) => {
        sftp.writeFile(rp, fs.readFileSync(lp), (err) => err ? reject(err) : resolve());
      });
    }
  }
}

conn.on('ready', async () => {
  console.log('✅ SSH подключено к', SERVER);

  // Upload server files
  for (const f of FILES_TO_UPLOAD) {
    const localPath = path.resolve(__dirname, f.local);
    const content = fs.readFileSync(localPath);
    await new Promise((resolve, reject) => {
      conn.sftp((err, sftp) => {
        if (err) return reject(err);
        sftp.writeFile(f.remote, content, (err) => {
          if (err) return reject(err);
          console.log(`✅ Загружен: ${f.local} → ${f.remote}`);
          resolve();
        });
      });
    });
  }

  // Upload website/dist
  const websiteDist = path.resolve(__dirname, 'website', 'dist');
  if (fs.existsSync(websiteDist)) {
    console.log('📤 Загрузка website/dist...');
    await new Promise((resolve, reject) => {
      conn.sftp(async (err, sftp) => {
        if (err) return reject(err);
        try {
          await uploadDir(sftp, websiteDist, `${REMOTE_DIR}/website/dist`);
          console.log('✅ website/dist загружен');
          resolve();
        } catch (e) { reject(e); }
      });
    });
  }

  // Install + restart + sync nginx
  console.log('📦 npm install + pm2 restart...');
  conn.exec(`
    cd ${REMOTE_DIR} && \
    npm install --production -q 2>&1 && \
    pm2 delete sbgames-auth 2>/dev/null; \
    pm2 start ecosystem.config.cjs && \
    rsync -a ${REMOTE_DIR}/website/dist/ /var/www/sbgames/ && \
    pm2 save && \
    echo '✅ Сервер перезапущен, сайт синхронизирован!'
  `, (err, stream) => {
    if (err) { console.error('❌ Ошибка:', err); conn.end(); return; }
    stream.on('close', () => { console.log('✅ Готово!'); conn.end(); });
    stream.stdout.on('data', (d) => process.stdout.write(d));
    stream.stderr.on('data', (d) => process.stderr.write(d));
  });
});

conn.on('error', (err) => console.error('❌ SSH ошибка:', err.message));
conn.connect({ host: SERVER, username: USER, password: PASS });
