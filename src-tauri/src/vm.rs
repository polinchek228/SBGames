//! Виртуализирующая VM (v6: + N мини-VM, + анти-эмуляция по таймингу) для критичной security-логики.
//!
//! НОВОЕ в v5: N НЕЗАВИСИМЫХ МИНИ-VM. Каждая проверка (dbg/tools/integ)
//! исполняется СВОЕЙ изолированной мини-VM (свои опкоды, свой цепочечный шифр, своя блочная
//! целостность). Реверсеру нужно разобрать ДВЕ виртуальные машины.
//!
//! Из v4: ЦЕПОЧЕЧНАЯ (execution-dependent) дешифровка байткода.
//! Ключ выборки байта i зависит от уже выбранных plaintext-байтов (running
//! kstate). Расшифровать инструкцию N статически невозможно — нужно
//! проэмулировать выборку 0..N. Это класс самомодифицирующегося байткода:
//! "поток ключа" мутирует по мере исполнения.
//!
//! Из v3: 3 архитектуры (stack / threaded / register), полиморфные опкоды,
//! зашифрованный стек + канарейки, 64 регистра с alias, блочная целостность,
//! зашифрованные HOST-id, CALL/RET.
#![allow(dead_code, non_upper_case_globals)]

include!(concat!(env!("OUT_DIR"), "/vm_gen.rs"));

pub enum Sig { Ok, Destruct }

#[inline(always)]
fn sm64(x: u64) -> u64 {
    let mut z = x.wrapping_add(0x9E3779B97F4A7C15);
    z = (z ^ (z >> 30)).wrapping_mul(0xBF58476D1CE4E5B9);
    z = (z ^ (z >> 27)).wrapping_mul(0x94D049BB133111EB);
    z ^ (z >> 31)
}

#[inline(never)]
fn fnv(p: &[u8]) -> u64 {
    let mut h: u64 = 0xcbf29ce484222325;
    for &b in p { h ^= b as u64; h = h.wrapping_mul(0x100000001b3); }
    h
}

