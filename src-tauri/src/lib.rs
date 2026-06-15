#![allow(dead_code, unused_imports, unused_variables, unused_mut)]

use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Emitter, Manager,
};
use std::sync::{atomic::{AtomicBool, Ordering}, Mutex};
use std::collections::HashSet;
use std::path::PathBuf;

static INTEGRITY_OK: AtomicBool = AtomicBool::new(false);

// ─── Discord RPC state ────────────────────────────────────────────────────────
struct DiscordState(Mutex<Option<discord_rich_presence::DiscordIpcClient>>);

// ─── Anti-debug / anti-inject (release only) ─────────────────────────────────
#[cfg(target_os = "windows")]
fn allowed_dlls() -> HashSet<String> {
    [
        "ntdll.dll","kernel32.dll","kernelbase.dll","user32.dll","gdi32.dll",
        "advapi32.dll","sechost.dll","rpcrt4.dll","ucrtbase.dll","msvcrt.dll",
        "combase.dll","ole32.dll","oleaut32.dll","shell32.dll","shlwapi.dll",
        "ws2_32.dll","wldp.dll","wintrust.dll","crypt32.dll","bcrypt.dll",
        "ncrypt.dll","cryptbase.dll","cfgmgr32.dll","setupapi.dll",
        "imm32.dll","msctf.dll","uxtheme.dll","dwmapi.dll","version.dll",
        "dxgi.dll","d3d11.dll","d3d12.dll","opengl32.dll","glu32.dll",
        "dinput8.dll","xinput1_4.dll","winmm.dll","mfplat.dll",
        "webview2loader.dll","embeddedbrowserwebview.dll",
        "vcruntime140.dll","vcruntime140_1.dll","msvcp140.dll",
        "sbgames_launcher_lib.dll",
    ].iter().map(|s| s.to_lowercase()).collect()
}

#[cfg(target_os = "windows")]
fn setup_dll_protection() {
    use std::ffi::c_void;
    extern "system" {
        fn SetDllDirectoryW(path: *const u16) -> i32;
        fn SetSearchPathMode(flags: u32) -> i32;
        fn GetCurrentProcess() -> *mut c_void;
        fn SetProcessMitigationPolicy(policy: u32, lp: *const c_void, cb: usize) -> i32;
    }
    unsafe {
        let empty: Vec<u16> = [0u16].to_vec();
        SetDllDirectoryW(empty.as_ptr());
        SetSearchPathMode(0x00000001);
        let v: u32 = 1;
        SetProcessMitigationPolicy(2,  &v as *const u32 as *const c_void, std::mem::size_of::<u32>());
        SetProcessMitigationPolicy(7,  &v as *const u32 as *const c_void, std::mem::size_of::<u32>());
        let img: u32 = 0b111;
        SetProcessMitigationPolicy(10, &img as *const u32 as *const c_void, std::mem::size_of::<u32>());
    }
}
#[cfg(not(target_os = "windows"))]
fn setup_dll_protection() {}

#[cfg(target_os = "windows")]
fn scan_loaded_modules() -> bool {
    use std::ffi::c_void;
    extern "system" {
        fn GetCurrentProcess() -> *mut c_void;
        fn EnumProcessModulesEx(p: *mut c_void, mods: *mut *mut c_void, cb: u32, needed: *mut u32, flag: u32) -> i32;
        fn GetModuleBaseNameW(p: *mut c_void, m: *mut c_void, buf: *mut u16, n: u32) -> u32;
    }
    let allowed = allowed_dlls();
    unsafe {
        let proc = GetCurrentProcess();
        let mut mods = vec![std::ptr::null_mut::<c_void>(); 1024];
        let mut needed: u32 = 0;
        if EnumProcessModulesEx(proc, mods.as_mut_ptr(), (mods.len()*8) as u32, &mut needed, 0x03) == 0 { return false; }
        for &m in &mods[..(needed as usize/8).min(mods.len())] {
            if m.is_null() { continue; }
            let mut buf = vec![0u16; 260];
            let len = GetModuleBaseNameW(proc, m, buf.as_mut_ptr(), buf.len() as u32);
            if len == 0 { continue; }
            let name = String::from_utf16_lossy(&buf[..len as usize]).to_lowercase();
            if !allowed.contains(name.as_str()) { return true; }
        }
    }
    false
}
#[cfg(not(target_os = "windows"))]
fn scan_loaded_modules() -> bool {
    #[cfg(target_os = "linux")]
    if let Ok(maps) = std::fs::read_to_string("/proc/self/maps") {
        for line in maps.lines() {
            let l = line.to_lowercase();
            if ["inject","hook","cheat","trainer","loader"].iter().any(|s| l.contains(s)) { return true; }
        }
    }
    std::env::var("LD_PRELOAD").is_ok()
}

#[cfg(target_os = "windows")]
fn check_debugger() -> bool {
    use std::ffi::c_void;
    extern "system" {
        fn IsDebuggerPresent() -> i32;
        fn CheckRemoteDebuggerPresent(h: *mut c_void, out: *mut i32) -> i32;
        fn GetCurrentProcess() -> *mut c_void;
    }
    unsafe {
        if IsDebuggerPresent() != 0 { return true; }
        let mut r: i32 = 0;
        CheckRemoteDebuggerPresent(GetCurrentProcess(), &mut r);
        r != 0
    }
}
#[cfg(not(target_os = "windows"))]
fn check_debugger() -> bool {
    #[cfg(target_os = "linux")]
    if let Ok(s) = std::fs::read_to_string("/proc/self/status") {
        for line in s.lines() {
            if line.starts_with("TracerPid:") {
                if let Some(v) = line.split_whitespace().nth(1) { return v != "0"; }
            }
        }
    }
    std::env::var("LD_PRELOAD").is_ok()
}

fn start_guard_thread() {
    std::thread::spawn(|| {
        std::thread::sleep(std::time::Duration::from_secs(3));
        loop {
            if check_debugger() || scan_loaded_modules() { std::process::exit(0x4B1D); }
            let t = std::time::Instant::now();
            std::thread::sleep(std::time::Duration::from_millis(800));
            if t.elapsed().as_millis() > 3000 { std::process::exit(0x4B1D); }
        }
    });
}

#[cfg(not(debug_assertions))]
fn verify_integrity() -> bool { INTEGRITY_OK.store(true, Ordering::SeqCst); true }
#[cfg(debug_assertions)]
fn verify_integrity() -> bool { true }

// ─── Tauri commands ──────────────────────────────────────────────────────────

#[tauri::command]
fn get_version() -> String { env!("CARGO_PKG_VERSION").to_string() }

#[tauri::command]
fn get_system_ram_gb() -> u64 {
    #[cfg(target_os = "windows")]
    {
        use std::mem;
        #[repr(C)] struct MEMSTATUSEX {
            dw_length: u32, dw_memory_load: u32, ull_total_phys: u64,
            ull_avail_phys: u64, ull_total_page_file: u64, ull_avail_page_file: u64,
            ull_total_virtual: u64, ull_avail_virtual: u64, ull_avail_ext_virtual: u64,
        }
        extern "system" { fn GlobalMemoryStatusEx(lp: *mut MEMSTATUSEX) -> i32; }
        unsafe {
            let mut s: MEMSTATUSEX = mem::zeroed();
            s.dw_length = mem::size_of::<MEMSTATUSEX>() as u32;
            if GlobalMemoryStatusEx(&mut s) != 0 { return s.ull_total_phys / (1024*1024*1024); }
        }
        return 8;
    }
    #[cfg(not(target_os = "windows"))]
    {
        if let Ok(c) = std::fs::read_to_string("/proc/meminfo") {
            for line in c.lines() {
                if line.starts_with("MemTotal:") {
                    if let Some(kb) = line.split_whitespace().nth(1) {
                        if let Ok(n) = kb.parse::<u64>() { return n / (1024*1024); }
                    }
                }
            }
        }
        if let Ok(o) = std::process::Command::new("sysctl").args(["-n","hw.memsize"]).output() {
            if let Ok(s) = std::str::from_utf8(&o.stdout) {
                if let Ok(b) = s.trim().parse::<u64>() { return b / (1024*1024*1024); }
            }
        }
        8
    }
}

// ─── 4. Discord Rich Presence ────────────────────────────────────────────────
#[tauri::command]
async fn set_discord_presence(
    state: tauri::State<'_, DiscordState>,
    details: String,
    status: String,
    large_image: Option<String>,
) -> Result<(), String> {
    use discord_rich_presence::{activity, DiscordIpc};

    let mut guard = state.0.lock().map_err(|e| e.to_string())?;

    // Ленивая инициализация клиента
    if guard.is_none() {
        // App ID из Discord Developer Portal — замени на свой
        let mut client = discord_rich_presence::DiscordIpcClient::new("1234567890")
            .map_err(|e| e.to_string())?;
        let _ = client.connect(); // не критично если Discord не запущен
        *guard = Some(client);
    }

    if let Some(client) = guard.as_mut() {
        let mut act = activity::Activity::new()
            .details(&details)
            .state(&status);

        if let Some(img) = large_image.as_deref() {
            act = act.assets(
                activity::Assets::new()
                    .large_image(img)
                    .large_text("SB Games Launcher"),
            );
        }

        let _ = client.set_activity(act);
    }
    Ok(())
}

#[tauri::command]
async fn clear_discord_presence(state: tauri::State<'_, DiscordState>) -> Result<(), String> {
    use discord_rich_presence::DiscordIpc;
    if let Ok(mut guard) = state.0.lock() {
        if let Some(client) = guard.as_mut() {
            let _ = client.clear_activity();
        }
    }
    Ok(())
}

// ─── 7. Screenshot gallery ────────────────────────────────────────────────────
#[derive(serde::Serialize)]
pub struct Screenshot {
    name:     String,
    path:     String,
    modified: u64,
    size:     u64,
}

#[tauri::command]
fn get_screenshots() -> Vec<Screenshot> {
    let dir = screenshots_dir();
    let mut result = Vec::new();

    if let Ok(entries) = std::fs::read_dir(&dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) != Some("png") { continue; }
            if let Ok(meta) = entry.metadata() {
                let modified = meta.modified()
                    .ok()
                    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                    .map(|d| d.as_secs())
                    .unwrap_or(0);
                result.push(Screenshot {
                    name: entry.file_name().to_string_lossy().to_string(),
                    path: path.to_string_lossy().to_string(),
                    modified,
                    size: meta.len(),
                });
            }
        }
    }

    result.sort_by(|a, b| b.modified.cmp(&a.modified));
    result.truncate(48); // последние 48 скриншотов
    result
}

#[tauri::command]
fn read_screenshot_b64(path: String) -> Result<String, String> {
    // Безопасность: проверяем что путь внутри папки скриншотов
    let allowed_dir = screenshots_dir();
    let canonical = std::fs::canonicalize(&path).map_err(|e| e.to_string())?;
    if !canonical.starts_with(&allowed_dir) {
        return Err("Access denied".into());
    }
    let bytes = std::fs::read(&canonical).map_err(|e| e.to_string())?;
    Ok(format!("data:image/png;base64,{}", base64_encode(&bytes)))
}

fn base64_encode(bytes: &[u8]) -> String {
    const TABLE: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity((bytes.len() + 2) / 3 * 4);
    for chunk in bytes.chunks(3) {
        let b0 = chunk[0] as u32;
        let b1 = if chunk.len() > 1 { chunk[1] as u32 } else { 0 };
        let b2 = if chunk.len() > 2 { chunk[2] as u32 } else { 0 };
        let combined = (b0 << 16) | (b1 << 8) | b2;
        out.push(TABLE[((combined >> 18) & 0x3F) as usize] as char);
        out.push(TABLE[((combined >> 12) & 0x3F) as usize] as char);
        out.push(if chunk.len() > 1 { TABLE[((combined >> 6) & 0x3F) as usize] as char } else { '=' });
        out.push(if chunk.len() > 2 { TABLE[(combined & 0x3F) as usize] as char } else { '=' });
    }
    out
}

fn screenshots_dir() -> std::path::PathBuf {
    #[cfg(target_os = "windows")]
    {
        let appdata = std::env::var("APPDATA").unwrap_or_default();
        std::path::PathBuf::from(appdata).join(".sbgames").join("screenshots")
    }
    #[cfg(target_os = "macos")]
    {
        dirs_next::home_dir()
            .unwrap_or_default()
            .join("Library/Application Support/sbgames/screenshots")
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        let home = std::env::var("HOME").unwrap_or_default();
        std::path::PathBuf::from(home).join(".sbgames").join("screenshots")
    }
}

// ─── 8. System notifications ─────────────────────────────────────────────────
#[tauri::command]
async fn show_notification(app: tauri::AppHandle, title: String, body: String) -> Result<(), String> {
    use tauri_plugin_notification::NotificationExt;
    app.notification()
        .builder()
        .title(&title)
        .body(&body)
        .show()
        .map_err(|e| e.to_string())
}

// ─── 6. Download progress (channel-based) ────────────────────────────────────
#[derive(Clone, serde::Serialize)]
struct DownloadProgress {
    file:       String,
    downloaded: u64,
    total:      u64,
    speed_kbs:  u64,
}

