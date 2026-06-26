//! Анти-чит: клиентская аттестация + глубокая проверка содержимого .jar.
//!
//! scan_jar_deep заглядывает ВНУТРЬ мода (классы/пакеты/байткод) и ищет
//! сигнатуры читов и опасные API. Результат + хеш .exe + DLL уходит на сервер
//! (/api/attest/report), сервер выносит вердикт (ok / kill / ban).
//!
//! Все чувствительные строки (URL, эндпоинты, сигнатуры) обфусцированы obfstr,
//! чтобы их нельзя было увидеть простым дампом строк.

use std::io::Read;
use std::path::Path;
use sha2::{Digest, Sha256};
use hmac::{Hmac, Mac};
use std::sync::Mutex;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};

type HmacSha256 = Hmac<Sha256>;

// Сгенерировано build.rs: XOR-зашифрованный секрет + ключ (нет открытого текста).
include!(concat!(env!("OUT_DIR"), "/secret_gen.rs"));

// ─── АНТИ-ДАМП: секрет НЕ хранится в RAM открытым текстом ────────────────────
// Деобфусцированный секрет сразу перемаскируется ПЛАВАЮЩЕЙ рантайм-маской и
// лежит зашифрованным. Расшифровка — транзитная (только на момент HMAC), буфер
// тут же volatile-затирается. Маска периодически переключается, поэтому два
// дампа процесса дают РАЗНЫЙ шифротекст и не выровнять секрет статически.
static MEM_MASK: AtomicU64 = AtomicU64::new(0);
static SECURED: Mutex<Vec<u8>> = Mutex::new(Vec::new());
static SECURED_INIT: AtomicBool = AtomicBool::new(false);

#[inline(always)]
fn rt_mask_byte(seed: u64, i: usize) -> u8 {
    let mut z = seed.wrapping_add((i as u64).wrapping_mul(0x9E3779B97F4A7C15));
    z = (z ^ (z >> 30)).wrapping_mul(0xBF58476D1CE4E5B9);
    z = (z ^ (z >> 27)).wrapping_mul(0x94D049BB133111EB);
    (z ^ (z >> 31)) as u8
}

#[inline(never)]
fn zeroize_buf(v: &mut [u8]) {
    for b in v.iter_mut() { unsafe { std::ptr::write_volatile(b as *mut u8, 0u8); } }
    std::sync::atomic::compiler_fence(Ordering::SeqCst);
}

fn ensure_secured() {
    if SECURED_INIT.swap(true, Ordering::SeqCst) { return; }
    if OBF_SECRET.is_empty() || OBF_KEY.is_empty() { return; }
    let mut plain: Vec<u8> = OBF_SECRET.iter().enumerate()
        .map(|(i, b)| b ^ OBF_KEY[i % OBF_KEY.len()]).collect();
    let mask = {
        let t = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos() as u64).unwrap_or(0x1234_5678_9ABC_DEF0);
        let a = &SECURED as *const _ as u64;
        t ^ a.rotate_left(17) ^ 0xA5A5_5A5A_DEAD_BEEF
    };
    let mut masked: Vec<u8> = plain.iter().enumerate()
        .map(|(i, b)| b ^ rt_mask_byte(mask, i)).collect();
    MEM_MASK.store(mask, Ordering::SeqCst);
    if let Ok(mut g) = SECURED.lock() { std::mem::swap(&mut *g, &mut masked); }
    zeroize_buf(&mut plain);            // стираем открытый текст из RAM
    zeroize_buf(&mut masked);           // старый буфер (если был swap'нут пустой)
}

/// Переключает рантайм-маску: вызывать периодически из фонового цикла,
/// чтобы шифротекст секрета в памяти постоянно менялся.
pub fn rotate_secret_mask() {
    if !SECURED_INIT.load(Ordering::SeqCst) { return; }
    let mut g = match SECURED.lock() { Ok(g) => g, Err(_) => return };
    if g.is_empty() { return; }
    let old = MEM_MASK.load(Ordering::SeqCst);
    let new = old.rotate_left(13) ^ 0x9E37_79B9_7F4A_7C15 ^ (g.len() as u64);
    for (i, b) in g.iter_mut().enumerate() {
        *b ^= rt_mask_byte(old, i);    // снять старую маску
        *b ^= rt_mask_byte(new, i);    // наложить новую (открытый текст не материализуется целиком)
    }
    MEM_MASK.store(new, Ordering::SeqCst);
}

