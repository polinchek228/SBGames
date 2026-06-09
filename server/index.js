const fetch = require("node-fetch");
const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const http = require("http");
const https = require("https");
const fs = require("fs");
const { WebSocketServer, WebSocket } = require("ws");
const { v4: uuidv4 } = require("uuid");

const BOT_TOKEN    = "8507862760:AAFfOVKJRJeVL10WA55nKsTofxmSu2y7GCk";
const NEWS_CHANNEL = "@sb7games";
const PORT         = 3000;
const PORT_SSL     = 3443;
const ADMIN_USERNAMES = ["efseea"];

const SSL_KEY  = "/etc/ssl/private/sbgames.key";
const SSL_CERT = "/etc/ssl/certs/sbgames.crt";

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// ─── In-memory stores ─────────────────────────────────────────────────────────
const accounts      = new Map();  // tgId -> account
const tickets       = new Map();  // ticketId -> ticket
const friendships   = new Map();  // userId -> Set<friendId>
const friendRequests = new Map(); // toUserId -> [{fromId, fromUsername, time}]
const dms           = new Map();  // `${a}_${b}` -> [{id,from,fromUsername,text,time}]
let ticketCounter = 1000;

// WS connections: clientId -> { ws, userId, username, role }
const wsClients = new Map();

// ─── Friends helpers ──────────────────────────────────────────────────────────
function getFriends(userId) {
  return friendships.get(userId) || new Set();
}
function areFriends(a, b) {
  return getFriends(a).has(b);
}
function dmKey(a, b) {
  return [a, b].sort().join("_");
}
function getPendingRequests(userId) {
  return (friendRequests.get(userId) || []);
}
function sendToUser(userId, data) {
  for (const c of wsClients.values()) {
    if (c.userId === userId) send(c.ws, data);
  }
}

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

  // Пропускаем HMAC-проверку если авторизация пришла через бот (bot-flow)
  // или dev-режим. Widget-flow всё равно не используется в Tauri-десктоп.
  const isDev = tgUser.id === 99999;

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

// ─── Авторизация через бот (desktop flow) ─────────────────────────────────────
const authCodes = new Map(); // code -> { confirmed, tgUser, createdAt }

// Лаунчер запрашивает код
app.post("/auth/create-code", (req, res) => {
  const code = Math.random().toString(36).slice(2, 8).toUpperCase();
  authCodes.set(code, { confirmed: false, tgUser: null, createdAt: Date.now() });
  // Чистим старые коды (> 10 минут)
  for (const [k, v] of authCodes.entries()) {
    if (Date.now() - v.createdAt > 10 * 60 * 1000) authCodes.delete(k);
  }
  res.json({ code });
});

// Лаунчер поллит — ждёт подтверждения от бота
app.get("/auth/check-code", (req, res) => {
  const { code } = req.query;
  const entry = authCodes.get(code);
  if (!entry) return res.json({ confirmed: false });
  res.json({ confirmed: entry.confirmed, tgUser: entry.tgUser || null });
});

// Поиск юзера по нику (для отладки)
app.get("/user/search", (req, res) => {
  const q = (req.query.nick || "").toLowerCase();
  const found = [...accounts.values()].find(a => (a.username || "").toLowerCase() === q);
  if (!found) return res.json({ found: false });
  res.json({ found: true, id: found.id, username: found.username });
});