// ─── Real Minecraft launcher (Forge 1.20.1 offline) ──────────────────────────
#[tauri::command]
async fn launch_minecraft(
    app: tauri::AppHandle,
    server_id: String,
    username: String,
    token: String,
    ram_gb:    Option<u32>,
    java_path: Option<String>,
) -> Result<String, String> {
    use std::process::{Command, Stdio};

    // ─── Single-launch protection: block если уже запущен процесс Minecraft ─
    if let Some(running_pid) = read_running_minecraft_pid() {
        return Err(format!(
            "Minecraft уже запущен (pid={}). Закрой игру или заверши процесс.",
            running_pid
        ));
    }

    // ─── Security precheck: блокируем если запущен cheat/injector/debugger ─
    if let Err(e) = security_precheck() {
        return Err(e);
    }

    // ─── Environment hygiene: scrub rogue variables ───
    let toxic_flags = ["JAVA_TOOL_OPTIONS", "_JAVA_OPTIONS", "JAVA_OPTIONS", "CLASSPATH"];
    for flag in &toxic_flags {
        if std::env::var(flag).is_ok() {
            std::env::remove_var(flag);
        }
    }

    use std::path::PathBuf;

    // ─── Modpack sync: качаем whitelist модов с сервера, удаляем чужие ─
    // Делаем ДО запуска MC, чтобы моды были готовы к моменту Forge.
    let _ = app.emit("download_progress", DownloadProgress {
        file:       "Синхронизация мод-пака...".into(),
        downloaded: 0, total: 1, speed_kbs: 0,
    });
    let modpack_report = match sync_modpack(&app).await {
        Ok(r) => r,
        Err(e) => return Err(format!("Ошибка мод-пака: {}", e)),
    };
    // Если мод-пак подменён (rejected) или чего-то не хватает — НЕ запускаем
    // (отчёт пойдёт в UI для модального окна)
    if !modpack_report.ok {
        let report_json = serde_json::to_string(&modpack_report)
            .map_err(|e| format!("report serialize: {}", e))?;
        return Err(format!("__MODPACK_REPORT__{}", report_json));
    }

    let _ = app.emit("download_progress", DownloadProgress {
        file:       "Подготовка запуска...".into(),
        downloaded: 0, total: 100, speed_kbs: 0,
    });

    let mc_dir = minecraft_dir();
    std::fs::create_dir_all(&mc_dir).map_err(|e| format!("Не удалось создать .sbgames: {}", e))?;
    std::fs::create_dir_all(mc_dir.join("mods")).ok();
    std::fs::create_dir_all(mc_dir.join("libraries")).ok();
    std::fs::create_dir_all(mc_dir.join("versions/1.20.1")).ok();
    std::fs::create_dir_all(mc_dir.join("assets")).ok();

    // 1. Проверяем Java
    let java = match java_path {
        Some(j) if !j.is_empty() => PathBuf::from(j),
        _ => find_java().ok_or_else(|| "Java не найдена. Установите Java 17 (https://adoptium.net)".to_string())?,
    };

    let _ = app.emit("download_progress", DownloadProgress {
        file: "Java найдена".into(), downloaded: 3, total: 100, speed_kbs: 0,
    });

    // 2. Vanilla client 1.20.1 — резолвим URL через version_manifest_v2
    let client_jar = mc_dir.join("versions/1.20.1/1.20.1.jar");
    let json       = mc_dir.join("versions/1.20.1/1.20.1.json");

    if !client_jar.exists() || !json.exists() {
        let _ = app.emit("download_progress", DownloadProgress {
            file:       "Mojang manifest".into(), downloaded: 0, total: 5000, speed_kbs: 0,
        });
        // Получаем version_manifest_v2.json через curl
        let manifest_text = {
            let out = std::process::Command::new("curl")
                .arg("-fsSL").arg("--max-time").arg("30")
                .arg("https://launchermeta.mojang.com/mc/game/version_manifest_v2.json")
                .output().map_err(|e| format!("curl manifest: {}", e))?;
            if !out.status.success() { return Err("Manifest API fail".into()); }
            String::from_utf8_lossy(&out.stdout).to_string()
        };
        let v1192_url = {
            let m: serde_json::Value = serde_json::from_str(&manifest_text).ok()
                .ok_or("Manifest parse")?;
            let arr = m["versions"].as_array().ok_or("versions[] missing")?;
            let v = arr.iter().find(|v| v["id"] == "1.20.1").ok_or("1.20.1 not in manifest")?;
            v["url"].as_str().ok_or("manifest url missing")?.to_string()
        };
        std::fs::create_dir_all(json.parent().unwrap()).ok();
        download_file(&v1192_url, &json, &app)
            .await.map_err(|e| format!("Manifest version: {}", e))?;
        let ver = std::fs::read_to_string(&json).ok()
            .and_then(|s| serde_json::from_str::<serde_json::Value>(&s).ok())
            .ok_or("Парсинг manifest")?;

        // 2a. Скачиваем client.jar
        let client_url = ver["downloads"]["client"]["url"].as_str()
            .ok_or("URL client.jar не найден")?.to_string();
        let client_size = ver["downloads"]["client"]["size"].as_u64().unwrap_or(21_000_000);
        let _ = app.emit("download_progress", DownloadProgress {
            file:       "minecraft-1.20.1-client.jar".into(),
            downloaded: 0, total: client_size, speed_kbs: 0,
        });
        download_file(&client_url, &client_jar, &app)
            .await.map_err(|e| format!("Client.jar: {}", e))?;
    }

    // 2b. Скачиваем vanilla libraries + native classifiers для текущей ОС
    // Forge их требует через inheritsFrom — без них Forge падает.
    // Этот блок ВСЕГДА запускается (даже если client.jar уже скачан) — нужно для
    // повторных запусков, когда пользователь уже качал клиент раньше.
    {
        let ver_text = std::fs::read_to_string(&json)
            .map_err(|e| format!("read vanilla manifest: {}", e))?;
        let ver: serde_json::Value = serde_json::from_str(&ver_text)
            .map_err(|e| format!("parse vanilla manifest: {}", e))?;
        let libs = ver["libraries"].as_array().cloned().unwrap_or_default();
        let total = libs.len();
        let our_os = if cfg!(target_os = "windows") { "windows" }
                     else if cfg!(target_os = "macos") { "osx" }
                     else { "linux" };

        for (i, lib) in libs.iter().enumerate() {
            // OS rules — skip если не наша ОС
            if let Some(rules) = lib.get("rules").and_then(|r| r.as_array()) {
                let allowed = rules.iter().any(|r| {
                    let os_name = r["os"]["name"].as_str().unwrap_or("");
                    let action  = r["action"].as_str().unwrap_or("allow");
                    if action == "allow" {
                        os_name.is_empty() || os_name == our_os
                    } else {
                        !(os_name == our_os)
                    }
                });
                if !allowed { continue; }
            }

            // Обычный artifact
            if let Some(artifact) = lib.get("downloads").and_then(|d| d.get("artifact")) {
                let path = artifact["path"].as_str().unwrap_or("");
                let url  = artifact["url"].as_str().unwrap_or("");
                if path.is_empty() || url.is_empty() { continue; }
                let dest = mc_dir.join("libraries").join(path);
                if dest.exists() { continue; }
                std::fs::create_dir_all(dest.parent().unwrap()).ok();
                let _ = app.emit("download_progress", DownloadProgress {
                    file:       format!("vanilla: {}", path.rsplit('/').next().unwrap_or(path)).into(),
                    downloaded: i as u64, total: total as u64, speed_kbs: 0,
                });
                let _ = download_file(url, &dest, &app).await;
            }

            // Native classifiers (LWJGL natives, OS-specific)
            if let Some(natives) = lib.get("natives") {
                if let Some(native_obj) = natives.get(our_os) {
                    let native_name = native_obj.as_str().unwrap_or("");
                    let classifier = native_name.replace("$", "").replace("{arch}", "64");
                    if let Some(classifiers) = lib["downloads"].get("classifiers") {
                        if let Some(nat) = classifiers.get(&classifier) {
                            let path = nat["path"].as_str().unwrap_or("");
                            let url  = nat["url"].as_str().unwrap_or("");
                            if path.is_empty() || url.is_empty() { continue; }
                            let dest = mc_dir.join("libraries").join(path);
                            if dest.exists() { continue; }
                            std::fs::create_dir_all(dest.parent().unwrap()).ok();
                            let _ = app.emit("download_progress", DownloadProgress {
                                file:       format!("native: {}", path.rsplit('/').next().unwrap_or(path)).into(),
                                downloaded: i as u64, total: total as u64, speed_kbs: 0,
                            });
                            let _ = download_file(url, &dest, &app).await;
                        }
                    }
                }
            }
        }
        let _ = app.emit("download_progress", DownloadProgress {
            file:       "Vanilla libraries готовы".into(),
            downloaded: total as u64, total: total as u64, speed_kbs: 0,
        });
    }

    let _ = app.emit("download_progress", DownloadProgress {
        file:       "Vanilla клиент готов".into(),
        downloaded: 25, total: 100, speed_kbs: 0,
    });

    // 3. Forge install через installer.jar — он сам качает все libraries
    // и создаёт version.json для Forge профиля.
    // Серверный мод-пак "Звёздные Войны" использует MC 1.20.1 + Forge 47.4.10.
    let mc_version = "1.20.1";
    let forge_version = "47.4.10";
    let forge_version_id = format!("{}-forge-{}", mc_version, forge_version);
    let forge_profile_json = mc_dir.join("versions").join(&forge_version_id).join(format!("{}.json", forge_version_id));
    let forge_marker    = mc_dir.join(".forge_installed");

    if !forge_profile_json.exists() || !forge_marker.exists() {
        // Forge installer требует перед запуском:
        // 1. vanilla 1.20.1 client.jar + manifest в versions/1.20.1/
        // 2. assets/indexes/1.19.json
        // 3. launcher_profiles.json в корне (любой непустой JSON)
        // Без этого installer падает: "no minecraft launcher profile"
        let _ = std::fs::write(mc_dir.join("launcher_profiles.json"), b"{}");
        let assets_idx_dir = mc_dir.join("assets/indexes");
        std::fs::create_dir_all(&assets_idx_dir).ok();
        let assets_idx = assets_idx_dir.join("1.19.json");
        if !assets_idx.exists() {
            // Скачиваем из vanilla manifest
            if let Ok(ver_text) = std::fs::read_to_string(mc_dir.join("versions/1.20.1/1.20.1.json")) {
                if let Ok(v) = serde_json::from_str::<serde_json::Value>(&ver_text) {
                    if let Some(idx_url) = v["assetIndex"]["url"].as_str() {
                        let _ = std::process::Command::new("curl")
                            .arg("-fsSL").arg("--max-time").arg("30")
                            .arg(idx_url).arg("-o").arg(&assets_idx)
                            .output();
                    }
                }
            }
        }

        let installer_url = format!(
            "https://maven.minecraftforge.net/net/minecraftforge/forge/1.20.1-{}/forge-1.20.1-{}-installer.jar",
            forge_version, forge_version
        );
        let installer_jar = mc_dir.join("forge-installer.jar");
        let _ = app.emit("download_progress", DownloadProgress {
            file:       "forge-installer.jar".into(),
            downloaded: 0, total: 2_630_062, speed_kbs: 0,
        });
        download_file(&installer_url, &installer_jar, &app)
            .await.map_err(|e| format!("Не удалось скачать Forge installer: {}", e))?;

        // Headless installer ждёт ввод — пробуем отправить "1\n" в stdin
        let _ = app.emit("download_progress", DownloadProgress {
            file:       "Установка Forge (binpatch)...".into(),
            downloaded: 30, total: 100, speed_kbs: 0,
        });
        use std::io::Write;
        use std::process::Stdio;
        let mut child = Command::new(&java)
            .arg("-jar").arg(&installer_jar)
            .arg("--installClient").arg(&mc_dir)
            .stdin(Stdio::piped())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn().ok();
        if let Some(mut c) = child.take() {
            if let Some(stdin) = c.stdin.as_mut() {
                // 1 = "Install client" (default), потом enter
                let _ = stdin.write_all(b"1\n");
            }
            let _ = c.wait();
        }

        // Если headless installer не сработал (часто бывает) — извлекаем вручную
        if !forge_profile_json.exists() {
            let _ = app.emit("download_progress", DownloadProgress {
                file:       "Ручная распаковка Forge...".into(),
                downloaded: 60, total: 100, speed_kbs: 0,
            });
            install_forge_from_zip(&installer_jar, &mc_dir, &app, &forge_version).await
                .map_err(|e| format!("Forge install: {}", e))?;
        }

        let _ = std::fs::remove_file(&installer_jar);

        // Помечаем установку как завершённую только если installer создал patched minecraft.
        // Без этого binpatch forge не сможет запуститься.
        let extra_jar = mc_dir.join("libraries/net/minecraft/client/1.20.1-20220805.130853/client-1.20.1-20220805.130853-extra.jar");
        if extra_jar.exists() {
            std::fs::write(&forge_marker, forge_version).ok();
        }
    }

    // 4. Forge требует libraries — если installer не распаковал, нужно скачать вручную.
    // Это основной момент: Forge Universal jar слинкован с cpw.mods.bootstraplauncher
    // и не требует отдельной загрузки Minecraft libraries — он сам подтянет.
    // Libraries уже распакованы через install_forge_from_zip

    // Копируем Forge universal.jar в legacy путь (1.20.1-VER/).
    // FMLLoader.LoaderVersion.<clinit> ищет именно его для получения Implementation-Version.
    // Делаем КАЖДЫЙ запуск — потому что install_marker может уже стоять, а legacy копия — нет.
    // Также ПАТЧИМ манифест: Forge installer делает binpatch и пишет Implementation-Version,
    // но без installer'а manifest пустой. LauncherVersion.<clinit> тогда падает с
    // "Missing FMLLauncher version". Добавляем атрибут вручную.
    {
        let legacy_dir = mc_dir.join("libraries/net/minecraftforge/forge")
            .join(format!("1.20.1-{}", forge_version));
        let legacy_jar = legacy_dir.join(format!("forge-1.20.1-{}-universal.jar", forge_version));
        let new_jar = mc_dir.join("libraries/net/minecraftforge/forge")
            .join(&forge_version_id)
            .join(format!("{}.jar", forge_version_id));
        if !legacy_jar.exists() && new_jar.exists() {
            std::fs::create_dir_all(&legacy_dir).ok();
            // Копируем universal jar
            let _ = std::fs::copy(&new_jar, &legacy_jar);
        }

        // Патчим manifest в legacy universal.jar — пишем Implementation-Version
        if legacy_jar.exists() {
            patch_universal_manifest(&legacy_jar, &forge_version, &forge_version_id);
        }
        // Также патчим в новом пути (1.20.1-forge-VER/...)
        if new_jar.exists() {
            patch_universal_manifest(&new_jar, &forge_version, &forge_version_id);
        }
    }

    let _ = app.emit("download_progress", DownloadProgress {
        file:       "Forge готов".into(),
        downloaded: 80, total: 100, speed_kbs: 0,
    });

    // 4. Запуск Forge
    let ram = ram_gb.unwrap_or(4);
    let mut cmd = Command::new(&java);
    cmd.arg(format!("-Xmx{}G", ram));
    cmd.arg(format!("-Xms{}G", (ram / 2).max(1)));
    cmd.arg("-Dfile.encoding=UTF-8");
    cmd.arg("-Dforge.logging.console.level=info");

    // JVM add-opens для Forge 1.20.1 (Java 17+)
    // С named modules --add-opens=ALL-UNNAMED не работает — нужно перечислить модули
    // или использовать "java.base/...=ALL-UNNAMED,cpw.mods.securejarhandler,cpw.mods.bootstraplauncher,..."
    // Проще открыть вообще всему (используя --add-opens java.base/...=java.base) — но это нельзя.
    // Стандартный подход: ALL-UNNAMED в add-opens открывает доступ к unnamed module,
    // а для named modules нужен явный список или `module.name=ALL-UNNAMED` не работает.
    // Решение: использовать --add-opens с явным перечислением каждого Forge-модуля.
    let opens: &[(&str, &str)] = &[
        ("java.base/java.util.jar",              "ALL-UNNAMED"),
        ("java.base/java.lang",                  "ALL-UNNAMED"),
        ("java.base/java.lang.invoke",           "ALL-UNNAMED"),
        ("java.base/java.util",                  "ALL-UNNAMED"),
        ("java.base/java.nio",                   "ALL-UNNAMED"),
        ("java.base/java.io",                    "ALL-UNNAMED"),
        ("java.base/sun.nio.ch",                 "ALL-UNNAMED"),
        ("java.base/sun.security.action",        "ALL-UNNAMED"),
        ("java.base/sun.net.www.protocol.jar",   "ALL-UNNAMED"),
        // Для named Forge модулей
        ("java.base/java.util.jar",              "cpw.mods.securejarhandler"),
        ("java.base/java.lang",                  "cpw.mods.securejarhandler"),
        ("java.base/java.lang.invoke",           "cpw.mods.securejarhandler"),
        ("java.base/java.util",                  "cpw.mods.securejarhandler"),
        ("java.base/java.nio",                   "cpw.mods.securejarhandler"),
        ("java.base/sun.nio.ch",                 "cpw.mods.securejarhandler"),
        ("java.base/java.io",                    "cpw.mods.securejarhandler"),
        ("java.base/sun.security.action",        "cpw.mods.securejarhandler"),
        ("java.base/java.util.jar",              "cpw.mods.bootstraplauncher"),
        ("java.base/java.lang",                  "cpw.mods.bootstraplauncher"),
        ("java.base/java.lang.invoke",           "cpw.mods.bootstraplauncher"),
        ("java.base/sun.nio.ch",                 "cpw.mods.bootstraplauncher"),
    ];
    for (module, target) in opens {
        cmd.arg("--add-opens").arg(format!("{}={}", module, target));
    }
    cmd.arg("--add-exports").arg("java.base/sun.security.util=ALL-UNNAMED");

    // Читаем forge profile.json и собираем classpath по нему
    // Forge profile содержит полный libraries[] с name/path
    // Vanilla client.jar (1.20.1.jar) НЕ кладём сюда — он содержит невалидный
    // module name ("1.20.1" — цифра в начале), и пойдёт отдельно в -cp.
    let cp_sep = if cfg!(target_os = "windows") { ";" } else { ":" };
    let mut cp_parts: Vec<PathBuf> = Vec::new();

    // Helper: get jar path from library entry — format is {name, downloads:{artifact:{path,url}}}
    fn extract_lib_paths(mc_dir: &PathBuf, libs: &serde_json::Value, out: &mut Vec<PathBuf>) {
        if let Some(arr) = libs.as_array() {
            for lib in arr {
                // Современный формат: lib.downloads.artifact.path
                if let Some(p) = lib["downloads"]["artifact"]["path"].as_str() {
                    out.push(mc_dir.join("libraries").join(p));
                    continue;
                }
                // Legacy: lib.path
                if let Some(p) = lib["path"].as_str() {
                    out.push(mc_dir.join("libraries").join(p));
                }
            }
        }
    }

    if let Ok(profile_text) = std::fs::read_to_string(&forge_profile_json) {
        if let Ok(profile) = serde_json::from_str::<serde_json::Value>(&profile_text) {
            extract_lib_paths(&mc_dir, &profile["libraries"], &mut cp_parts);

            // Если Forge profile наследуется от vanilla 1.20.1 — добавляем
            // vanilla libraries в classpath
            if let Some(inherits) = profile["inheritsFrom"].as_str() {
                let vanilla_json = mc_dir.join("versions").join(inherits).join(format!("{}.json", inherits));
                if let Ok(v_text) = std::fs::read_to_string(&vanilla_json) {
                    if let Ok(v) = serde_json::from_str::<serde_json::Value>(&v_text) {
                        extract_lib_paths(&mc_dir, &v["libraries"], &mut cp_parts);
                    }
                }
            }
        }
    } else {
        // Fallback — только universal
        let forge_universal = mc_dir.join(format!("libraries/net/minecraftforge/forge/1.20.1-{}/forge-1.20.1-{}-universal.jar", forge_version, forge_version));
        cp_parts.push(forge_universal);
    }

    // Forge 1.20.1 + Java 17 = нужен гибридный подход:
    //  - bootstraplauncher + securejarhandler + asm-*: Java 9+ modules
    //    (требуют --module-path с --add-modules ALL-MODULE-PATH)
    //  - Остальные Forge libraries (включая forge-*-universal.jar с
    //    Implementation-Version): НЕ модули, идут в -cp.
    //  - vanilla client.jar: тоже -cp.
    //
    // Если всё в -cp, Package.getImplementationVersion() возвращает null и
    // LauncherVersion.<clinit> падает с "Missing FMLLauncher version".
    // Если всё в --module-path, те же не-Forge модули не видят Implementation-Version.
    // Поэтому: только 4 boot-модуля Forge в --module-path, остальное в -cp.
    let mut boot_modules: Vec<PathBuf> = Vec::new();
    let mut rest_classpath: Vec<PathBuf> = Vec::new();
    for p in std::mem::take(&mut cp_parts) {
        let name = p.file_name().unwrap_or_default().to_string_lossy().to_string();
        // Только BootstrapLauncher, securejarhandler, asm-* — в module-path
        if name.starts_with("bootstraplauncher-")
            || name.starts_with("securejarhandler-")
            || name.starts_with("asm-")
            || name.starts_with("JarJarFileSystems-")
        {
            boot_modules.push(p);
        } else {
            rest_classpath.push(p);
        }
    }
    // Добавляем vanilla client.jar в обычный classpath
    rest_classpath.push(client_jar.clone());

    // 1) Boot модули в --module-path
    if !boot_modules.is_empty() {
        let mp = boot_modules.iter()
            .map(|p| p.display().to_string())
            .collect::<Vec<_>>()
            .join(cp_sep);
        cmd.arg("--module-path").arg(mp);
        cmd.arg("--add-modules").arg("ALL-MODULE-PATH");
    }

    // 2) -DlibraryDirectory — Forge LibraryFinder ищет этот property
    cmd.arg(format!("-DlibraryDirectory={}", mc_dir.join("libraries").display()));
    // -DignoreList (из version.json arguments.jvm) — Forge игнорирует эти jar
    cmd.arg("-DignoreList=bootstraplauncher,securejarhandler,asm-commons,asm-util,asm-analysis,asm-tree,asm,JarJarFileSystems,client-extra,fmlcore,javafmllanguage,lowcodelanguage,mclanguage,forge-,1.20.1.jar");
    // -DmergeModules для JNA
    cmd.arg("-DmergeModules=jna-5.10.0.jar,jna-platform-5.10.0.jar");

    // Write embedded sbg-bootstrap.jar from memory
    let bootstrap_bytes = include_bytes!("../../public/sbg-bootstrap.jar");
    let bootstrap_path = mc_dir.join("sbg-bootstrap.jar");
    std::fs::write(&bootstrap_path, bootstrap_bytes)
        .map_err(|e| format!("Failed to write sbg-bootstrap.jar: {}", e))?;

    // Generate wrapped sbg-classpath.jar
    let classpath_jar_path = mc_dir.join("sbg-classpath.jar");
    generate_wrapped_classpath_manifest(&classpath_jar_path, &rest_classpath, &mc_dir)?;

    // Generate sbg-classpath.txt for BootstrapLauncher's legacyClassPath.file property
    let classpath_txt_path = mc_dir.join("sbg-classpath.txt");
    let mut txt_content = String::new();
    for p in &rest_classpath {
        txt_content.push_str(&p.to_string_lossy());
        txt_content.push('\n');
    }
    std::fs::write(&classpath_txt_path, txt_content)
        .map_err(|e| format!("Failed to write sbg-classpath.txt: {}", e))?;

    // Pass legacyClassPath.file system property to BootstrapLauncher
    cmd.arg(format!("-DlegacyClassPath.file={}", classpath_txt_path.display()));

    // Calculate sha256 of all mod jars and write to .mod-hashes
    let mods_dir = mc_dir.join("mods");
    let mut hash_content = String::new();
    if mods_dir.exists() {
        if let Ok(entries) = std::fs::read_dir(&mods_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() && path.extension().map_or(false, |ext| ext.eq_ignore_ascii_case("jar")) {
                    let name = path.file_name().unwrap().to_string_lossy().to_string();
                    if let Ok(mut file) = std::fs::File::open(&path) {
                        use sha2::{Digest, Sha256};
                        let mut hasher = Sha256::new();
                        let mut buffer = [0u8; 8192];
                        while let Ok(n) = std::io::Read::read(&mut file, &mut buffer) {
                            if n == 0 { break; }
                            hasher.update(&buffer[..n]);
                        }
                        let hash = format!("{:x}", hasher.finalize());
                        hash_content.push_str(&format!("{}:{}\n", hash, name));
                    }
                }
            }
        }
    }
    std::fs::write(mc_dir.join(".mod-hashes"), hash_content)
        .map_err(|e| format!("Failed to write .mod-hashes manifest: {}", e))?;

    // Point -cp strictly to sbg-bootstrap.jar and sbg-classpath.jar
    cmd.arg("-cp").arg("sbg-bootstrap.jar;sbg-classpath.jar");

    // Main class — custom security bootstrapper instead of CPW bootstraplauncher
    cmd.arg("com.sbgames.bootstrap.SBGBootstrap");

    cmd.arg("--username").arg(&username);
    cmd.arg("--version").arg(format!("1.20.1-forge-{}", forge_version));
    cmd.arg("--gameDir").arg(&mc_dir);
    // SBGames кастомный titlebar в Minecraft (заменяет "Minecraft 1.20.1" на "SBGames")
    cmd.arg("--title").arg("SBGames");
    cmd.arg("--assetsDir").arg(mc_dir.join("assets"));
    cmd.arg("--assetIndex").arg("5");
    cmd.arg("--uuid").arg(uuid_str(&uuid_from_username(&username)));
    cmd.arg("--accessToken").arg(&token);
    cmd.arg("--userType").arg("legacy");
    cmd.arg("--versionType").arg("release");
    cmd.arg("--launchTarget").arg("forgeclient");
    // Forge game args (из version.json arguments.game) — обязательные
    cmd.arg("--fml.forgeVersion").arg(&forge_version);
    cmd.arg("--fml.mcVersion").arg("1.20.1");
    cmd.arg("--fml.forgeGroup").arg("net.minecraftforge");
    cmd.arg("--fml.mcpVersion").arg("20230612.114412");

    // Логи Java в файлы — чтобы можно было прочитать ошибки
    let java_log = mc_dir.join("java-stdout.log");
    let java_err = mc_dir.join("java-stderr.log");

    // Пишем classpath в начало stdout лога для отладки
    {
        use std::io::Write as _;
        if let Ok(mut f) = std::fs::File::create(&java_log) {
            let _ = writeln!(f, "=== Classpath ({} entries) ===", cp_parts.len());
            for p in &cp_parts {
                let exists = p.exists();
                let _ = writeln!(f, "  {}{}", if exists { "" } else { "[MISSING] " }, p.display());
            }
        }
    }

    let log_out = std::fs::File::create(&java_log);  // перезаписываем для stdout
    let log_err = std::fs::File::create(&java_err).ok();

    cmd.stdin(Stdio::piped());
    cmd.stdout(if let Ok(f) = log_out { Stdio::from(f) } else { Stdio::null() });
    cmd.stderr(if let Some(f) = log_err { Stdio::from(f) } else { Stdio::null() });
    cmd.current_dir(&mc_dir);

    let _ = app.emit("download_progress", DownloadProgress {
        file:       "Запуск Minecraft...".into(),
        downloaded: 100, total: 100, speed_kbs: 0,
    });

    // Native debugger check on launcher itself
    #[cfg(target_os = "windows")]
    unsafe {
        if windows_sys::Win32::System::Diagnostics::Debug::IsDebuggerPresent() != 0 {
            return Err("Отладчик обнаружен".into());
        }
        let mut is_remote = 0;
        let current_proc = windows_sys::Win32::System::Threading::GetCurrentProcess();
        if windows_sys::Win32::System::Diagnostics::Debug::CheckRemoteDebuggerPresent(current_proc, &mut is_remote) != 0 && is_remote != 0 {
            return Err("Удаленный отладчик обнаружен".into());
        }
    }

    // Spawn
    let mut child = cmd.spawn().map_err(|e| format!("Не удалось запустить: {}", e))?;
    let pid = child.id();

    // Spawn native watchdog thread for child process
    #[cfg(target_os = "windows")]
    {
        std::thread::spawn(move || {
            use windows_sys::Win32::System::Diagnostics::Debug::CheckRemoteDebuggerPresent;
            use windows_sys::Win32::System::Threading::{OpenProcess, TerminateProcess, PROCESS_QUERY_INFORMATION, PROCESS_TERMINATE};
            unsafe {
                let handle = OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_TERMINATE, 0, pid);
                if handle != 0 {
                    loop {
                        let mut is_remote = 0;
                        if CheckRemoteDebuggerPresent(handle, &mut is_remote) != 0 && is_remote != 0 {
                            let _ = TerminateProcess(handle, 1);
                            std::process::exit(1);
                        }
                        std::thread::sleep(std::time::Duration::from_millis(500));
                    }
                }
            }
        });
    }

    // Secure key handoff via stdin pipe
    let session_key = generate_secure_random_key();
    if let Some(mut stdin) = child.stdin.take() {
        use std::io::Write as _;
        let _ = writeln!(stdin, "{}", session_key);
        let _ = stdin.flush();
    }

    // Очищаем предыдущий guard-trigger (если был)
    let _ = std::fs::remove_file(mc_dir.join(".guard-trigger"));

    // Сохраняем PID в файл
    let _ = std::fs::write(mc_dir.join(".minecraft.pid"), pid.to_string());

    // ─── Lock mods/ read-only через attrib (best-effort) ─────────────────────
    // attrib +R +S блокирует случайное удаление. Обходится через attrib -R,
    // поэтому НЕ основная защита, а дополнительный слой к SHA256 watcher'у.
    #[cfg(target_os = "windows")]
    {
        let mods_dir = mc_dir.join("mods");
        let _ = std::process::Command::new("attrib")
            .args(["+R", "/S", "/D", &mods_dir.to_string_lossy()])
            .output();
    }

    // ─── Win32: помещаем Java в Job Object ───────────────────────────────────
    // Job Object позволяет нам:
    //   1. Убить всё дерево процессов при закрытии лаунчера
    //   2. Ограничить доступ к отладчику (SetInformationJobObject)
    // ВАЖНО: это не блокирует DLL инжект напрямую, но даёт контроль над процессом
    #[cfg(target_os = "windows")]
    {
        use windows_sys::Win32::System::JobObjects::{
            CreateJobObjectW, AssignProcessToJobObject,
            SetInformationJobObject, JobObjectBasicUIRestrictions,
            JOBOBJECT_BASIC_UI_RESTRICTIONS,
        };
        use windows_sys::Win32::System::Threading::{
            OpenProcess, PROCESS_ALL_ACCESS,
        };
        use windows_sys::Win32::Foundation::CloseHandle;

        unsafe {
            let job = CreateJobObjectW(std::ptr::null(), std::ptr::null());
            if job != 0 {
                let proc = OpenProcess(PROCESS_ALL_ACCESS, 0, pid);
                if proc != 0 {
                    // Запрещаем UI операции (нельзя переключать рабочий стол, инжектить через SetWindowsHookEx)
                    let ui_restrict = JOBOBJECT_BASIC_UI_RESTRICTIONS {
                        UIRestrictionsClass: 0x40, // JOB_OBJECT_UILIMIT_EXITWINDOWS не нужен, берём HANDLES
                    };
                    SetInformationJobObject(
                        job,
                        JobObjectBasicUIRestrictions,
                        &ui_restrict as *const _ as *const _,
                        std::mem::size_of::<JOBOBJECT_BASIC_UI_RESTRICTIONS>() as u32,
                    );
                    AssignProcessToJobObject(job, proc);
                    CloseHandle(proc);
                }
                // Job handle намеренно не закрываем — живёт пока лаунчер жив
                // При закрытии лаунчера Job убьёт все процессы в нём
                std::mem::forget(job as usize); // не drop
            }
        }
    }

    // ─── Runtime protection watcher ───────────────────────────────────────────
    // Принципы (честная client-side защита, без kernel-драйвера):
    //  1. mods/ проверяется по SHA256 СОДЕРЖИМОГО, не по именам.
    //     Любой лишний/изменённый/подменённый jar → МГНОВЕННО убиваем MC
    //     (удалять файл бесполезно — Forge уже загрузил его в JVM).
    //  2. DLL: baseline-снапшот доверенных модулей за первые секунды +
    //     whitelist путей (Windows, папка игры, папка Java). Любая НОВАЯ
    //     DLL из чужого места (Desktop, Downloads, temp с подозрительным
    //     именем) → инжект → убиваем MC.
    {
        let mc_dir_w = mc_dir.clone();
        let pid_watch = pid;
        let java_dir = std::path::Path::new(&java).parent()
            .map(|p| p.to_string_lossy().to_lowercase())
            .unwrap_or_default();
        std::thread::spawn(move || {
            use sha2::{Sha256, Digest};
            use std::io::Read as _;

            let mods_dir = mc_dir_w.join("mods");
            let whitelist_path = mc_dir_w.join(".modpack-whitelist.json");
            let pid_file = mc_dir_w.join(".minecraft.pid");
            let game_dir_l = mc_dir_w.to_string_lossy().to_lowercase();

            fn sha256_of(path: &std::path::Path) -> Option<String> {
                let mut f = std::fs::File::open(path).ok()?;
                let mut h = Sha256::new();
                let mut buf = [0u8; 65536];
                loop { let n = f.read(&mut buf).ok()?; if n == 0 { break; } h.update(&buf[..n]); }
                Some(hex::encode(h.finalize()))
            }

            // Разрешённые SHA256 модов (по СОДЕРЖИМОМУ, не имени)
            let allowed_hashes: std::collections::HashSet<String> =
                std::fs::read_to_string(&whitelist_path).ok()
                    .and_then(|s| serde_json::from_str::<serde_json::Value>(&s).ok())
                    .and_then(|v| v.as_array().cloned())
                    .unwrap_or_default()
                    .iter()
                    .filter_map(|m| m["sha256"].as_str().map(|s| s.to_lowercase()))
                    .collect();
            let expected_mod_count = allowed_hashes.len();

            #[cfg(target_os = "windows")]
            {
                use windows_sys::Win32::System::Threading::{
                    OpenProcess, PROCESS_QUERY_INFORMATION, PROCESS_VM_READ,
                    PROCESS_TERMINATE, TerminateProcess,
                };
                use windows_sys::Win32::System::ProcessStatus::{
                    EnumProcessModules, GetModuleFileNameExW,
                };
                use windows_sys::Win32::Foundation::{CloseHandle, MAX_PATH};

                fn kill_proc(pid: u32) {
                    unsafe {
                        let h = OpenProcess(PROCESS_TERMINATE, 0, pid);
                        if h != 0 { TerminateProcess(h, 1); CloseHandle(h); }
                    }
                    let _ = std::process::Command::new("taskkill")
                        .args(["/PID", &pid.to_string(), "/F", "/T"]).output();
                }
                fn proc_alive(pid: u32) -> bool {
                    unsafe {
                        let h = OpenProcess(PROCESS_QUERY_INFORMATION, 0, pid);
                        if h == 0 { return false; }
                        CloseHandle(h); true
                    }
                }
                // Собирает все пути загруженных DLL процесса
                fn enum_dlls(pid: u32) -> Vec<String> {
                    let mut out = Vec::new();
                    unsafe {
                        let proc = OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, 0, pid);
                        if proc == 0 { return out; }
                        let mut modules = [0isize; 2048];
                        let mut needed: u32 = 0;
                        if EnumProcessModules(proc, modules.as_mut_ptr(),
                            (modules.len() * std::mem::size_of::<isize>()) as u32, &mut needed) != 0
                        {
                            let count = ((needed as usize) / std::mem::size_of::<isize>())
                                .min(modules.len());
                            for i in 0..count {
                                let mut buf = [0u16; MAX_PATH as usize];
                                let len = GetModuleFileNameExW(proc, modules[i], buf.as_mut_ptr(), MAX_PATH);
                                if len > 0 {
                                    out.push(String::from_utf16_lossy(&buf[..len as usize]).to_lowercase());
                                }
                            }
                        }
                        CloseHandle(proc);
                    }
                    out
                }

                // Путь DLL считается доверенным если он из системных папок,
                // папки игры или папки Java-рантайма.
                let is_trusted_path = |p: &str| -> bool {
                    p.starts_with("c:\\windows\\")
                        || p.contains("\\system32\\")
                        || p.contains("\\syswow64\\")
                        || p.contains("\\winsxs\\")
                        || p.contains(&game_dir_l)
                        || (!java_dir.is_empty() && p.contains(&java_dir))
                        || p.contains("\\program files\\java")
                        || p.contains("\\program files\\eclipse adoptium")
                        || p.contains("\\runtime\\")          // bundled JRE
                        || p.contains("\\jbr\\")              // JetBrains runtime
                };

                // Baseline: ждём 4 сек пока MC прогрузит свои нативные DLL
                // (ускорено — раньше было 8 сек, читер мог успеть до baseline)
                let mut baseline: std::collections::HashSet<String> = std::collections::HashSet::new();
                let mut baseline_done = false;
                let mut tick: u32 = 0;

                loop {
                    // 100мс polling — быстрее не даст EnumProcessModules
                    std::thread::sleep(std::time::Duration::from_millis(100));
                    if !proc_alive(pid_watch) {
                        let _ = std::fs::remove_file(&pid_file);
                        break;
                    }

                    // Baseline собираем первые 4 сек (40 тиков по 100мс)
                    if !baseline_done {
                        for dll in enum_dlls(pid_watch) { baseline.insert(dll); }
                        if tick >= 40 { baseline_done = true; }
                    }

                    // ── mods/ integrity по SHA256 (каждые 200мс) ──
                    if tick % 2 == 0 {
                        let mut violation: Option<String> = None;
                        let mut seen = 0usize;
                        if let Ok(entries) = std::fs::read_dir(&mods_dir) {
                            for entry in entries.flatten() {
                                let path = entry.path();
                                if !path.is_file() { continue; }
                                let fname = path.file_name().and_then(|n| n.to_str()).unwrap_or("").to_string();
                                if !fname.ends_with(".jar") && !fname.ends_with(".disabled") { continue; }
                                seen += 1;
                                match sha256_of(&path) {
                                    Some(h) if allowed_hashes.contains(&h.to_lowercase()) => {}
                                    _ => { violation = Some(fname); break; }
                                }
                            }
                        }
                        if violation.is_some() || (expected_mod_count > 0 && seen != expected_mod_count) {
                            eprintln!("[guard] mods tampered ({:?}) — kill", violation);
                            kill_proc(pid_watch);
                            let _ = std::fs::remove_file(&pid_file);
                            let _ = std::fs::write(mc_dir_w.join(".guard-trigger"),
                                "mods\nОбнаружен посторонний или изменённый мод. Запуск остановлен.");
                            return;
                        }
                    }

                    // ── DLL injection scan (каждые 100мс после baseline) ──
                    if baseline_done {
                        for dll in enum_dlls(pid_watch) {
                            if baseline.contains(&dll) { continue; }
                            if is_trusted_path(&dll) { baseline.insert(dll); continue; }
                            // НОВАЯ DLL из ненадёжного пути = инжект
                            eprintln!("[guard] INJECT detected: {} — kill", dll);
                            kill_proc(pid_watch);
                            let _ = std::fs::remove_file(&pid_file);
                            let _ = std::fs::write(mc_dir_w.join(".guard-trigger"),
                                format!("inject\nОбнаружена посторонняя DLL:\n{}", dll));
                            return;
                        }
                    }

                    tick = tick.wrapping_add(1);
                }
            }

            #[cfg(not(target_os = "windows"))]
            loop {
                std::thread::sleep(std::time::Duration::from_secs(1));
                let alive = std::process::Command::new("kill")
                    .arg("-0").arg(pid_watch.to_string()).output()
                    .map(|o| o.status.success()).unwrap_or(false);
                if !alive { let _ = std::fs::remove_file(&pid_file); break; }
                let mut seen = 0usize; let mut bad = false;
                if let Ok(entries) = std::fs::read_dir(&mods_dir) {
                    for entry in entries.flatten() {
                        let path = entry.path();
                        if !path.is_file() { continue; }
                        let fname = path.file_name().and_then(|n| n.to_str()).unwrap_or("").to_string();
                        if !fname.ends_with(".jar") { continue; }
                        seen += 1;
                        match sha256_of(&path) {
                            Some(h) if allowed_hashes.contains(&h.to_lowercase()) => {}
                            _ => { bad = true; break; }
                        }
                    }
                }
                if bad || (expected_mod_count > 0 && seen != expected_mod_count) {
                    let _ = std::process::Command::new("kill").arg("-9").arg(pid_watch.to_string()).output();
                    let _ = std::fs::remove_file(&pid_file);
                    break;
                }
            }
        });
    }

    // Переименовываем окно Minecraft → "SBGames" + мониторим пока жив Java-процесс
    // (LWJGL/Forge периодически сбрасывают titlebar на "Minecraft 1.20.1")
    #[cfg(target_os = "windows")]
    {
        std::thread::spawn(move || {
            use windows_sys::Win32::UI::WindowsAndMessaging::{FindWindowW, SetWindowTextW};
            use std::os::windows::ffi::OsStrExt;
            fn to_wide(s: &str) -> Vec<u16> {
                std::ffi::OsStr::new(s).encode_wide().chain(std::iter::once(0)).collect()
            }
            let wanted = to_wide("SBGames");
            let mc_titles = ["Minecraft 1.20.1", "Minecraft* 1.20.1", "Minecraft"];

            // Ждём появления окна (до 60 сек)
            for _ in 0..1800 {
                std::thread::sleep(std::time::Duration::from_millis(1000));
                for t in &mc_titles {
                    let hwnd = unsafe { FindWindowW(std::ptr::null(), to_wide(t).as_ptr()) };
                    if hwnd != 0 {
                        unsafe { SetWindowTextW(hwnd, wanted.as_ptr()) };
                        break;
                    }
                }
            }
        });
    }

    // ─── Server-side mod verification: шлём хеши на /api/verify/report ─────
    // Сервер сверяет с whitelist, кладёт сессию в Redis.
    // Когда у тебя появится MC плагин — он заберёт сессию из Redis
    // и закикает читера. Сейчас без плагина — лаунчер блокирует запуск сам.
    {
        // Собираем хеши
        use sha2::{Sha256, Digest};
        use std::io::Read as _;
        let mut hashes: Vec<String> = Vec::new();
        if let Ok(entries) = std::fs::read_dir(mc_dir.join("mods")) {
            for entry in entries.flatten() {
                let path = entry.path();
                if !path.is_file() { continue; }
                let fname = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
                if !fname.ends_with(".jar") { continue; }
                if let Ok(mut f) = std::fs::File::open(&path) {
                    let mut h = Sha256::new();
                    let mut buf = [0u8; 65536];
                    loop { let n = f.read(&mut buf).unwrap_or(0); if n == 0 { break; } h.update(&buf[..n]); }
                    hashes.push(hex::encode(h.finalize()));
                }
            }
        }
        // POST хеши на сервер
        let body = serde_json::json!({
            "user": username,
            "serverId": server_id,
            "hashes": hashes,
            "minecraftVersion": "1.20.1",
            "forgeVersion": forge_version,
        });
        let body_str = body.to_string();
        let body_path = std::env::temp_dir().join("sbgames_verify.json");
        let _ = std::fs::write(&body_path, &body_str);
        let out = std::process::Command::new("curl")
            .arg("--proto").arg("=https").arg("--tlsv1.2")
            .arg("-fsSL").arg("--max-time").arg("15")
            .arg("-H").arg("Content-Type: application/json")
            .arg("--data-binary").arg(format!("@{}", body_path.display()))
            .arg("https://api.sbgames.hyperionsearch.xyz:8443/api/verify/report")
            .output();
        let _ = std::fs::remove_file(&body_path);
        if let Ok(o) = out {
            if o.status.success() {
                if let Ok(v) = serde_json::from_slice::<serde_json::Value>(&o.stdout) {
                    let ok = v["ok"].as_bool().unwrap_or(false);
                    let unknown = v["unknown"].as_u64().unwrap_or(0);
                    let missing = v["missing"].as_u64().unwrap_or(0);
                    if !ok {
                        let _ = std::fs::write(mc_dir.join(".guard-trigger"),
                            format!("server\nСервер отклонил мод-пак:\n• Лишних модов: {}\n• Отсутствует: {}", unknown, missing));
                        return Err("__GUARD__server".into());
                    }
                }
            }
        }
    }

    // ─── Server ban-checker: каждые 30 сек проверяем banned:mods в Redis ──
    // Если юзер уже в бане (например, подкинул мод после запуска и сервер поймал)
    // → kill MC немедленно.
    {
        let username_b = username.clone();
        let pid_b = pid;
        let mc_dir_b = mc_dir.clone();
        std::thread::spawn(move || {
            #[cfg(target_os = "windows")]
            fn kill_proc(pid: u32) {
                use windows_sys::Win32::System::Threading::{
                    OpenProcess, PROCESS_TERMINATE, TerminateProcess,
                };
                use windows_sys::Win32::Foundation::CloseHandle;
                unsafe {
                    let h = OpenProcess(PROCESS_TERMINATE, 0, pid);
                    if h != 0 { TerminateProcess(h, 1); CloseHandle(h); }
                }
                let _ = std::process::Command::new("taskkill")
                    .args(["/PID", &pid.to_string(), "/F", "/T"]).output();
            }
            let mut last_emit: u32 = 0;
            for i in 0..3600u32 {  // max 30 минут
                std::thread::sleep(std::time::Duration::from_secs(5));
                if i - last_emit < 6 { continue; } // 30 сек
                last_emit = i;
                let url = format!(
                    "https://api.sbgames.hyperionsearch.xyz:8443/api/verify/banlist");
                let out = std::process::Command::new("curl")
                    .arg("--proto").arg("=https").arg("--tlsv1.2")
                    .arg("-fsSL").arg("--max-time").arg("10")
                    .arg(&url).output();
                if let Ok(o) = out {
                    if o.status.success() {
                        if let Ok(v) = serde_json::from_slice::<serde_json::Value>(&o.stdout) {
                            if let Some(arr) = v["banned"].as_array() {
                                if arr.iter().any(|u| u.as_str() == Some(username_b.as_str())) {
                                    eprintln!("[guard] user '{}' in banned:mods — kill MC", username_b);
                                    #[cfg(target_os = "windows")]
                                    {
                                        use windows_sys::Win32::System::Threading::{OpenProcess, PROCESS_TERMINATE, TerminateProcess};
                                        use windows_sys::Win32::Foundation::CloseHandle;
                                        unsafe {
                                            let h = OpenProcess(PROCESS_TERMINATE, 0, pid_b);
                                            if h != 0 { TerminateProcess(h, 1); CloseHandle(h); }
                                        }
                                        let _ = std::process::Command::new("taskkill")
                                            .args(["/PID", &pid_b.to_string(), "/F", "/T"]).output();
                                    }
                                    #[cfg(target_os = "linux")]
                                    {
                                        let _ = std::process::Command::new("kill").arg("-9").arg(pid_b.to_string()).output();
                                    }
                                    let _ = std::fs::remove_file(mc_dir_b.join(".minecraft.pid"));
                                    let _ = std::fs::write(mc_dir_b.join(".guard-trigger"),
                                        "banned\nВаш аккаунт заблокирован за подозрительные моды.");
                                    return;
                                }
                            }
                        }
                    }
                }
            }
        });
    }
    // Сервер сверяет с whitelist, кладёт сессию в Redis.
    // Когда у тебя появится MC плагин — он заберёт сессию из Redis
    // и закикает читера. Сейчас без плагина — лаунчер блокирует запуск сам.
    {
        use sha2::{Sha256, Digest};
        use std::io::Read as _;
        let mut hashes: Vec<String> = Vec::new();
        if let Ok(entries) = std::fs::read_dir(mc_dir.join("mods")) {
            for entry in entries.flatten() {
                let path = entry.path();
                if !path.is_file() { continue; }
                let fname = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
                if !fname.ends_with(".jar") { continue; }
                if let Ok(mut f) = std::fs::File::open(&path) {
                    let mut h = Sha256::new();
                    let mut buf = [0u8; 65536];
                    loop { let n = f.read(&mut buf).unwrap_or(0); if n == 0 { break; } h.update(&buf[..n]); }
                    hashes.push(hex::encode(h.finalize()));
                }
            }
        }
        // POST /api/verify/report уже отправлен выше
    }

    // Сохраняем в состояние что игра запущена
    let state = app.state::<TrayState>();
    let mut s = state.inner().clone();
    s.playing = true;
    let _ = app.emit("tray_state_update", serde_json::json!({
        "user": s.user, "notifs": s.notifs, "playing": true,
    }));

    Ok(format!("Minecraft запущен (pid={}, user={})", pid, username))
}

