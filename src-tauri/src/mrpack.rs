//! #10 Импорт .mrpack — формата модпаков Modrinth.
//!
//! .mrpack — это zip с modrinth.index.json внутри (описание файлов и зависимостей)
//! плюс overrides/ (и client-overrides/) с конфигами/сейвами.
//!
//! Логика:
//!   1. Парсим modrinth.index.json.
//!   2. Из dependencies[] определяем mc_version + loader + loader_version.
//!   3. Создаём инстанс через instance_create.
//!   4. Для каждого file (env.client != "unsupported") — качаем первый URL,
//!      проверяем sha512, кладём по path внутри instance_dir.
//!   5. Распаковываем overrides/* в instance_dir.

use crate::download_file;
use crate::instance::{self, InstanceConfig, LoaderKind, ModEntry};
use crate::DownloadProgress;
use sha2::{Digest, Sha512};
use std::io::Read;
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

#[derive(Debug)]
struct MrpackIndex {
    name: String,
    mc_version: String,
    loader: LoaderKind,
    loader_version: String,
    files: Vec<MrpackFile>,
}

#[derive(Debug)]
struct MrpackFile {
    path: String,
    sha512: Option<String>,
    sha1: Option<String>,
    downloads: Vec<String>,
    client_unsupported: bool,
    file_size: u64,
}

/// Импортировать .mrpack → создать инстанс. Возвращает конфиг.
#[tauri::command]
pub async fn import_mrpack(
    app: AppHandle,
    file_path: String,
    custom_name: Option<String>,
) -> Result<InstanceConfig, String> {
    let path = PathBuf::from(&file_path);
    let file = std::fs::File::open(&path).map_err(|e| format!("open mrpack: {}", e))?;
    let mut zip = zip::ZipArchive::new(file).map_err(|e| format!("zip open: {}", e))?;

    emit(&app, "Чтение modrinth.index.json…", 0, 1);

    // 1. modrinth.index.json.
    let idx_str = {
        let mut f = zip
            .by_name("modrinth.index.json")
            .map_err(|e| format!("modrinth.index.json: {}", e))?;
        let mut s = String::new();
        f.read_to_string(&mut s).map_err(|e| e.to_string())?;
        s
    };
    let idx_val: serde_json::Value =
        serde_json::from_str(&idx_str).map_err(|e| format!("index parse: {}", e))?;
    let idx = parse_index(&idx_val)?;

    // 2. Создать инстанс.
    let required_java = instance::required_java_for_mc(&idx.mc_version);
    let cfg = InstanceConfig {
        id: String::new(), // сгенерируется в instance_create
        name: custom_name.unwrap_or(idx.name.clone()),
        mc_version: idx.mc_version.clone(),
        loader: idx.loader.clone(),
        loader_version: Some(idx.loader_version.clone()),
        java_version: required_java,
        min_ram_mb: 512,
        max_ram_mb: 4096,
        jvm_args: Vec::new(),
        mods: Vec::new(), // моды физически скачаются ниже; список тоже соберём.
        created_at: 0,
        last_played: None,
        icon: None,
    };
    let instance_id =
        crate::instance::instance_create(cfg.clone(), app.clone())?;
    let inst_dir = instance::instance_dir(&instance_id);

    // 3. Скачать файлы.
    let total = idx.files.len();
    emit(&app, &format!("Загрузка файлов ({})", total), 0, total as u64);
    let mut cfg = instance::load(&instance_id)?;

    for (i, mf) in idx.files.iter().enumerate() {
        if mf.client_unsupported {
            continue;
        }
        if let Err(e) = download_mrpack_file(mf, &inst_dir, &app, &mut cfg).await {
            eprintln!("[mrpack] skip {}: {}", mf.path, e);
        }
        emit(&app, &format!("{}: {}/{}", idx.name, i + 1, total), (i + 1) as u64, total as u64);
    }
    let _ = instance::save(&cfg);

    // 4. Распаковать overrides/ (и client-overrides/).
    emit(&app, "Распаковка overrides…", 0, 1);
    extract_overrides(&mut zip, &inst_dir, "overrides/")?;
    extract_overrides(&mut zip, &inst_dir, "client-overrides/")?;

    emit(&app, "Готово", 1, 1);
    Ok(cfg)
}

