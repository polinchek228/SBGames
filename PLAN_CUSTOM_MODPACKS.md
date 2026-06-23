# План: кастомные сборки в SB Games Launcher

Полный план реализации функции «создать свою сборку» для лаунчера. Каждый блок самодостаточный — можно делать в любом порядке. Рекомендуемая последовательность: #1 → #2 → #4 (Fabric, проще всего) → #3 → #5 → #6 → #7 → #8.

---

## Общая архитектура

```
src-tauri/src/
├── lib.rs                  # существующий — добавить mod-объявления и регистрацию команд
├── instance.rs             # InstanceConfig, пути, CRUD инстансов
├── java.rs                 # Adoptium runtime manager
├── loaders/
│   ├── mod.rs              # trait Loader + общие типы + merge inheritsFrom
│   ├── vanilla.rs          # vanilla manifest + client.jar + libraries + assets
│   ├── forge.rs            # legacy (1.7-1.12) + modern (1.13-1.17) + new (1.18+)
│   ├── fabric.rs           # meta.fabricmc.net
│   ├── quilt.rs            # meta.quiltmc.org (почти копия fabric)
│   └── neoforge.rs         # maven.neoforged.net
├── mods.rs                 # Modrinth API + загрузка в instance/mods/
└── mrpack.rs               # импорт .mrpack
```

**Файловая структура на диске:**

```
.sbgames/
├── runtimes/{8,17,21}/...           # JRE (Adoptium Temurin)
├── instances/<uuid>/
│   ├── instance.json                # сериализованный InstanceConfig
│   ├── mods/  config/  saves/  resourcepacks/  shaderpacks/  logs/
│   ├── libraries/                   # ИЗОЛИРОВАННЫЕ от серверной части
│   ├── versions/<version-id>/<version-id>.json
│   └── assets/                      # или симлинк на общий кэш
└── (старая серверная часть .minecraft/ — не трогаем)
```

Подробности по каждому блоку — ниже. Этот файл будет дополняться.

---

## #1. Instance Manager (`instance.rs`)

### Типы

```rust
use serde::{Serialize, Deserialize};
use std::path::PathBuf;

#[derive(Serialize, Deserialize, Clone)]
pub struct InstanceConfig {
    pub id: String,              // uuid v4
    pub name: String,
    pub mc_version: String,      // "1.20.1"
    pub loader: LoaderKind,
    pub loader_version: Option<String>,
    pub java_version: u8,        // 8 / 17 / 21
    pub min_ram_mb: u32,
    pub max_ram_mb: u32,
    pub jvm_args: Vec<String>,
    pub created_at: i64,
    pub last_played: Option<i64>,
    pub icon: Option<String>,    // путь или base64
}

#[derive(Serialize, Deserialize, Clone, PartialEq)]
pub enum LoaderKind { Vanilla, Forge, Fabric, Quilt, NeoForge }
```

### Хелперы

```rust
pub fn instances_root() -> PathBuf {
    // minecraft_dir() возвращает .sbgames/.minecraft — поднимаемся уровнем выше
    crate::minecraft_dir().parent().unwrap().join("instances")
}

pub fn instance_dir(id: &str) -> PathBuf {
    instances_root().join(id)
}

pub fn required_java_for_mc(mc: &str) -> u8 {
    // 1.7  – 1.16   → 8
    // 1.17 – 1.20.4 → 17
    // 1.20.5+, 1.21+ → 21
}
```

### Tauri-команды

```rust
#[tauri::command] pub fn instance_list() -> Vec<InstanceConfig>;
#[tauri::command] pub fn instance_create(cfg: InstanceConfig) -> Result<String, String>;
#[tauri::command] pub fn instance_delete(id: String) -> Result<(), String>;
#[tauri::command] pub fn instance_update(cfg: InstanceConfig) -> Result<(), String>;
#[tauri::command] pub fn instance_open_folder(id: String) -> Result<(), String>;
```

Внутри `instance_create`: сгенерировать uuid, создать `instance_dir/{mods,config,saves,resourcepacks,shaderpacks,logs,libraries,versions}`, записать `instance.json`.