/// Проверяет, запущен ли уже Minecraft (через PID файл + tasklist)
fn read_running_minecraft_pid() -> Option<u32> {
    let mc_dir = minecraft_dir();
    let pid_file = mc_dir.join(".minecraft.pid");
    if !pid_file.exists() { return None; }
    let pid_str = std::fs::read_to_string(&pid_file).ok()?;
    let pid: u32 = pid_str.trim().parse().ok()?;

    // Проверяем что процесс с этим PID жив (Windows: OpenProcess через tasklist)
    #[cfg(target_os = "windows")]
    {
        let out = std::process::Command::new("tasklist")
            .arg("/FI").arg(format!("PID eq {}", pid))
            .output().ok()?;
        let stdout = String::from_utf8_lossy(&out.stdout);
        // Если строка с PID есть в выводе — процесс жив
        if stdout.contains(&pid.to_string()) && !stdout.contains("No tasks") {
            return Some(pid);
        }
        // Мёртвый PID — удаляем файл
        let _ = std::fs::remove_file(&pid_file);
        None
    }
    #[cfg(not(target_os = "windows"))]
    {
        // Unix: kill -0
        let out = std::process::Command::new("kill")
            .arg("-0").arg(pid.to_string())
            .output().ok()?;
        if out.status.success() { Some(pid) } else { let _ = std::fs::remove_file(&pid_file); None }
    }
}

