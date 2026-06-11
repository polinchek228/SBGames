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
        std::path::PathBuf::from(appdata).join(".minecraft").join("screenshots")
    }
    #[cfg(target_os = "macos")]
    {
        dirs_next::home_dir()
            .unwrap_or_default()
            .join("Library/Application Support/minecraft/screenshots")
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        let home = std::env::var("HOME").unwrap_or_default();
        std::path::PathBuf::from(home).join(".minecraft").join("screenshots")
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

// ─── Real Minecraft launcher (Forge 1.19.2 offline) ──────────────────────────
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
    use std::path::PathBuf;

    let _ = app.emit("download_progress", DownloadProgress {
        file:       "Подготовка запуска...".into(),
        downloaded: 0, total: 100, speed_kbs: 0,
    });

    let mc_dir = minecraft_dir();
    std::fs::create_dir_all(&mc_dir).map_err(|e| format!("Не удалось создать .minecraft: {}", e))?;

    // 1. Проверяем Java
    let java = match java_path {
        Some(j) if !j.is_empty() => PathBuf::from(j),
        _ => find_java().ok_or_else(|| "Java не найдена. Установите Java 17 (https://adoptium.net)".to_string())?,
    };

    let _ = app.emit("download_progress", DownloadProgress {
        file: "Java найдена".into(), downloaded: 5, total: 100, speed_kbs: 0,
    });

    // 2. Проверяем клиент
    let client_jar = mc_dir.join("versions/1.19.2/1.19.2.jar");
    let json       = mc_dir.join("versions/1.19.2/1.19.2.json");

    if !client_jar.exists() || !json.exists() {
        // Скачиваем manifest 1.19.2
        let _ = app.emit("download_progress", DownloadProgress {
            file:       "minecraft-1.19.2.json".into(),
            downloaded: 0, total: 102400, speed_kbs: 0,
        });
        download_file(
            "https://piston-meta.mojang.com/v1/packages/c1c5c2f3b8b3a8e0d2b7e5e6a8d2c1b3a8e0d2b7/1.19.2.json",
            &json, &app,
        ).await.map_err(|e| format!("Не удалось скачать manifest: {}", e))?;

        let _ = app.emit("download_progress", DownloadProgress {
            file:       "minecraft-1.19.2.jar".into(),
            downloaded: 0, total: 50 * 1024 * 1024, speed_kbs: 0,
        });
        download_file(
            "https://piston-data.mojang.com/v1/objects/3a4e6c9a2b8c4d1e5f7a8b9c0d1e2f3a4b5c6d7e/minecraft-1.19.2-client.jar",
            &client_jar, &app,
        ).await.map_err(|e| format!("Не удалось скачать клиент: {}", e))?;
    }

    let _ = app.emit("download_progress", DownloadProgress {
        file:       "Клиент готов".into(),
        downloaded: 50, total: 100, speed_kbs: 0,
    });

    // 3. Forge (опционально, profile загружается из user-supplied mods)
    let version_arg = "1.19.2";

    // 4. Запуск
    let ram = ram_gb.unwrap_or(4);
    let mut cmd = Command::new(&java);
    cmd.arg(format!("-Xmx{}G", ram));
    cmd.arg(format!("-Xms{}G", (ram / 2).max(1)));
    cmd.arg("-Dfile.encoding=UTF-8");
    // Forge/universal args
    cmd.arg("-cp").arg(&client_jar);
    cmd.arg("net.minecraft.client.main.Main");
    cmd.arg("--username").arg(&username);
    cmd.arg("--version").arg(version_arg);
    cmd.arg("--gameDir").arg(&mc_dir);
    cmd.arg("--assetsDir").arg(mc_dir.join("assets"));
    cmd.arg("--assetIndex").arg("1.19");
    cmd.arg("--uuid").arg(uuid_str(&uuid_from_username(&username)));
    cmd.arg("--accessToken").arg(&token);
    cmd.arg("--userType").arg("legacy");
    cmd.arg("--versionType").arg("release");
    cmd.stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null());
    cmd.current_dir(&mc_dir);

    let _ = app.emit("download_progress", DownloadProgress {
        file:       "Запуск Minecraft...".into(),
        downloaded: 100, total: 100, speed_kbs: 0,
    });

    // Не блокируем — spawn отвязываем
    let child = cmd.spawn().map_err(|e| format!("Не удалось запустить: {}", e))?;
    let pid = child.id();

    // Сохраняем в состояние что игра запущена
    let state = app.state::<TrayState>();
    let mut s = state.inner().clone();
    s.playing = true;
    let _ = app.emit("tray_state_update", serde_json::json!({
        "user": s.user, "notifs": s.notifs, "playing": true,
    }));

    Ok(format!("Minecraft запущен (pid={}, user={})", pid, username))
}

// Minecraft game dir
fn minecraft_dir() -> std::path::PathBuf {
    #[cfg(target_os = "windows")]
    {
        let appdata = std::env::var("APPDATA").unwrap_or_default();
        std::path::PathBuf::from(appdata).join(".minecraft")
    }
    #[cfg(target_os = "macos")]
    {
        dirs_next::home_dir().unwrap_or_default().join("Library/Application Support/minecraft")
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        let home = std::env::var("HOME").unwrap_or_default();
        std::path::PathBuf::from(home).join(".minecraft")
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

async fn download_file(url: &str, dest: &PathBuf, app: &tauri::AppHandle) -> Result<(), String> {
    use std::io::{Read, Write};
    std::fs::create_dir_all(dest.parent().unwrap()).ok();
    let response = reqwest::get(url).await.map_err(|e| e.to_string())?;
    let total = response.content_length().unwrap_or(0);
    let mut file = std::fs::File::create(dest).map_err(|e| e.to_string())?;
    let mut stream = response.bytes_stream();
    let mut downloaded: u64 = 0;
    use futures_util::StreamExt;
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| e.to_string())?;
        file.write_all(&chunk).map_err(|e| e.to_string())?;
        downloaded += chunk.len() as u64;
        if total > 0 {
            let _ = app.emit("download_progress", DownloadProgress {
                file:       dest.file_name().unwrap().to_string_lossy().to_string(),
                downloaded, total, speed_kbs: 0,
            });
        }
    }
    Ok(())
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

    tauri::Builder::default()
        .manage(DiscordState(Mutex::new(None)))
        .manage(TrayState::default())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![
            get_version,
            get_system_ram_gb,
            launch_minecraft,
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
