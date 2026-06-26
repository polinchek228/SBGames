#!/usr/bin/env node
// scripts/gen-attest.mjs
// Пост-билд: считает SHA-256 готового .exe лаунчера + (опц.) модов сборки,
// подписывает HMAC и пишет server/release-attest.json.
// Клиент сверяет свой рантайм-хеш с этим файлом через /api/attest/expected.
//
// Запуск: node scripts/gen-attest.mjs
// Секрет берётся из env SBG_ATTEST_SECRET (тот же, что на сервере).




const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

function sha256File(p) {
  return createHash("sha256").update(readFileSync(p)).digest("hex");
}

// 1. Версия из tauri.conf.json
const conf = JSON.parse(readFileSync(join(ROOT, "src-tauri", "tauri.conf.json"), "utf8"));
const version = conf.version;
const productName = conf.productName; // SBGames-Launcher

// 2. Находим собранный .exe (NSIS-инсталлер ставит этот бинарь; хешируем сам .exe из target/release)
const releaseDir = join(ROOT, "src-tauri", "target", "release");
const exeCandidates = [
  join(releaseDir, productName + ".exe"),
  join(releaseDir, "sbgames-launcher.exe"),
];
const exePath = exeCandidates.find((p) => existsSync(p));
if (!exePath) {
  console.error("[attest] .exe не найден. Сначала собери: npm run tauri build");
  console.error("[attest] искал:", exeCandidates.join(", "));
  process.exit(1);
}
const exeHash = sha256File(exePath);

// 3. (Опц.) хеши модов сборки — путь через env SBG_MODS_DIR
const mods = {};
const modsDir = process.env.SBG_MODS_DIR;
if (modsDir && existsSync(modsDir)) {
  for (const f of readdirSync(modsDir)) {
    if (f.toLowerCase().endsWith(".jar")) {
      const fp = join(modsDir, f);
      if (statSync(fp).isFile()) mods[f] = sha256File(fp);
    }
  }
}

// 4. Подпись
const secret = process.env.SBG_ATTEST_SECRET || "";
if (!secret) {
  console.warn("[attest] ⚠ SBG_ATTEST_SECRET не задан — файл будет без подписи (НЕ для прода!)");
}
const payload = {
  version,
  exeHash,
  mods,
  generatedAt: new Date().toISOString(),
};
const canonical = JSON.stringify(payload);
const sig = secret ? createHmac("sha256", secret).update(canonical).digest("hex") : null;

const out = { ...payload, sig };
const outPath = join(ROOT, "server", "release-attest.json");
writeFileSync(outPath, JSON.stringify(out, null, 2));

console.log("[attest] ✓ записано:", outPath);
console.log("[attest]   version :", version);
console.log("[attest]   exe     :", exePath);
console.log("[attest]   exeHash :", exeHash);
console.log("[attest]   mods    :", Object.keys(mods).length, "шт.");
console.log("[attest]   signed  :", !!sig);