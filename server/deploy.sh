#!/bin/bash
# Ручной деплой серверной части на прод.
#
# Аутентификация — по SSH-ключу (настроить один раз):
#   ssh-copy-id -i ~/.ssh/id_ed25519.pub root@62.77.154.84
#
# Либо через переменные окружения:
#   SERVER_HOST, SERVER_USER (по умолчанию root@62.77.154.84)
#
# Запускать из корня проекта: bash server/deploy.sh
#
# ВНИМАНИЕ: никогда не коммитьть пароли/ключи в репозиторий.
# Прошлая версия файла содержала root-пароль в открытом виде — он скомпрометирован
# и подлежит ротации.

set -e

SERVER="${SERVER_USER:-root}@${SERVER_HOST:-62.77.154.84}"
REMOTE_DIR="${REMOTE_DIR:-/opt/sbgames-auth}"

echo "==> Копируем серверный код на ${SERVER}..."
ssh -o StrictHostKeyChecking=accept-new "${SERVER}" "mkdir -p ${REMOTE_DIR}"
scp -o StrictHostKeyChecking=accept-new \
  server/package.json server_index.js "${SERVER}:${REMOTE_DIR}/"

echo "==> Устанавливаем зависимости и перезапускаем..."
ssh -o StrictHostKeyChecking=accept-new "${SERVER}" "
  cd ${REMOTE_DIR}
  which node || (apt-get update -qq && apt-get install -y nodejs npm -qq)
  which pm2  || npm install -g pm2 -q
  npm install --production -q
  pm2 delete sbgames-auth 2>/dev/null || true
  pm2 start server_index.js --name sbgames-auth
  pm2 save
  pm2 startup || true
  echo '✅ Сервер запущен!'
"
