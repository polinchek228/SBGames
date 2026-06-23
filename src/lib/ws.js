import { WS_URL, getToken } from "./api.js";

// ─── Single shared WebSocket ───────────────────────────────────────────────
// Both MainLayout and CommunityPage share ONE connection.

let socket = null;
let reconnectTimer = null;
let heartbeatTimer = null;
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
  } catch (e) {
    scheduleReconnect();
    return;
  }

  socket.onopen = () => {
    reconnectDelay = 1000;
    if (pendingAuth) {
      try {
        socket.send(JSON.stringify(pendingAuth));
        // Auth sent (userId not logged for security)
      } catch {}
    }
    // Start heartbeat to detect half-open connections
    clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(() => {
      if (socket && socket.readyState === WebSocket.OPEN) {
        try { socket.send(JSON.stringify({ type: "ping" })); } catch {}
      }
    }, 30_000);
    listeners.forEach(fn => fn({ type: "_ws_status", connected: true }));
  };

  socket.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      if (msg.type === "_auth_ok") { authenticated = true; pendingAuth = null; return; }
      if (msg.type === "auth_error") { authenticated = false; return; }
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
    } catch {}
    return;
  }
  connect();
}

export function sendWS(data) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    try {
      socket.send(JSON.stringify(data));
    } catch {}
  } else {
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
