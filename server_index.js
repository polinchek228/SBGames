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
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || "https://api.hyperionsearch.xyz/auth/google/callback";

const googleOAuth = new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);
const googlePending = new Map(); // state -> { googleId, email, name, avatar, expiresAt }

const SSL_KEY  = "/etc/ssl/private/sbgames.key";
const SSL_CERT = "/etc/ssl/certs/sbgames.crt";

// ΓöÇΓöÇΓöÇ Redis ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
const redis = new Redis({ host: "127.0.0.1", port: 6379, lazyConnect: true });
redis.connect().catch(() => console.warn("[redis] not available, using memory"));

// Загружаем или генерируем персистентный JWT_SECRET
async function loadJwtSecret() {
  try {
    const stored = await redis.get("sbgames:jwt_secret");
    if (stored) { JWT_SECRET = stored; }
    else {
      JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(48).toString("hex");
      await redis.set("sbgames:jwt_secret", JWT_SECRET);
    }
    console.log("[jwt] secret loaded");
  } catch { console.warn("[jwt] redis unavailable, using ephemeral secret"); }
}
loadJwtSecret();

const redisAccounts = { _map: new Map(),
  async get(k)    { try { const v = await redis.get(`acc:${k}`); return v ? JSON.parse(v) : this._map.get(k); } catch { return this._map.get(k); } },
  async set(k, v) { this._map.set(k, v); try { await redis.set(`acc:${k}`, JSON.stringify(v)); } catch {} },
  values()        { return this._map.values(); },
  // Поиск по всем аккаунтам в Redis + memory
  async search(q, limit = 30) {
    if (!q || q.length < 2) return [];
    const ql = q.toLowerCase();
    const results = [];
    // Memory
    for (const acc of this._map.values()) {
      if (acc.username?.toLowerCase().includes(ql)) results.push(acc);
    }
    // Redis scan (на случай если в memory нет, а в redis есть)
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
};

const app = express();

// ΓöÇΓöÇΓöÇ Trust proxy (nginx) ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
app.set("trust proxy", 1);

// ΓöÇΓöÇΓöÇ Static: backgrounds (video files) ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
app.use("/backgrounds", express.static(
  require("path").join(__dirname, "backgrounds"),
  { maxAge: "7d", etag: true, lastModified: true }
));

// ΓöÇΓöÇΓöÇ Static: frames (PNG images) ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
app.use("/frames", express.static(
  require("path").join(__dirname, "frames"),
  { maxAge: "7d", etag: true, lastModified: true }
));

// ΓöÇΓöÇΓöÇ Static: icons (PNG images) ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
app.use("/icons", express.static(
  require("path").join(__dirname, "icons"),
  { maxAge: "7d", etag: true, lastModified: true }
));

// ΓöÇΓöÇΓöÇ Security headers ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
// CSP is intentionally minimal ΓÇö this is an API server, not serving HTML pages.
// The strict CSP was causing Mac/webview clients to fail loading resources.
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy:    false,
  crossOriginResourcePolicy:  { policy: "cross-origin" },
  referrerPolicy:             { policy: "no-referrer" },
  hsts:                       { maxAge: 31536000, includeSubDomains: true, preload: true },
  noSniff:                    true,
  dnsPrefetchControl:         { allow: false },
  permittedCrossDomainPolicies: { permittedPolicies: "none" },
}));

// ΓöÇΓöÇΓöÇ CORS ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
const ALLOWED_ORIGINS = new Set([
  "https://api.hyperionsearch.xyz",
  "https://api.sbgames.hyperionsearch.xyz:8443",
  "https://sbgames.hyperionsearch.xyz:8444",
  "https://sbgames.hyperionsearch.xyz",
  "http://sbgames.hyperionsearch.xyz",
  "http://localhost:1420",
  "http://localhost:5173",
  "tauri://localhost",
  "http://tauri.localhost",
  "https://tauri.localhost",
]);
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.has(origin)) return cb(null, true);
    cb(new Error("CORS: not allowed"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  maxAge: 86400,
}));

// ΓöÇΓöÇΓöÇ Body limits ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
app.use(express.json({ limit: "16kb" }));

// ΓöÇΓöÇΓöÇ IP blocklist (Redis-backed, in-memory fallback) ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
const blockedIPs     = new Map(); // ip ΓåÆ unblock timestamp
const failedAttempts = new Map(); // ip ΓåÆ { count, firstAt }
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

