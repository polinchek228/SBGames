//! #2 Java Runtime Manager — скачивание JRE через Eclipse Adoptium API.
//!
//! JRE кэшируется в .sbgames/runtimes/{version}/. На Windows — zip, на
//! Linux/Mac — tar.gz. Для проверки целостности используется SHA256 из API.
//! Поиск уже установленной Java идёт через walkdir, результат кэшируется.

use sha2::{Digest, Sha256};
use std::io::Read;
use std::path::PathBuf;
use std::sync::OnceLock;
use tauri::Emitter;

use crate::{download_file, DownloadProgress};

/// Кэш «версия → путь до java-бинаря», чтобы не сканировать диски каждый раз.
static JAVA_CACHE: OnceLock<std::sync::Mutex<std::collections::HashMap<u8, PathBuf>>> =
    OnceLock::new();

fn cache() -> &'static std::sync::Mutex<std::collections::HashMap<u8, PathBuf>> {
    JAVA_CACHE.get_or_init(|| std::sync::Mutex::new(std::collections::HashMap::new()))
}

/// .sbgames/runtimes/
fn runtimes_root() -> PathBuf {
    crate::minecraft_dir()
        .parent()
        .map(|p| p.join("runtimes"))
        .unwrap_or_else(|| PathBuf::from(".sbgames/runtimes"))
}

pub fn runtime_dir(version: u8) -> PathBuf {
    runtimes_root().join(version.to_string())
}

/// Имя бинаря под текущей ОС.
fn java_bin_name() -> &'static str {
    if cfg!(target_os = "windows") {
        "javaw.exe"
    } else {
        "java"
    }
}

/// Найти уже установленную Java нужной версии в runtimes/. Кэшируется.
pub fn find_local_java(version: u8) -> Option<PathBuf> {
    if let Ok(map) = cache().lock() {
        if let Some(p) = map.get(&version) {
            if p.exists() {
                return Some(p.clone());
            }
        }
    }

    let bin = java_bin_name();
    let root = runtime_dir(version);
    if !root.exists() {
        return None;
    }
    // walkdir ищет javaw.exe / java. Берём первый найденный.
    for entry in walkdir::WalkDir::new(&root).into_iter().flatten() {
        let path = entry.path();
        if path.is_file() {
            if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                if name == bin {
                    if let Ok(mut m) = cache().lock() {
                        m.insert(version, path.to_path_buf());
                    }
                    return Some(path.to_path_buf());
                }
            }
        }
    }
    None
}

/// Параметры платформы для Adoptium API.
fn adoptium_os() -> &'static str {
    if cfg!(target_os = "windows") {
        "windows"
    } else if cfg!(target_os = "macos") {
        "mac"
    } else {
        "linux"
    }
}

fn adoptium_arch() -> &'static str {
    // Поддерживаем x64 — наиболее распространённая архитектура у игроков.
    "x64"
}

/// Гарантированно получить Java нужной версии: вернуть локальную или скачать.
pub async fn ensure_java(version: u8, app: &tauri::AppHandle) -> Result<PathBuf, String> {
    if let Some(p) = find_local_java(version) {
        return Ok(p);
    }

    let _ = app.emit(
        "download_progress",
        DownloadProgress {
            file: format!("Загрузка Java {}…", version),
            downloaded: 0,
            total: 1,
            speed_kbs: 0,
        },
    );

    let url = format!(
        "https://api.adoptium.net/v3/assets/latest/{}/hotspot?os={}&arch={}&image_type=jre&vendor=eclipse",
        version,
        adoptium_os(),
        adoptium_arch()
    );

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .user_agent("SBGames-Launcher/1.0")
        .build()
        .map_err(|e| format!("http client: {}", e))?;

    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("adoptium request: {}", e))?;
    if !resp.status().is_success() {
        return Err(format!("Adoptium API: HTTP {}", resp.status()));
    }
    let body: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("adoptium json: {}", e))?;

    let pkg = body
        .get(0)
        .and_then(|v| v.get("binary"))
        .and_then(|v| v.get("package"))
        .ok_or("adoptium: package missing in response")?;

    let link = pkg["link"]
        .as_str()
        .ok_or("adoptium: link missing")?
        .to_string();
    let checksum = pkg["checksum"].as_str().unwrap_or("").to_string();
    let name = pkg["name"].as_str().unwrap_or("jre").to_string();

    // Скачиваем во временный файл.
    let download_dir = runtime_dir(version);
    std::fs::create_dir_all(&download_dir).map_err(|e| format!("mkdir runtimes: {}", e))?;
    let archive_path = download_dir.join(format!(".{}", name));
    download_file(&link, &archive_path, app)
        .await
        .map_err(|e| format!("java download: {}", e))?;

    // SHA256 проверка (если API дал чексумму).
    if !checksum.is_empty() {
        if let Ok(actual) = sha256_of_file(&archive_path) {
            if actual != checksum {
                let _ = std::fs::remove_file(&archive_path);
                return Err(format!(
                    "Java checksum mismatch: expected {}, got {}",
                    checksum, actual
                ));
            }
        }
    }

    // Распаковка: zip (Windows) / tar.gz (Linux, Mac).
    if archive_path.extension().and_then(|e| e.to_str()) == Some("zip") {
        extract_zip(&archive_path, &download_dir)?;
    } else {
        extract_targz(&archive_path, &download_dir)?;
    }
    let _ = std::fs::remove_file(&archive_path);

    // Сбросить кэш и искать заново.
    if let Ok(mut m) = cache().lock() {
        m.remove(&version);
    }
    find_local_java(version).ok_or_else(|| "java not found after extraction".to_string())
}

fn sha256_of_file(path: &PathBuf) -> Result<String, String> {
    let mut f = std::fs::File::open(path).map_err(|e| e.to_string())?;
    let mut hasher = Sha256::new();
    let mut buf = [0u8; 65536];
    loop {
        let n = f.read(&mut buf).map_err(|e| e.to_string())?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }
    Ok(hex::encode(hasher.finalize()))
}

fn extract_zip(archive: &PathBuf, dest: &PathBuf) -> Result<(), String> {
    let file = std::fs::File::open(archive).map_err(|e| format!("open zip: {}", e))?;
    let mut za = zip::ZipArchive::new(file).map_err(|e| format!("zip open: {}", e))?;
    za.extract(dest).map_err(|e| format!("zip extract: {}", e))
}

fn extract_targz(archive: &PathBuf, dest: &PathBuf) -> Result<(), String> {
    let f = std::fs::File::open(archive).map_err(|e| format!("open tar.gz: {}", e))?;
    let gz = flate2::read::GzDecoder::new(f);
    let mut ar = tar::Archive::new(gz);
    ar.unpack(dest).map_err(|e| format!("tar unpack: {}", e))
}

/// Tauri-команда: возвращает строковый путь до Java.
#[tauri::command]
pub async fn java_ensure(version: u8, app: tauri::AppHandle) -> Result<String, String> {
    let p = ensure_java(version, &app).await?;
    Ok(p.to_string_lossy().to_string())
}
