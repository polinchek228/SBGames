import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { copyFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { createReadStream } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Сбалансированный пресет обфускации: крепкая защита + быстрая загрузка.
//
// Логика баланса: выкрученные на 1.0 пороги (flatten/deadCode) создают
// предсказуемые шаблоны, которые авто-деобфускаторы (synchrony, webcrack)
// узнают и снимают, — а ещё жёстко тормозят парс/стартап. Умеренные пороги
// ~0.6 с Rc4-кодированным stringArray дают более «грязный» и устойчивый
// результат при раз в 5 меньшем размере бандла.
//
// ВАЖНО про два флага ниже: они намеренно `false`.
// `renameProperties` / `transformObjectKeys: true` переименовывают имена
// свойств объектов (onClick, createElement, className, ...), что ломает
// React/JSX и DOM-события — приложение падает в рантайме. Это известная
// несовместимость javascript-obfuscator с фреймворками, поэтому оба флага
// выключены.
const SITE_OBF_OPTIONS = {
  compact:                               true,
  // ── control flow (умеренно — без кратного раздувания) ──
  controlFlowFlattening:                 true,
  controlFlowFlatteningThreshold:        0.4,
  deadCodeInjection:                     false,
  deadCodeInjectionThreshold:            0.4,
  // ── anti-debug / anti-tamper ──
  debugProtection:                       false,
  debugProtectionInterval:               4000,
  disableConsoleOutput:                  true,
  selfDefending:                         true,
  // ── identifiers ──
  identifierNamesGenerator:              "hexadecimal",
  renameGlobals:                         false,
  renameProperties:                      false,
  // ── strings (основной слой защиты) ──
  stringArray:                           true,
  stringArrayCallsTransform:             true,
  stringArrayCallsTransformThreshold:    0.6,
  stringArrayEncoding:                   ["rc4"],
  stringArrayIndexes:                    true,
  stringArrayRotate:                     true,
  stringArrayShuffle:                    true,
  stringArrayWrappersCount:              2,
  stringArrayWrappersChainedCalls:       true,
  stringArrayWrappersParametersMaxCount: 3,
  stringArrayWrappersType:               "function",
  stringArrayThreshold:                  0.75,
  // splitStrings ВЫКЛ — главная причина тормозов при старте (тысячи
  // конкатенаций в рантайме). StringArray уже прячет строки под RC4.
  splitStrings:                          false,
  // ── expressions ──
  numbersToExpressions:                  true,
  simplify:                              true,
  transformObjectKeys:                   false,
  unicodeEscapeSequence:                 false,
  // ── scope ──
  sourceMap:                             false,
  sourceMapMode:                         "separate",
  target:                                "browser",
};

function obfuscateSitePlugin() {
  return {
    name: "sbgames-site-obfuscate",
    apply: "build",
    enforce: "post",
    async generateBundle(_opts, bundle) {
      let Obf;
      try { Obf = (await import("javascript-obfuscator")).default; } catch { return; }
      for (const [fileName, chunk] of Object.entries(bundle)) {
        if (chunk.type !== "chunk" || !fileName.endsWith(".js")) continue;
        // Не обфусцируем сторонние библиотеки (three.js, react, framer-motion и т.п.)
        // — это только раздувает бандл и тормозит, защищать чужой код смысла нет.
        const ids = chunk.moduleIds || Object.keys(chunk.modules || {});
        const isVendor = ids.length > 0 && ids.every((id) => id.includes("node_modules"));
        if (isVendor) continue;
        try {
          chunk.code = Obf.obfuscate(chunk.code, SITE_OBF_OPTIONS).getObfuscatedCode();
        } catch (e) {
          console.warn(`[obfuscate] skipped ${fileName}:`, e.message);
        }
      }
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    obfuscateSitePlugin(),
    {
      name: "serve-hero-img",
      closeBundle() {
        const src = resolve(__dirname, "../hero.jpg");
        const dst = resolve(__dirname, "dist/hero.jpg");
        if (existsSync(src)) copyFileSync(src, dst);
      },
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === "/hero.jpg") {
            const src = resolve(__dirname, "../hero.jpg");
            if (existsSync(src)) {
              res.setHeader("Content-Type", "image/jpeg");
              createReadStream(src).pipe(res);
            } else next();
            return;
          }
          next();
        });
      },
    },
  ],
  build: {
    sourcemap: false,
    minify: "terser",
    terserOptions: {
      compress: { drop_console: true, drop_debugger: true, passes: 3 },
      mangle: { toplevel: true },
    },
    rollupOptions: {
      output: {
        // Бьём тяжёлые библиотеки на отдельные кэшируемые чанки,
        // чтобы они не раздували чанк страницы и кэшировались между релизами.
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("skinview3d") || id.includes("three")) return "v3d";
          if (id.includes("framer-motion")) return "vfm";
          if (id.includes("react-dom") || id.includes("/react/") || id.includes("react-router")) return "vreact";
          return "vendor";
        },
        // Имена из чистого хэша — никаких AdminPage/CabinetPage и т.п. в Sources
        entryFileNames: "assets/[hash].js",
        chunkFileNames: "assets/[hash].js",
        assetFileNames: "assets/[hash][extname]",
      },
    },
  },
});