//! #9 Скачивание модов/ресурспаков/шейдеров в instance/{mods,resourcepacks,shaderpacks}/.
//!
//! Для каждого ModEntry из InstanceConfig:
//!   - локальные (local=true) пропускаются (юзер уже положил .jar),
//!   - если есть готовый download_url — качаем напрямую,
//!   - иначе резолвим последнюю совместимую версию через Modrinth API.

use crate::download_file;
use crate::instance::{InstanceConfig, LoaderKind, ModEntry};
use crate::DownloadProgress;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter};

fn emit(app: &AppHandle, msg: &str, d: u64, t: u64) {
    let _ = app.emit(
        "download_progress",
        DownloadProgress {
            file: msg.to_string(),
            downloaded: d,
            total: t,
            speed_kbs: 0,
        },
    );
}

/// Скачать все моды/ресурсы из cfg.mods в соответствующие папки инстанса.
/// Идемпотентно: существующие файлы пропускаются. Параллельно (8 потоков).
pub async fn sync_mods(
    instance_dir: &Path,
    cfg: &InstanceConfig,
    app: &AppHandle,
) -> Result<(), String> {
    let mods_dir = instance_dir.join("mods");
    let resourcepacks_dir = instance_dir.join("resourcepacks");
    let shaderpacks_dir = instance_dir.join("shaderpacks");
    for d in [&mods_dir, &resourcepacks_dir, &shaderpacks_dir] {
        std::fs::create_dir_all(d).map_err(|e| format!("mkdir {}: {}", d.display(), e))?;
    }

    // Удалить чужие .jar в mods/, которых нет в списке (по имени файла).
    let keep_names: std::collections::HashSet<String> = cfg
        .mods
        .iter()
        .filter(|m| m.kind == "mods")
        .filter_map(|m| m.filename.clone())
        .collect();
    cleanup_extra_jars(&mods_dir, &keep_names);

    let total = cfg.mods.len();
    let dirs = [mods_dir.clone(), resourcepacks_dir, shaderpacks_dir];

    // Фильтруем: пропускаем локальные и уже скачанные.
    let pending: Vec<ModEntry> = cfg.mods.iter().filter(|item| {
        if item.local { return false; }
        let dest = dest_for_kind(item, &[dirs[0].as_path(), dirs[1].as_path(), dirs[2].as_path()]);
        !dest.exists()
    }).cloned().collect();

    let to_download = pending.len();
    if to_download == 0 {
        emit(app, "Моды синхронизированы", total as u64, total as u64);
        return Ok(());
    }
    emit(app, &format!("Моды ({}/{} новых)", to_download, total), 0, total as u64);

    use futures_util::stream::{self, StreamExt};
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::sync::Arc;
    let done = Arc::new(AtomicU64::new(0));

    stream::iter(pending)
        .map(|item| {
            let dirs_ref: [&Path; 3] = [&dirs[0], &dirs[1], &dirs[2]];
            let app = app.clone();
            let done = done.clone();
            async move {
                if let Err(e) = sync_one(&item, cfg, &dirs_ref, &app).await {
                    eprintln!("[mods] skip {}: {}", item.title, e);
                }
                let count = done.fetch_add(1, Ordering::Relaxed) + 1;
                let _ = app.emit("download_progress", crate::DownloadProgress {
                    file: format!("Моды: {}/{}", count, to_download),
                    downloaded: count,
                    total: total as u64,
                    speed_kbs: 0,
                });
            }
        })
        .buffer_unordered(8)
        .for_each(|_| async {})
        .await;

    emit(app, "Моды синхронизированы", total as u64, total as u64);
    Ok(())
}

fn cleanup_extra_jars(dir: &Path, keep: &std::collections::HashSet<String>) {
    if let Ok(rd) = std::fs::read_dir(dir) {
        for entry in rd.flatten() {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) != Some("jar") {
                continue;
            }
            let name = match path.file_name().and_then(|n| n.to_str()) {
                Some(n) => n.to_string(),
                None => continue,
            };
            // disabled mods (.jar.disabled) не трогаем.
            if name.ends_with(".disabled") {
                continue;
            }
            if !keep.contains(&name) {
                let _ = std::fs::remove_file(&path);
            }
        }
    }
}

