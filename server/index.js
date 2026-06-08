const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const http = require("http");
const https = require("https");
const fs = require("fs");
const { WebSocketServer, WebSocket } = require("ws");
const { v4: uuidv4 } = require("uuid");

const BOT_TOKEN = "8507862760:AAFfOVKJRJeVL10WA55nKsTofxmSu2y7GCk";
const PORT      = 3000;
const PORT_SSL  = 3443;
const ADMIN_USERNAMES = ["efseea"];

const SSL_KEY  = "/etc/ssl/private/sbgames.key";
const SSL_CERT = "/etc/ssl/certs/sbgames.crt";

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// ─── In-memory stores ─────────────────────────────────────────────────────────
const accounts = new Map();   // tgId -> account
const tickets  = new Map();   // ticketId -> ticket
let ticketCounter = 1000;

// WS connections: clientId -> { ws, userId, role: "user"|"admin" }
const wsClients = new Map();

// ─── TG Widget verification ───────────────────────────────────────────────────
function verifyTelegramAuth(data) {
  const { hash, ...fields } = data;
  if (!hash) return false;
  const checkString = Object.keys(fields).sort().map(k => `${k}=${fields[k]}`).join("\n");
  const secretKey = crypto.createHash("sha256").update(BOT_TOKEN).digest();
  const hmac = crypto.createHmac("sha256", secretKey).update(checkString).digest("hex");
  if (hmac !== hash) return false;
  return (Date.now() / 1000 - parseInt(fields.auth_date, 10)) < 3600;
}

function isAdmin(username) {
  return ADMIN_USERNAMES.includes((username || "").toLowerCase());
}

// ─── REST ─────────────────────────────────────────────────────────────────────

app.post("/auth/tg-login", (req, res) => {
  const { tgUser, username } = req.body;
  if (!tgUser || !username) return res.status(400).json({ message: "tgUser и username обязательны" });
  const cleanNick = username.trim().replace(/^@/, "");
  if (!/^[a-zA-Z0-9_]{3,16}$/.test(cleanNick)) return res.status(400).json({ message: "Некорректный ник" });

  const isDev = tgUser.id === 99999;
  if (!isDev && !verifyTelegramAuth(tgUser)) return res.status(401).json({ message: "Подпись Telegram невалидна" });

  const tgId = String(tgUser.id);
  let account = accounts.get(tgId);
  if (!account) {
    account = {
      id: tgId,
      username: cleanNick,
      telegram: tgUser.username || null,
      firstName: tgUser.first_name || "",
      balance: 0,
      role: isAdmin(tgUser.username || cleanNick) ? "admin" : "user",
      createdAt: Date.now(),
    };
    accounts.set(tgId, account);
  } else {
    account.username = cleanNick;
    account.role = isAdmin(tgUser.username || cleanNick) ? "admin" : "user";
  }
  res.json({ user: account });
});

app.get("/health", (_, res) => res.json({ ok: true, accounts: accounts.size, tickets: tickets.size, ws: wsClients.size }));

// Список всех тикетов (для админа)
app.get("/support/tickets", (req, res) => {
  const list = [...tickets.values()].map(t => ({
    id: t.id, category: t.category, username: t.username,
    status: t.status, createdAt: t.createdAt, preview: t.preview,
    unread: t.unread || 0,
  }));
  res.json({ tickets: list.sort((a, b) => b.createdAt - a.createdAt) });
});

// Полный тикет с сообщениями
app.get("/support/ticket/:id", (req, res) => {
  const t = tickets.get(Number(req.params.id));
  if (!t) return res.status(404).json({ message: "Тикет не найден" });
  res.json(t);
});

// Создать тикет (REST — с первым сообщением)
app.post("/support/ticket", (req, res) => {
  const { userId, username, category, message } = req.body;
  if (!category || !message) return res.status(400).json({ message: "Заполните все поля" });
  const ticketId = ++ticketCounter;
  const ticket = {
    id: ticketId,
    userId: userId || "anon",
    username: username || "Player",
    category,
    preview: message.slice(0, 60),
    status: "open",
    unread: 0,
    createdAt: Date.now(),
    messages: [{
      id: uuidv4(), from: "system",
      text: `Тикет #${ticketId} создан. Ожидайте ответа администратора.`,
      time: Date.now(),
    }, {
      id: uuidv4(), from: userId || "anon",
      username: username || "Player",
      text: message,
      time: Date.now(),
    }],
  };
  tickets.set(ticketId, ticket);

  // Уведомить всех онлайн-админов
  broadcastToAdmins({ type: "new_ticket", ticket: ticketSummary(ticket) });

  res.json({ ticketId });
});

