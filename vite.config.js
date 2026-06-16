import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const host = process.env.TAURI_DEV_HOST;

const OBF_OPTIONS = {
  compact:                          true,
  controlFlowFlattening:            true,
  controlFlowFlatteningThreshold:   0.4,
  deadCodeInjection:                true,
  deadCodeInjectionThreshold:       0.15,
  debugProtection:                  true,
  debugProtectionInterval:          3000,
  disableConsoleOutput:             true,
  identifierNamesGenerator:         "hexadecimal",
  identifiersPrefix:                "_",
  renameGlobals:                    false,
  renameProperties:                 false, // ломает React
  selfDefending:                    true,
  splitStrings:                     true,
  splitStringsChunkLength:          6,
  stringArray:                      true,
  stringArrayCallsTransform:        true,
  stringArrayCallsTransformThreshold: 0.6,
  stringArrayEncoding:              ["rc4"],
  stringArrayIndexShift:            true,
  stringArrayRotate:                true,
  stringArrayShuffle:               true,
  stringArrayWrappersCount:         3,
  stringArrayWrappersChainedCalls:  true,
  stringArrayWrappersParametersMaxCount: 4,
  stringArrayWrappersType:          "function",
  stringArrayThreshold:             0.8,
  numbersToExpressions:             true,
  simplify:                         true,
  transformObjectKeys:              false,
  unicodeEscapeSequence:            false,
  target:                           "browser",
};

function obfuscatePlugin() {
  return {
    name: "sbgames-obfuscate",
    apply: "build",
    enforce: "post",
    async generateBundle(_opts, bundle) {
      let JavaScriptObfuscator;
      try { JavaScriptObfuscator = (await import("javascript-obfuscator")).default; } catch { return; }
      for (const [fileName, chunk] of Object.entries(bundle)) {
        if (chunk.type !== "chunk" || !fileName.endsWith(".js")) continue;
        try {
          chunk.code = JavaScriptObfuscator.obfuscate(chunk.code, OBF_OPTIONS).getObfuscatedCode();
        } catch (e) {
          console.warn(`[obfuscate] skipped ${fileName}:`, e.message);
        }
      }
    },
  };
}

export default defineConfig(({ command, mode }) => {
  if (process.env.TRAY_BUILD) {
    return {
      plugins: [react(), obfuscatePlugin()],
      build: {
        outDir: "dist-tray",
        emptyOutDir: true,
        rollupOptions: {
          input: { main: path.resolve(__dirname, "tray.html") },
        },
        sourcemap: false,
        minify: "terser",
        terserOptions: { compress: { drop_console: true, drop_debugger: true } },
      },
      resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
    };
  }
  return {
    plugins: [react()], // obfuscatePlugin() disabled temporarily for debugging
    clearScreen: false,
    server: {
      port: 1420,
      strictPort: true,
      host: host || false,
      hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
      watch: { ignored: ["**/src-tauri/**"] },
    },
    resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
    build: {
      sourcemap: false,
      minify: "terser",
      terserOptions: { compress: { drop_console: true, drop_debugger: true } },
    },
  };
});
