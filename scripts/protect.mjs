#!/usr/bin/env node
// scripts/protect.mjs
// Пост-билд: прогоняет готовый .exe через VM-протектор (VMProtect / Themida).
// Протекторы коммерческие — скрипт лишь вызывает их CLI, если он настроен.
//
// Настройка (env):
//   VMPROTECT_CLI  = путь к VMProtect_Con.exe
//   VMPROTECT_PROJ = путь к .vmp проект-файлу (настройки виртуализации)
//   THEMIDA_CLI    = путь к Themida.exe (CLI)
//   THEMIDA_PROJ   = путь к .tmd проект-файлу
// Если ничего не задано — печатает инструкцию и выходит без ошибки.





const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const conf = JSON.parse(readFileSync(join(ROOT, "src-tauri", "tauri.conf.json"), "utf8"));
const releaseDir = join(ROOT, "src-tauri", "target", "release");
const exeCandidates = [
  join(releaseDir, conf.productName + ".exe"),
  join(releaseDir, "sbgames-launcher.exe"),
];
const exe = exeCandidates.find((p) => existsSync(p));
if (!exe) { console.error("[protect] .exe не найден — сначала npm run tauri build"); process.exit(1); }

const { VMPROTECT_CLI, VMPROTECT_PROJ, THEMIDA_CLI, THEMIDA_PROJ } = process.env;

try {
  if (VMPROTECT_CLI && existsSync(VMPROTECT_CLI)) {
    console.log("[protect] VMProtect:", exe);
    // VMProtect_Con.exe <input> [output] [-pf project]
    const args = [exe, exe];
    if (VMPROTECT_PROJ) args.push("-pf", VMPROTECT_PROJ);
    execFileSync(VMPROTECT_CLI, args, { stdio: "inherit" });
    console.log("[protect] ✓ VMProtect применён");
  } else if (THEMIDA_CLI && existsSync(THEMIDA_CLI)) {
    console.log("[protect] Themida:", exe);
    // Themida.exe /protect <project.tmd> /inputfile <exe> /outputfile <exe>
    const args = ["/protect", THEMIDA_PROJ || "", "/inputfile", exe, "/outputfile", exe];
    execFileSync(THEMIDA_CLI, args, { stdio: "inherit" });
    console.log("[protect] ✓ Themida применён");
  } else {
    console.log("[protect] ⚠ VM-протектор не настроен — пропускаю.");
    console.log("[protect]   Задай VMPROTECT_CLI(+VMPROTECT_PROJ) или THEMIDA_CLI(+THEMIDA_PROJ).");
    console.log("[protect]   Цель для защиты:", exe);
  }
} catch (e) {
  console.error("[protect] ошибка протектора:", e.message);
  process.exit(1);
}