`instance_list` — читать `instances/*/instance.json`, битые файлы пропускать с логом, не падать.

---

## #2. Java Runtime Manager (`java.rs`)

### API Adoptium (Eclipse Temurin)

```
GET https://api.adoptium.net/v3/assets/latest/{feature_version}/hotspot
    ?os={windows|linux|mac}&arch=x64&image_type=jre&vendor=eclipse
```

Ответ — JSON-массив. Берём `[0].binary.package.link` (zip для Windows, tar.gz для Linux/Mac) и `[0].binary.package.checksum` (SHA256) для верификации.

### Функции

```rust
pub async fn ensure_java(version: u8, app: &AppHandle) -> Result<PathBuf, String> {
    // 1. find_local_java(version).is_some() — вернуть
    // 2. Иначе: GET Adoptium API → скачать архив → проверить SHA256
    //    → распаковать в runtimes/{version}/
    // 3. Найти и вернуть путь до javaw.exe / java
}

pub fn find_local_java(version: u8) -> Option<PathBuf> {
    // walkdir по runtimes/{version}/ ищет javaw.exe (Windows) или java (Unix)
    // Кэшировать в OnceCell<HashMap<u8, PathBuf>>, чтобы не сканировать каждый раз
}
```

Для zip — уже подключённый крейт `zip` (используется в `install_forge_from_zip`). Для tar.gz — `flate2` + `tar` (добавить в Cargo.toml).

### Tauri-команда

```rust
#[tauri::command]
pub async fn java_ensure(version: u8, app: AppHandle) -> Result<String, String>;
```

Возвращает строковый путь — фронт может показать в настройках инстанса.

---

## #3. Forge (`loaders/forge.rs`)

У тебя **уже есть** `install_forge_from_zip` для 1.20.1 в `lib.rs` (~строки 2400-2580). Переноси сюда и обобщай.

### Стратегии по версиям

| MC версия | Подход |
|---|---|
| 1.7.10 – 1.12.2 (legacy) | installer.jar содержит `install_profile.json` старого формата с полем `versionInfo` (готовый профиль) и `forge-*-universal.jar` в корне zip — просто извлечь. MainClass обычно `net.minecraft.launchwrapper.Launch` + `--tweakClass cpw.mods.fml.common.launcher.FMLTweaker` |
| 1.13 – 1.17 | installer.jar содержит `install_profile.json` нового формата + `version.json` + **processors** (срезка LaunchWrapper и т.п.). Проще всего: запустить headless `java -jar forge-installer.jar --installClient <path>` через `Command::spawn` и распарсить готовый профиль |
| 1.18+ | Твой текущий путь: `version.json` лежит прямо в installer.jar — извлекаем, скачиваем libraries, universal.jar тащим с maven. MainClass = `cpw.mods.bootstraplauncher.BootstrapLauncher` |

### Функции

```rust
pub async fn install_forge(
    mc_version: &str,
    forge_version: &str,         // напр "47.4.10"
    instance_dir: &Path,
    app: &AppHandle,
) -> Result<String, String>;     // возвращает version_id ("1.20.1-forge-47.4.10")

async fn install_forge_legacy(...)   // 1.7-1.12
async fn install_forge_modern(...)   // 1.13-1.17 — через headless installer
async fn install_forge_new(...)      // 1.18+ — твой текущий код
```

### URL'ы

```
# Installer (jar)
https://maven.minecraftforge.net/net/minecraftforge/forge/{mc}-{forge}/forge-{mc}-{forge}-installer.jar

# Universal (нужен для legacy и для патча манифеста на 1.20.1)
https://maven.minecraftforge.net/net/minecraftforge/forge/{mc}-{forge}/forge-{mc}-{forge}-universal.jar

# Список версий
https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json
https://files.minecraftforge.net/net/minecraftforge/forge/maven-metadata.json
```

### Гарантии для 1.20.1+

Из твоего текущего кода переноси и не теряй:

