//! #7 Vanilla loader — установка чистого клиента Minecraft.
//!
//! Качает version_manifest_v2.json, находит нужную версию, тянет client.jar,
//! libraries[] (с учётом OS rules + native classifiers), assetIndex и все
//! объекты ассетов. Профиль сохраняется в versions/{mc}/{mc}.json, чтобы на него
//! могли ссылаться загрузчики через inheritsFrom.

use async_trait::async_trait;
use serde_json::Value;
use sha1::{Digest, Sha1};
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter};

use crate::download_file;
use crate::DownloadProgress;

use super::{ensure_profile_libraries, Loader};

const MANIFEST_URL: &str = "https://launchermeta.mojang.com/mc/game/version_manifest_v2.json";

pub struct VanillaLoader;

fn emit(app: &AppHandle, file: &str, downloaded: u64, total: u64) {
    let _ = app.emit(
        "download_progress",
        DownloadProgress {
            file: file.to_string(),
            downloaded,
            total,
            speed_kbs: 0,
        },
    );
}

/// HTTP GET JSON через общий HTTP-клиент (HTTP/2 + keep-alive).
async fn http_get_json(url: &str) -> Result<Value, String> {
    let client = crate::SHARED_CLIENT.get()
        .ok_or("HTTP client not initialized")?;
    let resp = client
        .get(url)
        .header("User-Agent", "SBGames-Launcher/1.0")
        .send()
        .await
        .map_err(|e| format!("GET {}: {}", url, e))?;
    if !resp.status().is_success() {
        return Err(format!("GET {}: HTTP {}", url, resp.status()));
    }
    resp.json()
        .await
        .map_err(|e| format!("json {}: {}", url, e))
}

/// Установить ванильный клиент указанной версии в instance_dir.
/// Идемпотентно: не перекачивает существующее.
pub async fn ensure(mc_version: &str, instance_dir: &Path, app: &AppHandle) -> Result<String, String> {
    let versions_dir = instance_dir.join("versions");
    let ver_dir = versions_dir.join(mc_version);
    std::fs::create_dir_all(&ver_dir).map_err(|e| format!("mkdir versions: {}", e))?;

    let client_jar = ver_dir.join(format!("{}.jar", mc_version));
    let json_path = ver_dir.join(format!("{}.json", mc_version));

    // 1. version.json: либо уже скачан, либо тянем через manifest.
    if !json_path.exists() {
        emit(app, "Mojang manifest…", 0, 1);
        let manifest = http_get_json(MANIFEST_URL).await?;
        let url = manifest
            .get("versions")
            .and_then(|v| v.as_array())
            .and_then(|arr| {
                arr.iter()
                    .find(|v| v.get("id").and_then(|i| i.as_str()) == Some(mc_version))
            })
            .and_then(|v| v.get("url").and_then(|u| u.as_str()).map(String::from))
            .ok_or_else(|| format!("version {} not in manifest", mc_version))?;
        download_file(&url, &json_path, app)
            .await
            .map_err(|e| format!("version.json: {}", e))?;
    }

    let ver_text = std::fs::read_to_string(&json_path)
        .map_err(|e| format!("read version.json: {}", e))?;
    let ver: Value = serde_json::from_str(&ver_text)
        .map_err(|e| format!("parse version.json: {}", e))?;

    // 2. client.jar.
    if !client_jar.exists() {
        let client_url = ver
            .get("downloads")
            .and_then(|d| d.get("client"))
            .and_then(|c| c.get("url"))
            .and_then(|u| u.as_str())
            .ok_or("client.url missing")?;
        emit(app, &format!("minecraft-{}-client.jar", mc_version), 0, 1);
        download_file(client_url, &client_jar, app)
            .await
            .map_err(|e| format!("client.jar: {}", e))?;
    }

    // 3. libraries + assets ПАРАЛЛЕЛЬНО (независимы друг от друга).
    let (lib_result, asset_result) = tokio::join!(
        ensure_profile_libraries(instance_dir, mc_version, app),
        ensure_assets(instance_dir, &ver, app)
    );
    lib_result?;
    asset_result?;

    Ok(mc_version.to_string())
}