// ΓöÇΓöÇΓöÇ Rate limiters ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
const makeLimit = (windowMs, max, msg) => rateLimit({
  windowMs, max,
  message:        { message: msg || "Слишком много запросов" },
  standardHeaders: true,
  legacyHeaders:  false,
  keyGenerator:   req => getIP(req),
  skip:           req => isAdmin(req.body?.username) || isAdminId(String(req.body?.tgUser?.id || "")),
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
// ─── Auto-updater endpoint ────────────────────────────────────────────────────
const LATEST_VERSION = "1.0.0";
const UPDATE_BASE    = "https://api.hyperionsearch.xyz/update";
const UPDATE_NOTES   = "Обновление доступно";

app.get("/update/:target/:arch/:currentVersion", (req, res) => {
  const { target, arch, currentVersion } = req.params;
  const platforms = {
    "windows-x86_64":  { file: "sbgames-launcher_${VERSION}_x64-setup.nsis.zip",   sig: "sbgames-launcher_${VERSION}_x64-setup.nsis.zip.sig" },
    "darwin-x86_64":   { file: "sbgames-launcher_${VERSION}_x64.app.tar.gz",        sig: "sbgames-launcher_${VERSION}_x64.app.tar.gz.sig" },
    "darwin-aarch64":  { file: "sbgames-launcher_${VERSION}_aarch64.app.tar.gz",    sig: "sbgames-launcher_${VERSION}_aarch64.app.tar.gz.sig" },
    "linux-x86_64":    { file: "sbgames-launcher_${VERSION}_amd64.AppImage.tar.gz", sig: "sbgames-launcher_${VERSION}_amd64.AppImage.tar.gz.sig" },
  };
  const key = target + "-" + arch;
  const fmt = platforms[key];
  if (!fmt) return res.status(204).send();
  const cur = currentVersion.split(".").map(Number);
  const lat = LATEST_VERSION.split(".").map(Number);
  const newer = lat[0] > cur[0] || (lat[0] === cur[0] && lat[1] > cur[1]) || (lat[0] === cur[0] && lat[1] === cur[1] && lat[2] > cur[2]);
  if (!newer) return res.status(204).send();
  const sigFile = fmt.sig.replace(/\$\{VERSION\}/g, LATEST_VERSION);
  const sigPath = require("path").join(__dirname, "updates", sigFile);
  let signature = "";
  try { signature = fs.readFileSync(sigPath, "utf8").trim(); } catch {}
  const url = UPDATE_BASE + "/" + LATEST_VERSION + "/" + fmt.file.replace(/\$\{VERSION\}/g, LATEST_VERSION);
  res.json({ version: LATEST_VERSION, notes: UPDATE_NOTES, pub_date: new Date().toISOString(), url, signature });
});

// Static: update binaries
const updatesDir = require("path").join(__dirname, "updates");
if (!fs.existsSync(updatesDir)) fs.mkdirSync(updatesDir, { recursive: true });
app.use("/update", express.static(updatesDir, { maxAge: "1d", etag: true }));


// ΓöÇΓöÇΓöÇ Request ID & logging ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
app.use((req, _res, next) => {
  req.reqId = uuidv4().slice(0, 8);
  next();
});

function sanitize(str, max = 500) {
  if (typeof str !== "string") return "";
  return sanitizeHtml(str.slice(0, max), { allowedTags: [], allowedAttributes: {} }).trim();
}
function signToken(userId)  { return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: "30d" }); }
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

// ΓöÇΓöÇΓöÇ Stores ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
const tickets        = new Map();
const friendships    = new Map();
const friendRequests = new Map();
const dms            = new Map();
const invoices       = new Map();
let ticketCounter  = 1000;
let invoiceCounter = 1;

const wsClients = new Map();

function getFriends(userId)         { return friendships.get(userId) || new Set(); }
function areFriends(a, b)           { return getFriends(a).has(b); }
function dmKey(a, b)                { return [a, b].sort().join("_"); }
function getPendingRequests(userId) { return (friendRequests.get(userId) || []); }
function sendToUser(userId, data) {
  for (const c of wsClients.values()) { if (c.userId === userId) send(c.ws, data); }
}

// ΓöÇΓöÇΓöÇ REST ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

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
    // Новый пользователь — нужен ник
    return res.json({ needNick: true, tgUser: tgData });
  }

  account.telegram = tgData.username || account.telegram;
  account.role     = adminRole;
  await redisAccounts.set(tgId, account);

  res.json({ user: account, token: signToken(tgId) });
});

// Завершение регистрации (ник) — поддерживает desktop flow
app.post("/auth/tg-login", async (req, res) => {
  const ip = getIP(req);
  const { tgUser, username } = req.body;
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
    account.role = isAdmin(tgUser.username || account.username) || isAdminId(tgId) ? "admin" : "user";
    await redisAccounts.set(tgId, account);
    return res.json({ user: account, token: signToken(tgId) });
  }

  // Новый пользователь — ник обязателен
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
  res.json({ user: account, token: signToken(tgId) });
});

// ─── Google OAuth ─────────────────────────────────────────────────────────────
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
    return res.status(400).send(`<html><body style="background:#0a0a0f;color:#fff;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div style="text-align:center"><p style="font-size:18px;font-weight:700;color:#f87171">Ошибка входа через Google</p><p style="color:rgba(255,255,255,0.5);font-size:14px">${error || "Нет кода авторизации"}</p></div></body></html>`);
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
  const { state, username } = req.body;
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
  const token = signToken(googleId);
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
  // Принудительно проверяем роль
  if (isAdminId(payload.sub) && acc.role !== "admin") {
    acc.role = "admin";
    await redisAccounts.set(payload.sub, acc);
  }
  res.json({ user: acc });
});

// Поиск игроков по нику — работает по всем зарегистрированным (не только онлайн)
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

app.get("/online", (_, res) => {
  res.json({ users: [...wsClients.values()].filter(c => c.userId && c.username).map(c => ({ id: c.userId, username: c.username })) });
});

app.get("/support/tickets", (req, res) => {
  const list = [...tickets.values()].map(t => ({ id: t.id, category: t.category, username: t.username, status: t.status, createdAt: t.createdAt, preview: t.preview, unread: t.unread || 0 }));
  res.json({ tickets: list.sort((a, b) => b.createdAt - a.createdAt) });
});

app.get("/support/ticket/:id", (req, res) => {
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

// ΓöÇΓöÇΓöÇ Admin API ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

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
  const users = [...redisAccounts._map.values()].map(a => ({
    id: a.id, username: a.username, telegram: a.telegram,
    balance: a.balance ?? 0, role: a.role, createdAt: a.createdAt,
  }));
  res.json({ users: users.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)) });
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