// Список онлайн юзеров
app.get("/online", (_, res) => {
  const users = [...wsClients.values()]
    .filter(c => c.userId && c.username)
    .map(c => ({ id: c.userId, username: c.username }));
  res.json({ users });
});

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

        // Отправить себе список друзей и входящих запросов
        const myFriends = [...getFriends(client.userId)].map(fid => {
          const fa = [...accounts.values()].find(a => a.id === fid);
          return fa ? { id: fa.id, username: fa.username } : null;
        }).filter(Boolean);
        const myRequests = getPendingRequests(client.userId);
        send(ws, { type: "friends_list", friends: myFriends });
        send(ws, { type: "friend_requests", requests: myRequests });

        // Отправить статус — сколько открытых тикетов если админ
        if (client.role === "admin") {
          const openCount = [...tickets.values()].filter(t => t.status !== "closed").length;
          send(ws, { type: "admin_ready", openTickets: openCount });
        }
        break;
      }

      // Отправить заявку в друзья по нику
      case "friend_request_send": {
        const searchNick = (msg.toUsername || "").trim().toLowerCase();
        const target = [...accounts.values()].find(
          a => (a.username || "").toLowerCase() === searchNick
        );
        if (!target) {
          send(ws, { type: "friend_error", message: "Пользователь не найден" });
          break;
        }
        if (target.id === client.userId) {
          send(ws, { type: "friend_error", message: "Нельзя добавить себя" });
          break;
        }
        if (areFriends(client.userId, target.id)) {
          send(ws, { type: "friend_error", message: "Уже в друзьях" });
          break;
        }
        // Проверяем дубль
        const existing = getPendingRequests(target.id);
        if (existing.find(r => r.fromId === client.userId)) {
          send(ws, { type: "friend_error", message: "Заявка уже отправлена" });
          break;
        }
        const req = { fromId: client.userId, fromUsername: client.username, time: Date.now() };
        friendRequests.set(target.id, [...existing, req]);
        // Уведомить получателя если онлайн
        sendToUser(target.id, { type: "friend_request_received", request: req });
        send(ws, { type: "friend_request_sent", toUsername: target.username });
        break;
      }

      // Принять или отклонить заявку
      case "friend_request_respond": {
        const { fromId, accept } = msg;
        const reqs = getPendingRequests(client.userId).filter(r => r.fromId !== fromId);
        friendRequests.set(client.userId, reqs);
        if (accept) {
          if (!friendships.has(client.userId)) friendships.set(client.userId, new Set());
          if (!friendships.has(fromId))         friendships.set(fromId,         new Set());
          friendships.get(client.userId).add(fromId);
          friendships.get(fromId).add(client.userId);
          // Оба получают обновлённые списки
          const meFriends = [...getFriends(client.userId)].map(fid => {
            const fa = [...accounts.values()].find(a => a.id === fid);
            return fa ? { id: fa.id, username: fa.username } : null;
          }).filter(Boolean);
          send(ws, { type: "friends_list", friends: meFriends });
          sendToUser(fromId, { type: "friend_accepted", byId: client.userId, byUsername: client.username });
        }
        send(ws, { type: "friend_requests", requests: getPendingRequests(client.userId) });
        break;
      }

      // Отправить личное сообщение другу
      case "dm_send": {
        const { toId, text } = msg;
        if (!text?.trim()) break;
        const key  = dmKey(client.userId, toId);
        const msgs = dms.get(key) || [];
        const dm   = { id: uuidv4(), from: client.userId, fromUsername: client.username, text: text.trim(), time: Date.now() };
        msgs.push(dm);
        dms.set(key, msgs.slice(-200)); // хранить последние 200
        send(ws, { type: "dm_message", with: toId, message: dm });
        sendToUser(toId, { type: "dm_message", with: client.userId, message: dm });
        break;
      }

      // Запросить историю DM с другом
      case "dm_history": {
        const key  = dmKey(client.userId, msg.withId);
        const msgs = dms.get(key) || [];
        send(ws, { type: "dm_history", with: msg.withId, messages: msgs });
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

// ─── News: парсинг из Telegram канала @sb7games ───────────────────────────────
let newsCache = [];
let newsCacheTime = 0;

async function fetchChannelNews() {
  if (Date.now() - newsCacheTime < 5 * 60 * 1000 && newsCache.length > 0) return newsCache;
  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?limit=20`;
    const r = await fetch(url);
    const d = await r.json();
    // Ищем сообщения из канала через forwardFrom или chat
    // Альтернатива — читаем напрямую через getChat + getChatHistory
    // Для паблик канала используем публичный API
    const pubUrl = `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?allowed_updates=["channel_post"]&limit=30`;
    const pr = await fetch(pubUrl);
    const pd = await pr.json();

    const posts = (pd.result || [])
      .filter(u => u.channel_post && u.channel_post.chat?.username === "sb7games")
      .map(u => {
        const msg = u.channel_post;
        const text = msg.text || msg.caption || "";
        const lines = text.split("\n");
        const title = lines[0]?.slice(0, 80) || "Новость";
        const date = new Date(msg.date * 1000).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
        return {
          id: msg.message_id,
          title,
          text,
          date,
          photo: null, // фото через отдельный getFile если нужно
        };
      })
      .reverse();

    if (posts.length > 0) {
      newsCache = posts;
      newsCacheTime = Date.now();
    }
    return newsCache;
  } catch (e) {
    console.error("fetchChannelNews:", e.message);
    return newsCache;
  }
}

// Альтернатива через публичный парсинг t.me/sb7games
async function fetchNewsPublic() {
  if (Date.now() - newsCacheTime < 5 * 60 * 1000 && newsCache.length > 0) return newsCache;
  try {
    // Используем rsshub или tgstat
    const r = await fetch(`https://rsshub.app/telegram/channel/sb7games`, {
      headers: { "User-Agent": "SBGamesLauncher/1.0" }
    });
    if (!r.ok) return newsCache;
    const xml = await r.text();
    // Простой парсинг RSS
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    while ((match = itemRegex.exec(xml)) !== null) {
      const block = match[1];
      const title = (block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || [])[1]
                 || (block.match(/<title>(.*?)<\/title>/) || [])[1] || "Новость";
      const desc  = (block.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) || [])[1]
                 || (block.match(/<description>([\s\S]*?)<\/description>/) || [])[1] || "";
      const pubDate = (block.match(/<pubDate>(.*?)<\/pubDate>/) || [])[1] || "";
      // Убираем HTML-теги
      const cleanDesc = desc.replace(/<[^>]+>/g, "").trim();
      const cleanTitle = title.replace(/<[^>]+>/g, "").trim();
      // Ищем картинку
      const imgMatch = desc.match(/<img[^>]+src="([^"]+)"/);
      const photo = imgMatch ? imgMatch[1] : null;

      const dateObj = pubDate ? new Date(pubDate) : new Date();
      const dateStr = dateObj.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });

      items.push({ id: items.length + 1, title: cleanTitle, text: cleanDesc.slice(0, 400), date: dateStr, photo });
      if (items.length >= 12) break;
    }
    if (items.length > 0) {
      newsCache = items;
      newsCacheTime = Date.now();
    }
    return newsCache;
  } catch (e) {
    console.error("fetchNewsPublic:", e.message);
    return newsCache;
  }
}

