//! #7 Общий интерфейс загрузчиков + резолв inheritsFrom.
//!
//! Каждый загрузчик (vanilla/forge/fabric/...) реализует `Loader::install`, который
//! кладёт `versions/{id}/{id}.json` + необходимые libraries в instance_dir.
//! Перед запуском `merge_profile` разворачивает цепочку `inheritsFrom` в единый
//! `MergedProfile`, а `resolve_placeholders` подставляет переменные args.

pub mod fabric;
pub mod forge;
pub mod meta_based;
pub mod neoforge;
pub mod quilt;
pub mod vanilla;

use async_trait::async_trait;
use serde_json::Value;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter};

use crate::download_file;
use crate::instance::{LoaderKind, ModEntry};
use crate::DownloadProgress;

#[async_trait]
pub trait Loader {
    /// Установить загрузчик (скачать libraries, version.json и т.п.).
    /// Возвращает version_id, под которым профиль сохранён в versions/.
    async fn install(
        &self,
        mc_version: &str,
        loader_version: Option<&str>,
        instance_dir: &Path,
        app: &AppHandle,
    ) -> Result<String, String>;

    /// Список доступных версий загрузчика для данной MC-версии.
    async fn list_versions(&self, mc_version: &str) -> Result<Vec<String>, String>;
}

