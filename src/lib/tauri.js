const isTauri = typeof window !== "undefined" && window.__TAURI_INTERNALS__;

export async function invoke(cmd, args = {}) {
  if (!isTauri) throw new Error("Tauri not available (running in browser)");
  const { invoke: tauriInvoke } = await import("@tauri-apps/api/core");
  return await tauriInvoke(cmd, args);
}

// safeInvoke — обёртка для «фоновых» команд (Discord presence, tray state,
// уведомления), чей краш НЕ должен валить рендер. Любая ошибка пишется в
// console.warn и проглатывается. UI-critical команды (запуск игры, апдейтер)
// используют обычный invoke, чтобы ошибку было видно.
export async function safeInvoke(cmd, args = {}) {
  if (!isTauri) return undefined;
  try {
    return await invoke(cmd, args);
  } catch (e) {
    console.warn(`[safeInvoke] ${cmd} failed:`, e);
    return undefined;
  }
}

export async function listen(event, handler) {
  try {
    const { listen: tauriListen } = await import("@tauri-apps/api/event");
    return await tauriListen(event, handler);
  } catch {
    return () => {};
  }
}

let _notifWin = null;
let _notifTimer = null;

export async function notifyDesktop(title, body, type = "system") {
  if (!title) return;
  try {
    const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
    const { currentMonitor } = await import("@tauri-apps/api/window");

    const monitor = await currentMonitor();
    const scale = monitor?.scaleFactor || 1;
    const mw = (monitor?.size?.width ?? 1920) / scale;
    const mh = (monitor?.size?.height ?? 1080) / scale;
    const ww = 380, wh = 90, pad = 16;
    const x = Math.round(mw - ww - pad);
    const y = Math.round(mh - wh - pad);

    const safeTitle = title.slice(0, 100);
    const safeBody = (body || "").slice(0, 200);
    const params = new URLSearchParams({ title: safeTitle, body: safeBody, type });
    const url = `notification.html?${params.toString()}`;

    // Пробуем найти существующее окно
    if (!_notifWin) {
      try { _notifWin = await WebviewWindow.getByLabel("sb-notif"); } catch {}
    }

    if (_notifWin) {
      try {
        await _notifWin.hide();
        await _notifWin.navigate(url);
        await _notifWin.setPosition({ type: "Logical", x, y });
        await new Promise(r => setTimeout(r, 80));
        await _notifWin.show();
        await _notifWin.setFocus();
      } catch {
        try { await _notifWin.close(); } catch {}
        _notifWin = null;
      }
    }

    if (!_notifWin) {
      _notifWin = new WebviewWindow("sb-notif", {
        url,
        title: "SB Games",
        width: ww,
        height: wh,
        x, y,
        visible: false,
        transparent: true,
        decorations: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false,
        focus: false,
      });
      await new Promise(r => setTimeout(r, 150));
      await _notifWin.show();
      await _notifWin.setFocus();
    }

    clearTimeout(_notifTimer);
    _notifTimer = setTimeout(async () => {
      try { if (_notifWin) await _notifWin.hide(); } catch {}
    }, 5500);
  } catch (e) {
    console.warn("[notifyDesktop]", e);
  }
}

export async function setDiscordPresence(details, status, largeImage = "sbgames") {
  // Discord RPC — фоновая фича. Если плагин падает (особенно на macOS, где
  // discord IPC-сокет может быть недоступен), не валим рендер.
  try {
    return await invoke("set_discord_presence", { details, status, largeImage });
  } catch (e) {
    console.warn("[setDiscordPresence] failed:", e);
    return undefined;
  }
}

export async function clearDiscordPresence() {
  try {
    return await invoke("clear_discord_presence");
  } catch (e) {
    console.warn("[clearDiscordPresence] failed:", e);
    return undefined;
  }
}

export async function getMinecraftStatus() {
  return invoke("get_minecraft_status");
}

export async function killMinecraft() {
  return invoke("kill_minecraft");
}

// ─── Custom instances / modpacks ────────────────────────────────────────────

export const instanceList = () => invoke("instance_list");
export const instanceCreate = (cfg) => invoke("instance_create", { cfg });
export const instanceDelete = (id) => invoke("instance_delete", { id });
export const instanceUpdate = (cfg) => invoke("instance_update", { cfg });
export const instanceOpenFolder = (id) => invoke("instance_open_folder", { id });

export const javaEnsure = (version) => invoke("java_ensure", { version });

export const launchInstance = (instanceId, username, uuid, accessToken) =>
  invoke("launch_instance", { instanceId, username, uuid, accessToken });

export const importMrpack = (filePath, customName) =>
  invoke("import_mrpack", { filePath, customName });

export const modVersions = (projectId, mcVersion, loader) =>
  invoke("mod_versions", { projectId, mcVersion, loader });
