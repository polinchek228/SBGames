//! #4/#5 Общий резолвер для Fabric и Quilt — загрузчиков на базе *meta* API.
//!
//! Оба используют одинаковый протокол:
//!   GET {meta_base}/versions/loader/{mc}            — список loader-версий
//!   GET {meta_base}/versions/loader/{mc}/{l}/profile/json — готовый профиль
//! Библиотеки описаны как {name, url} (Maven), mainClass — KnotClient.

use async_trait::async_trait;
use serde_json::Value;
use std::path::Path;
use tauri::{AppHandle, Emitter};

use crate::download_file;
use crate::DownloadProgress;

use super::{ensure_profile_libraries, Loader};

/// Конфигурация meta-загрузчика. Параметризует общий код для Fabric/Quilt.
pub struct MetaLoaderConfig {
    pub meta_base: &'static str,      // "https://meta.fabricmc.net/v2"
    pub fallback_maven: &'static str, // "https://maven.fabricmc.net/"
    pub id_prefix: &'static str,      // "fabric-loader" / "quilt-loader"
}

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

async fn http_get_json(url: &str) -> Result<Value, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .user_agent("SBGames-Launcher/1.0")
        .build()
        .map_err(|e| format!("http client: {}", e))?;
    let resp = client
        .get(url)
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

/// Установить Fabric/Quilt для данной MC-версии.
///
/// - `loader_version = None` → берётся latest stable из списка.
/// - Профиль сохраняется в versions/{id}/{id}.json (с inheritsFrom: mc_version).
/// - Библиотеки качаются через общий ensure_profile_libraries.
pub async fn install_meta_based(
    cfg: &MetaLoaderConfig,
    mc_version: &str,
    loader_version: Option<&str>,
    instance_dir: &Path,
    app: &AppHandle,
) -> Result<String, String> {
    emit(app, &format!("Поиск версии загрузчика для {}…", mc_version));

    // 1. Резолвим loader-версию.
    let loader = match loader_version {
        Some(v) if !v.is_empty() => v.to_string(),
        _ => {
            let list_url = format!("{}/versions/loader/{}", cfg.meta_base, mc_version);
            let list = http_get_json(&list_url)
                .await
                .map_err(|e| format!("loader list: {}", e))?;
            // Quilt v3 оборачивает в {loader:[...]}, Fabric — массив верхнего уровня.
            let arr = list
                .as_array()
                .cloned()
                .or_else(|| {
                    list.get("loader")
                        .and_then(|l| l.as_array())
                        .cloned()
                })
                .ok_or("loader list: array missing")?;
            let first = arr
                .first()
                .ok_or("loader list empty")?;
            // Fabric: [{loader:{version,stable}},...]. Quilt: похоже.
            first
                .get("loader")
                .and_then(|l| l.get("version"))
                .and_then(|v| v.as_str())
                .or_else(|| first.get("version").and_then(|v| v.as_str()))
                .ok_or("loader version missing")?
                .to_string()
        }
    };

    // 2. Готовый профиль.
    let profile_url = format!(
        "{}/versions/loader/{}/{}/profile/json",
        cfg.meta_base, mc_version, loader
    );
    emit(app, &format!("Профиль {} {}…", cfg.id_prefix, loader));
    let profile = http_get_json(&profile_url)
        .await
        .map_err(|e| format!("profile json: {}", e))?;

    // profile.id обычно "fabric-loader-0.15.7-1.20.1".
    let id = profile
        .get("id")
        .and_then(|i| i.as_str())
        .map(|s| s.to_string())
        .unwrap_or_else(|| format!("{}-{}-{}", cfg.id_prefix, loader, mc_version));

    // Гарантируем inheritsFrom = mc_version (нужно для vanilla-базы).
    let mut profile = profile;
    if profile.get("inheritsFrom").is_none() {
        profile["inheritsFrom"] = Value::String(mc_version.to_string());
    }
    // Подстраховываем mainClass на случай пустого поля.
    if profile
        .get("mainClass")
        .and_then(|m| m.as_str())
        .map(|s| s.is_empty())
        .unwrap_or(true)
    {
        return Err("profile mainClass missing".into());
    }

    // Каждой library без url даём fallback-репозиторий.
    if let Some(libs) = profile.get_mut("libraries").and_then(|l| l.as_array_mut()) {
        for lib in libs {
            let url_empty = lib
                .get("url")
                .and_then(|u| u.as_str())
                .map(|s| s.is_empty())
                .unwrap_or(true);
            if url_empty || lib.get("url").is_none() {
                lib["url"] = Value::String(cfg.fallback_maven.to_string());
            }
        }
    }

    // 3. Сохранить version.json.
    let ver_dir = instance_dir.join("versions").join(&id);
    std::fs::create_dir_all(&ver_dir).map_err(|e| format!("mkdir versions: {}", e))?;
    let text = serde_json::to_string_pretty(&profile)
        .map_err(|e| format!("serialize profile: {}", e))?;
    std::fs::write(ver_dir.join(format!("{}.json", id)), text)
        .map_err(|e| format!("write profile: {}", e))?;

    // 4. Скачать libraries.
    ensure_profile_libraries(instance_dir, &id, app).await?;

    Ok(id)
}

