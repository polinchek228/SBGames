const fetch        = require("node-fetch");
const express      = require("express");
const cors         = require("cors");
const crypto       = require("crypto");
const http         = require("http");
const https        = require("https");
const fs           = require("fs");
const helmet       = require("helmet");
const rateLimit    = require("express-rate-limit");
const jwt          = require("jsonwebtoken");
const sanitizeHtml = require("sanitize-html");
const Redis        = require("ioredis");
const { WebSocketServer, WebSocket } = require("ws");
const { v4: uuidv4 } = require("uuid");

const BOT_TOKEN       = "8703318210:AAEG9Zj12W7i6hfPnIqLXeedcZrDwH-2Os8";
const JWT_SECRET      = process.env.JWT_SECRET || crypto.randomBytes(48).toString("hex");
const NEWS_CHANNEL    = "@sb7games";
const PORT            = 3000;
const PORT_SSL        = 3443;
const ADMIN_USERNAMES = ["efseea"];

const SSL_KEY  = "/etc/ssl/private/sbgames.key";
const SSL_CERT = "/etc/ssl/certs/sbgames.crt";

// ─── Redis ────────────────────────────────────────────────────────────────────
const redis = new Redis({ host: "127.0.0.1", port: 6379, lazyConnect: true });
redis.connect().catch(() => console.warn("[redis] not available, using memory"));

// Хелперы Redis с fallback на Map
const redisAccounts = { _map: new Map(),
  async get(k)    {
    try {
      const v = await redis.get(`acc:${k}`);
      if (v) {
        const parsed = JSON.parse(v);
        this._map.set(k, parsed);
        try { accounts.set(k, parsed); } catch {}
        return parsed;
      }
      return this._map.get(k);
    } catch { return this._map.get(k); }
  },
  async set(k, v) { this._map.set(k, v); try { accounts.set(k, v); } catch {} try { await redis.set(`acc:${k}`, JSON.stringify(v)); } catch {} },
  values()        { return this._map.values(); },
};

const app = express();

// ─── Static: backgrounds (video files) ────────────────────────────────────────
app.use("/backgrounds", express.static(
  require("path").join(__dirname, "backgrounds"),
  { maxAge: "7d", etag: true, lastModified: true }
));

// ─── Static: badge icons ─────────────────────────────────────────────────────
app.use("/icons", express.static(
  require("path").join(__dirname, "icons"),
  { maxAge: "7d", etag: true, lastModified: true }
));

// ─── Static: profile frames ──────────────────────────────────────────────────
app.use("/frames", express.static(
  require("path").join(__dirname, "frames"),
  { maxAge: "7d", etag: true, lastModified: true }
));

// ─── Security middleware ──────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false, // Tauri не использует браузерный CSP
}));
app.use(cors({
  origin: (origin, cb) => {
    // Разрешаем: Tauri (null origin), наш домен
    const allowed = [
      null, undefined,
      "https://api.sbgames.hyperionsearch.xyz:8443",
      "https://sbgames.hyperionsearch.xyz:8444",
      "https://sbgames.hyperionsearch.xyz",
      "http://sbgames.hyperionsearch.xyz",
      "http://localhost:1420",
      "http://localhost:5173",
    ];
    if (!origin || allowed.includes(origin)) return cb(null, true);
    cb(new Error("CORS: not allowed"));
  },
  credentials: true,
}));
// Webhook от Telegram — отдельный лимит (там большие update'ы с inline_keyboard)
app.use("/tg-webhook", express.json({ limit: "1mb" }));
app.use(express.json({ limit: "32kb" })); // Ограничение размера тела для всего остального

// Rate limiters
const apiLimiter  = rateLimit({ windowMs: 60_000, max: 120, standardHeaders: true, legacyHeaders: false });

// API rate limit
app.use("/api",  apiLimiter);

// ─── Input sanitizer ──────────────────────────────────────────────────────────
function sanitize(str, max = 500) {
  if (typeof str !== "string") return "";
  return sanitizeHtml(str.slice(0, max), { allowedTags: [], allowedAttributes: {} }).trim();
}

// ─── JWT helpers ─────────────────────────────────────────────────────────────
function signToken(userId) {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: "30d" });
}
function verifyToken(token) {
  try { return jwt.verify(token, JWT_SECRET); } catch { return null; }
}