/// Транзитно расшифровывает секрет, отдаёт его f, затем затирает буфер.
fn with_secret<R>(f: impl FnOnce(&[u8]) -> R) -> R {
    ensure_secured();
    let (mask, mut tmp) = {
        let g = match SECURED.lock() { Ok(g) => g, Err(p) => p.into_inner() };
        (MEM_MASK.load(Ordering::SeqCst), g.clone())
    };
    for (i, b) in tmp.iter_mut().enumerate() { *b ^= rt_mask_byte(mask, i); }
    let r = f(&tmp);
    zeroize_buf(&mut tmp);
    r
}

fn api_base() -> String { obfstr::obfstr!("https://games.sb-capital.group").to_string() }

/// Сигнатуры читов (обфусцированы).
fn cheat_signatures() -> Vec<String> {
    use obfstr::obfstr as o;
    vec![
        o!("killaura"), o!("aimbot"), o!("aimassist"), o!("triggerbot"),
        o!("autoclicker"), o!("autoclick"), o!("xray"), o!("x-ray"),
        o!("wallhack"), o!("tracer"), o!("nofall"), o!("noslow"), o!("noslowdown"),
        o!("fastbreak"), o!("fastplace"), o!("nuker"), o!("scaffold"),
        o!("fastbridge"), o!("speedhack"), o!("flyhack"), o!("antikb"),
        o!("antiknockback"), o!("criticals"), o!("wurst"), o!("baritone"),
        o!("meteorclient"), o!("meteor-client"), o!("liquidbounce"),
        o!("impactclient"), o!("aristois"), o!("sigmaclient"), o!("konas"),
        o!("huzuni"), o!("rusherhack"), o!("wolfram"), o!("inertia"),
        o!("future-client"), o!("salhack"), o!("kamiblue"), o!("freecam"),
        o!("elytraswap"), o!("autototem"), o!("autocrystal"), o!("crystalaura"),
        o!("packetfly"),
    ].into_iter().map(|s| s.to_string()).collect()
}

/// Опасные API/паттерны.
fn dangerous_api() -> Vec<String> {
    use obfstr::obfstr as o;
    vec![
        o!("java/lang/runtime"), o!("java/lang/processbuilder"),
        o!("java/net/socket"), o!("java/net/serversocket"),
        o!("jdk/internal/misc/unsafe"), o!("sun/misc/unsafe"),
        o!("java/lang/instrument"), o!("premain"), o!("agentmain"),
    ].into_iter().map(|s| s.to_string()).collect()
}

#[derive(serde::Serialize, Clone)]
pub struct JarReport {
    pub name: String,
    pub sha256: String,
    pub suspicious: Vec<String>,
}

pub fn scan_jar_deep(path: &Path) -> JarReport {
    let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("?").to_string();
    let mut suspicious: Vec<String> = Vec::new();

    let bytes = std::fs::read(path).unwrap_or_default();
    let sha256 = {
        let mut h = Sha256::new();
        h.update(&bytes);
        hex::encode(h.finalize())
    };

    let sigs = cheat_signatures();
    let apis = dangerous_api();

    if let Ok(file) = std::fs::File::open(path) {
        if let Ok(mut archive) = zip::ZipArchive::new(file) {
            let mut has_mixins_touching_player = false;
            for i in 0..archive.len() {
                let mut entry = match archive.by_index(i) { Ok(e) => e, Err(_) => continue };
                let ename = entry.name().to_lowercase();

                for sig in &sigs {
                    if ename.contains(sig.as_str()) {
                        suspicious.push(format!("class_name:{}~{}", sig, ename));
                    }
                }

                let scan_body = ename.ends_with(".class") || ename.ends_with(".json");
                if scan_body && entry.size() < 4 * 1024 * 1024 {
                    let mut buf = Vec::new();
                    if entry.read_to_end(&mut buf).is_ok() {
                        let hay = ascii_lower(&buf);
                        for sig in &sigs {
                            if hay.contains(sig.as_str()) {
                                suspicious.push(format!("bytecode:{}~{}", sig, ename));
                                break;
                            }
                        }
                        for api in &apis {
                            if hay.contains(api.as_str()) {
                                suspicious.push(format!("dangerous_api:{}~{}", api, ename));
                                break;
                            }
                        }
                        if ename.contains("mixin")
                            && (hay.contains("clientplayerentity")
                                || hay.contains("playermovement")
                                || hay.contains("gamerenderer")
                                || hay.contains("worldrenderer")) {
                            has_mixins_touching_player = true;
                        }
                    }
                }
            }
            if has_mixins_touching_player {
                suspicious.push(obfstr::obfstr!("mixin_touches_player_or_render").to_string());
            }
        }
    }

    suspicious.sort();
    suspicious.dedup();
    JarReport { name, sha256, suspicious }
}

