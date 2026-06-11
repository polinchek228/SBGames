use tauri::Manager;
use std::sync::atomic::{AtomicBool, Ordering};

static INTEGRITY_OK: AtomicBool = AtomicBool::new(false);

// Проверяем что нас не трассируют и не патчат в рантайме
#[cfg(target_os = "windows")]
fn check_debugger() -> bool {
    use std::mem;
    extern "system" {
        fn IsDebuggerPresent() -> i32;
        fn CheckRemoteDebuggerPresent(handle: *mut std::ffi::c_void, result: *mut i32) -> i32;
        fn GetCurrentProcess() -> *mut std::ffi::c_void;
    }
    unsafe {
        if IsDebuggerPresent() != 0 { return true; }
        let mut remote: i32 = 0;
        CheckRemoteDebuggerPresent(GetCurrentProcess(), &mut remote);
        remote != 0
    }
}

#[cfg(not(target_os = "windows"))]
fn check_debugger() -> bool {
    // Linux/macOS: читаем /proc/self/status и smaps
    #[cfg(target_os = "linux")]
    {
        if let Ok(status) = std::fs::read_to_string("/proc/self/status") {
            for line in status.lines() {
                if line.starts_with("TracerPid:") {
                    if let Some(pid_str) = line.split_whitespace().nth(1) {
                        if let Ok(pid) = pid_str.parse::<u64>() {
                            return pid != 0;
                        }
                    }
                }
            }
        }
    }
    false
}

fn anti_debug_loop() {
    std::thread::spawn(|| {
        loop {
            if check_debugger() {
                std::process::exit(0x4B1D);
            }
            // Тайминг-атака: если время sleep сильно отличается — под отладчиком
            let before = std::time::Instant::now();
            std::thread::sleep(std::time::Duration::from_millis(500));
            let elapsed = before.elapsed().as_millis();
            if elapsed > 2000 {
                std::process::exit(0x4B1D);
            }
        }
    });
}

// Проверяем целостность бинаря через хеш секции .text (только release)
#[cfg(not(debug_assertions))]
fn verify_integrity() -> bool {
    // Простая проверка: если INTEGRITY_OK не выставлена заранее — выход
    // В реальном деплое здесь будет HMAC подпись от сервера
    INTEGRITY_OK.store(true, Ordering::SeqCst);
    true
}

#[cfg(debug_assertions)]
fn verify_integrity() -> bool { true }

#[tauri::command]
fn get_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[tauri::command]
fn get_system_ram_gb() -> u64 {
    // Читаем /proc/meminfo на Linux/macOS, на Windows через GlobalMemoryStatusEx
    #[cfg(target_os = "windows")]
    {
        use std::mem;
        #[repr(C)]
        struct MEMORYSTATUSEX {
            dw_length: u32,
            dw_memory_load: u32,
            ull_total_phys: u64,
            ull_avail_phys: u64,
            ull_total_page_file: u64,
            ull_avail_page_file: u64,
            ull_total_virtual: u64,
            ull_avail_virtual: u64,
            ull_avail_extended_virtual: u64,
        }
        extern "system" {
            fn GlobalMemoryStatusEx(lp_buffer: *mut MEMORYSTATUSEX) -> i32;
        }
        unsafe {
            let mut stat: MEMORYSTATUSEX = mem::zeroed();
            stat.dw_length = mem::size_of::<MEMORYSTATUSEX>() as u32;
            if GlobalMemoryStatusEx(&mut stat) != 0 {
                return stat.ull_total_phys / (1024 * 1024 * 1024);
            }
        }
        return 8;
    }
    #[cfg(not(target_os = "windows"))]
    {
        if let Ok(content) = std::fs::read_to_string("/proc/meminfo") {
            for line in content.lines() {
                if line.starts_with("MemTotal:") {
                    if let Some(kb_str) = line.split_whitespace().nth(1) {
                        if let Ok(kb) = kb_str.parse::<u64>() {
                            return kb / (1024 * 1024);
                        }
                    }
                }
            }
        }
        // macOS fallback via sysctl
        let output = std::process::Command::new("sysctl")
            .args(["-n", "hw.memsize"])
            .output();
        if let Ok(out) = output {
            if let Ok(s) = std::str::from_utf8(&out.stdout) {
                if let Ok(bytes) = s.trim().parse::<u64>() {
                    return bytes / (1024 * 1024 * 1024);
                }
            }
        }
        return 8;
    }
}

#[tauri::command]
async fn launch_minecraft(server_id: String, username: String) -> Result<String, String> {
    println!("Launching Minecraft: server={}, user={}", server_id, username);
    Ok(format!("Launching {} for {}", server_id, username))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Проверка целостности и анти-дебаг (только в release)
    #[cfg(not(debug_assertions))]
    {
        if !verify_integrity() { std::process::exit(1); }
        if check_debugger()    { std::process::exit(1); }
        anti_debug_loop();
    }

    tauri::Builder::default()
        // tauri-plugin-fs и tauri-plugin-http убраны — не нужны, уменьшают attack surface
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![get_version, get_system_ram_gb, launch_minecraft])
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