app.get("/admin/tickets", async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  const list = [...tickets.values()].map(t => ({
    id: t.id, category: t.category, username: t.username,
    status: t.status, createdAt: t.createdAt, preview: t.preview,
    unread: t.unread || 0, userId: t.userId,
  }));
  res.json({ tickets: list.sort((a, b) => b.createdAt - a.createdAt) });
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

// ΓöÇΓöÇΓöÇ Payments ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

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

// ΓöÇΓöÇΓöÇ Auth middleware ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
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

// ΓöÇΓöÇΓöÇ Shop Catalog ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
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

// ΓöÇΓöÇΓöÇ Public profile ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
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

// ΓöÇΓöÇΓöÇ Profile comments ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
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

// ΓöÇΓöÇΓöÇ Bio ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
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

// ΓöÇΓöÇΓöÇ Inventory ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
app.get("/api/inventory/catalog", (_req, res) => res.json({ items: SHOP_CATALOG }));

app.get("/api/inventory", requireAuth, async (req, res) => {
  const acc = await redisAccounts.get(req.userId);
  const owned = Array.isArray(acc?.inventory) ? acc.inventory : [];
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
  if ((acc.balance || 0) < item.price) return res.status(400).json({ message: "Недостаточно СБТ", need: item.price, have: acc.balance || 0 });
  acc.balance = (acc.balance || 0) - item.price;
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
  const type = sanitize(req.body.type || "", 32);
  if (!["frame","background","avatar_animated","badge"].includes(type)) return res.status(400).json({ message: "Неверный тип" });
  const acc = await redisAccounts.get(req.userId);
  if (!acc) return res.status(404).json({ message: "Аккаунт не найден" });
  acc.equip = { ...(acc.equip || {}) };
  delete acc.equip[type];
  await redisAccounts.set(req.userId, acc);
  res.json({ ok: true, equip: acc.equip });
});

// ΓöÇΓöÇΓöÇ Activity ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
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

// ΓöÇΓöÇΓöÇ Marketplace ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
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
  if (!acc) return res.status(404).json({ message: "Аккаунт не найден" });
  const marketOwn = Array.isArray(acc.market_inventory) ? acc.market_inventory : [];
  if (!marketOwn.includes(cleanId)) return res.status(400).json({ message: "Нет этого предмета" });
  const item = MARKET_CATALOG.find(i => i.id === cleanId);
  if (!item) return res.status(404).json({ message: "Предмет не найден" });
  const hasActive = [...listings.values()].some(l => l.status === "active" && l.sellerId === req.userId && l.itemId === cleanId);
  if (hasActive) return res.status(400).json({ message: "Уже выставлен" });
  acc.market_inventory = marketOwn.filter(x => x !== cleanId);
  await redisAccounts.set(req.userId, acc);
  const id = String(++listingCounter);
  const listing = { id, itemId: cleanId, itemType: item.type, name: item.name, preview: item.preview, price: priceNum, sellerId: req.userId, sellerName: acc.username, createdAt: Date.now(), status: "active" };
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
  const buyer = await redisAccounts.get(req.userId);
  if (!buyer) return res.status(404).json({ message: "Аккаунт не найден" });
  if ((buyer.balance || 0) < listing.price) return res.status(400).json({ message: "Недостаточно СБТ" });
  const seller = await redisAccounts.get(listing.sellerId);
  if (!seller) return res.status(404).json({ message: "Продавец не найден" });
  buyer.balance = (buyer.balance || 0) - listing.price;
  seller.balance = (seller.balance || 0) + listing.price;
  buyer.market_inventory = Array.isArray(buyer.market_inventory) ? [...buyer.market_inventory, listing.itemId] : [listing.itemId];
  if (Date.now() - listing.createdAt > 14 * 86400000) { const fee = Math.ceil(listing.price * 0.05); seller.balance -= fee; buyer.balance += fee; }
  await redisAccounts.set(req.userId, buyer);
  await redisAccounts.set(listing.sellerId, seller);
  listing.status = "sold"; listing.soldTo = req.userId; listing.soldAt = Date.now();
  listings.set(id, listing);
  saveListing(listing);
  sendToUser(listing.sellerId, { type: "market_sold", listingId: id, price: listing.price, buyerName: buyer.username });
  res.json({ ok: true, balance: buyer.balance, market: buyer.market_inventory });
});

app.delete("/api/market/:id", requireAuth, async (req, res) => {
  const id = sanitize(req.params.id, 32);
  const listing = listings.get(id);
  if (!listing) return res.status(404).json({ message: "Листинг не найден" });
  if (listing.sellerId !== req.userId) return res.status(403).json({ message: "Не твой" });
  if (listing.status !== "active") return res.status(400).json({ message: "Уже завершён" });
  const acc = await redisAccounts.get(req.userId);
  if (acc) { acc.market_inventory = Array.isArray(acc.market_inventory) ? [...acc.market_inventory, listing.itemId] : [listing.itemId]; await redisAccounts.set(req.userId, acc); }
  listing.status = "cancelled";
  listings.set(id, listing);
  saveListing(listing);
  res.json({ ok: true });
});

// ΓöÇΓöÇΓöÇ Groups ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
const groups = new Map(), groupMessages = new Map(), groupInvites = new Map();
const groupJoinRequests = new Map(); // groupId -> [{ userId, username, time }]
let groupCounter = 0;
const GROUP_MAX = 8;
const groupVoice = new Map(); // groupId -> Set<userId>

// ─── Clan roles ─────────────────────────────────────────────────────────────
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

// ─── Parties (temporary play sessions) ─────────────────────────────────────
const parties      = new Map(); // partyId -> { id, name, leaderId, members: Set<userId>, createdAt }
const userParties  = new Map(); // userId -> Set<partyId>
const partyInvites = new Map(); // userId (invitee) -> [{ partyId, partyName, fromId, fromUsername }]
let partyCounter = 0;

function userPartyIds(uid) {
  if (!userParties.has(uid)) userParties.set(uid, new Set());
  return userParties.get(uid);
}

function publicParty(p) {
  const memberList = [...p.members].map(uid => {
    const acc = [...redisAccounts._map.values()].find(a => a && a.id === uid);
    return { id: uid, username: acc?.username || uid };
  });
  return { id: p.id, name: p.name, leaderId: p.leaderId, members: memberList, createdAt: p.createdAt };
}

function disbandParty(partyId) {
  const p = parties.get(partyId);
  if (!p) return;
  for (const uid of p.members) userPartyIds(uid).delete(partyId);
  parties.delete(partyId);
}