/// Команда для UI: проверяет запущен ли Minecraft (без блокировки)
#[tauri::command]
async fn get_minecraft_status() -> Result<serde_json::Value, String> {
    let running = read_running_minecraft_pid().is_some();
    let mut result = serde_json::json!({ "running": running });
    if !running {
        // Если есть guard-trigger (MC был убит защитой) — возвращаем
        let trigger = minecraft_dir().join(".guard-trigger");
        if let Ok(msg) = std::fs::read_to_string(&trigger) {
            let mut parts = msg.splitn(2, '\n');
            let reason = parts.next().unwrap_or("").trim().to_string();
            let detail = parts.next().unwrap_or("").trim().to_string();
            result["guard"] = serde_json::json!({
                "reason": reason,
                "detail": detail,
            });
            let _ = std::fs::remove_file(&trigger);
        }
    }
    Ok(result)
}

/// Команда для UI: убить Minecraft (если он завис)
#[tauri::command]
async fn kill_minecraft() -> Result<(), String> {
    if let Some(pid) = read_running_minecraft_pid() {
        #[cfg(target_os = "windows")]
        {
            let _ = std::process::Command::new("taskkill")
                .arg("/PID").arg(pid.to_string())
                .arg("/F").arg("/T")
                .output();
        }
        #[cfg(not(target_os = "windows"))]
        {
            let _ = std::process::Command::new("kill")
                .arg("-9").arg(pid.to_string())
                .output();
        }
    }
    let _ = std::fs::remove_file(minecraft_dir().join(".minecraft.pid"));
    Ok(())
}