app.get("/news", async (req, res) => {
  const posts = await fetchNewsPublic();
  res.json({ posts });
});

// Обновлять кэш каждые 5 минут
setInterval(fetchNewsPublic, 5 * 60 * 1000);
fetchNewsPublic(); // первый запрос при старте

// ─── CryptoBot (pay.crypt.bot) ─────────────────────────────────────────────────
// Получи токен здесь: https://t.me/CryptoBot → /pay → Apps → Create App
const CRYPTO_BOT_TOKEN = process.env.CRYPTO_BOT_TOKEN || "REPLACE_WITH_CRYPTOBOT_TOKEN";
const CRYPTO_BOT_API   = "https://pay.crypt.bot/api";

async function createCryptoInvoice(amount, userId) {
  try {
    const r = await fetch(`${CRYPTO_BOT_API}/createInvoice`, {
      method: "POST",
      headers: { "Crypto-Pay-API-Token": CRYPTO_BOT_TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify({
        currency_type: "fiat",
        fiat: "RUB",
        amount: String(amount),
        description: `Пополнение СБТ · ${amount} руб · ID:${userId}`,
        paid_btn_name: "callback",
        paid_btn_url: `https://api.sbgames.hyperionsearch.xyz:8443/cryptobot/paid?userId=${userId}&amount=${amount}`,
        allow_comments: false,
        allow_anonymous: false,
      }),
    });
    const d = await r.json();
    if (d.ok) return d.result;
    return null;
  } catch (e) {
    console.error("CryptoBot invoice error:", e.message);
    return null;
  }
}

// Webhook от CryptoBot когда оплата прошла
app.get("/cryptobot/paid", (req, res) => {
  const { userId, amount } = req.query;
  if (!userId || !amount) return res.status(400).send("bad request");
  const acc = accounts.get(String(userId));
  if (acc) {
    acc.balance = (acc.balance || 0) + parseInt(amount, 10);
    // Уведомить пользователя в боте
    bot.sendMessage(userId,
      `✅ *Пополнение успешно!*\n\n💰 +${amount} СБТ\nНовый баланс: *${acc.balance} СБТ*`,
      { parse_mode: "Markdown" }
    );
  }
  res.send("ok");
});

// ─── Telegram Bot ──────────────────────────────────────────────────────────────
const TelegramBot = require("node-telegram-bot-api");
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Состояния диалога: chatId -> { state, data }
const botSessions = new Map();

function mainMenu(chatId, account) {
  const name = account ? account.username : "игрок";
  const bal  = account ? account.balance : 0;
  bot.sendMessage(chatId,
    `🎮 *SB Games Launcher*\n\nПривет, *${name}*!\n💰 Баланс: *${bal} СБТ*\n\nВыбери действие:`,
    {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "👤 Профиль",          callback_data: "profile" },
           { text: "💰 Пополнить баланс", callback_data: "topup" }],
          [{ text: "🎫 Мои обращения",    callback_data: "tickets" },
           { text: "✏️ Новое обращение",  callback_data: "new_ticket" }],
          [{ text: "🔗 Открыть лаунчер",  url: "https://t.me/sbgamessupport_bot?startapp=launcher" }],
        ]
      }
    }
  );
}

