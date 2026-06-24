#!/usr/bin/env bash
# ai-cron.sh — расписание генерации AI-статей для форума.
#
# Полный цикл: запустить FreeQwenApi → сгенерировать статьи → пересобрать
# сайт (vite + build-forum) → готовый dist/ лежит для деплоя.
#
# Пример systemd-timer / crontab (раз в 6 часов, по 2 статьи за запуск):
#   0 */6 * * *  cd /opt/SBGames && AI_ARTICLES_PER_RUN=2 bash scripts/ai-cron.sh >> /var/log/sbgames-ai.log 2>&1
#
# Переменные окружения (см. ai-generate.cjs):
#   AI_API_BASE  — OpenAI-совместимый эндпоинт FreeQwenApi (по умолч. http://localhost:3264/api)
#   AI_API_KEY   — ключ (FreeQwenApi обычно не требует)
#   AI_MODEL     — модель (по умолч. qwen-max)
#   AI_ARTICLES_PER_RUN — сколько статей за запуск (по умолч. 1)
#   SKIP_BUILD   — =1 чтобы не пересобирать сайт (только генерация .md)
set -euo pipefail

cd "$(dirname "$0")/.."

echo "===== $(date -Iseconds) AI-forum cron ====="

# 1. Убеждаемся, что FreeQwenApi запущен.
#    На сервере его лучше держать как отдельный сервис (systemd/pm2), тогда
#    этот блок можно пропустить. Здесь — проверка и попытка старта.
if ! curl -sf -m 5 "${AI_API_BASE:-http://localhost:3264/api}/status" >/dev/null 2>&1; then
  echo "[cron] FreeQwenApi не отвечает — запуск..."
  QWEN_DIR="${FREEQWEN_DIR:-/opt/FreeQwenApi}"
  if [ -d "$QWEN_DIR" ]; then
    ( cd "$QWEN_DIR" && SKIP_ACCOUNT_MENU=true nohup node index.js >/tmp/freeqwen.log 2>&1 & )
    sleep 12
    if ! curl -sf -m 5 "${AI_API_BASE:-http://localhost:3264/api}/status" >/dev/null 2>&1; then
      echo "[cron] FreeQwenApi так и не поднялся — пропускаю генерацию."
      exit 0
    fi
  else
    echo "[cron] каталог FreeQwenApi не найден ($QWEN_DIR) — пропускаю."
    exit 0
  fi
fi

# 2. Генерация статей.
echo "[cron] генерация статей..."
node scripts/ai-generate.cjs || echo "[cron] генерация завершилась с ошибкой (не критично)"

# 3. Пересборка сайта (если не отключено).
if [ "${SKIP_BUILD:-0}" != "1" ]; then
  echo "[cron] пересборка сайта..."
  ( cd website && npm run build ) || echo "[cron] сборка упала — dist не обновлён"
fi

# 4. Деплой dist/ на продакшен — тут зависит от вашей инфраструктуры.
#    Например: rsync dist/ на nginx-сервер или git push + CI. Раскомментируйте нужное:
# echo "[cron] деплой..."
# rsync -az --delete website/dist/ deploy@server:/var/www/sbgames/  || true
# pm2 reload sbgames-server  || true

echo "===== $(date -Iseconds) готово ====="