function userPartiesList(uid) {
  return [...userPartyIds(uid)].map(id => parties.get(id)).filter(Boolean).map(publicParty);
}


// ─── Redis persistence for groups ─────────────────────────────────────────────
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

// ─── Redis persistence for comments ───────────────────────────────────────────
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

// ─── Redis persistence for DMs ────────────────────────────────────────────────
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

// ─── Redis persistence for friendships ────────────────────────────────────────
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

// ─── Redis persistence for listings ───────────────────────────────────────────
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

// ─── Redis persistence for tickets ────────────────────────────────────────────
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

// ─── Redis persistence for groupMessages ──────────────────────────────────────
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

// ─── Redis persistence for groupInvites ───────────────────────────────────────
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
// ─── Clan Level System ───────────────────────────────────────────────────────
// Level requirements: { level, minMembers, hoursPerMember }
// To reach level N, at least minMembers must have played >= hoursPerMember each.
const CLAN_LEVELS = [
  { level: 1, minMembers: 0, hoursPerMember: 0 },      // default
  { level: 2, minMembers: 2, hoursPerMember: 3 },       // 2×3h = 6h total
  { level: 3, minMembers: 5, hoursPerMember: 5 },       // 5×5h = 25h total
  { level: 4, minMembers: 8, hoursPerMember: 8 },       // 8×8h = 64h total
  { level: 5, minMembers: 10, hoursPerMember: 10 },     // 10×10h = 100h total
  { level: 6, minMembers: 15, hoursPerMember: 15 },     // 15×15h = 225h total
  { level: 7, minMembers: 20, hoursPerMember: 20 },     // 20×20h = 400h total
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

function publicGroup(g) {
  const memberNames = {};
  for (const mid of g.members) {
    const acc = [...redisAccounts._map.values()].find(a => a && a.id === mid);
    if (acc) memberNames[mid] = acc.username;
  }
  const li = clanLevelInfo(g);
  return { id: g.id, name: g.name, description: g.description || "", avatar: g.avatar || "", ownerId: g.ownerId, members: [...g.members], memberRoles: g.memberRoles || {}, closed: !!g.closed, memberNames, createdAt: g.createdAt, levelInfo: li };
}

app.get("/api/groups", requireAuth, (req, res) => {
  res.json({ groups: [...groups.values()].filter(g => g.members.has(req.userId)).map(publicGroup) });
});

app.post("/api/groups", requireAuth, (req, res) => {
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
  res.json({ ok: true, group: publicGroup(g) });
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

app.post("/api/groups/:id/respond", requireAuth, (req, res) => {
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
    for (const m of g.members) sendToUser(m, { type: "group_update", group: publicGroup(g) });
  }
  res.json({ ok: true, group: publicGroup(g) });
});

app.post("/api/groups/:id/leave", requireAuth, (req, res) => {
  const gid = sanitize(req.params.id, 32);
  const g = groups.get(gid);
  if (!g) return res.status(404).json({ message: "Клан не найден" });
  if (!g.members.has(req.userId)) return res.status(403).json({ message: "Ты не в клане" });
  g.members.delete(req.userId);
  if (g.members.size === 0) {
    groups.delete(gid); groupMessages.delete(gid); groupInvites.delete(gid); deleteGroupFromRedis(gid);
  } else {
    if (g.ownerId === req.userId) g.ownerId = g.members.values().next().value;
    saveGroup(g);
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
  for (const [gid, list] of groupInvites.entries()) for (const inv of list) if (inv.toId === req.userId) out.push({ ...inv, groupId: gid });
  res.json({ invites: out });
});

// ─── Clan browse + join requests ──────────────────────────────────────────────
// Public clan directory: safe public fields only, no membership required.
app.get("/api/groups/browse", requireAuth, (req, res) => {
  const out = [...groups.values()].map(g => {
    const pub = publicGroup(g);
    return {
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
    };
  }).sort((a, b) => (b.levelInfo?.level || 1) - (a.levelInfo?.level || 1) || b.memberCount - a.memberCount);
  res.json({ groups: out });
});

// Non-member submits a join request. Full block if already in any clan.
app.post("/api/groups/:id/apply", requireAuth, (req, res) => {
  const gid = sanitize(req.params.id, 32);
  const g = groups.get(gid);
  if (!g) return res.status(404).json({ message: "Клан не найден" });
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
  if (!g) return res.status(404).json({ message: "???? ?? ??????" });
  if (!canManageRequests(g, req.userId)) return res.status(403).json({ message: "?????? ????????" });
  res.json({ requests: groupJoinRequests.get(gid) || [] });
});

// Owner/leader/elder approves or rejects an applicant.
app.post("/api/groups/:id/requests/:userId", requireAuth, (req, res) => {
  const gid = sanitize(req.params.id, 32);
  const applicantId = sanitize(req.params.userId, 64);
  const g = groups.get(gid);
  if (!g) return res.status(404).json({ message: "???? ?? ??????" });
  if (!canManageRequests(g, req.userId)) return res.status(403).json({ message: "?????? ????????" });
  const accept = !!req.body.accept;
  const list = groupJoinRequests.get(gid) || [];
  if (!list.find(r => r.userId === applicantId)) return res.status(404).json({ message: "Заявка не найдена" });
  groupJoinRequests.set(gid, list.filter(r => r.userId !== applicantId));
  saveGroupJoinRequests(gid);
  if (accept) {
    if (g.members.size >= GROUP_MAX) return res.status(400).json({ message: `Клан заполнен (максимум ${GROUP_MAX})` });
    if ([...groups.values()].some(other => other.id !== gid && other.members.has(applicantId))) {
      return res.status(400).json({ message: "Игрок уже вступил в другой клан" });
    }
    g.members.add(applicantId);
    saveGroup(g);
    for (const memberId of g.members) sendToUser(memberId, { type: "group_update", group: publicGroup(g) });
    sendToUser(applicantId, { type: "group_join_accepted", groupId: gid, groupName: g.name });
  } else {
    sendToUser(applicantId, { type: "group_join_rejected", groupId: gid, groupName: g.name });
  }
  res.json({ ok: true });
});

// ─── Group settings (owner/leader can edit) ────────────────────────────────
app.put("/api/groups/:id/description", requireAuth, (req, res) => {
  const gid = sanitize(req.params.id, 32);
  const g = groups.get(gid);
  if (!g) return res.status(404).json({ message: "Группа не найдена" });
  if (!canEditGroup(g, req.userId)) return res.status(403).json({ message: "Нет прав" });
  g.description = sanitize(req.body.description || "", 200);
  saveGroup(g);
  for (const m of g.members) sendToUser(m, { type: "group_update", group: publicGroup(g) });
  res.json({ ok: true, group: publicGroup(g) });
});

app.put("/api/groups/:id/avatar", requireAuth, (req, res) => {
  const gid = sanitize(req.params.id, 32);
  const g = groups.get(gid);
  if (!g) return res.status(404).json({ message: "Группа не найдена" });
  if (!canEditGroup(g, req.userId)) return res.status(403).json({ message: "Нет прав" });
  g.avatar = sanitize(req.body.avatar || "", 500);
  saveGroup(g);
  for (const m of g.members) sendToUser(m, { type: "group_update", group: publicGroup(g) });
  res.json({ ok: true, group: publicGroup(g) });
});

// Owner assigns a role to a member
app.put("/api/groups/:id/role", requireAuth, (req, res) => {
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
  for (const m of g.members) sendToUser(m, { type: "group_update", group: publicGroup(g) });
  res.json({ ok: true, group: publicGroup(g) });
});

// Owner toggles closed (private) mode — no one can apply, only invited
app.put("/api/groups/:id/closed", requireAuth, (req, res) => {
  const gid = sanitize(req.params.id, 32);
  const g = groups.get(gid);
  if (!g) return res.status(404).json({ message: "Группа не найдена" });
  if (g.ownerId !== req.userId) return res.status(403).json({ message: "Только владелец может закрыть клан" });
  g.closed = !!req.body.closed;
  saveGroup(g);
  for (const m of g.members) sendToUser(m, { type: "group_update", group: publicGroup(g) });
  res.json({ ok: true, group: publicGroup(g) });
});

app.get("/online", (_, res) => {
  res.json({ users: [...wsClients.values()].filter(c => c.userId && c.username).map(c => ({ id: c.userId, username: c.username })) });
});

// ΓöÇΓöÇΓöÇ WebSocket ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
const WS_MAX_PER_IP    = 5;    // макс соединений с одного IP
const WS_AUTH_TIMEOUT  = 10_000; // 10с на авторизацию
const WS_MSG_LIMIT     = 120;  // сообщений в минуту
const WS_MSG_WINDOW    = 60_000;
const wsIPCount        = new Map(); // ip ΓåÆ count

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

  // Таймаут авторизации
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
          send(ws, { type: "parties_list", parties: userPartiesList(client.userId) });
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
          // Показываем в лаунчере
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
        // Админ подтверждает оплату через лаунчер → выдаём баланс + закрываем
        case "confirm_payment": {
          if (client.role !== "admin") break;
          const ticket = tickets.get(Number(msg.ticketId));
          if (!ticket) break;
          const amount = parseInt(msg.amount, 10);
          if (!amount || amount <= 0) break;
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
          if (!g || !g.members.has(client.userId)) return;
          const gtext = sanitize(msg.text || "", 1000);
          if (!gtext) return;
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
          if (getMemberRole(g, targetUserId) === ROLE_OWNER) break;
          if (!canKick(g, client.userId) && getMemberRole(g, targetUserId) === ROLE_LEADER) break;
          delete g.memberRoles[targetUserId];
          g.members.delete(targetUserId);
          sendToUser(targetUserId, { type: "group_kicked", groupId: gid, groupName: g.name });
          if (g.members.size === 0) { groups.delete(gid); groupMessages.delete(gid); groupInvites.delete(gid); deleteGroupFromRedis(gid); }
          else { saveGroup(g); for (const memberId of g.members) sendToUser(memberId, { type: "group_update", group: publicGroup(g) }); }
          break;
        }
        // ─── DM Calls ────────────────────────────────────────────────────────────
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
        // ─── Group Calls ─────────────────────────────────────────────────────────
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
        // ─── Parties (temporary play sessions) ────────────────────────────────────
        case "party_create": {
          const pname = sanitize(msg.name || "", 40) || "Группа";
          const id = String(++partyCounter);
          const p = { id, name: pname, leaderId: client.userId, members: new Set([client.userId]), createdAt: Date.now() };
          parties.set(id, p);
          userPartyIds(client.userId).add(id);
          send(ws, { type: "parties_list", parties: userPartiesList(client.userId) });
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
              for (const mid of p.members) sendToUser(mid, { type: "parties_list", parties: userPartiesList(mid) });
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
            for (const mid of p.members) sendToUser(mid, { type: "parties_list", parties: userPartiesList(mid) });
          }
          send(ws, { type: "parties_list", parties: userPartiesList(client.userId) });
          break;
        }
        case "party_kick": {
          const { userId: targetId, partyId } = msg;
          if (!partyId || !targetId) break;
          const p = parties.get(partyId);
          if (!p || p.leaderId !== client.userId || targetId === client.userId) break;
          p.members.delete(targetId);
          userPartyIds(targetId).delete(partyId);
          sendToUser(targetId, { type: "parties_list", parties: userPartiesList(targetId) });
          for (const mid of p.members) sendToUser(mid, { type: "parties_list", parties: userPartiesList(mid) });
          break;
        }
        case "party_rename": {
          const { partyId, name } = msg;
          const p = parties.get(partyId);
          if (!p || p.leaderId !== client.userId) break;
          p.name = sanitize(name || "", 40) || p.name;
          for (const mid of p.members) sendToUser(mid, { type: "parties_list", parties: userPartiesList(mid) });
          break;
        }
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
          send(ws, { type: "groups_list", groups: [...groups.values()].filter(g => g.members.has(client.userId)).map(publicGroup) });
          const myInvites = [];
          for (const [gid, list] of groupInvites.entries()) for (const inv of list) if (inv.toId === client.userId) myInvites.push({ ...inv, groupId: gid });
          send(ws, { type: "group_invites_list", invites: myInvites });
          send(ws, { type: "parties_list", parties: userPartiesList(client.userId) });
          send(ws, { type: "party_invites_list", invites: partyInvites.get(client.userId) || [] });
          break;
        }
      }
    } catch (err) {
      console.error("[WS Message Error]:", err);
      try {
        send(ws, { type: "error", text: "Внутренняя ошибка сервера" });
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

// ΓöÇΓöÇΓöÇ WebSocket Ping/Pong Keepalive ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
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

// ─── Clan Play Hours Tracking ────────────────────────────────────────────────
// Every 60s, increment playHours for each active clan member by 1/60 (1 minute).
// A user is "active" if they sent any WS message in the last 120s.
const PLAY_HOURS_TICK_MS = 60_000; // check every 60s
const PLAY_HOURS活性_THRESHOLD = 120_000; // considered active if last message < 120s ago
const PLAY_HOURS_INCREMENT = 1 / 60; // each tick = 1 minute = 1/60 hour

setInterval(() => {
  const now = Date.now();
  const activeUserIds = new Set();
  for (const [, client] of wsClients.entries()) {
    if (client.userId && client.lastActive && (now - client.lastActive) < PLAY_HOURS活性_THRESHOLD) {
      activeUserIds.add(client.userId);
    }
  }
  if (activeUserIds.size === 0) return;

  let anyUpdate = false;
  for (const [, g] of groups.entries()) {
    let groupUpdated = false;
    for (const mid of g.members) {
      if (!activeUserIds.has(mid)) continue;
      if (!g.playHours) g.playHours = {};
      g.playHours[mid] = (g.playHours[mid] || 0) + PLAY_HOURS_INCREMENT;
      groupUpdated = true;
    }
    if (groupUpdated) {
      anyUpdate = true;
      // Check level change and broadcast if needed
      const oldLvl = calcClanLevel(g);
      // already updated above
    }
  }
  if (anyUpdate) {
    // Broadcast level updates to affected clans (throttled — only every 10 ticks = 10 min)
    // For now, just save — level is computed dynamically in publicGroup
  }
}, PLAY_HOURS_TICK_MS);

function send(ws, data) { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data)); }
function broadcastOnlineUsers() {
  const users = [...wsClients.values()].filter(c => c.userId && c.username).map(c => ({ id: c.userId, username: c.username, role: c.role }));
  for (const { ws } of wsClients.values()) send(ws, { type: "online_users", users });
}
function broadcastToAdmins(data) { for (const { ws, role } of wsClients.values()) { if (role === "admin") send(ws, data); } }
function broadcastToTicket(ticketId, excludeUserId, data) {
  for (const { ws, userId, ticketId: sub } of wsClients.values()) { if (sub === ticketId && userId !== excludeUserId) send(ws, data); }
}
function ticketSummary(t) { return { id: t.id, category: t.category, username: t.username, status: t.status, createdAt: t.createdAt, preview: t.preview, unread: t.unread || 0, paymentAmount: t.paymentAmount || null, tgChatId: t.tgChatId || null, userId: t.userId }; }