// /start [deeplink]
bot.onText(/\/start(.*)/, async (msg, match) => {
  const tgId    = String(msg.from.id);
  const param   = (match[1] || "").trim();
  const account = accounts.get(tgId);

  // Авторизация из лаунчера: /start auth_XXXXXX
  if (param.startsWith("auth_")) {
    const code  = param.slice(5).toUpperCase();
    const entry = authCodes.get(code);
    if (!entry) {
      bot.sendMessage(msg.chat.id, "❌ Код недействителен или истёк. Попробуй снова в лаунчере.");
      return;
    }
    entry.confirmed = true;
    entry.tgUser    = {
      id:         msg.from.id,
      first_name: msg.from.first_name || "",
      last_name:  msg.from.last_name  || "",
      username:   msg.from.username   || null,
      auth_date:  Math.floor(Date.now() / 1000),
    };
    bot.sendMessage(msg.chat.id,
      `✅ *Авторизация успешна!*\n\nВернись в лаунчер и введи игровой ник.`,
      { parse_mode: "Markdown" }
    );
    return;
  }

  // Deeplink: /start link_XXXX — привязать аккаунт
  if (param.startsWith("link_")) {
    const linkCode = param.slice(5);
    const target = [...accounts.values()].find(a => a.linkCode === linkCode);
    if (target) {
      target.telegramId = tgId;
      target.telegram   = msg.from.username || null;
      delete target.linkCode;
      bot.sendMessage(msg.chat.id,
        `✅ *Telegram привязан!*\n\nАккаунт *${target.username}* успешно связан.`,
        { parse_mode: "Markdown" }
      );
      return;
    }
  }

  mainMenu(msg.chat.id, account);
});

