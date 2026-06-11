import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { copyFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { createReadStream } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));

const SITE_OBF_OPTIONS = {
  compact:                        true,
  controlFlowFlattening:          true,
  controlFlowFlatteningThreshold: 0.25,
  deadCodeInjection:              true,
  deadCodeInjectionThreshold:     0.1,
  debugProtection:                true,
  debugProtectionInterval:        2000,
  disableConsoleOutput:           true,
  identifierNamesGenerator:       "hexadecimal",
  renameGlobals:                  false,
  renameProperties:               false,
  selfDefending:                  true,
  splitStrings:                   true,
  splitStringsChunkLength:        8,
  stringArray:                    true,
  stringArrayCallsTransform:      true,
  stringArrayCallsTransformThreshold: 0.5,
  stringArrayEncoding:            ["rc4"],
  stringArrayRotate:              true,
  stringArrayShuffle:             true,
  stringArrayThreshold:           0.7,
  numbersToExpressions:           true,
  simplify:                       true,
  transformObjectKeys:            false,
  unicodeEscapeSequence:          false,
  target:                         "browser",
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
