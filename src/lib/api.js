export const API_URL = "https://games.sb-capital.group";

export const WS_URL  = "wss://games.sb-capital.group/ws";
export function getToken() {
  return localStorage.getItem("sbgames_token") || null;
}

export async function authFetch(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const r = await fetch(`${API_URL}${path}`, { ...options, headers });
  return r;
}


export async function authedFetch(path, opts = {}) {
  const token = getToken() || "";
  const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const r = await fetch(`${API_URL}${path}`, { ...opts, headers });
  if (!r.ok) {
    const t = await r.text().catch(() => r.statusText);
    // If server returned HTML (nginx error page, etc.), extract useful info
    if (t.startsWith("<!DOCTYPE") || t.startsWith("<html")) {
      throw new Error(`Сервер вернул HTML (${r.status}). Сервер недоступен или endpoint не найден.`);
    }
    // Try to parse JSON error message
    try {
      const j = JSON.parse(t);
      throw new Error(j.message || `${r.status}: ${t}`);
    } catch (e) {
      if (e.message && !e.message.includes("JSON")) throw e;
      throw new Error(`${r.status}: ${t.slice(0, 200)}`);
    }
  }
  const text = await r.text();
  if (!text || text.startsWith("<!DOCTYPE") || text.startsWith("<html")) {
    throw new Error("Сервер вернул HTML вместо JSON. Проверь, что сервер запущен.");
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Некорректный ответ от сервера (не JSON).");
  }
}