// ΓöÇΓöÇΓöÇ News ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
let newsCache = [], newsCacheTime = 0;

async function fetchNewsPublic() {
  if (Date.now() - newsCacheTime < 300_000 && newsCache.length > 0) return newsCache;
  try {
    const r = await fetch("https://rsshub.app/telegram/channel/sb7games", { headers: { "User-Agent": "SBGamesLauncher/1.0" } });
    if (!r.ok) return newsCache;
    const xml = await r.text();
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    while ((match = itemRegex.exec(xml)) !== null) {
      const block    = match[1];
      const title    = ((block.match(/<title><!\[CDATA\[(.*?)\]\]>/) || [])[1] || (block.match(/<title>(.*?)<\/title>/) || [])[1] || "Новость").replace(/<[^>]+>/g, "").trim();
      const desc     = ((block.match(/<description><!\[CDATA\[([\s\S]*?)\]\]>/) || [])[1] || "");
      const pubDate  = (block.match(/<pubDate>(.*?)<\/pubDate>/) || [])[1] || "";
      const photo    = (desc.match(/<img[^>]+src="([^"]+)"/) || [])[1] || null;
      const cleanDesc = desc.replace(/<[^>]+>/g, "").trim();
      const dateStr  = (pubDate ? new Date(pubDate) : new Date()).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
      items.push({ id: items.length + 1, title, text: cleanDesc.slice(0, 400), date: dateStr, photo });
      if (items.length >= 12) break;
    }
    if (items.length > 0) { newsCache = items; newsCacheTime = Date.now(); }
    return newsCache;
  } catch (e) { console.error("fetchNewsPublic:", e.message); return newsCache; }
}

