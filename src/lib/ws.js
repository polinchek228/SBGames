import { WS_URL, getToken } from "./api.js";

// ─── Single shared WebSocket ───────────────────────────────────────────────
// Both MainLayout and CommunityPage share ONE connection.

let socket = null;
let reconnectTimer = null;
let reconnectDelay = 1000;
const MAX_DELAY = 30_000;
let dead = false;
const listeners = new Set();
let authenticated = false;
let pendingAuth = null;

function connect() {
  if (dead) return;
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;

  try {
    socket = new WebSocket(WS_URL);
    console.log("[ws] connecting to", WS_URL);
  } catch (e) {
    console.error("[ws] connect failed:", e);
    scheduleReconnect();
    return;
  }

  socket.onopen = () => {
    console.log("[ws] connected, readyState:", socket.readyState);
    reconnectDelay = 1000;
    if (pendingAuth) {
      try {
        socket.send(JSON.stringify(pendingAuth));
        console.log("[ws] auth sent, userId:", pendingAuth.userId);
      } catch (e) { console.error("[ws] auth send failed:", e); }
      authenticated = true;
    }
    listeners.forEach(fn => fn({ type: "_ws_status", connected: true }));
  };

  socket.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      if (msg.type === "_auth_ok") { authenticated = true; console.log("[ws] auth OK"); return; }
      if (msg.type === "auth_error") { console.error("[ws] auth_error:", msg.message); return; }
      listeners.forEach(fn => { try { fn(msg); } catch {} });
    } catch {}
  };

  socket.onclose = (e) => {
    console.log("[ws] closed, code:", e.code, "reason:", e.reason);
    authenticated = false;
    socket = null;
    listeners.forEach(fn => fn({ type: "_ws_status", connected: false }));
    scheduleReconnect();
  };

  socket.onerror = (e) => {
    console.error("[ws] error:", e);
    if (socket && socket.readyState !== WebSocket.CLOSED) socket.close();
  };
}

function scheduleReconnect() {
  if (dead) return;
  clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(connect, reconnectDelay);
  reconnectDelay = Math.min(reconnectDelay * 1.5, MAX_DELAY);
}

export function initWS(userId, username) {
  pendingAuth = { type: "auth", userId, username, token: getToken() };
  // If already connected, re-auth with new credentials
  if (socket && socket.readyState === WebSocket.OPEN) {
    try {
      socket.send(JSON.stringify(pendingAuth));
      console.log("[ws] re-auth sent, userId:", userId);
    } catch {}
    authenticated = true;
    return;
  }
  connect();
}

export function sendWS(data) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    try {
      socket.send(JSON.stringify(data));
    } catch (e) {
      console.error("[ws] send failed:", e);
    }
  } else {
    console.warn("[ws] send skipped, socket state:", socket?.readyState, "dead:", dead);
  }
}

export function onWSMessage(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function isWSConnected() {
  return socket && socket.readyState === WebSocket.OPEN;
}

export function destroyWS() {
  dead = true;
  clearTimeout(reconnectTimer);
  listeners.clear();
  authenticated = false;
  pendingAuth = null;
  if (socket) {
    socket.onclose = null;
    socket.onerror = null;
    socket.close();
    socket = null;
  }
}