- Патч `META-INF/MANIFEST.MF` в universal.jar с `Implementation-Version` — иначе `LauncherVersion.<clinit>` падает.
- Разделение classpath: `bootstraplauncher`, `securejarhandler`, `asm-*`, `JarJarFileSystems` → `--module-path`; остальное → `-cp`.
- `-DignoreList=...` и `-DmergeModules=...` системные свойства (см. `arguments.jvm` в version.json).
- `--add-opens` для `java.base/...` к `cpw.mods.bootstraplauncher` и `cpw.mods.securejarhandler`.

---

## #4. Fabric (`loaders/fabric.rs`) — САМЫЙ ПРОСТОЙ, начни отсюда

Никаких installer'ов и processors. Всё через **meta.fabricmc.net**.

### Эндпоинты

```
# Список loader-версий для конкретной MC
GET https://meta.fabricmc.net/v2/versions/loader/{mc_version}

# Готовый version.json (профиль)
GET https://meta.fabricmc.net/v2/versions/loader/{mc}/{loader}/profile/json

# Все loader-версии (для latest stable)
GET https://meta.fabricmc.net/v2/versions/loader
```

Второй эндпоинт возвращает **полностью готовый профиль** с` libraries[]`, `mainClass` (`net.fabricmc.loader.impl.launch.knot.KnotClient`), `inheritsFrom: "<mc>"`.

### Функция

```rust
pub async fn install_fabric(
    mc_version: &str,
    loader_version: Option<&str>,    // None → берём latest stable
    instance_dir: &Path,
    app: &AppHandle,
) -> Result<String, String> {
    // 1. Если loader_version None → GET .../versions/loader, взять первый где stable: true
    // 2. GET .../profile/json → сохранить как versions/{id}/{id}.json
    // 3. Скачать все libraries по url из maven.fabricmc.net и Maven Central
    // 4. Вернуть id (напр "fabric-loader-0.15.7-1.20.1")
}
```

Libraries у Fabric указаны как `{name: "org.foo:bar:1.0", url: "https://maven..."}`. Путь в репо строится из maven-координат: `org/foo/bar/1.0/bar-1.0.jar`. Если поле `url` пустое — fallback на Maven Central (`https://repo1.maven.org/maven2/`).

client.jar самого Minecraft Fabric **не трогает** — он берётся из vanilla-базы через `inheritsFrom`.

---

## #5. Quilt (`loaders/quilt.rs`)

Практически копия Fabric. Различия только в URL и mainClass.

### Эндпоинты

```
GET https://meta.quiltmc.org/v3/versions/loader/{mc}
GET https://meta.quiltmc.org/v3/versions/loader/{mc}/{loader}/profile/json
```

- Maven для библиотек: `https://maven.quiltmc.org/repository/release/`
- MainClass: `org.quiltmc.loader.impl.launch.knot.KnotClient`

**Рекомендация:** вынеси общий код в `loaders/meta_based.rs` и параметризуй base URL — Fabric и Quilt станут двумя конфигами одного резолвера:

```rust
pub struct MetaLoaderConfig {
    pub meta_base: &'static str,        // "https://meta.fabricmc.net/v2"
    pub fallback_maven: &'static str,   // "https://maven.fabricmc.net/"
    pub id_prefix: &'static str,        // "fabric-loader" / "quilt-loader"
}

pub async fn install_meta_based(
    cfg: &MetaLoaderConfig,
    mc_version: &str,
    loader_version: Option<&str>,
    instance_dir: &Path,
    app: &AppHandle,
) -> Result<String, String>;
```

---

## #6. NeoForge (`loaders/neoforge.rs`)

NeoForge — форк Forge для MC 1.20.2+. Структура installer.jar **похожа** на современный Forge: внутри лежит готовый `version.json`, и его можно извлечь напрямую без headless-запуска installer'а.

### Эндпоинты

```
# Список версий (JSON со списком всех релизов)
GET https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge

# Installer
https://maven.neoforged.net/releases/net/neoforged/neoforge/{ver}/neoforge-{ver}-installer.jar

# Universal (нужен в classpath клиента)
https://maven.neoforged.net/releases/net/neoforged/neoforge/{ver}/neoforge-{ver}-universal.jar
```

