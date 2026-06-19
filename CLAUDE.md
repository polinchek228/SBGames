# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

This repo holds **two independent Vite/React apps plus a Rust/Tauri shell and a Java bootstrap**, all part of the SBGames Minecraft launcher product.

- `src/` + `src-tauri/` + `index.html` + `vite.config.js` — **the desktop launcher** (Tauri 2 + React 18). Built by the root `package.json`. The Tauri shell wraps the Vite frontend; updater endpoint is `https://games.sb-capital.group/update/{{target}}/{{arch}}/{{current_version}}`.
- `website/` — **the marketing site + API server** (Vite/React frontend in `website/src/`, Express server in `website/server_index.js` on port 3000). Independent `package.json`. Deployed to `games.sb-capital.group` behind nginx; nginx proxies `/api/` → `localhost:3000`.
- `src-java/com/sbgames/bootstrap/SBGBootstrap.java` — Minecraft launch bootstrap. Compiled to `public/sbg-bootstrap.jar`, embedded into the Rust binary via `include_bytes!`, and written to disk at play time. It is invoked as the JVM main class instead of `cpw.mods.bootstraplauncher` to run security checks before handing control to Forge.
- `sbgames-api.conf` — nginx server block for the legacy `api.hyperionsearch.xyz:8443` host. Some Rust code still pins this host for anti-cheat endpoints (`/api/verify/report`, `/api/verify/banlist`, `/api/mods/manifest`).
- `scratch/` — gitignored throwaway scripts for ops/nginx/deploy experiments. Do not put production code here and do not reference these files from launcher or website code.

The two React apps (`src/` and `website/src/`) share filenames (`LoginPage.jsx`, `PlayPage.jsx`, `ProfilePage.jsx`) but are **separate codebases**. Verify which one you're editing by path — changes in `src/` ship in the Tauri launcher, changes in `website/src/` ship to the public web.

## Commands

Launcher (root):
- `npm run dev` — Vite dev server (frontend only)
- `npm run tauri:dev` — full desktop launcher with hot reload (Rust + frontend). Tauri dev URL is `http://localhost:1420`.
- `npm run tauri:build` — production desktop build (installer in `src-tauri/target/release/bundle/`)
- `npm run build:java` — compile `SBGBootstrap.java` → `public/sbg-bootstrap.jar` (uses `scratch/generate_bootstrap.js` then `scratch/obfuscate.js`)
- `npm run build` — full build: Java bootstrap → main Vite build → tray Vite build (`TRAY_BUILD=1`, into `dist-tray/`) → copy `dist-tray` over `dist`. The tray window is a second Tauri window built from the same source with an env flag.

Website (in `website/`):
- `npm run dev` — Vite dev server for the marketing site
- `npm run build` — production build
- `npm start` — run the Express API server (`server_index.js`) on port 3000 (also serves `/api/*` for the launcher)

There are no tests, no linter, and no formatter configured in either package.json.

## Architecture notes that aren't obvious from file structure

- **Rust core (`src-tauri/src/lib.rs`, ~2800 lines).** The launcher's substance lives here, not in the React UI. It handles the full Minecraft 1.20.1 + Forge 47.4.10 install/launch pipeline (vanilla manifest fetch, library + native classifier resolution, Forge installer headless run + manual zip extraction fallback, classpath assembly split between `--module-path` for `bootstraplauncher`/`securejarhandler`/`asm-*`/`JarJarFileSystems` and `-cp` for everything else), modpack sync against `/api/mods/manifest` with per-mod SHA256 verification, runtime DLL injection watcher (SHA256 of `mods/` every 200ms, DLL allowlist baseline after 4s), Discord RPC, screenshot gallery, Tauri tray window, and Win32 Job Object containment for the Java child process. When changing launch flow, read the surrounding comments — many of the JVM args, `-D` properties, and the `sbg-bootstrap.jar` + `sbg-classpath.jar` + `sbg-classpath.txt` triad exist to work around specific Forge 1.20.1 + Java 17 named-module quirks (e.g. `LauncherVersion.<clinit>` needing `Implementation-Version` on the universal jar — see `patch_universal_manifest`).
- **Java bootstrap is the entrypoint.** The launcher passes `com.sbgames.bootstrap.SBGBootstrap` as the JVM main class. It reads a session key from stdin (handed off by the Rust parent), runs its own debugger/integrity checks, then reflectively invokes `cpw.mods.bootstraplauncher.BootstrapLauncher`. The source contains XOR-decoded string constants and obfuscated identifiers — leave them alone unless you also update `scratch/generate_bootstrap.js`.
- **CSP is hardcoded in `tauri.conf.json`.** `connect-src`, `media-src`, etc. enumerate every backend the launcher talks to (`games.sb-capital.group`, `*.hyperionsearch.xyz`, `api.modrinth.com`, `sessionserver.mojang.com`, `api.mojang.com`, `api.allorigins.win`, `rsshub.app`, `minotar.net`, `fonts.googleapis.com`, `fonts.gstatic.com`). Adding a new host means editing the CSP — fetches will silently fail otherwise.
- **Window chrome.** Both Tauri windows have `decorations: false`; the tray window is also `transparent: true`. UI chrome is drawn by React (`src/components/Titlebar.jsx`). The main window's CSS background colour matters because `transparent: false` on it.
- **Modrinth integration.** `src/lib/modrinth.js` calls `api.modrinth.com/v2` directly from the renderer. `src/pages/catalog.js` exports `LIBRARY_CATALOG` (frames/backgrounds/badges streamed from the CDN at `games.sb-capital.group/{frames,backgrounds,icons}/`) and the Play page merges Modrinth results with first-party content.
- **API host duplication.** The active production API is `games.sb-capital.group`. The Rust modpack/anti-cheat path still uses `api.sbgames.hyperionsearch.xyz:8443` with a pinned public key (`SBG_API_PINNED_PUBKEY` constant). When changing hosts, grep all of `src/`, `website/src/`, `src-tauri/src/lib.rs`, and `sbgames-api.conf` — there is no shared runtime config.
- **Encoding.** Server files were historically saved as cp1251 with broken Cyrillic regex; everything was converted to UTF-8 in commit `c15128f`. Keep new files UTF-8 and avoid editors that re-encode on save.
- **Background videos are not bundled.** `public/fon*.mp4` is gitignored; the launcher streams them from `https://games.sb-capital.group/backgrounds/fonN.mp4`. Same for frames/icons.

## Working conventions for this repo

- Respond to the user in Russian; technical identifiers stay in their original form.
- Never create files in `scratch/` for real work — it's an ops sandbox and gitignored.
- The git working tree is usually noisy (many untracked `scratch/check_*.cjs`, `scratch/deploy_*.cjs`). Don't try to clean these up unprompted.
- The user expects an explicit clarifying question when intent is ambiguous rather than guessing (see `~/.claude/.../memory/feedback_ask_questions.md`).
