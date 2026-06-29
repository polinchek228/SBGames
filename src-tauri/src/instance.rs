//! #1 Instance Manager — кастомные сборки пользователя.
//!
//! Инстанс = отдельная папка под .sbgames/instances/<uuid>/ со своей структурой
//! (mods/, config/, libraries/, versions/, assets/...). Изолирована от серверной
//! части лаунчера (.sbgames/.minecraft). Состояние хранится в instance.json.

#[cfg(windows)]
#[allow(unused_imports)]
use std::os::windows::process::CommandExt as _CmdExtG_instance;

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::Emitter;

use crate::DownloadProgress;

// ─── Типы ─────────────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum LoaderKind {
    Vanilla,
    Forge,
    Fabric,
    Quilt,
    NeoForge,
}

impl LoaderKind {
    /// Строковое имя для Modrinth API и UI.
    pub fn as_modrinth(&self) -> Option<&'static str> {
        match self {
            LoaderKind::Vanilla => None,
            LoaderKind::Forge => Some("forge"),
            LoaderKind::Fabric => Some("fabric"),
            LoaderKind::Quilt => Some("quilt"),
            LoaderKind::NeoForge => Some("neoforge"),
        }
    }
}

/// Описание одного мода/ресурспака/шейдера в составе инстанса.
/// Формат совпадает с тем, что фронт кладёт в customModpacks[].mods[].
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ModEntry {
    #[serde(alias = "projectId", default)]
    pub project_id: String,
    #[serde(default)]
    pub slug: String,
    #[serde(default)]
    pub title: String,
    #[serde(default, alias = "iconUrl")]
    pub icon_url: Option<String>,
    #[serde(default)]
    pub version: Option<String>,
    #[serde(default)]
    pub downloads: Option<u64>,
    /// Готовый URL для скачивания конкретной версии файла.
    #[serde(default, alias = "downloadUrl")]
    pub download_url: Option<String>,
    #[serde(default)]
    pub filename: Option<String>,
    /// Категория файла: mods / resourcepacks / shaderpacks.
    #[serde(default = "default_kind")]
    pub kind: String,
    /// Локальный импортированный .jar — уже лежит в инстансе, качать не надо.
    #[serde(default)]
    pub local: bool,
}

fn default_kind() -> String {
    "mods".to_string()
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct InstanceConfig {
    pub id: String,
    pub name: String,
    #[serde(alias = "mcVersion")]
    pub mc_version: String,
    pub loader: LoaderKind,
    #[serde(default, alias = "loaderVersion")]
    pub loader_version: Option<String>,
    #[serde(alias = "javaVersion")]
    pub java_version: u8,
    #[serde(default = "default_min_ram", alias = "minRamMb")]
    pub min_ram_mb: u32,
    #[serde(default = "default_max_ram", alias = "maxRamMb")]
    pub max_ram_mb: u32,
    #[serde(default, alias = "jvmArgs")]
    pub jvm_args: Vec<String>,
    #[serde(default)]
    pub mods: Vec<ModEntry>,
    #[serde(default, alias = "createdAt")]
    pub created_at: i64,
    #[serde(default, alias = "lastPlayed")]
    pub last_played: Option<i64>,
    #[serde(default)]
    pub icon: Option<String>,
}

fn default_min_ram() -> u32 {
    512
}
fn default_max_ram() -> u32 {
    4096
}

impl InstanceConfig {
    /// Список поддиректорий, создаваемых при `instance_create`.
    pub const SUBDIRS: &'static [&'static str] = &[
        "mods",
        "config",
        "saves",
        "resourcepacks",
        "shaderpacks",
        "logs",
        "libraries",
        "natives",
        "versions",
        "assets",
    ];
}

// ─── Хелперы путей ────────────────────────────────────────────────────────────

/// Корень всех инстансов: .sbgames/instances/.
/// `minecraft_dir()` возвращает .sbgames/.minecraft — поднимаемся уровнем выше.
pub fn instances_root() -> PathBuf {
    crate::minecraft_dir()
        .parent()
        .map(|p| p.join("instances"))
        .unwrap_or_else(|| PathBuf::from(".sbgames/instances"))
}

pub fn instance_dir(id: &str) -> PathBuf {
    // Sanitize: only allow alphanumeric, hyphens, underscores
    let safe: String = id.chars().filter(|c| c.is_alphanumeric() || *c == '-' || *c == '_').collect();
    if safe.is_empty() {
        return instances_root().join("_invalid");
    }
    instances_root().join(&safe)
}

pub fn instance_json_path(id: &str) -> PathBuf {
    instance_dir(id).join("instance.json")
}

/// Требуемая Java по MC-версии.
pub fn required_java_for_mc(mc: &str) -> u8 {
    let (major, minor, patch) = parse_mc_version(mc);
    // 1.17+ требует Java 17 (точнее 1.17 — 16, но 17 обратно совместима и доступнее).
    if major > 1 || (major == 1 && minor >= 20 && patch >= 5) || (major == 1 && minor >= 21) {
        21
    } else if major == 1 && minor >= 17 {
        17
    } else {
        8
    }
}

/// (major, minor, patch). "1.20.1" -> (1,20,1); "1.20" -> (1,20,0).
pub fn parse_mc_version(s: &str) -> (u32, u32, u32) {
    let parts: Vec<u32> = s
        .split('.')
        .filter_map(|p| p.split('-').next().and_then(|x| x.parse().ok()))
        .collect();
    let major = parts.first().copied().unwrap_or(1);
    let minor = parts.get(1).copied().unwrap_or(0);
    let patch = parts.get(2).copied().unwrap_or(0);
    (major, minor, patch)
}

