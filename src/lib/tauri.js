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
let _notifReady = false;

// Точный размер окна = размер карточки. Никакого margin внутри HTML — иначе
// прозрачная зона по краям на Windows рендерится непрозрачной ("второй фон").
const NOTIF_W = 360;
const NOTIF_H = 76;
const NOTIF_PAD = 16;
const NOTIF_DURATION = 5000; // должно совпадать с таймер-баром в notification.html

function notifPosition(monitor) {
  const scale = monitor?.scaleFactor || 1;
  // workArea исключает таскбар/док (в отличие от size, который покрывает весь
  // экран). position может быть смещён, если таскбар сверху/слева — учитываем.
  // Все значения физические → делим на scaleFactor для логических координат.
  const wa = monitor?.workArea;
  const areaX = (wa?.position?.x ?? 0) / scale;
  const areaY = (wa?.position?.y ?? 0) / scale;
  const areaW = (wa?.size?.width ?? monitor?.size?.width ?? 1920) / scale;
  const areaH = (wa?.size?.height ?? monitor?.size?.height ?? 1080) / scale;
  return {
    x: Math.round(areaX + areaW - NOTIF_W - NOTIF_PAD),
    y: Math.round(areaY + areaH - NOTIF_H - NOTIF_PAD),
  };
}

export async function notifyDesktop(title, body, type = "system") {
  if (!title) return;
  try {
    const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
    const { currentMonitor } = await import("@tauri-apps/api/window");

    const monitor = await currentMonitor();
    const { x, y } = notifPosition(monitor);

    const payload = {
      title: title.slice(0, 100),
      body: (body || "").slice(0, 200),
      type,
      duration: NOTIF_DURATION,
    };

    // Пробуем подобрать уже существующее окно (после reload фронта).
    if (!_notifWin) {
      try {
        _notifWin = await WebviewWindow.getByLabel("sb-notif");
        if (_notifWin) _notifReady = true;
      } catch {}
    }

    // Окно уже есть: НЕ перезагружаем страницу (navigate вызывал мигание и
    // повторную отрисовку фона). Просто шлём событие с новыми данными,
    // переставляем и показываем.
    if (_notifWin && _notifReady) {
      try {
        await _notifWin.setPosition({ type: "Logical", x, y });
        await _notifWin.emit("sbg-notif", payload);
        await _notifWin.show();
        scheduleHide();
        return;
      } catch {
        try { await _notifWin.close(); } catch {}
        _notifWin = null;
        _notifReady = false;
      }
    }

    // Первое создание окна: данные передаём через query (страница рендерит
    // их сразу на загрузке), плюс слушаем 'sbg-notif' для последующих показов.
    const params = new URLSearchParams(payload);
    _notifWin = new WebviewWindow("sb-notif", {
      url: `notification.html?${params.toString()}`,
      title: "SB Games",
      width: NOTIF_W,
      height: NOTIF_H,
      x, y,
      visible: false,
      transparent: true,
      decorations: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      shadow: false,
      focus: false,
    });

    // Показываем только когда DOM готов, чтобы не было вспышки пустого окна.
    await new Promise((resolve) => {
      let done = false;
      const finish = () => { if (!done) { done = true; resolve(); } };
      _notifWin.once("tauri://created", async () => {
        _notifReady = true;
        try { await _notifWin.show(); } catch {}
        finish();
      });
      // Fallback на случай, если событие не пришло.
      setTimeout(async () => {
        if (!_notifReady) {
          _notifReady = true;
          try { await _notifWin.show(); } catch {}
        }
        finish();
      }, 250);
    });

    scheduleHide();
  } catch (e) {
    console.warn("[notifyDesktop]", e);
  }
}

function scheduleHide() {
  clearTimeout(_notifTimer);
  _notifTimer = setTimeout(async () => {
    try { if (_notifWin) await _notifWin.hide(); } catch {}
  }, NOTIF_DURATION + 300);
}

export async function setDiscordPresence(details, status, opts = {}) {
  try {
    return await invoke("set_discord_presence", {
      details,
      status,
      largeImage: opts.largeImage || "sbgames",
      largeText: opts.largeText || null,
      smallImage: opts.smallImage || null,
      smallText: opts.smallText || null,
      startTimestamp: opts.startTimestamp || null,
      endTimestamp: opts.endTimestamp || null,
      buttons: opts.buttons || null,
    });
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
