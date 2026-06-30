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

const { OAuth2Client } = require("google-auth-library");

const BOT_TOKEN           = process.env.BOT_TOKEN           || "8703318210:AAEG9Zj12W7i6hfPnIqLXeedcZrDwH-2Os8";
const ADMIN_TG_IDS        = (process.env.ADMIN_TG_IDS       || "8092106401").split(",");
const ADMIN_USERNAMES     = (process.env.ADMIN_USERNAMES     || "efseea").split(",");
let JWT_SECRET = crypto.randomBytes(48).toString("hex");
const PORT                = parseInt(process.env.PORT        || "3000", 10);
const PORT_SSL            = parseInt(process.env.PORT_SSL    || "3443", 10);
const BOT_USERNAME        = process.env.BOT_USERNAME        || "sbgamescbot";
const GOOGLE_CLIENT_ID    = process.env.GOOGLE_CLIENT_ID    || "";
const GOOGLE_CLIENT_SECRET= process.env.GOOGLE_CLIENT_SECRET|| "";
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || "https://games.sb-capital.group/auth/google/callback";

const googleOAuth = new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);
const googlePending = new Map(); // state -> { googleId, email, name, avatar, expiresAt }
// Cleanup expired Google OAuth entries every 5 minutes
setInterval(() => { const now = Date.now(); for (const [k, v] of googlePending) { if (v.expiresAt && v.expiresAt < now) googlePending.delete(k); } }, 300_000);

const SSL_KEY  = process.env.SSL_KEY  || "/etc/ssl/private/sbgames.key";
const SSL_CERT = process.env.SSL_CERT || "/etc/ssl/certs/sbgames.crt";

// ─── Redis ────────────────────────────────────────────────────────────────────
const redis = new Redis({ host: "127.0.0.1", port: 6379, lazyConnect: true });
redis.connect().catch(() => console.warn("[redis] not available, using memory"));

// Загрузка стабильного JWT-секрета.
// ВАЖНО: вызывается через await ДО старта HTTP/WS (см. конец файла).
// Без этого первый запрос /auth/tg-login мог прийти ДО загрузки секрета из
// Redis → токен подписывался эфемерным секретом, который тут же менялся →
// юзер получал невалидный токен и при перезаходе снова видел экран логина.
async function loadJwtSecret() {
  // 1) Если секрет явно задан в env — используем его синхронно. Это даёт
  //    стабильность токенов между рестартами/деплоями даже без Redis.
  if (process.env.JWT_SECRET) {
    JWT_SECRET = process.env.JWT_SECRET;
    console.log("[jwt] secret loaded from env");
    return;
  }
  // 2) Иначе тянем/генерим через Redis (стабильно между рестартами при наличии Redis).
  try {
    const stored = await redis.get("sbgames:jwt_secret");
    if (stored) { JWT_SECRET = stored; }
    else {
      JWT_SECRET = crypto.randomBytes(48).toString("hex");
      await redis.set("sbgames:jwt_secret", JWT_SECRET);
    }
    console.log("[jwt] secret loaded from redis");
  } catch { console.warn("[jwt] redis unavailable, using ephemeral secret — tokens WILL invalidate on restart"); }
}

const redisAccounts = { _map: new Map(),
  async get(k)    { try { const v = await redis.get(`acc:${k}`); const acc = v ? JSON.parse(v) : this._map.get(k); if (acc) { if (Array.isArray(acc.inventory)) acc.inventory = [...new Set(acc.inventory)]; if (Array.isArray(acc.market_inventory)) acc.market_inventory = [...new Set(acc.market_inventory)]; } return acc; } catch { return this._map.get(k); } },
  async set(k, v) { if (v && Array.isArray(v.inventory)) v.inventory = [...new Set(v.inventory)]; if (v && Array.isArray(v.market_inventory)) v.market_inventory = [...new Set(v.market_inventory)]; this._map.set(k, v); try { await redis.set(`acc:${k}`, JSON.stringify(v)); } catch {} },
  values()        { return this._map.values(); },
  // Атомарная мутация аккаунта (оптимистичная блокировка).
  // fn(acc) получает текущий объект аккаунта (или null) и должен вернуть
  //   { ok: true, value: <обновлённый acc> }  — записать и вернуть value, либо
  //   { ok: false, error: <строка> }          — отменить, вернуть ошибку без записи.
  // При живом Redis используется WATCH/MULTI/EXEC с повтором при конкурентной
  // записи. Без Redis мутация идёт синхронно над _map (для одного процесса Node
  // это атомарно — между чтением и записью нет await/точки переключения).
  async mutate(k, fn, retries = 5) {
    const key = `acc:${k}`;
    for (let attempt = 0; attempt < retries; attempt++) {
      let usedRedis = false;
      try {
        await redis.watch(key);
        usedRedis = true;
        const raw = await redis.get(key);
        const cur = raw ? JSON.parse(raw) : (this._map.get(k) || null);
        const out = fn(cur ? JSON.parse(JSON.stringify(cur)) : null);
        if (!out || out.ok !== true) { await redis.unwatch(); return { ok: false, error: out?.error || "mutation rejected" }; }
        if (out.value && Array.isArray(out.value.inventory)) out.value.inventory = [...new Set(out.value.inventory)];
        if (out.value && Array.isArray(out.value.market_inventory)) out.value.market_inventory = [...new Set(out.value.market_inventory)];
        const exec = await redis.multi().set(key, JSON.stringify(out.value)).exec();
        if (exec === null) { continue; } // ключ изменился между watch и exec — повтор
        this._map.set(k, out.value);
        return { ok: true, value: out.value };
      } catch {
        // Redis недоступен — синхронная мутация над памятью без await внутри
        if (usedRedis) { try { await redis.unwatch(); } catch {} }
        const cur = this._map.get(k) || null;
        const out = fn(cur ? JSON.parse(JSON.stringify(cur)) : null);
        if (!out || out.ok !== true) return { ok: false, error: out?.error || "mutation rejected" };
        if (out.value && Array.isArray(out.value.inventory)) out.value.inventory = [...new Set(out.value.inventory)];
        if (out.value && Array.isArray(out.value.market_inventory)) out.value.market_inventory = [...new Set(out.value.market_inventory)];
        this._map.set(k, out.value);
        return { ok: true, value: out.value };
      }
    }
    return { ok: false, error: "too much contention, try again" };
  },
  // Поиск по части имени в Redis + memory
  async search(q, limit = 30) {
    if (!q || q.length < 2) return [];
    const ql = q.toLowerCase();
    const results = [];
    // Memory
    for (const acc of this._map.values()) {
      if (acc.username?.toLowerCase().includes(ql)) results.push(acc);
    }
    // Redis scan (на случай если нет в memory, но есть в redis)
    if (results.length < limit) {
      try {
        const stream = redis.scanStream({ match: "acc:*", count: 200 });
        for await (const keys of stream) {
          for (const k of keys) {
            const id = k.slice(4);
            if (this._map.has(id)) continue;
            const v = await redis.get(k);
            if (!v) continue;
            const acc = JSON.parse(v);
            if (acc.username?.toLowerCase().includes(ql)) results.push(acc);
            if (results.length >= limit) break;
          }
          if (results.length >= limit) break;
        }
      } catch {}
    }
    return results.slice(0, limit);
  },
  // Все аккаунты: memory + Redis scan по acc:*. После рестарта процесса
  // _map пуст, а пользователи живут только в Redis — values() их не видит.
  // Этот метод медленнее values() (scan), поэтому используется только
  // для админских списков, не на горячих путях.
  async allValues() {
    const out = [...this._map.values()];
    const seen = new Set(out.map(a => String(a.id)));
    try {
      const stream = redis.scanStream({ match: "acc:*", count: 300 });
      for await (const keys of stream) {
        for (const k of keys) {
          const id = k.slice(4);
          if (seen.has(id)) continue;
          const v = await redis.get(k);
          if (!v) continue;
          try { const acc = JSON.parse(v); out.push(acc); seen.add(id); } catch {}
        }
      }
    } catch {}
    return out;
  },
};

const app = express();

// ─── Trust proxy (nginx) ──────────────────────────────────────────────────────
app.set("trust proxy", 1);

// ─── Static: backgrounds (video files) ────────────────────────────────────────
app.use("/backgrounds", express.static(
  require("path").join(__dirname, "backgrounds"),
  { maxAge: "7d", etag: true, lastModified: true }
));

// ─── Static: frames (PNG images) ──────────────────────────────────────────────
app.use("/frames", express.static(
  require("path").join(__dirname, "frames"),
  { maxAge: "7d", etag: true, lastModified: true }
));

// ─── Static: icons (PNG images) ───────────────────────────────────────────────
app.use("/icons", express.static(
  require("path").join(__dirname, "icons"),
  { maxAge: "7d", etag: true, lastModified: true }
));

// -- Static: server images --
app.use("/servers", express.static(
  require("path").join(__dirname, "servers"),
  { maxAge: "7d", etag: true, lastModified: true }
));

// ─── Security headers ─────────────────────────────────────────────────────────
// CSP is intentionally minimal GЗц this is an API server, not serving HTML pages.
// The strict CSP was causing Mac/webview clients to fail loading resources.
app.use(helmet({
  contentSecurityPolicy: {},
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy:    false,
  crossOriginResourcePolicy:  { policy: "cross-origin" },
  referrerPolicy:             { policy: "no-referrer" },
  hsts:                       { maxAge: 31536000, includeSubDomains: true, preload: true },
  noSniff:                    true,
  dnsPrefetchControl:         { allow: false },
  permittedCrossDomainPolicies: { permittedPolicies: "none" },
}));

// ─── CORS ─────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = new Set([
  "https://games.sb-capital.group",
  "http://games.sb-capital.group",
  "http://localhost:1420",
  "http://localhost:5173",
  "tauri://localhost",
  "http://tauri.localhost",
  "https://tauri.localhost",
]);
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.has(origin)) return cb(null, true);
    if (origin && (origin.startsWith("tauri://") || origin.includes("tauri.localhost"))) return cb(null, true);
    console.warn("[CORS] rejected origin:", origin);
    cb(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  maxAge: 86400,
}));

// ─── Body limits ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: "16kb" }));

// ─── IP blocklist (Redis-backed, in-memory fallback) ─────────────────────────
const blockedIPs     = new Map(); // ip → unblock timestamp
const failedAttempts = new Map(); // ip → { count, firstAt }
const BLOCK_AFTER    = 8;         // неудачных попыток
const BLOCK_TTL      = 15 * 60 * 1000; // 15 минут
const ATTEMPT_WINDOW = 10 * 60 * 1000; // окно подсчёта

function getIP(req) {
  const forwarded = req.headers && req.headers["x-forwarded-for"];
  if (forwarded) {
    return forwarded.split(",")[0].trim().replace(/^::ffff:/, "");
  }
  const realIp = req.headers && req.headers["x-real-ip"];
  if (realIp) {
    return realIp.replace(/^::ffff:/, "");
  }
  return (req.ip || req.socket.remoteAddress || "0.0.0.0").replace(/^::ffff:/, "");
}

function isBlocked(ip) {
  if (!ip || ip === "127.0.0.1" || ip === "::1" || ip === "localhost" || ip === "0.0.0.0") return false;
  const until = blockedIPs.get(ip);
  if (!until) return false;
  if (Date.now() > until) { blockedIPs.delete(ip); return false; }
  return true;
}

function recordFailure(ip) {
  if (!ip || ip === "127.0.0.1" || ip === "::1" || ip === "localhost" || ip === "0.0.0.0") return false;
  const now = Date.now();
  const entry = failedAttempts.get(ip) || { count: 0, firstAt: now };
  if (now - entry.firstAt > ATTEMPT_WINDOW) { entry.count = 0; entry.firstAt = now; }
  entry.count++;
  failedAttempts.set(ip, entry);
  if (entry.count >= BLOCK_AFTER) {
    blockedIPs.set(ip, now + BLOCK_TTL);
    failedAttempts.delete(ip);
    console.warn(`[security] blocked ${ip} (${BLOCK_AFTER} failures)`);
    return true;
  }
  return false;
}

function blockMiddleware(req, res, next) {
  const ip = getIP(req);
  if (isBlocked(ip)) return res.status(429).json({ message: "Слишком много попыток. Попробуйте позже." });
  next();
}

// ─── Rate limiters ────────────────────────────────────────────────────────────
const makeLimit = (windowMs, max, msg) => rateLimit({
  windowMs, max,
  message:        { message: msg || "Слишком много запросов" },
  standardHeaders: true,
  legacyHeaders:  false,
  keyGenerator:   req => getIP(req),
  skip:           () => false,
});

const authLimiter      = makeLimit(60_000, 30,  "Слишком много попыток входа");
const apiLimiter       = makeLimit(60_000, 100, "Слишком много запросов");
const strictLimiter    = makeLimit(60_000, 3,   "Превышен лимит запросов");

app.use("/auth/tg-login",    blockMiddleware, authLimiter);
app.use("/auth/widget-login", blockMiddleware, authLimiter);
// create-code и check-code — без лимитов, это безобидные операции
app.use("/payments",         blockMiddleware, strictLimiter);
app.use("/admin",            blockMiddleware);
app.use("/api",              apiLimiter);
app.use("/support/ticket",   apiLimiter);
// --- Auto-updater & downloads ---------------------------------------------------
const updatesDir = require("path").join(__dirname, "updates");
if (!fs.existsSync(updatesDir)) fs.mkdirSync(updatesDir, { recursive: true });

const UPDATE_BASE  = process.env.UPDATE_BASE || "https://games.sb-capital.group/update";
const UPDATE_NOTES = "Исправления и улучшения";

/** Список файлов в updates/ (с кешем по mtime директории). */
let _updatesCache = null;
let _updatesMtime = 0;
function listUpdates() {
  try {
    _updatesCache = fs.readdirSync(updatesDir).filter(f => !f.startsWith("."));
    return _updatesCache;
  } catch { return []; }
}

/** Найти самую свежую версию X.Y.Z по всем именам файлов. */
function detectLatestVersion() {
  const verRe = /(\d+\.\d+\.\d+)/;
  const versions = [];
  for (const f of listUpdates()) {
    const m = f.match(verRe);
    if (m) versions.push(m[1]);
  }
  if (!versions.length) return null;
  versions.sort((a, b) => {
    const pa = a.split(".").map(Number), pb = b.split(".").map(Number);
    return (pb[0] - pa[0]) || (pb[1] - pa[1]) || (pb[2] - pa[2]);
  });
  return versions[0];
}

/** Найти файл в updates/ по подстроке (или функции-предикату). */
function findUpdateFile(predicate) {
  const pred = typeof predicate === "function" ? predicate : (f) => f.includes(predicate);
  return listUpdates().find(f => pred(f) && !f.endsWith(".sig"));
}

/** Tauri updater endpoint.
 *  Формат updater-артефакта зависит от Tauri: .nsis.zip (старый) или .exe (новый NSIS),
 *  .app.tar.gz (macOS), .AppImage.tar.gz (Linux). Ищем по любому из вариантов. */
app.get("/update/:target/:arch/:currentVersion", (req, res) => {
  const { target, arch, currentVersion } = req.params;
  const latest = detectLatestVersion();
  if (!latest) return res.status(204).send();

  const key = target + "-" + arch;
  // Ищем updater-архив по паттернам. Имя продукта может содержать пробелы.
  let zipFile = null;
  let sigFile = null;
  if (key === "windows-x86_64") {
    zipFile = findUpdateFile(f => f.endsWith(".nsis.zip") && f.includes(latest))
           || findUpdateFile(f => f.endsWith("-setup.exe") && f.includes(latest))
           || findUpdateFile(f => f.endsWith(".exe") && f.includes(latest) && !f.endsWith(".sig"));
  } else if (key === "darwin-x86_64") {
    zipFile = findUpdateFile(f => f.endsWith(".app.tar.gz") && f.includes(latest) && (f.includes("_x64") || (!f.includes("aarch64") && !f.includes("arm64"))))
           || findUpdateFile(f => f.endsWith(".dmg") && f.includes(latest) && f.includes("_x64"));
  } else if (key === "darwin-aarch64") {
    zipFile = findUpdateFile(f => f.endsWith(".app.tar.gz") && f.includes(latest) && (f.includes("aarch64") || f.includes("arm64")))
           || findUpdateFile(f => f.endsWith(".dmg") && f.includes(latest) && (f.includes("aarch64") || f.includes("arm64")));
  } else if (key === "linux-x86_64") {
    zipFile = findUpdateFile(f => f.endsWith(".AppImage.tar.gz") && f.includes(latest))
           || findUpdateFile(f => f.endsWith(".AppImage") && !f.endsWith(".tar.gz") && f.includes(latest));
  }
  if (!zipFile) return res.status(204).send();

  const sig = zipFile + ".sig";
  if (listUpdates().includes(sig)) sigFile = sig;

  // Сравнение версий: новее ли latest?
  const cur = currentVersion.split(".").map(Number);
  const lat = latest.split(".").map(Number);
  const newer = lat[0] > cur[0] || (lat[0] === cur[0] && lat[1] > cur[1]) || (lat[0] === cur[0] && lat[1] === cur[1] && lat[2] > cur[2]);
  if (!newer) return res.status(204).send();

  let signature = "";
  if (sigFile) { try { signature = fs.readFileSync(require("path").join(updatesDir, sigFile), "utf8").trim(); } catch {} }

  const url = UPDATE_BASE + "/" + zipFile;
  res.json({ version: latest, notes: UPDATE_NOTES, pub_date: new Date().toISOString(), url, signature });
});

// Static: update binaries
app.use("/update", express.static(updatesDir, { maxAge: "1d", etag: true }));

// Debug: updater diagnostics (accessible via /health)
app.get("/update-debug", requireAuth, (_req, res) => {
  const latest = detectLatestVersion();
  const files = listUpdates();
  res.json({ latest, files, dir: updatesDir, exists: fs.existsSync(updatesDir) });
});

// --- Downloads manifest for website -------------------------------------------
app.get("/downloads/latest.json", (_req, res) => {
  const latest = detectLatestVersion();
  if (!latest) return res.json({ version: "v0.0.0", publishedAt: null, platforms: {} });

  const platforms = {};
  let newestMtime = null;

  const tryAdd = (platform, file) => {
    if (!file) return false;
    const p = require("path").join(updatesDir, file);
    if (!fs.existsSync(p)) return false;
    const st = fs.statSync(p);
    platforms[platform] = { url: UPDATE_BASE + "/" + file, size: st.size };
    if (!newestMtime || st.mtime > newestMtime) newestMtime = st.mtime;
    return true;
  };

  // Windows: NSIS .exe инсталлер
  tryAdd("windows", findUpdateFile(f => f.endsWith("-setup.exe") && f.includes(latest)));

  // macOS: .dmg (aarch64 или x64), fallback на .app.tar.gz
  if (!tryAdd("macos", findUpdateFile(f => f.endsWith("_aarch64.dmg") && f.includes(latest)))
   && !tryAdd("macos", findUpdateFile(f => f.endsWith("_x64.dmg") && f.includes(latest)))) {
    tryAdd("macos", findUpdateFile(f => f.endsWith(".dmg") && f.includes(latest)));
  }

  // Linux: AppImage
  tryAdd("linux", findUpdateFile(f => f.endsWith(".AppImage") && f.includes(latest) && !f.endsWith(".tar.gz")));

  res.json({
    version: "v" + latest,
    publishedAt: newestMtime ? newestMtime.toISOString() : null,
    platforms,
  });
});


// ─── Request ID & logging ─────────────────────────────────────────────────────
app.use((req, _res, next) => {
  req.reqId = uuidv4().slice(0, 8);
  next();
});

function sanitize(str, max = 500) {
  if (typeof str !== "string") return "";
  return sanitizeHtml(str.slice(0, max), { allowedTags: [], allowedAttributes: {} }).trim();
}
// Escape Markdown special characters for Telegram bot messages
function sanitizeMarkdown(str) {
  if (typeof str !== "string") return "";
  return str.replace(/[_*\[\]()~`>#+\-=|{}.!\\]/g, "\\$&");
}
function signToken(userId, tokenVersion = 0) { return jwt.sign({ sub: userId, ver: tokenVersion }, JWT_SECRET, { expiresIn: "7d" }); }
function verifyToken(token) { try { return jwt.verify(token, JWT_SECRET); } catch { return null; } }
function wsAuthenticate(token) { const p = verifyToken(token); return p ? p.sub : null; }
function isAdmin(username)  { return ADMIN_USERNAMES.includes((username || "").toLowerCase()); }
function isAdminId(tgId)   { return ADMIN_TG_IDS.includes(String(tgId)); }

const server = http.createServer(app);
const wss = new WebSocketServer({ server, verifyClient: (info, cb) => {
  const origin = info.origin || info.req.headers.origin || "";
  if (!origin || ALLOWED_ORIGINS.has(origin)) {
    cb(true);
  } else {
    console.warn(`[WS CORS] rejected origin: ${origin}`);
    cb(false, 403, "Origin not allowed");
  }
}});

// Ensure CORS headers are sent for WebSocket upgrade requests
server.on("upgrade", (req, socket, head) => {
  const origin = req.headers.origin || "";
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
    socket.destroy();
    return;
  }
  // Add CORS headers for the upgrade response
  if (origin) {
    socket.headers = socket.headers || {};
  }
});

// ─── Stores ───────────────────────────────────────────────────────────────────
const tickets        = new Map();
const friendships    = new Map();
const friendRequests = new Map();
const dms            = new Map();
const invoices       = new Map();
let ticketCounter  = 1000;
let invoiceCounter = 1;

const trades = new Map(); // tradeId -> { id, initiatorId, targetId, initiatorItems: [], targetItems: [], initiatorConfirmed, targetConfirmed, status, createdAt }
const wsClients = new Map();

function getFriends(userId)         { return friendships.get(userId) || new Set(); }
function areFriends(a, b)           { return getFriends(a).has(b); }
function dmKey(a, b)                { return [a, b].sort().join("_"); }
function getPendingRequests(userId) { return (friendRequests.get(userId) || []); }
function sendToUser(userId, data) {
  for (const c of wsClients.values()) { if (c.userId === userId) send(c.ws, data); }
}

// ─── REST ─────────────────────────────────────────────────────────────────────

// Вход через Telegram Widget (с верификацией хэша)
function verifyTelegramAuth(data) {
  const { hash, ...fields } = data;
  if (!hash) return false;
  const checkString = Object.keys(fields).sort().map(k => `${k}=${fields[k]}`).join("\n");
  const secretKey = crypto.createHash("sha256").update(BOT_TOKEN).digest();
  const hmac = crypto.createHmac("sha256", secretKey).update(checkString).digest("hex");
  if (hmac !== hash) return false;
  if (data.auth_date && Date.now() / 1000 - Number(data.auth_date) > 86400) return false;
  return true;
}

app.post("/auth/widget-login", async (req, res) => {
  const tgData = req.body;
  if (!tgData || !tgData.hash) return res.status(400).json({ message: "Нет данных" });

  if (!verifyTelegramAuth(tgData)) return res.status(401).json({ message: "Неверная подпись Telegram" });

  const tgId = String(tgData.id);
  let account = await redisAccounts.get(tgId);
  const adminRole = isAdmin(tgData.username || "") || isAdminId(tgId) ? "admin" : "user";

  if (!account) {
    // ????? ???????????? — ????? ???
    return res.json({ needNick: true, tgUser: tgData });
  }

  account.telegram = tgData.username || account.telegram;
  // Never downgrade role on login — only upgrade
  if (adminRole === "admin" || account.role !== "admin") {
    account.role = adminRole;
  }
  await redisAccounts.set(tgId, account);

  res.json({ user: account, token: signToken(tgId) });
});

// Завершение регистрации (ник) — поддерживает desktop flow
app.post("/auth/tg-login", async (req, res) => {
  const ip = getIP(req);
  const { tgUser, username, referralCode } = req.body;
  if (!tgUser) {
    recordFailure(ip);
    return res.status(400).json({ message: "Обязательные поля отсутствуют" });
  }
  const tgId = String(tgUser.id);
  if (!tgUser.id || tgUser.id <= 0) {
    recordFailure(ip);
    return res.status(401).json({ message: "Невалидный пользователь" });
  }

  // Desktop flow: если аккаунт уже есть — просто логиним без запроса ника
  let account = await redisAccounts.get(tgId);
  if (account) {
    account.telegram = tgUser.username || account.telegram;
    // Never downgrade role on login — only upgrade
    if (isAdmin(tgUser.username || account.username) || isAdminId(tgId)) {
      account.role = "admin";
    }
    await redisAccounts.set(tgId, account);
    return res.json({ user: account, token: signToken(tgId) });
  }

  // Новый пользователь — нужен ник
  if (!username) {
    return res.status(400).json({ needNick: true, message: "Придумай игровой ник" });
  }
  const cleanNick = sanitize(username).replace(/^@/, "");
  if (!/^[a-zA-Z0-9_]{3,16}$/.test(cleanNick)) {
    recordFailure(ip);
    return res.status(400).json({ message: "Ник: 3–16 символов, буквы/цифры/_" });
  }

  const adminRole = isAdmin(tgUser.username || cleanNick) || isAdminId(tgId) ? "admin" : "user";
  account = { id: tgId, username: cleanNick, telegram: tgUser.username || null, firstName: sanitize(tgUser.first_name || "", 64), balance: 0, role: adminRole, createdAt: Date.now() };
  await redisAccounts.set(tgId, account);

  // --- Referral tracking ---
  const refCode = (referralCode || "").toUpperCase();
  if (refCode) {
    // Find referrer by code
    let referrerId = null;
    for (const [rid, data] of referralData) {
      if (data.code === refCode) { referrerId = rid; break; }
    }
    if (referrerId && referrerId !== tgId) {
      const refData = ensureReferralData(referrerId);
      refData.referralCount = (refData.referralCount || 0) + 1;
      refData.referrals.push({
        tgId, nick: cleanNick, joinedAt: new Date().toISOString(), totalDonated: 0,
      });
      // Update level
      const level = getAffiliateLevel(refData.referralCount);
      refData.levelPercent = level.percent;
      await saveReferral(referrerId, refData);

      // Set referredBy on new user
      const newData = ensureReferralData(tgId);
      newData.referredBy = referrerId;
      await saveReferral(tgId, newData);
    }
  }

  res.json({ user: account, token: signToken(tgId) });
});

// --- Google OAuth -------------------------------------------------------------
// Step 1: Get Google auth URL (client calls this, opens URL in browser)
app.get("/auth/google/init", (req, res) => {
  const state = crypto.randomBytes(16).toString("hex");
  const url = googleOAuth.generateAuthUrl({
    access_type: "offline",
    scope: ["openid", "email", "profile"],
    state,
    prompt: "select_account",
  });
  // Store state temporarily (5 min) so callback can find it
  googlePending.set(state, { step: "waiting", expiresAt: Date.now() + 300_000 });
  res.json({ url, state });
});

// Step 2: Google redirects here after login
app.get("/auth/google/callback", async (req, res) => {
  const { code, state, error } = req.query;
  if (error || !code || !state) {
    const esc = String(error || "Нет кода авторизации").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
    return res.status(400).send(`<html><body style="background:#0a0a0f;color:#fff;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div style="text-align:center"><p style="font-size:18px;font-weight:700;color:#f87171">Ошибка входа через Google</p><p style="color:rgba(255,255,255,0.5);font-size:14px">${esc}</p></div></body></html>`);
  }

  const pending = googlePending.get(state);
  if (!pending) {
    return res.status(400).send(`<html><body style="background:#0a0a0f;color:#fff;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div style="text-align:center"><p style="font-size:18px;font-weight:700;color:#f87171">Устаревшая ссылка</p><p style="color:rgba(255,255,255,0.5);font-size:14px">Попробуй войти заново</p></div></body></html>`);
  }

  try {
    const { tokens } = await googleOAuth.getToken(code);
    googleOAuth.setCredentials(tokens);
    const ticket = await googleOAuth.verifyIdToken({ idToken: tokens.id_token, audience: GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    const googleId = `g_${payload.sub}`;
    const email    = payload.email || "";
    const name     = payload.name || payload.given_name || "Player";
    const avatar   = payload.picture || null;

    // Check if account already exists (returning user)
    let account = await redisAccounts.get(googleId);
    if (account) {
      const token = signToken(googleId);
      googlePending.set(state, { step: "done", token, user: account });
      return res.send(`<html><body style="background:#0a0a0f;color:#fff;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div style="text-align:center"><p style="font-size:22px;font-weight:800;color:#4ade80;margin-bottom:8px">Вход выполнен!</p><p style="color:rgba(255,255,255,0.5);font-size:14px">Можешь закрыть эту вкладку</p></div></body></html>`);
    }

    // New user — need nickname
    googlePending.set(state, { step: "need_nick", googleId, email, name, avatar, expiresAt: Date.now() + 300_000 });
    return res.send(`<html><body style="background:#0a0a0f;color:#fff;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div style="text-align:center"><p style="font-size:22px;font-weight:800;color:#60a5fa;margin-bottom:8px">Google-аккаунт подтверждён!</p><p style="color:rgba(255,255,255,0.5);font-size:14px">Можешь закрыть эту вкладку и придумать ник</p></div></body></html>`);
  } catch (e) {
    console.error("[Google OAuth] callback error:", e.message);
    return res.status(500).send(`<html><body style="background:#0a0a0f;color:#fff;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div style="text-align:center"><p style="color:#f87171;font-size:18px;font-weight:700">Ошибка сервера</p></div></body></html>`);
  }
});

// Step 3: Client polls this to check status
app.get("/auth/google/check", (req, res) => {
  const { state } = req.query;
  if (!state) return res.status(400).json({ status: "error" });
  const pending = googlePending.get(state);
  if (!pending) return res.json({ status: "expired" });
  if (pending.step !== "done" && Date.now() > (pending.expiresAt || 0)) {
    googlePending.delete(state);
    return res.json({ status: "expired" });
  }
  res.json({ status: pending.step, token: pending.token || null, user: pending.user || null });
});

// Step 4: Register nickname for new Google user
app.post("/auth/google/register", authLimiter, async (req, res) => {
  const { state, username, referralCode } = req.body;
  if (!state || !username) return res.status(400).json({ message: "Обязательные поля отсутствуют" });
  const pending = googlePending.get(state);
  if (!pending || pending.step !== "need_nick") return res.status(400).json({ message: "Недействительный запрос" });

  const cleanNick = sanitize(username).replace(/^@/, "");
  if (!/^[a-zA-Z0-9_]{3,16}$/.test(cleanNick)) {
    return res.status(400).json({ message: "Ник: 3–16 символов, буквы/цифры/_" });
  }

  // Check nick taken
  const taken = [...redisAccounts._map.values()].find(a => a.username?.toLowerCase() === cleanNick.toLowerCase());
  if (taken) return res.status(400).json({ message: "Ник уже занят" });

  const { googleId, email, name, avatar } = pending;
  const account = {
    id: googleId, username: cleanNick, email, displayName: sanitize(name, 64),
    avatar: avatar || null, balance: 0, role: "user", createdAt: Date.now(),
    authProvider: "google",
  };
  await redisAccounts.set(googleId, account);

  const refCode = (referralCode || "").toUpperCase();
  if (refCode) {
    let referrerId = null;
    for (const [rid, data] of referralData) {
      if (data.code === refCode) { referrerId = rid; break; }
    }
    if (referrerId && referrerId !== googleId) {
      const refData = ensureReferralData(referrerId);
      refData.referralCount = (refData.referralCount || 0) + 1;
      refData.referrals.push({
        tgId: googleId, nick: cleanNick, joinedAt: new Date().toISOString(), totalDonated: 0,
      });
      const level = getAffiliateLevel(refData.referralCount);
      refData.levelPercent = level.percent;
      await saveReferral(referrerId, refData);

      const newData = ensureReferralData(googleId);
      newData.referredBy = referrerId;
      await saveReferral(googleId, newData);
    }
  }

  const token = signToken(googleId, account.tokenVersion || 0);
  googlePending.set(state, { step: "done", token, user: account });
  res.json({ user: account, token });
});

// Прокси скина чтобы обойти CSP
app.get("/skin-proxy/:username", async (req, res) => {
  try {
    const r = await fetch(`https://minotar.net/skin/${encodeURIComponent(req.params.username)}`);
    if (!r.ok) throw new Error("not found");
    const buf = await r.buffer();
    res.set("Content-Type", "image/png");
    res.set("Cache-Control", "public, max-age=3600");
    res.send(buf);
  } catch {
    res.redirect("https://minotar.net/skin/Steve");
  }
});

app.get("/auth/me", async (req, res) => {
  const token = (req.headers.authorization || "").replace("Bearer ", "");
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ message: "Unauthorized" });
  const acc = await redisAccounts.get(payload.sub);
  if (!acc) return res.status(404).json({ message: "Not found" });
  // ????????????? ????????? ????
  if (isAdminId(payload.sub) && acc.role !== "admin") {
    acc.role = "admin";
    await redisAccounts.set(payload.sub, acc);
  }
  res.json({ user: acc });
});