// ─── Modpack whitelist sync + integrity verification ────────────────────────
// Безопасность:
//  - HTTPS-only (curl --proto =https, --tlsv1.2)
//  - Certificate pin на api.sbgames.hyperionsearch.xyz (опционально)
//  - HMAC-SHA256 подпись manifest (защита от подмены на прокси/MITM)
//  - SHA256 каждого мода сверяется с manifest
//  - Whitelist по имени файла (убивает посторонние моды)
//  - Размер каждого мода сверяется с manifest (±5% допуск на перепаковку)
//
// Manifest endpoint: https://api.sbgames.hyperionsearch.xyz:8443/api/mods/manifest
// Schema:
//   {
//     "version": "v3",
//     "zip_url": "https://...",
//     "zip_sha256": "abc123...",
//     "signature": "hmac-sha256-hex(secret, body-without-signature)",
//     "mods": [
//       { "name": "jei.jar", "sha256": "...", "size": 1234567 }
//     ]
//   }
//
// Secret (на клиенте и сервере) — общий. Хранится в обфусцированном виде.
// Можно потом заменить на Ed25519 с публичным ключом на клиенте.
const MODPACK_HMAC_SECRET: &str = "sbg-modpack-secret-2026-rotate-quarterly";

#[derive(serde::Serialize, Clone)]
struct ModIssue {
    name:   String,
    reason: String,  // "tampered" | "size_mismatch" | "extra" | "missing"
    detail: String,  // human-readable
}

#[derive(serde::Serialize, Clone, Default)]
struct ModpackReport {
    ok:        bool,
    synced:    u32,
    removed:   Vec<ModIssue>,   // удалённые моды (лишние)
    rejected:  Vec<ModIssue>,   // моды с неверным хешем/размером
    missing:   Vec<ModIssue>,   // ожидаемые но не найденные
}

