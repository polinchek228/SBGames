//! #8 launch_instance — оркестратор запуска кастомной сборки.
//!
//! Pipeline: java → vanilla-база → loader → sync_mods → merge_profile →
//! resolve_placeholders → spawn JVM. Не запускает серверный modpack-sync и
//! не ставит mods/ SHA-watcher (это для серверного режима), но сохраняет
//! security precheck и pid-трекинг.

use crate::instance::{self, InstanceConfig, LoaderKind};
use crate::loaders::{self, merge_profile, MergedProfile};
use crate::{java, mods, DownloadProgress};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use tauri::{AppHandle, Emitter};

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

/// Главная команда запуска кастомного инстанса.
#[tauri::command]
pub async fn launch_instance(
    app: AppHandle,
    instance_id: String,
    username: String,
    uuid: String,
    access_token: String,
) -> Result<(), String> {
    use std::process::Stdio;

    // ── Single-launch protection ──
    if let Some(running) = crate::read_running_minecraft_pid() {
        return Err(format!(
            "Minecraft уже запущен (pid={}). Закрой игру или заверши процесс.",
            running
        ));
    }
    // ── Security precheck (cheat/injector/debugger) ──
    crate::security_precheck()?;
    // ── Scrub rogue env vars ──
    for flag in &["JAVA_TOOL_OPTIONS", "_JAVA_OPTIONS", "JAVA_OPTIONS", "CLASSPATH"] {
        if std::env::var(flag).is_ok() {
            std::env::remove_var(flag);
        }
    }

    let mut cfg = instance::load(&instance_id)?;
    let inst_dir = instance::instance_dir(&instance_id);
    std::fs::create_dir_all(&inst_dir).map_err(|e| format!("mkdir instance: {}", e))?;

    emit(&app, "Подготовка запуска…", 0, 100);

    // 1. Java.
    let java_path = java::ensure_java(cfg.java_version, &app).await?;
    crate::validate_java_binary(&java_path)?;
    emit(&app, "Java готова", 5, 100);

    // 2. Vanilla-база (manifest, client.jar, assets, libraries).
    let _vanilla_id =
        loaders::vanilla::ensure(&cfg.mc_version, &inst_dir, &app).await?;
    emit(&app, "Vanilla клиент готов", 30, 100);

    // 3. Loader поверх (если не Vanilla).
    let version_id = match cfg.loader {
        LoaderKind::Vanilla => cfg.mc_version.clone(),
        LoaderKind::Forge => {
            let fv = cfg
                .loader_version
                .clone()
                .ok_or("forge_version missing")?;
            loaders::forge::install_forge(&cfg.mc_version, &fv, &inst_dir, &app).await?
        }
        LoaderKind::Fabric => {
            loaders::fabric::install_fabric(
                &cfg.mc_version,
                cfg.loader_version.as_deref(),
                &inst_dir,
                &app,
            )
            .await?
        }
        LoaderKind::Quilt => {
            loaders::quilt::install_quilt(
                &cfg.mc_version,
                cfg.loader_version.as_deref(),
                &inst_dir,
                &app,
            )
            .await?
        }
        LoaderKind::NeoForge => {
            let nv = cfg
                .loader_version
                .clone()
                .ok_or("neoforge_version missing")?;
            loaders::neoforge::install_neoforge(&nv, &inst_dir, &app).await?
        }
    };
    emit(&app, "Загрузчик установлен", 55, 100);

    // 4. Скачать моды.
    mods::sync_mods(&inst_dir, &cfg, &app).await?;
    emit(&app, "Моды синхронизированы", 75, 100);

    // 5. Смержить профили (vanilla + loader).
    let merged = merge_profile(&inst_dir, &version_id)?;
    let resolved = resolve_placeholders(
        &merged,
        &cfg,
        &inst_dir,
        &version_id,
        &username,
        &uuid,
        &access_token,
    );

    // 6. Запустить JVM.
    emit(&app, "Запуск Minecraft…", 95, 100);
    let log_dir = inst_dir.join("logs");
    std::fs::create_dir_all(&log_dir).ok();

    let mut cmd = Command::new(&java_path);

    // На Windows подавляем создание отдельного окна консоли.
    // Без этого флага каждый spawn открывает cmd.exe → куча окон.
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    apply_jvm_args(&mut cmd, &resolved, &cfg, &inst_dir);
    cmd.arg(&resolved.main_class);
    cmd.args(&resolved.game_args);
    cmd.current_dir(&inst_dir);
    cmd.stdin(Stdio::null());
    cmd.stdout(Stdio::from(
        std::fs::File::create(log_dir.join("latest.log")).map_err(|e| e.to_string())?,
    ));
    cmd.stderr(Stdio::from(
        std::fs::File::create(log_dir.join("stderr.log")).map_err(|e| e.to_string())?,
    ));
    let child = cmd.spawn().map_err(|e| format!("spawn java: {}", e))?;
    let pid = child.id();

    // Сохранить pid для single-launch проверки.
    let pid_file = crate::minecraft_dir().join(".minecraft.pid");
    let _ = std::fs::write(&pid_file, pid.to_string());

    // Записать last_played.
    cfg.last_played = Some(now_secs());
    let _ = instance::save(&cfg);

    // Не ждём завершения — отдаём pid родителю.
    std::mem::forget(child);

    emit(&app, "Запущено", 100, 100);
    Ok(())
}