app.put("/api/user/avatar", requireAuth, async (req, res) => {
  const acc = await redisAccounts.get(req.userId);
  if (!acc) return res.status(404).json({ message: "Игрок не найден" });
  // Аватар — это base64 dataURL (десятки тысяч символов). sanitize с лимитом
  // 500 обрезал dataURL до мусора, из-за чего картинка не грузилась после
  // перезахода. Поднимаем лимит до ~3 МБ символов (небольшой PNG в base64).
  acc.avatar = sanitize(req.body.avatar || "", 3_000_000);
  await redisAccounts.set(req.userId, acc);
  res.json({ ok: true, avatar: acc.avatar });
});

// ????? ??????? ?? ???? — ???????? ?? ???? ?????????????????? (?? ?????? ??????)
app.get("/auth/search", async (req, res) => {
  const q = (req.query.q || "").trim();
  if (q.length < 2) return res.json({ users: [] });

  const limit = Math.min(parseInt(req.query.limit) || 20, 50);
  const results = await redisAccounts.search(q, limit);
  res.json({
    users: results.map(a => ({
      id:       a.id,
      username: a.username,
      telegram: a.telegram,
      role:     a.role || "user",
    }))
  });
});

app.get("/health", (_, res) => res.json({ ok: true, tickets: tickets.size, ws: wsClients.size }));

const authCodes = new Map();

app.post("/auth/create-code", (req, res) => {
  const code = Math.random().toString(36).slice(2, 8).toUpperCase();
  authCodes.set(code, { confirmed: false, tgUser: null, createdAt: Date.now() });
  for (const [k, v] of authCodes.entries()) { if (Date.now() - v.createdAt > 600_000) authCodes.delete(k); }
  res.json({ code });
});

app.get("/auth/check-code", (req, res) => {
  const entry = authCodes.get(req.query.code);
  if (!entry) return res.json({ confirmed: false });
  res.json({ confirmed: entry.confirmed, tgUser: entry.tgUser || null });
});

app.get("/user/search", async (req, res) => {
  const q = (req.query.nick || "").toLowerCase();
  const found = [...redisAccounts._map.values()].find(a => (a.username || "").toLowerCase() === q);
  res.json(found ? { found: true, id: found.id, username: found.username } : { found: false });
});

app.get("/online", requireAuth, (_, res) => {
  res.json({ users: [...wsClients.values()].filter(c => c.userId && c.username).map(c => ({ id: c.userId, username: c.username })) });
});

app.get("/support/tickets", requireAuth, (req, res) => {
  const list = [...tickets.values()].map(t => ({ id: t.id, category: t.category, username: t.username, status: t.status, createdAt: t.createdAt, preview: t.preview, unread: t.unread || 0 }));
  res.json({ tickets: list.sort((a, b) => b.createdAt - a.createdAt) });
});

app.get("/support/ticket/:id", requireAuth, (req, res) => {
  const t = tickets.get(Number(req.params.id));
  if (!t) return res.status(404).json({ message: "Тикет не найден" });
  res.json(t);
});

app.post("/support/ticket", (req, res) => {
  const rawCategory = sanitize(req.body.category || "", 80);
  const rawMessage  = sanitize(req.body.message  || "", 2000);
  const rawUsername = sanitize(req.body.username || "Player", 32);
  const userId      = sanitize(req.body.userId || "anon", 64);
  if (!rawCategory || !rawMessage || rawMessage.length < 5)
    return res.status(400).json({ message: "Заполните все поля (минимум 5 символов)" });
  const ticketId = ++ticketCounter;
  const ticket = { id: ticketId, userId, username: rawUsername, category: rawCategory, preview: rawMessage.slice(0, 60), status: "open", unread: 0, createdAt: Date.now(), messages: [
    { id: uuidv4(), from: "system", text: `Тикет #${ticketId} создан.`, time: Date.now() },
    { id: uuidv4(), from: userId, username: rawUsername, text: rawMessage, time: Date.now() },
  ]};
  tickets.set(ticketId, ticket);
  saveTicket(ticket);
  broadcastToAdmins({ type: "new_ticket", ticket: ticketSummary(ticket) });
  res.json({ ticketId });
});

// ─── Admin API ────────────────────────────────────────────────────────────────

// При старте принудительно ставим роль admin всем из ADMIN_TG_IDS
async function syncAdminRoles() {
  for (const tgId of ADMIN_TG_IDS) {
    const acc = await redisAccounts.get(tgId);
    if (acc && acc.role !== "admin") {
      acc.role = "admin";
      await redisAccounts.set(tgId, acc);
      console.log(`[admin] promoted ${tgId} (${acc.username}) to admin`);
    }
  }
}
syncAdminRoles().catch(e => console.error("[admin] syncAdminRoles:", e.message));

async function requireAdmin(req, res) {
  const token = (req.headers.authorization || "").replace("Bearer ", "");
  const payload = verifyToken(token);
  if (!payload) { res.status(401).json({ message: "Unauthorized" }); return null; }
  const tgId = payload.sub;
  // Жёстко вшитые ID всегда пропускаем
  if (isAdminId(tgId)) return tgId;
  // Иначе проверяем роль в Redis
  const acc = await redisAccounts.get(tgId);
  if (!acc || acc.role !== "admin") { res.status(403).json({ message: "Forbidden" }); return null; }
  return tgId;
}

app.get("/admin/users", async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  const all = await redisAccounts.allValues();
  const allUsers = all.map(a => ({
    id: a.id, username: a.username, telegram: a.telegram,
    balance: a.balance ?? 0, role: a.role, createdAt: a.createdAt,
  })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const page = parseInt(req.query.page) || 1;
  const limit = 50;
  const offset = (page - 1) * limit;
  const users = allUsers.slice(offset, offset + limit);
  res.json({ users, total: allUsers.length, page, limit });
});

app.post("/admin/set-role", async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  const { userId, role } = req.body;
  if (!userId || !["admin", "user"].includes(role)) return res.status(400).json({ message: "Bad request" });
  const acc = await redisAccounts.get(String(userId));
  if (!acc) return res.status(404).json({ message: "User not found" });
  acc.role = role;
  await redisAccounts.set(String(userId), acc);
  res.json({ ok: true });
});

app.post("/admin/set-balance", async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  const { userId, balance } = req.body;
  if (!userId || typeof balance !== "number") return res.status(400).json({ message: "Bad request" });
  const acc = await redisAccounts.get(String(userId));
  if (!acc) return res.status(404).json({ message: "User not found" });
  acc.balance = balance;
  await redisAccounts.set(String(userId), acc);
  sendToUser(String(userId), { type: "balance_update", balance });
  res.json({ ok: true, balance });
});

app.post("/admin/grant-sbt", async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  const { userId, amount } = req.body;
  if (!userId || typeof amount !== "number" || amount === 0) return res.status(400).json({ message: "Bad request" });
  const acc = await redisAccounts.get(String(userId));
  if (!acc) return res.status(404).json({ message: "User not found" });
  acc.balance = (acc.balance ?? 0) + amount;
  await redisAccounts.set(String(userId), acc);
  sendToUser(String(userId), { type: "balance_update", balance: acc.balance });
  res.json({ ok: true, balance: acc.balance });
});

app.get("/admin/tickets", async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  const all = [...tickets.values()].map(t => ({
    id: t.id, category: t.category, username: t.username,
    status: t.status, createdAt: t.createdAt, preview: t.preview,
    unread: t.unread || 0, userId: t.userId,
  })).sort((a, b) => b.createdAt - a.createdAt);
  const page = parseInt(req.query.page) || 1;
  const limit = 50;
  const offset = (page - 1) * limit;
  const tickets_list = all.slice(offset, offset + limit);
  res.json({ tickets: tickets_list, total: all.length, page, limit });
});

app.post("/admin/ticket/:id/status", async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  const t = tickets.get(Number(req.params.id));
  if (!t) return res.status(404).json({ message: "Not found" });
  const { status } = req.body;
  if (!["open", "in_progress", "answered", "closed"].includes(status)) return res.status(400).json({ message: "Bad status" });
  t.status = status;
  t.messages.push({ id: uuidv4(), from: "system", text: `Статус изменён: ${STATUS_LABELS[status] || status}`, time: Date.now() });
  broadcastToAdmins({ type: "ticket_update", ticket: ticketSummary(t) });
  broadcastToTicket(t.id, null, { type: "ticket_update", ticket: ticketSummary(t) });
  if (status === "closed") broadcastToTicket(t.id, null, { type: "ticket_closed", ticketId: t.id });
  res.json({ ok: true });
});

const STATUS_LABELS = { open: "Открыт", in_progress: "В работе", answered: "Ответили", closed: "Закрыт" };

app.post("/admin/ticket/:id/close", async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  const t = tickets.get(Number(req.params.id));
  if (!t) return res.status(404).json({ message: "Not found" });
  t.status = "closed";
  broadcastToAdmins({ type: "ticket_update", ticket: ticketSummary(t) });
  broadcastToTicket(t.id, null, { type: "ticket_closed", ticketId: t.id });
  res.json({ ok: true });
});

// ─── Payments ─────────────────────────────────────────────────────────────────

const METHOD_NAMES = { card_ru: "Карта МИР", card_ua: "Карта Master/Visa", crypto: "Криптовалюта", sbp: "СБП" };

app.post("/payments/create", async (req, res) => {
  const token  = (req.headers.authorization || "").replace("Bearer ", "");
  const amount = parseInt(req.body.amount, 10);
  const method = req.body.method || "card_ru";
  if (!amount || amount < 50) return res.status(400).json({ message: "Минимальная сумма — 50 СБТ" });
  let userId = null;
  if (token) { const p = verifyToken(token); if (p) userId = p.sub; }
  const invoiceId = invoiceCounter++;
  invoices.set(invoiceId, { userId, amount, method, createdAt: Date.now(), status: "pending" });
  res.json({ url: `https://t.me/${BOT_USERNAME}?start=pay_${invoiceId}_${amount}_${method}` });
});

// ─── Auth middleware ───────────────────────────────────────────────────────────
async function optionalAuth(req, _res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  const payload = token ? verifyToken(token) : null;
  req.userId = null;
  if (payload?.sub) {
    const acc = await redisAccounts.get(payload.sub);
    if (acc && (acc.tokenVersion || 0) === (payload.ver || 0)) {
      req.userId = payload.sub;
    }
  }
  next();
}
async function requireAuth(req, res, next) {
  await optionalAuth(req, res, () => {});
  if (!req.userId) return res.status(401).json({ message: "Необходима авторизация" });
  const _banAcc = await redisAccounts.get(req.userId);
  if (_banAcc && _banAcc.banned) return res.status(403).json({ message: "Аккаунт заблокирован", banned: true });
  next();
}