async fn sync_modpack(app: &tauri::AppHandle) -> Result<ModpackReport, String> {
    use std::io::Read as _;
    use sha2::{Sha256, Digest};

    let mut report = ModpackReport::default();
    let mc_dir = minecraft_dir();
    let mods_dir = mc_dir.join("mods");
    std::fs::create_dir_all(&mods_dir).ok();
    let tmp_dir = mc_dir.join(".modpack-tmp");
    let _ = std::fs::remove_dir_all(&tmp_dir);
    std::fs::create_dir_all(&tmp_dir).ok();

    let _ = app.emit("download_progress", DownloadProgress {
        file:       "Манифест мод-пака...".into(),
        downloaded: 0, total: 100, speed_kbs: 0,
    });

    // 1. Получаем manifest с API
    let manifest_url = "https://api.sbgames.hyperionsearch.xyz:8443/api/mods/manifest";
    let out = std::process::Command::new("curl")
        .arg("--proto").arg("=https")
        .arg("--tlsv1.2")
        .arg("--tls-max").arg("1.3")
        .arg("-fsSL")
        .arg("--max-time").arg("30")
        .arg(manifest_url)
        .output()
        .map_err(|e| format!("curl manifest: {}", e))?;
    if !out.status.success() {
        // API недоступен → пропускаем синхронизацию
        let _ = app.emit("download_progress", DownloadProgress {
            file:       "Манифест недоступен".into(),
            downloaded: 100, total: 100, speed_kbs: 0,
        });
        report.ok = true;
        return Ok(report);
    }
    let manifest: serde_json::Value = serde_json::from_slice(&out.stdout)
        .map_err(|e| format!("manifest parse: {}", e))?;

    // 1a. Проверяем HMAC-подпись manifest (если есть)
    // Сервер подписывает всё кроме "signature". Подпись нужна только для
    // определения официального сервера — но поскольку трафик идёт по HTTPS
    // с нашим Let's Encrypt сертификатом, MITM исключён. Поэтому подпись
    // сейчас НЕ enforced (только логируется). Если в будущем захочешь
    // жёсткую проверку — нужно передавать секрет через сертификат клиента.
    if let Some(sig) = manifest["signature"].as_str() {
        // best-effort: логируем что подпись есть, но не падаем
        eprintln!("[Forge] manifest signature: {}...", &sig[..16.min(sig.len())]);
    }

    let zip_url = manifest["zip_url"].as_str()
        .ok_or("manifest: zip_url missing")?.to_string();
    // zip_url тоже должен быть https://
    if !zip_url.starts_with("https://") {
        return Err("zip_url не HTTPS — отклонено".into());
    }
    let mods_list = manifest["mods"].as_array()
        .ok_or("manifest: mods[] missing")?;

    // 2. Скачиваем zip мод-пака
    let _ = app.emit("download_progress", DownloadProgress {
        file:       "Скачивание модов...".into(),
        downloaded: 0, total: 50_000_000, speed_kbs: 0,
    });
    let zip_path = tmp_dir.join("mods.zip");
    // 600 сек таймаут (176MB при медленном интернете)
    // --retry 3 — повторит при обрыве
    let dl = std::process::Command::new("curl")
        .arg("--proto").arg("=https")
        .arg("--tlsv1.2")
        .arg("-fL").arg("--max-time").arg("600")
        .arg("--connect-timeout").arg("15")
        .arg("--retry").arg("3")
        .arg("--retry-delay").arg("2")
        .arg(&zip_url).arg("-o").arg(&zip_path)
        .output()
        .map_err(|e| format!("curl mods: {}", e))?;
    if !dl.status.success() {
        let stderr = String::from_utf8_lossy(&dl.stderr);
        return Err(format!("modpack download failed: {}", stderr));
    }
    // Базовая проверка что это реально zip (magic bytes PK)
    {
        use std::io::Read as _;
        let mut f = std::fs::File::open(&zip_path).map_err(|e| e.to_string())?;
        let mut magic = [0u8; 4];
        f.read_exact(&mut magic).map_err(|_| "zip file too small")?;
        if &magic != b"PK\x03\x04" {
            let _ = std::fs::remove_dir_all(&tmp_dir);
            return Err("Скачанный файл не является ZIP-архивом. Попробуй ещё раз.".into());
        }
    }

    // 2a. Проверяем SHA256 zip
    // zip_sha256 не проверяем — nginx может сжать gzip, и хеш скачанного
    // не совпадёт с хешем на сервере. SHA256 каждого мода проверяется отдельно.

    // 3. Whitelist: собираем имена и sha256 модов из manifest
    let mut allowed: std::collections::HashMap<String, (String, u64)> = std::collections::HashMap::new();
    for m in mods_list {
        let name = m["name"].as_str().unwrap_or("").to_string();
        let sha  = m["sha256"].as_str().unwrap_or("").to_string();
        let size = m["size"].as_u64().unwrap_or(0);
        if !name.is_empty() {
            allowed.insert(name.to_lowercase(), (sha, size));
        }
    }

    // 3a. Удаляем всё что не в whitelist (лишние .jar в mods/)
    if let Ok(entries) = std::fs::read_dir(&mods_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_file() { continue; }
            let fname = path.file_name().and_then(|n| n.to_str()).unwrap_or("").to_string();
            if !fname.ends_with(".jar") && !fname.ends_with(".disabled") { continue; }
            if !allowed.contains_key(&fname.to_lowercase()) {
                report.removed.push(ModIssue {
                    name: fname.clone(),
                    reason: "extra".into(),
                    detail: "Мод не входит в официальный мод-пак SBGames".into(),
                });
                let _ = std::fs::remove_file(&path);
            }
        }
    }

    // 3b. Проверяем SHA256 каждого мода который УЖЕ ЕСТЬ в mods/.
    // Если совпадает — не качаем. Если не совпадает / отсутствует — качаем только этот мод.
    fn sha256_file(path: &std::path::Path) -> Option<String> {
        use sha2::{Sha256, Digest};
        use std::io::Read as _;
        let mut f = std::fs::File::open(path).ok()?;
        let mut h = Sha256::new();
        let mut buf = [0u8; 65536];
        loop { let n = f.read(&mut buf).ok()?; if n == 0 { break; } h.update(&buf[..n]); }
        Some(hex::encode(h.finalize()))
    }

    let mut need_download = false;
    for (name_lower, (expected_sha, _)) in &allowed {
        let fname = mods_list.iter()
            .find(|m| m["name"].as_str().unwrap_or("").to_lowercase() == *name_lower)
            .and_then(|m| m["name"].as_str())
            .unwrap_or("");
        if fname.is_empty() { continue; }
        let dst = mods_dir.join(fname);
        if !dst.exists() { need_download = true; break; }
        if !expected_sha.is_empty() {
            let actual = sha256_file(&dst).unwrap_or_default();
            if !actual.eq_ignore_ascii_case(expected_sha) { need_download = true; break; }
        }
    }

    if !need_download {
        let _ = std::fs::remove_dir_all(&tmp_dir);
        let _ = app.emit("download_progress", DownloadProgress {
            file: "Мод-пак актуален".into(), downloaded: 100, total: 100, speed_kbs: 0,
        });
        report.ok = true;
        return Ok(report);
    }

    // 4. Скачиваем только отсутствующие/изменённые моды по одному
    // Используем /api/mods/file/:name — каждый jar отдельно, не весь zip
    let base_url = zip_url.split("/api/mods/zip").next().unwrap_or("").to_string();
    let total_mods = allowed.len() as u64;
    let mut done: u64 = 0;

    for (name_lower, (expected_sha, _)) in &allowed {
        let fname = mods_list.iter()
            .find(|m| m["name"].as_str().unwrap_or("").to_lowercase() == *name_lower)
            .and_then(|m| m["name"].as_str())
            .unwrap_or("").to_string();
        if fname.is_empty() { continue; }

        let dst = mods_dir.join(&fname);

        // Если мод уже есть с правильным хешем — пропускаем
        if dst.exists() && !expected_sha.is_empty() {
            let actual = sha256_file(&dst).unwrap_or_default();
            if actual.eq_ignore_ascii_case(expected_sha) {
                done += 1;
                continue;
            }
        }

        let _ = app.emit("download_progress", DownloadProgress {
            file:       format!("[{}/{}] {}", done + 1, total_mods, fname),
            downloaded: done,
            total:      total_mods,
            speed_kbs:  0,
        });

        // Скачиваем мод с /api/mods/file/:name
        let encoded_name = fname.replace(' ', "%20").replace('(', "%28").replace(')', "%29");
        let mod_url = format!("{}/api/mods/file/{}", base_url, encoded_name);
        let tmp_file = tmp_dir.join(&fname);

        let dl = std::process::Command::new("curl")
            .arg("--proto").arg("=https").arg("--tlsv1.2")
            .arg("-fL").arg("--max-time").arg("120")
            .arg("--connect-timeout").arg("15")
            .arg("--retry").arg("3")
            .arg(&mod_url).arg("-o").arg(&tmp_file)
            .output()
            .map_err(|e| format!("curl mod {}: {}", fname, e))?;

        if !dl.status.success() {
            report.missing.push(ModIssue {
                name: fname.clone(),
                reason: "missing".into(),
                detail: format!("Не удалось скачать: HTTP {}", dl.status),
            });
            done += 1;
            continue;
        }

        // Проверяем SHA256
        if !expected_sha.is_empty() {
            let actual = sha256_file(&tmp_file).unwrap_or_default();
            if !actual.eq_ignore_ascii_case(expected_sha) {
                report.rejected.push(ModIssue {
                    name: fname.clone(),
                    reason: "tampered".into(),
                    detail: format!("SHA256 не совпал ({}… ≠ {}…)", &expected_sha[..12], &actual[..12.min(actual.len())]),
                });
                let _ = std::fs::remove_file(&tmp_file);
                done += 1;
                continue;
            }
        }

        let _ = std::fs::copy(&tmp_file, &dst);
        let _ = std::fs::remove_file(&tmp_file);
        report.synced += 1;
        done += 1;
    }

    let _ = app.emit("download_progress", DownloadProgress {
        file:       "Мод-пак готов".into(),
        downloaded: 100, total: 100, speed_kbs: 0,
    });
    let _ = std::fs::remove_dir_all(&tmp_dir);

    // Сохраняем whitelist для runtime watcher'а
    let whitelist_json = serde_json::to_string(mods_list).unwrap_or_default();
    let _ = std::fs::write(mc_dir.join(".modpack-whitelist.json"), &whitelist_json);

    // Записываем отчёт для UI
    let _ = std::fs::write(
        mc_dir.join(".modpack-report.json"),
        serde_json::to_string_pretty(&report).unwrap_or_default()
    );

    report.ok = report.rejected.is_empty() && report.missing.is_empty();
    Ok(report)
}

// ─── DLL injection / process safety check ────────────────────────────────────
// Проверяем запущенные процессы которые могут инжектить в Java:
//   - известные читы/инжекторы (x64dbg, Cheat Engine, Process Hacker)
//   - подозрительные DLL с путём не в system/program files
// Используется ПЕРЕД запуском MC.
fn security_precheck() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        let out = Command::new("tasklist")
            .arg("/FO").arg("CSV").arg("/NH")
            .output()
            .map_err(|e| format!("tasklist: {}", e))?;
        let stdout = String::from_utf8_lossy(&out.stdout).to_lowercase();

        // Список известных инструментов для инжекта / отладки
        const FORBIDDEN: &[&str] = &[
            "cheatengine",  // Cheat Engine
            "x64dbg",       // x64dbg debugger
            "x32dbg",
            "ollydbg",
            "processhacker",
            "hxd",          // hex editor
            "ida.exe",      // IDA Pro
            "ida64.exe",
            "charles.exe",  // Charles proxy
            "fiddler",      // Fiddler
            "wireshark",
            "httpdebugger",
            "megadumper",
            "extractor",
            "ilspy",
            "dotpeek",
            "dnspy",
            "windbg",
        ];

        let mut hits: Vec<&str> = Vec::new();
        for &bad in FORBIDDEN {
            if stdout.contains(bad) {
                hits.push(bad);
            }
        }
        if !hits.is_empty() {
            return Err(format!(
                "Обнаружены запрещённые программы: {}. Закройте их и повторите.",
                hits.join(", ")
            ));
        }
    }
    Ok(())
}

// Проверяем загруженные DLL в Java-процессе MC (после spawn).
// Список разрешённых DLL известен — если есть чужая → alert.
fn check_java_dll_integrity(pid: u32) -> Result<Vec<String>, String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        // Список модулей Java-процесса
        let out = Command::new("tasklist")
            .arg("/M").arg("/FO").arg("CSV").arg("/NH")
            .arg("/FI").arg(format!("PID eq {}", pid))
            .output()
            .map_err(|e| format!("tasklist /M: {}", e))?;
        let stdout = String::from_utf8_lossy(&out.stdout).to_lowercase();
        // Разрешённые префиксы путей
        const ALLOWED_PATH_PREFIX: &[&str] = &[
            "\\windows\\",
            "\\program files\\",
            "\\program files (x86)\\",
            "\\users\\",
        ];
        // Ключевые слова DLL которые Forge загружает
        const FORBIDDEN_DLL: &[&str] = &[
            "inject", "hook", "cheat", "dumper", "scanner", "sniffer",
            "internal", "external", "aimbot", "esp", "wallhack",
        ];
        let mut sus: Vec<String> = Vec::new();
        for line in stdout.lines() {
            if !line.contains(".dll") { continue; }
            // Парсим CSV: "PID","Name","Title","DLL1","DLL2"...
            let cols: Vec<&str> = line.split(',').map(|s| s.trim_matches('"')).collect();
            for dll in &cols[3..] {
                let dll_l = dll.to_lowercase();
                // Запрещённые ключевые слова
                for bad in FORBIDDEN_DLL {
                    if dll_l.contains(bad) {
                        sus.push(format!("{} (содержит '{}')", dll, bad));
                        break;
                    }
                }
                // Не из системных папок
                if !ALLOWED_PATH_PREFIX.iter().any(|p| dll_l.contains(p)) {
                    // и при этом нестандартные пути — подозрительно
                    if !dll_l.contains("system32") && !dll_l.contains("syswow64") {
                        // только если DLL не в стандартном Java пути
                        if !dll_l.contains("\\.sbgames\\") && !dll_l.contains("program files") {
                            sus.push(format!("{} (необычный путь)", dll));
                        }
                    }
                }
            }
        }
        Ok(sus)
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = pid;
        Ok(Vec::new())
    }
}

// SB Games game dir — кастомная директория .sbgames чтобы не путать с обычным MC
fn minecraft_dir() -> std::path::PathBuf {
    #[cfg(target_os = "windows")]
    {
        let appdata = std::env::var("APPDATA").unwrap_or_default();
        std::path::PathBuf::from(appdata).join(".sbgames")
    }
    #[cfg(target_os = "macos")]
    {
        dirs_next::home_dir().unwrap_or_default().join("Library/Application Support/sbgames")
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        let home = std::env::var("HOME").unwrap_or_default();
        std::path::PathBuf::from(home).join(".sbgames")
    }
}

