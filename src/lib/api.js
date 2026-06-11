export const API_URL = "https://api.sbgames.hyperionsearch.xyz:8443";
export const WS_URL  = "wss://api.sbgames.hyperionsearch.xyz:8443";

export function getToken() {
  return localStorage.getItem("sbgames_token") || null;
}

// Универсальный fetch с авторизацией
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