fn ascii_lower(buf: &[u8]) -> String {
    let mut out = String::with_capacity(buf.len());
    for &b in buf {
        let c = if b.is_ascii_uppercase() { (b + 32) as char }
                else if b.is_ascii_graphic() || b == b' ' || b == b'/' || b == b'.' { b as char }
                else { '\u{0}' };
        out.push(c);
    }
    out
}

pub fn exe_sha256() -> Option<String> {
    let p = std::env::current_exe().ok()?;
    let bytes = std::fs::read(p).ok()?;
    let mut h = Sha256::new();
    h.update(&bytes);
    Some(hex::encode(h.finalize()))
}

pub fn sign(canonical: &str) -> String {
    with_secret(|secret| {
        let mut mac = match HmacSha256::new_from_slice(secret) {
            Ok(m) => m, Err(_) => return String::new(),
        };
        mac.update(canonical.as_bytes());
        hex::encode(mac.finalize().into_bytes())
    })
}

#[derive(serde::Deserialize, Default)]
pub struct Verdict {
    #[serde(default)] pub ok: bool,
    #[serde(default)] pub action: String,
    #[serde(default)] pub reasons: Vec<String>,
}

pub fn run_cycle(mods_dir: &Path, jwt: &str, dlls: Vec<(String, bool)>) -> Option<Verdict> {
    let mut reports: Vec<JarReport> = Vec::new();
    if let Ok(rd) = std::fs::read_dir(mods_dir) {
        for e in rd.flatten() {
            let p = e.path();
            if p.extension().and_then(|s| s.to_str()).map_or(false, |s| s.eq_ignore_ascii_case("jar")) {
                reports.push(scan_jar_deep(&p));
            }
        }
    }
    let exe = exe_sha256().unwrap_or_default();
    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis()).unwrap_or(0) as u64;

    let mut hashes: Vec<String> = reports.iter().map(|r| r.sha256.clone()).collect();
    hashes.sort();
    let canonical = format!("{}|{}|{}", exe, ts, hashes.join(","));

    let dll_json: Vec<serde_json::Value> = dlls.into_iter()
        .map(|(name, suspicious)| serde_json::json!({ "name": name, "suspicious": suspicious }))
        .collect();
    let mods_json: Vec<serde_json::Value> = reports.iter()
        .map(|r| serde_json::json!({ "name": r.name, "sha256": r.sha256, "suspicious": r.suspicious }))
        .collect();

    let rt = tokio::runtime::Builder::new_current_thread().enable_all().build().ok()?;
    rt.block_on(async move {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(10))
            .build().ok()?;
        let sig = sign(&canonical);
        let body = serde_json::json!({
            "exeHash": exe,
            "mods": mods_json,
            "dlls": dll_json,
            "ts": ts,
            "sig": sig,
        });
        let url = format!("{}{}", api_base(), obfstr::obfstr!("/api/attest/report"));
        let resp = client.post(url)
            .bearer_auth(jwt)
            .json(&body)
            .send().await.ok()?;
        resp.json::<Verdict>().await.ok()
    })
}