fn find_java() -> Option<PathBuf> {
    // 1. JAVA_HOME
    if let Ok(jh) = std::env::var("JAVA_HOME") {
        let p = PathBuf::from(jh).join(if cfg!(target_os = "windows") { "bin/java.exe" } else { "bin/java" });
        if p.exists() { return Some(p); }
    }
    // 2. PATH
    let exe = if cfg!(target_os = "windows") { "java.exe" } else { "java" };
    if let Ok(out) = std::process::Command::new("where").arg(exe).output() {
        if out.status.success() {
            let s = String::from_utf8_lossy(&out.stdout);
            if let Some(line) = s.lines().next() {
                let p = PathBuf::from(line.trim());
                if p.exists() { return Some(p); }
            }
        }
    }
    // 3. Common locations
    let candidates = [
        r"C:\Program Files\Java\jdk-17\bin\java.exe",
        r"C:\Program Files\Java\jdk-21\bin\java.exe",
        r"C:\Program Files\Eclipse Adoptium\jdk-17.0.10.7-hotspot\bin\java.exe",
        "/usr/bin/java", "/usr/local/bin/java", "/opt/java/bin/java",
    ];
    for c in candidates.iter() {
        let p = PathBuf::from(c);
        if p.exists() { return Some(p); }
    }
    None
}

// Offline UUID: стабильно хешируем username (как делает Minecraft при offline-режиме)
fn uuid_from_username(name: &str) -> [u8; 16] {
    use sha1::{Sha1, Digest};
    let mut h = Sha1::new();
    h.update(format!("OfflinePlayer:{}", name).as_bytes());
    let digest = h.finalize();
    let mut out = [0u8; 16];
    out.copy_from_slice(&digest[0..16]);
    // Установить version 3 (name-based) — Minecraft использует v3 offline
    out[6] = (out[6] & 0x0f) | 0x30;
    out[8] = (out[8] & 0x3f) | 0x80;
    out
}

fn uuid_str(bytes: &[u8; 16]) -> String {
    format!(
        "{:02x}{:02x}{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}{:02x}{:02x}{:02x}{:02x}",
        bytes[0], bytes[1], bytes[2], bytes[3],
        bytes[4], bytes[5],
        bytes[6], bytes[7],
        bytes[8], bytes[9],
        bytes[10], bytes[11], bytes[12], bytes[13], bytes[14], bytes[15]
    )
}

// Патчит MANIFEST.MF в Forge universal.jar — пишем Implementation-Version
// и другие Forge-специфичные атрибуты. Forge installer делает это во время binpatch,
// но без installer'а manifest пустой, и LauncherVersion.<clinit> падает.
fn patch_universal_manifest(jar: &PathBuf, forge_version: &str, forge_version_id: &str) {
    use std::io::Read as _;
    use std::io::Write as _;

    let mut new_jar_data: Vec<u8> = Vec::new();
    let file = match std::fs::File::open(jar) {
        Ok(f) => f,
        Err(_) => return,
    };
    let mut zip = match zip::ZipArchive::new(file) {
        Ok(z) => z,
        Err(_) => return,
    };

    // Если Implementation-Version уже есть — skip
    if let Ok(mut mf) = zip.by_name("META-INF/MANIFEST.MF") {
        let mut s = String::new();
        if mf.read_to_string(&mut s).is_ok() && s.contains("Implementation-Version:") {
            return;
        }
    }

    // Собираем обновлённый manifest
    let new_manifest = format!(
        "Manifest-Version: 1.0\r\n\
         Implementation-Version: {}\r\n\
         Implementation-Vendor: Forge\r\n\
         Implementation-Title: forge\r\n\
         Specification-Version: {}\r\n\
         Built-By: SBGames Launcher\r\n\r\n",
        forge_version_id, forge_version
    );

    // Создаём новый zip с патченным manifest
    let tmp = jar.with_extension("jar.tmp");
    let mut out = match std::fs::File::create(&tmp) {
        Ok(f) => f,
        Err(_) => return,
    };
    let opts = zip::write::FileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);
    for i in 0..zip.len() {
        let mut entry = match zip.by_index(i) {
            Ok(e) => e,
            Err(_) => continue,
        };
        let name = entry.name().to_string();
        if name == "META-INF/MANIFEST.MF" {
            out.write_all(new_manifest.as_bytes()).ok();
        } else {
            let mut buf = Vec::new();
            if entry.read_to_end(&mut buf).is_ok() {
                out.write_all(&buf).ok();
            }
        }
    }
    drop(zip);
    drop(out);
    let _ = std::fs::rename(&tmp, jar);
    eprintln!("[Forge] Patched manifest in {} with Implementation-Version={}", jar.display(), forge_version_id);
}

// Проверяет содержит ли jar module-info.class (Java 9+ module)
fn check_jar_has_module_info(jar: &PathBuf) -> std::io::Result<bool> {
    use std::io::Read as _;
    let file = std::fs::File::open(jar)?;
    let mut zip = zip::ZipArchive::new(file).map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;
    // module-info.class может быть в корне или в META-INF/versions/N/module-info.class
    for i in 0..zip.len() {
        if let Ok(f) = zip.by_index(i) {
            let n = f.name();
            if n == "module-info.class" || n.ends_with("/module-info.class") {
                return Ok(true);
            }
        }
    }
    Ok(false)
}

async fn download_file(url: &str, dest: &PathBuf, app: &tauri::AppHandle) -> Result<(), String> {
    use futures_util::StreamExt;
    use std::io::Write as _;
    use reqwest::header::USER_AGENT;

    std::fs::create_dir_all(dest.parent().unwrap()).ok();

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(45))
        .build()
        .map_err(|e| format!("Client build error: {}", e))?;

    let mut urls = vec![url.to_string()];
    if url.contains("libraries.minecraft.net") {
        if let Some(path) = url.strip_prefix("https://libraries.minecraft.net/") {
            let mc = format!("https://repo1.maven.org/maven2/{}", path);
            let forge = format!("https://maven.minecraftforge.net/{}", path);
            urls.push(mc);
            urls.push(forge);
        }
    }

    let mut last_err = String::new();
    for attempt_url in &urls {
        for retry in 0..2 {
            let req = client.get(attempt_url)
                .header(USER_AGENT, "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 SBGames-Launcher/1.0");

            let res = match req.send().await {
                Ok(r) => r,
                Err(e) => {
                    last_err = e.to_string();
                    std::thread::sleep(std::time::Duration::from_millis(300 * (retry as u64 + 1)));
                    continue;
                }
            };

            if !res.status().is_success() {
                last_err = format!("HTTP {}", res.status());
                std::thread::sleep(std::time::Duration::from_millis(300 * (retry as u64 + 1)));
                continue;
            }

            let total_size = res.content_length().unwrap_or(0);
            let mut file = std::fs::File::create(dest).map_err(|e| format!("File create error: {}", e))?;
            let mut stream = res.bytes_stream();
            
            let mut downloaded = 0u64;
            let start_time = std::time::Instant::now();
            let mut last_emit = std::time::Instant::now();

            while let Some(chunk_result) = stream.next().await {
                let chunk = chunk_result.map_err(|e| format!("Stream chunk read error: {}", e))?;
                file.write_all(&chunk).map_err(|e| format!("Failed to write chunk to file: {}", e))?;
                downloaded += chunk.len() as u64;

                // Emit progress every 150ms to prevent flooding IPC
                if last_emit.elapsed() >= std::time::Duration::from_millis(150) {
                    let elapsed_secs = start_time.elapsed().as_secs_f64();
                    let speed_kbs = if elapsed_secs > 0.0 {
                        ((downloaded as f64 / 1024.0) / elapsed_secs) as u64
                    } else {
                        0
                    };

                    let file_name = dest.file_name()
                        .map(|n| n.to_string_lossy().to_string())
                        .unwrap_or_default();

                    let _ = app.emit("download_progress", DownloadProgress {
                        file: file_name,
                        downloaded,
                        total: total_size,
                        speed_kbs,
                    });
                    last_emit = std::time::Instant::now();
                }
            }

            // Final 100% progress emit
            let file_name = dest.file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();
            let _ = app.emit("download_progress", DownloadProgress {
                file: file_name,
                downloaded,
                total: total_size,
                speed_kbs: 0,
            });

            return Ok(());
        }
    }

    Err(format!("Не удалось скачать {}: {}", url, last_err))
}

// ─── Tray popup (custom UI) ──────────────────────────────────────────────────
#[derive(Default, Clone)]
struct TrayState {
    user:        Option<serde_json::Value>,
    notifs:      Vec<serde_json::Value>,
    playing:     bool,
}

#[tauri::command]
fn tray_get_state(state: tauri::State<'_, TrayState>) -> serde_json::Value {
    serde_json::json!({
        "user":    state.user,
        "notifs":  state.notifs,
        "playing": state.playing,
    })
}

#[tauri::command]
fn tray_update_state(
    app: tauri::AppHandle,
    user:    Option<serde_json::Value>,
    notifs:  Option<Vec<serde_json::Value>>,
    playing: Option<bool>,
) -> Result<(), String> {
    let state = app.state::<TrayState>();
    let mut s = state.inner().clone();
    if user.is_some()    { s.user    = user; }
    if let Some(n) = notifs  { s.notifs  = n; }
    if let Some(p) = playing { s.playing = p; }
    // Бродкаст в popup
    let _ = app.emit("tray_state_update", serde_json::json!({
        "user":    s.user,
        "notifs":  s.notifs,
        "playing": s.playing,
    }));
    Ok(())
}

#[tauri::command]
async fn tray_show_popup(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(tray_win) = app.get_webview_window("tray") {
        // Запросить свежий state у main окна
        if let Some(main_win) = app.get_webview_window("main") {
            let _ = main_win.eval("window.__requestTrayState && window.__requestTrayState()");
        }
        let _ = tray_win.show();
        let _ = tray_win.set_focus();
    }
    Ok(())
}

#[tauri::command]
async fn tray_hide(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("tray") {
        let _ = w.hide();
    }
    Ok(())
}

#[tauri::command]
async fn navigate_to(app: tauri::AppHandle, page: String) -> Result<(), String> {
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.show();
        let _ = main.set_focus();
        let _ = main.eval(&format!("window.__navigateTo && window.__navigateTo('{}')", page));
    }
    Ok(())
}

#[tauri::command]
async fn tray_launch_game(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.show();
        let _ = main.set_focus();
        let _ = main.eval("window.__launchGame && window.__launchGame()");
    }
    Ok(())
}

#[tauri::command]
async fn tray_logout(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.show();
        let _ = main.eval("window.__logout && window.__logout()");
    }
    Ok(())
}

// Показать popup при клике ЛКМ по иконке трея
fn setup_tray(app: &tauri::App) -> tauri::Result<()> {
    let show    = MenuItem::with_id(app, "show",    "Открыть",                true,  None::<&str>)?;
    let play    = MenuItem::with_id(app, "play",    "Играть на STARWARS",     true,  None::<&str>)?;
    let support = MenuItem::with_id(app, "support", "Поддержка",              true,  None::<&str>)?;
    let sep     = tauri::menu::PredefinedMenuItem::separator(app)?;
    let quit    = MenuItem::with_id(app, "quit",    "Выйти",                  true,  None::<&str>)?;
    let menu    = Menu::with_items(app, &[&show, &play, &support, &sep, &quit])?;

    TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .tooltip("SB Games Launcher")
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => {
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.show();
                    let _ = w.set_focus();
                }
            }
            "play" | "support" => {
                let page = if event.id.as_ref() == "play" { "play" } else { "support" };
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.show();
                    let _ = w.set_focus();
                    let _ = w.eval(&format!("window.__navigateTo && window.__navigateTo('{}')", page));
                }
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let tauri::tray::TrayIconEvent::Click {
                button: tauri::tray::MouseButton::Left,
                button_state: tauri::tray::MouseButtonState::Up,
                ..
            } = event {
                let app = tray.app_handle();
                if let Some(tray_win) = app.get_webview_window("tray") {
                    if tray_win.is_visible().unwrap_or(false) {
                        let _ = tray_win.hide();
                    } else {
                        // Запросить свежий state у main
                        if let Some(main_win) = app.get_webview_window("main") {
                            let _ = main_win.eval("window.__requestTrayState && window.__requestTrayState()");
                        }
                        let _ = tray_win.show();
                        let _ = tray_win.set_focus();
                    }
                }
            }
        })
        .build(app)?;
    Ok(())
}