app.get("/news", async (req, res) => res.json({ posts: await fetchNewsPublic() }));
setInterval(fetchNewsPublic, 300_000);
fetchNewsPublic();

// Periodically save all groups to Redis to persist playHours (every 5 min)
setInterval(() => {
  for (const [, g] of groups.entries()) saveGroup(g);
}, 300_000);

// ΓöÇΓöÇΓöÇ Telegram Bot ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
const TelegramBot = require("node-telegram-bot-api");
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

const botSessions = new Map(); // chatId -> { state, ... }

// Клавиатуры
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

// ΓöÇΓöÇΓöÇ Helpers ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

async function mainMenu(chatId, account) {
  const name  = account?.username || "игрок";
  const bal   = (account?.balance ?? 0).toLocaleString("ru-RU");
  const isAdm = account?.role === "admin";
  bot.sendMessage(chatId,
    `Привет, *${name}*!\n\n` +
    `Баланс: *${bal} СБТ*` +
    (isAdm ? "\n\nРежим администратора." : ""),
    { parse_mode: "Markdown", reply_markup: getKb(account) }
  );
}

// Показать список тикетов (для админа)
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
    text: `#${t.id} [${TICKET_STATUS_LABELS[t.status] || t.status}] ${t.username} — ${t.category.slice(0, 20)}${t.unread ? ` (${t.unread} новых)` : ""}`,
    callback_data: `admin_ticket_${t.id}`,
  }]);

  bot.sendMessage(chatId, `*Тикеты* (${list.length}):`, {
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: [...filterBtns, ...ticketBtns] }
  });
}

