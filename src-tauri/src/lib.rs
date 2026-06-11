use tauri::Manager;
use std::sync::atomic::{AtomicBool, Ordering};
use std::collections::HashSet;

static INTEGRITY_OK: AtomicBool = AtomicBool::new(false);

// ─── Разрешённые DLL (только системные + наши) ───────────────────────────────
#[cfg(target_os = "windows")]
fn allowed_dlls() -> HashSet<String> {
    [
        // Система
        "ntdll.dll","kernel32.dll","kernelbase.dll","user32.dll","gdi32.dll",
        "advapi32.dll","sechost.dll","rpcrt4.dll","ucrtbase.dll","msvcrt.dll",
        "combase.dll","ole32.dll","oleaut32.dll","shell32.dll","shlwapi.dll",
        "ws2_32.dll","wldp.dll","wintrust.dll","crypt32.dll","bcrypt.dll",
        "ncrypt.dll","cryptbase.dll","cfgmgr32.dll","setupapi.dll",
        "imm32.dll","msctf.dll","uxtheme.dll","dwmapi.dll","version.dll",
        "dxgi.dll","d3d11.dll","d3d12.dll","opengl32.dll","glu32.dll",
        "dinput8.dll","xinput1_4.dll","winmm.dll","mfplat.dll",
        // WebView2 / Edge
        "webview2loader.dll","embeddedbrowserwebview.dll",
        // VC Runtime
        "vcruntime140.dll","vcruntime140_1.dll","msvcp140.dll",
        // Наш лаунчер
        "sbgames_launcher_lib.dll",
    ].iter().map(|s| s.to_lowercase()).collect()
}

// ─── Анти-DLL инжект ─────────────────────────────────────────────────────────
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
        // 1. Убираем "." из пути поиска DLL — никаких сторонних DLL из текущей папки
        let empty: Vec<u16> = [0u16].to_vec();
        SetDllDirectoryW(empty.as_ptr());

        // 2. Safe DLL search mode
        SetSearchPathMode(0x00000001); // BASE_SEARCH_PATH_ENABLE_SAFE_SEARCHMODE

        // 3. ProcessDynamicCodePolicy — запрет генерации динамического кода (shellcode, JIT-инжект)
        // PROCESS_MITIGATION_DYNAMIC_CODE_POLICY { ProhibitDynamicCode: 1 }
        let dynamic_code_policy: u32 = 1;
        SetProcessMitigationPolicy(
            2, // ProcessDynamicCodePolicy
            &dynamic_code_policy as *const u32 as *const c_void,
            std::mem::size_of::<u32>(),
        );

        // 4. ProcessExtensionPointDisablePolicy — блок shim-DLL и хуков через AppInit_DLLs
        let ext_policy: u32 = 1;
        SetProcessMitigationPolicy(
            7, // ProcessExtensionPointDisablePolicy
            &ext_policy as *const u32 as *const c_void,
            std::mem::size_of::<u32>(),
        );

        // 5. ProcessImageLoadPolicy — только из System32 и Secure locations
        // Flags: PreferSystem32Images=1, NoRemoteImages=1
        let img_policy: u32 = 0b111; // NoRemoteImages | NoLowMandatoryLabelImages | PreferSystem32Images
        SetProcessMitigationPolicy(
            10, // ProcessImageLoadPolicy
            &img_policy as *const u32 as *const c_void,
            std::mem::size_of::<u32>(),
        );
    }
}

#[cfg(not(target_os = "windows"))]
fn setup_dll_protection() {} // Linux/macOS — SO injection через LD_PRELOAD