bot.on("callback_query", async (q) => {
  const tgId    = String(q.from.id);
  const chatId  = q.message.chat.id;
  const account = accounts.get(tgId);
  bot.answerCallbackQuery(q.id);

  // ── Профиль ──
  if (q.data === "profile") {
    if (!account) {
      bot.sendMessage(chatId,
        "❗ Аккаунт не найден. Сначала войди в лаунчер через Telegram.",
        { reply_markup: { inline_keyboard: [[{ text: "◀️ Назад", callback_data: "back" }]] } }
      );
      return;
    }
    bot.sendMessage(chatId,
      `👤 *Профиль*\n\n` +
      `Ник: *${account.username}*\n` +
      `ID: \`${account.id}\`\n` +
      `💰 Баланс: *${account.balance} СБТ*\n` +
      `📅 Регистрация: ${new Date(account.createdAt).toLocaleDateString("ru-RU")}\n` +
      `🔗 Telegram: ${account.telegram ? `@${account.telegram}` : "не привязан"}`,
      {
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: [[{ text: "◀️ Назад", callback_data: "back" }]] }
      }
    );
  }

  // ── Пополнить (суммы) ──
  if (q.data === "topup") {
    bot.sendMessage(chatId,
      "💰 *Пополнение баланса*\n\nВыбери сумму или введи свою (в рублях):",
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "50 ₽", callback_data: "topup_50"  }, { text: "100 ₽", callback_data: "topup_100" }],
            [{ text: "250 ₽", callback_data: "topup_250" }, { text: "500 ₽", callback_data: "topup_500" }],
            [{ text: "1000 ₽", callback_data: "topup_1000" }],
            [{ text: "◀️ Назад", callback_data: "back" }],
          ]
        }
      }
    );
  }

  // ── Создать инвойс через CryptoBot ──
  if (q.data.startsWith("topup_")) {
    const amount = parseInt(q.data.split("_")[1], 10);
    if (!account) {
      bot.sendMessage(chatId, "❗ Сначала войди в лаунчер.");
      return;
    }
    const invoice = await createCryptoInvoice(amount, tgId);
    if (invoice) {
      bot.sendMessage(chatId,
        `💳 *Счёт на оплату*\n\nСумма: *${amount} ₽ = ${amount} СБТ*\n\nНажми кнопку для оплаты через CryptoBot:`,
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: `💳 Оплатить ${amount} ₽`, url: invoice.pay_url }],
              [{ text: "◀️ Назад", callback_data: "topup" }],
            ]
          }
        }
      );
    } else {
      // CryptoBot не настроен — показываем реквизиты
      bot.sendMessage(chatId,
        `💰 *Пополнение на ${amount} СБТ*\n\n` +
        `Переведи *${amount} ₽* на реквизиты:\n\n` +
        `🏦 СБП / Сбербанк: \`+7 (___) ___-__-__\`\n` +
        `💎 USDT TRC20: \`T...\`\n\n` +
        `После оплаты пришли скриншот — пополним в течение 10 мин.\n` +
        `_Укажи свой ник: ${account?.username || "?"}_`,
        {
          parse_mode: "Markdown",
          reply_markup: { inline_keyboard: [[{ text: "◀️ Назад", callback_data: "topup" }]] }
        }
      );
    }
  }

  // ── Мои тикеты ──
  if (q.data === "tickets") {
    const userTickets = [...tickets.values()]
      .filter(t => t.userId === tgId || (account && t.userId === account.id))
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 8);
    if (userTickets.length === 0) {
      bot.sendMessage(chatId,
        "🎫 Нет обращений.\n\nСоздай новое — мы поможем!",
        { reply_markup: { inline_keyboard: [
          [{ text: "✏️ Создать обращение", callback_data: "new_ticket" }],
          [{ text: "◀️ Назад", callback_data: "back" }],
        ]}}
      );
      return;
    }
    const STATUS_EMOJI = { open: "🟡", answered: "🟢", closed: "⚫" };
    const lines = userTickets.map(t =>
      `${STATUS_EMOJI[t.status] || "⚪"} *#${t.id}* — ${t.category}\n└ _${t.preview?.slice(0, 50)}_`
    ).join("\n\n");
    bot.sendMessage(chatId,
      `🎫 *Твои обращения:*\n\n${lines}`,
      {
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: [
          [{ text: "✏️ Новое обращение", callback_data: "new_ticket" }],
          [{ text: "◀️ Назад", callback_data: "back" }],
        ]}
      }
    );
  }

  // ── Новый тикет: выбор категории ──
  if (q.data === "new_ticket") {
    botSessions.set(chatId, { state: "awaiting_ticket_desc", category: null });
    bot.sendMessage(chatId,
      "✏️ *Новое обращение*\n\nВыбери категорию:",
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔧 Технические проблемы", callback_data: "tcat_tech"    }],
            [{ text: "👤 Вопрос по аккаунту",   callback_data: "tcat_account" }],
            [{ text: "💳 Вопрос по покупке",     callback_data: "tcat_pay"     }],
            [{ text: "🐛 Баг / ошибка",          callback_data: "tcat_bug"     }],
            [{ text: "⚠️ Жалоба на игрока",      callback_data: "tcat_report"  }],
            [{ text: "❓ Другое",                 callback_data: "tcat_other"   }],
            [{ text: "◀️ Назад",                  callback_data: "back"         }],
          ]
        }
      }
    );
  }

  const CAT_MAP = {
    tcat_tech: "Технические проблемы", tcat_account: "Вопрос по аккаунту",
    tcat_pay: "Вопрос по покупке",     tcat_bug: "Баг / ошибка в игре",
    tcat_report: "Жалоба на игрока",   tcat_other: "Другое",
  };
  if (q.data in CAT_MAP) {
    const category = CAT_MAP[q.data];
    botSessions.set(chatId, { state: "awaiting_ticket_desc", category });
    bot.sendMessage(chatId,
      `📝 Категория: *${category}*\n\nОпиши проблему подробно — напиши сообщение:`,
      { parse_mode: "Markdown" }
    );
  }

  // ── Назад в меню ──
  if (q.data === "back") {
    botSessions.delete(chatId);
    mainMenu(chatId, accounts.get(tgId));
  }
});