// Показать конкретный тикет
async function showAdminTicket(chatId, ticketId) {
  const t = tickets.get(ticketId);
  if (!t) { bot.sendMessage(chatId, "Тикет не найден."); return; }

  const lastMsgs = t.messages
    .filter(m => m.from !== "system")
    .slice(-5)
    .map(m => `${m.role === "admin" ? "Админ" : m.username}: ${m.text.slice(0, 80)}`)
    .join("\n");

  const statusBtns = Object.entries(TICKET_STATUS_LABELS).map(([k, v]) => ({
    text: t.status === k ? `┬╖ ${v} ┬╖` : v,
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

// ΓöÇΓöÇΓöÇ /start ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

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
      ? "Авторизация подтверждена! Вернись в лаунчер."
      : "Авторизация подтверждена! Вернись в лаунчер и придумай ник.";
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
      `Сумма: *${amount} СБТ* (${amount} ₽)\n` +
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

  mainMenu(msg.chat.id, account);
});

// ─── Текстовые кнопки панели ──────────────────────────────────────────────────

bot.on("text", async (msg) => {
  if (msg.text?.startsWith("/")) return;
  const chatId  = msg.chat.id;
  const tgId    = String(msg.from.id);
  const account = await redisAccounts.get(tgId);
  if (botSessions.get(chatId)) return;

  const isAdm = account?.role === "admin" || isAdminId(tgId);

  // ── АДМИН ──
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

  // ── ПОЛЬЗОВАТЕЛЬ ──
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
          [{ text: "50 Γé╜",   callback_data: "topup_50"   }, { text: "100 Γé╜",  callback_data: "topup_100"  }, { text: "200 Γé╜",  callback_data: "topup_200"  }],
          [{ text: "500 Γé╜",  callback_data: "topup_500"  }, { text: "1000 Γé╜", callback_data: "topup_1000" }, { text: "2000 Γé╜", callback_data: "topup_2000" }],
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

  // ── АДМИН: фильтр тикетов ──
  if (q.data.startsWith("admin_filter_")) {
    if (!isAdm) return;
    const filter = q.data.replace("admin_filter_", "");
    await showAdminTicketList(chatId, filter);
    return;
  }

  // ── АДМИН: открыть тикет ──
  if (q.data.startsWith("admin_ticket_")) {
    if (!isAdm) return;
    const ticketId = parseInt(q.data.replace("admin_ticket_", ""), 10);
    botSessions.set(chatId, { state: "admin_viewing_ticket", ticketId });
    await showAdminTicket(chatId, ticketId);
    return;
  }

  // ── АДМИН: сменить статус ──
  if (q.data.startsWith("admin_setstatus_")) {
    if (!isAdm) return;
    const [, , ticketIdStr, status] = q.data.split("_");
    const ticketId = parseInt(ticketIdStr, 10);
    const t = tickets.get(ticketId);
    if (t) {
      t.status = status;
      t.messages.push({ id: uuidv4(), from: "system", text: `Статус изменён: ${TICKET_STATUS_LABELS[status] || status}`, time: Date.now() });
      broadcastToAdmins({ type: "ticket_update", ticket: ticketSummary(t) });
      broadcastToTicket(ticketId, null, { type: "ticket_update", ticket: ticketSummary(t) });
      // Уведомить пользователя
      if (status === "answered") {
        try { await bot.sendMessage(t.userId, `По твоему тикету \`#${ticketId}\` пришёл ответ. Проверь на сайте или нажми "Мои обращения".`, { parse_mode: "Markdown", reply_markup: USER_KB }); } catch {}
      }
      bot.answerCallbackQuery(q.id, { text: `Статус: ${TICKET_STATUS_LABELS[status]}`, show_alert: false });
      await showAdminTicket(chatId, ticketId);
    }
    return;
  }

  // ── Пополнение ──
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
      `*Заявка на пополнение — тикет #${ticketId}*\n\nАккаунт: \`${account.username}\`\nСумма: *${amount} СБТ* (${amount} ₽)\nДата: ${dateStr}\n\nАдминистратор ответит и пришлёт реквизиты. После оплаты нажми кнопку и прикрепи скриншот чека.`,
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

  // ── Категория тикета ──
  const CAT_MAP = { tcat_tech: "Технические проблемы", tcat_account: "Вопрос по аккаунту", tcat_pay: "Вопрос по покупке", tcat_bug: "Баг или ошибка", tcat_report: "Жалоба на игрока", tcat_other: "Другое" };
  if (q.data in CAT_MAP) {
    const category = CAT_MAP[q.data];
    botSessions.set(chatId, { state: "awaiting_ticket_desc", category });
    bot.sendMessage(chatId, `Категория: *${category}*\n\nОпиши проблему подробно:`, { parse_mode: "Markdown" });
    return;
  }

  // ── Отправить чек ──
  if (q.data.startsWith("send_receipt_")) {
    const ticketId = parseInt(q.data.split("_")[2], 10);
    botSessions.set(chatId, { state: "awaiting_receipt", ticketId });
    bot.sendMessage(chatId, `Тикет \`#${ticketId}\` — прикрепи скриншот или фото чека следующим сообщением.`,
      { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "Отмена", callback_data: "cancel_input" }]] } }
    );
    return;
  }

  // ── Подтвердить/отклонить оплату ──
  if (q.data.startsWith("confirm_pay_")) {
    if (!isAdm) { bot.answerCallbackQuery(q.id, { text: "Нет прав.", show_alert: true }); return; }
    const parts    = q.data.split("_");
    const ticketId = parseInt(parts[2], 10);
    const userId   = parts[3];
    const amount   = parseInt(parts[4], 10);
    const acc      = await redisAccounts.get(userId);
    const ticket   = tickets.get(ticketId);
    if (acc && amount > 0) {
      acc.balance = (acc.balance || 0) + amount;
      await redisAccounts.set(userId, acc);
      if (ticket) { ticket.status = "closed"; ticket.messages.push({ id: uuidv4(), from: "system", text: `Оплата подтверждена. Зачислено ${amount} СБТ.`, time: Date.now() }); broadcastToAdmins({ type: "ticket_update", ticket: ticketSummary(ticket) }); }
      try { await bot.sendMessage(userId, `Оплата подтверждена.\n+*${amount} СБТ* зачислено. Баланс: *${acc.balance.toLocaleString("ru-RU")} СБТ*`, { parse_mode: "Markdown", reply_markup: USER_KB }); } catch {}
      sendToUser(userId, { type: "balance_update", balance: acc.balance });
      bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: q.message.message_id }).catch(() => {});
      bot.answerCallbackQuery(q.id, { text: `+${amount} СБТ зачислено`, show_alert: true });
    } else { bot.answerCallbackQuery(q.id, { text: "Аккаунт не найден.", show_alert: true }); }
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