// ─── WebSocket ────────────────────────────────────────────────────────────────
wss.on("connection", (ws) => {
  const clientId = uuidv4();
  wsClients.set(clientId, { ws, userId: null, role: "user" });

  ws.on("message", (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    const client = wsClients.get(clientId);

    switch (msg.type) {
      // Клиент идентифицируется при подключении
      case "auth": {
        client.userId = msg.userId;
        client.username = msg.username;
        client.role = isAdmin(msg.username) ? "admin" : "user";
        wsClients.set(clientId, client);

        // Отправить список онлайн-пользователей всем
        broadcastOnlineUsers();

        // Отправить статус — сколько открытых тикетов если админ
        if (client.role === "admin") {
          const openCount = [...tickets.values()].filter(t => t.status !== "closed").length;
          send(ws, { type: "admin_ready", openTickets: openCount });
        }
        break;
      }

      // Новое сообщение в тикет
      case "message": {
        const ticket = tickets.get(Number(msg.ticketId));
        if (!ticket) return;

        const message = {
          id: uuidv4(),
          from: client.userId || "anon",
          username: client.username || "Player",
          role: client.role,
          text: msg.text,
          time: Date.now(),
        };
        ticket.messages.push(message);

        // Если от юзера — пометить как непрочитанное для админа
        if (client.role === "user") {
          ticket.unread = (ticket.unread || 0) + 1;
          ticket.status = "open";
          broadcastToAdmins({ type: "message", ticketId: ticket.id, message });
          broadcastToAdmins({ type: "ticket_update", ticket: ticketSummary(ticket) });
        } else {
          // Ответ от админа — уведомить клиента
          ticket.unread = 0;
          ticket.status = "answered";
          broadcastToTicket(ticket.id, client.userId, { type: "message", ticketId: ticket.id, message });
          broadcastToAdmins({ type: "ticket_update", ticket: ticketSummary(ticket) });
        }
        break;
      }

      // Админ открыл тикет → сбросить unread
      case "read_ticket": {
        const ticket = tickets.get(Number(msg.ticketId));
        if (ticket && client.role === "admin") {
          ticket.unread = 0;
          send(ws, { type: "ticket_messages", ticketId: ticket.id, messages: ticket.messages });
        }
        break;
      }

      // Закрыть тикет
      case "close_ticket": {
        const ticket = tickets.get(Number(msg.ticketId));
        if (ticket && client.role === "admin") {
          ticket.status = "closed";
          broadcastToTicket(ticket.id, null, { type: "ticket_closed", ticketId: ticket.id });
          broadcastToAdmins({ type: "ticket_update", ticket: ticketSummary(ticket) });
        }
        break;
      }

      // Юзер подписывается на обновления своего тикета
      case "subscribe_ticket": {
        client.ticketId = Number(msg.ticketId);
        wsClients.set(clientId, client);
        const ticket = tickets.get(Number(msg.ticketId));
        if (ticket) send(ws, { type: "ticket_messages", ticketId: ticket.id, messages: ticket.messages });
        break;
      }
    }
  });

  ws.on("close", () => { wsClients.delete(clientId); broadcastOnlineUsers(); });
  ws.on("error", () => { wsClients.delete(clientId); broadcastOnlineUsers(); });
});

function send(ws, data) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
}

function broadcastOnlineUsers() {
  const users = [...wsClients.values()]
    .filter(c => c.userId && c.username)
    .map(c => ({ id: c.userId, username: c.username, role: c.role }));
  for (const { ws } of wsClients.values()) {
    send(ws, { type: "online_users", users });
  }
}

function broadcastToAdmins(data) {
  for (const { ws, role } of wsClients.values()) {
    if (role === "admin") send(ws, data);
  }
}

function broadcastToTicket(ticketId, excludeUserId, data) {
  for (const { ws, userId, ticketId: subTicket } of wsClients.values()) {
    if (subTicket === ticketId && userId !== excludeUserId) send(ws, data);
  }
}

function ticketSummary(t) {
  return { id: t.id, category: t.category, username: t.username, status: t.status, createdAt: t.createdAt, preview: t.preview, unread: t.unread || 0 };
}

// ─── Start ────────────────────────────────────────────────────────────────────
// HTTP
server.listen(PORT, "0.0.0.0", () => {
  console.log(`SBGames HTTP  :${PORT}`);
});

// HTTPS — для macOS WebKit (ATS блокирует HTTP)
try {
  const sslOpts = {
    key:  fs.readFileSync(SSL_KEY),
    cert: fs.readFileSync(SSL_CERT),
  };
  const httpsServer = https.createServer(sslOpts, app);
  const wssSSL = new WebSocketServer({ server: httpsServer });

  // Вешаем те же обработчики WS на HTTPS сервер
  wssSSL.on("connection", (ws) => {
    // reuse same handler — просто эмитим в основной wss
    wss.emit("connection", ws);
  });

  httpsServer.listen(PORT_SSL, "0.0.0.0", () => {
    console.log(`SBGames HTTPS :${PORT_SSL}`);
  });
} catch (e) {
  console.warn("HTTPS not started (no cert?):", e.message);
}
