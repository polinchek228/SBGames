# Кроссплатформенная сборка и запуск (Windows / macOS / Linux)

Лаунчер собирается и работает на всех трёх ОС без подписи за $99 Apple Developer.
На macOS unsigned-приложения блокируются Gatekeeper'ом — ниже инструкция обхода.

---

## 🍎 macOS — обход Gatekeeper ("файл повреждён")

Бандл собирается с **ad-hoc подписью** (`signingIdentity: "-"` в `tauri.conf.json`).
Этого достаточно чтобы приложение запускалось, но Gatekeeper всё равно ставит
quarantine-флаг на скачанный из интернета `.dmg`/`.app`. Без обхода юзер видит:

> "SBGames-Launcher" повреждён и не может быть открыт. Переместите его в корзину.

### Вариант 1 — для конечного юзера (одна команда)

Скачанный `SBGames-Launcher.dmg` или `.app` — снять quarantine:

```bash
xattr -cr /Applications/SBGames-Launcher.app
```

После этого запускается двойным кликом. Делать один раз после установки.

### Вариант 2 — через контекстное меню (GUI)

1. Перетащить `SBGames-Launcher.app` в `/Applications`.
2. **Правый клик** (не двойной!) → «Открыть».
3. В диалоге «приложение от неизвестного разработчика» → «Открыть».
4. В следующий раз запускается двойным кликом.

> ⚠️ Просто двойной клик покажет "повреждён" — Gatekeeper блокирует unsigned apps
> даже с ad-hoc подписью если у файла стоит quarantine-флаг.

### Вариант 3 — пересобрать бандл с правильной подписью (для релиза)

Если есть Apple Developer ID ($99/год), в `tauri.conf.json`:

```json
"macOS": {
  "signingIdentity": "Developer ID Application: Your Name (XXXXXXXXXX)"
}
```

И собрать через `APPLE_ID`/`APPLE_PASSWORD`/`APPLE_TEAM_ID` для нотаризации
(Tauri подхватит `tauri-action` автоматически).

---

## 🔨 Сборка под каждую платформу

Сборка идёт на машине соответствующей ОС (или через GitHub Actions matrix —
кросс-компиляция macOS из Windows не поддерживается).

### Windows
```powershell
npm run tauri build
# → src-tauri/target/release/bundle/msi/*.msi
#   src-tauri/target/release/bundle/nsis/*.exe
```

### macOS
```bash
npm run tauri build
# → src-tauri/target/release/bundle/dmg/*.dmg
#   src-tauri/target/release/bundle/macos/*.app
```

Для Universal Binary (Intel + Apple Silicon):
```bash
rustup target add aarch64-apple-darwin x86_64-apple-darwin
npm run tauri build -- --target universal-apple-darwin
```

### Linux
```bash
npm run tauri build
# → src-tauri/target/release/bundle/deb/*.deb
#   src-tauri/target/release/bundle/appimage/*.AppImage
```

Зависимости для сборки AppImage: `libwebkit2gtk-4.1-dev`, `libappindicator3-dev`,
`librsvg2-dev`, `patchelf` (см. https://tauri.app/v1/guides/getting-started/setup/linux).

---

## 🧩 Что важно знать о кроссплатформенности

### Java detection
`find_java()` ищет JVM в:
- `JAVA_HOME` (все ОС)
- `which java` / `where java.exe` (PATH)
- Хардкод-пути по ОС:
  - **mac**: `/Library/Java/JavaVirtualMachines/*/Contents/Home/bin/java`,
    `/usr/libexec/java_home`, Homebrew (`/opt/homebrew/opt/openjdk@17`)
  - **linux**: `/usr/lib/jvm/java-17-openjdk*/bin/java`, `/usr/bin/java`
  - **windows**: `C:\Program Files\Java\jdk-*\bin\java.exe`, Eclipse Adoptium

### Native libraries (LWJGL etc.)
Native classifier jar'ы (`.dll`/`.so`/`.dylib`) **распаковываются** в
`instances/<id>/natives/` через `loaders::extract_natives` перед запуском JVM.
`-Djava.library.path=natives` подставляется через placeholder `${natives_directory}`.
Без этого mac/linux падают с `UnsatisfiedLinkError`.

### Process management
- **Windows**: `CREATE_NEW_CONSOLE` для отдельного окна + Job Object для kill-on-close.
- **unix**: `setsid()` ставит Java в свою process group; `kill_minecraft` зовёт
  `killpg(SIGTERM → SIGKILL)` для мягкого убийства дерева; reaper-поток делает
  `wait()` чтобы не плодить зомби.

### Античит
На macOS/Linux anti-cheat-функции (DLL-скан, debugger detection, Job Object
restrictions) **отключены или заглушены** — Win32 API не имеют прямых эквивалентов.
Серверная валидация (verify/banlist API) продолжает работать на всех ОС.

---

## 🐛 Известные ограничения на macOS/Linux

1. **Anti-cheat** — только серверная часть. Локальная защита от читов работает
   только на Windows.
2. **Логи в реальном времени** — на Windows видно в окне консоли
   (`CREATE_NEW_CONSOLE`); на mac/linux логи пишутся в
   `instances/<id>/logs/latest.log` и `stderr.log`, но окна нет (GUI-приложение).
3. **Forge installer** использует системный `java` для запуска `installer.jar`
   (headless `--installClient`) — на всех ОС.