fn parse_index(v: &serde_json::Value) -> Result<MrpackIndex, String> {
    let name = v
        .get("name")
        .and_then(|n| n.as_str())
        .unwrap_or("Modrinth Modpack")
        .to_string();

    let deps = v
        .get("dependencies")
        .and_then(|d| d.as_object())
        .ok_or("dependencies missing")?;
    let mc_version = deps
        .get("minecraft")
        .and_then(|m| m.as_str())
        .ok_or("minecraft version missing")?
        .to_string();

    // Один из loader-ключей присутствует.
    let (loader, loader_version) = if let Some(forge) = deps.get("forge").and_then(|f| f.as_str()) {
        (LoaderKind::Forge, forge.to_string())
    } else if let Some(nf) = deps.get("neoforge").and_then(|f| f.as_str()) {
        (LoaderKind::NeoForge, nf.to_string())
    } else if let Some(fabric) = deps
        .get("fabric-loader")
        .and_then(|f| f.as_str())
    {
        (LoaderKind::Fabric, fabric.to_string())
    } else if let Some(quilt) = deps.get("quilt-loader").and_then(|f| f.as_str()) {
        (LoaderKind::Quilt, quilt.to_string())
    } else {
        (LoaderKind::Vanilla, String::new())
    };

    let mut files = Vec::new();
    if let Some(arr) = v.get("files").and_then(|f| f.as_array()) {
        for f in arr {
            let path = f
                .get("path")
                .and_then(|p| p.as_str())
                .unwrap_or("")
                .to_string();
            if path.is_empty() {
                continue;
            }
            let sha512 = f
                .get("hashes")
                .and_then(|h| h.get("sha512"))
                .and_then(|s| s.as_str())
                .map(String::from);
            let sha1 = f
                .get("hashes")
                .and_then(|h| h.get("sha1"))
                .and_then(|s| s.as_str())
                .map(String::from);
            let downloads = f
                .get("downloads")
                .and_then(|d| d.as_array())
                .map(|arr| {
                    arr.iter()
                        .filter_map(|u| u.as_str().map(String::from))
                        .collect()
                })
                .unwrap_or_default();
            let client_unsupported = f
                .get("env")
                .and_then(|e| e.get("client"))
                .and_then(|c| c.as_str())
                .map(|s| s == "unsupported")
                .unwrap_or(false);
            let file_size = f.get("fileSize").and_then(|s| s.as_u64()).unwrap_or(0);
            files.push(MrpackFile {
                path,
                sha512,
                sha1,
                downloads,
                client_unsupported,
                file_size,
            });
        }
    }

    Ok(MrpackIndex {
        name,
        mc_version,
        loader,
        loader_version,
        files,
    })
}

async fn download_mrpack_file(
    mf: &MrpackFile,
    inst_dir: &Path,
    app: &AppHandle,
    cfg: &mut InstanceConfig,
) -> Result<(), String> {
    let dest = inst_dir.join(&mf.path);
    if dest.exists() {
        return Ok(());
    }
    std::fs::create_dir_all(dest.parent().unwrap()).ok();

    // Первый URL из downloads[].
    let url = mf
        .downloads
        .first()
        .ok_or("no download url")?
        .clone();
    let label = mf
        .path
        .rsplit('/')
        .next()
        .unwrap_or(&mf.path)
        .to_string();
    emit(app, &label, 0, 1);

    // Пробуем по очереди все URL.
    let mut ok = false;
    for u in &mf.downloads {
        if download_file(u, &dest, app).await.is_ok() {
            // sha512 проверка.
            if let Some(expected) = &mf.sha512 {
                if let Ok(actual) = sha512_of_file(&dest) {
                    if actual != *expected {
                        let _ = std::fs::remove_file(&dest);
                        continue;
                    }
                }
            }
            ok = true;
            break;
        }
    }
    if !ok {
        return Err(format!("все URL провалились: {}", mf.path));
    }

    // Если это мод (path начинается с mods/) — добавим в список конфига,
    // чтобы sync_mods не удалил его как «лишний».
    if mf.path.starts_with("mods/") {
        let filename = Path::new(&mf.path)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_string();
        cfg.mods.push(ModEntry {
            project_id: String::new(),
            slug: String::new(),
            title: filename.clone(),
            icon_url: None,
            version: None,
            downloads: None,
            download_url: Some(mf.downloads.first().cloned().unwrap_or_default()),
            filename: Some(filename),
            kind: "mods".to_string(),
            local: true, // уже скачан из mrpack.
        });
    }
    Ok(())
}

fn extract_overrides(
    zip: &mut zip::ZipArchive<std::fs::File>,
    inst_dir: &Path,
    prefix: &str,
) -> Result<(), String> {
    // Первый проход: собрать индексы + метаданные (без держания borrow).
    let mut tasks: Vec<(usize, std::path::PathBuf, bool)> = Vec::new();
    for i in 0..zip.len() {
        let (name, is_dir) = {
            let entry = zip.by_index(i).map_err(|e| format!("by_index: {}", e))?;
            (entry.name().to_string(), entry.is_dir())
        };
        if !name.starts_with(prefix) {
            continue;
        }
        let rel = &name[prefix.len()..];
        if rel.is_empty() {
            continue;
        }
        tasks.push((i, inst_dir.join(rel), is_dir || name.ends_with('/')));
    }

    // Второй проход: собственно распаковка — borrow открывается/закрывается для каждой записи.
    for (i, dest, is_dir) in tasks {
        if is_dir {
            std::fs::create_dir_all(&dest).ok();
            continue;
        }
        std::fs::create_dir_all(dest.parent().unwrap()).ok();
        let mut entry = zip.by_index(i).map_err(|e| format!("by_index: {}", e))?;
        let mut out = std::fs::File::create(&dest)
            .map_err(|e| format!("create {}: {}", dest.display(), e))?;
        std::io::copy(&mut entry, &mut out).map_err(|e| format!("copy {}: {}", dest.display(), e))?;
    }
    Ok(())
}

fn sha512_of_file(path: &Path) -> Result<String, String> {
    let mut f = std::fs::File::open(path).map_err(|e| e.to_string())?;
    let mut hasher = Sha512::new();
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
