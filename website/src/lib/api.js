export const API_URL = "https://api.hyperionsearch.xyz";
export const WS_URL  = "wss://api.hyperionsearch.xyz";

export const getToken = () => localStorage.getItem("sbgames_token");
export const getUser  = () => { try { return JSON.parse(localStorage.getItem("sbgames_user") || "null"); } catch { return null; } };

export const setAuth  = (user, token) => {
  localStorage.setItem("sbgames_user",  JSON.stringify(user));
  if (token) localStorage.setItem("sbgames_token", token);
};
export const clearAuth = () => {
  localStorage.removeItem("sbgames_user");
  localStorage.removeItem("sbgames_token");
};

export async function refreshUser(setUser) {
  const token = getToken();
  if (!token) return;
  try {
    const res = await fetch(`${API_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 401) {
      // Токен невалиден — чистим и перенаправляем на логин
      clearAuth();
      if (setUser) setUser(null);
      return;
    }
    if (!res.ok) return;
    const { user } = await res.json();
    localStorage.setItem("sbgames_user", JSON.stringify(user));
    if (setUser) setUser(user);
  } catch {}
}