/// Раскрытые placeholders в args + собранный classpath.
pub struct ResolvedLaunch {
    pub jvm_args: Vec<String>,
    pub game_args: Vec<String>,
    pub main_class: String,
    pub libraries: Vec<PathBuf>,
}

fn now_secs() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

/// Подставить ${...} placeholders в args и собрать classpath.
fn resolve_placeholders(
    merged: &MergedProfile,
    cfg: &InstanceConfig,
    inst_dir: &Path,
    version_id: &str,
    username: &str,
    uuid: &str,
    access_token: &str,
) -> ResolvedLaunch {
    let libs_dir = inst_dir.join("libraries");
    let natives_dir = inst_dir.join("natives");
    let assets_root = inst_dir.join("assets");
    let game_dir = inst_dir.to_path_buf();
    let classpath_sep = if cfg!(target_os = "windows") { ";" } else { ":" };

    // Natives: распакованные .dll/.so/.dylib лежат в natives_dir/<jar>/.
    // Для запуска достаточно -Djava.library.path=natives_dir; тут делаем базово.
    let natives_list = &merged.natives;
    // Список путей в -cp: libraries + natives-jars.
    // Фильтруем несуществующие файлы (могут быть macOS/Linux-only libs,
    // которые не скачались под Windows — напр. java-objc-bridge).
    let mut cp_items: Vec<PathBuf> = Vec::new();
    for p in &merged.libraries {
        if p.exists() && !cp_items.contains(p) {
            cp_items.push(p.clone());
        }
    }
    for n in natives_list {
        if n.exists() && !cp_items.contains(n) {
            cp_items.push(n.clone());
        }
    }
    let classpath = cp_items
        .iter()
        .map(|p| p.to_string_lossy().to_string())
        .collect::<Vec<_>>()
        .join(classpath_sep);

    // Словарь подстановок.
    let vars: Vec<(&str, String)> = vec![
        ("${auth_player_name}", username.to_string()),
        ("${version_name}", version_id.to_string()),
        ("${game_directory}", game_dir.to_string_lossy().to_string()),
        ("${assets_root}", assets_root.to_string_lossy().to_string()),
        (
            "${assets_index_name}",
            merged.asset_index.clone(),
        ),
        ("${auth_uuid}", uuid.to_string()),
        ("${auth_access_token}", access_token.to_string()),
        ("${auth_session}", format!("token:{}", access_token)),
        ("${user_type}", "legacy".to_string()),
        ("${version_type}", "release".to_string()),
        ("${classpath}", classpath.clone()),
        ("${classpath_separator}", classpath_sep.to_string()),
        ("${library_directory}", libs_dir.to_string_lossy().to_string()),
        (
            "${natives_directory}",
            natives_dir.to_string_lossy().to_string(),
        ),
    ];

    let subst = |s: &str| -> String {
        let mut out = s.to_string();
        for (k, v) in &vars {
            out = out.replace(k, v);
        }
        out
    };

    let jvm_args: Vec<String> = merged.jvm_args.iter().map(|s| subst(s)).collect();
    let game_args: Vec<String> = merged.game_args.iter().map(|s| subst(s)).collect();

    ResolvedLaunch {
        jvm_args,
        game_args,
        main_class: merged.main_class.clone(),
        libraries: cp_items,
    }
}

/// Применить JVM args к Command, с учётом длины classpath на Windows.
/// При большом -cp используем wrapped-manifest jar (@classpath.jar).
fn apply_jvm_args(
    cmd: &mut Command,
    resolved: &ResolvedLaunch,
    cfg: &InstanceConfig,
    inst_dir: &Path,
) {
    // RAM.
    cmd.arg(format!("-Xms{}m", cfg.min_ram_mb.max(256)));
    cmd.arg(format!("-Xmx{}m", cfg.max_ram_mb.max(512)));

    // Пользовательские jvm_args из конфига.
    for a in &cfg.jvm_args {
        cmd.arg(a);
    }

    // Все jvm_args из профиля (там уже подставлены placeholders).
    // Отфильтруем те, что содержат ${classpath} — мы их заменим на wrapped-jar.
    let mut has_classpath_arg = false;
    for a in &resolved.jvm_args {
        if a.contains("${classpath}") || a.trim_start_matches('-').starts_with("cp") && a.contains("${classpath}") {
            // пропустим — обработаем отдельно ниже.
            continue;
        }
        if a == "-cp" {
            has_classpath_arg = true;
            continue;
        }
        cmd.arg(a);
    }
    let _ = has_classpath_arg;

    // Classpath: оцениваем длину. На Windows лимит ~32k для cmd, но CreateProcess
    // держит ~32767. Перестраховываемся на >16k → wrapped-manifest jar.
    let cp_len: usize = resolved
        .libraries
        .iter()
        .map(|p| p.to_string_lossy().len() + 1)
        .sum();
    let sep = if cfg!(target_os = "windows") { ";" } else { ":" };
    let cp_string = resolved
        .libraries
        .iter()
        .map(|p| p.to_string_lossy().to_string())
        .collect::<Vec<_>>()
        .join(sep);

    if cfg!(target_os = "windows") && cp_len > 16000 {
        // Wrapped manifest jar.
        let wrap_path = inst_dir.join(".classpath.jar");
        if crate::generate_wrapped_classpath_manifest(&wrap_path, &resolved.libraries, inst_dir)
            .is_ok()
        {
            cmd.arg("-cp").arg(wrap_path.to_string_lossy().to_string());
        } else {
            cmd.arg("-cp").arg(cp_string);
        }
    } else {
        cmd.arg("-cp").arg(cp_string);
    }
}