### Логика

```rust
pub async fn install_neoforge(
    neoforge_version: &str,      // напр "20.4.237"
    instance_dir: &Path,
    app: &AppHandle,
) -> Result<String, String> {
    // 1. Скачать installer.jar в кэш
    // 2. Открыть как zip (крейт `zip`), извлечь version.json из корня
    // 3. Скачать все libraries из version.json (как в forge_new)
    // 4. Скачать universal.jar в libraries/net/neoforged/neoforge/{ver}/
    // 5. Сохранить version.json в versions/{id}/{id}.json
    // 6. Вернуть id (напр "neoforge-20.4.237")
}
```

### Маппинг версий

Из `neoforge-{ver}` MC-версия выводится напрямую: `20.4.237` → MC `1.20.4`, `21.0.143` → MC `1.21.0`. Формула:

```
let parts: Vec<&str> = ver.split('.').collect();
let mc = format!("1.{}.{}", parts[0], parts[1]);  // "1.20.4"
```

Для UI: фильтруй список так, чтобы показывать NeoForge только для MC 1.20.2+ (раньше его не существует).

### Отличия от Forge

- Maven-группа `net.neoforged` вместо `net.minecraftforge`.
- MainClass такой же — `cpw.mods.bootstraplauncher.BootstrapLauncher`.
- Все те же гарантии: патч `MANIFEST.MF` в universal.jar, разделение module-path / classpath, `--add-opens`, `-DignoreList`, `-DmergeModules`.
- Можно переиспользовать большую часть кода из `forge_new` — вынеси общую логику в `loaders/forge_common.rs`.

---

## #7. Vanilla loader + общий trait (`loaders/vanilla.rs` и `loaders/mod.rs`)

Ванильный loader нужен **всегда**: даже Fabric/Forge через `inheritsFrom` ссылаются на vanilla-профиль. Сейчас этот код размазан внутри `launch_minecraft` в `lib.rs` (~строки 480-595). Вынеси в отдельный модуль.

### `loaders/vanilla.rs`

```rust
pub async fn ensure(
    mc_version: &str,
    instance_dir: &Path,
    app: &AppHandle,
) -> Result<String, String> {
    // 1. GET https://launchermeta.mojang.com/mc/game/version_manifest_v2.json
    // 2. Найти версию по id, скачать её version.json
    // 3. Скачать client.jar (downloads.client.url)
    // 4. Скачать все libraries[] (с учётом OS rules + native classifiers)
    // 5. Скачать assets:
    //    - asset index по url из version.json
    //    - все объекты по hash в assets/objects/{first2}/{hash}
    // 6. Сохранить version.json в versions/{mc_version}/
    // 7. Вернуть mc_version (id профиля)
}
```

### `loaders/mod.rs` — общий trait

```rust
use async_trait::async_trait;

#[async_trait]
pub trait Loader {
    /// Установить loader (скачать libraries, version.json, и т.п.)
    /// Возвращает version_id, под которым профиль сохранён в versions/
    async fn install(
        &self,
        mc_version: &str,
        loader_version: Option<&str>,
        instance_dir: &Path,
        app: &AppHandle,
    ) -> Result<String, String>;

    /// Список доступных версий loader'а для данной MC-версии
    async fn list_versions(&self, mc_version: &str) -> Result<Vec<String>, String>;
}

pub mod vanilla;
pub mod forge;
pub mod fabric;
pub mod quilt;
pub mod neoforge;
```

### Резолв `inheritsFrom`

Ключевая функция — она нужна для всех loader'ов кроме Vanilla:

```rust
pub fn merge_profile(
    instance_dir: &Path,
    version_id: &str,
) -> Result<MergedProfile, String> {
    // 1. Читаем versions/{version_id}/{version_id}.json
    // 2. Если есть inheritsFrom ("1.20.1") — рекурсивно загружаем родителя
    // 3. Мержим:
    //    - libraries[] — loader-libraries ИДУТ ПЕРВЫМИ в classpath (приоритет)
    //    - mainClass — берём из дочернего
    //    - arguments.game[], arguments.jvm[] — конкатенируем (новый формат)
    //    - minecraftArguments — берём из дочернего, если есть (старый формат)
    //    - assetIndex — из родителя, если в дочернем нет
    // 4. Возвращаем структуру для запуска
}

pub struct MergedProfile {
    pub libraries: Vec<PathBuf>,        // абсолютные пути к jar в instance/libraries/
    pub natives: Vec<PathBuf>,          // распакованные natives
    pub main_class: String,
    pub jvm_args: Vec<String>,          // подставлены ${library_directory}, ${classpath_separator} и т.п.
    pub game_args: Vec<String>,         // ${auth_player_name}, ${version_name} и т.п.
    pub asset_index: String,
    pub asset_index_url: String,
}
```

**Подстановки (placeholders) в args:**

| Placeholder | Чем заменить |
|---|---|
| `${auth_player_name}` | username |
| `${version_name}` | merged version_id |
| `${game_directory}` | instance_dir |
| `${assets_root}` | instance_dir/assets |
| `${assets_index_name}` | asset_index |
| `${auth_uuid}` | uuid игрока |
| `${auth_access_token}` | access_token |
| `${user_type}` | "legacy" (для offline) или "msa" |
| `${version_type}` | "release" |
| `${classpath}` | собранный -cp |
| `${classpath_separator}` | ";" на Windows, ":" на Unix |
| `${library_directory}` | instance_dir/libraries |
| `${natives_directory}` | instance_dir/natives |

---

## #8. Команда `launch_instance` + интеграция с PlayPage

Высокоуровневая команда-оркестратор. Заменяет (или работает рядом с) `launch_minecraft` для серверного модпака.

### Сигнатура

```rust
#[tauri::command]
pub async fn launch_instance(
    app: AppHandle,
    instance_id: String,
    username: String,
    uuid: String,
    access_token: String,
) -> Result<(), String> {
    let cfg = instance::load(&instance_id)?;
    let inst_dir = instance::instance_dir(&instance_id);

    // 1. Java
    let java_path = java::ensure_java(cfg.java_version, &app).await?;

    // 2. Vanilla база (manifest, client.jar, assets, libraries)
    let vanilla_id = loaders::vanilla::ensure(&cfg.mc_version, &inst_dir, &app).await?;

    // 3. Loader поверх (если не Vanilla)
    let version_id = match cfg.loader {
        LoaderKind::Vanilla => vanilla_id,
        LoaderKind::Forge => loaders::forge::install_forge(
            &cfg.mc_version,
            cfg.loader_version.as_deref().ok_or("forge_version missing")?,
            &inst_dir, &app,
        ).await?,
        LoaderKind::Fabric => loaders::fabric::install_fabric(
            &cfg.mc_version, cfg.loader_version.as_deref(), &inst_dir, &app,
        ).await?,
        LoaderKind::Quilt => loaders::quilt::install_quilt(
            &cfg.mc_version, cfg.loader_version.as_deref(), &inst_dir, &app,
        ).await?,
        LoaderKind::NeoForge => loaders::neoforge::install_neoforge(
            cfg.loader_version.as_deref().ok_or("neoforge_version missing")?,
            &inst_dir, &app,
        ).await?,
    };

    // 4. Скачать моды (см. блок #9)
    mods::sync_mods(&inst_dir, &cfg, &app).await?;

    // 5. Смержить профили (vanilla + loader) и подставить placeholders
    let merged = loaders::merge_profile(&inst_dir, &version_id)?;
    let resolved = resolve_placeholders(&merged, &cfg, &inst_dir, &username, &uuid, &access_token);

    // 6. Запустить JVM
    let mut cmd = std::process::Command::new(&java_path);
    cmd.args(&resolved.jvm_args);
    cmd.arg("-cp").arg(build_classpath(&resolved.libraries));
    cmd.arg(&resolved.main_class);
    cmd.args(&resolved.game_args);
    cmd.current_dir(&inst_dir);
    cmd.stdin(Stdio::null());
    cmd.stdout(Stdio::from(File::create(inst_dir.join("logs/latest.log"))?));
    cmd.stderr(Stdio::from(File::create(inst_dir.join("logs/stderr.log"))?));
    let child = cmd.spawn().map_err(|e| e.to_string())?;

    // НЕ запускать modpack-sync с серверного API
    // НЕ ставить mods/ SHA-watcher (он только для серверного режима)
    // НО можно оставить процесс-watcher для anti-debugger

    Ok(())
}
```