// ─── Сообщения (состояния) ────────────────────────────────────────────────────

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
    const match     = replyText.match(/тикет[:\s#]+(\d+)/i);
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
        bot.sendMessage(chatId, `Ответ отправлен в тикет \`#${ticketId}\`.`, { parse_mode: "Markdown" });
        return;
      }
    }
  }

  // ── АДМИН: просмотр тикета — текст = ответ в тикет ──
  if (!session && isAdm) return;

  // ── Клавиатурные кнопки (без сессии) ──
  if (!session && msg.text) {
    const text = msg.text.trim();

    // Пользовательские кнопки
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
        const emoji = { open: "≡ƒƒí", answered: "≡ƒƒó", closed: "ΓÜ½", in_progress: "≡ƒö╡" }[t.status] || "ΓÜ¬";
        return `${emoji} *#${t.id}* ΓÇö ${t.category}\nΓöö _${t.preview?.slice(0, 50)}_`;
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

    // Админские кнопки
    if (isAdm && text === "Тикеты") {
      return showAdminTicketList(chatId, "open");
    }

    if (isAdm && text === "Баланс участника") {
      botSessions.set(chatId, { state: "admin_awaiting_balance_nick" });
      return bot.sendMessage(chatId, "Введи ник или TG ID участника:");
    }
  }

  if (!session) return;

  // Ввод кастомной суммы
  if (session.state === "awaiting_topup_amount") {
    const amount = parseInt(msg.text?.trim(), 10);
    botSessions.delete(chatId);
    if (!amount || amount < 50 || amount > 100000) { bot.sendMessage(chatId, "Сумма должна быть от 50 до 100 000 рублей.", { reply_markup: USER_KB }); return; }
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
      `*Заявка на пополнение — тикет #${ticketId}*\n\nАккаунт: \`${account.username}\`\nСумма: *${amount} СБТ* (${amount} ₽)\nДата: ${dateStr}\n\nАдминистратор ответит и пришлёт реквизиты. После оплаты нажми кнопку и прикрепи скриншот чека.`,
      { parse_mode: "Markdown", reply_markup: { inline_keyboard: [
        [{ text: "Отправить чек",        callback_data: `send_receipt_${ticketId}` }],
        [{ text: "Написать в поддержку", callback_data: "new_ticket_cb"            }],
      ]}}
    );
    return;
  }

  // ── АДМИН: поиск баланса участника ──
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

  // Получение чека
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
          { text: "Отклонить",   callback_data: `reject_pay_${ticketId}_${tgId}`               },
        ]]};
        if (hasPhoto) await bot.sendPhoto(tid, msg.photo[msg.photo.length - 1].file_id, { caption, reply_markup: rm });
        else          await bot.sendDocument(tid, msg.document.file_id, { caption, reply_markup: rm });
      } catch (e) { console.error("[admin notify]", e.message); }
    }
    bot.sendMessage(chatId, `Чек получен. Тикет \`#${ticketId}\` обновлён — администратор проверит оплату и зачислит баланс.`, { parse_mode: "Markdown", reply_markup: USER_KB });
    return;
  }

  // Описание тикета
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


// ΓöÇΓöÇΓöÇ Start ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
server.listen(PORT, "0.0.0.0", () => console.log(`SBGames HTTP  :${PORT}`));

try {
  const sslOpts = { key: fs.readFileSync(SSL_KEY), cert: fs.readFileSync(SSL_CERT) };
  const httpsServer = https.createServer(sslOpts, app);
  const wssSSL = new WebSocketServer({ server: httpsServer });
  wssSSL.on("connection", (ws) => wss.emit("connection", ws));
  httpsServer.listen(PORT_SSL, "0.0.0.0", () => console.log(`SBGames HTTPS :${PORT_SSL}`));
} catch (e) {
  console.warn("HTTPS not started:", e.message);
}
