//! #3 Forge loader — установка MinecraftForge.
//!
//! Три ветки по версиям MC:
//!   - new (1.18+):   version.json лежит прямо в installer.jar — извлекаем,
//!                    libraries качаем, universal.jar тащим с Maven.
//!   - legacy (1.7-1.12.2): installer.jar содержит старый install_profile.json
//!                    с versionInfo + universal.jar в корне zip.
//!   - modern (1.13-1.17):  запуск headless `java -jar installer.jar --installClient`.
//!
//! Гарантии для 1.18+ (из lib.rs::install_forge_from_zip):
//!   - патч MANIFEST.MF universal.jar с Implementation-Version,
//!   - разделение module-path / classpath,
//!   - --add-opens, -DignoreList, -DmergeModules.

use crate::instance::parse_mc_version;
use crate::loaders::ensure_profile_libraries;
use crate::{download_file, DownloadProgress};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter};

pub struct ForgeLoader;

fn emit(app: &AppHandle, file: &str, d: u64, t: u64) {
    let _ = app.emit(
        "download_progress",
        DownloadProgress {
            file: file.to_string(),
            downloaded: d,
            total: t,
            speed_kbs: 0,
        },
    );
}

/// Главная точка: ставит Forge под указанную MC + forge_version (напр. "47.4.10").
pub async fn install_forge(
    mc_version: &str,
    forge_version: &str,
    instance_dir: &Path,
    app: &AppHandle,
) -> Result<String, String> {
    let (_maj, minor, _patch) = parse_mc_version(mc_version);
    // Версии < 1.13 — legacy. 1.13–1.17 — modern (headless installer).
    // 1.18+ — new (извлечение из zip).
    if minor <= 12 {
        install_forge_legacy(mc_version, forge_version, instance_dir, app).await
    } else if minor <= 17 {
        install_forge_modern(mc_version, forge_version, instance_dir, app).await
    } else {
        install_forge_new(mc_version, forge_version, instance_dir, app).await
    }
}

/// Скачать installer.jar с Maven в кэш instance/.cache/forge/.
async fn download_installer(
    mc_version: &str,
    forge_version: &str,
    instance_dir: &Path,
    app: &AppHandle,
) -> Result<PathBuf, String> {
    let cache_dir = instance_dir.join(".cache").join("forge");
    std::fs::create_dir_all(&cache_dir).map_err(|e| format!("mkdir cache: {}", e))?;
    let fname = format!("forge-{}-{}-installer.jar", mc_version, forge_version);
    let path = cache_dir.join(&fname);
    if path.exists() {
        return Ok(path);
    }
    let url = format!(
        "https://maven.minecraftforge.net/net/minecraftforge/forge/{}-{}/{}",
        mc_version, forge_version, fname
    );
    emit(app, &fname, 0, 1);
    download_file(&url, &path, app)
        .await
        .map_err(|e| format!("forge installer: {}", e))?;
    Ok(path)
}

/// Скачать universal.jar с Maven (нужно для new и legacy fallback).
async fn download_universal(
    mc_version: &str,
    forge_version: &str,
    dest: &Path,
    app: &AppHandle,
) -> Result<(), String> {
    let url = format!(
        "https://maven.minecraftforge.net/net/minecraftforge/forge/{}-{}/forge-{}-{}-universal.jar",
        mc_version, forge_version, mc_version, forge_version
    );
    emit(app, "forge-universal.jar", 0, 1);
    std::fs::create_dir_all(dest.parent().unwrap()).ok();
    download_file(&url, dest, app)
        .await
        .map_err(|e| format!("forge universal: {}", e))?;
    Ok(())
}

// ─── NEW: 1.18+ ───────────────────────────────────────────────────────────────

