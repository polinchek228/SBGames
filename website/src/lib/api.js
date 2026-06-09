export const API_URL = "https://api.sbgames.hyperionsearch.xyz:8443";
export const WS_URL  = "wss://api.sbgames.hyperionsearch.xyz:8443";

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