/// Развёрнутый профиль, готовый к запуску JVM.
#[derive(Debug, Clone)]
pub struct MergedProfile {
    /// Абсолютные пути к jar в instance/libraries/ (порядок важен — classpath).
    pub libraries: Vec<PathBuf>,
    /// Распакованные natives (добавляются в -Djava.library.path / classpath).
    pub natives: Vec<PathBuf>,
    pub main_class: String,
    /// JVM args (новый формат arguments.jvm[] с уже подставленным ... где возможно).
    pub jvm_args: Vec<String>,
    /// Game args (новый формат arguments.game[]).
    pub game_args: Vec<String>,
    pub asset_index: String,
    pub asset_index_url: String,
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

/// Читает versions/{id}/{id}.json, рекурсивно поднимает родителей по `inheritsFrom`
/// и сливает всё в один `MergedProfile`. Libraries родителей добавляются в конец
/// (приоритет у загрузчика), mainClass берётся из дочернего, args конкатенируются.
pub fn merge_profile(instance_dir: &Path, version_id: &str) -> Result<MergedProfile, String> {
    // Цепочка профилей: [дочерний, родитель, ...]. Дочерний — первый.
    let mut chain: Vec<Value> = Vec::new();
    let mut cur_id = version_id.to_string();
    let mut guard = 0u8;
    loop {
        guard += 1;
        if guard > 8 {
            return Err("inheritsFrom chain too deep".to_string());
        }
        let path = instance_dir
            .join("versions")
            .join(&cur_id)
            .join(format!("{}.json", cur_id));
        let text = std::fs::read_to_string(&path)
            .map_err(|e| format!("read {}: {}", path.display(), e))?;
        let v: Value =
            serde_json::from_str(&text).map_err(|e| format!("parse {}: {}", path.display(), e))?;
        let parent = v.get("inheritsFrom").and_then(|p| p.as_str()).map(String::from);
        chain.push(v);
        match parent {
            Some(p) if !p.is_empty() => {
                cur_id = p;
            }
            _ => break,
        }
    }

    // Дочерний — chain[0], самый верхний родитель (vanilla) — chain.last().
    // Сливаем в порядке «снизу вверх по цепочке»: сначала libraries родителя,
    // потом перекрываем/добавляем дочерние — но в classpath дочерние идут ПЕРВЫМИ.
    // Поэтому собираем libraries так: проходим от самого дочернего к родителю,
    // каждый список ставим перед предыдущим.
    let libs_dir = instance_dir.join("libraries");
    let natives_dir = instance_dir.join("natives");
    std::fs::create_dir_all(&natives_dir).ok();

    let our_os = if cfg!(target_os = "windows") {
        "windows"
    } else if cfg!(target_os = "macos") {
        "osx"
    } else {
        "linux"
    };

    let mut libraries: Vec<PathBuf> = Vec::new();
    let mut natives: Vec<PathBuf> = Vec::new();
    let mut seen_libs: std::collections::HashSet<String> = std::collections::HashSet::new();

    // Проходим от самого дочернего (приоритет) к самому верхнему.
    for prof in chain.iter() {
        if let Some(arr) = prof.get("libraries").and_then(|l| l.as_array()) {
            // Дочерние libs добавляем В НАЧАЛО (приоритет в classpath).
            let mut front: Vec<PathBuf> = Vec::new();
            for lib in arr {
                if !lib_allowed_for_os(lib, our_os) {
                    continue;
                }
                if let Some((artifact_path, native_path)) = lib_paths(lib, our_os, &libs_dir) {
                    if seen_libs.insert(artifact_path.to_string_lossy().to_lowercase()) {
                        front.push(artifact_path);
                    }
                    if let Some(np) = native_path {
                        natives.push(np);
                    }
                }
            }
            // front — приоритетные, ставим перед уже собранными.
            let mut combined = front;
            combined.append(&mut libraries);
            libraries = combined;
        }
    }

    // mainClass — из самого дочернего.
    let main_class = chain[0]
        .get("mainClass")
        .and_then(|m| m.as_str())
        .unwrap_or("net.minecraft.client.main.Main")
        .to_string();

    // arguments: новый формат arguments.{jvm,game}[] конкатенируем (родитель + дочерний).
    // Старый формат minecraftArguments — берём из дочернего (vanilla 1.12 и ниже).
    let mut jvm_args: Vec<String> = Vec::new();
    let mut game_args: Vec<String> = Vec::new();

    // Сначала родительские (vanilla), потом дочерние — такForge/Fabric добавки идут после.
    for prof in chain.iter().rev() {
        if let Some(jvm) = prof.get("arguments").and_then(|a| a.get("jvm")).and_then(|j| j.as_array())
        {
            for a in jvm {
                if let Some(s) = a.as_str() {
                    jvm_args.push(s.to_string());
                } else if let Some(obj) = a.as_object() {
                    // {rules:[...], value:"..."} — простая проверка rules.
                    if obj_rules_ok(obj, our_os) {
                        if let Some(val) = obj.get("value") {
                            if let Some(s) = val.as_str() {
                                jvm_args.push(s.to_string());
                            } else if let Some(arr) = val.as_array() {
                                for v in arr {
                                    if let Some(s) = v.as_str() {
                                        jvm_args.push(s.to_string());
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    for prof in chain.iter().rev() {
        if let Some(game) = prof
            .get("arguments")
            .and_then(|a| a.get("game"))
            .and_then(|g| g.as_array())
        {
            for a in game {
                if let Some(s) = a.as_str() {
                    game_args.push(s.to_string());
                } else if let Some(obj) = a.as_object() {
                    if obj_rules_ok(obj, our_os) {
                        if let Some(val) = obj.get("value") {
                            if let Some(s) = val.as_str() {
                                game_args.push(s.to_string());
                            } else if let Some(arr) = val.as_array() {
                                for v in arr {
                                    if let Some(s) = v.as_str() {
                                        game_args.push(s.to_string());
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        // Старый формат (vanilla ≤ 1.12) — единой строкой через пробел.
        if jvm_args.is_empty() {
            if let Some(old) = prof.get("minecraftArguments").and_then(|m| m.as_str()) {
                game_args = old.split_whitespace().map(String::from).collect();
            }
        }
    }

    // assetIndex — из любого профиля цепочки, где он есть (обычно vanilla).
    let mut asset_index = String::new();
    let mut asset_index_url = String::new();
    for prof in chain.iter() {
        if asset_index.is_empty() {
            if let Some(ai) = prof.get("assetIndex") {
                if let Some(id) = ai.get("id").and_then(|i| i.as_str()) {
                    asset_index = id.to_string();
                }
                if let Some(u) = ai.get("url").and_then(|u| u.as_str()) {
                    asset_index_url = u.to_string();
                }
            }
        }
        if asset_index.is_empty() {
            if let Some(id) = prof.get("assets").and_then(|a| a.as_str()) {
                asset_index = id.to_string();
            }
        }
    }

    Ok(MergedProfile {
        libraries,
        natives,
        main_class,
        jvm_args,
        game_args,
        asset_index,
        asset_index_url,
    })
}

/// Проверка rules для всего library-объекта (старый формат Mojang).
fn lib_allowed_for_os(lib: &Value, our_os: &str) -> bool {
    match lib.get("rules").and_then(|r| r.as_array()) {
        None => true,
        Some(rules) => {
            let mut allowed = false;
            for r in rules {
                let action = r.get("action").and_then(|a| a.as_str()).unwrap_or("");
                let os_name = r.get("os").and_then(|o| o.get("name")).and_then(|n| n.as_str()).unwrap_or("");
                if action == "allow" {
                    allowed = os_name.is_empty() || os_name == our_os;
                } else if action == "disallow" {
                    if os_name == our_os {
                        allowed = false;
                    }
                }
            }
            allowed
        }
    }
}

/// Проверка rules внутри {value:..., rules:[...]} объектов arguments.
fn obj_rules_ok(obj: &serde_json::Map<String, Value>, our_os: &str) -> bool {
    match obj.get("rules").and_then(|r| r.as_array()) {
        None => true,
        Some(rules) => {
            let mut allowed = true;
            for r in rules {
                let action = r.get("action").and_then(|a| a.as_str()).unwrap_or("");
                let os_name = r.get("os").and_then(|o| o.get("name")).and_then(|n| n.as_str()).unwrap_or("");
                if action == "allow" {
                    if os_name.is_empty() || os_name == our_os {
                        allowed = true;
                    } else {
                        allowed = false;
                    }
                } else if action == "disallow" && os_name == our_os {
                    allowed = false;
                }
            }
            allowed
        }
    }
}

/// Из library-объекта достаём (artifact_path, Option<native_path>).
/// Поддерживает оба формата: downloads.artifact (Mojang) и name+url (Fabric/Forge).
fn lib_paths(lib: &Value, our_os: &str, libs_dir: &Path) -> Option<(PathBuf, Option<PathBuf>)> {
    let artifact_path = if let Some(art) = lib.get("downloads").and_then(|d| d.get("artifact")) {
        art.get("path").and_then(|p| p.as_str())?.to_string()
    } else if let Some(name) = lib.get("name").and_then(|n| n.as_str()) {
        maven_name_to_path(name)
    } else {
        return None;
    };

    let artifact = libs_dir.join(&artifact_path);

    // Natives: classic classifiers.
    let native = lib.get("natives").and_then(|n| n.get(our_os)).and_then(|v| v.as_str());
    let native_path = if let Some(classifier_tmpl) = native {
        let classifier = classifier_tmpl
            .replace("${arch}", "64")
            .replace("$", "");
        // Путь к native либо в downloads.classifiers[classifier], либо maven.
        if let Some(cl) = lib
            .get("downloads")
            .and_then(|d| d.get("classifiers"))
            .and_then(|c| c.get(&classifier))
        {
            cl.get("path").and_then(|p| p.as_str()).map(|p| libs_dir.join(p))
        } else if let Some(name) = lib.get("name").and_then(|n| n.as_str()) {
            let base = maven_name_to_path_base(name);
            let version = name.split(':').nth(2).unwrap_or("");
            let fname = format!(
                "{}-{}-{}.jar",
                name.split(':').nth(1).unwrap_or("lib"),
                version,
                classifier
            );
            Some(libs_dir.join(base).join(fname))
        } else {
            None
        }
    } else {
        None
    };

    Some((artifact, native_path))
}

/// "org.foo:bar:1.0" -> "org/foo/bar/1.0/bar-1.0.jar"
pub fn maven_name_to_path(name: &str) -> String {
    let parts: Vec<&str> = name.split(':').collect();
    if parts.len() < 3 {
        return name.to_string();
    }
    let group = parts[0].replace('.', "/");
    let artifact = parts[1];
    let version = parts[2];
    // classifier может быть в 4-й части.
    let classifier = if parts.len() >= 4 {
        format!("-{}", parts[3])
    } else {
        String::new()
    };
    format!(
        "{}/{}/{}/{}-{}{}.jar",
        group, artifact, version, artifact, version, classifier
    )
}

/// Только директория: "org.foo:bar:1.0" -> "org/foo/bar/1.0"
fn maven_name_to_path_base(name: &str) -> String {
    let parts: Vec<&str> = name.split(':').collect();
    if parts.len() < 3 {
        return name.to_string();
    }
    format!("{}/{}/{}", parts[0].replace('.', "/"), parts[1], parts[2])
}

/// Скачать все library-jar'ы из профилей цепочки inheritsFrom, если их ещё нет.
/// Вызывается загрузчиками после записи version.json, чтобы vanilla-база тоже была.
pub async fn ensure_profile_libraries(
    instance_dir: &Path,
    version_id: &str,
    app: &AppHandle,
) -> Result<(), String> {
    emit(app, "Проверка библиотек профиля…");
    let libs_dir = instance_dir.join("libraries");
    std::fs::create_dir_all(&libs_dir).map_err(|e| format!("mkdir libraries: {}", e))?;

    let our_os = if cfg!(target_os = "windows") {
        "windows"
    } else if cfg!(target_os = "macos") {
        "osx"
    } else {
        "linux"
    };

    // Собираем все library-объекты из цепочки.
    let mut all: Vec<Value> = Vec::new();
    let mut cur = version_id.to_string();
    let mut guard = 0u8;
    loop {
        guard += 1;
        if guard > 8 {
            break;
        }
        let path = instance_dir
            .join("versions")
            .join(&cur)
            .join(format!("{}.json", cur));
        let text = match std::fs::read_to_string(&path) {
            Ok(t) => t,
            Err(_) => break,
        };
        let v: Value = match serde_json::from_str(&text) {
            Ok(v) => v,
            Err(_) => break,
        };
        if let Some(arr) = v.get("libraries").and_then(|l| l.as_array()).cloned() {
            all.extend(arr);
        }
        match v.get("inheritsFrom").and_then(|p| p.as_str()).map(String::from) {
            Some(p) if !p.is_empty() => cur = p,
            _ => break,
        }
    }

    let total = all.len();
    for (i, lib) in all.iter().enumerate() {
        if !lib_allowed_for_os(lib, our_os) {
            continue;
        }
        if let Err(e) = ensure_one_library(lib, our_os, &libs_dir, app).await {
            eprintln!("[ensure_profile_libraries] skip lib: {}", e);
        }
        if i % 5 == 0 {
            let _ = app.emit(
                "download_progress",
                DownloadProgress {
                    file: format!("Библиотеки: {}/{}", i, total),
                    downloaded: i as u64,
                    total: total as u64,
                    speed_kbs: 0,
                },
            );
        }
    }
    Ok(())
}

/// Скачать одну library (artifact + native classifiers), если отсутствует.
async fn ensure_one_library(
    lib: &Value,
    our_os: &str,
    libs_dir: &Path,
    app: &AppHandle,
) -> Result<(), String> {
    // 1. downloads.artifact (Mojang-формат).
    if let Some(art) = lib.get("downloads").and_then(|d| d.get("artifact")) {
        let path = art.get("path").and_then(|p| p.as_str()).unwrap_or("");
        let url = art.get("url").and_then(|u| u.as_str()).unwrap_or("");
        if !path.is_empty() && !url.is_empty() {
            let dest = libs_dir.join(path);
            if !dest.exists() {
                std::fs::create_dir_all(dest.parent().unwrap()).ok();
                let _ = download_file(url, &dest, app).await;
            }
        }
    } else if let (Some(name), Some(url)) = (
        lib.get("name").and_then(|n| n.as_str()),
        lib.get("url").and_then(|u| u.as_str()).filter(|u| !u.is_empty()),
    ) {
        // 2. name + url (Fabric/Quilt/Forge maven).
        let rel = maven_name_to_path(name);
        let dest = libs_dir.join(&rel);
        if !dest.exists() {
            std::fs::create_dir_all(dest.parent().unwrap()).ok();
            let full = format!("{}/{}", url.trim_end_matches('/'), rel);
            let _ = download_file(&full, &dest, app).await;
        }
    }

    // 3. Native classifiers.
    if let Some(classifier_tmpl) = lib
        .get("natives")
        .and_then(|n| n.get(our_os))
        .and_then(|v| v.as_str())
    {
        let classifier = classifier_tmpl.replace("${arch}", "64").replace('$', "");
        if let Some(cl) = lib
            .get("downloads")
            .and_then(|d| d.get("classifiers"))
            .and_then(|c| c.get(&classifier))
        {
            let path = cl.get("path").and_then(|p| p.as_str()).unwrap_or("");
            let url = cl.get("url").and_then(|u| u.as_str()).unwrap_or("");
            if !path.is_empty() && !url.is_empty() {
                let dest = libs_dir.join(path);
                if !dest.exists() {
                    std::fs::create_dir_all(dest.parent().unwrap()).ok();
                    let _ = download_file(url, &dest, app).await;
                }
            }
        }
    }
    Ok(())
}

/// Проверить, поддерживает ли загрузчик моды (vanilla — нет).
pub fn supports_mods(loader: &LoaderKind) -> bool {
    !matches!(loader, LoaderKind::Vanilla)
}

/// Игнор unused — для API, который использует внешние вызовы.
#[allow(dead_code)]
fn _touch(_: &ModEntry) {}
