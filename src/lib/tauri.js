const isTauri = typeof window !== "undefined" && window.__TAURI_INTERNALS__;

export async function invoke(cmd, args = {}) {
  if (!isTauri) throw new Error("Tauri not available (running in browser)");
  const { invoke: tauriInvoke } = await import("@tauri-apps/api/core");
  return await tauriInvoke(cmd, args);
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
  return invoke("set_discord_presence", { details, status, largeImage });
}

export async function clearDiscordPresence() {
  return invoke("clear_discord_presence");
}

export async function getMinecraftStatus() {
  return invoke("get_minecraft_status");
}

export async function killMinecraft() {
  return invoke("kill_minecraft");
}
