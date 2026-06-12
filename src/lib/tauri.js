// Безопасная обёртка над Tauri invoke — если Tauri нет, выкидывает ошибку явно
// НЕ глотаем ошибки! Раньше catch { return null } ловил Rust-ошибки и превращал в null
// — это приводило к "null" в push-уведомлениях.
export async function invoke(cmd, args = {}) {
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

export async function notify(title, body) {
  if (!title || !body || title === "null" || body === "null" || body === "undefined") {
    console.warn("[notify] skipped empty/invalid:", title, body);
    return;
  }
  return invoke("show_notification", { title, body });
}

export async function setDiscordPresence(details, status, largeImage = "sbgames") {
  return invoke("set_discord_presence", { details, status, largeImage });
}

export async function clearDiscordPresence() {
  return invoke("clear_discord_presence");
}
