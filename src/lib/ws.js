import { WS_URL, getToken } from "./api.js";

// ─── Single shared WebSocket ───────────────────────────────────────────────
// Both MainLayout and CommunityPage share ONE connection.

let socket = null;
let reconnectTimer = null;
let heartbeatTimer = null;
let reconnectDelay = 1000;
const MAX_DELAY = 30_000;
const MAX_RETRIES = 30;
let retryCount = 0;
let dead = false;
const listeners = new Set();
let authenticated = false;
let pendingAuth = null;
let missedPongs = 0;
const PONG_TIMEOUT = 45_000;

function connect() {
  if (dead) return;
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;

  try {
    socket = new WebSocket(WS_URL);
  } catch (e) {
    scheduleReconnect();
    return;
  }

  socket.onopen = () => {
    reconnectDelay = 1000;
    retryCount = 0;
    missedPongs = 0;
    if (pendingAuth) {
      try {
        socket.send(JSON.stringify(pendingAuth));
      } catch {}
    }
    clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(() => {
      if (socket && socket.readyState === WebSocket.OPEN) {
        missedPongs++;
        if (missedPongs >= 2) {
          socket.close();
          missedPongs = 0;
          return;
        }
        try { socket.send(JSON.stringify({ type: "ping" })); } catch {}
      }
    }, PONG_TIMEOUT);
    listeners.forEach(fn => fn({ type: "_ws_status", connected: true }));
  };

  socket.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      if (msg.type === "_auth_ok") { authenticated = true; pendingAuth = null; return; }
      if (msg.type === "pong") { missedPongs = 0; return; }
      if (msg.type === "auth_error") {
        authenticated = false;
        dead = true;
        clearTimeout(reconnectTimer);
        clearInterval(heartbeatTimer);
        listeners.forEach(fn => fn({ type: "_ws_status", connected: false, authError: true }));
        return;
      }
      listeners.forEach(fn => { try { fn(msg); } catch {} });
    } catch {}
  };

  socket.onclose = (e) => {
    authenticated = false;
    socket = null;
    listeners.forEach(fn => fn({ type: "_ws_status", connected: false }));
    scheduleReconnect();
  };

  socket.onerror = () => {
    if (socket && socket.readyState !== WebSocket.CLOSED) socket.close();
  };
}

function scheduleReconnect() {
  if (dead || retryCount >= MAX_RETRIES) return;
  retryCount++;
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
    } catch {}
    return;
  }
  connect();
}

export function sendWS(data) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    try {
      socket.send(JSON.stringify(data));
      return true;
    } catch { return false; }
  }
  return false;
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
  clearInterval(heartbeatTimer);
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

export function resetWS() {
  dead = false;
  retryCount = 0;
  reconnectDelay = 1000;
  clearTimeout(reconnectTimer);
  clearInterval(heartbeatTimer);
  authenticated = false;
  if (socket) {
    socket.onclose = null;
    socket.onerror = null;
    socket.close();
    socket = null;
  }
}
