export const API_URL = "https://api.sbgames.hyperionsearch.xyz:8443";
export const WS_URL  = "wss://api.sbgames.hyperionsearch.xyz:8443";

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
    throw new Error(`${r.status}: ${t}`);
  }
  return r.json();
}