// ─── Shop Catalog ─────────────────────────────────────────────────────────────
const SHOP_CATALOG = [
  { id: "frame_basic_gray",  type: "frame",    name: "Torn",                  price: 0,    preview: "#6b7280" },
  { id: "badge_heart",       type: "badge",    name: "Сердце",                price: 0,    preview: "#f43f5e" },
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

// ─── Shop catalog (Redis-backed, namespace shop:*) ────────────────────────────
// Каталог хранится в Redis: каждый товар отдельным ключом shop:<id>. Это даёт
// O(1) lookup по id (buy/equip) и атомарные обновления одного товара без
// перезаписи всего массива. Админка сайта управляет каталогом через
// /admin/shop/items (CRUD) + /admin/shop/items/:id/image (multer upload).
// /api/inventory/catalog отдаёт только active-товары из того же источника,
// поэтому правки админа сразу видны в лаунчере.

const SHOP_IMG_DIR = "/opt/sbgames/shop-images";
app.use("/shop-images", express.static(SHOP_IMG_DIR, { maxAge: "7d", etag: true, lastModified: true }));

const shopItems = new Map(); // id -> item object
async function loadShopItems() {
  try {
    const stream = redis.scanStream({ match: "shop:*", count: 200 });
    for await (const keys of stream) {
      for (const k of keys) {
        const v = await redis.get(k);
        if (v) {
          const id = k.replace("shop:", "");
          try { shopItems.set(id, JSON.parse(v)); } catch {}
        }
      }
    }
    console.log(`[shop] loaded ${shopItems.size} items from redis`);
  } catch (e) { console.warn("[shop] load failed:", e.message); }
}
async function saveShopItem(item) {
  shopItems.set(item.id, item);
  try { await redis.set(`shop:${item.id}`, JSON.stringify(item)); } catch {}
}
async function deleteShopItem(id) {
  shopItems.delete(id);
  try { await redis.del(`shop:${id}`); } catch {}
}
function getShopItem(id) { return shopItems.get(id); }
function getActiveShopItems() {
  return [...shopItems.values()].filter(i => i.active !== false);
}

// Multer для upload картинок товаров: filename = <id>.<ext>
const multer = require("multer");
const shopUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, SHOP_IMG_DIR),
    filename: (req, file, cb) => {
      const ext = (file.originalname.split(".").pop() || "jpg").toLowerCase();
      cb(null, `${req.params.id}.${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /^(image\/jpeg|image\/png|image\/webp)$/.test(file.mimetype);
    cb(ok ? null : new Error("Только JPEG, PNG, WebP"), ok);
  },
});

// Slugify для генерации человеко-читаемых ID из названия.
function slugify(text) {
  const ru = { "а":"a","б":"b","в":"v","г":"g","д":"d","е":"e","ё":"e","ж":"zh","з":"z","и":"i","й":"y","к":"k","л":"l","м":"m","н":"n","о":"o","п":"p","р":"r","с":"s","т":"t","у":"u","ф":"f","х":"h","ц":"ts","ч":"ch","ш":"sh","щ":"sch","ъ":"","ы":"y","ь":"","э":"e","ю":"yu","я":"ya" };
  return String(text).toLowerCase().split("").map(c => ru[c] || c).join("")
    .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);
}

// ─── Admin: shop item CRUD ───────────────────────────────────────────────────
app.get("/admin/shop/items", requireAuth, async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  const items = [...shopItems.values()].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  res.json({ items });
});

app.post("/admin/shop/items", requireAuth, async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  const { category, subcategory, name, price, preview, description, active, type } = req.body || {};
  if (!name) return res.status(400).json({ message: "Укажите название" });
  const id = slugify(name) + "_" + crypto.randomBytes(2).toString("hex");
  const now = Date.now();
  const item = {
    id,
    category: category || "Разное",
    subcategory: subcategory || "",
    name: String(name).slice(0, 100),
    price: typeof price === "number" ? price : parseInt(price, 10) || 0,
    preview: preview || "#3b82f6",
    image: null,
    description: description || "",
    type: type || "item",
    active: active !== false,
    createdAt: now,
    updatedAt: now,
  };
  await saveShopItem(item);
  res.json({ ok: true, item });
});

app.put("/admin/shop/items/:id", requireAuth, async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  const item = getShopItem(sanitize(req.params.id, 64));
  if (!item) return res.status(404).json({ message: "Товар не найден" });
  const { category, subcategory, name, price, preview, description, active, type } = req.body || {};
  if (category !== undefined) item.category = category;
  if (subcategory !== undefined) item.subcategory = subcategory;
  if (name !== undefined) item.name = String(name).slice(0, 100);
  if (price !== undefined) item.price = typeof price === "number" ? price : parseInt(price, 10) || 0;
  if (preview !== undefined) item.preview = preview;
  if (description !== undefined) item.description = description;
  if (active !== undefined) item.active = !!active;
  if (type !== undefined) item.type = type;
  item.updatedAt = Date.now();
  await saveShopItem(item);
  res.json({ ok: true, item });
});

app.delete("/admin/shop/items/:id", requireAuth, async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  const id = sanitize(req.params.id, 64);
  if (!getShopItem(id)) return res.status(404).json({ message: "Товар не найден" });
  await deleteShopItem(id);
  res.json({ ok: true });
});

app.post("/admin/shop/items/:id/image", requireAuth, shopUpload.single("image"), async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  const id = sanitize(req.params.id, 64);
  const item = getShopItem(id);
  if (!item) return res.status(404).json({ message: "Товар не найден" });
  if (!req.file) return res.status(400).json({ message: "Файл не загружен" });
  // Удаляем предыдущую картинку с другим расширением
  try {
    const newExt = req.file.filename.split(".").pop();
    for (const ext of ["jpg","jpeg","png","webp"]) {
      if (ext === newExt) continue;
      const p2 = require("path").join(SHOP_IMG_DIR, `${id}.${ext}`);
      if (fs.existsSync(p2)) fs.unlinkSync(p2);
    }
  } catch {}
  item.image = `/shop-images/${req.file.filename}?t=${Date.now()}`;
  item.updatedAt = Date.now();
  await saveShopItem(item);
  res.json({ ok: true, image: item.image });
});
// Обработчик ошибок multer (файл слишком большой / неверный тип)
app.use("/admin/shop/items/:id/image", (err, _req, res, _next) => {
  if (err) res.status(400).json({ message: err.message || "Ошибка загрузки" });
});

// ─── Seed: populate shop catalog on first run ────────────────────────────────
async function seedShopItems() {
  if (shopItems.size > 0) { console.log(`[shop] seed skipped (${shopItems.size} items already present)`); return; }
  console.log("[shop] seeding initial catalog...");
  const now = Date.now();
  // [category, subcategory, name, price, previewColor]
  const seed = [
    // ── Предметы ──
    ["Предметы","Кайбер-Кристалл","Красный Кайбер-Кристалл",500,"#ef4444"],
    ["Предметы","Кайбер-Кристалл","Синий Кайбер-Кристалл",350,"#3b82f6"],
    ["Предметы","Кайбер-Кристалл","Зеленый Кайбер-Кристалл",500,"#22c55e"],
    ["Предметы","Кайбер-Кристалл","Фиолетовый Кайбер-Кристалл",1000,"#a855f7"],
    ["Предметы","Кайбер-Кристалл","Желтый Кайбер-Кристалл",500,"#eab308"],
    ["Предметы","Кайбер-Кристалл","Черный Кайбер-Кристалл",1500,"#111827"],
    ["Предметы","Джетпак","Выпадаемый Джетпак",1000,"#0ea5e9"],
    ["Предметы","Джетпак","Не Выпадаемый Джетпак",2500,"#0369a1"],
    ["Предметы","Джампер","Выпадаемый Джампер",500,"#14b8a6"],
    ["Предметы","Джампер","Не выпадаемый Джампер",1250,"#0f766e"],
    ["Предметы","Световые мечи","Двойной синий световой меч",1500,"#3b82f6"],
    ["Предметы","Световые мечи","Двойной зеленый световой меч",1500,"#22c55e"],
    ["Предметы","Световые мечи","Двойной красный световой меч",1500,"#ef4444"],
    ["Предметы","Световые мечи","Двойной световой меч отрекшихся",1500,"#facc15"],
    ["Предметы","Легендарные мечи","Легендарный меч Ситхов",3000,"#dc2626"],
    ["Предметы","Легендарные мечи","Легендарный меч Джедаев",3000,"#22c55e"],
    ["Предметы","Легендарные мечи","Легендарный меч Отрекшихся",3000,"#facc15"],
    ["Предметы","Легендарные мечи","Темный световой меч",4000,"#1f2937"],
    ["Предметы","Апгрейд","Предмет апгрейда 1 lvl",100,"#64748b"],
    ["Предметы","Апгрейд","Предмет апгрейда 2 lvl",200,"#475569"],
    ["Предметы","Жетоны и артефакты","Фракционный жетон Джедаев",250,"#22c55e"],
    ["Предметы","Жетоны и артефакты","Фракционный жетон Ситхов",250,"#ef4444"],
    ["Предметы","Жетоны и артефакты","Фракционный жетон Отрекшихся",250,"#facc15"],
    ["Предметы","Жетоны и артефакты","Древний артефакт Джедаев",500,"#16a34a"],
    ["Предметы","Жетоны и артефакты","Древний артефакт Ситхов",500,"#b91c1c"],
    ["Предметы","Жетоны и артефакты","Древний артефакт Отрекшихся",500,"#ca8a04"],
    ["Предметы","Крафт","Универсальный сплав",100,"#94a3b8"],
    ["Предметы","Крафт","Энергетический конденсатор",150,"#06b6d4"],
    ["Предметы","Крафт","Энергетический стабилизатор",150,"#0891b2"],
    ["Предметы","Крафт","Фокусирующая линза",150,"#0ea5e9"],
    ["Предметы","Крафт","Плазменное ядро",150,"#f97316"],
    ["Предметы","Крафт","Рукоять светового меча",150,"#a78bfa"],
    ["Предметы","Крафт","Улучшенная рукоять светового меча",500,"#7c3aed"],
    ["Предметы","Свитки и карты","Фрагмент древней карты",100,"#d97706"],
    ["Предметы","Свитки и карты","Свиток техники Силы",250,"#c026d3"],
    ["Предметы","Здоровье","Стимпак",25,"#ef4444"],
    // ── Дроиды и компаньоны ──
    ["Дроиды и компаньоны","Дроиды","Дроид 1",1000,"#64748b"],
    ["Дроиды и компаньоны","Дроиды","Дроид 2",1000,"#64748b"],
    ["Дроиды и компаньоны","Дроиды","Дроид 3",1000,"#64748b"],
    ["Дроиды и компаньоны","Дроиды","Дроид 4",1000,"#64748b"],
    ["Дроиды и компаньоны","Компаньоны","Компаньон 1",1000,"#8b5cf6"],
    ["Дроиды и компаньоны","Компаньоны","Компаньон 2",1000,"#8b5cf6"],
    ["Дроиды и компаньоны","Компаньоны","Компаньон 3",1000,"#8b5cf6"],
    ["Дроиды и компаньоны","Компаньоны","Компаньон 4",1000,"#8b5cf6"],
    // ── Кредиты ──
    ["Кредиты","Кредиты","1000 кредитов",100,"#eab308"],
    ["Кредиты","Кредиты","5000 кредитов",500,"#eab308"],
    ["Кредиты","Кредиты","10000 кредитов",1000,"#eab308"],
    ["Кредиты","Кредиты","25000 кредитов",2000,"#eab308"],
    ["Кредиты","Кредиты","50000 кредитов",3500,"#eab308"],
    ["Кредиты","Кредиты","100000 кредитов",6000,"#eab308"],
    ["Кредиты","Премиум","Премиальный кредит",250,"#f59e0b"],
    // ── Battle Pass ──
    ["Battle Pass","Пропуск","Пропуск Battle Pass",750,"#3b82f6"],
    ["Battle Pass","Уровни","+5 уровней к Battle Pass",250,"#60a5fa"],
    ["Battle Pass","Уровни","+10 уровней к Battle Pass",500,"#60a5fa"],
    ["Battle Pass","Daily Rewards","Разблокировка Special DailyRewards",500,"#06b6d4"],
    // ── Охота за головами ──
    ["Охота за головами","Контракты","Количество контрактов +1",250,"#dc2626"],
    ["Охота за головами","Награды","Увеличенная награда",500,"#b91c1c"],
    // ── Жильё и Космолет ──
    ["Жильё и Космолет","Жильё","Готовое жильё 1 уровня",500,"#84cc16"],
    ["Жильё и Космолет","Жильё","Готовое жильё 2 уровня",1000,"#65a30d"],
    ["Жильё и Космолет","Жильё","Готовое жильё 3 уровня",1500,"#4d7c0f"],
    ["Жильё и Космолет","Жильё","+5 слотов к хранилищу",250,"#a3e635"],
    ["Жильё и Космолет","Жильё","+10 слотов к хранилищу",400,"#bef264"],
    ["Жильё и Космолет","Космолет","Корабль 1 уровня",300,"#6366f1"],
    ["Жильё и Космолет","Космолет","Корабль 2 уровня",600,"#4f46d5"],
    ["Жильё и Космолет","Космолет","Корабль 3 уровня",900,"#4338ca"],
    ["Жильё и Космолет","Космолет","Топливо для корабля",50,"#818cf8"],
    ["Жильё и Космолет","Космолет","+5 слотов к хранилищу",350,"#a5b4fc"],
    ["Жильё и Космолет","Космолет","+10 слотов к хранилищу",600,"#c7d2fe"],
    ["Жильё и Космолет","Космолет","Перелеты без расходов",350,"#e0e7ff"],
    ["Жильё и Космолет","Декор","Набор декора 1",300,"#f472b6"],
    ["Жильё и Космолет","Декор","Набор декора 2",300,"#ec4899"],
    ["Жильё и Космолет","Декор","Набор декора 3",300,"#db2777"],
    ["Жильё и Космолет","Декор","Стол для крафтов",100,"#f9a8d4"],
    // ── Ключи и кейсы ──
    ["Ключи и кейсы","Кейсы","Кейс Кукол",50,"#fb923c"],
    ["Ключи и кейсы","Кейсы","Кейс Мечей",100,"#f97316"],
    ["Ключи и кейсы","Кейсы","Кейс Джетпака",500,"#ea580c"],
    ["Ключи и кейсы","Кейсы","Кейс улучшений",50,"#c2410c"],
    ["Ключи и кейсы","Кейсы","Кейс Крафтов",50,"#9a3412"],
    ["Ключи и кейсы","Кейсы","Кейс Жилища",50,"#7c2d12"],
    ["Ключи и кейсы","Ключи","Ключ для кейса Кукол",250,"#fbbf24"],
    ["Ключи и кейсы","Ключи","Ключ для кейса Мечей",350,"#f59e0b"],
    ["Ключи и кейсы","Ключи","Ключ для кейса Джетпака",200,"#d97706"],
    ["Ключи и кейсы","Ключи","Ключ для кейса улучшений",200,"#b45309"],
    ["Ключи и кейсы","Ключи","Ключ для кейса Крафтов",100,"#92400e"],
    ["Ключи и кейсы","Ключи","Ключ для кейса Жилища",250,"#78350f"],
    // ── Турниры и Лига ──
    ["Турниры и Лига","Лига","Улучшенный пропуск на лигу",1000,"#a855f7"],
    ["Турниры и Лига","Турнир","Улучшенный пропуск на турнир",500,"#9333ea"],
    // ── Кастомизация ──
    ["Кастомизация","Титулы","Титул (базовый)",250,"#e879f9"],
    ["Кастомизация","Титулы","Титул (премиум)",1000,"#c026d3"],
    ["Кастомизация","Эффекты","Эффект (базовый)",250,"#f0abfc"],
    ["Кастомизация","Эффекты","Эффект (премиум)",1000,"#e879f9"],
    // ── Наборы ──
    ["Наборы","Наборы","Набор Падавана",500,"#3b82f6"],
    ["Наборы","Наборы","Набор Мастера",1000,"#6366f1"],
    ["Наборы","Наборы","Набор Легенды",2000,"#8b5cf6"],
    ["Наборы","Наборы","Набор Мифа",5000,"#a855f7"],
  ];
  let count = 0;
  for (const [category, subcategory, name, price, preview] of seed) {
    const id = slugify(name) + "_" + crypto.randomBytes(2).toString("hex");
    const item = {
      id, category, subcategory, name, price, preview,
      image: null, description: "", type: "item", active: true,
      createdAt: now + count, updatedAt: now + count,
    };
    await saveShopItem(item);
    count++;
  }
  console.log(`[shop] seeded ${count} items`);
}

// Всегда загружаем косметические предметы из фронтенд-каталога (рамки, фоны, бейджи, анимации).
// Они НЕ хранятся в Redis и не проходят через seed — добавляются в память при старте.
function loadCosmeticItems() {
  const now = Date.now();
  const COSMETIC_ITEMS = [
    // Рамки
    { id: "frame_basic_gray",  type: "frame",  name: "Torn",            price: 0,    color: "#6b7280",  rarity: "common" },
    { id: "frame_basic_blue",  type: "frame",  name: "Sketched Memory", price: 200,  color: "#3b82f6",  rarity: "common" },
    { id: "frame_neon",        type: "frame",  name: "Bewitching Frame",price: 500,  color: "#a855f7",  rarity: "rare" },
    { id: "frame_gold",        type: "frame",  name: "Oil",             price: 1500, color: "#facc15",  rarity: "epic" },
    { id: "frame_galaxy",      type: "frame",  name: "Элли у окна",     price: 3000, color: "#818cf8",  rarity: "legendary" },
    { id: "frame_fire",        type: "frame",  name: "Husk Frame",      price: 2000, color: "#f97316",  rarity: "epic" },
    // Фоны
    { id: "bg_fon1",  type: "background", name: "Фон 1",  price: 0,    color: "#3b82f6", rarity: "common" },
    { id: "bg_fon2",  type: "background", name: "Фон 2",  price: 500,  color: "#8b5cf6", rarity: "rare" },
    { id: "bg_fon3",  type: "background", name: "Фон 3",  price: 800,  color: "#ec4899", rarity: "rare" },
    { id: "bg_fon4",  type: "background", name: "Фон 4",  price: 1200, color: "#f97316", rarity: "epic" },
    { id: "bg_fon5",  type: "background", name: "Фон 5",  price: 1500, color: "#eab308", rarity: "epic" },
    { id: "bg_fon6",  type: "background", name: "Фон 6",  price: 2000, color: "#22c55e", rarity: "legendary" },
    { id: "bg_fon7",  type: "background", name: "Фон 7",  price: 2500, color: "#06b6d4", rarity: "legendary" },
    { id: "bg_fon8",  type: "background", name: "Фон 8",  price: 600,  color: "#f43f5e", rarity: "rare" },
    { id: "bg_fon9",  type: "background", name: "Фон 9",  price: 700,  color: "#8b5cf6", rarity: "rare" },
    { id: "bg_fon10", type: "background", name: "Фон 10", price: 900,  color: "#ec4899", rarity: "rare" },
    { id: "bg_fon12", type: "background", name: "Фон 12", price: 1300, color: "#eab308", rarity: "epic" },
    { id: "bg_fon13", type: "background", name: "Фон 13", price: 1500, color: "#22c55e", rarity: "epic" },
    { id: "bg_fon14", type: "background", name: "Фон 14", price: 1800, color: "#06b6d4", rarity: "epic" },
    { id: "bg_fon15", type: "background", name: "Фон 15", price: 2000, color: "#818cf8", rarity: "epic" },
    // Анимации аватара
    { id: "anim_pulse", type: "avatar_animated", name: "Импульс", price: 1200, color: "#60a5fa", rarity: "epic" },
    { id: "anim_flame", type: "avatar_animated", name: "Пламя",   price: 1200, color: "#f97316", rarity: "epic" },
    { id: "anim_neon",  type: "avatar_animated", name: "Неон",    price: 1500, color: "#a855f7", rarity: "legendary" },
    // Бейджи
    { id: "badge_cross",    type: "badge", name: "Cross",    price: 0,   color: "#f43f5e", rarity: "common" },
    { id: "badge_glitch",   type: "badge", name: "Glitch",   price: 500, color: "#64748b", rarity: "rare" },
    { id: "badge_toxic",    type: "badge", name: "Toxic",    price: 500, color: "#84cc16", rarity: "rare" },
    { id: "badge_sans",     type: "badge", name: "Sans",     price: 500, color: "#ef4444", rarity: "rare" },
    { id: "badge_panic",    type: "badge", name: "Panic",    price: 500, color: "#fbbf24", rarity: "rare" },
    { id: "badge_hollow",   type: "badge", name: "Hollow",   price: 500, color: "#e2e8f0", rarity: "rare" },
    { id: "badge_horned",   type: "badge", name: "Horned",   price: 500, color: "#334155", rarity: "rare" },
    { id: "badge_void",     type: "badge", name: "Void",     price: 500, color: "#94a3b8", rarity: "rare" },
    { id: "badge_trigger",  type: "badge", name: "Trigger",  price: 500, color: "#f97316", rarity: "rare" },
    { id: "badge_creeper",  type: "badge", name: "Creeper",  price: 500, color: "#22c55e", rarity: "rare" },
    { id: "badge_voodoo",   type: "badge", name: "Voodoo",   price: 500, color: "#a855f7", rarity: "rare" },
  ];
  for (const ci of COSMETIC_ITEMS) {
    if (!shopItems.has(ci.id)) {
      shopItems.set(ci.id, { ...ci, category: "Косметика", subcategory: ci.type, image: null, description: "", active: true, createdAt: now, updatedAt: now });
    }
  }
  console.log(`[shop] loaded ${COSMETIC_ITEMS.length} cosmetic items from frontend catalog`);
}

// ─── Public profile ───────────────────────────────────────────────────────────
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
    avatar: acc.avatar || null,
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

// ─── Profile comments ─────────────────────────────────────────────────────────
const profileComments = new Map();
const lastCommentAt   = new Map();
const commentHourly   = new Map();

function wsClientsByUserId(uid) {
  for (const c of wsClients.values()) if (c.userId === uid) return c;
  return null;
}

app.get("/api/user/:id/comments", (req, res) => {
  const list = profileComments.get(sanitize(req.params.id, 64)) || [];
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
  if (hourly.length >= 5) return res.status(429).json({ message: "Слишком много комментариев" });
  lastCommentAt.set(req.userId, now);
  commentHourly.set(req.userId, [...hourly, now]);
  let fromUsername = "Player";
  const ws = wsClientsByUserId(req.userId);
  if (ws?.username) fromUsername = ws.username;
  else { for (const acc of redisAccounts._map.values()) if (acc.id === req.userId) { fromUsername = acc.username; break; } }
  const list = profileComments.get(id) || [];
  const c = { id: uuidv4(), fromId: req.userId, fromUsername, text, time: now };
  list.push(c);
  profileComments.set(id, list.slice(-200));
  saveComment(id, c);
  sendToUser(id, { type: "profile_comment", userId: id, comment: c });
  res.json({ ok: true, comment: c });
});

app.delete("/api/user/:id/comments/:cid", requireAuth, async (req, res) => {
  const targetId = sanitize(req.params.id, 64);
  const cid = sanitize(req.params.cid, 64);
  const list = profileComments.get(targetId) || [];
  const idx = list.findIndex(c => c.id === cid);
  if (idx === -1) return res.status(404).json({ message: "Comment not found" });
  const c = list[idx];
  if (c.fromId !== req.userId) return res.status(403).json({ message: "Not your comment" });
  list.splice(idx, 1);
  profileComments.set(targetId, list);
  try { await redis.del(`sbgames:comments:` + targetId); for (const item of list) await redis.rpush(`sbgames:comments:` + targetId, JSON.stringify(item)); } catch {}
  res.json({ ok: true });
});

// ─── Bio ──────────────────────────────────────────────────────────────────────
app.get("/api/user/bio", requireAuth, async (req, res) => {
  const acc = await redisAccounts.get(req.userId);
  res.json({ bio: acc?.bio || "" });
});

app.put("/api/user/bio", requireAuth, async (req, res) => {
  const bio = sanitize(req.body.bio || "", 300);
  const acc = await redisAccounts.get(req.userId);
  if (!acc) return res.status(404).json({ message: "Игрок не найден" });
  acc.bio = bio;
  await redisAccounts.set(req.userId, acc);
  res.json({ ok: true, bio: acc.bio });
});

// ─── Inventory ────────────────────────────────────────────────────────────────
app.get("/api/inventory/catalog", (_req, res) => res.json({ items: getActiveShopItems() }));

app.get("/api/inventory", requireAuth, async (req, res) => {
  const acc = await redisAccounts.get(req.userId);
  const owned = Array.isArray(acc?.inventory) ? [...new Set(acc.inventory)] : [];
  const marketOwn = Array.isArray(acc?.market_inventory) ? [...new Set(acc.market_inventory)] : [];
  const equip = acc?.equip && typeof acc.equip === "object" ? acc.equip : {};
  res.json({ owned, market: marketOwn, equip, catalog: getActiveShopItems(), marketCatalog: MARKET_CATALOG });
});

app.post("/api/inventory/buy", requireAuth, async (req, res) => {
  const itemId = sanitize(req.body.itemId || "", 64);
  const item = getShopItem(itemId);
  if (!item || item.active === false) return res.status(404).json({ message: "Предмет не найден" });
  // Проверка + списание + выдача предмета — одной атомарной мутацией.
  const r = await redisAccounts.mutate(req.userId, (acc) => {
    if (!acc) return { ok: false, error: "Игрок не найден" };
    const owned = Array.isArray(acc.inventory) ? acc.inventory : [];
    if (owned.includes(itemId)) return { ok: false, error: "Уже куплено" };
    const admin = isAdmin(acc.username);
    if (!admin && (acc.balance || 0) < item.price) return { ok: false, error: "Недостаточно СБТ" };
    if (!admin) acc.balance = (acc.balance || 0) - item.price;
    acc.inventory = [...owned, itemId];
    return { ok: true, value: acc };
  });
  if (!r.ok) return res.status(400).json({ message: r.error });
  res.json({ ok: true, balance: r.value.balance, inventory: r.value.inventory });
});

app.post("/api/inventory/equip", requireAuth, async (req, res) => {
  const itemId = sanitize(req.body.itemId || "", 64);
  const acc = await redisAccounts.get(req.userId);
  if (!acc) return res.status(404).json({ message: "Игрок не найден" });
  const owned = Array.isArray(acc.inventory) ? acc.inventory : [];
  const item = getShopItem(itemId);
  if (!item) return res.status(404).json({ message: "Предмет не найден" });
  if (!owned.includes(itemId)) {
    if (isAdmin(acc.username) || acc.role === "admin") { acc.inventory = [...new Set([...owned, itemId])]; }
    else return res.status(400).json({ message: "Сначала купи предмет" });
  }
  acc.equip = { ...(acc.equip || {}), [item.type]: itemId };
  await redisAccounts.set(req.userId, acc);
  res.json({ ok: true, equip: acc.equip });
});

app.post("/api/inventory/unequip", requireAuth, async (req, res) => {
  const type = sanitize(req.body.type || "", 32);
  if (!["frame","background","avatar_animated","badge"].includes(type)) return res.status(400).json({ message: "Неверный тип" });
  const acc = await redisAccounts.get(req.userId);
  if (!acc) return res.status(404).json({ message: "Игрок не найден" });
  acc.equip = { ...(acc.equip || {}) };
  delete acc.equip[type];
  await redisAccounts.set(req.userId, acc);
  res.json({ ok: true, equip: acc.equip });
});

// ─── Activity ─────────────────────────────────────────────────────────────────
const activityStore = new Map();

app.post("/api/activity", requireAuth, (req, res) => {
  const { serverId, startedAt, endedAt, durationSec } = req.body || {};
  if (!serverId || typeof startedAt !== "number" || typeof endedAt !== "number") return res.status(400).json({ message: "Неверные поля" });
  const dur = Math.max(0, Math.min(86400, Math.floor(durationSec || (endedAt - startedAt) / 1000)));
  const list = activityStore.get(req.userId) || [];
  list.push({ serverId: sanitize(serverId, 32), startedAt, endedAt, durationSec: dur });
  activityStore.set(req.userId, list.slice(-200));
  res.json({ ok: true });
});

app.get("/api/activity", requireAuth, (req, res) => {
  const list = activityStore.get(req.userId) || [];
  const byServer = {};
  let totalSec = 0, lastSession = null;
  for (const s of list) {
    byServer[s.serverId] = (byServer[s.serverId] || 0) + s.durationSec;
    totalSec += s.durationSec;
    if (!lastSession || s.endedAt > lastSession) lastSession = s.endedAt;
  }
  res.json({ totalSec, byServer, lastSessionAt: lastSession || null, recent: list.slice(-10).reverse() });
});

// ─── Marketplace ──────────────────────────────────────────────────────────────
const listings = new Map();
let listingCounter = 0;

function publicListing(l) {
  return { id: l.id, itemId: l.itemId, itemType: l.itemType, name: l.name, preview: l.preview, price: l.price, sellerId: l.sellerId, sellerName: l.sellerName, createdAt: l.createdAt, status: l.status };
}

app.get("/api/market/listings", (req, res) => {
  const type = req.query.type ? sanitize(String(req.query.type), 32) : null;
  const out = [...listings.values()].filter(l => l.status === "active").filter(l => !type || l.itemType === type).sort((a, b) => b.createdAt - a.createdAt).map(publicListing);
  res.json({ listings: out });
});

app.get("/api/market/my", requireAuth, (req, res) => {
  const out = [...listings.values()].filter(l => l.sellerId === req.userId).sort((a, b) => b.createdAt - a.createdAt).map(publicListing);
  res.json({ listings: out });
});

app.get("/api/market/catalog", (_req, res) => res.json({ items: MARKET_CATALOG }));

app.post("/api/market/grant", requireAuth, async (req, res) => {
  const acc = await redisAccounts.get(req.userId);
  if (!acc || acc.role !== "admin") return res.status(403).json({ message: "Только админ" });
  const targetId = sanitize(req.body.userId || "", 64);
  const itemId = sanitize(req.body.itemId || "", 64);
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
  if (!Number.isFinite(priceNum) || priceNum < 10 || priceNum > 100000) return res.status(400).json({ message: "Цена: 10–100000 СБТ" });
  const acc = await redisAccounts.get(req.userId);
  if (!acc) return res.status(404).json({ message: "Игрок не найден" });
  const marketOwn = Array.isArray(acc.market_inventory) ? acc.market_inventory : [];
  const invOwn = Array.isArray(acc.inventory) ? acc.inventory : [];
  const fromMarket = marketOwn.includes(cleanId);
  const fromInventory = !fromMarket && invOwn.includes(cleanId);
  if (!fromMarket && !fromInventory) return res.status(400).json({ message: "Нет этого предмета" });
  const item = MARKET_CATALOG.find(i => i.id === cleanId) || getShopItem(cleanId);
  if (!item) return res.status(404).json({ message: "Предмет не найден" });
  const hasActive = [...listings.values()].some(l => l.status === "active" && l.sellerId === req.userId && l.itemId === cleanId);
  if (hasActive) return res.status(400).json({ message: "Уже выставлен" });
  if (fromMarket) {
    acc.market_inventory = marketOwn.filter(x => x !== cleanId);
  } else {
    acc.inventory = invOwn.filter(x => x !== cleanId);
    if (acc.equip && typeof acc.equip === "object") {
      for (const [slot, equipped] of Object.entries(acc.equip)) {
        if (equipped === cleanId) delete acc.equip[slot];
      }
    }
  }
  await redisAccounts.set(req.userId, acc);
  const id = String(++listingCounter);
  const preview = item.preview || item.image || "#888";
  const listing = { id, itemId: cleanId, itemType: item.type || "item", name: item.name || cleanId, preview, price: priceNum, sellerId: req.userId, sellerName: acc.username, createdAt: Date.now(), status: "active" };
  listings.set(id, listing);
  saveListing(listing);
  res.json({ ok: true, listing: publicListing(listing) });
});

app.post("/api/market/buy/:id", requireAuth, async (req, res) => {
  const id = sanitize(req.params.id, 32);
  const listing = listings.get(id);
  if (!listing) return res.status(404).json({ message: "Листинг не найден" });
  if (listing.status !== "active") return res.status(400).json({ message: "Уже завершён" });
  if (listing.sellerId === req.userId) return res.status(400).json({ message: "Нельзя купить свой" });
  const seller = await redisAccounts.get(listing.sellerId);
  if (!seller) return res.status(404).json({ message: "Продавец не найден" });
  // Защита от двойной покупки одного листинга: помечаем sold синхронно ДО любых
  // await. Для одного процесса Node этого достаточно (нет точки переключения).
  listing.status = "sold"; listing.soldTo = req.userId; listing.soldAt = Date.now();
  listings.set(id, listing);

  // Комиссия 5% за листинги старше 14 дней удерживается с продавца.
  const fee = (Date.now() - listing.createdAt > 14 * 86400000) ? Math.ceil(listing.price * 0.05) : 0;
  const buyerCost = listing.price - fee;     // покупатель платит цену, fee ему возвращается
  const sellerGain = listing.price - fee;    // продавец получает цену за вычетом комиссии

  // Шаг 1: атомарно списываем у покупателя и выдаём предмет.
  const cosmeticTypes = ["frame", "background", "badge", "avatar_animated"];
  const isCosmetic = cosmeticTypes.includes(listing.itemType);
  const rb = await redisAccounts.mutate(req.userId, (acc) => {
    if (!acc) return { ok: false, error: "Аккаунт не найден" };
    if ((acc.balance || 0) < buyerCost) return { ok: false, error: "Недостаточно СБТ" };
    acc.balance = (acc.balance || 0) - buyerCost;
    if (isCosmetic) {
      acc.inventory = Array.isArray(acc.inventory) ? [...new Set([...acc.inventory, listing.itemId])] : [listing.itemId];
    } else {
      acc.market_inventory = Array.isArray(acc.market_inventory) ? [...acc.market_inventory, listing.itemId] : [listing.itemId];
    }
    return { ok: true, value: acc };
  });
  if (!rb.ok) {
    // откатываем пометку sold — листинг снова активен
    listing.status = "active"; delete listing.soldTo; delete listing.soldAt; listings.set(id, listing);
    return res.status(400).json({ message: rb.error });
  }

  // Шаг 2: атомарно зачисляем продавцу. При сбое — компенсируем покупателю.
  const rsell = await redisAccounts.mutate(listing.sellerId, (acc) => {
    if (!acc) return { ok: false, error: "Продавец не найден" };
    acc.balance = (acc.balance || 0) + sellerGain;
    return { ok: true, value: acc };
  });
  if (!rsell.ok) {
    await redisAccounts.mutate(req.userId, (acc) => {
      if (!acc) return { ok: false, error: "acc gone" };
      acc.balance = (acc.balance || 0) + buyerCost;
      if (isCosmetic) {
        acc.inventory = (Array.isArray(acc.inventory) ? acc.inventory : []).filter(x => x !== listing.itemId);
      } else {
        acc.market_inventory = (Array.isArray(acc.market_inventory) ? acc.market_inventory : []).filter(x => x !== listing.itemId);
      }
      return { ok: true, value: acc };
    });
    listing.status = "active"; delete listing.soldTo; delete listing.soldAt; listings.set(id, listing);
    return res.status(500).json({ message: "Не удалось завершить покупку, попробуй ещё раз" });
  }

  saveListing(listing);
  sendToUser(listing.sellerId, { type: "market_sold", listingId: id, price: listing.price, buyerName: buyer?.username || "" });
  res.json({ ok: true, balance: rb.value.balance, market: rb.value.market_inventory });
});

async function cancelMarketListing(req, res) {
  const id = sanitize(req.params.id, 32);
  const listing = listings.get(id);
  if (!listing) return res.status(404).json({ message: "Листинг не найден" });
  if (listing.sellerId !== req.userId) return res.status(403).json({ message: "Не твой товар" });
  if (listing.status !== "active") return res.status(400).json({ message: "Уже завершён" });

  const cosmeticTypes = ["frame", "background", "badge", "avatar_animated"];
  const isCosmetic = cosmeticTypes.includes(listing.itemType);
  const result = await redisAccounts.mutate(req.userId, (acc) => {
    if (!acc) return { ok: false, error: "Игрок не найден" };
    if (isCosmetic) {
      acc.inventory = Array.isArray(acc.inventory) ? [...new Set([...acc.inventory, listing.itemId])] : [listing.itemId];
    } else {
      acc.market_inventory = Array.isArray(acc.market_inventory) ? [...acc.market_inventory, listing.itemId] : [listing.itemId];
    }
    return { ok: true, value: acc };
  });
  if (!result.ok) return res.status(404).json({ message: result.error });

  listing.status = "cancelled";
  listing.cancelledAt = Date.now();
  listings.set(id, listing);
  saveListing(listing);
  res.json({ ok: true, inventory: result.value.inventory || [], market: result.value.market_inventory || [] });
}

app.delete("/api/market/:id", requireAuth, cancelMarketListing);
app.delete("/api/market/listings/:id", requireAuth, cancelMarketListing);

// ─── Groups ───────────────────────────────────────────────────────────────────
const groups = new Map(), groupMessages = new Map(), groupInvites = new Map();
const groupJoinRequests = new Map(); // groupId -> [{ userId, username, time }]
let groupCounter = 0;
const GROUP_MAX = 8;
const groupVoice = new Map(); // groupId -> Set<userId>

// --- Clan roles -------------------------------------------------------------
// memberRoles: { [userId]: "owner" | "leader" | "elder" | "member" }
const ROLE_OWNER  = "owner";
const ROLE_LEADER = "leader";
const ROLE_ELDER  = "elder";
const ROLE_MEMBER = "member";

function getMemberRole(g, uid) {
  if (uid === g.ownerId) return ROLE_OWNER;
  return g.memberRoles?.[uid] || ROLE_MEMBER;
}
function canKick(g, uid) {
  const r = getMemberRole(g, uid);
  return r === ROLE_OWNER || r === ROLE_LEADER;
}
function canManageRequests(g, uid) {
  const r = getMemberRole(g, uid);
  return r === ROLE_OWNER || r === ROLE_LEADER || r === ROLE_ELDER;
}
function canEditGroup(g, uid) {
  const r = getMemberRole(g, uid);
  return r === ROLE_OWNER || r === ROLE_LEADER;
}

// --- Parties (temporary play sessions) -------------------------------------
const parties      = new Map(); // partyId -> { id, name, leaderId, members: Set<userId>, createdAt }
const userParties  = new Map(); // userId -> Set<partyId>
const partyInvites = new Map(); // userId (invitee) -> [{ partyId, partyName, fromId, fromUsername }]
let partyCounter = 0;

function userPartyIds(uid) {
  if (!userParties.has(uid)) userParties.set(uid, new Set());
  return userParties.get(uid);
}

async function publicParty(p) {
  const memberList = await Promise.all([...p.members].map(async uid => {
    let acc = [...redisAccounts._map.values()].find(a => a && a.id === uid);
    if (!acc) { try { acc = await redisAccounts.get(uid); } catch {} }
    return { id: uid, username: acc?.username || acc?.telegram || uid };
  }));
  return { id: p.id, name: p.name, leaderId: p.leaderId, members: memberList, createdAt: p.createdAt };
}

function disbandParty(partyId) {
  const p = parties.get(partyId);
  if (!p) return;
  for (const uid of p.members) userPartyIds(uid).delete(partyId);
  parties.delete(partyId);
}

async function userPartiesList(uid) {
  return Promise.all([...userPartyIds(uid)].map(id => parties.get(id)).filter(Boolean).map(publicParty));
}


// --- Redis persistence for groups ---------------------------------------------
async function saveGroup(g) {
  try {
    const data = { id: g.id, name: g.name, description: g.description || "", avatar: g.avatar || "", ownerId: g.ownerId, members: [...g.members], memberRoles: g.memberRoles || {}, closed: !!g.closed, playHours: g.playHours || {}, createdAt: g.createdAt };
    await redis.set(`sbgames:group:` + g.id, JSON.stringify(data));
    await redis.sadd("sbgames:group_ids", g.id);
  } catch {}
}
async function deleteGroupFromRedis(gid) {
  try { await redis.del(`sbgames:group:` + gid); await redis.srem("sbgames:group_ids", gid); } catch {}
}
async function loadGroupsFromRedis() {
  try {
    const ids = await redis.smembers("sbgames:group_ids");
    for (const id of ids) {
      const raw = await redis.get(`sbgames:group:` + id);
      if (!raw) continue;
      const d = JSON.parse(raw);
      const g = { id: d.id, name: d.name, description: d.description || "", avatar: d.avatar || "", ownerId: d.ownerId, members: new Set(d.members), memberRoles: d.memberRoles || {}, closed: !!d.closed, playHours: d.playHours || {}, createdAt: d.createdAt };
      groups.set(id, g); groupMessages.set(id, []);
      const numId = parseInt(id, 10);
      if (!isNaN(numId) && numId >= groupCounter) groupCounter = numId + 1;
    }
    console.log(`[groups] loaded ${groups.size} groups from Redis`);
  } catch (e) { console.warn("[groups] failed to load from Redis:", e.message); }
}

// --- Redis persistence for comments -------------------------------------------
async function saveComment(targetId, c) {
  try {
    const key = `sbgames:comments:${targetId}`;
    await redis.rpush(key, JSON.stringify(c));
    await redis.ltrim(key, -200, -1);
  } catch {}
}
async function loadCommentsFromRedis() {
  try {
    // Migrate old RedisMap format (single hash key sbgames:comments) to new per-user keys
    const type = await redis.type("sbgames:comments");
    if (type === "hash") {
      const all = await redis.hgetall("sbgames:comments");
      for (const [userId, jsonVal] of Object.entries(all)) {
        try {
          const arr = JSON.parse(jsonVal);
          if (Array.isArray(arr) && arr.length) {
            profileComments.set(userId, arr);
            for (const c of arr) await redis.rpush(`sbgames:comments:` + userId, JSON.stringify(c));
          }
        } catch {}
      }
      console.log(`[comments] migrated from old hash format`);
    }
    // Load from new per-user keys
    const stream = redis.scanStream({ match: "sbgames:comments:*", count: 100 });
    const keys = [];
    for await (const k of stream) keys.push(...k);
    for (const key of keys) {
      const targetId = key.replace("sbgames:comments:", "");
      if (!targetId) continue;
      const t = await redis.type(key);
      if (t !== "list") continue;
      const list = await redis.lrange(key, 0, -1);
      if (list.length) profileComments.set(targetId, list.map(JSON.parse));
    }
    console.log(`[comments] loaded from Redis`);
  } catch (e) { console.warn("[comments] failed to load from Redis:", e.message); }
}

// --- Redis persistence for DMs ------------------------------------------------
async function saveDM(key, msgs) {
  try { await redis.set(`sbgames:dm:` + key, JSON.stringify(msgs.slice(-200))); } catch {}
}
async function loadDMsFromRedis() {
  try {
    const stream = redis.scanStream({ match: "sbgames:dm:*", count: 100 });
    const keys = [];
    for await (const k of stream) keys.push(...k);
    for (const key of keys) {
      const raw = await redis.get(key);
      if (raw) dms.set(key.replace("sbgames:dm:", ""), JSON.parse(raw));
    }
    console.log(`[dms] loaded from Redis`);
  } catch (e) { console.warn("[dms] failed to load from Redis:", e.message); }
}

// --- Redis persistence for friendships ----------------------------------------
async function saveFriendships(userId) {
  try {
    const set = friendships.get(userId);
    if (set && set.size > 0) {
      await redis.set(`sbgames:friends:` + userId, JSON.stringify([...set]));
    } else {
      await redis.del(`sbgames:friends:` + userId);
    }
  } catch {}
}
async function saveFriendRequests(userId) {
  try {
    const reqs = friendRequests.get(userId);
    if (reqs && reqs.length > 0) {
      await redis.set(`sbgames:friendreqs:` + userId, JSON.stringify(reqs));
    } else {
      await redis.del(`sbgames:friendreqs:` + userId);
    }
  } catch {}
}
async function loadFriendshipsFromRedis() {
  try {
    const stream = redis.scanStream({ match: "sbgames:friends:*", count: 100 });
    const keys = [];
    for await (const k of stream) keys.push(...k);
    for (const key of keys) {
      const userId = key.replace("sbgames:friends:", "");
      const raw = await redis.get(key);
      if (raw) friendships.set(userId, new Set(JSON.parse(raw)));
    }
    console.log(`[friendships] loaded ${friendships.size} users from Redis`);
  } catch (e) { console.warn("[friendships] failed to load:", e.message); }
}
async function loadFriendRequestsFromRedis() {
  try {
    const stream = redis.scanStream({ match: "sbgames:friendreqs:*", count: 100 });
    const keys = [];
    for await (const k of stream) keys.push(...k);
    for (const key of keys) {
      const userId = key.replace("sbgames:friendreqs:", "");
      const raw = await redis.get(key);
      if (raw) friendRequests.set(userId, JSON.parse(raw));
    }
    console.log(`[friendRequests] loaded ${friendRequests.size} users from Redis`);
  } catch (e) { console.warn("[friendRequests] failed to load:", e.message); }
}

// --- Redis persistence for listings -------------------------------------------
async function saveListing(l) {
  try { await redis.set(`sbgames:listing:` + l.id, JSON.stringify(l)); await redis.sadd("sbgames:listing_ids", l.id); } catch {}
}
async function deleteListingFromRedis(id) {
  try { await redis.del(`sbgames:listing:` + id); await redis.srem("sbgames:listing_ids", id); } catch {}
}
async function loadListingsFromRedis() {
  try {
    const ids = await redis.smembers("sbgames:listing_ids");
    for (const id of ids) {
      const raw = await redis.get(`sbgames:listing:` + id);
      if (raw) { const l = JSON.parse(raw); listings.set(id, l); const numId = parseInt(id, 10); if (!isNaN(numId) && numId >= listingCounter) listingCounter = numId + 1; }
    }
    console.log(`[listings] loaded ${listings.size} from Redis`);
  } catch (e) { console.warn("[listings] failed to load:", e.message); }
}

// --- Redis persistence for tickets --------------------------------------------
async function saveTicket(t) {
  try { await redis.set(`sbgames:ticket:` + t.id, JSON.stringify(t)); await redis.sadd("sbgames:ticket_ids", String(t.id)); } catch {}
}
async function loadTicketsFromRedis() {
  try {
    const ids = await redis.smembers("sbgames:ticket_ids");
    for (const id of ids) {
      const raw = await redis.get(`sbgames:ticket:` + id);
      if (raw) { const t = JSON.parse(raw); tickets.set(id, t); const numId = parseInt(id, 10); if (!isNaN(numId) && numId >= ticketCounter) ticketCounter = numId + 1; }
    }
    console.log(`[tickets] loaded ${tickets.size} from Redis`);
  } catch (e) { console.warn("[tickets] failed to load:", e.message); }
}

// --- Redis persistence for groupMessages --------------------------------------
async function saveGroupMessages(gid) {
  try {
    const msgs = groupMessages.get(gid);
    if (msgs && msgs.length > 0) {
      await redis.set(`sbgames:groupmsgs:` + gid, JSON.stringify(msgs));
    }
  } catch {}
}
async function loadGroupMessagesFromRedis() {
  try {
    const stream = redis.scanStream({ match: "sbgames:groupmsgs:*", count: 100 });
    const keys = [];
    for await (const k of stream) keys.push(...k);
    for (const key of keys) {
      const gid = key.replace("sbgames:groupmsgs:", "");
      const raw = await redis.get(key);
      if (raw && groups.has(gid)) groupMessages.set(gid, JSON.parse(raw));
    }
    console.log(`[groupMessages] loaded from Redis`);
  } catch (e) { console.warn("[groupMessages] failed to load:", e.message); }
}

// --- Redis persistence for groupInvites ---------------------------------------
async function saveGroupInvites(gid) {
  try {
    const invs = groupInvites.get(gid);
    if (invs && invs.length > 0) {
      await redis.set(`sbgames:groupinv:` + gid, JSON.stringify(invs));
    } else {
      await redis.del(`sbgames:groupinv:` + gid);
    }
  } catch {}
}
async function loadGroupInvitesFromRedis() {
  try {
    const stream = redis.scanStream({ match: "sbgames:groupinv:*", count: 100 });
    const keys = [];
    for await (const k of stream) keys.push(...k);
    for (const key of keys) {
      const gid = key.replace("sbgames:groupinv:", "");
      const raw = await redis.get(key);
      if (raw && groups.has(gid)) groupInvites.set(gid, JSON.parse(raw));
    }
    console.log(`[groupInvites] loaded from Redis`);
  } catch (e) { console.warn("[groupInvites] failed to load:", e.message); }
}

async function saveGroupJoinRequests(gid) {
  try {
    const reqs = groupJoinRequests.get(gid);
    if (reqs && reqs.length > 0) {
      await redis.set(`sbgames:groupreq:` + gid, JSON.stringify(reqs));
    } else {
      await redis.del(`sbgames:groupreq:` + gid);
    }
  } catch {}
}
async function loadGroupJoinRequestsFromRedis() {
  try {
    const stream = redis.scanStream({ match: "sbgames:groupreq:*", count: 100 });
    const keys = [];
    for await (const k of stream) keys.push(...k);
    for (const key of keys) {
      const gid = key.replace("sbgames:groupreq:", "");
      const raw = await redis.get(key);
      if (raw && groups.has(gid)) groupJoinRequests.set(gid, JSON.parse(raw));
    }
    console.log(`[groupJoinRequests] loaded from Redis`);
  } catch (e) { console.warn("[groupJoinRequests] failed to load:", e.message); }
}

// Load on startup
loadGroupsFromRedis();
loadGroupMessagesFromRedis();
loadGroupInvitesFromRedis();
loadGroupJoinRequestsFromRedis();
loadCommentsFromRedis();
loadDMsFromRedis();
loadFriendshipsFromRedis();
loadFriendRequestsFromRedis();
loadListingsFromRedis();
loadTicketsFromRedis();
// --- Clan Level System -------------------------------------------------------
// Level requirements: { level, minMembers, hoursPerMember }
// To reach level N, at least minMembers must have played >= hoursPerMember each.
const CLAN_LEVELS = [
  { level: 1, minMembers: 0, hoursPerMember: 0 },      // default
  { level: 2, minMembers: 2, hoursPerMember: 3 },       // 2Ч3h = 6h total
  { level: 3, minMembers: 5, hoursPerMember: 5 },       // 5Ч5h = 25h total
  { level: 4, minMembers: 8, hoursPerMember: 8 },       // 8Ч8h = 64h total
  { level: 5, minMembers: 10, hoursPerMember: 10 },     // 10Ч10h = 100h total
  { level: 6, minMembers: 15, hoursPerMember: 15 },     // 15Ч15h = 225h total
  { level: 7, minMembers: 20, hoursPerMember: 20 },     // 20Ч20h = 400h total
];
const CLAN_MAX_LEVEL = CLAN_LEVELS[CLAN_LEVELS.length - 1].level;

function calcClanLevel(g) {
  const ph = g.playHours || {};
  let lvl = 1;
  for (const req of CLAN_LEVELS) {
    if (req.level <= 1) continue;
    const qualified = Object.values(ph).filter(h => h >= req.hoursPerMember).length;
    if (qualified >= req.minMembers) lvl = req.level;
  }
  return lvl;
}

function clanLevelInfo(g) {
  const lvl = calcClanLevel(g);
  const nextReq = CLAN_LEVELS.find(r => r.level === lvl + 1);
  const ph = g.playHours || {};
  const qualified = nextReq ? Object.values(ph).filter(h => h >= nextReq.hoursPerMember).length : 0;
  const progress = nextReq ? Math.min(1, qualified / nextReq.minMembers) : 1;
  return {
    level: lvl,
    maxXp: nextReq ? nextReq.minMembers : 0,
    xp: qualified,
    xpPct: Math.round(progress * 100),
    nextLevel: nextReq ? nextReq.level : null,
    nextMinMembers: nextReq ? nextReq.minMembers : null,
    nextHoursPerMember: nextReq ? nextReq.hoursPerMember : null,
    maxLevel: CLAN_MAX_LEVEL,
    memberHours: Object.fromEntries(Object.entries(ph).map(([k, v]) => [k, Math.round(v * 10) / 10])),
  };
}

async function publicGroup(g) {
  const memberNames = {};
  for (const mid of g.members) {
    let acc = [...redisAccounts._map.values()].find(a => a && a.id === mid);
    if (!acc) {
      try { acc = await redisAccounts.get(mid); } catch {}
      if (acc && !acc.username) acc.username = acc.telegram || mid;
    }
    memberNames[mid] = acc?.username || acc?.telegram || "";
  }
  const li = clanLevelInfo(g);
  return { id: g.id, name: g.name, description: g.description || "", avatar: g.avatar || "", ownerId: g.ownerId, members: [...g.members], memberRoles: g.memberRoles || {}, closed: !!g.closed, memberNames, createdAt: g.createdAt, levelInfo: li };
}

app.get("/api/groups", requireAuth, async (req, res) => {
  const myGroups = [...groups.values()].filter(g => g.members.has(req.userId));
  const pubGroups = await Promise.all(myGroups.map(publicGroup));
  res.json({ groups: pubGroups });
});

app.post("/api/groups", requireAuth, async (req, res) => {
  const name = sanitize(req.body.name || "", 40);
  if (name.length < 2 || name.length > 40) return res.status(400).json({ message: "Название: 2–40 символов" });
  const description = sanitize(req.body.description || "", 200);
  if ([...groups.values()].some(g => g.members.has(req.userId))) {
    return res.status(400).json({ message: "Ты уже состоишь в клане. Покинь его, чтобы создать новый" });
  }
  const id = String(++groupCounter);
  const g = { id, name, description, ownerId: req.userId, members: new Set([req.userId]), memberRoles: {}, closed: false, playHours: {}, createdAt: Date.now() };
  groups.set(id, g); groupMessages.set(id, []);
  saveGroup(g);
  res.json({ ok: true, group: await publicGroup(g) });
});

app.post("/api/groups/:id/invite", requireAuth, (req, res) => {
  const gid = sanitize(req.params.id, 32);
  const g = groups.get(gid);
  if (!g) return res.status(404).json({ message: "Группа не найдена" });
  if (!g.members.has(req.userId)) return res.status(403).json({ message: "Ты не в группе" });
  if (g.members.size >= GROUP_MAX) return res.status(400).json({ message: `Максимум ${GROUP_MAX}` });
  const targetNick = sanitize(req.body.username || "", 32).toLowerCase();
  const target = [...redisAccounts._map.values()].find(a => (a.username || "").toLowerCase() === targetNick);
  if (!target) return res.status(404).json({ message: "Игрок не найден" });
  if (g.members.has(target.id)) return res.status(400).json({ message: "Уже в группе" });
  const list = groupInvites.get(gid) || [];
  if (list.find(i => i.toId === target.id)) return res.status(400).json({ message: "Уже приглашён" });
  const from = wsClientsByUserId(req.userId);
  const invite = { toId: target.id, fromId: req.userId, fromUsername: from?.username || "Player", groupId: gid, groupName: g.name, time: Date.now() };
  list.push(invite); groupInvites.set(gid, list);
  saveGroupInvites(gid);
  sendToUser(target.id, { type: "group_invite", invite });
  res.json({ ok: true });
});

app.post("/api/groups/:id/respond", requireAuth, async (req, res) => {
  const gid = sanitize(req.params.id, 32);
  const g = groups.get(gid);
  if (!g) return res.status(404).json({ message: "Группа не найдена" });
  const accept = !!req.body.accept;
  groupInvites.set(gid, (groupInvites.get(gid) || []).filter(i => i.toId !== req.userId));
  if (accept) {
    if (g.members.size >= GROUP_MAX) return res.status(400).json({ message: "Полная" });
    if ([...groups.values()].some(other => other.id !== gid && other.members.has(req.userId))) {
      return res.status(400).json({ message: "Ты уже состоишь в другом клане" });
    }
    g.members.add(req.userId);
    const pub = await publicGroup(g);
    for (const m of g.members) sendToUser(m, { type: "group_update", group: pub });
  }
  res.json({ ok: true, group: await publicGroup(g) });
});

app.post("/api/groups/:id/leave", requireAuth, async (req, res) => {
  const gid = sanitize(req.params.id, 32);
  const g = groups.get(gid);
  if (!g) return res.status(404).json({ message: "Группа не найдена" });
  if (!g.members.has(req.userId)) return res.status(403).json({ message: "Ты не в группе" });
  g.members.delete(req.userId);
  if (g.members.size === 0) {
    groups.delete(gid); groupMessages.delete(gid); groupInvites.delete(gid); deleteGroupFromRedis(gid);
  } else {
    if (g.ownerId === req.userId) g.ownerId = g.members.values().next().value;
    saveGroup(g);
    const pub = await publicGroup(g);
    for (const m of g.members) sendToUser(m, { type: "group_update", group: pub });
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
  for (const [gid, list] of groupInvites.entries()) for (const inv of list) if (inv.toId === req.userId) out.push({ ...inv, groupId: gid });
  res.json({ invites: out });
});

// --- Clan browse + join requests ----------------------------------------------
// Public clan directory: safe public fields only, no membership required.
app.get("/api/groups/browse", requireAuth, async (req, res) => {
  const out = [];
  for (const g of groups.values()) {
    const pub = await publicGroup(g);
    out.push({
      id: pub.id,
      name: pub.name,
      description: pub.description,
      avatar: pub.avatar,
      levelInfo: pub.levelInfo,
      members: pub.members,
      memberNames: pub.memberNames,
      memberRoles: pub.memberRoles,
      closed: pub.closed,
      memberCount: pub.members.length,
      ownerId: pub.ownerId,
      ownerName: pub.memberNames?.[pub.ownerId] || "",
    });
  }
  out.sort((a, b) => (b.levelInfo?.level || 1) - (a.levelInfo?.level || 1) || b.memberCount - a.memberCount);
  res.json({ groups: out });
});

// Non-member submits a join request. Full block if already in any clan.
app.post("/api/groups/:id/apply", requireAuth, (req, res) => {
  const gid = sanitize(req.params.id, 32);
  const g = groups.get(gid);
  if (!g) return res.status(404).json({ message: "Группа не найдена" });
  if (g.members.has(req.userId)) return res.status(400).json({ message: "Ты уже в этом клане" });
  if ([...groups.values()].some(other => other.members.has(req.userId))) {
    return res.status(400).json({ message: "Ты уже состоишь в клане. Покинь его, чтобы вступить в другой" });
  }
  if (g.closed) return res.status(400).json({ message: "Клан закрыт. Вступление только по приглашению" });
  if (g.members.size >= GROUP_MAX) return res.status(400).json({ message: `Клан заполнен (максимум ${GROUP_MAX})` });
  const list = groupJoinRequests.get(gid) || [];
  if (list.find(r => r.userId === req.userId)) return res.status(400).json({ message: "Заявка уже отправлена" });
  const from = wsClientsByUserId(req.userId);
  const acc = [...redisAccounts._map.values()].find(a => a && a.id === req.userId);
  const username = from?.username || acc?.username || "Player";
  const request = { userId: req.userId, username, time: Date.now() };
  list.push(request); groupJoinRequests.set(gid, list);
  saveGroupJoinRequests(gid);
  sendToUser(g.ownerId, { type: "group_join_request", groupId: gid, groupName: g.name, request });
  res.json({ ok: true });
});

// Owner/leader/elder lists pending applicants.
app.get("/api/groups/:id/requests", requireAuth, (req, res) => {
  const gid = sanitize(req.params.id, 32);
  const g = groups.get(gid);
  if (!g) return res.status(404).json({ message: "Группа не найдена" });
  if (!state || !username) return res.status(400).json({ message: "Обязательные поля отсутствуют" });
  res.json({ requests: groupJoinRequests.get(gid) || [] });
});

// Owner/leader/elder approves or rejects an applicant.
app.post("/api/groups/:id/requests/:userId", requireAuth, async (req, res) => {
  const gid = sanitize(req.params.id, 32);
  const applicantId = sanitize(req.params.userId, 64);
  const g = groups.get(gid);
  if (!g) return res.status(404).json({ message: "Группа не найдена" });
  if (!state || !username) return res.status(400).json({ message: "Обязательные поля отсутствуют" });
  const accept = !!req.body.accept;
  const list = groupJoinRequests.get(gid) || [];
  if (!list.find(r => r.userId === applicantId)) return res.status(404).json({ message: "Заявка не найдена" });
  groupJoinRequests.set(gid, list.filter(r => r.userId !== applicantId));
  saveGroupJoinRequests(gid);
  if (accept) {
    if (g.members.size >= GROUP_MAX) return res.status(400).json({ message: `Клан заполнен (максимум ${GROUP_MAX})` });
    if ([...groups.values()].some(other => other.id !== gid && other.members.has(applicantId))) {
      return res.status(400).json({ message: "Ты уже состоишь в другом клане" });
    }
    g.members.add(applicantId);
    saveGroup(g);
    const pub = await publicGroup(g);
    for (const memberId of g.members) sendToUser(memberId, { type: "group_update", group: pub });
    sendToUser(applicantId, { type: "group_join_accepted", groupId: gid, groupName: g.name });
  } else {
    sendToUser(applicantId, { type: "group_join_rejected", groupId: gid, groupName: g.name });
  }
  res.json({ ok: true });
});

// --- Group settings (owner/leader can edit) --------------------------------
app.put("/api/groups/:id/description", requireAuth, async (req, res) => {
  const gid = sanitize(req.params.id, 32);
  const g = groups.get(gid);
  if (!g) return res.status(404).json({ message: "Группа не найдена" });
  if (!canEditGroup(g, req.userId)) return res.status(403).json({ message: "Нет прав" });
  g.description = sanitize(req.body.description || "", 200);
  saveGroup(g);
  const pub = await publicGroup(g);
  for (const m of g.members) sendToUser(m, { type: "group_update", group: pub });
  res.json({ ok: true, group: pub });
});

app.put("/api/groups/:id/avatar", requireAuth, async (req, res) => {
  const gid = sanitize(req.params.id, 32);
  const g = groups.get(gid);
  if (!g) return res.status(404).json({ message: "Группа не найдена" });
  if (!canEditGroup(g, req.userId)) return res.status(403).json({ message: "Нет прав" });
  // base64 dataURL — нельзя резать до 500 символов (см. /api/user/avatar).
  g.avatar = sanitize(req.body.avatar || "", 3_000_000);
  saveGroup(g);
  const pub = await publicGroup(g);
  for (const m of g.members) sendToUser(m, { type: "group_update", group: pub });
  res.json({ ok: true, group: pub });
});

// Owner assigns a role to a member
app.put("/api/groups/:id/role", requireAuth, async (req, res) => {
  const gid = sanitize(req.params.id, 32);
  const g = groups.get(gid);
  if (!g) return res.status(404).json({ message: "Группа не найдена" });
  if (g.ownerId !== req.userId) return res.status(403).json({ message: "Только владелец может назначать звания" });
  const targetId = sanitize(req.body.userId || "", 64);
  const role = sanitize(req.body.role || "", 16);
  if (!g.members.has(targetId)) return res.status(400).json({ message: "Пользователь не в клане" });
  if (targetId === g.ownerId) return res.status(400).json({ message: "Нельзя изменить роль владельца" });
  if (![ROLE_LEADER, ROLE_ELDER, ROLE_MEMBER].includes(role)) {
    return res.status(400).json({ message: "Неверная роль" });
  }
  if (role === ROLE_MEMBER) {
    delete g.memberRoles[targetId];
  } else {
    g.memberRoles[targetId] = role;
  }
  saveGroup(g);
  const pub = await publicGroup(g);
  for (const m of g.members) sendToUser(m, { type: "group_update", group: pub });
  res.json({ ok: true, group: pub });
});

// Owner toggles closed (private) mode — no one can apply, only invited
app.put("/api/groups/:id/closed", requireAuth, async (req, res) => {
  const gid = sanitize(req.params.id, 32);
  const g = groups.get(gid);
  if (!g) return res.status(404).json({ message: "Группа не найдена" });
  if (g.ownerId !== req.userId) return res.status(403).json({ message: "Только владелец может назначать звания" });
  g.closed = !!req.body.closed;
  saveGroup(g);
  const pub = await publicGroup(g);
  for (const m of g.members) sendToUser(m, { type: "group_update", group: pub });
  res.json({ ok: true, group: pub });
});

// ─── Affiliate / Referral System ─────────────────────────────────────────────
const DEFAULT_LEVELS = [
  { level: 1, percent: 30, minReferrals: 0 },
  { level: 2, percent: 35, minReferrals: 15 },
  { level: 3, percent: 40, minReferrals: 50 },
  { level: 4, percent: 45, minReferrals: 100 },
  { level: 5, percent: 50, minReferrals: 200 },
  { level: 6, percent: 55, minReferrals: 400 },
  { level: 7, percent: 60, minReferrals: 700 },
];

let affiliateLevels = JSON.parse(JSON.stringify(DEFAULT_LEVELS));
let subAffiliatePercent = 10;

async function loadAffiliateConfig() {
  try {
    const raw = await redis.get("sbgames:affiliate_levels");
    if (raw) {
      const cfg = JSON.parse(raw);
      if (Array.isArray(cfg.levels) && cfg.levels.length > 0) affiliateLevels = cfg.levels;
      if (typeof cfg.subAffiliatePercent === "number") subAffiliatePercent = cfg.subAffiliatePercent;
      console.log("[affiliate] loaded config from redis");
    }
  } catch {}
}

async function saveAffiliateConfig() {
  try {
    await redis.set("sbgames:affiliate_levels", JSON.stringify({ levels: affiliateLevels, subAffiliatePercent }));
  } catch {}
}

// referralData: { [tgId]: { code, referredBy, referralCount, totalEarned, pendingPayout,
//   referrals: [{ tgId, nick, joinedAt, totalDonated }],
//   commissions: [{ playerNick, amount, date, level }],
//   payouts: [{ id, amount, method, status, createdAt }] } }
const referralData = new Map();

async function loadReferralData() {
  try {
    const stream = redis.scanStream({ match: "ref:*", count: 200 });
    for await (const keys of stream) {
      for (const k of keys) {
        const v = await redis.get(k);
        if (v) {
          const tgId = k.replace("ref:", "");
          referralData.set(tgId, JSON.parse(v));
        }
      }
    }
  } catch {}
}

async function saveReferral(tgId, data) {
  referralData.set(tgId, data);
  try { await redis.set(`ref:${tgId}`, JSON.stringify(data)); } catch {}
}

function generateReferralCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function getAffiliateLevel(referralCount) {
  let level = affiliateLevels[0];
  for (const l of affiliateLevels) {
    if (referralCount >= l.minReferrals) level = l;
  }
  return level;
}

function ensureReferralData(tgId) {
  if (!referralData.has(tgId)) {
    const data = {
      code: generateReferralCode(),
      referredBy: null,
      referralCount: 0,
      totalEarned: 0,
      pendingPayout: 0,
      referrals: [],
      commissions: [],
      allCommissions: [],
      payouts: [],
      subAffiliates: [],
      monthlyStats: [],
    };
    referralData.set(tgId, data);
    saveReferral(tgId, data);
  }
  return referralData.get(tgId);
}

// GET /affiliate/stats — dashboard data for current user
app.get("/affiliate/stats", requireAuth, async (req, res) => {
  const data = ensureReferralData(req.userId);
  const acc = await redisAccounts.get(req.userId);
  const level = getAffiliateLevel(data.referralCount);
  const effectivePercent = data.customPercent ?? level.percent;
  res.json({
    totalEarned: data.totalEarned || 0,
    pendingPayout: data.pendingPayout || 0,
    totalReferrals: data.referralCount || 0,
    levelPercent: level.percent,
    customPercent: data.customPercent ?? null,
    effectivePercent,
    referralCode: data.code,
    referrals: (data.referrals || []).slice(-50).reverse(),
    subAffiliates: data.subAffiliates || [],
    recentCommissions: (data.commissions || []).slice(-10).reverse(),
    allCommissions: (data.allCommissions || []).slice(-100).reverse(),
    payouts: (data.payouts || []).slice(-20).reverse(),
    monthlyStats: data.monthlyStats || [],
  });
});

// GET /affiliate/code — get or generate referral code
app.get("/affiliate/code", requireAuth, (req, res) => {
  const data = ensureReferralData(req.userId);
  res.json({ code: data.code, link: `https://games.sb-capital.group/invite/${data.code}` });
});

