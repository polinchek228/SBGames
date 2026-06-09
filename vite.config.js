import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const host = process.env.TAURI_DEV_HOST;

// Обфускация только в prod через кастомный Rollup-плагин
function obfuscatePlugin() {
  return {
    name: "sbgames-obfuscate",
    apply: "build",
    async generateBundle(opts, bundle) {
      let JavaScriptObfuscator;
      try { JavaScriptObfuscator = (await import("javascript-obfuscator")).default; } catch { return; }
      for (const chunk of Object.values(bundle)) {
        if (chunk.type === "chunk" && chunk.fileName.endsWith(".js")) {
          chunk.code = JavaScriptObfuscator.obfuscate(chunk.code, {
            compact: true,
            controlFlowFlattening: true,
            controlFlowFlatteningThreshold: 0.3,
            deadCodeInjection: false,
            debugProtection: true,
            debugProtectionInterval: 2000,
            disableConsoleOutput: true,
            identifierNamesGenerator: "hexadecimal",
            renameGlobals: false,
            selfDefending: true,
            stringArray: true,
            stringArrayEncoding: ["rc4"],
            stringArrayThreshold: 0.75,
            target: "browser",
          }).getObfuscatedCode();
        }
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), obfuscatePlugin()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    watch: { ignored: ["**/src-tauri/**"] },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  build: {
    sourcemap: false,
    minify: "terser",
    terserOptions: {
      compress: { drop_console: true, drop_debugger: true },
    },
  },
});
