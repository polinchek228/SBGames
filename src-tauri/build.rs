use std::io::Write;
use std::collections::HashMap;

fn sm64(x: u64) -> u64 {
    let mut z = x.wrapping_add(0x9E3779B97F4A7C15);
    z = (z ^ (z >> 30)).wrapping_mul(0xBF58476D1CE4E5B9);
    z = (z ^ (z >> 27)).wrapping_mul(0x94D049BB133111EB);
    z ^ (z >> 31)
}
struct Rng(u64);
impl Rng {
    fn next(&mut self) -> u64 { self.0 = sm64(self.0); self.0 }
    fn byte(&mut self) -> u8 { (self.next() & 0xff) as u8 }
    fn range(&mut self, n: usize) -> usize { (self.next() as usize) % n }
}
fn fnv(p: &[u8]) -> u64 {
    let mut h: u64 = 0xcbf29ce484222325;
    for &b in p { h ^= b as u64; h = h.wrapping_mul(0x100000001b3); }
    h
}
fn fmt(v: &[u8]) -> String { v.iter().map(|b| b.to_string()).collect::<Vec<_>>().join(",") }
fn fmt64(v: &[u64]) -> String { v.iter().map(|b| b.to_string()).collect::<Vec<_>>().join(",") }
#[allow(dead_code)]
fn ks(seed: u64, i: usize) -> u8 { (sm64(seed ^ (i as u64)) & 0xff) as u8 }

