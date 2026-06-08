# SBGames Launcher — Сборка

## Windows (.exe + .msi)
Запускать на Windows машине:
```powershell
$env:PATH += ";$env:USERPROFILE\.cargo\bin"
npm run tauri build
```
Результат: `src-tauri/target/release/bundle/nsis/*.exe` и `msi/*.msi`

## macOS (.dmg + .app)
Запускать на Mac:
```bash
npm run tauri build
```
Результат: `src-tauri/target/release/bundle/dmg/*.dmg`

> Для подписи нужен Apple Developer ID — без него появится предупреждение Gatekeeper.
> Для обхода: `xattr -cr /Applications/SBGames\ Launcher.app`

## Linux (.deb + .rpm + .AppImage)
```bash
npm run tauri build
```
Результат: `src-tauri/target/release/bundle/deb/*.deb`, `rpm/*.rpm`, `appimage/*.AppImage`

## Cross-compile через GitHub Actions
Создай `.github/workflows/build.yml` с матрицей:
- `windows-latest` → .exe/.msi
- `macos-latest`   → .dmg
- `ubuntu-22.04`   → .deb/.AppImage

Пример:
```yaml
jobs:
  build:
    strategy:
      matrix:
        os: [windows-latest, macos-latest, ubuntu-22.04]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm install
      - run: npm run tauri build
      - uses: actions/upload-artifact@v4
        with:
          name: launcher-${{ matrix.os }}
          path: src-tauri/target/release/bundle/
```