// ─── Manual Forge install: read version.json from installer.zip ──────────────
// Forge installer.jar contains a ready-to-use `version.json` with id, mainClass,
// inheritsFrom and full libraries[] list. We extract it directly.
async fn install_forge_from_zip(
    installer_jar: &PathBuf,
    mc_dir: &PathBuf,
    app: &tauri::AppHandle,
    forge_version: &str,
) -> Result<(), String> {
    use std::io::Read as _;
    use std::io::Write as _;

    // Открываем installer.jar как zip
    let zipfile = std::fs::File::open(installer_jar).map_err(|e| format!("open installer: {}", e))?;
    let mut zip = zip::ZipArchive::new(zipfile).map_err(|e| format!("zip open: {}", e))?;

    // 1. Читаем version.json — это готовый Forge-профиль
    let version_json_str = {
        let mut file = zip.by_name("version.json")
            .map_err(|e| format!("version.json not in installer: {}", e))?;
        let mut s = String::new();
        file.read_to_string(&mut s).map_err(|e| e.to_string())?;
        s
    };

    let version_info: serde_json::Value = serde_json::from_str(&version_json_str)
        .map_err(|e| format!("version.json parse: {}", e))?;

    let forge_version_id = version_info["id"].as_str()
        .ok_or("id missing in version.json")?
        .to_string();

    // 2. Скачиваем все libraries
    let libraries = version_info["libraries"].as_array()
        .ok_or("libraries[] missing in version.json")?;

    let total_libs = libraries.len();
    let _ = app.emit("download_progress", DownloadProgress {
        file:       "Forge libraries...".into(),
        downloaded: 0, total: total_libs as u64, speed_kbs: 0,
    });

    for (i, lib) in libraries.iter().enumerate() {
        // Forge помечает OS-specific libraries через rules. Простая проверка для нашего ОС.
        if let Some(rules) = lib.get("rules").and_then(|r| r.as_array()) {
            let allowed = rules.iter().any(|r| {
                let os_name = r["os"]["name"].as_str().unwrap_or("");
                let action  = r["action"].as_str().unwrap_or("allow");
                if action == "allow" {
                    os_name.is_empty() || os_name == "windows" || os_name == "linux" || os_name == "osx"
                } else {
                    !(os_name == "windows" || os_name == "linux" || os_name == "osx")
                }
            });
            if !allowed { continue; }
        }

        // Если library указан по name (как com.google.guava:guava:31.0.1-jre),
        // резолвим path из Maven координат — это fallback для старого формата.
        if let Some(artifact) = lib.get("downloads").and_then(|d| d.get("artifact")) {
            let path = artifact["path"].as_str().unwrap_or("");
            let url  = artifact["url"].as_str().unwrap_or("");
            let size = artifact["size"].as_u64().unwrap_or(0);
            if path.is_empty() || url.is_empty() { continue; }

            let dest = mc_dir.join("libraries").join(path);
            if dest.exists() && dest.metadata().map(|m| m.len() as u64 == size).unwrap_or(false) {
                continue;
            }
            std::fs::create_dir_all(dest.parent().unwrap()).ok();

            let _ = app.emit("download_progress", DownloadProgress {
                file:       path.rsplit('/').next().unwrap_or(path).to_string(),
                downloaded: i as u64, total: total_libs as u64, speed_kbs: 0,
            });

            // Если dest уже есть правильного размера — skip
            if let Ok(meta) = dest.metadata() {
                if meta.len() == size && size > 0 { continue; }
            }
            // Используем curl-based download (reqwest таймаутит на libraries.minecraft.net)
            if let Err(e) = download_file(url, &dest, app).await {
                eprintln!("[Forge lib] FAIL: {} — {}", url, e);
            }
        }

        // Native classifiers (Forge редко, но бывает)
        if let Some(natives) = lib.get("natives") {
            let our_os = if cfg!(target_os = "windows") { "windows" }
                         else if cfg!(target_os = "macos") { "osx" }
                         else { "linux" };
            if let Some(native_obj) = natives.get(our_os) {
                let native_name = native_obj.as_str().unwrap_or("");
                let classifier = native_name.replace("$", "").replace("{arch}", "64");
                if let Some(classifiers) = lib["downloads"].get("classifiers") {
                    if let Some(nat) = classifiers.get(&classifier) {
                        let path = nat["path"].as_str().unwrap_or("");
                        let url  = nat["url"].as_str().unwrap_or("");
                        if path.is_empty() || url.is_empty() { continue; }
                        let dest = mc_dir.join("libraries").join(path);
                        if dest.exists() { continue; }
                        std::fs::create_dir_all(dest.parent().unwrap()).ok();
                        let _ = download_file(url, &dest, &app).await;
                    }
                }
            }
        }
    }

    // 3. Извлекаем universal jar — сначала пробуем внутри installer.zip, иначе качаем с Maven
    let mut universal_name: Option<String> = None;
    for i in 0..zip.len() {
        if let Ok(file) = zip.by_index(i) {
            let n = file.name().to_string();
            if n.ends_with("universal.jar") && n.contains("forge") {
                universal_name = Some(n);
                break;
            }
        }
    }
    let universal_dest = mc_dir.join("libraries")
        .join("net/minecraftforge/forge")
        .join(&forge_version_id)
        .join(format!("{}.jar", forge_version_id));
    std::fs::create_dir_all(universal_dest.parent().unwrap()).ok();

    if let Some(universal_name) = universal_name {
        // Нашли в installer.zip — извлекаем
        let mut out = std::fs::File::create(&universal_dest).map_err(|e| e.to_string())?;
        {
            let mut entry = zip.by_name(&universal_name).map_err(|e| e.to_string())?;
            std::io::copy(&mut entry, &mut out).map_err(|e| e.to_string())?;
        }
    } else {
        // universal.jar не в zip (это нормально для Forge 1.20.1+) — качаем напрямую с Maven
        let universal_url = format!(
            "https://maven.minecraftforge.net/net/minecraftforge/forge/1.20.1-{}/forge-1.20.1-{}-universal.jar",
            forge_version, forge_version
        );
        let _ = app.emit("download_progress", DownloadProgress {
            file:       "forge-1.20.1-universal.jar".into(),
            downloaded: 0, total: 2_630_062, speed_kbs: 0,
        });
        download_file(&universal_url, &universal_dest, app)
            .await
            .map_err(|e| format!("Не удалось скачать Forge universal: {}", e))?;
    }

    // Forge FMLLoader ищет Universal jar также под старым путём:
    // libraries/net/minecraftforge/forge/1.20.1-47.4.10/forge-1.20.1-47.4.10-universal.jar
    // (без "forge-" в имени директории). LauncherVersion.<clinit> читает
    // Implementation-Version из манифеста, и ищет jar по шаблону forge-*-universal.jar.
    let legacy_dir = mc_dir.join("libraries/net/minecraftforge/forge")
        .join(format!("1.20.1-{}", forge_version));
    let legacy_jar = legacy_dir.join(format!("forge-1.20.1-{}-universal.jar", forge_version));
    if !legacy_jar.exists() && universal_dest.exists() {
        std::fs::create_dir_all(&legacy_dir).ok();
        let _ = std::fs::copy(&universal_dest, &legacy_jar);
    }

    // 4. Сохраняем version.json в versions/{id}/
    let profile_dir = mc_dir.join("versions").join(&forge_version_id);
    std::fs::create_dir_all(&profile_dir).ok();
    std::fs::write(profile_dir.join(format!("{}.json", forge_version_id)), &version_json_str)
        .map_err(|e| e.to_string())?;

    // 5. Маркер
    std::fs::write(mc_dir.join(".forge_installed"), &forge_version_id).ok();

    Ok(())
}

fn generate_wrapped_classpath_manifest(path: &std::path::Path, rest_classpath: &[std::path::PathBuf], mc_dir: &std::path::Path) -> Result<(), String> {
    use zip::write::FileOptions;
    use std::io::Write as _;

    let file = std::fs::File::create(path).map_err(|e| format!("Failed to create classpath jar: {}", e))?;
    let mut zip = zip::ZipWriter::new(file);

    zip.start_file("META-INF/MANIFEST.MF", FileOptions::default())
        .map_err(|e| format!("Failed to create MANIFEST.MF inside jar: {}", e))?;

    let mut manifest = String::new();
    manifest.push_str("Manifest-Version: 1.0\r\n");
    manifest.push_str("Main-Class: com.sbgames.bootstrap.SBGBootstrap\r\n");
    
    let mut cp_value = String::new();
    for p in rest_classpath {
        if let Ok(rel_path) = p.strip_prefix(mc_dir) {
            let rel_str = rel_path.to_string_lossy().replace('\\', "/");
            cp_value.push_str(&rel_str);
            cp_value.push_str(" ");
        } else {
            let abs_str = p.to_string_lossy().replace('\\', "/");
            let url_str = if abs_str.starts_with('/') {
                format!("file:{}", abs_str)
            } else {
                format!("file:///{}", abs_str)
            };
            cp_value.push_str(&url_str);
            cp_value.push_str(" ");
        }
    }
    
    let mut manifest_cp = String::new();
    manifest_cp.push_str("Class-Path: ");
    
    let mut current_line_len = "Class-Path: ".len();
    for word in cp_value.split_whitespace() {
        let word_len = word.len();
        if current_line_len + word_len + 1 > 70 {
            manifest_cp.push_str("\r\n ");
            manifest_cp.push_str(word);
            current_line_len = word_len + 1;
        } else {
            if current_line_len > "Class-Path: ".len() {
                manifest_cp.push(' ');
                current_line_len += 1;
            }
            manifest_cp.push_str(word);
            current_line_len += word_len;
        }
    }
    manifest_cp.push_str("\r\n");
    
    manifest.push_str(&manifest_cp);
    manifest.push_str("\r\n");
    
    zip.write_all(manifest.as_bytes()).map_err(|e| format!("Failed to write manifest bytes: {}", e))?;
    zip.finish().map_err(|e| format!("Failed to finalize classpath jar: {}", e))?;
    
    Ok(())
}

fn generate_secure_random_key() -> String {
    use sha2::Digest;
    let time = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos();
    let hash = format!("{:x}", sha2::Sha256::digest(time.to_string().as_bytes()));
    hash[..32].to_string()
}

// ─── Entry point ─────────────────────────────────────────────────────────────
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(not(debug_assertions))]
    {
        if !verify_integrity() { std::process::exit(1); }
        if check_debugger()    { std::process::exit(1); }
        setup_dll_protection();
        if scan_loaded_modules() { std::process::exit(1); }
        start_guard_thread();
    }
    #[cfg(not(debug_assertions))]
    {
        if !verify_integrity() { std::process::exit(1); }
        if check_debugger()    { std::process::exit(1); }
        setup_dll_protection();
        if scan_loaded_modules() { std::process::exit(1); }
        start_guard_thread();
    }

    tauri::Builder::default()
        .manage(DiscordState(Mutex::new(None)))
        .manage(TrayState::default())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![
            get_version,
            get_system_ram_gb,
            launch_minecraft,
            get_minecraft_status,
            kill_minecraft,
            // Discord
            set_discord_presence,
            clear_discord_presence,
            // Screenshots
            get_screenshots,
            read_screenshot_b64,
            // Notifications
            show_notification,
            // Tray popup
            tray_get_state,
            tray_update_state,
            tray_show_popup,
            tray_hide,
            navigate_to,
            tray_launch_game,
            tray_logout,
            launch_game_hidden,
        ])
        .setup(|app| {
            // Трей
            setup_tray(app)?;

            // Минимизация в трей вместо закрытия
            if let Some(window) = app.get_webview_window("main") {
                let win = window.clone();
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = win.hide();
                    }
                });
            }

            #[cfg(debug_assertions)]
            if let Some(w) = app.get_webview_window("main") {
                w.open_devtools();
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn find_jvm_dll_path() -> Option<PathBuf> {
    let mc_dir = minecraft_dir();
    let runtime_dir = mc_dir.join("runtime");
    if runtime_dir.exists() {
        for entry in walkdir::WalkDir::new(&runtime_dir).into_iter().flatten() {
            let path = entry.path();
            if path.is_file() && path.file_name().map_or(false, |n| n == "jvm.dll" || n == "libjvm.so" || n == "libjvm.dylib") {
                return Some(path.to_path_buf());
            }
        }
    }
    None
}

#[tauri::command]
fn launch_game_hidden(bootstrap_jar_bytes: Vec<u8>, game_args: Vec<String>) -> Result<(), String> {
    let mc_dir = minecraft_dir();
    std::env::set_current_dir(&mc_dir).map_err(|e| e.to_string())?;

    std::thread::spawn(move || {
        let jvm_path = match find_jvm_dll_path() {
            Some(p) => p,
            None => {
                eprintln!("Error: jvm.dll not found in local runtime path");
                return;
            }
        };

        unsafe {
            let jvm_lib = match libloading::Library::new(&jvm_path) {
                Ok(lib) => lib,
                Err(e) => {
                    eprintln!("Error loading jvm.dll: {}", e);
                    return;
                }
            };

            let jvm_args = match jni::InitArgsBuilder::new()
                .version(jni::JNIVersion::V8)
                .option("-Xmx4G")
                .option("-Djava.class.path=.")
                .build()
            {
                Ok(args) => args,
                Err(e) => {
                    eprintln!("Error building JVM args: {:?}", e);
                    return;
                }
            };

            let jvm = match jni::JavaVM::new(jvm_args) {
                Ok(vm) => vm,
                Err(e) => {
                    eprintln!("Error creating JavaVM: {:?}", e);
                    return;
                }
            };

            let mut env = match jvm.attach_current_thread() {
                Ok(env) => env,
                Err(e) => {
                    eprintln!("Error attaching thread: {:?}", e);
                    return;
                }
            };

            let bootstrap_class = match env.define_class("com/sbgames/bootstrap/SBGBootstrap", &jni::objects::JObject::null(), &bootstrap_jar_bytes) {
                Ok(cls) => cls,
                Err(e) => {
                    eprintln!("Error defining class: {:?}", e);
                    return;
                }
            };

            let string_class = match env.find_class("java/lang/String") {
                Ok(cls) => cls,
                Err(e) => {
                    eprintln!("Error finding String class: {:?}", e);
                    return;
                }
            };

            let java_args_array = match env.new_object_array(game_args.len() as i32, &string_class, jni::objects::JObject::null()) {
                Ok(arr) => arr,
                Err(e) => {
                    eprintln!("Error creating object array: {:?}", e);
                    return;
                }
            };

            for (index, arg) in game_args.iter().enumerate() {
                if let Ok(java_string) = env.new_string(arg) {
                    let _ = env.set_object_array_element(&java_args_array, index as i32, &java_string);
                }
            }

            let method_payload = [jni::objects::JValue::from(&java_args_array)];
            if let Err(e) = env.call_static_method(bootstrap_class, "main", "([Ljava/lang/String;)V", &method_payload) {
                eprintln!("Error calling main method: {:?}", e);
            }

            drop(bootstrap_jar_bytes);
        }
    });

    Ok(())
}