// PUT /affiliate/code — set/change custom referral code
// Body: { code: "XXXXXXX" }. Code must be unique; persisted via saveReferral.
app.put("/affiliate/code", requireAuth, async (req, res) => {
  const code = String(req.body?.code || "").trim().toUpperCase();
  if (!/^[A-Z0-9]{3,20}$/.test(code)) {
    return res.status(400).json({ message: "Код: 3–20 символов, латинские буквы и цифры" });
  }
  // Uniqueness check across all referral records
  const takenBy = [...referralData.entries()].find(([uid, d]) => d.code === code && uid !== req.userId);
  if (takenBy) {
    return res.status(409).json({ message: "Этот код уже занят" });
  }
  const data = ensureReferralData(req.userId);
  data.code = code;
  await saveReferral(req.userId, data);
  res.json({ ok: true, code, link: `https://games.sb-capital.group/invite/${code}` });
});

// GET /affiliate/levels — public endpoint, no auth
app.get("/affiliate/levels", (req, res) => {
  res.json({ levels: affiliateLevels, subAffiliatePercent });
});

// GET /admin/affiliate/levels — admin reads current config
app.get("/admin/affiliate/levels", async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  res.json({ levels: affiliateLevels, subAffiliatePercent });
});

// POST /admin/affiliate/levels — admin saves affiliate config
// Body: { levels: [...], subAffiliatePercent: Number }
app.post("/admin/affiliate/levels", async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  const { levels, subAffiliatePercent: subPct } = req.body;
  if (!Array.isArray(levels) || levels.length < 1 || levels.length > 20) {
    return res.status(400).json({ message: "Неверный формат уровней" });
  }
  for (const l of levels) {
    if (typeof l.level !== "number" || typeof l.percent !== "number" || typeof l.minReferrals !== "number") {
      return res.status(400).json({ message: "Каждый уровень: level, percent, minReferrals (числа)" });
    }
    if (l.percent < 0 || l.percent > 100) {
      return res.status(400).json({ message: "Процент: 0–100" });
    }
  }
  if (typeof subPct === "number" && (subPct < 0 || subPct > 100)) {
    return res.status(400).json({ message: "Суб-процент: 0–100" });
  }
  affiliateLevels = levels;
  if (typeof subPct === "number") subAffiliatePercent = subPct;
  await saveAffiliateConfig();
  console.log(`[affiliate] admin saved ${levels.length} levels, sub=${subAffiliatePercent}%`);
  res.json({ ok: true, levels: affiliateLevels, subAffiliatePercent });
});