/// Список доступных loader-версий для MC.
pub async fn list_meta_loader_versions(
    cfg: &MetaLoaderConfig,
    mc_version: &str,
) -> Result<Vec<String>, String> {
    let url = format!("{}/versions/loader/{}", cfg.meta_base, mc_version);
    let list = http_get_json(&url).await?;
    let arr = list
        .as_array()
        .cloned()
        .or_else(|| list.get("loader").and_then(|l| l.as_array()).cloned())
        .unwrap_or_default();
    let mut out = Vec::new();
    for item in arr {
        if let Some(v) = item
            .get("loader")
            .and_then(|l| l.get("version"))
            .and_then(|v| v.as_str())
            .or_else(|| item.get("version").and_then(|v| v.as_str()))
        {
            out.push(v.to_string());
        }
    }
    Ok(out)
}

// ─── Тонкие обёртки-загрузчики ────────────────────────────────────────────────

pub const FABRIC_CFG: MetaLoaderConfig = MetaLoaderConfig {
    meta_base: "https://meta.fabricmc.net/v2",
    fallback_maven: "https://maven.fabricmc.net/",
    id_prefix: "fabric-loader",
};

pub const QUILT_CFG: MetaLoaderConfig = MetaLoaderConfig {
    meta_base: "https://meta.quiltmc.org/v3",
    fallback_maven: "https://maven.quiltmc.org/repository/release/",
    id_prefix: "quilt-loader",
};

pub struct FabricLoader;
pub struct QuiltLoader;

#[async_trait]
impl Loader for FabricLoader {
    async fn install(
        &self,
        mc_version: &str,
        loader_version: Option<&str>,
        instance_dir: &Path,
        app: &AppHandle,
    ) -> Result<String, String> {
        install_meta_based(&FABRIC_CFG, mc_version, loader_version, instance_dir, app).await
    }
    async fn list_versions(&self, mc_version: &str) -> Result<Vec<String>, String> {
        list_meta_loader_versions(&FABRIC_CFG, mc_version).await
    }
}

#[async_trait]
impl Loader for QuiltLoader {
    async fn install(
        &self,
        mc_version: &str,
        loader_version: Option<&str>,
        instance_dir: &Path,
        app: &AppHandle,
    ) -> Result<String, String> {
        install_meta_based(&QUILT_CFG, mc_version, loader_version, instance_dir, app).await
    }
    async fn list_versions(&self, mc_version: &str) -> Result<Vec<String>, String> {
        list_meta_loader_versions(&QUILT_CFG, mc_version).await
    }
}