// ─── WS token auth middleware ─────────────────────────────────────────────────
function wsAuthenticate(token) {
  const payload = verifyToken(token);
  return payload ? payload.sub : null;
}

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
function publicFriends(userId) {
  return [...getFriends(userId)].map(fid => {
    const fa = [...accounts.values()].find(a => a.id === fid);
    return fa ? { id: fa.id, username: fa.username } : null;
  }).filter(Boolean);
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

app.post("/auth/tg-login", async (req, res) => {
  const { tgUser, username } = req.body;
  if (!tgUser || !username) return res.status(400).json({ message: "Обязательные поля отсутствуют" });

  // Валидация ника
  const cleanNick = sanitize(username).replace(/^@/, "");
  if (!/^[a-zA-Z0-9_]{3,16}$/.test(cleanNick))
    return res.status(400).json({ message: "Ник: 3–16 символов, буквы/цифры/_" });

  // tgUser должен прийти через бот-flow (нет hash — значит через наш код)
  // Проверяем что id реальный (не 99999 и не отрицательный)
  const tgId = String(tgUser.id);
  if (!tgUser.id || tgUser.id <= 0)
    return res.status(401).json({ message: "Невалидный пользователь" });

  let account = await redisAccounts.get(tgId);
  if (!account) {
    account = {
      id: tgId,
      username: cleanNick,
      telegram: tgUser.username || null,
      firstName: sanitize(tgUser.first_name || "", 64),
      balance: 100, // стартовый бонус для проб (покупка и трейд)
      role: isAdmin(tgUser.username || cleanNick) ? "admin" : "user",
      createdAt: Date.now(),
      // Стартовый набор market-предметов (1-2 шт) — чтобы было что выставить на торговую площадку
      market_inventory: ["m_cosmic_chest", "m_ember_token"],
    };
  } else {
    account.username = cleanNick;
    account.role = isAdmin(tgUser.username || cleanNick) ? "admin" : "user";
  }
  await redisAccounts.set(tgId, account);

  const token = signToken(tgId);
  res.json({ user: account, token });
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

app.get("/auth/search", requireAuth, (req, res) => {
  const q = sanitize(req.query.q || "", 32).toLowerCase();
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 20);
  if (q.length < 2) return res.json({ users: [] });
  const users = [...accounts.values()]
    .filter(a => a.id !== req.userId && (a.username || "").toLowerCase().includes(q))
    .slice(0, limit)
    .map(a => ({
      id: a.id,
      username: a.username,
      role: a.role === "admin" ? "admin" : "user",
      online: [...wsClients.values()].some(c => c.userId === a.id),
    }));
  res.json({ users });
});

// ─── Публичный профиль (без авторизации) ─────────────────────────────────────
app.get("/api/user/:id", async (req, res) => {
  const id = sanitize(req.params.id, 64);
  const acc = await redisAccounts.get(id);
  if (!acc) return res.status(404).json({ message: "Игрок не найден" });
  const online = [...wsClients.values()].some(c => c.userId === id);
  const friendCount = getFriends(id).size;
  res.json({
    id: acc.id,
    username: acc.username,
    role: acc.role,
    bio: acc.bio || "",
    equip: acc.equip || {},
    inventory: Array.isArray(acc.inventory) ? acc.inventory : [],
    createdAt: acc.createdAt,
    online,
    friendCount,
  });
});

app.get("/api/user/:id/activity", requireAuth, (req, res) => {
  const targetId = sanitize(req.params.id, 64);
  const list = activityStore.get(targetId) || [];
  const byServer = {};
  let totalSec = 0, lastSession = null;
  for (const s of list) {
    byServer[s.serverId] = (byServer[s.serverId] || 0) + s.durationSec;
    totalSec += s.durationSec;
    if (!lastSession || s.endedAt > lastSession) lastSession = s.endedAt;
  }
  res.json({ totalSec, byServer, lastSessionAt: lastSession || null, recent: list.slice(-10).reverse() });
});

// ─── Комментарии профиля (rate-limit + sanitization) ─────────────────────────
const profileComments = new Map(); // userId -> [{id, fromId, fromUsername, text, time}]
const lastCommentAt   = new Map(); // fromId -> ts (1 в 10с)
const commentHourly   = new Map(); // fromId -> [ts...]

function wsClientsByUserId(uid) {
  for (const c of wsClients.values()) if (c.userId === uid) return c;
  return null;
}

app.get("/api/user/:id/comments", (req, res) => {
  const id = sanitize(req.params.id, 64);
  const list = profileComments.get(id) || [];
  res.json({ comments: list.slice(-50).reverse() });
});

app.post("/api/user/:id/comments", requireAuth, (req, res) => {
  const id = sanitize(req.params.id, 64);
  if (id === req.userId) return res.status(400).json({ message: "Нельзя комментировать свой профиль" });
  const text = sanitize(req.body.text || "", 200);
  if (text.length < 2) return res.status(400).json({ message: "Слишком короткий комментарий" });

  const now = Date.now();
  const last = lastCommentAt.get(req.userId) || 0;
  if (now - last < 10_000) return res.status(429).json({ message: "Подожди 10 секунд" });
  const hourly = (commentHourly.get(req.userId) || []).filter(t => now - t < 3600_000);
  if (hourly.length >= 5) return res.status(429).json({ message: "Слишком много комментариев — попробуй позже" });
  lastCommentAt.set(req.userId, now);
  commentHourly.set(req.userId, [...hourly, now]);

  // username возьмём из WS-клиента, или из accounts map
  let fromUsername = "Player";
  const ws = wsClientsByUserId(req.userId);
  if (ws?.username) fromUsername = ws.username;
  else {
    for (const a of accounts.values()) if (a.id === req.userId) { fromUsername = a.username; break; }
  }

  const list = profileComments.get(id) || [];
  const c = { id: uuidv4(), fromId: req.userId, fromUsername, text, time: now };
  list.push(c);
  profileComments.set(id, list.slice(-200));
  sendToUser(id, { type: "profile_comment", userId: id, comment: c });
  res.json({ ok: true, comment: c });
});

// ─── JWT middleware для /api/* (некоторые эндпоинты опциональны) ──────────────
function optionalAuth(req, _res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  req.userId = token ? verifyToken(token)?.sub : null;
  next();
}
function requireAuth(req, res, next) {
  optionalAuth(req, res, () => {
    if (!req.userId) return res.status(401).json({ message: "Необходима авторизация" });
    next();
  });
}
async function requireAdmin(req, res, next) {
  optionalAuth(req, res, async () => {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const acc = await redisAccounts.get(req.userId);
    if (!acc || acc.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    next();
  });
}

// ─── Inventory (Библиотека: рамки / фоны / анимированные аватарки / бейджи) ────
// Каталог — на сервере, ownership — у юзера (id-шники купленных предметов).
const SHOP_CATALOG = [
  { id: "frame_basic_blue",  type: "frame",    name: "Sketched Memory",      price: 200,  preview: "#3b82f6" },
  { id: "frame_neon",        type: "frame",    name: "Bewitching Frame",     price: 500,  preview: "#a855f7" },
  { id: "frame_gold",        type: "frame",    name: "oil",                  price: 1500, preview: "#facc15" },
  { id: "frame_galaxy",      type: "frame",    name: "Элли у окна",          price: 3000, preview: "linear-gradient(135deg,#6366f1,#a855f7,#ec4899)" },
  { id: "frame_fire",        type: "frame",    name: "Husk Frame",           price: 2000, preview: "linear-gradient(135deg,#dc2626,#f97316,#facc15)" },
  { id: "frame_ice",         type: "frame",    name: "Ледяная",              price: 2000, preview: "linear-gradient(135deg,#0ea5e9,#38bdf8,#e0f2fe)" },
  { id: "bg_fon1",           type: "background", name: "Lilywhite & Lilyblack", price: 0,  preview: "#3b82f6" },
  { id: "bg_fon2",           type: "background", name: "Miss Neko 2",        price: 500,  preview: "#8b5cf6" },
  { id: "bg_fon3",           type: "background", name: "Muse Dash",          price: 800,  preview: "#ec4899" },
  { id: "bg_fon4",           type: "background", name: "GetsuClanEstate",    price: 1200, preview: "#f97316" },
  { id: "bg_fon5",           type: "background", name: "Circle of Hell",     price: 1500, preview: "#eab308" },
  { id: "bg_fon6",           type: "background", name: "Black Hole",         price: 2000, preview: "#22c55e" },
  { id: "bg_fon7",           type: "background", name: "noir-anime2",        price: 2500, preview: "#06b6d4" },
  { id: "anim_pulse",        type: "avatar_animated", name: "Импульс",     price: 1200, preview: "#60a5fa" },
  { id: "anim_flame",        type: "avatar_animated", name: "Пламя",       price: 1200, preview: "#f97316" },
  { id: "anim_neon",         type: "avatar_animated", name: "Неон",        price: 1500, preview: "#a855f7" },
  { id: "badge_diamond",     type: "badge",    name: "Бриллиант",           price: 800,  preview: "#38bdf8" },
  { id: "badge_flame",       type: "badge",    name: "Пламя",               price: 600,  preview: "#f97316" },
  { id: "badge_star",        type: "badge",    name: "Звезда",              price: 500,  preview: "#facc15" },
  { id: "badge_skull",       type: "badge",    name: "Череп",               price: 1000, preview: "#ef4444" },
];

// Каталог ТОЛЬКО для торговой площадки (P2P). Не пересекается с SHOP_CATALOG.
const MARKET_CATALOG = [
  { id: "m_cosmic_chest",   type: "chest",      name: "Космический кейс",  preview: "linear-gradient(135deg,#1e1b4b,#7c3aed,#ec4899)" },
  { id: "m_saber_relic",    type: "relic",      name: "Реликвия Силы",     preview: "linear-gradient(135deg,#0c4a6e,#0ea5e9,#22d3ee)" },
  { id: "m_dragon_scale",   type: "material",   name: "Драконья чешуя",    preview: "linear-gradient(135deg,#7f1d1d,#dc2626,#fb923c)" },
  { id: "m_ghost_cape",     type: "skin",       name: "Призрачный плащ",   preview: "linear-gradient(135deg,#1e293b,#475569,#94a3b8)" },
  { id: "m_ember_token",    type: "token",      name: "Угольный жетон",    preview: "linear-gradient(135deg,#7f1d1d,#ea580c)" },
  { id: "m_neon_disc",      type: "disc",       name: "Неоновый диск",     preview: "linear-gradient(135deg,#581c87,#a855f7,#22d3ee)" },
  { id: "m_void_pearl",     type: "pearl",      name: "Жемчужина Бездны",  preview: "linear-gradient(135deg,#020617,#1e1b4b,#0ea5e9)" },
  { id: "m_aurora_shard",   type: "shard",      name: "Осколок Авроры",    preview: "linear-gradient(135deg,#0c4a6e,#22d3ee,#a855f7)" },
];

app.get("/api/inventory/catalog", (_req, res) => {
  res.json({ items: SHOP_CATALOG });
});

app.get("/api/inventory", requireAuth, async (req, res) => {
  const acc = await redisAccounts.get(req.userId);
  const owned     = Array.isArray(acc?.inventory)     ? acc.inventory     : [];
  const marketOwn = Array.isArray(acc?.market_inventory) ? acc.market_inventory : [];
  const equip = acc?.equip && typeof acc.equip === "object" ? acc.equip : {};
  res.json({ owned, market: marketOwn, equip, catalog: SHOP_CATALOG, marketCatalog: MARKET_CATALOG });
});

app.post("/api/inventory/buy", requireAuth, async (req, res) => {
  const itemId = sanitize(req.body.itemId || "", 64);
  const item = SHOP_CATALOG.find(i => i.id === itemId);
  if (!item) return res.status(404).json({ message: "Предмет не найден" });
  const acc = await redisAccounts.get(req.userId);
  if (!acc) return res.status(404).json({ message: "Аккаунт не найден" });
  const owned = Array.isArray(acc.inventory) ? acc.inventory : [];
  if (owned.includes(itemId)) return res.status(400).json({ message: "Уже куплено" });
  if ((acc.balance || 0) < item.price)
    return res.status(400).json({ message: "Недостаточно СБТ", need: item.price, have: acc.balance || 0 });
  acc.balance   = (acc.balance || 0) - item.price;
  acc.inventory = [...owned, itemId];
  await redisAccounts.set(req.userId, acc);
  res.json({ ok: true, balance: acc.balance, inventory: acc.inventory });
});

app.post("/api/inventory/equip", requireAuth, async (req, res) => {
  const itemId = sanitize(req.body.itemId || "", 64);
  const acc = await redisAccounts.get(req.userId);
  if (!acc) return res.status(404).json({ message: "Аккаунт не найден" });
  const owned = Array.isArray(acc.inventory) ? acc.inventory : [];
  if (!owned.includes(itemId)) return res.status(400).json({ message: "Сначала купи предмет" });
  const item = SHOP_CATALOG.find(i => i.id === itemId);
  if (!item) return res.status(404).json({ message: "Предмет не найден" });
  acc.equip = { ...(acc.equip || {}), [item.type]: itemId };
  await redisAccounts.set(req.userId, acc);
  res.json({ ok: true, equip: acc.equip });
});

app.post("/api/inventory/unequip", requireAuth, async (req, res) => {
  const type = sanitize(req.body.type || "", 32); // frame | background | avatar_animated | badge
  if (!["frame","background","avatar_animated","badge"].includes(type))
    return res.status(400).json({ message: "Неверный тип" });
  const acc = await redisAccounts.get(req.userId);
  if (!acc) return res.status(404).json({ message: "Аккаунт не найден" });
  acc.equip = { ...(acc.equip || {}) };
  delete acc.equip[type];
  await redisAccounts.set(req.userId, acc);
  res.json({ ok: true, equip: acc.equip });
});

// ─── Bio (описание профиля) ───────────────────────────────────────────────────
app.get("/api/user/bio", requireAuth, async (req, res) => {
  const acc = await redisAccounts.get(req.userId);
  res.json({ bio: acc?.bio || "" });
});

app.put("/api/user/bio", requireAuth, async (req, res) => {
  const bio = sanitize(req.body.bio || "", 300);
  const acc = await redisAccounts.get(req.userId);
  if (!acc) return res.status(404).json({ message: "Аккаунт не найден" });
  acc.bio = bio;
  await redisAccounts.set(req.userId, acc);
  res.json({ ok: true, bio: acc.bio });
});

// ─── Activity (когда играл, сколько часов на каком сервере) ───────────────────
// Источник — клиент шлёт сессии через POST /api/activity, агрегаты читаем через GET.
const activityStore = new Map(); // userId -> [{ serverId, startedAt, endedAt, durationSec }]

app.post("/api/activity", requireAuth, (req, res) => {
  const { serverId, startedAt, endedAt, durationSec } = req.body || {};
  if (!serverId || typeof startedAt !== "number" || typeof endedAt !== "number")
    return res.status(400).json({ message: "Неверные поля" });
  const dur = Math.max(0, Math.min(60 * 60 * 24, Math.floor(durationSec || (endedAt - startedAt) / 1000)));
  const list = activityStore.get(req.userId) || [];
  list.push({ serverId: sanitize(serverId, 32), startedAt, endedAt, durationSec: dur });
  // Храним последние 200 сессий
  activityStore.set(req.userId, list.slice(-200));
  res.json({ ok: true });
});

app.get("/api/activity", requireAuth, (req, res) => {
  const list = activityStore.get(req.userId) || [];
  // Агрегат по серверам
  const byServer = {};
  let totalSec = 0;
  let lastSession = null;
  for (const s of list) {
    byServer[s.serverId] = (byServer[s.serverId] || 0) + s.durationSec;
    totalSec += s.durationSec;
    if (!lastSession || s.endedAt > lastSession) lastSession = s.endedAt;
  }
  res.json({
    totalSec,
    byServer,
    lastSessionAt: lastSession || null,
    recent: list.slice(-10).reverse(),
  });
});

// ─── Marketplace (глобальный P2P трейд предметами из Библиотеки) ───────────────
// Листинг — это продажа itemId из инвентаря за SBT между игроками.
const listings = new Map();
let listingCounter = 0;

function publicListing(l) {
  return {
    id: l.id,
    itemId: l.itemId,
    itemType: l.itemType,
    name: l.name,
    preview: l.preview,
    price: l.price,
    sellerId: l.sellerId,
    sellerName: l.sellerName,
    createdAt: l.createdAt,
    status: l.status,
  };
}

app.get("/api/market/listings", (req, res) => {
  const type = req.query.type ? sanitize(String(req.query.type), 32) : null;
  const out = [...listings.values()]
    .filter(l => l.status === "active")
    .filter(l => !type || l.itemType === type)
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(publicListing);
  res.json({ listings: out });
});

app.get("/api/market/my", requireAuth, (req, res) => {
  const out = [...listings.values()]
    .filter(l => l.sellerId === req.userId)
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(publicListing);
  res.json({ listings: out });
});

app.get("/api/market/catalog", (_req, res) => {
  res.json({ items: MARKET_CATALOG });
});

// Админ-выдача market-предмета юзеру (для теста)
app.post("/api/market/grant", requireAuth, async (req, res) => {
  const acc = await redisAccounts.get(req.userId);
  if (!acc || acc.role !== "admin") return res.status(403).json({ message: "Только админ" });
  const targetId = sanitize(req.body.userId || "", 64);
  const itemId   = sanitize(req.body.itemId || "", 64);
  const target = await redisAccounts.get(targetId);
  if (!target) return res.status(404).json({ message: "Игрок не найден" });
  const item = MARKET_CATALOG.find(i => i.id === itemId);
  if (!item) return res.status(404).json({ message: "Предмет не найден" });
  target.market_inventory = Array.isArray(target.market_inventory) ? [...target.market_inventory, itemId] : [itemId];
  await redisAccounts.set(targetId, target);
  res.json({ ok: true, market: target.market_inventory });
});

app.post("/api/market/sell", requireAuth, async (req, res) => {
  const { itemId, price } = req.body || {};
  const cleanId = sanitize(String(itemId || ""), 64);
  const priceNum = parseInt(price, 10);
  if (!cleanId) return res.status(400).json({ message: "Не указан предмет" });
  if (!Number.isFinite(priceNum) || priceNum < 10 || priceNum > 100000)
    return res.status(400).json({ message: "Цена: 10–100000 СБТ" });
  const acc = await redisAccounts.get(req.userId);
  if (!acc) return res.status(404).json({ message: "Аккаунт не найден" });
  const marketOwn = Array.isArray(acc.market_inventory) ? acc.market_inventory : [];
  if (!marketOwn.includes(cleanId)) return res.status(400).json({ message: "Сначала получи этот предмет (он выдаётся за активности или покупки)" });
  const item = MARKET_CATALOG.find(i => i.id === cleanId);
  if (!item) return res.status(404).json({ message: "Предмет не найден" });
  const hasActive = [...listings.values()].some(l => l.status === "active" && l.sellerId === req.userId && l.itemId === cleanId);
  if (hasActive) return res.status(400).json({ message: "У тебя уже есть активный листинг на этот предмет" });

  acc.market_inventory = marketOwn.filter(x => x !== cleanId);
  await redisAccounts.set(req.userId, acc);

  const id = String(++listingCounter);
  const listing = {
    id,
    itemId: cleanId,
    itemType: item.type,
    name: item.name,
    preview: item.preview,
    price: priceNum,
    sellerId: req.userId,
    sellerName: acc.username,
    createdAt: Date.now(),
    status: "active",
  };
  listings.set(id, listing);
  res.json({ ok: true, listing: publicListing(listing) });
});

app.post("/api/market/buy/:id", requireAuth, async (req, res) => {
  const id = sanitize(req.params.id, 32);
  const listing = listings.get(id);
  if (!listing) return res.status(404).json({ message: "Листинг не найден" });
  if (listing.status !== "active") return res.status(400).json({ message: "Листинг уже завершён" });
  if (listing.sellerId === req.userId) return res.status(400).json({ message: "Нельзя купить свой листинг" });

  const buyer = await redisAccounts.get(req.userId);
  if (!buyer) return res.status(404).json({ message: "Аккаунт не найден" });
  if ((buyer.balance || 0) < listing.price)
    return res.status(400).json({ message: "Недостаточно СБТ", need: listing.price, have: buyer.balance || 0 });

  const seller = await redisAccounts.get(listing.sellerId);
  if (!seller) return res.status(404).json({ message: "Продавец не найден" });

  buyer.balance  = (buyer.balance  || 0) - listing.price;
  seller.balance = (seller.balance || 0) + listing.price;
  buyer.market_inventory = Array.isArray(buyer.market_inventory) ? [...buyer.market_inventory, listing.itemId] : [listing.itemId];

  const ageMs = Date.now() - listing.createdAt;
  if (ageMs > 14 * 24 * 3600 * 1000) {
    const fee = Math.ceil(listing.price * 0.05);
    seller.balance -= fee;
    buyer.balance  += fee;
  }
  await redisAccounts.set(req.userId, buyer);
  await redisAccounts.set(listing.sellerId, seller);

  listing.status = "sold";
  listing.soldTo = req.userId;
  listing.soldAt = Date.now();
  listings.set(id, listing);

  sendToUser(listing.sellerId, { type: "market_sold", listingId: id, price: listing.price, buyerName: buyer.username });
  res.json({ ok: true, balance: buyer.balance, market: buyer.market_inventory });
});

app.delete("/api/market/:id", requireAuth, async (req, res) => {
  const id = sanitize(req.params.id, 32);
  const listing = listings.get(id);
  if (!listing) return res.status(404).json({ message: "Листинг не найден" });
  if (listing.sellerId !== req.userId) return res.status(403).json({ message: "Это не твой листинг" });
  if (listing.status !== "active") return res.status(400).json({ message: "Уже завершён" });
  const acc = await redisAccounts.get(req.userId);
  if (acc) {
    acc.market_inventory = Array.isArray(acc.market_inventory) ? [...acc.market_inventory, listing.itemId] : [listing.itemId];
    await redisAccounts.set(req.userId, acc);
  }
  listing.status = "cancelled";
  listings.set(id, listing);
  res.json({ ok: true });
});

// ─── Группы / команды (3+ игроков) ───────────────────────────────────────────
const groups        = new Map(); // id -> { id, name, ownerId, members: Set, createdAt }
const groupMessages = new Map(); // id -> [{ id, fromId, fromUsername, text, time }]
const groupInvites  = new Map(); // groupId -> [{ toId, fromId, time }]
let groupCounter   = 0;
const GROUP_MAX    = 8;

function publicGroup(g) {
  return {
    id: g.id,
    name: g.name,
    ownerId: g.ownerId,
    members: [...g.members],
    createdAt: g.createdAt,
  };
}

app.get("/api/groups", requireAuth, (req, res) => {
  // все группы, в которых состоит юзер
  const out = [...groups.values()]
    .filter(g => g.members.has(req.userId))
    .map(publicGroup);
  res.json({ groups: out });
});

app.post("/api/groups", requireAuth, (req, res) => {
  const name = sanitize(req.body.name || "", 40);
  if (name.length < 2 || name.length > 40) return res.status(400).json({ message: "Название: 2–40 символов" });
  const id = String(++groupCounter);
  const g = { id, name, ownerId: req.userId, members: new Set([req.userId]), createdAt: Date.now() };
  groups.set(id, g);
  groupMessages.set(id, []);
  res.json({ ok: true, group: publicGroup(g) });
});

app.post("/api/groups/:id/invite", requireAuth, (req, res) => {
  const gid = sanitize(req.params.id, 32);
  const g = groups.get(gid);
  if (!g) return res.status(404).json({ message: "Группа не найдена" });
  if (!g.members.has(req.userId)) return res.status(403).json({ message: "Ты не в группе" });
  if (g.members.size >= GROUP_MAX) return res.status(400).json({ message: `Максимум ${GROUP_MAX} человек` });
  const targetNick = sanitize(req.body.username || "", 32).toLowerCase();
  const target = [...accounts.values()].find(a => (a.username || "").toLowerCase() === targetNick);
  if (!target) return res.status(404).json({ message: "Игрок не найден" });
  if (g.members.has(target.id)) return res.status(400).json({ message: "Уже в группе" });
  const list = groupInvites.get(gid) || [];
  if (list.find(i => i.toId === target.id)) return res.status(400).json({ message: "Уже приглашён" });
  const invite = { toId: target.id, fromId: req.userId, fromUsername: "Player", groupId: gid, groupName: g.name, time: Date.now() };
  // username инициатора
  const from = wsClientsByUserId(req.userId);
  invite.fromUsername = from?.username || "Player";
  list.push(invite);
  groupInvites.set(gid, list);
  sendToUser(target.id, { type: "group_invite", invite });
  res.json({ ok: true });
});

app.post("/api/groups/:id/respond", requireAuth, (req, res) => {
  const gid = sanitize(req.params.id, 32);
  const g = groups.get(gid);
  if (!g) return res.status(404).json({ message: "Группа не найдена" });
  const accept = !!req.body.accept;
  const currentInvites = groupInvites.get(gid) || [];
  const invite = currentInvites.find(i => i.toId === req.userId);
  if (!invite) return res.status(403).json({ message: "Нет приглашения" });
  const list = currentInvites.filter(i => i.toId !== req.userId);
  groupInvites.set(gid, list);
  if (accept) {
    if (g.members.size >= GROUP_MAX) return res.status(400).json({ message: "Группа уже заполнена" });
    g.members.add(req.userId);
    // уведомим всех в группе
    for (const m of g.members) sendToUser(m, { type: "group_update", group: publicGroup(g) });
  }
  res.json({ ok: true, group: publicGroup(g) });
});

app.post("/api/groups/:id/leave", requireAuth, (req, res) => {
  const gid = sanitize(req.params.id, 32);
  const g = groups.get(gid);
  if (!g) return res.status(404).json({ message: "Группа не найдена" });
  g.members.delete(req.userId);
  if (g.members.size === 0) {
    groups.delete(gid);
    groupMessages.delete(gid);
    groupInvites.delete(gid);
  } else if (g.ownerId === req.userId) {
    // передаём владение первому оставшемуся
    g.ownerId = g.members.values().next().value;
    for (const m of g.members) sendToUser(m, { type: "group_update", group: publicGroup(g) });
  } else {
    for (const m of g.members) sendToUser(m, { type: "group_update", group: publicGroup(g) });
  }
  res.json({ ok: true });
});

app.get("/api/groups/:id/messages", requireAuth, (req, res) => {
  const gid = sanitize(req.params.id, 32);
  const g = groups.get(gid);
  if (!g || !g.members.has(req.userId)) return res.status(403).json({ message: "Нет доступа" });
  res.json({ messages: (groupMessages.get(gid) || []).slice(-100) });
});

app.get("/api/groups/invites", requireAuth, (req, res) => {
  const out = [];
  for (const [gid, list] of groupInvites.entries()) {
    for (const inv of list) {
      if (inv.toId === req.userId) out.push({ ...inv, groupId: gid });
    }
  }
  res.json({ invites: out });
});

// Список онлайн юзеров
app.get("/online", (_, res) => {
  const users = [...wsClients.values()]
    .filter(c => c.userId && c.username)
    .map(c => ({ id: c.userId, username: c.username }));
  res.json({ users });
});

// Список всех тикетов (для админа)
app.get("/support/tickets", requireAuth, async (req, res) => {
  const acc = await redisAccounts.get(req.userId);
  const isAdminUser = acc?.role === "admin";
  const list = [...tickets.values()].filter(t => isAdminUser || t.userId === req.userId).map(t => ({
    id: t.id, category: t.category, username: t.username,
    status: t.status, createdAt: t.createdAt, preview: t.preview,
    unread: t.unread || 0,
  }));
  res.json({ tickets: list.sort((a, b) => b.createdAt - a.createdAt) });
});

// Полный тикет с сообщениями
app.get("/support/ticket/:id", requireAuth, async (req, res) => {
  const t = tickets.get(Number(req.params.id));
  if (!t) return res.status(404).json({ message: "Тикет не найден" });
  if (t.userId !== req.userId) {
    const acc = await redisAccounts.get(req.userId);
    if (!acc || acc.role !== "admin") return res.status(403).json({ message: "Forbidden" });
  }
  res.json(t);
});

// Создать тикет (REST — с первым сообщением)
app.post("/support/ticket", requireAuth, (req, res) => {
  const rawCategory = sanitize(req.body.category || "", 80);
  const rawMessage  = sanitize(req.body.message  || "", 2000);
  const rawUsername = sanitize(req.body.username || "Player", 32);
  const userId      = req.userId;
  if (!rawCategory || !rawMessage || rawMessage.length < 5)
    return res.status(400).json({ message: "Заполните все поля (минимум 5 символов)" });
  const ticketId = ++ticketCounter;
  const ticket = {
    id: ticketId,
    userId,
    username: rawUsername,
    category: rawCategory,
    preview: rawMessage.slice(0, 60),
    status: "open",
    unread: 0,
    createdAt: Date.now(),
    messages: [{
      id: uuidv4(), from: "system",
      text: `Тикет #${ticketId} создан. Ожидайте ответа администратора.`,
      time: Date.now(),
    }, {
      id: uuidv4(), from: userId,
      username: rawUsername,
      text: rawMessage,
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
  wsClients.set(clientId, { ws, userId: null, role: "user", msgCount: 0, msgWindowStart: Date.now() });

  ws.on("message", async (raw) => {
    if (raw.length > 8192) { ws.close(1009, "Message too large"); return; }
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    const client = wsClients.get(clientId);
    if (!client) return;
    const now = Date.now();
    if (now - client.msgWindowStart > 10_000) {
      client.msgWindowStart = now;
      client.msgCount = 0;
    }
    if (++client.msgCount > 60) {
      send(ws, { type: "error", text: "Too many messages" });
      return;
    }
    if (!client.userId && msg.type !== "auth") {
      send(ws, { type: "auth_error", message: "Unauthorized" });
      ws.close(1008, "Unauthorized");
      return;
    }

    switch (msg.type) {
      // Клиент идентифицируется при подключении — требуем JWT
      case "auth": {
        // Проверяем токен
        const userId = msg.token ? wsAuthenticate(msg.token) : null;
        if (!userId) {
          send(ws, { type: "auth_error", message: "Необходима авторизация" });
          ws.close();
          return;
        }
        const acc = await redisAccounts.get(userId);
        if (!acc) {
          send(ws, { type: "auth_error", message: "Account not found" });
          ws.close();
          return;
        }
        client.userId = userId;
        client.username = sanitize(acc.username || msg.username || "", 32);
        client.role = acc.role === "admin" ? "admin" : "user";
        wsClients.set(clientId, client);

        // Отправить список онлайн-пользователей всем
        broadcastOnlineUsers();

        // Отправить себе список друзей и входящих запросов
        const myRequests = getPendingRequests(client.userId);
        send(ws, { type: "friends_list", friends: publicFriends(client.userId) });
        send(ws, { type: "friend_requests", requests: myRequests });

        // Отправить статус — сколько открытых тикетов если админ
        if (client.role === "admin") {
          const openCount = [...tickets.values()].filter(t => t.status !== "closed").length;
          send(ws, { type: "admin_ready", openTickets: openCount });
        }
        break;
      }

      // Отправить заявку в друзья по нику
      case "community_sync": {
        send(ws, { type: "friends_list", friends: publicFriends(client.userId) });
        send(ws, { type: "friend_requests", requests: getPendingRequests(client.userId) });
        send(ws, {
          type: "online_users",
          users: [...wsClients.values()]
            .filter(c => c.userId && c.username)
            .map(c => ({ id: c.userId, username: c.username, role: c.role })),
        });
        break;
      }

      // Отправить заявку в друзья по нику
      case "friend_request_send": {
        const searchNick = sanitize(msg.toUsername || "", 32).toLowerCase();
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
        const fromId = sanitize(msg.fromId || "", 64);
        const accept = !!msg.accept;
        const pending = getPendingRequests(client.userId);
        const request = pending.find(r => r.fromId === fromId);
        if (!request) {
          send(ws, { type: "friend_requests", requests: pending });
          break;
        }
        const reqs = pending.filter(r => r.fromId !== fromId);
        friendRequests.set(client.userId, reqs);
        if (accept) {
          if (!friendships.has(client.userId)) friendships.set(client.userId, new Set());
          if (!friendships.has(fromId))         friendships.set(fromId,         new Set());
          friendships.get(client.userId).add(fromId);
          friendships.get(fromId).add(client.userId);
          // Оба получают обновлённые списки
          send(ws, { type: "friends_list", friends: publicFriends(client.userId) });
          sendToUser(fromId, { type: "friends_list", friends: publicFriends(fromId) });
          sendToUser(fromId, { type: "friend_accepted", byId: client.userId, byUsername: client.username });
        }
        send(ws, { type: "friend_requests", requests: getPendingRequests(client.userId) });
        break;
      }

      // Отправить личное сообщение другу
      case "dm_send": {
        const toId = sanitize(msg.toId || "", 64);
        if (!toId || toId === client.userId || !areFriends(client.userId, toId)) {
          send(ws, { type: "friend_error", message: "DM доступен только друзьям" });
          break;
        }
        const text = sanitize(msg.text || "", 1000);
        if (!text) break;
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
        const withId = sanitize(msg.withId || "", 64);
        if (!withId || !areFriends(client.userId, withId)) {
          send(ws, { type: "dm_history", with: withId, messages: [] });
          break;
        }
        const key  = dmKey(client.userId, withId);
        const msgs = dms.get(key) || [];
        send(ws, { type: "dm_history", with: withId, messages: msgs.slice(-100) });
        break;
      }

      // Новое сообщение в тикет
      case "message": {
        const ticket = tickets.get(Number(msg.ticketId));
        if (!ticket) return;
        if (client.role !== "admin" && ticket.userId !== client.userId) return;
        const cleanText = sanitize(msg.text || "", 2000);
        if (!cleanText) return;
        const message = {
          id: uuidv4(),
          from: client.userId || "anon",
          username: client.username || "Player",
          role: client.role,
          text: cleanText,
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
        const ticket = tickets.get(Number(msg.ticketId));
        if (!ticket) break;
        if (client.role !== "admin" && ticket.userId !== client.userId) break;
        client.ticketId = ticket.id;
        wsClients.set(clientId, client);
        send(ws, { type: "ticket_messages", ticketId: ticket.id, messages: ticket.messages });
        break;
      }

      // Групповой чат
      case "group_send": {
        const gid = sanitize(msg.groupId || "", 32);
        const g = groups.get(gid);
        if (!g || !g.members.has(client.userId)) return;
        const text = sanitize(msg.text || "", 1000);
        if (!text) return;
        const m = { id: uuidv4(), fromId: client.userId, fromUsername: client.username || "Player", text, time: Date.now() };
        const list = groupMessages.get(gid) || [];
        list.push(m);
        groupMessages.set(gid, list.slice(-200));
        for (const memberId of g.members) {
          sendToUser(memberId, { type: "group_message", groupId: gid, message: m });
        }
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

// ─── Telegram Bot (webhook) ────────────────────────────────────────────────────
const TelegramBot = require("node-telegram-bot-api");
// Создаём без polling — будем принимать апдейты через /tg-webhook
const bot = new TelegramBot(BOT_TOKEN, { polling: false });

// Webhook endpoint — Telegram шлёт сюда апдейты
app.post("/tg-webhook", (req, res) => {
  try { bot.processUpdate(req.body); } catch (e) { console.error("[tg-webhook]", e.message); }
  res.sendStatus(200);
});

// Регистрируем webhook при старте (после listen, с задержкой)
async function setupBotWebhook() {
  const url = `https://api.sbgames.hyperionsearch.xyz:8443/tg-webhook`;
  try {
    // Сначала снимаем старый webhook (если был)
    await bot.deleteWebHook({ drop_pending_updates: true });
    await bot.setWebHook(url, { allowed_updates: ["message", "callback_query", "channel_post"] });
    const me = await bot.getMe();
    console.log(`[bot] webhook set → ${me.username} (${url})`);
  } catch (e) {
    console.error("[bot] webhook setup failed:", e.message);
  }
}

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
  // Регистрируем webhook после старта сервера
  setTimeout(setupBotWebhook, 1500);
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
