#!/bin/bash
# Скрипт для деплоя на сервер 94.26.83.31
# Запускать с машины где есть sshpass: apt install sshpass

SERVER="root@94.26.83.31"
PASS="WJ1gaad33hNXRVJL9qti"
REMOTE_DIR="/opt/sbgames-auth"

echo "==> Копируем файлы на сервер..."
sshpass -p "$PASS" scp -o StrictHostKeyChecking=no \
  package.json index.js "$SERVER:$REMOTE_DIR/" 2>/dev/null || \
  sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no "$SERVER" "mkdir -p $REMOTE_DIR" && \
  sshpass -p "$PASS" scp -o StrictHostKeyChecking=no \
    package.json index.js "$SERVER:$REMOTE_DIR/"

echo "==> Устанавливаем зависимости и запускаем..."
sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no "$SERVER" "
  cd $REMOTE_DIR
  which node || (apt-get update -qq && apt-get install -y nodejs npm -qq)
  which pm2 || npm install -g pm2 -q
  npm install --production -q
  pm2 delete sbgames-auth 2>/dev/null || true
  pm2 start index.js --name sbgames-auth
  pm2 save
  pm2 startup
  echo '✅ Сервер запущен!'
"
