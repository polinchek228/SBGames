import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { copyFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { createReadStream } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Агрессивный пресет обфускации. Цель — максимально усложнить реверс;
// размер бандла и перф в приоритете НЕТ.
//
// ВАЖНО про два флага ниже: они намеренно `false`.
// `renameProperties` / `transformObjectKeys: true` переименовывают имена
// свойств объектов (onClick, createElement, className, ...), что ломает
// React/JSX и DOM-события — приложение падает в рантайме. Это известная
// несовместимость javascript-obfuscator с фреймворками, поэтому оба флага
// выключены, а защита компенсирована всеми остальными рычагами на максимум.
const SITE_OBF_OPTIONS = {
  compact:                               true,
  // ── control flow ──
  controlFlowFlattening:                 true,
  controlFlowFlatteningThreshold:        1,
  deadCodeInjection:                     true,
  deadCodeInjectionThreshold:            1,
  // ── anti-debug / anti-tamper ──
  debugProtection:                       true,
  debugProtectionInterval:               4000,
  disableConsoleOutput:                  true,
  selfDefending:                         true,
  // ── identifiers ──
  identifierNamesGenerator:              "hexadecimal",
  renameGlobals:                         false,
  renameProperties:                      false,
  // ── strings ──
  splitStrings:                          true,
  splitStringsChunkLength:               3,
  stringArray:                           true,
  stringArrayCallsTransform:             true,
  stringArrayCallsTransformThreshold:    1,
  stringArrayEncoding:                   ["base64", "rc4"],
  stringArrayIndexes:                    true,
  stringArrayRotate:                     true,
  stringArrayShuffle:                    true,
  stringArrayWrappersCount:              3,
  stringArrayWrappersChainedCalls:       true,
  stringArrayWrappersParametersMaxCount: 4,
  stringArrayWrappersType:               "function",
  stringArrayThreshold:                  1,
  // ── expressions ──
  numbersToExpressions:                  true,
  simplify:                              true,
  transformObjectKeys:                   false,
  unicodeEscapeSequence:                 true,
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
  },
});