async fn install_forge_new(
    mc_version: &str,
    forge_version: &str,
    instance_dir: &Path,
    app: &AppHandle,
) -> Result<String, String> {
    let installer = download_installer(mc_version, forge_version, instance_dir, app).await?;

    // Читаем version.json прямо из installer.jar.
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
        .ok_or("id missing in version.json")?
        .to_string();

    // Записать profile в versions/{id}/{id}.json.
    let ver_dir = instance_dir.join("versions").join(&version_id);
    std::fs::create_dir_all(&ver_dir).map_err(|e| format!("mkdir versions: {}", e))?;
    std::fs::write(ver_dir.join(format!("{}.json", version_id)), &version_json_str)
        .map_err(|e| e.to_string())?;

    // Скачать libraries (Forge + vanilla через inheritsFrom).
    ensure_profile_libraries(instance_dir, &version_id, app).await?;

    // Universal jar: сначала ищем внутри installer.zip, иначе качаем с Maven.
    let universal_dest = instance_dir
        .join("libraries")
        .join("net/minecraftforge/forge")
        .join(&version_id)
        .join(format!("{}.jar", version_id));
    std::fs::create_dir_all(universal_dest.parent().unwrap()).ok();

    let mut found_in_zip = false;
    // Сначала найдём индекс нужной записи (borrow закрывается до повторного доступа).
    let mut target: Option<usize> = None;
    for i in 0..zip.len() {
        let is_target = {
            if let Ok(entry) = zip.by_index(i) {
                let n = entry.name().to_string();
                n.ends_with("universal.jar") && n.contains("forge")
            } else {
                false
            }
        };
        if is_target {
            target = Some(i);
            break;
        }
    }
    if let Some(i) = target {
        let mut out = std::fs::File::create(&universal_dest).map_err(|e| e.to_string())?;
        let mut entry = zip.by_index(i).map_err(|e| e.to_string())?;
        std::io::copy(&mut entry, &mut out).map_err(|e| e.to_string())?;
        found_in_zip = true;
    }
    if !found_in_zip {
        download_universal(mc_version, forge_version, &universal_dest, app).await?;
    }

    // legacy-совместимый путь universal.jar (FMLLoader ищет по шаблону forge-*-universal.jar).
    let legacy_dir = instance_dir
        .join("libraries/net/minecraftforge/forge")
        .join(format!("{}-{}", mc_version, forge_version));
    let legacy_jar = legacy_dir.join(format!("forge-{}-{}-universal.jar", mc_version, forge_version));
    if !legacy_jar.exists() && universal_dest.exists() {
        std::fs::create_dir_all(&legacy_dir).ok();
        let _ = std::fs::copy(&universal_dest, &legacy_jar);
    }

    // Патч MANIFEST.MF — иначе LauncherVersion.<clinit> падает.
    patch_universal_manifest(&universal_dest, forge_version, &version_id);

    Ok(version_id)
}

/// Патчит MANIFEST.MF в universal.jar: Implementation-Version и др.
/// (Перенесено из lib.rs::patch_universal_manifest.)
pub fn patch_universal_manifest(jar: &Path, forge_version: &str, forge_version_id: &str) {
    let file = match std::fs::File::open(jar) {
        Ok(f) => f,
        Err(_) => return,
    };
    let mut zip = match zip::ZipArchive::new(file) {
        Ok(z) => z,
        Err(_) => return,
    };
    // Уже пропатчен?
    if let Ok(mut mf) = zip.by_name("META-INF/MANIFEST.MF") {
        let mut s = String::new();
        if mf.read_to_string(&mut s).is_ok() && s.contains("Implementation-Version:") {
            return;
        }
    }
    drop(zip);

    let new_manifest = format!(
        "Manifest-Version: 1.0\r\n\
         Implementation-Version: {}\r\n\
         Implementation-Vendor: Forge\r\n\
         Implementation-Title: forge\r\n\
         Specification-Version: {}\r\n\
         Built-By: SBGames Launcher\r\n\r\n",
        forge_version_id, forge_version
    );

    // Перепаковать zip с новым manifest.
    let tmp = jar.with_extension("jar.tmp");
    if rewrite_zip_with_manifest(jar, &tmp, &new_manifest).is_ok() {
        let _ = std::fs::rename(&tmp, jar);
    } else {
        let _ = std::fs::remove_file(&tmp);
    }
}

