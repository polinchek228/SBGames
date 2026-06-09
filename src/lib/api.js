export const API_URL = "https://api.sbgames.hyperionsearch.xyz:8443";
export const WS_URL  = "wss://api.sbgames.hyperionsearch.xyz:8443";

export function getToken() {
  return localStorage.getItem("sbgames_token") || null;
}