// ─── Чтение/запись ────────────────────────────────────────────────────────────

/// Прочитать конфиг инстанса по id. Битые файлы → Err (caller сам решает логировать).
pub fn load(id: &str) -> Result<InstanceConfig, String> {
    let path = instance_json_path(id);
    let text = std::fs::read_to_string(&path).map_err(|e| format!("read {}: {}", path.display(), e))?;
    serde_json::from_str(&text).map_err(|e| format!("parse {}: {}", path.display(), e))
}

/// Сохранить конфиг (атомарная запись через tmp + rename).
pub fn save(cfg: &InstanceConfig) -> Result<(), String> {
    let dir = instance_dir(&cfg.id);
    std::fs::create_dir_all(&dir).map_err(|e| format!("create dir {}: {}", dir.display(), e))?;
    let path = instance_json_path(&cfg.id);
    let tmp = path.with_extension("json.tmp");
    let text = serde_json::to_string_pretty(cfg).map_err(|e| format!("serialize: {}", e))?;
    std::fs::write(&tmp, &text).map_err(|e| format!("write tmp: {}", e))?;
    std::fs::rename(&tmp, &path).map_err(|e| format!("rename: {}", e))
}

fn emit_status(app: &tauri::AppHandle, msg: &str) {
    let _ = app.emit(
        "download_progress",
        DownloadProgress {
            file: msg.to_string(),
            downloaded: 0,
            total: 1,
            speed_kbs: 0,
        },
    );
}

// ─── Tauri-команды ────────────────────────────────────────────────────────────

/// Список всех инстансов. Битые файлы пропускаются с логом, не падаем.
#[tauri::command]
pub fn instance_list() -> Vec<InstanceConfig> {
    let root = instances_root();
    let mut out = Vec::new();
    if let Ok(rd) = std::fs::read_dir(&root) {
        for entry in rd.flatten() {
            let id = match entry.file_name().to_str().map(|s| s.to_string()) {
                Some(id) => id,
                None => continue,
            };
            match load(&id) {
                Ok(cfg) => out.push(cfg),
                Err(e) => eprintln!("[instance_list] skip {}: {}", id, e),
            }
        }
    }
    // Свеже-сыгранные — наверх (по last_played, затем по created_at).
    out.sort_by(|a, b| {
        let a_played = a.last_played.unwrap_or(0);
        let b_played = b.last_played.unwrap_or(0);
        b_played.cmp(&a_played).then(b.created_at.cmp(&a.created_at))
    });
    out
}

/// Создать инстанс: сгенерировать uuid (если пустой), создать структуру папок,
/// записать instance.json. Возвращает id.
#[tauri::command]
pub fn instance_create(cfg: InstanceConfig, app: tauri::AppHandle) -> Result<String, String> {
    let id = if cfg.id.trim().is_empty() {
        uuid::Uuid::new_v4().to_string()
    } else {
        cfg.id.clone()
    };
    let mut cfg = cfg;
    cfg.id = id.clone();
    if cfg.created_at == 0 {
        cfg.created_at = chrono_now_secs();
    }
    // Если java_version не задана осмысленно (0) — выводим из MC-версии.
    if cfg.java_version == 0 {
        cfg.java_version = required_java_for_mc(&cfg.mc_version);
    }
    if cfg.max_ram_mb == 0 {
        cfg.max_ram_mb = default_max_ram();
    }

    let dir = instance_dir(&id);
    emit_status(&app, &format!("Создание сборки «{}»…", cfg.name));
    for sub in InstanceConfig::SUBDIRS {
        std::fs::create_dir_all(dir.join(sub)).map_err(|e| format!("mkdir {}: {}", sub, e))?;
    }
    save(&cfg)?;
    Ok(id)
}

/// Удалить инстанс целиком (папка + instance.json).
#[tauri::command]
pub fn instance_delete(id: String) -> Result<(), String> {
    let dir = instance_dir(&id);
    if dir.exists() {
        std::fs::remove_dir_all(&dir).map_err(|e| format!("remove {}: {}", dir.display(), e))?;
    }
    Ok(())
}

/// Обновить конфиг существующего инстанса.
#[tauri::command]
pub fn instance_update(cfg: InstanceConfig) -> Result<(), String> {
    if !instance_dir(&cfg.id).exists() {
        return Err(format!("instance {} not found", cfg.id));
    }
    save(&cfg)
}

/// Открыть папку инстанса в файловом менеджере ОС.
#[tauri::command]
pub fn instance_open_folder(id: String) -> Result<(), String> {
    let dir = instance_dir(&id);
    open_in_file_manager(&dir)
}

fn open_in_file_manager(path: &PathBuf) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer").creation_flags(0x08000000)
            .arg(path)
            .spawn()
            .map_err(|e| format!("explorer: {}", e))?;
        return Ok(());
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(path)
            .spawn()
            .map_err(|e| format!("open: {}", e))?;
        return Ok(());
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        std::process::Command::new("xdg-open")
            .arg(path)
            .spawn()
            .map_err(|e| format!("xdg-open: {}", e))?;
        return Ok(());
    }
}

fn chrono_now_secs() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}