fn rewrite_zip_with_manifest(
    src: &Path,
    dst: &Path,
    new_manifest: &str,
) -> Result<(), String> {
    let file = std::fs::File::open(src).map_err(|e| format!("open: {}", e))?;
    let mut za = zip::ZipArchive::new(file).map_err(|e| format!("zip: {}", e))?;

    let out = std::fs::File::create(dst).map_err(|e| format!("create: {}", e))?;
    let mut zw = zip::ZipWriter::new(out);
    let opts = zip::write::FileOptions::default();

    // Сначала наш manifest.
    zw.start_file("META-INF/MANIFEST.MF", opts)
        .map_err(|e| format!("start mf: {}", e))?;
    zw.write_all(new_manifest.as_bytes())
        .map_err(|e| format!("write mf: {}", e))?;

    for i in 0..za.len() {
        let mut entry = za.by_index(i).map_err(|e| format!("by_index: {}", e))?;
        let name = entry.name().to_string();
        if name == "META-INF/MANIFEST.MF" {
            continue; // уже записали свой.
        }
        let is_dir = entry.is_dir();
        let opts = if is_dir {
            zip::write::FileOptions::default()
        } else {
            zip::write::FileOptions::default()
        };
        zw.start_file(&name, opts).map_err(|e| format!("start {}: {}", name, e))?;
        if !is_dir {
            std::io::copy(&mut entry, &mut zw).map_err(|e| format!("copy {}: {}", name, e))?;
        }
    }
    zw.finish().map_err(|e| format!("finish: {}", e))?;
    Ok(())
}

// ─── LEGACY: 1.7–1.12.2 ───────────────────────────────────────────────────────

async fn install_forge_legacy(
    mc_version: &str,
    forge_version: &str,
    instance_dir: &Path,
    app: &AppHandle,
) -> Result<String, String> {
    let installer = download_installer(mc_version, forge_version, instance_dir, app).await?;
    let file = std::fs::File::open(&installer).map_err(|e| format!("open installer: {}", e))?;
    let mut zip = zip::ZipArchive::new(file).map_err(|e| format!("zip open: {}", e))?;

    // Старый install_profile.json содержит поле versionInfo — готовый профиль.
    let ip_str = {
        let mut f = zip
            .by_name("install_profile.json")
            .map_err(|e| format!("install_profile.json: {}", e))?;
        let mut s = String::new();
        f.read_to_string(&mut s).map_err(|e| e.to_string())?;
        s
    };
    let ip: serde_json::Value = serde_json::from_str(&ip_str)
        .map_err(|e| format!("install_profile parse: {}", e))?;

    // versionInfo (старый формат) либо прямой профиль.
    let profile = ip
        .get("versionInfo")
        .cloned()
        .or_else(|| {
            // Некоторые installer'ы кладут профиль прямо в install_profile.
            if ip.get("libraries").is_some() && ip.get("mainClass").is_some() {
                Some(ip.clone())
            } else {
                None
            }
        })
        .ok_or("versionInfo missing in install_profile.json")?;

    let version_id = profile
        .get("id")
        .and_then(|i| i.as_str())
        .unwrap_or(&format!("{}-forge-{}", mc_version, forge_version))
        .to_string();

    // Унаследуемся от vanilla mc_version (libs+assets берутся оттуда).
    let mut profile = profile;
    if profile.get("inheritsFrom").is_none() {
        profile["inheritsFrom"] = serde_json::Value::String(mc_version.to_string());
    }
    // Legacy mainClass + tweak.
    if profile.get("mainClass").is_none() {
        profile["mainClass"] =
            serde_json::Value::String("net.minecraft.launchwrapper.Launch".to_string());
    }

    // Сохранить профиль.
    let ver_dir = instance_dir.join("versions").join(&version_id);
    std::fs::create_dir_all(&ver_dir).map_err(|e| format!("mkdir versions: {}", e))?;
    std::fs::write(
        ver_dir.join(format!("{}.json", version_id)),
        serde_json::to_string_pretty(&profile).map_err(|e| format!("serialize: {}", e))?,
    )
    .map_err(|e| e.to_string())?;

    // libraries.
    ensure_profile_libraries(instance_dir, &version_id, app).await?;

    // universal.jar из корня zip.
    let universal_dest = instance_dir
        .join("libraries")
        .join("net/minecraftforge/forge")
        .join(&version_id)
        .join(format!("{}.jar", version_id));
    std::fs::create_dir_all(universal_dest.parent().unwrap()).ok();
    let mut extracted = false;
    let mut target: Option<usize> = None;
    for i in 0..zip.len() {
        let is_target = {
            if let Ok(entry) = zip.by_index(i) {
                let n = entry.name().to_string();
                n.ends_with("universal.jar") && n.contains("forge")
            } else {
                false
            }
        };
        if is_target {
            target = Some(i);
            break;
        }
    }
    if let Some(i) = target {
        let mut out = std::fs::File::create(&universal_dest).map_err(|e| e.to_string())?;
        let mut entry = zip.by_index(i).map_err(|e| e.to_string())?;
        std::io::copy(&mut entry, &mut out).map_err(|e| e.to_string())?;
        extracted = true;
    }
    if !extracted {
        download_universal(mc_version, forge_version, &universal_dest, app).await?;
    }
    patch_universal_manifest(&universal_dest, forge_version, &version_id);

    Ok(version_id)
}