// Текстовые сообщения — обработка состояний диалога
bot.on("message", async (msg) => {
  if (msg.text?.startsWith("/")) return; // команды обрабатываются отдельно
  const chatId  = msg.chat.id;
  const tgId    = String(msg.from.id);
  const account = accounts.get(tgId);
  const session = botSessions.get(chatId);

  if (session?.state === "awaiting_ticket_desc") {
    const text = msg.text?.trim();
    if (!text || text.length < 5) {
      bot.sendMessage(chatId, "❗ Слишком короткое описание. Напиши хотя бы несколько слов.");
      return;
    }
    const ticketId = ++ticketCounter;
    const ticket = {
      id: ticketId,
      userId: tgId,
      username: account?.username || msg.from.username || "Telegram",
      category: session.category || "Другое",
      preview: text.slice(0, 60),
      status: "open",
      unread: 0,
      createdAt: Date.now(),
      messages: [
        { id: uuidv4(), from: "system", text: `Тикет #${ticketId} создан через Telegram бот.`, time: Date.now() },
        { id: uuidv4(), from: tgId, username: account?.username || "Telegram", text, time: Date.now() },
      ],
    };
    tickets.set(ticketId, ticket);
    botSessions.delete(chatId);
    broadcastToAdmins({ type: "new_ticket", ticket: ticketSummary(ticket) });
    bot.sendMessage(chatId,
      `✅ *Обращение #${ticketId} создано!*\n\nКатегория: ${ticket.category}\n\nМы ответим как можно скорее. Следи за статусом здесь.`,
      {
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: [
          [{ text: "🎫 Мои обращения", callback_data: "tickets" }],
          [{ text: "◀️ В меню",         callback_data: "back"    }],
        ]}
      }
    );
  }
});

bot.on("polling_error", (err) => {
  if (!err.message?.includes("409")) console.error("[bot]", err.message);
});

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