// --- Per-user commission override ------------------------------------------------

// GET /admin/affiliate/user?search=XXX — find user by nick/tgId, return their affiliate info
app.get("/admin/affiliate/user", async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  const q = String(req.query.search || "").trim().toLowerCase();
  if (q.length < 2) return res.status(400).json({ message: "Минимум 2 символа" });

  // Search across all referral data
  const results = [];
  for (const [tgId, data] of referralData) {
    const acc = await redisAccounts.get(tgId).catch(() => null);
    const nick = acc?.username || "";
    const matchId = tgId.toLowerCase().includes(q);
    const matchNick = nick.toLowerCase().includes(q);
    if (matchId || matchNick) {
      results.push({
        tgId,
        username: nick,
        referralCount: data.referralCount || 0,
        level: getAffiliateLevel(data.referralCount || 0),
        customPercent: data.customPercent ?? null,
        totalEarned: data.totalEarned || 0,
        pendingPayout: data.pendingPayout || 0,
      });
    }
    if (results.length >= 50) break;
  }
  res.json({ users: results });
});

// POST /admin/affiliate/user — set custom commission percent for a user
// Body: { tgId, customPercent }  — pass null to remove override
app.post("/admin/affiliate/user", async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  const { tgId, customPercent } = req.body;
  if (!tgId) return res.status(400).json({ message: "tgId обязателен" });

  const data = referralData.get(String(tgId));
  if (!data) return res.status(404).json({ message: "Пользователь не найден" });

  if (customPercent === null || customPercent === undefined) {
    delete data.customPercent;
  } else {
    const pct = Number(customPercent);
    if (isNaN(pct) || pct < 0 || pct > 100) {
      return res.status(400).json({ message: "Процент: 0–100 или null" });
    }
    data.customPercent = pct;
  }
  await saveReferral(tgId, data);
  const level = getAffiliateLevel(data.referralCount || 0);
  res.json({
    ok: true,
    tgId,
    customPercent: data.customPercent ?? null,
    effectivePercent: data.customPercent ?? level.percent,
    level: level.level,
  });
});

// GET /api/referral — compact referral info for current user
app.get("/api/referral", requireAuth, async (req, res) => {
  const data = ensureReferralData(req.userId);
  const level = getAffiliateLevel(data.referralCount);
  res.json({
    code: data.code,
    link: `https://games.sb-capital.group/invite/${data.code}`,
    referralCount: data.referralCount || 0,
    totalEarned: data.totalEarned || 0,
    pendingPayout: data.pendingPayout || 0,
    level: level.level,
    levelPercent: level.percent,
    customPercent: data.customPercent ?? null,
    effectivePercent: data.customPercent ?? level.percent,
  });
});

// POST /affiliate/payout — request payout
app.post("/affiliate/payout", requireAuth, async (req, res) => {
  const { amount, method } = req.body;
  if (!amount || amount < 5) return res.status(400).json({ message: "Минимальная сумма вывода — $5" });
  if (!method) return res.status(400).json({ message: "Укажите способ вывода" });
  const data = ensureReferralData(req.userId);
  if (data.pendingPayout < amount) return res.status(400).json({ message: "Недостаточно средств" });
  data.pendingPayout -= amount;
  data.payouts.push({
    id: uuidv4(),
    amount,
    method,
    status: "pending",
    createdAt: new Date().toISOString(),
  });
  await saveReferral(req.userId, data);
  res.json({ ok: true, payout: data.payouts[data.payouts.length - 1] });
});

// POST /affiliate/register — record a referral during registration
// Body: { referralCode: "XXXXXXX" }
app.post("/affiliate/register", (req, res) => {
  const { referralCode } = req.body;
  if (!referralCode) return res.json({ ok: false });
  // Store in a temporary map so tg-login can pick it up
  pendingReferrals.set(referralCode.toUpperCase(), Date.now());
  res.json({ ok: true });
});

// Pending referral codes: code -> timestamp (expires 30 min)
const pendingReferrals = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of pendingReferrals) {
    if (now - v > 1_800_000) pendingReferrals.delete(k);
  }
}, 60_000);

// GET /invite/:code — redirect to login with referral code
app.get("/invite/:code", (req, res) => {
  const code = (req.params.code || "").toUpperCase();
  if (!code || code.length < 3) return res.redirect("https://games.sb-capital.group/");
  res.redirect(302, `https://games.sb-capital.group/login?ref=${code}`);
});

// ─── WebSocket ────────────────────────────────────────────────────────────────
const WS_MAX_PER_IP    = 5;    // макс соединений с одного IP
const WS_AUTH_TIMEOUT  = 10_000; // 10с на авторизацию
const WS_MSG_LIMIT     = 120;  // сообщений в минуту
const WS_MSG_WINDOW    = 60_000;
const wsIPCount        = new Map(); // ip GеЖ count

