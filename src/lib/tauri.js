// Безопасная обёртка над Tauri invoke — не крашит если не в Tauri
export async function invoke(cmd, args = {}) {
  try {
    const { invoke: tauriInvoke } = await import("@tauri-apps/api/core");
    return await tauriInvoke(cmd, args);
  } catch {
    return null;
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

export async function notify(title, body) {
  return invoke("show_notification", { title, body });
}

export async function setDiscordPresence(details, status, largeImage = "sbgames") {
  return invoke("set_discord_presence", { details, status, largeImage });
}

export async function clearDiscordPresence() {
  return invoke("clear_discord_presence");
}