/// Выборщик байтов с цепочечным ключом (идентично build.rs).
struct Fetcher { pc: usize, kstate: u64, prog: &'static [u8] }
impl Fetcher {
    #[inline(always)]
    fn next(&mut self) -> Option<u8> {
        if self.pc >= self.prog.len() { return None; }
        let ksb = (sm64(self.kstate ^ (self.pc as u64)) & 0xff) as u8;
        let p = self.prog[self.pc] ^ ksb;
        self.kstate = sm64(self.kstate.wrapping_add(p as u64).rotate_left(13) ^ 0xD1B54A32D192ED03);
        self.pc += 1;
        Some(p)
    }
}

#[inline(always)]
fn alias(l: u8) -> usize { REG_ALIAS[(l & 63) as usize] as usize }

#[inline(never)]
fn blocks_ok(prog: &[u8], bsize: usize, ck: &[u64], meta: u64) -> bool {
    let mut i = 0usize; let mut idx = 0usize; let mut acc: Vec<u8> = Vec::new();
    while i < prog.len() {
        let e = (i + bsize).min(prog.len());
        let c = fnv(&prog[i..e]);
        if idx >= ck.len() || c != ck[idx] { return false; }
        acc.extend_from_slice(&c.to_le_bytes());
        i = e; idx += 1;
    }
    fnv(&acc) == meta
}

/// Выбор мини-VM по типу проверки. Каждая проверка обслуживается своей
/// изолированной VM (свой seed/ключ/шифр/целостность).
#[inline(never)]
fn inner_vm_for(id: u8) -> usize {
    if id == HOST_DBG { VM_IDX_DBG }
    else if id == HOST_TOOLS { VM_IDX_TOOLS }
    else if id == HOST_INTEG { VM_IDX_INTEG }
    else { 0 }
}

/// Запускает ВЫДЕЛЕННУЮ под данную проверку мини-VM: вычисляет host(id)
/// через opaque-трансформы (чётное число XOR с ключом этой VM).
fn run_inner(host: fn(u8) -> u64, id: u8) -> Option<u64> {
    let vi = inner_vm_for(id);
    if vi >= INNER_COUNT { return None; }
    let key = INNER_KS[vi];
    let mut f = Fetcher { pc: 0, kstate: INNER_SEEDS[vi], prog: INNER_PROGS[vi] };
    let mut steps = 0u32;
    let mut r: u64 = 0;
    loop {
        steps += 1;
        if steps > 10_000 { return None; }
        let op = f.next()?;
        if op == IHALT { break; }
        else if op == IHOST { r = host(id); }
        else if op == IXOR_K { r ^= key; }
        else if op == INOP { }
        else { return None; }
    }
    Some(r)
}

pub fn run(host: fn(u8) -> u64) -> Sig {
    if !blocks_ok(OBF_PROG, BLOCK_SIZE, BLOCK_CK, META_CK) { return Sig::Destruct; }
    let mut _vci = 0usize;
    while _vci < INNER_COUNT {
        if !blocks_ok(INNER_PROGS[_vci], INNER_BSIZES[_vci], INNER_BLKS[_vci], INNER_METAS[_vci]) { return Sig::Destruct; }
        _vci += 1;
    }
    match VM_FLAVOR {
        0 => run_stack(host, false),
        1 => run_stack(host, true),
        _ => run_register(host),
    }
}

// ════════════════════════════════════════════════════════════════════════════
//  STACK / THREADED
// ════════════════════════════════════════════════════════════════════════════
fn run_stack(host: fn(u8) -> u64, threaded: bool) -> Sig {
    let t0 = std::time::Instant::now();
    let mut f = Fetcher { pc: 0, kstate: PROG_SEED, prog: OBF_PROG };
    let mut steps = 0u32;
    let mut data: Vec<u64> = Vec::with_capacity(64);
    let mut call: Vec<usize> = Vec::with_capacity(32);
    let mut fake: Vec<u64> = Vec::with_capacity(16);
    let mut regs = [0u64; 64];
    let mut mask = STACK_MASK;
    let (can0, can1) = (CAN0, CAN1);

    macro_rules! push { ($v:expr) => {{ let vv = $v; data.push(vv ^ mask); mask = mask.rotate_left(7) ^ 0x9E37; }} }
    macro_rules! pop { () => {{ match data.pop() { Some(x) => { mask = (mask ^ 0x9E37).rotate_right(7); x ^ mask } None => return Sig::Destruct } }} }
    macro_rules! nb { () => {{ match f.next() { Some(b) => b, None => return Sig::Destruct } }} }
    macro_rules! hv { ($id:expr) => {{ match run_inner(host, $id) { Some(v)=>v, None=>return Sig::Destruct } }} }

    let mut disp = [255u8; 256];
    disp[OP_HALT as usize]=0;  disp[OP_PUSH as usize]=1;  disp[OP_PUSHR as usize]=2;
    disp[OP_POPR as usize]=3;  disp[OP_HOST as usize]=4;  disp[OP_DUP as usize]=5;
    disp[OP_XOR as usize]=6;   disp[OP_ADD as usize]=7;   disp[OP_SUB as usize]=8;
    disp[OP_AND as usize]=9;   disp[OP_OR as usize]=10;   disp[OP_EQ as usize]=11;
    disp[OP_NOT as usize]=12;  disp[OP_JZ as usize]=13;   disp[OP_JMP as usize]=14;
    disp[OP_CALL as usize]=15; disp[OP_RET as usize]=16;  disp[OP_DESTRUCT as usize]=17;
    disp[OP_NOP as usize]=18;  disp[OP_ROT_STACK as usize]=19; disp[OP_CANARY as usize]=20;
    disp[OP_CHK_DBG as usize]=21; disp[OP_CHK_TOOLS as usize]=22; disp[OP_CHK_INTEG as usize]=23;
    disp[OP_CHK_TIME as usize]=24;

    let state_perm: [u8; 25] = { let mut p=[0u8;25]; let mut i=0; while i<25 { p[i]=i as u8; i+=1; } p };

    loop {
        steps += 1;
        if steps > 2_000_000 { return Sig::Destruct; }
        if can0 != CAN0 || can1 != CAN1 { return Sig::Destruct; }
        let op = nb!();
        let mut hid = disp[op as usize];
        if threaded { if (hid as usize) < state_perm.len() { hid = state_perm[hid as usize]; } }
        match hid {
            0  => break,
            1  => { let sz = nb!(); let n = match sz {0=>1,1=>2,2=>4,_=>8};
                    let mut val=0u64; for kk in 0..n { let bb = nb!(); val |= (bb as u64)<<(8*kk); }
                    push!(val); }
            2  => { let r = nb!(); push!(regs[alias(r)]); }
            3  => { let r = nb!(); let v = pop!(); regs[alias(r)] = v; }
            4  => { let id = nb!() ^ HOST_XOR; push!(hv!(id)); }
            5  => { let v = pop!(); push!(v); push!(v); }
            6  => { let a=pop!(); let b=pop!(); push!(a^b); }
            7  => { let a=pop!(); let b=pop!(); push!(a.wrapping_add(b)); }
            8  => { let a=pop!(); let b=pop!(); push!(b.wrapping_sub(a)); }
            9  => { let a=pop!(); let b=pop!(); push!(a & b); }
            10 => { let a=pop!(); let b=pop!(); push!(a | b); }
            11 => { let a=pop!(); let b=pop!(); push!((a==b) as u64); }
            12 => { let a=pop!(); push!((a==0) as u64); }
            13 => { let lo=nb!() as usize; let hi=nb!() as usize; if pop!()==0 { f.pc = lo|(hi<<8); } }
            14 => { let lo=nb!() as usize; let hi=nb!() as usize; f.pc = lo|(hi<<8); }
            15 => { let lo=nb!() as usize; let hi=nb!() as usize; call.push(f.pc); f.pc = lo|(hi<<8); }
            16 => { match call.pop(){Some(a)=>f.pc=a,None=>return Sig::Destruct} }
            17 => return Sig::Destruct,
            18 => {}
            19 => { fake.push(steps as u64); if fake.len()>8 { fake.remove(0); } }
            20 => { if can0!=CAN0 || can1!=CAN1 { return Sig::Destruct; } }
            21 => { push!(hv!(HOST_DBG)); }
            22 => { push!(hv!(HOST_TOOLS)); }
            23 => { push!(hv!(HOST_INTEG)); }
            24 => { if t0.elapsed().as_millis() as u64 > TIME_BUDGET_MS { return Sig::Destruct; } }
            _  => return Sig::Destruct,
        }
    }
    if pop!() == 1 { Sig::Ok } else { Sig::Destruct }
}

// ════════════════════════════════════════════════════════════════════════════
//  REGISTER
// ════════════════════════════════════════════════════════════════════════════
fn run_register(host: fn(u8) -> u64) -> Sig {
    let t0 = std::time::Instant::now();
    let mut f = Fetcher { pc: 0, kstate: PROG_SEED, prog: OBF_PROG };
    let mut steps = 0u32;
    let mut regs = [0u64; 64];
    let mut result_reg: i32 = -1;
    macro_rules! nb { () => {{ match f.next() { Some(b) => b, None => return Sig::Destruct } }} }

    loop {
        steps += 1;
        if steps > 2_000_000 { return Sig::Destruct; }
        let op = nb!();
        if op == RHALT {
            let rd = nb!(); result_reg = alias(rd) as i32; break;
        } else if op == RLOAD_HOST {
            let rd = nb!(); let id = nb!() ^ HOST_XOR; regs[alias(rd)] = match run_inner(host, id) { Some(v)=>v, None=>return Sig::Destruct };
        } else if op == ROR {
            let rd = nb!(); let ra = nb!(); let rb = nb!();
            regs[alias(rd)] = regs[alias(ra)] | regs[alias(rb)];
        } else if op == RNOT {
            let rd = nb!(); let ra = nb!(); regs[alias(rd)] = (regs[alias(ra)] == 0) as u64;
        } else if op == RMOV {
            let rd = nb!(); let ra = nb!(); regs[alias(rd)] = regs[alias(ra)];
        } else if op == RCHK_TIME {
            if t0.elapsed().as_millis() as u64 > TIME_BUDGET_MS { return Sig::Destruct; }
        } else if op == RNOP {
        } else {
            return Sig::Destruct;
        }
    }
    if result_reg >= 0 && regs[result_reg as usize] == 1 { Sig::Ok } else { Sig::Destruct }
}