fn dest_for_kind(item: &ModEntry, dirs: &[&Path]) -> PathBuf {
    let dir = match item.kind.as_str() {
        "resourcepacks" | "resourcepack" => dirs.get(1).copied().unwrap_or(dirs[0]),
        "shaderpacks" | "shaderpack" | "shaders" => dirs.get(2).copied().unwrap_or(dirs[0]),
        _ => dirs[0], // mods
    };
    let fname = item
        .filename
        .clone()
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| fallback_filename(item));
    dir.join(fname)
}

fn fallback_filename(item: &ModEntry) -> String {
    let base = if !item.slug.is_empty() {
        item.slug.clone()
    } else if !item.project_id.is_empty() {
        item.project_id.clone()
    } else {
        "mod".to_string()
    };
    let ver = item.version.clone().unwrap_or_else(|| "0".to_string());
    format!("{}-{}.jar", base, ver)
}

async fn sync_one(
    item: &ModEntry,
    cfg: &InstanceConfig,
    dirs: &[&Path],
    app: &AppHandle,
) -> Result<(), String> {
    if item.local {
        return Ok(()); // уже лежит в инстансе.
    }
    let dest = dest_for_kind(item, dirs);
    if dest.exists() {
        return Ok(());
    }
    std::fs::create_dir_all(dest.parent().unwrap()).ok();

    let url = if let Some(u) = &item.download_url {
        u.clone()
    } else {
        resolve_modrinth_version(&item.project_id, &cfg.mc_version, &cfg.loader).await?
    };

    let label = dest
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("mod")
        .to_string();
    emit(app, &label, 0, 1);
    download_file(&url, &dest, app)
        .await
        .map_err(|e| format!("{}: {}", label, e))?;
    Ok(())
}

/// Резолв URL последней совместимой версии файла через Modrinth API.
pub async fn resolve_modrinth_version(
    project_id: &str,
    mc_version: &str,
    loader: &LoaderKind,
) -> Result<String, String> {
    let loader_str = loader.as_modrinth().ok_or("vanilla не поддерживает моды")?;
    let url = format!(
        "https://api.modrinth.com/v2/project/{}/version?loaders=[\"{}\"]&game_versions=[\"{}\"]",
        project_id, loader_str, mc_version
    );
    let client = crate::SHARED_CLIENT.get()
        .ok_or("HTTP client not initialized")?;
    let resp = client
        .get(&url)
        .header("User-Agent", "SBGames-Launcher/1.0")
        .send()
        .await
        .map_err(|e| format!("modrinth: {}", e))?;
    if !resp.status().is_success() {
        return Err(format!("modrinth: HTTP {}", resp.status()));
    }
    let versions: Vec<serde_json::Value> = resp
        .json()
        .await
        .map_err(|e| format!("modrinth json: {}", e))?;
    let first = versions.first().ok_or("no compatible version")?;
    let files = first
        .get("files")
        .and_then(|f| f.as_array())
        .ok_or("files[] missing")?;
    // primary-файл, иначе первый.
    let file = files
        .iter()
        .find(|f| f.get("primary").and_then(|p| p.as_bool()).unwrap_or(false))
        .or_else(|| files.first())
        .ok_or("no file in version")?;
    let url = file
        .get("url")
        .and_then(|u| u.as_str())
        .ok_or("file url missing")?;
    Ok(url.to_string())
}

/// Обёртка-команда: получить список версий мода под MC+loader (для UI).
#[tauri::command]
pub async fn mod_versions(
    project_id: String,
    mc_version: String,
    loader: String,
) -> Result<Vec<serde_json::Value>, String> {
    let url = format!(
        "https://api.modrinth.com/v2/project/{}/version?loaders=[\"{}\"]&game_versions=[\"{}\"]",
        project_id, loader, mc_version
    );
    let client = crate::SHARED_CLIENT.get()
        .ok_or("HTTP client not initialized")?;
    let resp = client
        .get(&url)
        .header("User-Agent", "SBGames-Launcher/1.0")
        .send()
        .await
        .map_err(|e| format!("modrinth: {}", e))?;
    if !resp.status().is_success() {
        return Err(format!("modrinth: HTTP {}", resp.status()));
    }
    resp.json()
        .await
        .map_err(|e| format!("modrinth json: {}", e))
}