// ─── MODERN: 1.13–1.17 (headless installer) ───────────────────────────────────

async fn install_forge_modern(
    mc_version: &str,
    forge_version: &str,
    instance_dir: &Path,
    app: &AppHandle,
) -> Result<String, String> {
    let installer = download_installer(mc_version, forge_version, instance_dir, app).await?;

    // Нужна Java 8 для запуска installer.jar (legacy installer не запустится на 17).
    // Сначала пробуем системную Java из find_java(), иначе качаем 8.
    let java = crate::find_java()
        .or_else(|| crate::java::find_local_java(8))
        .ok_or("java not found for forge installer")?;

    emit(app, "Запуск Forge installer (headless)…", 0, 1);
    // Forge installer пишет профиль прямо в gameDir/versions/ при --installClient.
    let status = std::process::Command::new(&java)
        .arg("-jar")
        .arg(&installer)
        .arg("--installClient")
        .arg(instance_dir)
        .current_dir(instance_dir)
        .output()
        .map_err(|e| format!("forge installer spawn: {}", e))?;

    if !status.status.success() {
        return Err(format!(
            "forge installer failed: {}",
            String::from_utf8_lossy(&status.stderr)
        ));
    }

    // Найти созданный профиль: versions/<forge-id>/<forge-id>.json.
    let versions_dir = instance_dir.join("versions");
    let mut found: Option<String> = None;
    if let Ok(rd) = std::fs::read_dir(&versions_dir) {
        for entry in rd.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if name.contains("forge") && name.contains(mc_version) {
                // Проверим, что внутри есть .json.
                if entry.path().join(format!("{}.json", name)).exists() {
                    found = Some(name);
                    break;
                }
            }
        }
    }
    let version_id = found.ok_or("forge installer produced no profile")?;

    // Гарантируем libraries + universal.
    ensure_profile_libraries(instance_dir, &version_id, app).await?;
    let universal_dest = instance_dir
        .join("libraries")
        .join("net/minecraftforge/forge")
        .join(&version_id)
        .join(format!("{}.jar", version_id));
    if !universal_dest.exists() {
        download_universal(mc_version, forge_version, &universal_dest, app).await?;
    }
    patch_universal_manifest(&universal_dest, forge_version, &version_id);

    Ok(version_id)
}

pub async fn list_versions(mc_version: &str) -> Result<Vec<String>, String> {
    // promotions_slim.json: {promos:{"1.20.1-latest":"47.4.10", ...}}
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("http: {}", e))?;
    let resp = client
        .get("https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json")
        .send()
        .await
        .map_err(|e| format!("promotions: {}", e))?;
    let v: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("promotions json: {}", e))?;
    let mut out = Vec::new();
    if let Some(promos) = v.get("promos").and_then(|p| p.as_object()) {
        let prefix = format!("{}-", mc_version);
        for (key, val) in promos {
            if key.starts_with(&prefix) && (key.ends_with("-latest") || key.ends_with("-recommended"))
            {
                if let Some(s) = val.as_str() {
                    out.push(s.to_string());
                }
            }
        }
    }
    out.sort();
    out.dedup();
    Ok(out)
}