wss.on("connection", (ws, req) => {
  const clientId = uuidv4();
  const ip = (req.socket.remoteAddress || "").replace(/^::ffff:/, "");

  // Лимит соединений per IP
  const ipCount = (wsIPCount.get(ip) || 0) + 1;
  wsIPCount.set(ip, ipCount);
  if (ipCount > WS_MAX_PER_IP || isBlocked(ip)) {
    ws.close(1008, "Too many connections");
    wsIPCount.set(ip, ipCount - 1);
    return;
  }

  wsClients.set(clientId, { ws, userId: null, role: "user", ip, msgCount: 0, msgWindowStart: Date.now(), isAlive: true, lastActive: Date.now() });

  // Pong from client marks connection alive
  ws.on("pong", () => {
    const c = wsClients.get(clientId);
    if (c) c.isAlive = true;
  });

  // ??????? ???????????
  const authTimeout = setTimeout(() => {
    if (!wsClients.get(clientId)?.userId) {
      ws.close(1008, "Auth timeout");
    }
  }, WS_AUTH_TIMEOUT);

  ws.on("message", async (raw) => {
    try {
      if (raw.length > 8192) { ws.close(1009, "Message too large"); return; }
      let msg; try { msg = JSON.parse(raw); } catch { return; }
      const client = wsClients.get(clientId);
      if (!client) return;
      client.lastActive = Date.now();

      // Rate limit сообщений
      const now = Date.now();
      if (now - client.msgWindowStart > WS_MSG_WINDOW) { client.msgCount = 0; client.msgWindowStart = now; }
      client.msgCount++;
      if (client.msgCount > WS_MSG_LIMIT) {
        send(ws, { type: "error", text: "Слишком много сообщений" });
        return;
      }

      switch (msg.type) {
        case "auth": {
          let userId = null;
          try {
            userId = msg.token ? wsAuthenticate(msg.token) : null;
          } catch (e) {
            console.error("[WS Auth Error] wsAuthenticate threw error:", e);
          }
          if (!userId) {
            recordFailure(ip);
            send(ws, { type: "auth_error", message: "Необходима авторизация" });
            setTimeout(() => {
              try { ws.close(1008, "Unauthorized"); } catch {}
            }, 100);
            return;
          }
          clearTimeout(authTimeout);
          client.userId = userId; client.username = sanitize(msg.username || "", 32); client.role = isAdminId(userId) ? "admin" : "user";
          wsClients.set(clientId, client); broadcastOnlineUsers();
          let myFriends = [];
          try {
            myFriends = (await Promise.all([...getFriends(client.userId)].map(async fid => {
              let fa = [...redisAccounts._map.values()].find(a => a && a.id === fid);
              if (!fa) { try { fa = await redisAccounts.get(fid); } catch {} }
              return fa ? { id: fa.id, username: fa.username } : null;
            }))).filter(Boolean);
          } catch (e) {
            console.error("[WS Auth Error] Failed to retrieve friends:", e);
          }
          send(ws, { type: "friends_list", friends: myFriends });
          send(ws, { type: "friend_requests", requests: getPendingRequests(client.userId) });
          send(ws, { type: "parties_list", parties: await userPartiesList(client.userId) });
          send(ws, { type: "party_invites_list", invites: partyInvites.get(client.userId) || [] });
          if (client.role === "admin") { const openCount = [...tickets.values()].filter(t => t.status !== "closed").length; send(ws, { type: "admin_ready", openTickets: openCount }); }
          break;
        }
        case "friend_request_send": {
          const _toNick = (msg.toUsername || "").trim().toLowerCase();
          let target = [...redisAccounts._map.values()].find(a => a && (a.username || "").toLowerCase() === _toNick);
          if (!target) {
            // fallback: scan Redis for users not in memory
            try {
              const stream = redis.scanStream({ match: "acc:*", count: 200 });
              outer: for await (const keys of stream) {
                for (const k of keys) {
                  const v = await redis.get(k);
                  if (!v) continue;
                  const acc = JSON.parse(v);
                  if ((acc.username || "").toLowerCase() === _toNick) { target = acc; break outer; }
                }
              }
            } catch {}
          }
          if (!target)                              { send(ws, { type: "friend_error", message: "Пользователь не найден" }); break; }
          if (target.id === client.userId)          { send(ws, { type: "friend_error", message: "Нельзя добавить себя" }); break; }
          if (areFriends(client.userId, target.id)) { send(ws, { type: "friend_error", message: "Уже в друзьях" }); break; }
          const existing = getPendingRequests(target.id);
          if (existing.find(r => r.fromId === client.userId)) { send(ws, { type: "friend_error", message: "Заявка уже отправлена" }); break; }
          const reqData = { fromId: client.userId, fromUsername: client.username, time: Date.now() };
          friendRequests.set(target.id, [...existing, reqData]);
          saveFriendRequests(target.id);
          sendToUser(target.id, { type: "friend_request_received", request: reqData });
          send(ws, { type: "friend_request_sent", toUsername: target.username });
          break;
        }
        case "friend_request_respond": {
          const { fromId, accept } = msg;
          friendRequests.set(client.userId, getPendingRequests(client.userId).filter(r => r.fromId !== fromId));
          saveFriendRequests(client.userId);
          if (accept) {
            if (!friendships.has(client.userId)) friendships.set(client.userId, new Set());
            if (!friendships.has(fromId))         friendships.set(fromId,         new Set());
            friendships.get(client.userId).add(fromId); friendships.get(fromId).add(client.userId);
            saveFriendships(client.userId);
            saveFriendships(fromId);
            let meFriends = [];
            try {
              meFriends = (await Promise.all([...getFriends(client.userId)].map(async fid => {
                let fa = [...redisAccounts._map.values()].find(a => a && a.id === fid);
                if (!fa) { try { fa = await redisAccounts.get(fid); } catch {} }
                return fa ? { id: fa.id, username: fa.username } : null;
              }))).filter(Boolean);
            } catch (e) {
              console.error("[WS Friend Respond Error] Failed to get friends list:", e);
            }
            send(ws, { type: "friends_list", friends: meFriends });
            sendToUser(fromId, { type: "friend_accepted", byId: client.userId, byUsername: client.username });
          }
          send(ws, { type: "friend_requests", requests: getPendingRequests(client.userId) });
          break;
        }
        case "dm_send": {
          const text = sanitize(msg.text || "", 2000); if (!text) break;
          const key = dmKey(client.userId, msg.toId); const msgs = dms.get(key) || [];
          const dm = { id: uuidv4(), from: client.userId, fromUsername: client.username, text: text.trim(), time: Date.now() };
          msgs.push(dm); dms.set(key, msgs.slice(-200));
          saveDM(key, msgs);
          send(ws, { type: "dm_message", with: msg.toId, message: dm });
          sendToUser(msg.toId, { type: "dm_message", with: client.userId, message: dm });
          break;
        }
        case "dm_history": {
          const msgs = dms.get(dmKey(client.userId, msg.withId)) || [];
          send(ws, { type: "dm_history", with: msg.withId, messages: msgs });
          break;
        }
        case "message": {
          const ticket = tickets.get(Number(msg.ticketId)); if (!ticket) return;
          const cleanText = sanitize(msg.text || "", 2000); if (!cleanText) return;
          const message = { id: uuidv4(), from: client.userId || "anon", username: client.username || "Player", role: client.role, text: cleanText, time: Date.now() };
          ticket.messages.push(message);
          if (client.role === "user") {
            ticket.unread = (ticket.unread || 0) + 1; ticket.status = "open";
            broadcastToAdmins({ type: "message", ticketId: ticket.id, message });
            broadcastToAdmins({ type: "ticket_update", ticket: ticketSummary(ticket) });
          } else {
            ticket.unread = 0; ticket.status = "answered";
            broadcastToTicket(ticket.id, client.userId, { type: "message", ticketId: ticket.id, message });
            broadcastToAdmins({ type: "ticket_update", ticket: ticketSummary(ticket) });
            // Форвард в TG если пользователь из бота
            if (ticket.tgChatId) {
              try {
                await bot.sendMessage(ticket.tgChatId,
                  `💬 *Ответ по тикету #${ticket.id}*\n\n${cleanText}`,
                  { parse_mode: "Markdown", reply_markup: USER_KB }
                );
              } catch (e) { console.error("[ws message tg forward]", e.message); }
            }
          }
          break;
        }
        case "read_ticket": {
          const ticket = tickets.get(Number(msg.ticketId));
          if (ticket && client.role === "admin") { ticket.unread = 0; send(ws, { type: "ticket_messages", ticketId: ticket.id, messages: ticket.messages }); }
          break;
        }
        case "close_ticket": {
          const ticket = tickets.get(Number(msg.ticketId));
          if (ticket && client.role === "admin") { ticket.status = "closed"; broadcastToTicket(ticket.id, null, { type: "ticket_closed", ticketId: ticket.id }); broadcastToAdmins({ type: "ticket_update", ticket: ticketSummary(ticket) }); }
          break;
        }
        // Админ отправляет реквизиты через лаунчер → форвардим в TG
        case "send_requisites": {
          if (client.role !== "admin") break;
          const ticket = tickets.get(Number(msg.ticketId));
          if (!ticket) break;
          const cleanText = sanitize(msg.text || "", 1000);
          if (!cleanText) break;
          const message = { id: uuidv4(), from: client.userId, username: client.username, role: "admin", text: cleanText, time: Date.now() };
          ticket.messages.push(message);
          ticket.status = "answered"; ticket.unread = 0;
          // ?????????? ? ????????
          broadcastToAdmins({ type: "message", ticketId: ticket.id, message });
          broadcastToAdmins({ type: "ticket_update", ticket: ticketSummary(ticket) });
          broadcastToTicket(ticket.id, client.userId, { type: "message", ticketId: ticket.id, message });
          // Отправляем в TG если tgChatId известен
          if (ticket.tgChatId) {
            try {
              await bot.sendMessage(ticket.tgChatId,
                `💳 *Реквизиты для оплаты*\n\n${cleanText}\n\nПосле оплаты нажми кнопку и прикрепи чек.`,
                { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "✅ Отправить чек", callback_data: `send_receipt_${ticket.id}` }]] } }
              );
            } catch (e) { console.error("[ws send_requisites tg]", e.message); }
          }
          send(ws, { type: "requisites_sent", ticketId: ticket.id });
          break;
        }
        // ????? ???????????? ?????? ????? ??????? ? ?????? ?????? + ?????????
        case "confirm_payment": {
          if (client.role !== "admin") break;
          const ticket = tickets.get(Number(msg.ticketId));
          if (!ticket) break;
          // Сумма берётся ТОЛЬКО из серверного источника (тикет), не из клиентского msg.amount.
          const amount = Number(ticket.paymentAmount);
          if (!Number.isFinite(amount) || amount <= 0) { send(ws, { type: "error", text: "У тикета нет суммы пополнения" }); break; }
          const acc = await redisAccounts.get(ticket.userId);
          if (!acc) { send(ws, { type: "error", text: "Аккаунт игрока не найден" }); break; }
          acc.balance = (acc.balance || 0) + amount;
          await redisAccounts.set(ticket.userId, acc);
          const sysMsg = { id: uuidv4(), from: "system", text: `Оплата подтверждена. +${amount} СБТ зачислено.`, time: Date.now() };
          ticket.messages.push(sysMsg);
          ticket.status = "closed";
          broadcastToAdmins({ type: "message", ticketId: ticket.id, message: sysMsg });
          broadcastToAdmins({ type: "ticket_update", ticket: ticketSummary(ticket) });
          broadcastToTicket(ticket.id, null, { type: "message", ticketId: ticket.id, message: sysMsg });
          broadcastToTicket(ticket.id, null, { type: "ticket_closed", ticketId: ticket.id });
          sendToUser(ticket.userId, { type: "balance_update", balance: acc.balance });
          send(ws, { type: "payment_confirmed", ticketId: ticket.id, newBalance: acc.balance });
          // Уведомление в TG
          if (ticket.tgChatId) {
            try {
              await bot.sendMessage(ticket.tgChatId,
                `✅ *Оплата подтверждена!*\n\n+*${amount} СБТ* зачислено на ваш аккаунт.\nТекущий баланс: *${acc.balance.toLocaleString("ru-RU")} СБТ*`,
                { parse_mode: "Markdown", reply_markup: USER_KB }
              );
            } catch (e) { console.error("[ws confirm_payment tg]", e.message); }
          }
          // --- Referral commission ---
          try {
            const payerData = referralData.get(ticket.userId);
            if (payerData && payerData.referredBy) {
              const referrerId = payerData.referredBy;
              const referrerData = referralData.get(referrerId);
              if (referrerData) {
                const level = getAffiliateLevel(referrerData.referralCount || 0);
                const effectivePercent = referrerData.customPercent ?? level.percent;
                const commission = Math.round(amount * effectivePercent) / 100;
                if (commission > 0) {
                  referrerData.pendingPayout = (referrerData.pendingPayout || 0) + commission;
                  referrerData.totalEarned = (referrerData.totalEarned || 0) + commission;
                  const commRecord = {
                    playerNick: acc.username || ticket.userId,
                    amount: commission,
                    date: new Date().toISOString(),
                    level: level.level,
                    customPercent: referrerData.customPercent ?? null,
                  };
                  referrerData.commissions = referrerData.commissions || [];
                  referrerData.commissions.push(commRecord);
                  referrerData.allCommissions = referrerData.allCommissions || [];
                  referrerData.allCommissions.push(commRecord);
                  // Update referrer's referral totalDonated
                  const refEntry = (referrerData.referrals || []).find(r => r.tgId === ticket.userId);
                  if (refEntry) refEntry.totalDonated = (refEntry.totalDonated || 0) + amount;
                  // Sub-referral: if referrer was also referred, give them a cut
                  if (referrerData.referredBy) {
                    const topReferrer = referralData.get(referrerData.referredBy);
                    if (topReferrer) {
                      const subCommission = Math.round(commission * (subAffiliatePercent / 100) * 100) / 100;
                      topReferrer.pendingPayout = (topReferrer.pendingPayout || 0) + subCommission;
                      topReferrer.totalEarned = (topReferrer.totalEarned || 0) + subCommission;
                      topReferrer.subAffiliates = topReferrer.subAffiliates || [];
                      const existing = topReferrer.subAffiliates.find(s => s.tgId === referrerId);
                      if (existing) {
                        existing.yourCommission = (existing.yourCommission || 0) + subCommission;
                      } else {
                        topReferrer.subAffiliates.push({
                          tgId: referrerId,
                          nick: (await redisAccounts.get(referrerId))?.username || referrerId,
                          referralCount: referrerData.referralCount || 0,
                          yourCommission: subCommission,
                        });
                      }
                      await saveReferral(referrerData.referredBy, topReferrer);
                    }
                  }
                  await saveReferral(referrerId, referrerData);
                }
              }
            }
          } catch (e) { console.error("[affiliate commission]", e.message); }
          break;
        }
        case "subscribe_ticket": {
          client.ticketId = Number(msg.ticketId); wsClients.set(clientId, client);
          const ticket = tickets.get(Number(msg.ticketId));
          if (ticket) send(ws, { type: "ticket_messages", ticketId: ticket.id, messages: ticket.messages });
          break;
        }
        case "group_send": {
          const gid = sanitize(msg.groupId || "", 32);
          const g = groups.get(gid);
          if (!g || !g.members.has(client.userId)) { send(ws, { type: "group_error", text: "Ты не в этом клане" }); break; }
          const gtext = sanitize(msg.text || "", 1000);
          if (!gtext) { send(ws, { type: "group_error", text: "Пустое сообщение" }); break; }
          const m = { id: uuidv4(), fromId: client.userId, fromUsername: client.username || "Player", text: gtext, time: Date.now() };
          const list = groupMessages.get(gid) || [];
          list.push(m);
          groupMessages.set(gid, list.slice(-200));
          saveGroupMessages(gid);
          for (const memberId of g.members) {
            sendToUser(memberId, { type: "group_message", groupId: gid, message: m });
          }
          break;
        }
        case "group_kick": {
          const gid = sanitize(msg.groupId || "", 32);
          const targetUserId = sanitize(msg.userId || "", 64);
          const g = groups.get(gid);
          if (!g || !canKick(g, client.userId) || !g.members.has(targetUserId) || targetUserId === client.userId) break;
          const targetRole = getMemberRole(g, targetUserId);
          if (targetRole === ROLE_OWNER) break; // владельца кикнуть нельзя никогда
          if (targetRole === ROLE_LEADER && getMemberRole(g, client.userId) !== ROLE_OWNER) break; // лидера снимает только владелец
          delete g.memberRoles[targetUserId];
          g.members.delete(targetUserId);
          sendToUser(targetUserId, { type: "group_kicked", groupId: gid, groupName: g.name });
          if (g.members.size === 0) { groups.delete(gid); groupMessages.delete(gid); groupInvites.delete(gid); deleteGroupFromRedis(gid); }
          else { saveGroup(g); const pub = await publicGroup(g); for (const memberId of g.members) sendToUser(memberId, { type: "group_update", group: pub }); }
          break;
        }
        // --- DM Calls ------------------------------------------------------------
        case "call_offer": {
          const { toId, offer } = msg;
          if (!toId || !offer) break;
          sendToUser(toId, { type: "incoming_call", fromId: client.userId, fromUsername: client.username, offer, callType: "dm" });
          break;
        }
        case "call_answer": {
          const { toId, answer } = msg;
          if (!toId || !answer) break;
          sendToUser(toId, { type: "call_answered", fromId: client.userId, answer });
          break;
        }
        case "call_ice": {
          const { toId, candidate } = msg;
          if (!toId || !candidate) break;
          sendToUser(toId, { type: "call_ice_candidate", fromId: client.userId, candidate });
          break;
        }
        case "call_reject": {
          const { toId } = msg;
          if (!toId) break;
          sendToUser(toId, { type: "call_rejected", fromId: client.userId });
          break;
        }
        case "call_end": {
          const { toId } = msg;
          if (!toId) break;
          sendToUser(toId, { type: "call_ended", fromId: client.userId });
          break;
        }
        // --- Group Calls ---------------------------------------------------------
        case "group_call_join": {
          const { groupId } = msg;
          const g = groups.get(groupId);
          if (!g || !g.members.has(client.userId)) break;
          if (!groupVoice.has(groupId)) groupVoice.set(groupId, new Set());
          groupVoice.get(groupId).add(client.userId);
          const participants = [...groupVoice.get(groupId)];
          for (const memberId of g.members) {
            sendToUser(memberId, { type: "group_call_state", groupId, participants });
          }
          break;
        }
        case "group_call_leave": {
          const { groupId } = msg;
          const g = groups.get(groupId);
          if (groupVoice.has(groupId)) {
            groupVoice.get(groupId).delete(client.userId);
            if (groupVoice.get(groupId).size === 0) groupVoice.delete(groupId);
          }
          if (g) {
            const participants = [...(groupVoice.get(groupId) || [])];
            for (const memberId of g.members) {
              sendToUser(memberId, { type: "group_call_state", groupId, participants });
            }
          }
          break;
        }
        case "group_call_offer": {
          const { groupId, toId, offer } = msg;
          if (!toId || !offer) break;
          sendToUser(toId, { type: "group_call_offer", groupId, fromId: client.userId, fromUsername: client.username, offer });
          break;
        }
        case "group_call_answer": {
          const { groupId, toId, answer } = msg;
          if (!toId || !answer) break;
          sendToUser(toId, { type: "group_call_answer", groupId, fromId: client.userId, answer });
          break;
        }
        case "group_call_ice": {
          const { groupId, toId, candidate } = msg;
          if (!toId || !candidate) break;
          sendToUser(toId, { type: "group_call_ice_candidate", groupId, fromId: client.userId, candidate });
          break;
        }
        // --- Parties (temporary play sessions) ------------------------------------
        case "party_create": {
          const pname = sanitize(msg.name || "", 40) || "Группа";
          const id = String(++partyCounter);
          const p = { id, name: pname, leaderId: client.userId, members: new Set([client.userId]), createdAt: Date.now() };
          parties.set(id, p);
          userPartyIds(client.userId).add(id);
          send(ws, { type: "parties_list", parties: await userPartiesList(client.userId) });
          break;
        }
        case "party_invite": {
          const { toId, partyId } = msg;
          if (!toId || !partyId) break;
          const p = parties.get(partyId);
          if (!p || p.leaderId !== client.userId) break;
          if (p.members.size >= 8) break;
          if (!areFriends(client.userId, toId)) break;
          const invite = { partyId, partyName: p.name, fromId: client.userId, fromUsername: client.username };
          partyInvites.set(toId, [...(partyInvites.get(toId) || []).filter(i => i.partyId !== partyId), invite]);
          sendToUser(toId, { type: "party_invite_received", invite });
          break;
        }
        case "party_invite_respond": {
          const { partyId, accept } = msg;
          partyInvites.set(client.userId, (partyInvites.get(client.userId) || []).filter(i => i.partyId !== partyId));
          if (accept) {
            const p = parties.get(partyId);
            if (p && p.members.size < 8) {
              p.members.add(client.userId);
              userPartyIds(client.userId).add(partyId);
              for (const mid of p.members) sendToUser(mid, { type: "parties_list", parties: await userPartiesList(mid) });
            }
          }
          send(ws, { type: "party_invites_list", invites: partyInvites.get(client.userId) || [] });
          break;
        }
        case "party_leave": {
          const { partyId } = msg;
          if (!partyId) break;
          const p = parties.get(partyId);
          if (!p) { userPartyIds(client.userId).delete(partyId); break; }
          p.members.delete(client.userId);
          userPartyIds(client.userId).delete(partyId);
          if (p.members.size === 0) { disbandParty(partyId); }
          else {
            if (p.leaderId === client.userId) p.leaderId = p.members.values().next().value;
            for (const mid of p.members) sendToUser(mid, { type: "parties_list", parties: await userPartiesList(mid) });
          }
          send(ws, { type: "parties_list", parties: await userPartiesList(client.userId) });
          break;
        }
        case "party_kick": {
          const { userId: targetId, partyId } = msg;
          if (!partyId || !targetId) break;
          const p = parties.get(partyId);
          if (!p || p.leaderId !== client.userId || targetId === client.userId) break;
          p.members.delete(targetId);
          userPartyIds(targetId).delete(partyId);
          sendToUser(targetId, { type: "parties_list", parties: await userPartiesList(targetId) });
          for (const mid of p.members) sendToUser(mid, { type: "parties_list", parties: await userPartiesList(mid) });
          break;
        }
        case "party_rename": {
          const { partyId, name } = msg;
          const p = parties.get(partyId);
          if (!p || p.leaderId !== client.userId) break;
          p.name = sanitize(name || "", 40) || p.name;
          for (const mid of p.members) sendToUser(mid, { type: "parties_list", parties: await userPartiesList(mid) });
          break;
        }
        // ─── Trade system ────────────────────────────────────────────────────
        case "trade_request": {
          const targetId = sanitize(msg.toId || "", 64);
          if (!targetId || targetId === client.userId) break;
          if (!areFriends(client.userId, targetId)) { send(ws, { type: "trade_error", message: "Не в друзьях" }); break; }
          const existing = [...trades.values()].find(t => t.status === "active" && (t.initiatorId === client.userId || t.targetId === client.userId));
          if (existing) { send(ws, { type: "trade_error", message: "Уже в трейде" }); break; }
          const targetExisting = [...trades.values()].find(t => t.status === "active" && (t.initiatorId === targetId || t.targetId === targetId));
          if (targetExisting) { send(ws, { type: "trade_error", message: "Игрок уже в трейде" }); break; }
          const tradeId = String(++listingCounter);
          const trade = { id: tradeId, initiatorId: client.userId, targetId, initiatorItems: [], targetItems: [], initiatorConfirmed: false, targetConfirmed: false, status: "active", createdAt: Date.now() };
          trades.set(tradeId, trade);
          sendToUser(targetId, { type: "trade_request_received", tradeId, fromId: client.userId, fromUsername: client.username });
          send(ws, { type: "trade_request_sent", tradeId, toId: targetId });
          break;
        }
        case "trade_offer": {
          const trade = trades.get(msg.tradeId);
          if (!trade || trade.status !== "active") break;
          if (trade.initiatorId !== client.userId && trade.targetId !== client.userId) break;
          const isInitiator = trade.initiatorId === client.userId;
          const items = Array.isArray(msg.items) ? msg.items.map(i => sanitize(String(i), 64)).filter(Boolean).slice(0, 20) : [];
          if (isInitiator) trade.initiatorItems = items; else trade.targetItems = items;
          trade.initiatorConfirmed = false; trade.targetConfirmed = false;
          const otherId = isInitiator ? trade.targetId : trade.initiatorId;
          sendToUser(otherId, { type: "trade_updated", tradeId: trade.id, initiatorItems: trade.initiatorItems, targetItems: trade.targetItems });
          send(ws, { type: "trade_updated", tradeId: trade.id, initiatorItems: trade.initiatorItems, targetItems: trade.targetItems });
          break;
        }
        case "trade_confirm": {
          const trade = trades.get(msg.tradeId);
          if (!trade || trade.status !== "active") break;
          if (trade.initiatorId !== client.userId && trade.targetId !== client.userId) break;
          const isInit = trade.initiatorId === client.userId;
          if (isInit) trade.initiatorConfirmed = true; else trade.targetConfirmed = true;
          const otherId2 = isInit ? trade.targetId : trade.initiatorId;
          sendToUser(otherId2, { type: "trade_confirmed", tradeId: trade.id, by: client.userId });
          send(ws, { type: "trade_confirmed", tradeId: trade.id, by: client.userId });
          if (trade.initiatorConfirmed && trade.targetConfirmed) {
            trade.status = "completed";
            const acc1 = await redisAccounts.get(trade.initiatorId);
            const acc2 = await redisAccounts.get(trade.targetId);
            if (acc1 && acc2) {
              const inv1 = Array.isArray(acc1.inventory) ? [...acc1.inventory] : [];
              const mkt1 = Array.isArray(acc1.market_inventory) ? [...acc1.market_inventory] : [];
              const inv2 = Array.isArray(acc2.inventory) ? [...acc2.inventory] : [];
              const mkt2 = Array.isArray(acc2.market_inventory) ? [...acc2.market_inventory] : [];
              const allInv1 = [...new Set([...inv1, ...mkt1])];
              const allInv2 = [...new Set([...inv2, ...mkt2])];
              let ok = true;
              for (const itemId of trade.initiatorItems) { if (!allInv1.includes(itemId)) ok = false; }
              for (const itemId of trade.targetItems) { if (!allInv2.includes(itemId)) ok = false; }
              if (ok) {
                for (const itemId of trade.initiatorItems) {
                  if (inv1.includes(itemId)) acc1.inventory = inv1.filter(x => x !== itemId);
                  else acc1.market_inventory = mkt1.filter(x => x !== itemId);
                  if (inv2.includes(itemId)) acc2.inventory = [...inv2, itemId]; else acc2.market_inventory = [...mkt2, itemId];
                }
                for (const itemId of trade.targetItems) {
                  if (inv2.includes(itemId)) acc2.inventory = inv2.filter(x => x !== itemId);
                  else acc2.market_inventory = mkt2.filter(x => x !== itemId);
                  if (inv1.includes(itemId)) acc1.inventory = [...(acc1.inventory || []), itemId]; else acc1.market_inventory = [...(acc1.market_inventory || []), itemId];
                }
                await redisAccounts.set(trade.initiatorId, acc1);
                await redisAccounts.set(trade.targetId, acc2);
                sendToUser(trade.initiatorId, { type: "trade_completed", tradeId: trade.id });
                sendToUser(trade.targetId, { type: "trade_completed", tradeId: trade.id });
              } else {
                trade.status = "failed";
                sendToUser(trade.initiatorId, { type: "trade_error", message: "Предметы больше не доступны" });
                sendToUser(trade.targetId, { type: "trade_error", message: "Предметы больше не доступны" });
              }
            }
          }
          break;
        }
        case "trade_cancel": {
          const trade = trades.get(msg.tradeId);
          if (!trade || trade.status !== "active") break;
          if (trade.initiatorId !== client.userId && trade.targetId !== client.userId) break;
          trade.status = "cancelled";
          const otherId3 = trade.initiatorId === client.userId ? trade.targetId : trade.initiatorId;
          sendToUser(otherId3, { type: "trade_cancelled", tradeId: trade.id });
          send(ws, { type: "trade_cancelled", tradeId: trade.id });
          break;
        }
        // ─── Community sync ─────────────────────────────────────────────────
        case "community_sync": {
          const friendIds = [...getFriends(client.userId)];
          const friendList = await Promise.all(friendIds.map(async fid => {
            let fa = [...redisAccounts._map.values()].find(a => a && a.id === fid);
            if (!fa) { try { fa = await redisAccounts.get(fid); } catch {} }
            return fa ? { id: fa.id, username: fa.username } : null;
          }));
          send(ws, { type: "friends_list", friends: friendList.filter(Boolean) });
          send(ws, { type: "friend_requests", requests: getPendingRequests(client.userId) });
          send(ws, { type: "online_users", users: [...wsClients.values()].filter(c => c.userId && c.username).map(c => ({ id: c.userId, username: c.username, role: c.role })) });
          send(ws, { type: "groups_list", groups: await Promise.all([...groups.values()].filter(g => g.members.has(client.userId)).map(publicGroup)) });
          const myInvites = [];
          for (const [gid, list] of groupInvites.entries()) for (const inv of list) if (inv.toId === client.userId) myInvites.push({ ...inv, groupId: gid });
          send(ws, { type: "group_invites_list", invites: myInvites });
          send(ws, { type: "parties_list", parties: await userPartiesList(client.userId) });
          send(ws, { type: "party_invites_list", invites: partyInvites.get(client.userId) || [] });
          break;
        }
      }
    } catch (err) {
      console.error("[WS Message Error]:", err);
      try {
        send(ws, { type: "error", text: "Слишком много сообщений" });
      } catch (wsErr) {}
    }
  });

  ws.on("close", () => {
    clearTimeout(authTimeout);
    const client = wsClients.get(clientId);
    wsClients.delete(clientId);
    const cnt = wsIPCount.get(ip) || 1;
    if (cnt <= 1) wsIPCount.delete(ip); else wsIPCount.set(ip, cnt - 1);
    if (client?.userId) {
      for (const [gid, voices] of groupVoice.entries()) {
        if (voices.has(client.userId)) {
          voices.delete(client.userId);
          if (voices.size === 0) groupVoice.delete(gid);
          const g = groups.get(gid);
          if (g) { const p = [...(groupVoice.get(gid) || [])]; for (const mid of g.members) sendToUser(mid, { type: "group_call_state", groupId: gid, participants: p }); }
        }
      }
    }
    broadcastOnlineUsers();
  });
  ws.on("error", (err) => {
    try {
      clearTimeout(authTimeout);
      wsClients.delete(clientId);
      const cnt = wsIPCount.get(ip) || 1;
      if (cnt <= 1) wsIPCount.delete(ip); else wsIPCount.set(ip, cnt - 1);
      broadcastOnlineUsers();
    } catch (e) { console.error("[WS error handler]:", e); }
  });
});

// ─── WebSocket Ping/Pong Keepalive ──────────────────────────────────────────
// Prevents nginx/proxy from killing idle WS connections
const WS_PING_INTERVAL = 25_000; // 25s (nginx default timeout is 60s)
setInterval(() => {
  for (const [clientId, client] of wsClients.entries()) {
    if (client.ws.readyState !== WebSocket.OPEN) continue;
    if (client.isAlive === false) {
      try { client.ws.terminate(); } catch {}
      wsClients.delete(clientId);
      const cnt = wsIPCount.get(client.ip) || 1;
      if (cnt <= 1) wsIPCount.delete(client.ip); else wsIPCount.set(client.ip, cnt - 1);
      continue;
    }
    client.isAlive = false;
    try { client.ws.ping(); } catch {}
  }
  broadcastOnlineUsers();
}, WS_PING_INTERVAL);

// --- Clan Play Hours Tracking ------------------------------------------------
// Every 60s, increment playHours for each active clan member by 1/60 (1 minute).
// A user is "active" if they sent any WS message in the last 120s.
const PLAY_HOURS_TICK_MS = 60_000; // check every 60s
const PLAY_HOURS_ACTIVE_THRESHOLD = 120_000; // considered active if last message < 120s ago
const PLAY_HOURS_INCREMENT = 1 / 60; // each tick = 1 minute = 1/60 hour

setInterval(async () => {
  const now = Date.now();
  const activeUserIds = new Set();
  for (const [, client] of wsClients.entries()) {
    if (client.userId && client.lastActive && (now - client.lastActive) < PLAY_HOURS_ACTIVE_THRESHOLD) {
      activeUserIds.add(client.userId);
    }
  }
  if (activeUserIds.size === 0) return;

  const leveledUp = []; // кланы, у которых реально сменился уровень
  for (const [, g] of groups.entries()) {
    let groupUpdated = false;
    const oldLvl = calcClanLevel(g); // уровень ДО начисления часов
    for (const mid of g.members) {
      if (!activeUserIds.has(mid)) continue;
      if (!g.playHours) g.playHours = {};
      g.playHours[mid] = (g.playHours[mid] || 0) + PLAY_HOURS_INCREMENT;
      groupUpdated = true;
    }
    if (groupUpdated) {
      const newLvl = calcClanLevel(g); // уровень ПОСЛЕ
      if (newLvl !== oldLvl) leveledUp.push({ g, oldLvl, newLvl });
    }
  }

  // ????????? ?????????? ?????? ??? ??????, ? ??????? ???????? ???????
  for (const { g, oldLvl, newLvl } of leveledUp) {
    saveGroup(g); // сразу персистим, чтобы уровень не потерялся до планового сохранения
    const pub = await publicGroup(g);
    for (const memberId of g.members) {
      sendToUser(memberId, { type: "group_update", group: pub });
      if (newLvl > oldLvl) {
        sendToUser(memberId, { type: "clan_levelup", groupId: g.id, level: newLvl });
      }
    }
  }
}, PLAY_HOURS_TICK_MS);

function send(ws, data) { try { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data)); } catch {} }
function broadcastOnlineUsers() {
  const users = [...wsClients.values()].filter(c => c.userId && c.username).map(c => ({ id: c.userId, username: c.username, role: c.role }));
  for (const { ws } of wsClients.values()) send(ws, { type: "online_users", users });
}
function broadcastToAdmins(data) { for (const { ws, role } of wsClients.values()) { if (role === "admin") send(ws, data); } }
function broadcastToTicket(ticketId, excludeUserId, data) {
  for (const { ws, userId, ticketId: sub } of wsClients.values()) { if (sub === ticketId && userId !== excludeUserId) send(ws, data); }
}
function ticketSummary(t) { return { id: t.id, category: t.category, username: t.username, status: t.status, createdAt: t.createdAt, preview: t.preview, unread: t.unread || 0, paymentAmount: t.paymentAmount || null, tgChatId: t.tgChatId || null, userId: t.userId }; }

// ─── News ─────────────────────────────────────────────────────────────────────
let newsCache = [], newsCacheTime = 0;

async function fetchNewsPublic() {
  try {
    const r = await fetch("https://t.me/s/sb7games", { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }, signal: AbortSignal.timeout(10000) });
    if (!r.ok) return newsCache;
    const html = await r.text();
    const items = [];
    // Split by message wraps
    const msgBlocks = html.split(/tgme_widget_message_wrap/);
    for (let i = 1; i < msgBlocks.length && items.length < 12; i++) {
      const block = msgBlocks[i];
      // Skip service messages (like "Channel created")
      if (/service_message/.test(block) && !/tgme_widget_message_text[^>]*>[^<]+</.test(block.replace(/Channel created|channel was created/gi, ""))) continue;
      const postId  = (block.match(/data-post="sb7games\/(\d+)"/) || [])[1] || String(i);
      const textRaw = (block.match(/tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/) || [])[1] || "";
      const text    = textRaw.replace(/<br\s*\/?>/g, "\n").replace(/<[^>]+>/g, "").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').trim();
      if (!text) continue;
      const pubDate = (block.match(/datetime="([^"]+)"/) || [])[1] || "";
      // Photo: look for tgme_widget_message_photo_wrap with background-image or img
      let photo = null;
      const photoBg = (block.match(/tgme_widget_message_photo_wrap[^"]*"[^>]*style="[^"]*background-image:\s*url\(([^)]+)\)/) || [])[1];
      if (photoBg) photo = photoBg.replace(/^['"]|['"]$/g, "").replace(/^\/\//, "https://");
      if (!photo) {
        const photoImg = (block.match(/tgme_widget_message_photo_wrap[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"/) || [])[1];
        if (photoImg) photo = photoImg.replace(/^\/\//, "https://");
      }
      const dateStr = pubDate ? new Date(pubDate).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" }) : "";
      const link    = `https://t.me/sb7games/${postId}`;
      items.push({ id: parseInt(postId) || items.length + 1, title: text.split("\n")[0].slice(0, 80) || "Новость", text: text.slice(0, 400), date: dateStr, photo, link });
    }
    if (items.length > 0) { newsCache = items; newsCacheTime = Date.now(); }
    return newsCache;
  } catch (e) { console.error("fetchNewsPublic:", e.message); return newsCache; }
}

app.get("/news", async (req, res) => {
  const origin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Vary", "Origin");
  try {
    res.json({ posts: newsCache });
    if (Date.now() - newsCacheTime > 300_000) fetchNewsPublic().catch(() => {});
  } catch (e) {
    res.json({ posts: newsCache });
  }
});
setInterval(fetchNewsPublic, 300_000);
fetchNewsPublic().catch(() => {});

// Periodically save all groups to Redis to persist playHours (every 5 min)
setInterval(() => {
  for (const [, g] of groups.entries()) saveGroup(g);
}, 300_000);

// ─── Telegram Bot ──────────────────────────────────────────────────────────────
const TelegramBot = require("node-telegram-bot-api");
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

const botSessions = new Map(); // chatId -> { state, ... }

// ??????????
const USER_KB = {
  keyboard: [
    [{ text: "Профиль" },       { text: "Пополнить баланс" }],
    [{ text: "Мои обращения" }, { text: "Новое обращение"  }],
  ],
  resize_keyboard: true, persistent: true,
};

const ADMIN_KB = {
  keyboard: [
    [{ text: "Тикеты" },  { text: "Профиль" }],
    [{ text: "Баланс участника" }],
  ],
  resize_keyboard: true, persistent: true,
};

function getKb(account) {
  return account?.role === "admin" ? ADMIN_KB : USER_KB;
}

const TICKET_STATUS_LABELS = { open: "открыт", in_progress: "в работе", answered: "ответили", closed: "закрыт" };

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function mainMenu(chatId, account) {
  const name  = sanitizeMarkdown(account?.username || "игрок");
  const bal   = (account?.balance ?? 0).toLocaleString("ru-RU");
  const isAdm = account?.role === "admin";
  bot.sendMessage(chatId,
    `Привет, *${name}*!\n\n` +
    `Баланс: *${bal} СБТ*` +
    (isAdm ? "\n\nРежим администратора." : ""),
    { parse_mode: "Markdown", reply_markup: getKb(account) }
  );
}

// ???????? ?????? ??????? (??? ??????)
async function showAdminTicketList(chatId, filter = "open") {
  const FILTERS = { open: ["open", "in_progress"], answered: ["answered"], all: ["open","in_progress","answered","closed"] };
  const statuses = FILTERS[filter] || FILTERS.open;
  const list = [...tickets.values()]
    .filter(t => statuses.includes(t.status))
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 20);

  const filterBtns = [
    [
      { text: filter === "open"     ? "· Активные ·" : "Активные",     callback_data: "admin_filter_open"     },
      { text: filter === "answered" ? "· Ответили ·" : "Ответили",     callback_data: "admin_filter_answered" },
      { text: filter === "all"      ? "· Все ·"       : "Все",          callback_data: "admin_filter_all"      },
    ],
  ];

  if (list.length === 0) {
    return bot.sendMessage(chatId, "Нет тикетов в этой категории.", {
      reply_markup: { inline_keyboard: filterBtns }
    });
  }

  const ticketBtns = list.map(t => [{
    text: `#${t.id} [${TICKET_STATUS_LABELS[t.status] || t.status}] ${sanitizeMarkdown(t.username)} — ${t.category.slice(0, 20)}${t.unread ? ` (${t.unread} новых)` : ""}`,
    callback_data: `admin_ticket_${t.id}`,
  }]);

  bot.sendMessage(chatId, `*Тикеты* (${list.length}):`, {
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: [...filterBtns, ...ticketBtns] }
  });
}

// ???????? ?????????? ?????
async function showAdminTicket(chatId, ticketId) {
  const t = tickets.get(ticketId);
  if (!t) { bot.sendMessage(chatId, "Тикет не найден."); return; }

  const lastMsgs = t.messages
    .filter(m => m.from !== "system")
    .slice(-5)
    .map(m => `${m.role === "admin" ? "Админ" : m.username}: ${m.text.slice(0, 80)}`)
    .join("\n");

  const statusBtns = Object.entries(TICKET_STATUS_LABELS).map(([k, v]) => ({
    text: t.status === k ? `-+ ${v} -+` : v,
    callback_data: `admin_setstatus_${ticketId}_${k}`,
  }));

  bot.sendMessage(chatId,
    `*Тикет #${t.id}*\n` +
    `Игрок: ${t.username}\n` +
    `Категория: ${t.category}\n` +
    `Статус: ${TICKET_STATUS_LABELS[t.status] || t.status}\n\n` +
    (lastMsgs ? `Последние сообщения:\n${lastMsgs}\n\n` : "") +
    (t.status !== "closed" ? "Отправь сообщение ответом (reply) на это сообщение." : "Тикет закрыт."),
    {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          statusBtns,
          [{ text: "Назад к списку", callback_data: "admin_filter_open" }],
        ]
      }
    }
  );
}

