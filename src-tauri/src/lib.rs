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
    std::fs::create_dir_all(&mc_dir).map_err(|e| format!("Не удалось создать .sbgames: {}", e))?;
    std::fs::create_dir_all(mc_dir.join("mods")).ok();
    std::fs::create_dir_all(mc_dir.join("libraries")).ok();
    std::fs::create_dir_all(mc_dir.join("versions/1.19.2")).ok();
    std::fs::create_dir_all(mc_dir.join("assets")).ok();

    // 1. Проверяем Java
    let java = match java_path {
        Some(j) if !j.is_empty() => PathBuf::from(j),
        _ => find_java().ok_or_else(|| "Java не найдена. Установите Java 17 (https://adoptium.net)".to_string())?,
    };

    let _ = app.emit("download_progress", DownloadProgress {
        file: "Java найдена".into(), downloaded: 3, total: 100, speed_kbs: 0,
    });

    // 2. Vanilla client 1.19.2 — резолвим URL через version_manifest_v2
    let client_jar = mc_dir.join("versions/1.19.2/1.19.2.jar");
    let json       = mc_dir.join("versions/1.19.2/1.19.2.json");

    if !client_jar.exists() || !json.exists() {
        let _ = app.emit("download_progress", DownloadProgress {
            file:       "Mojang manifest".into(), downloaded: 0, total: 5000, speed_kbs: 0,
        });
        let manifest_url = reqwest::get("https://launchermeta.mojang.com/mc/game/version_manifest_v2.json")
            .await.map_err(|e| format!("Manifest API: {}", e))?
            .text().await.map_err(|e| e.to_string())?;
        let v1192_url = {
            let m: serde_json::Value = serde_json::from_str(&manifest_url).ok()
                .ok_or("Manifest parse")?;
            let arr = m["versions"].as_array().ok_or("versions[] missing")?;
            let v = arr.iter().find(|v| v["id"] == "1.19.2").ok_or("1.19.2 not in manifest")?;
            v["url"].as_str().ok_or("manifest url missing")?.to_string()
        };
        std::fs::create_dir_all(json.parent().unwrap()).ok();
        download_file(&v1192_url, &json, &app)
            .await.map_err(|e| format!("Manifest version: {}", e))?;
        let ver = std::fs::read_to_string(&json).ok()
            .and_then(|s| serde_json::from_str::<serde_json::Value>(&s).ok())
            .ok_or("Парсинг manifest")?;
        let client_url = ver["downloads"]["client"]["url"].as_str()
            .ok_or("URL client.jar не найден")?.to_string();
        let client_size = ver["downloads"]["client"]["size"].as_u64().unwrap_or(21_000_000);
        let _ = app.emit("download_progress", DownloadProgress {
            file:       "minecraft-1.19.2-client.jar".into(),
            downloaded: 0, total: client_size, speed_kbs: 0,
        });
        download_file(&client_url, &client_jar, &app)
            .await.map_err(|e| format!("Client.jar: {}", e))?;
    }

    let _ = app.emit("download_progress", DownloadProgress {
        file:       "Vanilla клиент готов".into(),
        downloaded: 25, total: 100, speed_kbs: 0,
    });

    // 3. Forge install через installer.jar — он сам качает все libraries
    // и создаёт version.json для Forge профиля.
    let forge_version = "43.2.21";
    let forge_version_id = format!("1.19.2-forge-{}", forge_version);
    let forge_profile_json = mc_dir.join("versions").join(&forge_version_id).join(format!("{}.json", forge_version_id));
    let forge_marker    = mc_dir.join(".forge_installed");

    if !forge_profile_json.exists() || !forge_marker.exists() {
        let installer_url = format!(
            "https://maven.minecraftforge.net/net/minecraftforge/forge/1.19.2-{}/forge-1.19.2-{}-installer.jar",
            forge_version, forge_version
        );
        let installer_jar = mc_dir.join("forge-installer.jar");
        let _ = app.emit("download_progress", DownloadProgress {
            file:       "forge-installer.jar".into(),
            downloaded: 0, total: 2_630_062, speed_kbs: 0,
        });
        download_file(&installer_url, &installer_jar, &app)
            .await.map_err(|e| format!("Не удалось скачать Forge installer: {}", e))?;

        // Headless installer ждёт ввод — пробуем отправить "1\n1\n" в stdin,
        // иначе installer упадёт и ничего не распакует.
        let _ = app.emit("download_progress", DownloadProgress {
            file:       "Установка Forge (libraries)...".into(),
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
            install_forge_from_zip(&installer_jar, &mc_dir, &app).await
                .map_err(|e| format!("Forge install: {}", e))?;
        }

        let _ = std::fs::remove_file(&installer_jar);
    }

    // 4. Forge требует libraries — если installer не распаковал, нужно скачать вручную.
    // Это основной момент: Forge Universal jar слинкован с cpw.mods.bootstraplauncher
    // и не требует отдельной загрузки Minecraft libraries — он сам подтянет.
    // Libraries уже распакованы через install_forge_from_zip

    let _ = app.emit("download_progress", DownloadProgress {
        file:       "Forge готов".into(),
        downloaded: 80, total: 100, speed_kbs: 0,
    });

    // 4. Запуск Forge
    let ram = ram_gb.unwrap_or(4);
    let mut cmd = Command::new(&java);
    cmd.arg(format!("-Xmx{}G", ram));
    cmd.arg(format!("-Xms{}G", (ram / 2).max(1)));
    // Читаем forge profile.json и собираем classpath по нему
    // Forge profile содержит полный libraries[] с name/path
    let cp_sep = if cfg!(target_os = "windows") { ";" } else { ":" };
    let mut cp_parts: Vec<PathBuf> = Vec::new();
    cp_parts.push(client_jar.clone());

    if let Ok(profile_text) = std::fs::read_to_string(&forge_profile_json) {
        if let Ok(profile) = serde_json::from_str::<serde_json::Value>(&profile_text) {
            if let Some(arr) = profile["libraries"].as_array() {
                for lib in arr {
                    if let Some(path) = lib["path"].as_str() {
                        cp_parts.push(mc_dir.join("libraries").join(path));
                    }
                }
            }
        }
    } else {
        // Fallback — только universal
        let forge_universal = mc_dir.join(format!("libraries/net/minecraftforge/forge/1.19.2-{}/forge-1.19.2-{}-universal.jar", forge_version, forge_version));
        cp_parts.push(forge_universal);
    }

    let classpath = cp_parts.iter()
        .map(|p| p.display().to_string())
        .collect::<Vec<_>>()
        .join(cp_sep);

    cmd.arg("-cp").arg(classpath);

    // Main class — Forge BootstrapLauncher (находится в universal jar)
    cmd.arg("cpw.mods.bootstraplauncher.BootstrapLauncher");

    cmd.arg("--username").arg(&username);
    cmd.arg("--version").arg(format!("1.19.2-forge-{}", forge_version));
    cmd.arg("--gameDir").arg(&mc_dir);
    cmd.arg("--assetsDir").arg(mc_dir.join("assets"));
    cmd.arg("--assetIndex").arg("1.19");
    cmd.arg("--uuid").arg(uuid_str(&uuid_from_username(&username)));
    cmd.arg("--accessToken").arg(&token);
    cmd.arg("--userType").arg("legacy");
    cmd.arg("--versionType").arg("release");
    cmd.arg("--launchTarget").arg("forgeclient");

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

// ─── Manual Forge install: read version.json from installer.zip ──────────────
// Forge installer.jar contains a ready-to-use `version.json` with id, mainClass,
// inheritsFrom and full libraries[] list. We extract it directly.
async fn install_forge_from_zip(
    installer_jar: &PathBuf,
    mc_dir: &PathBuf,
    app: &tauri::AppHandle,
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

            let resp = reqwest::get(url).await.map_err(|e| format!("download {}: {}", url, e))?;
            if !resp.status().is_success() { continue; }
            let bytes = resp.bytes().await.map_err(|e| e.to_string())?;
            let mut f = std::fs::File::create(&dest).map_err(|e| e.to_string())?;
            f.write_all(&bytes).map_err(|e| e.to_string())?;
        }
    }

    // 3. Извлекаем universal jar
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
    let universal_name = universal_name.ok_or("universal.jar not found in installer")?;

    let universal_dest = mc_dir.join("libraries")
        .join("net/minecraftforge/forge")
        .join(&forge_version_id)
        .join(format!("{}.jar", forge_version_id));
    std::fs::create_dir_all(universal_dest.parent().unwrap()).ok();
    let mut out = std::fs::File::create(&universal_dest).map_err(|e| e.to_string())?;
    {
        let mut entry = zip.by_name(&universal_name).map_err(|e| e.to_string())?;
        std::io::copy(&mut entry, &mut out).map_err(|e| e.to_string())?;
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