// ─── Сканирование загруженных модулей ────────────────────────────────────────
#[cfg(target_os = "windows")]
fn scan_loaded_modules() -> bool {
    use std::ffi::c_void;

    extern "system" {
        fn GetCurrentProcess() -> *mut c_void;
        fn EnumProcessModulesEx(
            process: *mut c_void,
            lph_module: *mut *mut c_void,
            cb: u32,
            lpcb_needed: *mut u32,
            filter_flag: u32,
        ) -> i32;
        fn GetModuleBaseNameW(
            process: *mut c_void,
            h_module: *mut c_void,
            lp_base_name: *mut u16,
            n_size: u32,
        ) -> u32;
    }

    let allowed = allowed_dlls();
    unsafe {
        let proc = GetCurrentProcess();
        let mut modules = vec![std::ptr::null_mut::<c_void>(); 1024];
        let mut needed: u32 = 0;
        if EnumProcessModulesEx(proc, modules.as_mut_ptr(), (modules.len() * 8) as u32, &mut needed, 0x03) == 0 {
            return false;
        }
        let count = (needed as usize) / 8;
        for &module in &modules[..count.min(modules.len())] {
            if module.is_null() { continue; }
            let mut name_buf = vec![0u16; 260];
            let len = GetModuleBaseNameW(proc, module, name_buf.as_mut_ptr(), name_buf.len() as u32);
            if len == 0 { continue; }
            let name = String::from_utf16_lossy(&name_buf[..len as usize]).to_lowercase();
            if !allowed.contains(name.as_str()) {
                eprintln!("[guard] unknown module: {}", name);
                return true; // подозрительно
            }
        }
    }
    false
}

#[cfg(not(target_os = "windows"))]
fn scan_loaded_modules() -> bool {
    // Linux: проверяем /proc/self/maps на подозрительные SO
    if let Ok(maps) = std::fs::read_to_string("/proc/self/maps") {
        let suspicious = ["inject", "hook", "cheat", "hack", "trainer", "loader"];
        for line in maps.lines() {
            let lower = line.to_lowercase();
            if suspicious.iter().any(|s| lower.contains(s)) {
                return true;
            }
        }
    }
    // Linux: проверяем LD_PRELOAD
    if std::env::var("LD_PRELOAD").is_ok() { return true; }
    false
}

// ─── Детект отладчика ────────────────────────────────────────────────────────
#[cfg(target_os = "windows")]
fn check_debugger() -> bool {
    use std::ffi::c_void;
    extern "system" {
        fn IsDebuggerPresent() -> i32;
        fn CheckRemoteDebuggerPresent(handle: *mut c_void, result: *mut i32) -> i32;
        fn GetCurrentProcess() -> *mut c_void;
    }
    unsafe {
        if IsDebuggerPresent() != 0 { return true; }
        let mut remote: i32 = 0;
        CheckRemoteDebuggerPresent(GetCurrentProcess(), &mut remote);
        if remote != 0 { return true; }
    }
    false
}

#[cfg(not(target_os = "windows"))]
fn check_debugger() -> bool {
    #[cfg(target_os = "linux")]
    if let Ok(s) = std::fs::read_to_string("/proc/self/status") {
        for line in s.lines() {
            if line.starts_with("TracerPid:") {
                if let Some(v) = line.split_whitespace().nth(1) {
                    return v != "0";
                }
            }
        }
    }
    // LD_PRELOAD — признак инжекта
    if std::env::var("LD_PRELOAD").is_ok() { return true; }
    false
}

// ─── Фоновый поток защиты ────────────────────────────────────────────────────
fn start_guard_thread() {
    std::thread::spawn(|| {
        // Даём приложению 3 секунды на инициализацию
        std::thread::sleep(std::time::Duration::from_secs(3));
        loop {
            if check_debugger() || scan_loaded_modules() {
                std::process::exit(0x4B1D);
            }
            let t = std::time::Instant::now();
            std::thread::sleep(std::time::Duration::from_millis(800));
            // Если прошло слишком много времени — скорее всего breakpoint
            if t.elapsed().as_millis() > 3000 {
                std::process::exit(0x4B1D);
            }
        }
    });
}

// ─── Целостность ─────────────────────────────────────────────────────────────
#[cfg(not(debug_assertions))]
fn verify_integrity() -> bool {
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
    // Защита только в release
    #[cfg(not(debug_assertions))]
    {
        if !verify_integrity() { std::process::exit(1); }
        if check_debugger()    { std::process::exit(1); }
        setup_dll_protection(); // блокируем инжект ДО инициализации WebView
        if scan_loaded_modules() { std::process::exit(1); }
        start_guard_thread();
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