// ─── /start ───────────────────────────────────────────────────────────────────

bot.onText(/\/start(.*)/, async (msg, match) => {
  const tgId    = String(msg.from.id);
  const param   = (match[1] || "").trim();
  const account = await redisAccounts.get(tgId);

  if (param.startsWith("auth_")) {
    const code  = param.slice(5).toUpperCase();
    const entry = authCodes.get(code);
    if (!entry) { bot.sendMessage(msg.chat.id, "Код недействителен или истёк. Попробуй снова в лаунчере.", { reply_markup: getKb(account) }); return; }
    entry.confirmed = true;
    entry.tgUser = { id: msg.from.id, first_name: msg.from.first_name || "", last_name: msg.from.last_name || "", username: msg.from.username || null, auth_date: Math.floor(Date.now() / 1000) };
    const msgText = account
      ? "Авторизация подтверждена! Возвращаемся в меню."
      : "Авторизация подтверждена! Возвращаемся в меню и придумай ник.";
    bot.sendMessage(msg.chat.id, msgText, { reply_markup: getKb(account) });
    return;
  }

  if (param.startsWith("pay_")) {
    const parts       = param.split("_");
    const invoiceId   = parseInt(parts[1], 10);
    const amount      = parseInt(parts[2], 10);
    const method      = parts.slice(3).join("_") || "card_ru";
    const methodLabel = METHOD_NAMES[method] || method;
    const inv         = invoices.get(invoiceId);

    if (inv && !inv.userId) inv.userId = tgId;

    const ticketId = ++ticketCounter;
    const username = account?.username || msg.from?.username || "Telegram";
    const dateStr  = new Date().toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
    const ticket = {
      id: ticketId, userId: tgId, tgChatId: String(msg.chat.id), username,
      category: "Пополнение баланса", preview: `${amount} СБТ · ${methodLabel}`,
      paymentAmount: amount,
      status: "open", unread: 1, invoiceId, createdAt: Date.now(),
      messages: [
        { id: uuidv4(), from: "system", text: `Тикет #${ticketId} создан при пополнении через сайт.`, time: Date.now() },
        { id: uuidv4(), from: tgId, username, text: `Пополнение: ${amount} СБТ · ${methodLabel}`, time: Date.now() },
      ],
    };
    tickets.set(ticketId, ticket);
    saveTicket(ticket);
    broadcastToAdmins({ type: "new_ticket", ticket: ticketSummary(ticket) });
    if (inv) inv.ticketId = ticketId;

    bot.sendMessage(msg.chat.id,
      `*Заявка на пополнение — тикет #${ticketId}*\n\n` +
      `Аккаунт: \`${username}\`\n` +
      `Сумма: *${amount} СБТ* (${amount} СБТ)\n` +
      `Способ: ${methodLabel}\n` +
      `Дата: ${dateStr}\n\n` +
      `Администратор ответит здесь и пришлёт реквизиты. После оплаты нажми кнопку и прикрепи скриншот чека.`,
      { parse_mode: "Markdown", reply_markup: { inline_keyboard: [
        [{ text: "Отправить чек",        callback_data: `send_receipt_${ticketId}` }],
        [{ text: "Написать в поддержку", callback_data: "new_ticket_cb"            }],
      ]}}
    );
    return;
  }

  if (param.startsWith("link_")) {
    const linkCode = param.slice(5);
    const target   = [...redisAccounts._map.values()].find(a => a.linkCode === linkCode);
    if (target) {
      target.telegramId = tgId; target.telegram = msg.from.username || null; delete target.linkCode;
      await redisAccounts.set(target.id, target);
      bot.sendMessage(msg.chat.id, `Telegram привязан к аккаунту \`${target.username}\`.`, { parse_mode: "Markdown", reply_markup: getKb(account) });
      return;
    }
  }

  // /start ref_XXXXXX — referral tracking
  if (param.startsWith("ref_")) {
    const refCode = param.slice(4).toUpperCase();
    // Store referral code for this user
    if (!account) {
      // New user: store pending referral for later
      botSessions.set(msg.chat.id, { state: "awaiting_nick", pendingReferral: refCode });
      bot.sendMessage(msg.chat.id, "Привет! Придумай игровой ник (3–16 символов, буквы/цифры/_):");
      return;
    }
    // Existing user: track referral
    const referrerData = [...referralData.values()].find(d => d.code === refCode);
    if (referrerData) {
      const myData = ensureReferralData(tgId);
      if (!myData.referredBy) {
        myData.referredBy = [...referralData.entries()].find(([, d]) => d === referrerData)?.[0];
        if (myData.referredBy && myData.referredBy !== tgId) {
          referrerData.referralCount = (referrerData.referralCount || 0) + 1;
          referrerData.referrals.push({ tgId, nick: account.username, joinedAt: new Date().toISOString(), totalDonated: 0 });
          referrerData.levelPercent = getAffiliateLevel(referrerData.referralCount).percent;
          const referrerTgId = myData.referredBy;
          await saveReferral(referrerTgId, referrerData);
          await saveReferral(tgId, myData);
          bot.sendMessage(msg.chat.id, "Ты зарегистрирован по партнёрской ссылке! Начни играть на серверах.");
        }
      }
    }
    mainMenu(msg.chat.id, account);
    return;
  }

  mainMenu(msg.chat.id, account);
});

// --- ????????? ?????? ?????? --------------------------------------------------

bot.on("text", async (msg) => {
  if (msg.text?.startsWith("/")) return;
  const chatId  = msg.chat.id;
  const tgId    = String(msg.from.id);
  const account = await redisAccounts.get(tgId);
  if (botSessions.get(chatId)) return;

  const isAdm = account?.role === "admin" || isAdminId(tgId);

  // -- ????? --
  if (isAdm) {
    if (msg.text === "Тикеты") {
      await showAdminTicketList(chatId, "open");
      return;
    }
    if (msg.text === "Профиль") {
      bot.sendMessage(chatId,
        `*Профиль*\n\nНик: \`${account?.username || "—"}\`\nID: \`${tgId}\`\nРоль: администратор\nБаланс: ${(account?.balance ?? 0).toLocaleString("ru-RU")} СБТ`,
        { parse_mode: "Markdown", reply_markup: ADMIN_KB }
      );
      return;
    }
    if (msg.text === "Баланс участника") {
      botSessions.set(chatId, { state: "admin_awaiting_balance_nick" });
      bot.sendMessage(chatId, "Введи ник или TG ID участника:");
      return;
    }
    return;
  }

  // -- ???????????? --
  switch (msg.text) {
    case "Профиль": {
      if (!account) { bot.sendMessage(chatId, "Аккаунт не найден. Войди в лаунчер через Telegram.", { reply_markup: USER_KB }); return; }
      const regDate = new Date(account.createdAt).toLocaleDateString("ru-RU");
      bot.sendMessage(chatId,
        `*Профиль*\n\nНик: \`${account.username}\`\nID: \`${account.id}\`\nБаланс: *${(account.balance ?? 0).toLocaleString("ru-RU")} СБТ*\nРоль: ${account.role === "admin" ? "администратор" : "пользователь"}\nTelegram: ${account.telegram ? `@${account.telegram}` : "не привязан"}\nДата рег.: ${regDate}`,
        { parse_mode: "Markdown", reply_markup: USER_KB }
      );
      return;
    }
    case "Пополнить баланс": {
      bot.sendMessage(chatId, "*Пополнение баланса*\n\nВыбери сумму:", {
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: [
          [{ text: "50 СБТ",   callback_data: "topup_50"   }, { text: "100 СБТ",  callback_data: "topup_100"  }, { text: "200 СБТ",  callback_data: "topup_200"  }],
          [{ text: "500 СБТ",  callback_data: "topup_500"  }, { text: "1000 СБТ", callback_data: "topup_1000" }, { text: "2000 СБТ", callback_data: "topup_2000" }],
          [{ text: "Другая сумма", callback_data: "topup_custom" }],
        ]}
      });
      return;
    }
    case "Мои обращения": {
      const list = [...tickets.values()].filter(t => t.userId === tgId).sort((a, b) => b.createdAt - a.createdAt).slice(0, 10);
      if (list.length === 0) { bot.sendMessage(chatId, "*Обращения*\n\nУ тебя пока нет обращений.", { parse_mode: "Markdown", reply_markup: USER_KB }); return; }
      const STATUS = { open: "открыт", in_progress: "в работе", answered: "ответили", closed: "закрыт" };
      const lines = list.map(t => `*#${t.id}*  [${STATUS[t.status] || t.status}]  ${t.category}\n${t.preview?.slice(0, 55)}`).join("\n\n");
      bot.sendMessage(chatId, `*Обращения*\n\n${lines}`, { parse_mode: "Markdown", reply_markup: USER_KB });
      return;
    }
    case "Новое обращение": {
      botSessions.set(chatId, { state: "awaiting_ticket_desc", category: null });
      bot.sendMessage(chatId, "Выбери категорию обращения:", {
        reply_markup: { inline_keyboard: [
          [{ text: "Технические проблемы", callback_data: "tcat_tech"    }],
          [{ text: "Вопрос по аккаунту",   callback_data: "tcat_account" }],
          [{ text: "Вопрос по покупке",     callback_data: "tcat_pay"     }],
          [{ text: "Баг или ошибка",        callback_data: "tcat_bug"     }],
          [{ text: "Жалоба на игрока",      callback_data: "tcat_report"  }],
          [{ text: "Другое",                callback_data: "tcat_other"   }],
        ]}
      });
      return;
    }
  }
});

// ─── Callback кнопки ──────────────────────────────────────────────────────────

bot.on("callback_query", async (q) => {
  const tgId    = String(q.from.id);
  const chatId  = q.message.chat.id;
  const account = await redisAccounts.get(tgId);
  const isAdm   = account?.role === "admin" || isAdminId(tgId);
  // Note: each branch below calls answerCallbackQuery itself (with alert text where useful).
  // A bare ack for any branch that doesn't answer explicitly:
  const ackOnce = (() => { let done = false; return (opts) => { if (done) return; done = true; try { bot.answerCallbackQuery(q.id, opts); } catch {} }; })();

  // -- ?????: ?????? ??????? --
  if (q.data.startsWith("admin_filter_")) {
    if (!isAdm) return;
    const filter = q.data.replace("admin_filter_", "");
    await showAdminTicketList(chatId, filter);
    return;
  }

  // -- ?????: ??????? ????? --
  if (q.data.startsWith("admin_ticket_")) {
    if (!isAdm) return;
    const ticketId = parseInt(q.data.replace("admin_ticket_", ""), 10);
    botSessions.set(chatId, { state: "admin_viewing_ticket", ticketId });
    await showAdminTicket(chatId, ticketId);
    return;
  }

  // -- ?????: ??????? ?????? --
  if (q.data.startsWith("admin_setstatus_")) {
    if (!isAdm) return;
    const [, , ticketIdStr, status] = q.data.split("_");
    const ticketId = parseInt(ticketIdStr, 10);
    const t = tickets.get(ticketId);
    if (t) {
      t.status = status;
      t.messages.push({ id: uuidv4(), from: "system", text: `Статус изменён: ${STATUS_LABELS[status] || status}`, time: Date.now() });
      broadcastToAdmins({ type: "ticket_update", ticket: ticketSummary(t) });
      broadcastToTicket(ticketId, null, { type: "ticket_update", ticket: ticketSummary(t) });
      // ????????? ????????????
      if (status === "answered") {
        try { await bot.sendMessage(t.userId, `По твоему тикету \`#${ticketId}\` пришёл ответ. Проверь на сайте или нажми "Мои обращения".`, { parse_mode: "Markdown", reply_markup: USER_KB }); } catch {}
      }
      bot.answerCallbackQuery(q.id, { text: `Статус: ${TICKET_STATUS_LABELS[status]}`, show_alert: false });
      await showAdminTicket(chatId, ticketId);
    }
    return;
  }

  // -- ?????????? --
  if (q.data.startsWith("topup_")) {
    const sub = q.data.split("_")[1];
    if (sub === "custom") {
      botSessions.set(chatId, { state: "awaiting_topup_amount" });
      bot.sendMessage(chatId, "Введи сумму пополнения в рублях:", { reply_markup: { force_reply: true, input_field_placeholder: "Например: 350" } });
      return;
    }
    const amount = parseInt(sub, 10);
    if (!account) { bot.sendMessage(chatId, "Войди в лаунчер через Telegram.", { reply_markup: USER_KB }); return; }
    const ticketId = ++ticketCounter;
    const dateStr  = new Date().toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
    const t = { id: ticketId, userId: tgId, tgChatId: String(chatId), username: account.username, category: "Пополнение баланса", preview: `${amount} СБТ · через бота`, paymentAmount: amount, status: "open", unread: 1, createdAt: Date.now(), messages: [
      { id: uuidv4(), from: "system", text: `Тикет #${ticketId} создан через бота.`, time: Date.now() },
      { id: uuidv4(), from: tgId, username: account.username, text: `Пополнение на ${amount} СБТ`, time: Date.now() },
    ]};
    tickets.set(ticketId, t);
    saveTicket(t);
    broadcastToAdmins({ type: "new_ticket", ticket: ticketSummary(t) });
    bot.sendMessage(chatId,
      `*Заявка на пополнение — тикет #${ticketId}*\n\nАккаунт: \`${account.username}\`\nСумма: *${amount} СБТ* (${amount} СБТ)\nДата: ${dateStr}\n\nАдминистратор ответит и пришлёт реквизиты. После оплаты нажми кнопку и прикрепи скриншот чека.`,
      { parse_mode: "Markdown", reply_markup: { inline_keyboard: [
        [{ text: "Отправить чек",        callback_data: `send_receipt_${ticketId}` }],
        [{ text: "Написать в поддержку", callback_data: "new_ticket_cb"            }],
      ]}}
    );
    return;
  }

  // ── Новое обращение inline ──
  if (q.data === "new_ticket_cb") {
    botSessions.set(chatId, { state: "awaiting_ticket_desc", category: null });
    bot.sendMessage(chatId, "Выбери категорию обращения:", {
      reply_markup: { inline_keyboard: [
        [{ text: "Технические проблемы", callback_data: "tcat_tech"    }],
        [{ text: "Вопрос по аккаунту",   callback_data: "tcat_account" }],
        [{ text: "Вопрос по покупке",     callback_data: "tcat_pay"     }],
        [{ text: "Баг или ошибка",        callback_data: "tcat_bug"     }],
        [{ text: "Жалоба на игрока",      callback_data: "tcat_report"  }],
        [{ text: "Другое",                callback_data: "tcat_other"   }],
      ]}
    });
    return;
  }

  // -- ????????? ?????? --
  const CAT_MAP = { tcat_tech: "Технические проблемы", tcat_account: "Вопрос по аккаунту", tcat_pay: "Вопрос по покупке", tcat_bug: "Баг или ошибка", tcat_report: "Жалоба на игрока", tcat_other: "Другое" };
  if (q.data in CAT_MAP) {
    const category = CAT_MAP[q.data];
    botSessions.set(chatId, { state: "awaiting_ticket_desc", category });
    bot.sendMessage(chatId, `Категория: *${category}*\n\nОпиши проблему подробно:`, { parse_mode: "Markdown" });
    return;
  }

  // -- ????????? ??? --
  if (q.data.startsWith("send_receipt_")) {
    const ticketId = parseInt(q.data.split("_")[2], 10);
    botSessions.set(chatId, { state: "awaiting_receipt", ticketId });
    bot.sendMessage(chatId, `Тикет \`#${ticketId}\` — прикрепи скриншот или фото чека следующим сообщением.`,
      { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "Отмена", callback_data: "cancel_input" }]] } }
    );
    return;
  }

  // -- ???????????/????????? ?????? --
  if (q.data.startsWith("confirm_pay_")) {
    if (!isAdm) { bot.answerCallbackQuery(q.id, { text: "Нет прав.", show_alert: true }); return; }
    const parts    = q.data.split("_");
    const ticketId = parseInt(parts[2], 10);
    const userId   = parts[3];
    const ticket   = tickets.get(ticketId);
    // Сумма берётся ТОЛЬКО из серверного источника (тикет). Никакого fallback на
    // callback_data — иначе в баланс может попасть число из строки кнопки.
    if (!ticket) {
      bot.answerCallbackQuery(q.id, { text: "Тикет не найден.", show_alert: true });
      return;
    }
    const amount = Number(ticket.paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      bot.answerCallbackQuery(q.id, { text: "У тикета нет суммы пополнения. Зачислите вручную через веб.", show_alert: true });
      return;
    }
    const acc = await redisAccounts.get(userId);
    if (!acc) {
      bot.answerCallbackQuery(q.id, { text: "Аккаунт не найден.", show_alert: true });
      return;
    }
    acc.balance = (acc.balance || 0) + amount;
    await redisAccounts.set(userId, acc);
    if (ticket) { ticket.status = "closed"; ticket.messages.push({ id: uuidv4(), from: "system", text: `Оплата подтверждена. Зачислено ${amount} СБТ.`, time: Date.now() }); saveTicket(ticket); broadcastToAdmins({ type: "ticket_update", ticket: ticketSummary(ticket) }); }
    try { await bot.sendMessage(userId, `Оплата подтверждена.\n+*${amount} СБТ* зачислено. Баланс: *${acc.balance.toLocaleString("ru-RU")} СБТ*`, { parse_mode: "Markdown", reply_markup: USER_KB }); } catch {}
    sendToUser(userId, { type: "balance_update", balance: acc.balance });
    bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: q.message.message_id }).catch(() => {});
    bot.answerCallbackQuery(q.id, { text: `+${amount} СБТ зачислено`, show_alert: true });
    return;
  }

  if (q.data.startsWith("reject_pay_")) {
    if (!isAdm) { bot.answerCallbackQuery(q.id, { text: "Нет прав.", show_alert: true }); return; }
    const parts    = q.data.split("_");
    const ticketId = parseInt(parts[2], 10);
    const userId   = parts[3];
    const ticket   = tickets.get(ticketId);
    if (ticket) { ticket.status = "open"; ticket.messages.push({ id: uuidv4(), from: "system", text: "Оплата отклонена.", time: Date.now() }); broadcastToAdmins({ type: "ticket_update", ticket: ticketSummary(ticket) }); }
    try { await bot.sendMessage(userId, `Оплата по тикету \`#${ticketId}\` не подтверждена. Напишите в поддержку.`, { parse_mode: "Markdown", reply_markup: USER_KB }); } catch {}
    bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: q.message.message_id }).catch(() => {});
    bot.answerCallbackQuery(q.id, { text: "Оплата отклонена.", show_alert: true });
    return;
  }

  if (q.data === "cancel_input") {
    botSessions.delete(chatId);
    mainMenu(chatId, account);
    return;
  }
});

// --- ????????? (?????????) ----------------------------------------------------

bot.on("message", async (msg) => {
  if (msg.text?.startsWith("/")) return;
  const chatId  = msg.chat.id;
  const tgId    = String(msg.from.id);
  const account = await redisAccounts.get(tgId);
  const session = botSessions.get(chatId);
  const isAdm   = account?.role === "admin" || isAdminId(tgId);

  // ── АДМИН: reply на тикет ──
  if (!session && isAdm && msg.reply_to_message) {
    const replyText = msg.reply_to_message.caption || msg.reply_to_message.text || "";
    const match     = replyText.match(/ticket[:\s#]+(\d+)/i);
    if (match) {
      const ticketId = parseInt(match[1], 10);
      const ticket   = tickets.get(ticketId);
      if (ticket && ticket.status !== "closed") {
        const text = msg.text?.trim();
        if (!text) return;
        const message = { id: uuidv4(), from: tgId, username: account?.username || "admin", role: "admin", text, time: Date.now() };
        ticket.messages.push(message);
        ticket.status = "answered";
        ticket.unread  = 0;
        broadcastToAdmins({ type: "ticket_update", ticket: ticketSummary(ticket) });
        broadcastToTicket(ticketId, tgId, { type: "message", ticketId, message });
        try { await bot.sendMessage(ticket.userId, `Ответ по тикету \`#${ticketId}\`:\n\n${text}`, { parse_mode: "Markdown", reply_markup: USER_KB }); } catch {}
        bot.sendMessage(chatId, `Ответ отправлен по тикету #${ticketId}.`);
        return;
      }
    }
  }

  // -- ?????: ???????? ?????? — ????? = ????? ? ????? --
  if (!session && isAdm) return;

  // -- ???????????? ?????? (??? ??????) --
  if (!session && msg.text) {
    const text = msg.text.trim();

    // ???????????????? ??????
    if (text === "Профиль") {
      if (!account) return bot.sendMessage(chatId, "Аккаунт не найден. Войди в лаунчер через Telegram.", { reply_markup: USER_KB });
      const isAdm2 = account.role === "admin";
      return bot.sendMessage(chatId,
        `*${account.username}*\n\nID: \`${account.id}\`\nБаланс: *${(account.balance ?? 0).toLocaleString("ru-RU")} СБТ*\nРоль: ${isAdm2 ? "администратор" : "игрок"}\nTelegram: ${account.telegram ? `@${account.telegram}` : "—"}`,
        { parse_mode: "Markdown", reply_markup: getKb(account) }
      );
    }

    if (text === "Пополнить баланс") {
      return bot.sendMessage(chatId, "💰 *Пополнение баланса*\n\nВыбери сумму:", {
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: [
          [{ text: "50 СБТ",  callback_data: "topup_50"  }, { text: "100 СБТ", callback_data: "topup_100" }],
          [{ text: "250 СБТ", callback_data: "topup_250" }, { text: "500 СБТ", callback_data: "topup_500" }],
          [{ text: "1000 СБТ", callback_data: "topup_1000" }],
          [{ text: "Другая сумма", callback_data: "topup_custom" }],
        ]}
      });
    }

    if (text === "Мои обращения") {
      const userTickets = [...tickets.values()]
        .filter(t => t.userId === tgId || (account && t.userId === account.id))
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 10);
      if (userTickets.length === 0) {
        return bot.sendMessage(chatId, "🎫 Нет обращений.", { reply_markup: USER_KB });
      }
      const lines = userTickets.map(t => {
        const emoji = { open: "🔴", answered: "🟢", closed: "⚫", in_progress: "🟡" }[t.status] || "⚪";
        return `${emoji} *#${t.id}* — ${t.category}\n└ _${t.preview?.slice(0, 50)}_`;
      }).join("\n\n");
      return bot.sendMessage(chatId, `🎫 *Твои обращения:*\n\n${lines}`, { parse_mode: "Markdown", reply_markup: USER_KB });
    }

    if (text === "Новое обращение") {
      return bot.sendMessage(chatId, "Выбери категорию обращения:", {
        reply_markup: { inline_keyboard: [
          [{ text: "🔧 Тех. проблемы",  callback_data: "tcat_tech"    }],
          [{ text: "👤 Аккаунт",         callback_data: "tcat_account" }],
          [{ text: "💳 Покупка",         callback_data: "tcat_pay"     }],
          [{ text: "🐛 Баг / ошибка",    callback_data: "tcat_bug"     }],
          [{ text: "⚠️ Жалоба",          callback_data: "tcat_report"  }],
          [{ text: "❓ Другое",           callback_data: "tcat_other"   }],
        ]}
      });
    }

    // ????????? ??????
    if (isAdm && text === "Тикеты") {
      return showAdminTicketList(chatId, "open");
    }

    if (isAdm && text === "Баланс участника") {
      botSessions.set(chatId, { state: "admin_awaiting_balance_nick" });
      return bot.sendMessage(chatId, "Введи ник или TG ID участника:");
    }
  }

  if (!session) return;

  // Waiting for nick (new user from /start ref_XXXXXX)
  if (session.state === "awaiting_nick") {
    const clean = (msg.text || "").trim().replace(/^@/, "");
    if (!/^[a-zA-Z0-9_]{3,16}$/.test(clean)) {
      bot.sendMessage(chatId, "Ник: 3–16 символов, только буквы/цифры/_. Попробуй ещё раз:");
      return;
    }
    const adminRole = isAdmin(msg.from.username || clean) || isAdminId(tgId) ? "admin" : "user";
    const newAccount = { id: tgId, username: clean, telegram: msg.from.username || null, firstName: sanitize(msg.from.first_name || "", 64), balance: 0, role: adminRole, createdAt: Date.now() };
    await redisAccounts.set(tgId, newAccount);
    botSessions.delete(chatId);
    // Track referral
    if (session.pendingReferral) {
      const refCode = session.pendingReferral;
      let referrerId = null;
      for (const [rid, data] of referralData) {
        if (data.code === refCode) { referrerId = rid; break; }
      }
      if (referrerId && referrerId !== tgId) {
        const referrerData = ensureReferralData(referrerId);
        referrerData.referralCount = (referrerData.referralCount || 0) + 1;
        referrerData.referrals.push({ tgId, nick: clean, joinedAt: new Date().toISOString(), totalDonated: 0 });
        referrerData.levelPercent = getAffiliateLevel(referrerData.referralCount).percent;
        await saveReferral(referrerId, referrerData);
        const newData = ensureReferralData(tgId);
        newData.referredBy = referrerId;
        await saveReferral(tgId, newData);
      }
    }
    bot.sendMessage(chatId, `Добро пожаловать, *${sanitizeMarkdown(clean)}*! Ты теперь в системе.`, { parse_mode: "Markdown", reply_markup: USER_KB });
    return;
  }

  // ???? ????????? ?????
  if (session.state === "awaiting_topup_amount") {
    const amount = parseInt(msg.text?.trim(), 10);
    botSessions.delete(chatId);
    if (!amount || amount < 50 || amount > 100000) { bot.sendMessage(chatId, "Сумма должна быть от 50 до 100 000 СБТ.", { reply_markup: USER_KB }); return; }
    if (!account) { bot.sendMessage(chatId, "Войди в лаунчер через Telegram.", { reply_markup: USER_KB }); return; }
    const ticketId = ++ticketCounter;
    const dateStr  = new Date().toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
    const t = { id: ticketId, userId: tgId, tgChatId: String(chatId), username: account.username, category: "Пополнение баланса", preview: `${amount} СБТ · через бота`, paymentAmount: amount, status: "open", unread: 1, createdAt: Date.now(), messages: [
      { id: uuidv4(), from: "system", text: `Тикет #${ticketId} создан через бота.`, time: Date.now() },
      { id: uuidv4(), from: tgId, username: account.username, text: `Пополнение на ${amount} СБТ`, time: Date.now() },
    ]};
    tickets.set(ticketId, t);
    saveTicket(t);
    broadcastToAdmins({ type: "new_ticket", ticket: ticketSummary(t) });
    bot.sendMessage(chatId,
      `*Заявка на пополнение — тикет #${ticketId}*\n\nАккаунт: \`${account.username}\`\nСумма: *${amount} СБТ* (${amount} СБТ)\nДата: ${dateStr}\n\nАдминистратор ответит и пришлёт реквизиты. После оплаты нажми кнопку и прикрепи скриншот чека.`,
      { parse_mode: "Markdown", reply_markup: { inline_keyboard: [
        [{ text: "Отправить чек",        callback_data: `send_receipt_${ticketId}` }],
        [{ text: "Написать в поддержку", callback_data: "new_ticket_cb"            }],
      ]}}
    );
    return;
  }

  // -- ?????: ????? ??????? ????????? --
  if (session.state === "admin_awaiting_balance_nick") {
    botSessions.delete(chatId);
    const q = msg.text?.trim();
    const found = [...redisAccounts._map.values()].find(a =>
      a.username?.toLowerCase() === q.toLowerCase() ||
      a.telegram?.toLowerCase() === q.replace("@","").toLowerCase() ||
      a.id === q
    );
    if (!found) { bot.sendMessage(chatId, "Пользователь не найден.", { reply_markup: ADMIN_KB }); return; }
    bot.sendMessage(chatId,
      `*${found.username}*\nID: \`${found.id}\`\nTelegram: ${found.telegram ? `@${found.telegram}` : "—"}\nБаланс: *${(found.balance ?? 0).toLocaleString("ru-RU")} СБТ*\nРоль: ${found.role}`,
      { parse_mode: "Markdown", reply_markup: { inline_keyboard: [
        [{ text: "Добавить 100 СБТ",  callback_data: `bal_add_${found.id}_100`  },
         { text: "Добавить 500 СБТ",  callback_data: `bal_add_${found.id}_500`  }],
        [{ text: "Обнулить баланс",   callback_data: `bal_zero_${found.id}`     }],
      ]}
    });
    return;
  }

  // ????????? ????
  if (session.state === "awaiting_receipt") {
    const ticketId = session.ticketId;
    const ticket   = tickets.get(ticketId);
    const hasPhoto = msg.photo?.length > 0;
    const hasDoc   = !!msg.document;
    if (!hasPhoto && !hasDoc) { bot.sendMessage(chatId, "Пришли фото или скриншот (файл)."); return; }
    botSessions.delete(chatId);
    if (ticket) {
      const fileId = hasPhoto ? msg.photo[msg.photo.length - 1].file_id : msg.document.file_id;
      ticket.messages.push({ id: uuidv4(), from: tgId, username: account?.username || "Telegram", text: `[чек, file_id: ${fileId}]`, time: Date.now() });
      ticket.unread = (ticket.unread || 0) + 1; ticket.status = "open";
      broadcastToAdmins({ type: "ticket_update", ticket: ticketSummary(ticket) });
    }
    for (const [tid, acc] of redisAccounts._map.entries()) {
      if (acc.role !== "admin") continue;
      try {
        const inv       = ticket ? [...invoices.values()].find(i => i.ticketId === ticketId) : null;
        const invAmount = inv?.amount || "?";
        const invMethod = inv ? (METHOD_NAMES[inv.method] || inv.method) : "?";
        const caption   = `Чек на пополнение\n\nИгрок: ${account?.username || tgId}\nСумма: ${invAmount} СБТ\nСпособ: ${invMethod}\nТикет: #${ticketId}`;
        const rm        = { inline_keyboard: [[
          { text: "Подтвердить", callback_data: `confirm_pay_${ticketId}_${tgId}_${invAmount}` },
          { text: "Отклонить",   callback_data: `reject_pay_${ticketId}_${tgId}` },
        ]]};
        if (hasPhoto) await bot.sendPhoto(tid, msg.photo[msg.photo.length - 1].file_id, { caption, reply_markup: rm });
        else          await bot.sendDocument(tid, msg.document.file_id, { caption, reply_markup: rm });
      } catch (e) { console.error("[admin notify]", e.message); }
    }
    bot.sendMessage(chatId, `Чек получен. Тикет \`#${ticketId}\` обновлён — администратор проверит оплату и зачислит баланс.`, { parse_mode: "Markdown", reply_markup: USER_KB });
    return;
  }

  // ???????? ??????
  if (session.state === "awaiting_ticket_desc") {
    const text = msg.text?.trim();
    if (!text || text.length < 5) { bot.sendMessage(chatId, "Слишком короткое описание. Напиши подробнее."); return; }
    const ticketId = ++ticketCounter;
    const ticket = { id: ticketId, userId: tgId, username: account?.username || msg.from.username || "Telegram", category: session.category || "Другое", preview: text.slice(0, 60), status: "open", unread: 1, createdAt: Date.now(), messages: [
      { id: uuidv4(), from: "system", text: `Тикет #${ticketId} создан.`, time: Date.now() },
      { id: uuidv4(), from: tgId, username: account?.username || "Telegram", text, time: Date.now() },
    ]};
    tickets.set(ticketId, ticket);
    saveTicket(ticket);
    botSessions.delete(chatId);
    broadcastToAdmins({ type: "new_ticket", ticket: ticketSummary(ticket) });
    bot.sendMessage(chatId,
      `Обращение создано.\n\nТикет \`#${ticketId}\` — ${ticket.category}.\nОтветим как можно скорее.`,
      { parse_mode: "Markdown", reply_markup: USER_KB }
    );
  }
});