fn main() {
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("windows") {
        println!("cargo:rustc-link-lib=psapi");
    }
    println!("cargo:rerun-if-env-changed=SBG_ATTEST_SECRET");

    let seed0: u64 = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos() as u64).unwrap_or(0x9E3779B97F4A7C15);
    let build_seed = seed0 ^ 0xA5A5_5A5A_DEAD_BEEF;
    let mut rng = Rng(build_seed);
    let out_dir = std::env::var("OUT_DIR").unwrap();

    // ─── 1. XOR-секрет HMAC ──────────────────────────────────────────────────
    let secret = std::env::var("SBG_ATTEST_SECRET").unwrap_or_default();
    let sbytes = secret.as_bytes();
    let klen = sbytes.len().max(32);
    let mut skey = Vec::with_capacity(klen);
    for _ in 0..klen { skey.push(rng.byte()); }
    let sobf: Vec<u8> = sbytes.iter().enumerate().map(|(i,b)| b ^ skey[i % skey.len()]).collect();
    {
        let mut f = std::fs::File::create(std::path::Path::new(&out_dir).join("secret_gen.rs")).unwrap();
        writeln!(f, "pub(crate) const OBF_SECRET: &[u8] = &[{}];", fmt(&sobf)).unwrap();
        writeln!(f, "pub(crate) const OBF_KEY: &[u8] = &[{}];", fmt(&skey)).unwrap();
    }

    // ─── 2. Полиморфные опкоды (stack ISA + register ISA, без коллизий) ───────
    let snames = [
        "HALT","PUSH","PUSHR","POPR","HOST","DUP","XOR","ADD","SUB","AND","OR","EQ","NOT",
        "JZ","JMP","CALL","RET","DESTRUCT","NOP","ROT_STACK","CANARY",
        "CHK_DBG","CHK_TOOLS","CHK_INTEG","CHK_TIME",
    ];
    let rnames = ["RHALT","RLOAD_HOST","ROR","RNOT","RMOV","RNOP","RCHK_TIME"];
    let mut pool: Vec<u8> = (0u8..=255).collect();
    for i in (1..pool.len()).rev() { let j = rng.range(i+1); pool.swap(i, j); }
    let mut opc: HashMap<String,u8> = HashMap::new();
    let mut pi = 0usize;
    for n in snames.iter() { opc.insert(n.to_string(), pool[pi]); pi += 1; }
    for n in rnames.iter() { opc.insert(n.to_string(), pool[pi]); pi += 1; }
    let inames = ["IHOST","IXOR_K","INOP","IHALT"];
    for n in inames.iter() { opc.insert(n.to_string(), pool[pi]); pi += 1; }
    let o = |n: &str| *opc.get(n).unwrap();

    let host_xor = rng.byte();
    let h_dbg = rng.byte(); let h_tools = rng.byte(); let h_integ = rng.byte();

    let mut alias: Vec<u8> = (0u8..64).collect();
    for i in (1..alias.len()).rev() { let j = rng.range(i+1); alias.swap(i, j); }
    let can0 = rng.next(); let can1 = rng.next();
    let stack_mask = rng.next();
    let time_budget_ms: u64 = 120 + (rng.range(81) as u64); // 120..200 мс
    let inner_k = rng.next();
    let inner_seed = sm64(build_seed ^ 0x5DEECE66D);

    // ─── 3. Выбор архитектуры VM ─────────────────────────────────────────────
    // 0 = stack (match-dispatch), 1 = threaded (flattened dispatcher),
    // 2 = register (регистровая ISA, другой байткод).
    let flavor = rng.range(3) as u8;

    // ─── 4. Ассемблирование программы под выбранный флейвор ──────────────────
    let mut prog: Vec<u8> = Vec::new();
    let scratch = [5u8, 17, 28, 51];
    if flavor == 2 {
        // ── Регистровая программа: ok = NOT( (dbg|tools) | integ ) ──
        let rl = [3u8, 11, 27, 40, 52, 9, 33]; // логические регистры (через alias)
        let mut emit_rjunk = |p: &mut Vec<u8>, rng: &mut Rng| {
            match rng.range(2) {
                0 => p.push(o("RNOP")),
                _ => { let d = scratch[rng.range(scratch.len())]; p.push(o("RMOV")); p.push(d); p.push(d); }
            }
        };
        emit_rjunk(&mut prog, &mut rng);
        prog.push(o("RCHK_TIME"));
        prog.push(o("RLOAD_HOST")); prog.push(rl[0]); prog.push(h_dbg ^ host_xor);
        prog.push(o("RLOAD_HOST")); prog.push(rl[1]); prog.push(h_tools ^ host_xor);
        emit_rjunk(&mut prog, &mut rng);
        prog.push(o("ROR")); prog.push(rl[2]); prog.push(rl[0]); prog.push(rl[1]);
        prog.push(o("RLOAD_HOST")); prog.push(rl[3]); prog.push(h_integ ^ host_xor);
        prog.push(o("ROR")); prog.push(rl[4]); prog.push(rl[2]); prog.push(rl[3]);
        emit_rjunk(&mut prog, &mut rng);
        prog.push(o("RCHK_TIME"));
        prog.push(o("RNOT")); prog.push(rl[5]); prog.push(rl[4]);
        prog.push(o("RHALT")); prog.push(rl[5]);
    } else {
        // ── Стековая программа (для flavor 0 и 1) ──
        let mut emit_junk = |p: &mut Vec<u8>, rng: &mut Rng| {
            match rng.range(5) {
                0 => p.push(o("NOP")),
                1 => p.push(o("ROT_STACK")),
                2 => p.push(o("CANARY")),
                3 => {
                    // OPAQUE PREDICATE: PUSH (всегда != 0) ; JZ <мусорный адрес>.
                    // Условие никогда не истинно => переход НЕ берётся (линейный
                    // fall-through, цепочечный kstate не рассинхронизируется),
                    // но дизассемблер видит фиктивное ветвление. Стек сбалансирован.
                    p.push(o("PUSH")); p.push(0); p.push(rng.byte() | 1);
                    p.push(o("JZ")); p.push(rng.byte()); p.push(rng.byte());
                }
                _ => { let r = scratch[rng.range(scratch.len())];
                       p.push(o("PUSHR")); p.push(r); p.push(o("POPR")); p.push(r); }
            }
        };
        emit_junk(&mut prog, &mut rng);
        prog.push(o("CHK_TIME"));
        prog.push(o("CHK_DBG"));
        emit_junk(&mut prog, &mut rng);
        prog.push(o("CHK_TOOLS"));
        prog.push(o("CHK_TIME"));
        prog.push(o("OR"));
        emit_junk(&mut prog, &mut rng);
        prog.push(o("CHK_INTEG"));
        prog.push(o("OR"));
        prog.push(o("NOT"));
        emit_junk(&mut prog, &mut rng);
        prog.push(o("HALT"));
    }

    // ─── 4b. BOGUS / DEAD-CODE: случайные байты ПОСЛЕ точки выхода (HALT/RHALT).
    // Никогда не выбираются исполнением (kstate не затрагивается), но добавляют
    // фиктивные "инструкции" в статический дизассемблер.
    let deadn = 12 + rng.range(28);
    for _ in 0..deadn { prog.push(rng.byte()); }

    // ─── 5. ЦЕПОЧЕЧНОЕ шифрование (execution-dependent) + блочная целостность ─
    // Ключ байта i зависит от УЖЕ зашифрованных plaintext-байтов (running
    // kstate). Расшифровать byte N статически нельзя — нужно проэмулировать
    // выборку байтов 0..N. Программа линейна (нет взятых переходов), поэтому
    // порядок выборки в рантайме == порядок здесь.
    let mut kstate = build_seed;
    let mut cipher: Vec<u8> = Vec::with_capacity(prog.len());
    for (i, &p) in prog.iter().enumerate() {
        let ksb = (sm64(kstate ^ (i as u64)) & 0xff) as u8;
        cipher.push(p ^ ksb);
        kstate = sm64(kstate.wrapping_add(p as u64).rotate_left(13) ^ 0xD1B54A32D192ED03);
    }
    let nblocks = 5usize;
    let bsize = (cipher.len() + nblocks - 1) / nblocks;
    let mut block_ck: Vec<u64> = Vec::new();
    let mut i = 0;
    while i < cipher.len() { let e = (i+bsize).min(cipher.len()); block_ck.push(fnv(&cipher[i..e])); i = e; }
    let meta_ck = fnv(&block_ck.iter().flat_map(|x| x.to_le_bytes()).collect::<Vec<u8>>());

    // ─── 5b. N НЕЗАВИСИМЫХ МИНИ-VM. Каждая: host(id) -> чётное число XOR_K
    //        (opaque, значение восстанавливается) -> halt + dead-code. У каждой
    //        свой seed, свой ключ, свой цепочечный шифр и своя блочная целостность.
    //        Проверки dbg/tools/integ назначаются на РАЗНЫЕ мини-VM — компрометация
    //        одной не раскрывает остальные.
    let _ = (inner_k, inner_seed);
    let inner_count = 5 + rng.range(4); // 5..8
    let mut inner_progs_cipher: Vec<Vec<u8>> = Vec::new();
    let mut inner_seeds: Vec<u64> = Vec::new();
    let mut inner_ks: Vec<u64> = Vec::new();
    let mut inner_bsizes: Vec<usize> = Vec::new();
    let mut inner_blocks: Vec<Vec<u64>> = Vec::new();
    let mut inner_metas: Vec<u64> = Vec::new();
    for _vmi in 0..inner_count {
        let seed_i = rng.next();
        let key_i = rng.next();
        let mut p: Vec<u8> = Vec::new();
        p.push(o("IHOST"));
        let pairs = 1 + rng.range(3); // 1..3 пары XOR_K (чётно)
        for _ in 0..pairs {
            p.push(o("IXOR_K"));
            if rng.range(2) == 0 { p.push(o("INOP")); }
            p.push(o("IXOR_K"));
        }
        p.push(o("IHALT"));
        let dn = 4 + rng.range(10);
        for _ in 0..dn { p.push(rng.byte()); }
        let mut ik = seed_i;
        let mut cph: Vec<u8> = Vec::with_capacity(p.len());
        for (ii, &pp) in p.iter().enumerate() {
            let ksb = (sm64(ik ^ (ii as u64)) & 0xff) as u8;
            cph.push(pp ^ ksb);
            ik = sm64(ik.wrapping_add(pp as u64).rotate_left(13) ^ 0xD1B54A32D192ED03);
        }
        let bs = ((cph.len() + 2) / 3).max(1);
        let mut blk: Vec<u64> = Vec::new();
        let mut jj = 0usize;
        while jj < cph.len() { let e = (jj + bs).min(cph.len()); blk.push(fnv(&cph[jj..e])); jj = e; }
        let mt = fnv(&blk.iter().flat_map(|x| x.to_le_bytes()).collect::<Vec<u8>>());
        inner_progs_cipher.push(cph);
        inner_seeds.push(seed_i);
        inner_ks.push(key_i);
        inner_bsizes.push(bs);
        inner_blocks.push(blk);
        inner_metas.push(mt);
    }
    // назначение проверок на разные мини-VM
    let mut idxpool: Vec<usize> = (0..inner_count).collect();
    for i in (1..idxpool.len()).rev() { let j = rng.range(i+1); idxpool.swap(i, j); }
    let vm_idx_dbg = idxpool[0];
    let vm_idx_tools = idxpool[1];
    let vm_idx_integ = idxpool[2];

    // ─── 6. Вывод vm_gen.rs ──────────────────────────────────────────────────
    let mut v = std::fs::File::create(std::path::Path::new(&out_dir).join("vm_gen.rs")).unwrap();
    for n in snames.iter() { writeln!(v, "pub(crate) const OP_{}: u8 = {};", n, o(n)).unwrap(); }
    for n in rnames.iter() { writeln!(v, "pub(crate) const {}: u8 = {};", n, o(n)).unwrap(); }
    writeln!(v, "pub(crate) const VM_FLAVOR: u8 = {};", flavor).unwrap();
    writeln!(v, "pub(crate) const HOST_XOR: u8 = {};", host_xor).unwrap();
    writeln!(v, "pub(crate) const HOST_DBG: u8 = {};", h_dbg).unwrap();
    writeln!(v, "pub(crate) const HOST_TOOLS: u8 = {};", h_tools).unwrap();
    writeln!(v, "pub(crate) const HOST_INTEG: u8 = {};", h_integ).unwrap();
    writeln!(v, "pub(crate) const REG_ALIAS: [u8; 64] = [{}];", fmt(&alias)).unwrap();
    writeln!(v, "pub(crate) const CAN0: u64 = {};", can0).unwrap();
    writeln!(v, "pub(crate) const CAN1: u64 = {};", can1).unwrap();
    writeln!(v, "pub(crate) const STACK_MASK: u64 = {};", stack_mask).unwrap();
    writeln!(v, "pub(crate) const PROG_SEED: u64 = {};", build_seed).unwrap();
    writeln!(v, "pub(crate) const OBF_PROG: &[u8] = &[{}];", fmt(&cipher)).unwrap();
    writeln!(v, "pub(crate) const BLOCK_SIZE: usize = {};", bsize).unwrap();
    writeln!(v, "pub(crate) const BLOCK_CK: &[u64] = &[{}];", fmt64(&block_ck)).unwrap();
    writeln!(v, "pub(crate) const META_CK: u64 = {};", meta_ck).unwrap();
    for n in inames.iter() { writeln!(v, "pub(crate) const {}: u8 = {};", n, o(n)).unwrap(); }
    writeln!(v, "pub(crate) const INNER_COUNT: usize = {};", inner_count).unwrap();
    for (i, c) in inner_progs_cipher.iter().enumerate() {
        writeln!(v, "pub(crate) const OBF_INNER_{}: &[u8] = &[{}];", i, fmt(c)).unwrap();
        writeln!(v, "pub(crate) const INNER_BLK_{}: &[u64] = &[{}];", i, fmt64(&inner_blocks[i])).unwrap();
    }
    writeln!(v, "pub(crate) const INNER_PROGS: [&[u8]; {}] = [{}];", inner_count,
        (0..inner_count).map(|i| format!("OBF_INNER_{}", i)).collect::<Vec<_>>().join(",")).unwrap();
    writeln!(v, "pub(crate) const INNER_BLKS: [&[u64]; {}] = [{}];", inner_count,
        (0..inner_count).map(|i| format!("INNER_BLK_{}", i)).collect::<Vec<_>>().join(",")).unwrap();
    writeln!(v, "pub(crate) const INNER_SEEDS: [u64; {}] = [{}];", inner_count, fmt64(&inner_seeds)).unwrap();
    writeln!(v, "pub(crate) const INNER_KS: [u64; {}] = [{}];", inner_count, fmt64(&inner_ks)).unwrap();
    writeln!(v, "pub(crate) const INNER_BSIZES: [usize; {}] = [{}];", inner_count,
        inner_bsizes.iter().map(|x| x.to_string()).collect::<Vec<_>>().join(",")).unwrap();
    writeln!(v, "pub(crate) const INNER_METAS: [u64; {}] = [{}];", inner_count, fmt64(&inner_metas)).unwrap();
    writeln!(v, "pub(crate) const VM_IDX_DBG: usize = {};", vm_idx_dbg).unwrap();
    writeln!(v, "pub(crate) const VM_IDX_TOOLS: usize = {};", vm_idx_tools).unwrap();
    writeln!(v, "pub(crate) const VM_IDX_INTEG: usize = {};", vm_idx_integ).unwrap();
    writeln!(v, "pub(crate) const TIME_BUDGET_MS: u64 = {};", time_budget_ms).unwrap();

    println!("cargo:warning=VM flavor selected: {}", flavor);
    tauri_build::build()
}