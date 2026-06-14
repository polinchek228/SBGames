#!/bin/bash
# SBGames Launcher — Сборка всех платформ
# Запускать из корня проекта: bash scripts/build-all.sh
#
# Поддерживаемые платформы:
#   --linux    — Linux (.deb + .AppImage) через Docker
#   --macos    — macOS (.dmg) — только на Mac
#   --windows  — Windows (.exe + .msi) — только на Windows
#   --all      — все доступные
#   (без аргументов) — текущая платформа

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

# Определяем текущую ОС
OS="$(uname -s 2>/dev/null || echo Windows)"

detect_platform() {
  case "$OS" in
    Linux*)  echo "linux" ;;
    Darwin*) echo "macos" ;;
    MINGW*|MSYS*|CYGWIN*|Windows_NT) echo "windows" ;;
    *)       echo "unknown" ;;
  esac
}

CURRENT_PLATFORM=$(detect_platform)
TARGETS=()

# Парсим аргументы
for arg in "$@"; do
  case "$arg" in
    --linux)   TARGETS+=("linux") ;;
    --macos)   TARGETS+=("macos") ;;
    --windows) TARGETS+=("windows") ;;
    --all)     TARGETS=("linux" "macos" "windows") ;;
    --help|-h)
      echo "Использование: bash scripts/build-all.sh [--linux|--macos|--windows|--all]"
      echo "  По умолчанию: собирает для текущей ОС ($CURRENT_PLATFORM)"
      exit 0 ;;
    *)
      echo "[!] Неизвестный аргумент: $arg"
      exit 1 ;;
  esac
done

# Если аргументов нет — собираем текущую платформу
if [ ${#TARGETS[@]} -eq 0 ]; then
  TARGETS=("$CURRENT_PLATFORM")
fi

echo "========================================="
echo "  SBGames Launcher — Build All"
echo "  Текущая ОС: $CURRENT_PLATFORM"
echo "  Цели: ${TARGETS[*]}"
echo "========================================="
echo ""

build_linux() {
  echo "🔧 [Linux] Сборка через Docker..."
  if ! command -v docker &> /dev/null; then
    echo "[!] Docker не установлен. Установи Docker Desktop:"
    echo "    https://www.docker.com/products/docker-desktop/"
    echo "[!] Или собери локально на Linux:"
    echo "    sudo apt install libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf"
    echo "    npm install && npx tauri build"
    return 1
  fi
  bash "$SCRIPT_DIR/build-linux.sh"
}

build_macos() {
  echo "🍎 [macOS] Сборка..."
  if [ "$CURRENT_PLATFORM" != "macos" ]; then
    echo "[!] macOS-билд доступен только на macOS."
    echo "[!] Используй Cirrus CI (бесплатно): https://cirrus-ci.com"
    return 1
  fi
  npm install
  npx tauri build

  # Ad-hoc подпись .app чтобы Gatekeeper не ругался
  APP_PATH=$(find src-tauri/target/release/bundle/macos -name "*.app" -maxdepth 1 2>/dev/null | head -1)
  if [ -n "$APP_PATH" ]; then
    echo "🔐 Ad-hoc подпись: $APP_PATH"
    codesign --deep --force --sign - "$APP_PATH"
    echo "✅ Подпись применена"
  fi

  echo "✅ macOS билд: src-tauri/target/release/bundle/dmg/*.dmg"
  echo ""
  echo "📌 Если .app не открывается двойным кликом, пользователь должен выполнить:"
  echo "   xattr -cr \"$APP_PATH\""
  echo "   Или: правый клик по .app → Открыть"
}

build_windows() {
  echo "🪟 [Windows] Сборка..."
  if [ "$CURRENT_PLATFORM" != "windows" ]; then
    echo "[!] Windows-билд доступен только на Windows."
    return 1
  fi
  npm install
  npx tauri build
  echo "✅ Windows билд:"
  echo "   NSIS: src-tauri/target/release/bundle/nsis/*.exe"
  echo "   MSI:  src-tauri/target/release/bundle/msi/*.msi"
}

ERRORS=0
for target in "${TARGETS[@]}"; do
  case "$target" in
    linux)   build_linux   || ((ERRORS++)) ;;
    macos)   build_macos   || ((ERRORS++)) ;;
    windows) build_windows || ((ERRORS++)) ;;
  esac
  echo ""
done

echo "========================================="
if [ $ERRORS -eq 0 ]; then
  echo "✅ Все билды успешно собраны!"
else
  echo "⚠️  $ERRORS платформ(ы) не удалось собрать (см. выше)"
fi
echo "========================================="