/// Скачать assetIndex + все объекты по sha1 (параллельно).
async fn ensure_assets(instance_dir: &Path, ver: &Value, app: &AppHandle) -> Result<(), String> {
    let assets_root = instance_dir.join("assets");
    let objects = assets_root.join("objects");
    let indexes = assets_root.join("indexes");
    std::fs::create_dir_all(&objects).ok();
    std::fs::create_dir_all(&indexes).ok();

    let ai = match ver.get("assetIndex") {
        Some(ai) => ai,
        None => return Ok(()),
    };
    let index_id = ai.get("id").and_then(|i| i.as_str()).unwrap_or("legacy");
    let index_url = ai.get("url").and_then(|u| u.as_str()).unwrap_or("");
    let index_path = indexes.join(format!("{}.json", index_id));

    if !index_path.exists() && !index_url.is_empty() {
        download_file(index_url, &index_path, app).await.ok();
    }
    let index_text = match std::fs::read_to_string(&index_path) {
        Ok(t) => t,
        Err(_) => return Ok(()),
    };
    let index: Value = match serde_json::from_str(&index_text) {
        Ok(v) => v,
        Err(_) => return Ok(()),
    };

    let objs = match index.get("objects").and_then(|o| o.as_object()) {
        Some(o) => o,
        None => return Ok(()),
    };

    // Собираем задачи: пропускаем уже скачанные.
    let tasks: Vec<(String, PathBuf, String)> = objs.iter().filter_map(|(_name, info)| {
        let hash = info.get("hash")?.as_str()?;
        if hash.len() < 2 { return None; }
        let first2 = &hash[..2];
        let dest = objects.join(first2).join(hash);
        if dest.exists() { return None; }
        let url = format!("https://resources.download.minecraft.net/{}/{}", first2, hash);
        Some((hash.to_string(), dest, url))
    }).collect();

    let total = objs.len();
    let to_download = tasks.len();
    if to_download == 0 {
        emit(app, "Ассеты готовы", total as u64, total as u64);
        return Ok(());
    }
    emit(app, &format!("Ассеты ({}/{} файлов)", to_download, total), 0, total as u64);

    use futures_util::stream::{self, StreamExt};
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::sync::Arc;
    let done = Arc::new(AtomicU64::new(0));

    stream::iter(tasks)
        .map(|(hash, dest, url)| {
            let done = done.clone();
            let app = app.clone();
            async move {
                std::fs::create_dir_all(dest.parent().unwrap()).ok();
                if let Err(e) = download_file(&url, &dest, &app).await {
                    eprintln!("[asset] {} fail: {}", hash, e);
                } else {
                    if let Ok(actual) = sha1_of_file(&dest) {
                        if actual != hash {
                            let _ = std::fs::remove_file(&dest);
                        }
                    }
                }
                let count = done.fetch_add(1, Ordering::Relaxed) + 1;
                if count % 50 == 0 || count == to_download as u64 {
                    let _ = app.emit("download_progress", crate::DownloadProgress {
                        file: format!("Ассеты: {}/{}", count, to_download),
                        downloaded: count,
                        total: total as u64,
                        speed_kbs: 0,
                    });
                }
            }
        })
        .buffer_unordered(16)
        .for_each(|_| async {})
        .await;

    emit(app, "Ассеты готовы", total as u64, total as u64);
    Ok(())
}

fn sha1_of_file(path: &PathBuf) -> Result<String, String> {
    let mut f = std::fs::File::open(path).map_err(|e| e.to_string())?;
    let mut hasher = Sha1::new();
    let mut buf = [0u8; 65536];
    use std::io::Read;
    loop {
        let n = f.read(&mut buf).map_err(|e| e.to_string())?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }
    Ok(hex::encode(hasher.finalize()))
}

#[async_trait]
impl Loader for VanillaLoader {
    async fn install(
        &self,
        mc_version: &str,
        _loader_version: Option<&str>,
        instance_dir: &Path,
        app: &AppHandle,
    ) -> Result<String, String> {
        ensure(mc_version, instance_dir, app).await
    }

    async fn list_versions(&self, _mc_version: &str) -> Result<Vec<String>, String> {
        let m = http_get_json(MANIFEST_URL).await?;
        let mut out = Vec::new();
        if let Some(arr) = m.get("versions").and_then(|v| v.as_array()) {
            for v in arr {
                if let Some(id) = v.get("id").and_then(|i| i.as_str()) {
                    if v.get("type").and_then(|t| t.as_str()) == Some("release") {
                        out.push(id.to_string());
                    }
                }
            }
        }
        Ok(out)
    }
}
