//! #6 NeoForge loader — форк Forge для MC 1.20.2+.
//!
//! Структура installer.jar похожа на modern/new Forge: внутри готовый version.json,
//! извлекается напрямую без headless installer'а. Те же гарантии: патч MANIFEST.MF,
//! разделение module-path/classpath, --add-opens.

use crate::instance::parse_mc_version;
use crate::loaders::{ensure_profile_libraries, forge::patch_universal_manifest};
use crate::{download_file, DownloadProgress};
use std::io::Read;
use std::path::Path;
use tauri::{AppHandle, Emitter};

fn emit(app: &AppHandle, msg: &str) {
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

/// MC-версия из neoforge-версии: "20.4.237" → "1.20.4".
pub fn mc_from_neoforge_version(ver: &str) -> String {
    let parts: Vec<&str> = ver.split('.').collect();
    if parts.len() < 2 {
        return String::new();
    }
    format!("1.{}.{}", parts[0], parts[1])
}

/// Поддерживается ли NeoForge для данной MC-версии (1.20.2+).
pub fn is_supported(mc_version: &str) -> bool {
    let (maj, minor, patch) = parse_mc_version(mc_version);
    if maj != 1 {
        return false;
    }
    minor > 20 || (minor == 20 && patch >= 2)
}

/// Скачать installer.jar в кэш instance/.cache/neoforge/.
async fn download_installer(
    neoforge_version: &str,
    instance_dir: &Path,
    app: &AppHandle,
) -> Result<std::path::PathBuf, String> {
    let cache_dir = instance_dir.join(".cache").join("neoforge");
    std::fs::create_dir_all(&cache_dir).map_err(|e| format!("mkdir cache: {}", e))?;
    let fname = format!("neoforge-{}-installer.jar", neoforge_version);
    let path = cache_dir.join(&fname);
    if path.exists() {
        return Ok(path);
    }
    let url = format!(
        "https://maven.neoforged.net/releases/net/neoforged/neoforge/{}/{}",
        neoforge_version, fname
    );
    emit(app, &fname);
    download_file(&url, &path, app)
        .await
        .map_err(|e| format!("neoforge installer: {}", e))?;
    Ok(path)
}

pub async fn install_neoforge(
    neoforge_version: &str,
    instance_dir: &Path,
    app: &AppHandle,
) -> Result<String, String> {
    let installer = download_installer(neoforge_version, instance_dir, app).await?;

    let file = std::fs::File::open(&installer).map_err(|e| format!("open installer: {}", e))?;
    let mut zip = zip::ZipArchive::new(file).map_err(|e| format!("zip open: {}", e))?;

    let version_json_str = {
        let mut f = zip
            .by_name("version.json")
            .map_err(|e| format!("version.json not in installer: {}", e))?;
        let mut s = String::new();
        f.read_to_string(&mut s).map_err(|e| e.to_string())?;
        s
    };
    let profile: serde_json::Value = serde_json::from_str(&version_json_str)
        .map_err(|e| format!("version.json parse: {}", e))?;

    let version_id = profile
        .get("id")
        .and_then(|i| i.as_str())
        .map(|s| s.to_string())
        .unwrap_or_else(|| format!("neoforge-{}", neoforge_version));

    let ver_dir = instance_dir.join("versions").join(&version_id);
    std::fs::create_dir_all(&ver_dir).map_err(|e| format!("mkdir versions: {}", e))?;
    std::fs::write(ver_dir.join(format!("{}.json", version_id)), &version_json_str)
        .map_err(|e| e.to_string())?;

    ensure_profile_libraries(instance_dir, &version_id, app).await?;

    // universal.jar из Maven в libraries/net/neoforged/neoforge/{ver}/.
    let universal_dest = instance_dir
        .join("libraries")
        .join("net/neoforged/neoforge")
        .join(neoforge_version)
        .join(format!("neoforge-{}-universal.jar", neoforge_version));
    if !universal_dest.exists() {
        std::fs::create_dir_all(universal_dest.parent().unwrap()).ok();
        let url = format!(
            "https://maven.neoforged.net/releases/net/neoforged/neoforge/{}/neoforge-{}-universal.jar",
            neoforge_version, neoforge_version
        );
        emit(app, "neoforge-universal.jar");
        download_file(&url, &universal_dest, app)
            .await
            .map_err(|e| format!("neoforge universal: {}", e))?;
    }
    patch_universal_manifest(&universal_dest, neoforge_version, &version_id);

    Ok(version_id)
}

pub async fn list_versions(mc_version: &str) -> Result<Vec<String>, String> {
    if !is_supported(mc_version) {
        return Ok(Vec::new());
    }
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("http: {}", e))?;
    let resp = client
        .get("https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge")
        .send()
        .await
        .map_err(|e| format!("versions api: {}", e))?;
    let v: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("versions json: {}", e))?;
    let mut out = Vec::new();
    // Фильтруем под mc_version по префиксу "20.", "21." и т.п.
    let (maj, minor, _patch) = parse_mc_version(mc_version);
    let target_prefix = if maj == 1 {
        format!("{}.", minor)
    } else {
        String::new()
    };
    if let Some(arr) = v.get("versions").and_then(|a| a.as_array()) {
        for ver in arr {
            if let Some(s) = ver.as_str() {
                if s.starts_with(&target_prefix) {
                    out.push(s.to_string());
                }
            }
        }
    }
    Ok(out)
}
