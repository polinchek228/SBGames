#!/bin/bash
# Скрипт для релиза обновления лаунчера
# Использование: bash scripts/release.sh [version]
#
# Требования:
#   - TAURI_SIGNING_PRIVATE_KEY или ~/.tauri/sbgames.key
#   - sshpass (Linux) или ssh2 (Node deploy)
#
# Этот скрипт:
#   1. Обновляет версию в tauri.conf.json и Cargo.toml
#   2. Билдит с подписью
#   3. Заливает обновления на сервер

set -e

VERSION="${1:?Укажи версию, например: 1.1.0}"
SERVER="root@94.26.83.31"
REMOTE_DIR="/opt/sbgames-auth/updates"
KEY_PATH="$HOME/.tauri/sbgames.key"

echo "==> Обновляем версию до $VERSION..."

# tauri.conf.json
sed -i "s/\"version\": \"[^\"]*\"/\"version\": \"$VERSION\"/" src-tauri/tauri.conf.json
# Cargo.toml
sed -i "s/^version = \"[^\"]*\"/version = \"$VERSION\"/" src-tauri/Cargo.toml
# package.json
sed -i "s/\"version\": \"[^\"]*\"/\"version\": \"$VERSION\"/" package.json
# server_index.js (LATEST_VERSION)
sed -i "s/const LATEST_VERSION = \"[^\"]*\"/const LATEST_VERSION = \"$VERSION\"/" server_index.js
# server/index.js (LATEST_VERSION)
sed -i "s/const LATEST_VERSION = \"[^\"]*\"/const LATEST_VERSION = \"$VERSION\"/" server/index.js

echo "==> Билдим с подписью..."
export TAURI_SIGNING_PRIVATE_KEY="$KEY_PATH"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=" "

npx tauri build

echo "==> Заливаем обновления на сервер..."
# Находим собранные артефакты
BUNDLE_DIR="src-tauri/target/release/bundle"

# Windows
WIN_NSIS=$(find "$BUNDLE_DIR/nsis" -name "*.nsis.zip" 2>/dev/null | head -1)
WIN_SIG=$(find "$BUNDLE_DIR/nsis" -name "*.nsis.zip.sig" 2>/dev/null | head -1)
# macOS
MAC_ARM=$(find "$BUNDLE_DIR/macos" -name "*aarch64.app.tar.gz" 2>/dev/null | head -1)
MAC_ARM_SIG=$(find "$BUNDLE_DIR/macos" -name "*aarch64.app.tar.gz.sig" 2>/dev/null | head -1)
MAC_X64=$(find "$BUNDLE_DIR/macos" -name "*x64.app.tar.gz" 2>/dev/null | head -1)
MAC_X64_SIG=$(find "$BUNDLE_DIR/macos" -name "*x64.app.tar.gz.sig" 2>/dev/null | head -1)
# Linux
LINUX_AI=$(find "$BUNDLE_DIR/appimage" -name "*.AppImage.tar.gz" 2>/dev/null | head -1)
LINUX_AI_SIG=$(find "$BUNDLE_DIR/appimage" -name "*.AppImage.tar.gz.sig" 2>/dev/null | head -1)

# Копируем на сервер
for f in "$WIN_NSIS" "$WIN_SIG" "$MAC_ARM" "$MAC_ARM_SIG" "$MAC_X64" "$MAC_X64_SIG" "$LINUX_AI" "$LINUX_AI_SIG"; do
  if [ -n "$f" ] && [ -f "$f" ]; then
    echo "  -> $(basename "$f")"
    scp -o StrictHostKeyChecking=no "$f" "$SERVER:$REMOTE_DIR/"
  fi
done

echo "==> Рестартуем сервер..."
ssh -o StrictHostKeyChecking=no "$SERVER" "cd /opt/sbgames-auth && pm2 restart sbgames-auth"

echo ""
echo "✅ Релиз $VERSION готов!"
echo "   Файлы: https://api.sbgames.hyperionsearch.xyz:8443/update/$VERSION/"
echo "   Манифест: GET /update/{target}/{arch}/{currentVersion}"