### Что нужно адаптировать в `PlayPage.jsx`

UI уже вызывает `invoke('launch_custom_modpack', { modpack, username, token, ramGb, javaPath })`. Два варианта:

1. **Переименовать на бэке** в `launch_instance` и адаптировать UI: раньше передавали modpack-объект целиком, теперь — `instance_id`. Нужно перед вызовом `instance_create` создать инстанс на бэке и сохранить `id` в `customModpacks` localStorage вместо текущего сериализованного modpack.
2. **Оставить старое имя**: `launch_custom_modpack(modpack: InstanceConfig, ...)` — принимает конфиг целиком, внутри сохраняет в `instance_dir/{id}/instance.json`, дальше как обычно. Минус: каждый запуск переписывает instance.json.

Рекомендация — **вариант 1**: чище. Миграция localStorage:

```js
// в PlayPage useEffect при первом запуске:
const legacy = JSON.parse(localStorage.getItem("sbg_custom_modpacks") || "[]");
for (const mp of legacy.filter(m => !m.migrated)) {
  const id = await invoke("instance_create", { cfg: { ...mp, id: crypto.randomUUID() } });
  mp.id = id;
  mp.migrated = true;
}
localStorage.setItem("sbg_custom_modpacks", JSON.stringify(legacy));
```

---

## #9. Скачивание модов (`mods.rs`)

Когда пользователь добавляет мод в билдере на фронте, в `customModpacks[].mods[]` лежит:

```js
{
  projectId: "abc123",   // Modrinth project_id
  slug: "jei",
  title: "JEI",
  icon_url: "...",
  version: "15.20.0",
  downloads: 1234567,
  downloadUrl: "https://cdn.modrinth.com/...",  // может быть null если юзер не выбрал версию
  filename: "jei-15.20.0.jar",
  // или для локальных:
  local: true,
}
```

### Функция

```rust
pub async fn sync_mods(
    instance_dir: &Path,
    cfg: &InstanceConfig,
    app: &AppHandle,
) -> Result<(), String> {
    let mods_dir = instance_dir.join("mods");
    let resourcepacks_dir = instance_dir.join("resourcepacks");
    let shaderpacks_dir = instance_dir.join("shaderpacks");

    for item in &cfg.mods {
        if item.local { continue; }                        // юзер импортировал .jar — он уже там
        let dest = mods_dir.join(&item.filename);
        if dest.exists() { continue; }                     // уже скачан

        let url = if let Some(url) = &item.download_url {
            url.clone()
        } else {
            // downloadUrl=null → резолвим через Modrinth API
            resolve_modrinth_version(
                &item.project_id, &cfg.mc_version, &cfg.loader,
            ).await?
        };

        download_file(&url, &dest, app).await?;
    }
    // Аналогично для resourcepacks/shaders
    Ok(())
}

async fn resolve_modrinth_version(
    project_id: &str,
    mc_version: &str,
    loader: &LoaderKind,
) -> Result<String, String> {
    let loader_str = match loader {
        LoaderKind::Forge => "forge",
        LoaderKind::Fabric => "fabric",
        LoaderKind::Quilt => "quilt",
        LoaderKind::NeoForge => "neoforge",
        LoaderKind::Vanilla => return Err("vanilla не поддерживает моды".into()),
    };
    let url = format!(
        "https://api.modrinth.com/v2/project/{project_id}/version?loaders=[\"{loader_str}\"]&game_versions=[\"{mc_version}\"]"
    );
    let resp = reqwest::get(&url).await.map_err(|e| e.to_string())?;
    let versions: Vec<serde_json::Value> = resp.json().await.map_err(|e| e.to_string())?;
    versions.first()
        .and_then(|v| v["files"].as_array()?.iter().find(|f| f["primary"] == true))
        .and_then(|f| f["url"].as_str())
        .map(String::from)
        .ok_or("no compatible version".into())
}
```

