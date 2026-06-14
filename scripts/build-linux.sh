#!/bin/bash
# SBGames Launcher — Linux build via Docker
# Запускать из корня проекта: bash scripts/build-linux.sh

set -e

IMAGE_NAME="sbgames-linux-build"
CONTAINER_NAME="sbgames-linux-builder"
ARTIFACTS_DIR="releases/SBGames-Linux"

echo "==> Сборка Docker-образа для Linux..."
docker build -f scripts/Dockerfile.linux -t "$IMAGE_NAME" .

echo "==> Запуск билда внутри Docker..."
docker run --rm \
  --name "$CONTAINER_NAME" \
  -v "$(pwd)/src-tauri/target:/app/src-tauri/target" \
  "$IMAGE_NAME" \
  bash -c "npx tauri build --target x86_64-unknown-linux-gnu"

echo "==> Копирование артефактов..."
mkdir -p "$ARTIFACTS_DIR/deb" "$ARTIFACTS_DIR/appimage"

cp src-tauri/target/release/bundle/deb/*.deb       "$ARTIFACTS_DIR/deb/"       2>/dev/null || echo "[!] .deb не найден"
cp src-tauri/target/release/bundle/appimage/*.AppImage "$ARTIFACTS_DIR/appimage/" 2>/dev/null || echo "[!] .AppImage не найден"

echo ""
echo "✅ Готово! Файлы в $ARTIFACTS_DIR/"
ls -lh "$ARTIFACTS_DIR/deb/" "$ARTIFACTS_DIR/appimage/" 2>/dev/null