// ── Баланс участника (inline, для admin) ──
bot.on("callback_query", async (q) => {});
// Дополнительный listener для bal_ коллбеков — уже обработан выше, добавим inline
// Нужно перехватить bal_ в основном callback handler — добавим перед cancel_input

// Патч: вешаем ещё один listener для bal_
const origListeners = bot.listeners("callback_query").slice();
bot.removeAllListeners("callback_query");
bot.on("callback_query", async (q) => {
  const tgId  = String(q.from.id);
  const chatId = q.message.chat.id;
  const isAdm  = isAdminId(tgId) || (await redisAccounts.get(tgId))?.role === "admin";

  if (q.data.startsWith("bal_")) {
    if (!isAdm) { bot.answerCallbackQuery(q.id, { text: "Нет прав.", show_alert: true }); return; }
    const parts  = q.data.split("_");
    const action = parts[1]; // add | zero
    const userId = parts[2];
    const amount = parseInt(parts[3] || "0", 10);
    const acc    = await redisAccounts.get(userId);
    if (!acc) { bot.answerCallbackQuery(q.id, { text: "Пользователь не найден.", show_alert: true }); return; }
    if (action === "add") acc.balance = (acc.balance || 0) + amount;
    if (action === "zero") acc.balance = 0;
    await redisAccounts.set(userId, acc);
    sendToUser(userId, { type: "balance_update", balance: acc.balance });
    bot.answerCallbackQuery(q.id, { text: `Баланс: ${acc.balance} СБТ`, show_alert: true });
    bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: q.message.message_id }).catch(() => {});
    return;
  }

  // Передаём остальным listeners
  for (const fn of origListeners) fn(q);
});

bot.on("polling_error", (err) => { if (!err.message?.includes("409")) console.error("[bot]", err.message); });


// --- API: server online counts ------------------------------------------------
app.get("/api/servers/online", (_req, res) => {
  res.json({ starwars: 0, minigames: 0, gta: 0, vanilla_plus: 0, anarchy: 0 });
});

// --- API: modpack manifest ----------------------------------------------------
const MODPACK_DIR = process.env.MODPACK_DIR || "/opt/sbgames-modpack";
const _path = require("path");
app.get("/api/mods/manifest", (_req, res) => {
  try {
    if (!fs.existsSync(MODPACK_DIR)) return res.json({ version: "", mods: [] });
    const versions = fs.readdirSync(MODPACK_DIR).filter(d => {
      try { return fs.statSync(_path.join(MODPACK_DIR, d)).isDirectory(); } catch { return false; }
    });
    if (versions.length === 0) return res.json({ version: "", mods: [] });
    versions.sort((a, b) => {
      return fs.statSync(_path.join(MODPACK_DIR, b)).mtimeMs
           - fs.statSync(_path.join(MODPACK_DIR, a)).mtimeMs;
    });
    const latest = versions[0];
    const modsDir = _path.join(MODPACK_DIR, latest, "mods");
    if (!fs.existsSync(modsDir)) return res.json({ version: latest, mods: [] });
    const mods = [];
    for (const f of fs.readdirSync(modsDir)) {
      if (!f.endsWith(".jar") && !f.endsWith(".disabled")) continue;
      try {
        const fp = _path.join(modsDir, f);
        const buf = fs.readFileSync(fp);
        const sha = crypto.createHash("sha256").update(buf).digest("hex");
        mods.push({ name: f, sha256: sha, size: buf.length });
      } catch {}
    }
    res.set("Cache-Control", "no-store");
    res.json({ version: latest, mods });
  } catch (e) {
    console.error("[api/mods/manifest]", e.message);
    res.json({ version: "", mods: [] });
  }
});

// --- Forum articles (Redis-backed, AI-generated + admin-managed) -------------
// Хранение: forum:article:<slug> = {slug,title,category,version,tags[],excerpt,
//   body(md),author,publishedAt,ai}. Сводный список forum:articles = [slug,...]
// Доступ: публичное чтение, запись/генерация — только админ.
const FORUM_AI_API = process.env.AI_API_BASE || "http://localhost:3264/api";
const FORUM_AI_MODEL = process.env.AI_MODEL || "qwen-max";
const FORUM_AI_TIMEOUT = parseInt(process.env.AI_TIMEOUT_MS || "360000", 10);

const FORUM_SYSTEM_PROMPT = `Ты — опытный игрок и автор контента по Minecraft с 10-летним стажем.
Пишешь для русскоязычного сообщества (геймеры, ищут конкретные ответы в Google/Yandex).
Задача — СВЕЖИЕ, ПОЛЕЗНЫЕ, УНИКАЛЬНЫЕ статьи, которые реально помогают и ранжируются в поиске.

КАК ПИСАТЬ (живой человек):
- От первого лица, как игрок делится опытом: «по моему опыту», «обычно делаю так».
- Разговорный, грамотный тон. Без канцелярита и воды.
- Чередуй длину предложений. Сразу к делу — без «в современном мире», «важно отметить».
- Личные наблюдения и подводные камни, которых нет в вики.

ЧЕГО НЕ ДЕЛАТЬ (штампы = брак):
- Клише: «в заключение», «стоит отметить», «играет важную роль», «открывает горизонты».
- Водные абзацы ради объёма. Каждое предложение несёт информацию.
- Выдуманные версии/моды/фичи. Не уверен — пиши общие принципы.
- Эмодзи без нужды.

АКТУАЛЬНОСТЬ: всегда указывай версию MC/модлоадер. Описывай РЕАЛЬНЫЕ фичи.

SEO: один H1, подзаголовки H2/H3 с ключевыми словами, ключ в заголовке и первых абзацах.
Длина 700–1400 слов.

ФОРМАТ (СТРОГО): верни ТОЛЬКО Markdown с YAML frontmatter, без обёрток и пояснений:
---
slug: kebab-case-на-латинице
title: "Заголовок на русском с ключевым словом"
category: <укажу в задании>
version: "1.20.1"
tags: [ключевые, слова]
excerpt: "1-2 предложения для meta description."
author: "SB Games"
---
Дальше тело статьи.`;

// Slug для форума: kebab-case (дефис, не подчёркивание), до 80 символов.
function forumSlug(s) {
  const map = {а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'ts',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya'};
  return String(s||'').toLowerCase().replace(/[а-яё]/g, c => map[c]||c).replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80) || "article";
}

// Публичный список статей (с фильтром по категории, без тела — для каталога)
app.get("/forum/articles", async (req, res) => {
  try {
    const slugs = await redis.smembers("forum:articles");
    const cat = req.query.category;
    const out = [];
    for (const slug of slugs) {
      const raw = await redis.get(`forum:article:${slug}`);
      if (!raw) continue;
      const a = JSON.parse(raw);
      if (cat && a.category !== cat) continue;
      const { body, ...meta } = a;
      out.push(meta);
    }
    out.sort((a, b) => (b.publishedAt || "").localeCompare(a.publishedAt || ""));
    res.json(out);
  } catch (e) { res.status(500).json({ message: "Forum error", error: e.message }); }
});

// Публичное чтение одной статьи (с телом)
app.get("/forum/articles/:slug", async (req, res) => {
  try {
    const raw = await redis.get(`forum:article:${req.params.slug}`);
    if (!raw) return res.status(404).json({ message: "Not found" });
    res.json(JSON.parse(raw));
  } catch (e) { res.status(500).json({ message: "Forum error" }); }
});

// AI-генерация статьи (админ). Тело: {topic, category, angle?, version?}
app.post("/admin/forum/generate", async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  const { topic, category, angle, version } = req.body || {};
  if (!topic || !category) return res.status(400).json({ message: "Нужны topic и category" });
  const VALID = ["mods","articles","textures","maps","skins","shaders","modpacks"];
  if (!VALID.includes(category)) return res.status(400).json({ message: "Неверная категория" });

  const catLabel = {mods:"мод",articles:"статья/гайд",textures:"текстуры",maps:"карта",skins:"скин",shaders:"шейдер",modpacks:"сборка модов"}[category] || "статья";
  const userPrompt = `Напиши ${catLabel} по запросу: "${topic}".
Категория (поле category): ${category}. Версия Minecraft: ${version || "1.20.1"}.
Фокус: ${angle || "общий полезный гайд"}.
Реальные факты о Minecraft ${version || "1.20.1"}. В поле category поставь: ${category}.
Верни ТОЛЬКО Markdown с frontmatter.`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FORUM_AI_TIMEOUT);
  let aiText;
  try {
    const r = await fetch(`${FORUM_AI_API}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: FORUM_AI_MODEL, temperature: 0.85, messages: [
        { role: "system", content: FORUM_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ]}),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!r.ok) { const t = await r.text().catch(()=> ""); return res.status(502).json({ message: "AI error", detail: t.slice(0,300) }); }
    const data = await r.json();
    aiText = data?.choices?.[0]?.message?.content || data?.content || "";
  } catch (e) {
    clearTimeout(timer);
    return res.status(502).json({ message: "AI недоступен", detail: e.message });
  }
  if (!aiText) return res.status(502).json({ message: "AI вернул пустой ответ" });

  // Парс frontmatter
  const m = aiText.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!m) return res.status(502).json({ message: "AI вернул не Markdown с frontmatter", raw: aiText.slice(0,300) });
  const fm = m[1], body = m[2];
  const get = k => { const r = fm.match(new RegExp(`^${k}:\\s*(.+)$`,"m")); return r ? r[1].trim().replace(/^["']|["']$/g,"") : null; };
  const getArr = k => { const r = fm.match(new RegExp(`^${k}:\\s*\\[(.*?)\\]`,"m")); return r ? r[1].split(",").map(s=>s.trim().replace(/^["']|["']$/g,"")).filter(Boolean) : []; };

  let slug = forumSlug(get("title") || topic);
  let base = slug, n = 2;
  while (await redis.exists(`forum:article:${slug}`)) { slug = `${base}-${n++}`; }

  const article = {
    slug,
    title: get("title") || topic,
    category,
    version: get("version") || version || "1.20.1",
    tags: getArr("tags"),
    excerpt: get("excerpt") || "",
    body,
    author: "SB Games",
    ai: true,
    publishedAt: new Date().toISOString().slice(0,10),
  };
  await redis.set(`forum:article:${slug}`, JSON.stringify(article));
  await redis.sadd("forum:articles", slug);
  res.json(article);
});

// Ручное создание/редактирование статьи (админ). Тело: поля статьи.
app.put("/admin/forum/articles/:slug", async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  const oldSlug = req.params.slug;
  const b = req.body || {};
  const existing = await redis.get(`forum:article:${oldSlug}`);
  const cur = existing ? JSON.parse(existing) : {};
  const newSlug = b.slug ? forumSlug(b.slug) : (cur.slug || forumSlug(b.title));
  const article = {
    slug: newSlug,
    title: b.title ?? cur.title ?? "Без названия",
    category: b.category ?? cur.category ?? "articles",
    version: b.version ?? cur.version ?? null,
    tags: Array.isArray(b.tags) ? b.tags : (typeof b.tags === "string" ? b.tags.split(",").map(s=>s.trim()).filter(Boolean) : cur.tags || []),
    excerpt: b.excerpt ?? cur.excerpt ?? "",
    body: b.body ?? cur.body ?? "",
    image: b.image ?? cur.image ?? null,
    author: b.author ?? cur.author ?? "SB Games",
    ai: b.ai ?? cur.ai ?? false,
    publishedAt: b.publishedAt ?? cur.publishedAt ?? new Date().toISOString().slice(0,10),
  };
  if (newSlug !== oldSlug && await redis.exists(`forum:article:${newSlug}`))
    return res.status(409).json({ message: "slug занят" });
  if (newSlug !== oldSlug) { await redis.del(`forum:article:${oldSlug}`); await redis.srem("forum:articles", oldSlug); }
  await redis.set(`forum:article:${newSlug}`, JSON.stringify(article));
  await redis.sadd("forum:articles", newSlug);
  res.json(article);
});

// Удаление статьи (админ)
app.delete("/admin/forum/articles/:slug", async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  await redis.del(`forum:article:${req.params.slug}`);
  await redis.srem("forum:articles", req.params.slug);
  res.json({ ok: true });
});

// --- Website static serving (SPA catch-all) ------------------------------------
const websiteDir = require("path").join(__dirname, "website", "dist");
if (fs.existsSync(websiteDir)) {
  app.use(express.static(websiteDir, { maxAge: "1d", etag: true, index: "index.html" }));
  app.get('*', (req, res) => {
    res.sendFile(require("path").join(websiteDir, 'index.html'));
  });
}

// ─── Start ──────────────────────────────────────────────────────────────────
// Сначала дожидаемся загрузки JWT-секрета, ТОЛЬКО потом поднимаем серверы.
// Иначе первый запрос /auth/tg-login мог прийти до загрузки секрета из Redis
// и получить токен, подписанный эфемерным секретом, который сразу инвалидируется.
;(async () => {
  await loadJwtSecret();
  await loadReferralData().catch(() => {});
  await loadAffiliateConfig().catch(() => {});
  await loadShopItems().catch(() => {});
  loadCosmeticItems();
  await seedShopItems().catch(e => console.warn("[shop] seed failed:", e.message));

  

// ─── Anti-cheat: серверная аттестация клиента ────────────────────────────────
// Клиент периодически шлёт подписанный отчёт о своём .exe-хеше и загруженных
// модах/DLL. Сервер сверяет с release-attest.json (хеш .exe из билда) и
// whitelist'ом модов из MODPACK_DIR. Нарушение → violation + action "kill",
// повторные → бан. Подпись HMAC-SHA256 на SBG_ATTEST_SECRET.
const ATTEST_SECRET = process.env.SBG_ATTEST_SECRET || "";
let _attestCache = { mtime: 0, data: null };
function loadReleaseAttest() {
  try {
    const p = _path.join(__dirname, "release-attest.json");
    const st = fs.statSync(p);
    if (st.mtimeMs !== _attestCache.mtime) {
      _attestCache = { mtime: st.mtimeMs, data: JSON.parse(fs.readFileSync(p, "utf8")) };
    }
    return _attestCache.data;
  } catch { return null; }
}
// Whitelist sha256 модов актуальной сборки (переиспользует логику manifest).
function modWhitelist() {
  const set = new Set();
  try {
    if (!fs.existsSync(MODPACK_DIR)) return set;
    const versions = fs.readdirSync(MODPACK_DIR).filter(d => {
      try { return fs.statSync(_path.join(MODPACK_DIR, d)).isDirectory(); } catch { return false; }
    });
    if (!versions.length) return set;
    versions.sort((a,b)=> fs.statSync(_path.join(MODPACK_DIR,b)).mtimeMs - fs.statSync(_path.join(MODPACK_DIR,a)).mtimeMs);
    const modsDir = _path.join(MODPACK_DIR, versions[0], "mods");
    if (!fs.existsSync(modsDir)) return set;
    for (const f of fs.readdirSync(modsDir)) {
      if (!f.endsWith(".jar") && !f.endsWith(".disabled")) continue;
      try { set.add(crypto.createHash("sha256").update(fs.readFileSync(_path.join(modsDir, f))).digest("hex")); } catch {}
    }
  } catch {}
  return set;
}

// Выдаёт ожидаемые значения для клиента.
app.get("/api/attest/expected", requireAuth, (_req, res) => {
  const rel = loadReleaseAttest();
  const wl = [...modWhitelist()];
  res.set("Cache-Control", "no-store");
  res.json({
    exeHash: rel?.exeHash || null,
    version: rel?.version || null,
    mods: wl,
    serverTime: Date.now(),
  });
});

// Принимает отчёт клиента и выносит вердикт.
app.post("/api/attest/report", requireAuth, async (req, res) => {
  try {
    const { exeHash, mods, dlls, ts, sig } = req.body || {};
    const now = Date.now();
    if (!ts || Math.abs(now - Number(ts)) > 120000) {
      return res.status(400).json({ ok: false, action: "kill", reasons: ["stale_report"] });
    }
    // Проверка подписи (если секрет настроен).
    if (ATTEST_SECRET) {
      const modHashes = (Array.isArray(mods) ? mods.map(m => m.sha256) : []).filter(Boolean).sort();
      const canonical = [exeHash || "", ts, modHashes.join(",")].join("|");
      const expectSig = crypto.createHmac("sha256", ATTEST_SECRET).update(canonical).digest("hex");
      if (sig !== expectSig) {
        return res.status(403).json({ ok: false, action: "kill", reasons: ["bad_signature"] });
      }
    }

    const reasons = [];
    const rel = loadReleaseAttest();
    // 1. Целостность .exe
    if (rel?.exeHash && exeHash && exeHash !== rel.exeHash) reasons.push("exe_tampered");
    // 2. Свой-мод / подмена: каждый мод обязан быть в whitelist
    const wl = modWhitelist();
    if (wl.size > 0 && Array.isArray(mods)) {
      for (const m of mods) {
        if (!m?.sha256 || !wl.has(m.sha256)) reasons.push("foreign_mod:" + (m?.name || "unknown"));
      }
    }
    // 3. Подозрительные DLL (клиент уже отметил)
    if (Array.isArray(dlls)) {
      for (const d of dlls) if (d?.suspicious) reasons.push("suspicious_dll:" + (d.name || "?"));
    }

    if (reasons.length === 0) return res.json({ ok: true, action: "ok", reasons: [] });

    // Фиксируем нарушение и решаем меру.
    let strikes = 1;
    try {
      await redisAccounts.mutate(req.userId, (acc) => {
        if (!acc.attest) acc.attest = { strikes: 0, last: null, log: [] };
        acc.attest.strikes = (acc.attest.strikes || 0) + 1;
        acc.attest.last = new Date().toISOString();
        acc.attest.log = [...(acc.attest.log || []), { ts: acc.attest.last, reasons }].slice(-20);
        strikes = acc.attest.strikes;
        if (strikes >= 3) { acc.banned = true; acc.banReason = "anticheat: " + reasons.join("; "); }
        return acc;
      });
    } catch (e) { console.error("[attest] mutate", e.message); }

    console.warn("[attest] violation user=" + req.userId + " strikes=" + strikes + " -> " + reasons.join("; "));
    return res.json({ ok: false, action: strikes >= 3 ? "ban" : "kill", strikes, reasons });
  } catch (e) {
    console.error("[attest/report]", e.message);
    return res.status(500).json({ ok: false, action: "kill", reasons: ["server_error"] });
  }
});


// ─── Anti-cheat: бан / разбан / нарушители ───────────────────────────────────
app.post("/admin/ban", async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  const { userId, reason } = req.body;
  if (!userId) return res.status(400).json({ message: "Bad request" });
  const acc = await redisAccounts.get(String(userId));
  if (!acc) return res.status(404).json({ message: "User not found" });
  acc.banned = true;
  acc.banReason = (reason && String(reason).slice(0, 300)) || "manual";
  acc.bannedAt = new Date().toISOString();
  acc.tokenVersion = (acc.tokenVersion || 0) + 1; // инвалидируем активные сессии
  await redisAccounts.set(String(userId), acc);
  try { sendToUser(String(userId), { type: "banned", reason: acc.banReason }); } catch {}
  res.json({ ok: true, banned: true });
});

app.post("/admin/unban", async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ message: "Bad request" });
  const acc = await redisAccounts.get(String(userId));
  if (!acc) return res.status(404).json({ message: "User not found" });
  acc.banned = false;
  acc.banReason = null;
  if (acc.attest) acc.attest.strikes = 0; // сбрасываем страйки
  await redisAccounts.set(String(userId), acc);
  res.json({ ok: true, banned: false });
});

app.get("/admin/violations", async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  const all = await redisAccounts.allValues();
  const list = all
    .filter(a => a.banned || (a.attest && a.attest.strikes > 0))
    .map(a => ({
      id: a.id, username: a.username, banned: !!a.banned,
      banReason: a.banReason || null, bannedAt: a.bannedAt || null,
      strikes: a.attest?.strikes || 0, lastViolation: a.attest?.last || null,
      log: (a.attest?.log || []).slice(-10),
    }))
    .sort((x, y) => (y.strikes - x.strikes) || ((y.bannedAt || "") > (x.bannedAt || "") ? 1 : -1));
  res.json({ violations: list, total: list.length });
});

server.listen(PORT, "0.0.0.0", () => console.log(`SBGames HTTP  :${PORT}`));

  try {
    const sslOpts = { key: fs.readFileSync(SSL_KEY), cert: fs.readFileSync(SSL_CERT) };
    const httpsServer = https.createServer(sslOpts, app);
    const wssSSL = new WebSocketServer({ server: httpsServer });
    wssSSL.on("connection", (ws, req) => wss.emit("connection", ws, req));
    httpsServer.listen(PORT_SSL, "0.0.0.0", () => console.log(`SBGames HTTPS :${PORT_SSL}`));
  } catch (e) {
    console.warn("HTTPS not started:", e.message);
  }
})().catch(err => {
  console.error("[startup] failed:", err);
  process.exit(1);
});