**Auto-добавление зависимостей:** Modrinth-API возвращает у каждой версии `dependencies[]`. Если у мода есть `required` зависимость, которой нет в списке — рекурсивно резолвим её. Это улучшение на будущее, в MVP можно опустить (Fabric API уже добавляется автоматически на фронте).

**Хеши модов:** после скачивания опционально записать `instance/.mod-hashes` (sha256 каждого файла) — пригодится если захочешь добавить guard для кастомных сборок позже.

---

## #10. Импорт `.mrpack` (`mrpack.rs`)

[Modrinth modpack format](https://docs.modrinth.com/docs/modpacks/format_definition/) — это zip с `modrinth.index.json` внутри.

### Структура `modrinth.index.json`

```json
{
  "formatVersion": 1,
  "game": "minecraft",
  "versionId": "1.0.0",
  "name": "My Modpack",
  "summary": "...",
  "files": [
    {
      "path": "mods/jei.jar",
      "hashes": { "sha1": "...", "sha512": "..." },
      "env": { "client": "required", "server": "unsupported" },
      "downloads": ["https://cdn.modrinth.com/data/..."],
      "fileSize": 1234567
    }
  ],
  "dependencies": {
    "minecraft": "1.20.1",
    "forge": "47.4.10"        // или fabric-loader / quilt-loader / neoforge
  }
}
```

Кроме `modrinth.index.json` в zip есть папка `overrides/` (и опционально `client-overrides/`, `server-overrides/`) — её содержимое нужно скопировать в gameDir как есть.

### Функция

```rust
#[tauri::command]
pub async fn import_mrpack(
    app: AppHandle,
    file_path: String,
    custom_name: Option<String>,
) -> Result<InstanceConfig, String> {
    // 1. Открыть zip
    // 2. Распарсить modrinth.index.json
    // 3. Из dependencies определить mc_version + loader + loader_version
    // 4. Создать инстанс через instance_create
    // 5. Для каждого file в files[] (где env.client != "unsupported"):
    //    - download первого URL из downloads[]
    //    - проверить sha512
    //    - сохранить по path внутри instance_dir
    // 6. Распаковать overrides/* (и client-overrides/*) в instance_dir
    // 7. Вернуть созданный InstanceConfig — фронт может сразу его открыть
}
```

### UI на фронте

В `PlayPage.jsx` рядом с кнопкой «Создать сборку» добавить кнопку «Импорт .mrpack»:

```jsx
<input type="file" accept=".mrpack,.zip" onChange={async e => {
  const file = e.target.files?.[0];
  if (!file) return;
  const filePath = file.path;  // Tauri экспортирует путь
  const cfg = await invoke("import_mrpack", { filePath });
  setCustomModpacks(prev => [...prev, cfg]);
}} />
```

---

## Дополнения: Cargo.toml и фронт

### Новые зависимости в `src-tauri/Cargo.toml`

```toml
[dependencies]
uuid = { version = "1.7", features = ["v4", "serde"] }
async-trait = "0.1"             # если использовать trait Loader
tar = "0.4"                     # для tar.gz (Linux/Mac JRE)
flate2 = "1.0"                  # для gzip
# zip, reqwest, sha2, hex, walkdir — уже есть
```

### Регистрация команд в `lib.rs`

В `tauri::Builder::default().invoke_handler(...)` добавить:

```rust
.invoke_handler(tauri::generate_handler![
    // ... existing ...
    instance::instance_list,
    instance::instance_create,
    instance::instance_delete,
    instance::instance_update,
    instance::instance_open_folder,
    java::java_ensure,
    launch_instance,
    mrpack::import_mrpack,
])
```

И в начале `lib.rs`:

```rust
mod instance;
mod java;
mod loaders;
mod mods;
mod mrpack;
```

### Обновления `src/lib/tauri.js`

Добавь обёртки для удобства фронта:

```js
export const instanceList = () => invoke("instance_list");
export const instanceCreate = (cfg) => invoke("instance_create", { cfg });
export const instanceDelete = (id) => invoke("instance_delete", { id });
export const launchInstance = (instanceId, username, uuid, accessToken) =>
    invoke("launch_instance", { instanceId, username, uuid, accessToken });
export const importMrpack = (filePath) => invoke("import_mrpack", { filePath });
```

---

## Чеклист поэтапной реализации

- [ ] **Фундамент:** `instance.rs` (#1) и `java.rs` (#2) — без них ничего не работает.
- [ ] **Доказательство концепции:** `loaders/vanilla.rs` (вынос из lib.rs) + `loaders/fabric.rs` (#4) + резолв `inheritsFrom` + `launch_instance`. Запустить чистый Fabric 1.20.1 без модов — это покажет, что весь pipeline (java→vanilla→loader→merge→spawn) работает.
- [ ] **Скачивание модов** (#9) — добавить и проверить, что скачанный JEI запускается в Fabric.
- [ ] **Forge new** (#3) — переноси `install_forge_from_zip` в `loaders/forge.rs`, проверь на 1.20.1.
- [ ] **Forge legacy + modern** (#3 продолжение) — для 1.7-1.17.
- [ ] **Quilt** (#5) — конфиг для общего meta-резолвера.
- [ ] **NeoForge** (#6).
- [ ] **.mrpack импорт** (#10).
- [ ] **UI улучшения:** иконки инстансов, переименование, дублирование, экспорт в .mrpack (бонус).

---

## Подводные камни

1. **Encoding пути.** Если пользователь живёт в `C:\Users\Иван\AppData\Roaming\.sbgames\...` — кириллица в пути. Java 8 на Windows может биться об это (особенно в `-cp`). Проверить: либо требовать ASCII-путь, либо ставить `-Dfile.encoding=UTF-8` и `-Dsun.jnu.encoding=UTF-8`.

2. **Анти-чит.** Текущий `launch_minecraft` запускает SHA256-watcher на `mods/`. Для кастомных сборок watcher **не нужен** — пользователь сам решает что у него в mods/. Но **DLL-watcher** на сам JVM-процесс (защита от инжекта) можно оставить — это чистая безопасность лаунчера, а не серверного модпака.

3. **Длина classpath на Windows.** При большом количестве модов и libraries `-cp` может превысить лимит cmd.exe (~32k). Решение — использовать `@argfile` (`java @args.txt`) или wrapped manifest jar, как ты уже делаешь в `generate_wrapped_classpath_manifest`.

4. **Dev vs production paths.** В debug-сборке `tauri:dev` рабочая папка может отличаться. `minecraft_dir()` корректно использует `APPDATA`, но любые относительные пути типа `./libraries/...` сломаются. Проверь, что все пути в classpath абсолютные.

5. **Снапшоты Mojang.** `version_manifest_v2.json` отдаёт `1.20.1` среди тысяч snapshot'ов. На фронте в `getMcVersions` уже фильтруется (только release + snapshots за полгода) — на бэке тоже резолвить по точному `id`.

6. **Concurrent libraries downloads.** Сейчас `download_file` качает по одному. Для сборки с 100+ модов это медленно. Используй `futures::stream::FuturesUnordered` или `tokio::join!` с семафором (10-20 параллельных) — даст ускорение в 5-10 раз без перегрузки серверов.

7. **Кеш libraries.** При создании нескольких инстансов одной MC-версии вся `libraries/` качается заново. Можно сделать общий кэш `cache/libraries/` и **жесткие ссылки** (`std::fs::hard_link`) в каждый инстанс — изоляция файлов сохраняется (моды разные), но место экономится. Это улучшение на потом.
