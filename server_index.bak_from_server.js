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

const BOT_TOKEN       = process.env.BOT_TOKEN       || "8703318210:AAEG9Zj12W7i6hfPnIqLXeedcZrDwH-2Os8";
const ADMIN_TG_IDS    = (process.env.ADMIN_TG_IDS   || "8092106401").split(",");
const ADMIN_USERNAMES = (process.env.ADMIN_USERNAMES || "efseea,rashadus").split(",");
let JWT_SECRET = crypto.randomBytes(48).toString("hex");
const PORT            = parseInt(process.env.PORT     || "3000", 10);
const PORT_SSL        = parseInt(process.env.PORT_SSL || "3443", 10);
const BOT_USERNAME    = process.env.BOT_USERNAME || "sbgamescbot";

const SSL_KEY  = "/etc/ssl/private/sbgames.key";
const SSL_CERT = "/etc/ssl/certs/sbgames.crt";

// G��G��G�� Redis G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��
const redis = new Redis({ host: "127.0.0.1", port: 6379, lazyConnect: true });
redis.connect().catch(() => console.warn("[redis] not available, using memory"));

// -�-�-�-�-�-�-�-�-+ -+-+-+ -�-�-+-�-�-+-�-�-�-+ -+-�-�-�-+-�-�-�-+-�-+-�-� JWT_SECRET
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
  // -�-+-+-�-� -+-+ -�-�-�-+ -�-�-�-�-�-+-�-�-+ -� Redis + memory
  async search(q, limit = 30) {
    if (!q || q.length < 2) return [];
    const ql = q.toLowerCase();
    const results = [];
    // Memory
    for (const acc of this._map.values()) {
      if (acc.username?.toLowerCase().includes(ql)) results.push(acc);
    }
    // Redis scan (-+-� -�-+-�-�-�-� -�-�-+-+ -� memory -+-�-�, -� -� redis -�-�-�-�)
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

// G��G��G�� Trust proxy (nginx) G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��
app.set("trust proxy", 1);

// G��G��G�� Static: backgrounds (video files) G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��
app.use("/backgrounds", express.static(
  require("path").join(__dirname, "backgrounds"),
  { maxAge: "7d", etag: true, lastModified: true }
));

// G��G��G�� Static: frames (PNG images) G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��
app.use("/frames", express.static(
  require("path").join(__dirname, "frames"),
  { maxAge: "7d", etag: true, lastModified: true }
));

// G��G��G�� Static: icons (PNG images) G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��
app.use("/icons", express.static(
  require("path").join(__dirname, "icons"),
  { maxAge: "7d", etag: true, lastModified: true }
));

// G��G��G�� Security headers G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��
// CSP is intentionally minimal G�� this is an API server, not serving HTML pages.
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

// G��G��G�� CORS G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��
const ALLOWED_ORIGINS = new Set([
  "https://api.hyperionsearch.xyz",
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

// G��G��G�� Body limits G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��
app.use(express.json({ limit: "16kb" }));

// G��G��G�� IP blocklist (Redis-backed, in-memory fallback) G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��
const blockedIPs     = new Map(); // ip G�� unblock timestamp
const failedAttempts = new Map(); // ip G�� { count, firstAt }
const BLOCK_AFTER    = 8;         // -+-�-�-�-�-�-+-�-� -+-+-+-�-�-+-�
const BLOCK_TTL      = 15 * 60 * 1000; // 15 -+-+-+-�-�
const ATTEMPT_WINDOW = 10 * 60 * 1000; // -+-�-+-+ -+-+-�-�-�-�-�-�

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
  if (isBlocked(ip)) return res.status(429).json({ message: "-�-+-+-�-�-+-+ -+-+-+-�-+ -+-+-+-�-�-+-�. -�-+-+-�-+-�-�-�-�-� -+-+-+-�-�." });
  next();
}

// G��G��G�� Rate limiters G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��
const makeLimit = (windowMs, max, msg) => rateLimit({
  windowMs, max,
  message:        { message: msg || "-�-+-+-�-�-+-+ -+-+-+-�-+ -+-�-+-�-+-�-+-�" },
  standardHeaders: true,
  legacyHeaders:  false,
  keyGenerator:   req => getIP(req),
  skip:           req => isAdmin(req.body?.username) || isAdminId(String(req.body?.tgUser?.id || "")),
});

const authLimiter      = makeLimit(60_000, 30,  "-�-+-+-�-�-+-+ -+-+-+-�-+ -+-+-+-�-�-+-� -�-�-+-�-�");
const apiLimiter       = makeLimit(60_000, 100, "-�-+-+-�-�-+-+ -+-+-+-�-+ -+-�-+-�-+-�-+-�");
const strictLimiter    = makeLimit(60_000, 3,   "-�-�-�-�-�-�-�-+ -+-+-+-+-� -+-�-+-�-+-�-+-�");

app.use("/auth/tg-login",    blockMiddleware, authLimiter);
app.use("/auth/widget-login", blockMiddleware, authLimiter);
// create-code -+ check-code G�� -�-�-+ -+-+-+-+-�-+-�, -�-�-+ -�-�-+-+-�-+-�-+-�-� -+-+-�-�-�-�-+-+
app.use("/payments",         blockMiddleware, strictLimiter);
app.use("/admin",            blockMiddleware);
app.use("/api",              apiLimiter);
app.use("/support/ticket",   apiLimiter);

// ─── Auto-updater endpoint ────────────────────────────────────────────────────
const LATEST_VERSION = "1.0.0";
const UPDATE_BASE    = "https://api.hyperionsearch.xyz/update";
const UPDATE_NOTES   = "Обновление лаунчера";

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


// G��G��G�� Request ID & logging G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��
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

// G��G��G�� Stores G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��
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

// G��G��G�� REST G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��

// -�-�-+-� -�-�-�-�-+ Telegram Widget (-� -�-�-�-+-�-+-�-�-�-+-�-� -�-�-�-�)
app.post("/auth/widget-login", async (req, res) => {
  const tgData = req.body;
  if (!tgData || !tgData.hash) return res.status(400).json({ message: "-�-�-� -�-�-+-+-�-�" });

  if (!verifyTelegramAuth(tgData)) return res.status(401).json({ message: "-�-�-�-�-�-+-�-� -+-+-�-+-+-�-� Telegram" });

  const tgId = String(tgData.id);
  let account = await redisAccounts.get(tgId);
  const adminRole = isAdmin(tgData.username || "") || isAdminId(tgId) ? "admin" : "user";

  if (!account) {
    // -�-+-�-�-� -+-+-+-�-+-+-�-�-�-�-+-� G�� -+-�-�-�-+ -+-+-�
    return res.json({ needNick: true, tgUser: tgData });
  }

  account.telegram = tgData.username || account.telegram;
  account.role     = adminRole;
  await redisAccounts.set(tgId, account);

  res.json({ user: account, token: signToken(tgId) });
});

// -�-�-�-�-�-�-�-+-+-� -�-�-�-+-�-�-�-�-�-+-+ (-+-+-�) G�� -+-+-�-�-�-�-�-+-�-�-�-� desktop flow
app.post("/auth/tg-login", async (req, res) => {
  const ip = getIP(req);
  const { tgUser, username } = req.body;
  if (!tgUser) {
    recordFailure(ip);
    return res.status(400).json({ message: "-P-�-�-+-�-�-�-+-�-+-�-� -+-+-+-� -+-�-�-�-�-�-�-�-�-�-�" });
  }
  const tgId = String(tgUser.id);
  if (!tgUser.id || tgUser.id <= 0) {
    recordFailure(ip);
    return res.status(401).json({ message: "-�-�-�-�-+-+-�-+-�-� -+-+-+-�-+-+-�-�-�-�-+-�" });
  }

  // Desktop flow: -�-�-+-+ -�-�-�-�-�-+-� -�-�-� -�-�-�-� G�� -+-�-+-�-�-+ -+-+-�-+-+-+-+ -�-�-+ -+-�-+-�-+-�-� -+-+-�-�
  let account = await redisAccounts.get(tgId);
  if (account) {
    account.telegram = tgUser.username || account.telegram;
    account.role = isAdmin(tgUser.username || account.username) || isAdminId(tgId) ? "admin" : "user";
    await redisAccounts.set(tgId, account);
    return res.json({ user: account, token: signToken(tgId) });
  }

  // -�-+-�-�-� -+-+-+-�-+-+-�-�-�-�-+-� G�� -+-+-� -+-�-�-+-�-�-�-+-�-+
  if (!username) {
    return res.status(400).json({ needNick: true, message: "-�-�-+-�-�-+-�-� -+-�-�-+-�-+-� -+-+-�" });
  }
  const cleanNick = sanitize(username).replace(/^@/, "");
  if (!/^[a-zA-Z0-9_]{3,16}$/.test(cleanNick)) {
    recordFailure(ip);
    return res.status(400).json({ message: "-�-+-�: 3G��16 -�-+-+-�-+-+-+-�, -�-�-�-�-�/-�-+-�-�-�/_" });
  }

  const adminRole = isAdmin(tgUser.username || cleanNick) || isAdminId(tgId) ? "admin" : "user";
  account = { id: tgId, username: cleanNick, telegram: tgUser.username || null, firstName: sanitize(tgUser.first_name || "", 64), balance: 0, role: adminRole, createdAt: Date.now() };
  await redisAccounts.set(tgId, account);
  res.json({ user: account, token: signToken(tgId) });
});

// -�-�-+-�-�-+ -�-�-+-+-� -�-�-+-�-� -+-�-+-�-�-+ CSP
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
  // -�-�-+-+-�-�-+-�-�-+-�-+-+ -+-�-+-�-�-�-�-�-+ -�-+-+-�
  if (isAdminId(payload.sub) && acc.role !== "admin") {
    acc.role = "admin";
    await redisAccounts.set(payload.sub, acc);
  }
  res.json({ user: acc });
});

// -�-+-+-�-� -+-�-�-+-�-+-� -+-+ -+-+-�-� G�� -�-�-�-+-�-�-�-� -+-+ -�-�-�-+ -+-�-�-�-�-+-�-�-�-+-�-+-�-�-+-+-�-+ (-+-� -�-+-+-�-�-+ -+-+-+-�-�-+)
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
  if (!t) return res.status(404).json({ message: "-�-+-�-�-� -+-� -+-�-�-�-�-+" });
  res.json(t);
});

app.post("/support/ticket", (req, res) => {
  const rawCategory = sanitize(req.body.category || "", 80);
  const rawMessage  = sanitize(req.body.message  || "", 2000);
  const rawUsername = sanitize(req.body.username || "Player", 32);
  const userId      = sanitize(req.body.userId || "anon", 64);
  if (!rawCategory || !rawMessage || rawMessage.length < 5)
    return res.status(400).json({ message: "-�-�-+-+-+-+-+-�-� -�-�-� -+-+-+-� (-+-+-+-+-+-�-+ 5 -�-+-+-�-+-+-+-�)" });
  const ticketId = ++ticketCounter;
  const ticket = { id: ticketId, userId, username: rawUsername, category: rawCategory, preview: rawMessage.slice(0, 60), status: "open", unread: 0, createdAt: Date.now(), messages: [
    { id: uuidv4(), from: "system", text: `-�-+-�-�-� #${ticketId} -�-+-+-�-�-+.`, time: Date.now() },
    { id: uuidv4(), from: userId, username: rawUsername, text: rawMessage, time: Date.now() },
  ]};
  tickets.set(ticketId, ticket);
  saveTicket(ticket);
  broadcastToAdmins({ type: "new_ticket", ticket: ticketSummary(ticket) });
  res.json({ ticketId });
});

// G��G��G�� Admin API G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��

// -�-�-+ -�-�-�-�-�-� -+-�-+-+-�-�-+-�-�-+-�-+-+ -�-�-�-�-+-+ -�-+-+-� admin -�-�-�-+ -+-+ ADMIN_TG_IDS
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
  // -�-�-�-�-�-+ -�-�-+-�-�-� ID -�-�-�-�-�-� -+-�-+-+-�-�-�-�-�-+
  if (isAdminId(tgId)) return tgId;
  // -�-+-�-�-� -+-�-+-�-�-�-�-�-+ -�-+-+-� -� Redis
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
  t.messages.push({ id: uuidv4(), from: "system", text: `-�-�-�-�-�-� -+-+-+-�-+-�-+: ${STATUS_LABELS[status] || status}`, time: Date.now() });
  broadcastToAdmins({ type: "ticket_update", ticket: ticketSummary(t) });
  broadcastToTicket(t.id, null, { type: "ticket_update", ticket: ticketSummary(t) });
  if (status === "closed") broadcastToTicket(t.id, null, { type: "ticket_closed", ticketId: t.id });
  res.json({ ok: true });
});

const STATUS_LABELS = { open: "-P-�-�-�-�-�", in_progress: "-� -�-�-�-+-�-�", answered: "-P-�-�-�-�-+-+-+", closed: "-�-�-�-�-�-�" };

app.post("/admin/ticket/:id/close", async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  const t = tickets.get(Number(req.params.id));
  if (!t) return res.status(404).json({ message: "Not found" });
  t.status = "closed";
  broadcastToAdmins({ type: "ticket_update", ticket: ticketSummary(t) });
  broadcastToTicket(t.id, null, { type: "ticket_closed", ticketId: t.id });
  res.json({ ok: true });
});

// G��G��G�� Payments G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��

const METHOD_NAMES = { card_ru: "-�-�-�-�-� -�-�-�", card_ua: "-�-�-�-�-� Master/Visa", crypto: "-�-�-+-+-�-+-�-�-+-�-�-�", sbp: "-�-�-�" };

app.post("/payments/create", async (req, res) => {
  const token  = (req.headers.authorization || "").replace("Bearer ", "");
  const amount = parseInt(req.body.amount, 10);
  const method = req.body.method || "card_ru";
  if (!amount || amount < 50) return res.status(400).json({ message: "-�-+-+-+-+-�-+-�-+-�-� -�-�-+-+-� G�� 50 -�-�-�" });
  let userId = null;
  if (token) { const p = verifyToken(token); if (p) userId = p.sub; }
  const invoiceId = invoiceCounter++;
  invoices.set(invoiceId, { userId, amount, method, createdAt: Date.now(), status: "pending" });
  res.json({ url: `https://t.me/${BOT_USERNAME}?start=pay_${invoiceId}_${amount}_${method}` });
});

// G��G��G�� Auth middleware G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��
function optionalAuth(req, _res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  req.userId = token ? verifyToken(token)?.sub : null;
  next();
}
function requireAuth(req, res, next) {
  optionalAuth(req, res, () => {
    if (!req.userId) return res.status(401).json({ message: "-�-�-+-�-�-+-�-+-+-� -�-�-�-+-�-+-+-�-�-+-�" });
    next();
  });
}

// G��G��G�� Shop Catalog G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��
const SHOP_CATALOG = [
  { id: "frame_basic_gray",  type: "frame",    name: "Torn",                  price: 0,    preview: "#6b7280" },
  { id: "badge_heart",       type: "badge",    name: "-�-�-�-�-�-�",                price: 0,    preview: "#f43f5e" },
  { id: "frame_basic_blue",  type: "frame",    name: "Sketched Memory",      price: 200,  preview: "#3b82f6" },
  { id: "frame_neon",        type: "frame",    name: "Bewitching Frame",     price: 500,  preview: "#a855f7" },
  { id: "frame_gold",        type: "frame",    name: "oil",                  price: 1500, preview: "#facc15" },
  { id: "frame_galaxy",      type: "frame",    name: "-�-+-+-+ -� -+-�-+-�",          price: 3000, preview: "linear-gradient(135deg,#6366f1,#a855f7,#ec4899)" },
  { id: "frame_fire",        type: "frame",    name: "Husk Frame",           price: 2000, preview: "linear-gradient(135deg,#dc2626,#f97316,#facc15)" },
  { id: "frame_ice",         type: "frame",    name: "-�-�-�-�-+-�-�",              price: 2000, preview: "linear-gradient(135deg,#0ea5e9,#38bdf8,#e0f2fe)" },
  { id: "bg_fon1",           type: "background", name: "Lilywhite & Lilyblack", price: 0,  preview: "#3b82f6" },
  { id: "bg_fon2",           type: "background", name: "Miss Neko 2",        price: 500,  preview: "#8b5cf6" },
  { id: "bg_fon3",           type: "background", name: "Muse Dash",          price: 800,  preview: "#ec4899" },
  { id: "bg_fon4",           type: "background", name: "GetsuClanEstate",    price: 1200, preview: "#f97316" },
  { id: "bg_fon5",           type: "background", name: "Circle of Hell",     price: 1500, preview: "#eab308" },
  { id: "bg_fon6",           type: "background", name: "Black Hole",         price: 2000, preview: "#22c55e" },
  { id: "bg_fon7",           type: "background", name: "noir-anime2",        price: 2500, preview: "#06b6d4" },
  { id: "anim_pulse",        type: "avatar_animated", name: "-�-+-+-�-+-�-�",     price: 1200, preview: "#60a5fa" },
  { id: "anim_flame",        type: "avatar_animated", name: "-�-+-�-+-�",       price: 1200, preview: "#f97316" },
  { id: "anim_neon",         type: "avatar_animated", name: "-�-�-+-+",        price: 1500, preview: "#a855f7" },
  { id: "badge_diamond",     type: "badge",    name: "-�-�-+-+-+-+-�-+-�",           price: 800,  preview: "#38bdf8" },
  { id: "badge_flame",       type: "badge",    name: "-�-+-�-+-�",               price: 600,  preview: "#f97316" },
  { id: "badge_star",        type: "badge",    name: "-�-�-�-+-�-�",              price: 500,  preview: "#facc15" },
  { id: "badge_skull",       type: "badge",    name: "-�-�-�-�-+",               price: 1000, preview: "#ef4444" },
];

const MARKET_CATALOG = [
  { id: "m_cosmic_chest",   type: "chest",      name: "-�-+-�-+-+-�-�-�-�-+-� -�-�-�-�",  preview: "linear-gradient(135deg,#1e1b4b,#7c3aed,#ec4899)" },
  { id: "m_saber_relic",    type: "relic",      name: "-�-�-+-+-�-�-+-� -�-+-+-�",     preview: "linear-gradient(135deg,#0c4a6e,#0ea5e9,#22d3ee)" },
  { id: "m_dragon_scale",   type: "material",   name: "-�-�-�-�-+-+-�-� -�-�-�-�-�",    preview: "linear-gradient(135deg,#7f1d1d,#dc2626,#fb923c)" },
  { id: "m_ghost_cape",     type: "skin",       name: "-�-�-+-+-�-�-�-+-�-� -+-+-�-�",   preview: "linear-gradient(135deg,#1e293b,#475569,#94a3b8)" },
  { id: "m_ember_token",    type: "token",      name: "-�-�-+-+-�-+-�-� -�-�-�-+-+",    preview: "linear-gradient(135deg,#7f1d1d,#ea580c)" },
  { id: "m_neon_disc",      type: "disc",       name: "-�-�-+-+-+-�-�-� -�-+-�-�",     preview: "linear-gradient(135deg,#581c87,#a855f7,#22d3ee)" },
  { id: "m_void_pearl",     type: "pearl",      name: "-�-�-+-�-�-�-+-+-� -�-�-+-�-+-�",  preview: "linear-gradient(135deg,#020617,#1e1b4b,#0ea5e9)" },
  { id: "m_aurora_shard",   type: "shard",      name: "-P-�-�-+-+-+-� -�-�-�-+-�-�",    preview: "linear-gradient(135deg,#0c4a6e,#22d3ee,#a855f7)" },
];

// G��G��G�� Public profile G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��
app.get("/api/user/:id", async (req, res) => {
  const id = sanitize(req.params.id, 64);
  const acc = await redisAccounts.get(id);
  if (!acc) return res.status(404).json({ message: "-�-�-�-+-� -+-� -+-�-�-�-�-+" });
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

// G��G��G�� Profile comments G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��
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
  if (id === req.userId) return res.status(400).json({ message: "-�-�-+-�-+-� -�-+-+-+-�-+-�-+-�-+-�-�-�-� -�-�-+-� -+-�-+-�-+-+-�" });
  const text = sanitize(req.body.text || "", 200);
  if (text.length < 2) return res.status(400).json({ message: "-�-+-+-�-�-+-+ -�-+-�-+-�-�-+-� -�-+-+-+-�-+-�-�-�-+-�" });
  const now = Date.now();
  const last = lastCommentAt.get(req.userId) || 0;
  if (now - last < 10_000) return res.status(429).json({ message: "-�-+-�-+-�-�-+ 10 -�-�-�-�-+-�" });
  const hourly = (commentHourly.get(req.userId) || []).filter(t => now - t < 3600_000);
  if (hourly.length >= 5) return res.status(429).json({ message: "-�-+-+-�-�-+-+ -+-+-+-�-+ -�-+-+-+-�-+-�-�-�-+-�-�" });
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

app.delete("/api/user/:id/comments/:cid", requireAuth, (req, res) => {
  const targetId = sanitize(req.params.id, 64);
  const cid = sanitize(req.params.cid, 64);
  const list = profileComments.get(targetId) || [];
  const idx = list.findIndex(c => c.id === cid);
  if (idx === -1) return res.status(404).json({ message: "Comment not found" });
  const c = list[idx];
  if (c.fromId !== req.userId) return res.status(403).json({ message: "Not your comment" });
  list.splice(idx, 1);
  profileComments.set(targetId, list);
  try { redis.del(`sbgames:comments:${targetId}`); for (const item of list) redis.rpush(`sbgames:comments:${targetId}`, JSON.stringify(item)); } catch {}
  res.json({ ok: true });
});

// G��G��G�� Bio G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��
app.get("/api/user/bio", requireAuth, async (req, res) => {
  const acc = await redisAccounts.get(req.userId);
  res.json({ bio: acc?.bio || "" });
});

app.put("/api/user/bio", requireAuth, async (req, res) => {
  const bio = sanitize(req.body.bio || "", 300);
  const acc = await redisAccounts.get(req.userId);
  if (!acc) return res.status(404).json({ message: "-�-�-�-�-�-+-� -+-� -+-�-�-�-�-+" });
  acc.bio = bio;
  await redisAccounts.set(req.userId, acc);
  res.json({ ok: true, bio: acc.bio });
});

// G��G��G�� Inventory G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��
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
  if (!item) return res.status(404).json({ message: "-�-�-�-�-+-�-� -+-� -+-�-�-�-�-+" });
  const acc = await redisAccounts.get(req.userId);
  if (!acc) return res.status(404).json({ message: "-�-�-�-�-�-+-� -+-� -+-�-�-�-�-+" });
  const owned = Array.isArray(acc.inventory) ? acc.inventory : [];
  if (owned.includes(itemId)) return res.status(400).json({ message: "-�-�-� -�-�-+-+-�-+-+" });
  if ((acc.balance || 0) < item.price) return res.status(400).json({ message: "-�-�-�-+-�-�-�-�-+-�-+-+ -�-�-�", need: item.price, have: acc.balance || 0 });
  acc.balance = (acc.balance || 0) - item.price;
  acc.inventory = [...owned, itemId];
  await redisAccounts.set(req.userId, acc);
  res.json({ ok: true, balance: acc.balance, inventory: acc.inventory });
});

app.post("/api/inventory/equip", requireAuth, async (req, res) => {
  const itemId = sanitize(req.body.itemId || "", 64);
  const acc = await redisAccounts.get(req.userId);
  if (!acc) return res.status(404).json({ message: "-�-�-�-�-�-+-� -+-� -+-�-�-�-�-+" });
  const owned = Array.isArray(acc.inventory) ? acc.inventory : [];
  if (!owned.includes(itemId)) return res.status(400).json({ message: "-�-+-�-�-�-+-� -�-�-+-+ -+-�-�-�-+-�-�" });
  const item = SHOP_CATALOG.find(i => i.id === itemId);
  if (!item) return res.status(404).json({ message: "-�-�-�-�-+-�-� -+-� -+-�-�-�-�-+" });
  acc.equip = { ...(acc.equip || {}), [item.type]: itemId };
  await redisAccounts.set(req.userId, acc);
  res.json({ ok: true, equip: acc.equip });
});

app.post("/api/inventory/unequip", requireAuth, async (req, res) => {
  const type = sanitize(req.body.type || "", 32);
  if (!["frame","background","avatar_animated","badge"].includes(type)) return res.status(400).json({ message: "-�-�-�-�-�-+-�-� -�-+-+" });
  const acc = await redisAccounts.get(req.userId);
  if (!acc) return res.status(404).json({ message: "-�-�-�-�-�-+-� -+-� -+-�-�-�-�-+" });
  acc.equip = { ...(acc.equip || {}) };
  delete acc.equip[type];
  await redisAccounts.set(req.userId, acc);
  res.json({ ok: true, equip: acc.equip });
});

// G��G��G�� Activity G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��
const activityStore = new Map();

app.post("/api/activity", requireAuth, (req, res) => {
  const { serverId, startedAt, endedAt, durationSec } = req.body || {};
  if (!serverId || typeof startedAt !== "number" || typeof endedAt !== "number") return res.status(400).json({ message: "-�-�-�-�-�-+-�-� -+-+-+-�" });
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

// G��G��G�� Marketplace G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��
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
  if (!acc || acc.role !== "admin") return res.status(403).json({ message: "-�-+-+-�-�-+ -�-�-+-+-+" });
  const targetId = sanitize(req.body.userId || "", 64);
  const itemId = sanitize(req.body.itemId || "", 64);
  const target = await redisAccounts.get(targetId);
  if (!target) return res.status(404).json({ message: "-�-�-�-+-� -+-� -+-�-�-�-�-+" });
  const item = MARKET_CATALOG.find(i => i.id === itemId);
  if (!item) return res.status(404).json({ message: "-�-�-�-�-+-�-� -+-� -+-�-�-�-�-+" });
  target.market_inventory = Array.isArray(target.market_inventory) ? [...target.market_inventory, itemId] : [itemId];
  await redisAccounts.set(targetId, target);
  res.json({ ok: true, market: target.market_inventory });
});

app.post("/api/market/sell", requireAuth, async (req, res) => {
  const { itemId, price } = req.body || {};
  const cleanId = sanitize(String(itemId || ""), 64);
  const priceNum = parseInt(price, 10);
  if (!cleanId) return res.status(400).json({ message: "-�-� -�-�-�-+-�-+ -+-�-�-�-+-�-�" });
  if (!Number.isFinite(priceNum) || priceNum < 10 || priceNum > 100000) return res.status(400).json({ message: "-�-�-+-�: 10G��100000 -�-�-�" });
  const acc = await redisAccounts.get(req.userId);
  if (!acc) return res.status(404).json({ message: "-�-�-�-�-�-+-� -+-� -+-�-�-�-�-+" });
  const marketOwn = Array.isArray(acc.market_inventory) ? acc.market_inventory : [];
  if (!marketOwn.includes(cleanId)) return res.status(400).json({ message: "-�-�-� -�-�-+-�-+ -+-�-�-�-+-�-�-�" });
  const item = MARKET_CATALOG.find(i => i.id === cleanId);
  if (!item) return res.status(404).json({ message: "-�-�-�-�-+-�-� -+-� -+-�-�-�-�-+" });
  const hasActive = [...listings.values()].some(l => l.status === "active" && l.sellerId === req.userId && l.itemId === cleanId);
  if (hasActive) return res.status(400).json({ message: "-�-�-� -�-�-�-�-�-�-+-�-+" });
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
  if (!listing) return res.status(404).json({ message: "-�-+-�-�-+-+-� -+-� -+-�-�-�-�-+" });
  if (listing.status !== "active") return res.status(400).json({ message: "-�-�-� -+-�-�-�-�-�-�-+" });
  if (listing.sellerId === req.userId) return res.status(400).json({ message: "-�-�-+-�-+-� -�-�-+-+-�-� -�-�-+-�" });
  const buyer = await redisAccounts.get(req.userId);
  if (!buyer) return res.status(404).json({ message: "-�-�-�-�-�-+-� -+-� -+-�-�-�-�-+" });
  if ((buyer.balance || 0) < listing.price) return res.status(400).json({ message: "-�-�-�-+-�-�-�-�-+-�-+-+ -�-�-�" });
  const seller = await redisAccounts.get(listing.sellerId);
  if (!seller) return res.status(404).json({ message: "-�-�-+-�-�-�-�-� -+-� -+-�-�-�-�-+" });
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
  if (!listing) return res.status(404).json({ message: "-�-+-�-�-+-+-� -+-� -+-�-�-�-�-+" });
  if (listing.sellerId !== req.userId) return res.status(403).json({ message: "-�-� -�-�-+-�" });
  if (listing.status !== "active") return res.status(400).json({ message: "-�-�-� -+-�-�-�-�-�-�-+" });
  const acc = await redisAccounts.get(req.userId);
  if (acc) { acc.market_inventory = Array.isArray(acc.market_inventory) ? [...acc.market_inventory, listing.itemId] : [listing.itemId]; await redisAccounts.set(req.userId, acc); }
  listing.status = "cancelled";
  listings.set(id, listing);
  saveListing(listing);
  res.json({ ok: true });
});

// G��G��G�� Groups G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��
const groups = new Map(), groupMessages = new Map(), groupInvites = new Map();
let groupCounter = 0;
const GROUP_MAX = 8;

// ─── Redis persistence for groups ──────────────────────────────────────────
async function saveGroup(g) {
  try {
    const data = { id: g.id, name: g.name, ownerId: g.ownerId, members: [...g.members], createdAt: g.createdAt };
    await redis.set(`sbgames:group:${g.id}`, JSON.stringify(data));
    await redis.sadd("sbgames:group_ids", g.id);
  } catch {}
}
async function deleteGroupFromRedis(gid) {
  try { await redis.del(`sbgames:group:${gid}`); await redis.srem("sbgames:group_ids", gid); } catch {}
}
async function loadGroupsFromRedis() {
  try {
    const ids = await redis.smembers("sbgames:group_ids");
    for (const id of ids) {
      const raw = await redis.get(`sbgames:group:${id}`);
      if (!raw) continue;
      const d = JSON.parse(raw);
      const g = { id: d.id, name: d.name, ownerId: d.ownerId, members: new Set(d.members), createdAt: d.createdAt };
      groups.set(id, g); groupMessages.set(id, []);
      const numId = parseInt(id, 10);
      if (!isNaN(numId) && numId >= groupCounter) groupCounter = numId + 1;
    }
    console.log(`[groups] loaded ${groups.size} groups from Redis`);
  } catch (e) { console.warn("[groups] failed to load from Redis:", e.message); }
}

// ─── Redis persistence for comments ────────────────────────────────────────
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
            await redis.del("sbgames:comments");
            for (const c of arr) await redis.rpush(`sbgames:comments:${userId}`, JSON.stringify(c));
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

// ─── Redis persistence for DMs ─────────────────────────────────────────────
async function saveDM(key, msgs) {
  try { await redis.set(`sbgames:dm:${key}`, JSON.stringify(msgs.slice(-200))); } catch {}
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

// ─── Redis persistence for friendships ───────────────────────────────────────
async function saveFriendships(userId) {
  try {
    const set = friendships.get(userId);
    if (set && set.size > 0) {
      await redis.set(`sbgames:friends:${userId}`, JSON.stringify([...set]));
    } else {
      await redis.del(`sbgames:friends:${userId}`);
    }
  } catch {}
}
async function saveFriendRequests(userId) {
  try {
    const reqs = friendRequests.get(userId);
    if (reqs && reqs.length > 0) {
      await redis.set(`sbgames:friendreqs:${userId}`, JSON.stringify(reqs));
    } else {
      await redis.del(`sbgames:friendreqs:${userId}`);
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

// ─── Redis persistence for listings ──────────────────────────────────────────
async function saveListing(l) {
  try { await redis.set(`sbgames:listing:${l.id}`, JSON.stringify(l)); await redis.sadd("sbgames:listing_ids", l.id); } catch {}
}
async function deleteListingFromRedis(id) {
  try { await redis.del(`sbgames:listing:${id}`); await redis.srem("sbgames:listing_ids", id); } catch {}
}
async function loadListingsFromRedis() {
  try {
    const ids = await redis.smembers("sbgames:listing_ids");
    for (const id of ids) {
      const raw = await redis.get(`sbgames:listing:${id}`);
      if (raw) { const l = JSON.parse(raw); listings.set(id, l); const numId = parseInt(id, 10); if (!isNaN(numId) && numId >= listingCounter) listingCounter = numId + 1; }
    }
    console.log(`[listings] loaded ${listings.size} from Redis`);
  } catch (e) { console.warn("[listings] failed to load:", e.message); }
}

// ─── Redis persistence for tickets ───────────────────────────────────────────
async function saveTicket(t) {
  try { await redis.set(`sbgames:ticket:${t.id}`, JSON.stringify(t)); await redis.sadd("sbgames:ticket_ids", String(t.id)); } catch {}
}
async function loadTicketsFromRedis() {
  try {
    const ids = await redis.smembers("sbgames:ticket_ids");
    for (const id of ids) {
      const raw = await redis.get(`sbgames:ticket:${id}`);
      if (raw) { const t = JSON.parse(raw); tickets.set(id, t); const numId = parseInt(id, 10); if (!isNaN(numId) && numId >= ticketCounter) ticketCounter = numId + 1; }
    }
    console.log(`[tickets] loaded ${tickets.size} from Redis`);
  } catch (e) { console.warn("[tickets] failed to load:", e.message); }
}

// ─── Redis persistence for groupMessages ─────────────────────────────────────
async function saveGroupMessages(gid) {
  try {
    const msgs = groupMessages.get(gid);
    if (msgs && msgs.length > 0) {
      await redis.set(`sbgames:groupmsgs:${gid}`, JSON.stringify(msgs));
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

// ─── Redis persistence for groupInvites ──────────────────────────────────────
async function saveGroupInvites(gid) {
  try {
    const invs = groupInvites.get(gid);
    if (invs && invs.length > 0) {
      await redis.set(`sbgames:groupinv:${gid}`, JSON.stringify(invs));
    } else {
      await redis.del(`sbgames:groupinv:${gid}`);
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

// Load on startup
loadGroupsFromRedis();
loadGroupMessagesFromRedis();
loadGroupInvitesFromRedis();
loadCommentsFromRedis();
loadDMsFromRedis();
loadFriendshipsFromRedis();
loadFriendRequestsFromRedis();
loadListingsFromRedis();
loadTicketsFromRedis();

function publicGroup(g) {
  const members = [...g.members];
  const memberNames = {};
  for (const mid of members) {
    const acc = redisAccounts._map.get(mid);
    if (acc) memberNames[mid] = acc.username || mid;
  }
  return { id: g.id, name: g.name, ownerId: g.ownerId, members, memberNames, createdAt: g.createdAt };
}

app.get("/api/groups", requireAuth, (req, res) => {
  res.json({ groups: [...groups.values()].filter(g => g.members.has(req.userId)).map(publicGroup) });
});

app.post("/api/groups", requireAuth, (req, res) => {
  const name = sanitize(req.body.name || "", 40);
  if (name.length < 2 || name.length > 40) return res.status(400).json({ message: "-�-�-+-�-�-+-+-�: 2G��40 -�-+-+-�-+-+-+-�" });
  const id = String(++groupCounter);
  const g = { id, name, ownerId: req.userId, members: new Set([req.userId]), createdAt: Date.now() };
  groups.set(id, g); groupMessages.set(id, []);
  saveGroup(g);
  const pub = publicGroup(g);
  sendToUser(req.userId, { type: "group_update", group: pub });
  res.json({ ok: true, group: pub });
});

app.post("/api/groups/:id/invite", requireAuth, (req, res) => {
  const gid = sanitize(req.params.id, 32);
  const g = groups.get(gid);
  if (!g) return res.status(404).json({ message: "-�-�-�-+-+-� -+-� -+-�-�-�-�-+-�" });
  if (!g.members.has(req.userId)) return res.status(403).json({ message: "-�-� -+-� -� -�-�-�-+-+-�" });
  if (g.members.size >= GROUP_MAX) return res.status(400).json({ message: `-�-�-�-�-+-+-�-+ ${GROUP_MAX}` });
  const targetNick = sanitize(req.body.username || "", 32).toLowerCase();
  const target = [...redisAccounts._map.values()].find(a => (a.username || "").toLowerCase() === targetNick);
  if (!target) return res.status(404).json({ message: "-�-�-�-+-� -+-� -+-�-�-�-�-+" });
  if (g.members.has(target.id)) return res.status(400).json({ message: "-�-�-� -� -�-�-�-+-+-�" });
  const list = groupInvites.get(gid) || [];
  if (list.find(i => i.toId === target.id)) return res.status(400).json({ message: "-�-�-� -+-�-+-�-+-�-�-�-+" });
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
  if (!g) return res.status(404).json({ message: "-�-�-�-+-+-� -+-� -+-�-�-�-�-+-�" });
  const accept = !!req.body.accept;
  groupInvites.set(gid, (groupInvites.get(gid) || []).filter(i => i.toId !== req.userId));
  saveGroupInvites(gid);
  if (accept) { if (g.members.size >= GROUP_MAX) return res.status(400).json({ message: "-�-+-+-+-�-�" }); g.members.add(req.userId); saveGroup(g); for (const m of g.members) sendToUser(m, { type: "group_update", group: publicGroup(g) }); }
  res.json({ ok: true, group: publicGroup(g) });
});

app.post("/api/groups/:id/leave", requireAuth, (req, res) => {
  const gid = sanitize(req.params.id, 32);
  const g = groups.get(gid);
  if (!g) return res.status(404).json({ message: "-�-�-�-+-+-� -+-� -+-�-�-�-�-+-�" });
  g.members.delete(req.userId);
  if (g.members.size === 0) { groups.delete(gid); groupMessages.delete(gid); groupInvites.delete(gid); deleteGroupFromRedis(gid); }
  else { if (g.ownerId === req.userId) g.ownerId = g.members.values().next().value; saveGroup(g); for (const m of g.members) sendToUser(m, { type: "group_update", group: publicGroup(g) }); }
  res.json({ ok: true });
});

app.get("/api/groups/:id/messages", requireAuth, (req, res) => {
  const gid = sanitize(req.params.id, 32);
  const g = groups.get(gid);
  if (!g || !g.members.has(req.userId)) return res.status(403).json({ message: "-�-�-� -�-+-�-�-�-+-�" });
  res.json({ messages: (groupMessages.get(gid) || []).slice(-100) });
});

app.get("/api/groups/invites", requireAuth, (req, res) => {
  const out = [];
  for (const [gid, list] of groupInvites.entries()) for (const inv of list) if (inv.toId === req.userId) out.push({ ...inv, groupId: gid });
  res.json({ invites: out });
});

app.get("/online", (_, res) => {
  res.json({ users: [...wsClients.values()].filter(c => c.userId && c.username).map(c => ({ id: c.userId, username: c.username })) });
});

// G��G��G�� WebSocket G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��
const WS_MAX_PER_IP    = 5;    // -+-�-�-� -�-+-�-�-+-+-�-+-+-� -� -+-�-+-+-�-+ IP
const WS_AUTH_TIMEOUT  = 10_000; // 10-� -+-� -�-�-�-+-�-+-+-�-�-+-�
const WS_MSG_LIMIT     = 30;   // -�-+-+-�-�-�-+-+-� -� -+-+-+-�-�-�
const WS_MSG_WINDOW    = 60_000;
const wsIPCount        = new Map(); // ip G�� count

wss.on("connection", (ws, req) => {
  const clientId = uuidv4();
  const ip = (req.socket.remoteAddress || "").replace(/^::ffff:/, "");

  // -�-+-+-+-� -�-+-�-�-+-+-�-+-+-� per IP
  const ipCount = (wsIPCount.get(ip) || 0) + 1;
  wsIPCount.set(ip, ipCount);
  if (ipCount > WS_MAX_PER_IP || isBlocked(ip)) {
    ws.close(1008, "Too many connections");
    wsIPCount.set(ip, ipCount - 1);
    return;
  }

  wsClients.set(clientId, { ws, userId: null, role: "user", ip, msgCount: 0, msgWindowStart: Date.now(), isAlive: true });

  // Pong from client marks connection alive
  ws.on("pong", () => {
    const c = wsClients.get(clientId);
    if (c) c.isAlive = true;
  });

  // -�-�-�-+-�-�-� -�-�-�-+-�-+-+-�-�-+-+
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

      // Rate limit -�-+-+-�-�-�-+-+-�
      const now = Date.now();
      if (now - client.msgWindowStart > WS_MSG_WINDOW) { client.msgCount = 0; client.msgWindowStart = now; }
      client.msgCount++;
      if (client.msgCount > WS_MSG_LIMIT) {
        send(ws, { type: "error", text: "-�-+-+-�-�-+-+ -+-+-+-�-+ -�-+-+-�-�-�-+-+-�" });
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
            send(ws, { type: "auth_error", message: "-�-�-+-�-�-+-�-+-+-� -�-�-�-+-�-+-+-�-�-+-�" });
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
            myFriends = [...getFriends(client.userId)].map(fid => {
              const fa = [...redisAccounts._map.values()].find(a => a && a.id === fid);
              return fa ? { id: fa.id, username: fa.username } : null;
            }).filter(Boolean);
          } catch (e) {
            console.error("[WS Auth Error] Failed to retrieve friends:", e);
          }
          send(ws, { type: "friends_list", friends: myFriends });
          send(ws, { type: "friend_requests", requests: getPendingRequests(client.userId) });
          if (client.role === "admin") { const openCount = [...tickets.values()].filter(t => t.status !== "closed").length; send(ws, { type: "admin_ready", openTickets: openCount }); }
          break;
        }
        case "friend_request_send": {
          const target = [...redisAccounts._map.values()].find(a => a && (a.username || "").toLowerCase() === (msg.toUsername || "").trim().toLowerCase());
          if (!target)                              { send(ws, { type: "friend_error", message: "-�-+-+-�-+-+-�-�-�-�-+-� -+-� -+-�-�-�-�-+" }); break; }
          if (target.id === client.userId)          { send(ws, { type: "friend_error", message: "-�-�-+-�-+-� -�-+-�-�-�-+-�-� -�-�-�-�" }); break; }
          if (areFriends(client.userId, target.id)) { send(ws, { type: "friend_error", message: "-�-�-� -� -�-�-�-+-�-�-�" }); break; }
          const existing = getPendingRequests(target.id);
          if (existing.find(r => r.fromId === client.userId)) { send(ws, { type: "friend_error", message: "-�-�-�-�-�-� -�-�-� -+-�-+-�-�-�-+-�-+-�" }); break; }
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
              meFriends = [...getFriends(client.userId)].map(fid => {
                const fa = [...redisAccounts._map.values()].find(a => a && a.id === fid);
                return fa ? { id: fa.id, username: fa.username } : null;
              }).filter(Boolean);
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
            // -�-+-�-�-�-�-� -� TG -�-�-+-+ -+-+-+-�-+-+-�-�-�-�-+-� -+-+ -�-+-�-�
            if (ticket.tgChatId) {
              try {
                await bot.sendMessage(ticket.tgChatId,
                  `=�Ƽ *-P-�-�-�-� -+-+ -�-+-�-�-�-� #${ticket.id}*\n\n${cleanText}`,
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
        // -�-�-+-+-+ -+-�-+-�-�-�-+-�-�-� -�-�-�-�-+-+-+-�-� -�-�-�-�-+ -+-�-�-+-�-�-� G�� -�-+-�-�-�-�-�-+-+ -� TG
        case "send_requisites": {
          if (client.role !== "admin") break;
          const ticket = tickets.get(Number(msg.ticketId));
          if (!ticket) break;
          const cleanText = sanitize(msg.text || "", 1000);
          if (!cleanText) break;
          const message = { id: uuidv4(), from: client.userId, username: client.username, role: "admin", text: cleanText, time: Date.now() };
          ticket.messages.push(message);
          ticket.status = "answered"; ticket.unread = 0;
          // -�-+-�-�-+-�-�-�-�-+ -� -+-�-�-+-�-�-�-�
          broadcastToAdmins({ type: "message", ticketId: ticket.id, message });
          broadcastToAdmins({ type: "ticket_update", ticket: ticketSummary(ticket) });
          broadcastToTicket(ticket.id, client.userId, { type: "message", ticketId: ticket.id, message });
          // -P-�-+-�-�-�-+-�-�-+ -� TG -�-�-+-+ tgChatId -+-+-�-�-�-�-�-+
          if (ticket.tgChatId) {
            try {
              await bot.sendMessage(ticket.tgChatId,
                `=�Ʀ *-�-�-�-�-+-+-+-�-� -�-+-� -+-+-+-�-�-�*\n\n${cleanText}\n\n-�-+-�-+-� -+-+-+-�-�-� -+-�-�-+-+ -�-+-+-+-�-� -+ -+-�-+-�-�-�-+-+ -�-�-�.`,
                { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "G�� -P-�-+-�-�-�-+-�-� -�-�-�", callback_data: `send_receipt_${ticket.id}` }]] } }
              );
            } catch (e) { console.error("[ws send_requisites tg]", e.message); }
          }
          send(ws, { type: "requisites_sent", ticketId: ticket.id });
          break;
        }
        // -�-�-+-+-+ -+-+-�-�-�-�-�-�-�-�-�-� -+-+-+-�-�-� -�-�-�-�-+ -+-�-�-+-�-�-� G�� -�-�-�-�-�-+ -�-�-+-�-+-� + -+-�-�-�-�-�-�-�-+
        case "confirm_payment": {
          if (client.role !== "admin") break;
          const ticket = tickets.get(Number(msg.ticketId));
          if (!ticket) break;
          const amount = parseInt(msg.amount, 10);
          if (!amount || amount <= 0) break;
          const acc = await redisAccounts.get(ticket.userId);
          if (!acc) { send(ws, { type: "error", text: "-�-�-�-�-�-+-� -+-�-�-+-�-� -+-� -+-�-�-�-�-+" }); break; }
          acc.balance = (acc.balance || 0) + amount;
          await redisAccounts.set(ticket.userId, acc);
          const sysMsg = { id: uuidv4(), from: "system", text: `-P-+-+-�-�-� -+-+-�-�-�-�-�-�-�-�-+-�. +${amount} -�-�-� -+-�-�-+-�-+-�-+-+.`, time: Date.now() };
          ticket.messages.push(sysMsg);
          ticket.status = "closed";
          broadcastToAdmins({ type: "message", ticketId: ticket.id, message: sysMsg });
          broadcastToAdmins({ type: "ticket_update", ticket: ticketSummary(ticket) });
          broadcastToTicket(ticket.id, null, { type: "message", ticketId: ticket.id, message: sysMsg });
          broadcastToTicket(ticket.id, null, { type: "ticket_closed", ticketId: ticket.id });
          sendToUser(ticket.userId, { type: "balance_update", balance: acc.balance });
          send(ws, { type: "payment_confirmed", ticketId: ticket.id, newBalance: acc.balance });
          // -�-�-�-�-+-+-+-�-+-+-� -� TG
          if (ticket.tgChatId) {
            try {
              await bot.sendMessage(ticket.tgChatId,
                `G�� *-P-+-+-�-�-� -+-+-�-�-�-�-�-�-�-�-+-�!*\n\n+*${amount} -�-�-�* -+-�-�-+-�-+-�-+-+ -+-� -�-�-� -�-�-�-�-�-+-�.\n-�-�-�-�-�-+-� -�-�-+-�-+-�: *${acc.balance.toLocaleString("ru-RU")} -�-�-�*`,
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
          if (!g || g.ownerId !== client.userId || !g.members.has(targetUserId) || targetUserId === client.userId) break;
          g.members.delete(targetUserId);
          sendToUser(targetUserId, { type: "group_kicked", groupId: gid, groupName: g.name });
          if (g.members.size === 0) { groups.delete(gid); groupMessages.delete(gid); groupInvites.delete(gid); deleteGroupFromRedis(gid); }
          else { saveGroup(g); for (const memberId of g.members) sendToUser(memberId, { type: "group_update", group: publicGroup(g) }); }
          break;
        }
        case "community_sync": {
          send(ws, { type: "friends_list", friends: [...getFriends(client.userId)].map(fid => {
            const fa = [...redisAccounts._map.values()].find(a => a && a.id === fid);
            return fa ? { id: fa.id, username: fa.username } : null;
          }).filter(Boolean) });
          send(ws, { type: "friend_requests", requests: getPendingRequests(client.userId) });
          send(ws, { type: "online_users", users: [...wsClients.values()].filter(c => c.userId && c.username).map(c => ({ id: c.userId, username: c.username, role: c.role })) });
          send(ws, { type: "groups_list", groups: [...groups.values()].filter(g => g.members.has(client.userId)).map(publicGroup) });
          const myInvites = [];
          for (const [gid, list] of groupInvites.entries()) for (const inv of list) if (inv.toId === client.userId) myInvites.push({ ...inv, groupId: gid });
          send(ws, { type: "group_invites_list", invites: myInvites });
          break;
        }
      }
    } catch (err) {
      console.error("[WS Message Error]:", err);
      try {
        send(ws, { type: "error", text: "-�-+-�-�-�-�-+-+-�-� -+-�-+-�-�-� -�-�-�-�-�-�-�" });
      } catch (wsErr) {}
    }
  });

  ws.on("close", () => {
    clearTimeout(authTimeout);
    wsClients.delete(clientId);
    const cnt = wsIPCount.get(ip) || 1;
    if (cnt <= 1) wsIPCount.delete(ip); else wsIPCount.set(ip, cnt - 1);
    broadcastOnlineUsers();
  });
  ws.on("error", () => {
    clearTimeout(authTimeout);
    wsClients.delete(clientId);
    const cnt = wsIPCount.get(ip) || 1;
    if (cnt <= 1) wsIPCount.delete(ip); else wsIPCount.set(ip, cnt - 1);
    broadcastOnlineUsers();
  });
});

// G��G��G�� WebSocket Ping/Pong Keepalive G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��
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

// G��G��G�� News G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��
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
      const title    = ((block.match(/<title><!\[CDATA\[(.*?)\]\]>/) || [])[1] || (block.match(/<title>(.*?)<\/title>/) || [])[1] || "-�-+-�-+-�-�-�").replace(/<[^>]+>/g, "").trim();
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

// G��G��G�� Telegram Bot G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��
const TelegramBot = require("node-telegram-bot-api");
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

const botSessions = new Map(); // chatId -> { state, ... }

// -�-+-�-�-+-�-�-�-�-�
const USER_KB = {
  keyboard: [
    [{ text: "-�-�-+-�-+-+-�" },       { text: "-�-+-+-+-+-+-+-�-� -�-�-+-�-+-�" }],
    [{ text: "-�-+-+ -+-�-�-�-�-�-+-+-�" }, { text: "-�-+-�-+-� -+-�-�-�-�-�-+-+-�"  }],
  ],
  resize_keyboard: true, persistent: true,
};

const ADMIN_KB = {
  keyboard: [
    [{ text: "-�-+-�-�-�-�" },  { text: "-�-�-+-�-+-+-�" }],
    [{ text: "-�-�-+-�-+-� -�-�-�-�-�-+-+-�-�" }],
  ],
  resize_keyboard: true, persistent: true,
};

function getKb(account) {
  return account?.role === "admin" ? ADMIN_KB : USER_KB;
}

const TICKET_STATUS_LABELS = { open: "-+-�-�-�-�-�", in_progress: "-� -�-�-�-+-�-�", answered: "-+-�-�-�-�-+-+-+", closed: "-+-�-�-�-�-�" };

// G��G��G�� Helpers G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��

async function mainMenu(chatId, account) {
  const name  = account?.username || "-+-�-�-+-�";
  const bal   = (account?.balance ?? 0).toLocaleString("ru-RU");
  const isAdm = account?.role === "admin";
  bot.sendMessage(chatId,
    `-�-�-+-�-�-�, *${name}*!\n\n` +
    `-�-�-+-�-+-�: *${bal} -�-�-�*` +
    (isAdm ? "\n\n-�-�-�-+-+ -�-�-+-+-+-+-�-�-�-�-�-+-�-�." : ""),
    { parse_mode: "Markdown", reply_markup: getKb(account) }
  );
}

// -�-+-�-�-+-�-�-� -�-+-+-�-+-� -�-+-�-�-�-+-� (-�-+-� -�-�-+-+-+-�)
async function showAdminTicketList(chatId, filter = "open") {
  const FILTERS = { open: ["open", "in_progress"], answered: ["answered"], all: ["open","in_progress","answered","closed"] };
  const statuses = FILTERS[filter] || FILTERS.open;
  const list = [...tickets.values()]
    .filter(t => statuses.includes(t.status))
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 20);

  const filterBtns = [
    [
      { text: filter === "open"     ? "-+ -�-�-�-+-�-+-�-� -+" : "-�-�-�-+-�-+-�-�",     callback_data: "admin_filter_open"     },
      { text: filter === "answered" ? "-+ -P-�-�-�-�-+-+-+ -+" : "-P-�-�-�-�-+-+-+",     callback_data: "admin_filter_answered" },
      { text: filter === "all"      ? "-+ -�-�-� -+"       : "-�-�-�",          callback_data: "admin_filter_all"      },
    ],
  ];

  if (list.length === 0) {
    return bot.sendMessage(chatId, "-�-�-� -�-+-�-�-�-+-� -� -�-�-+-� -�-�-�-�-�-+-�-+-+.", {
      reply_markup: { inline_keyboard: filterBtns }
    });
  }

  const ticketBtns = list.map(t => [{
    text: `#${t.id} [${TICKET_STATUS_LABELS[t.status] || t.status}] ${t.username} G�� ${t.category.slice(0, 20)}${t.unread ? ` (${t.unread} -+-+-�-�-�)` : ""}`,
    callback_data: `admin_ticket_${t.id}`,
  }]);

  bot.sendMessage(chatId, `*-�-+-�-�-�-�* (${list.length}):`, {
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: [...filterBtns, ...ticketBtns] }
  });
}

// -�-+-�-�-+-�-�-� -�-+-+-�-�-�-�-+-�-� -�-+-�-�-�
async function showAdminTicket(chatId, ticketId) {
  const t = tickets.get(ticketId);
  if (!t) { bot.sendMessage(chatId, "-�-+-�-�-� -+-� -+-�-�-�-�-+."); return; }

  const lastMsgs = t.messages
    .filter(m => m.from !== "system")
    .slice(-5)
    .map(m => `${m.role === "admin" ? "-�-�-+-+-+" : m.username}: ${m.text.slice(0, 80)}`)
    .join("\n");

  const statusBtns = Object.entries(TICKET_STATUS_LABELS).map(([k, v]) => ({
    text: t.status === k ? `-+ ${v} -+` : v,
    callback_data: `admin_setstatus_${ticketId}_${k}`,
  }));

  bot.sendMessage(chatId,
    `*-�-+-�-�-� #${t.id}*\n` +
    `-�-�-�-+-�: ${t.username}\n` +
    `-�-�-�-�-�-+-�-+-�: ${t.category}\n` +
    `-�-�-�-�-�-�: ${TICKET_STATUS_LABELS[t.status] || t.status}\n\n` +
    (lastMsgs ? `-�-+-�-+-�-�-+-+-� -�-+-+-�-�-�-+-+-�:\n${lastMsgs}\n\n` : "") +
    (t.status !== "closed" ? "-P-�-+-�-�-�-� -�-+-+-�-�-�-+-+-� -+-�-�-�-�-+-+ (reply) -+-� -�-�-+ -�-+-+-�-�-�-+-+-�." : "-�-+-�-�-� -+-�-�-�-�-�."),
    {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          statusBtns,
          [{ text: "-�-�-+-�-� -� -�-+-+-�-�-�", callback_data: "admin_filter_open" }],
        ]
      }
    }
  );
}

// G��G��G�� /start G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��

bot.onText(/\/start(.*)/, async (msg, match) => {
  const tgId    = String(msg.from.id);
  const param   = (match[1] || "").trim();
  const account = await redisAccounts.get(tgId);

  if (param.startsWith("auth_")) {
    const code  = param.slice(5).toUpperCase();
    const entry = authCodes.get(code);
    if (!entry) { bot.sendMessage(msg.chat.id, "-�-+-� -+-�-�-�-�-�-�-�-+-�-�-+-�-+ -+-+-+ -+-�-�-�-�. -�-+-+-�-+-�-�-� -�-+-+-�-� -� -+-�-�-+-�-�-�-�.", { reply_markup: getKb(account) }); return; }
    entry.confirmed = true;
    entry.tgUser = { id: msg.from.id, first_name: msg.from.first_name || "", last_name: msg.from.last_name || "", username: msg.from.username || null, auth_date: Math.floor(Date.now() / 1000) };
    const msgText = account
      ? "-�-�-�-+-�-+-+-�-�-+-� -+-+-�-�-�-�-�-�-�-�-+-�! -�-�-�-+-+-�-� -� -+-�-�-+-�-�-�."
      : "-�-�-�-+-�-+-+-�-�-+-� -+-+-�-�-�-�-�-�-�-�-+-�! -�-�-�-+-+-�-� -� -+-�-�-+-�-�-� -+ -+-�-+-�-�-+-�-� -+-+-�.";
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
      category: "-�-+-+-+-+-+-�-+-+-� -�-�-+-�-+-�-�", preview: `${amount} -�-�-� -+ ${methodLabel}`,
      paymentAmount: amount,
      status: "open", unread: 1, invoiceId, createdAt: Date.now(),
      messages: [
        { id: uuidv4(), from: "system", text: `-�-+-�-�-� #${ticketId} -�-+-+-�-�-+ -+-�-+ -+-+-+-+-+-+-�-+-+-+ -�-�-�-�-+ -�-�-�-�.`, time: Date.now() },
        { id: uuidv4(), from: tgId, username, text: `-�-+-+-+-+-+-�-+-+-�: ${amount} -�-�-� -+ ${methodLabel}`, time: Date.now() },
      ],
    };
    tickets.set(ticketId, ticket);
    saveTicket(ticket);
    broadcastToAdmins({ type: "new_ticket", ticket: ticketSummary(ticket) });
    if (inv) inv.ticketId = ticketId;

    bot.sendMessage(msg.chat.id,
      `*-�-�-�-�-�-� -+-� -+-+-+-+-+-+-�-+-+-� G�� -�-+-�-�-� #${ticketId}*\n\n` +
      `-�-�-�-�-�-+-�: \`${username}\`\n` +
      `-�-�-+-+-�: *${amount} -�-�-�* (${amount} G�+)\n` +
      `-�-+-+-�-+-�: ${methodLabel}\n` +
      `-�-�-�-�: ${dateStr}\n\n` +
      `-�-�-+-+-+-+-�-�-�-�-�-+-� -+-�-�-�-�-+-� -+-�-�-�-� -+ -+-�-+-�-+-�-� -�-�-�-�-+-+-+-�-�. -�-+-�-+-� -+-+-+-�-�-� -+-�-�-+-+ -�-+-+-+-�-� -+ -+-�-+-�-�-�-+-+ -�-�-�-+-+-�-+-� -�-�-�-�.`,
      { parse_mode: "Markdown", reply_markup: { inline_keyboard: [
        [{ text: "-P-�-+-�-�-�-+-�-� -�-�-�",        callback_data: `send_receipt_${ticketId}` }],
        [{ text: "-�-�-+-+-�-�-�-� -� -+-+-�-�-�-�-�-�-�", callback_data: "new_ticket_cb"            }],
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
      bot.sendMessage(msg.chat.id, `Telegram -+-�-+-�-�-+-�-+ -� -�-�-�-�-�-+-�-� \`${target.username}\`.`, { parse_mode: "Markdown", reply_markup: getKb(account) });
      return;
    }
  }

  mainMenu(msg.chat.id, account);
});

// G��G��G�� -�-�-�-�-�-+-�-�-� -�-+-+-+-�-+ -+-�-+-�-+-+ G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��

bot.on("text", async (msg) => {
  if (msg.text?.startsWith("/")) return;
  const chatId  = msg.chat.id;
  const tgId    = String(msg.from.id);
  const account = await redisAccounts.get(tgId);
  if (botSessions.get(chatId)) return;

  const isAdm = account?.role === "admin" || isAdminId(tgId);

  // G��G�� -�-�-�-�-� G��G��
  if (isAdm) {
    if (msg.text === "-�-+-�-�-�-�") {
      await showAdminTicketList(chatId, "open");
      return;
    }
    if (msg.text === "-�-�-+-�-+-+-�") {
      bot.sendMessage(chatId,
        `*-�-�-+-�-+-+-�*\n\n-�-+-�: \`${account?.username || "G��"}\`\nID: \`${tgId}\`\n-�-+-+-�: -�-�-+-+-+-+-�-�-�-�-�-+-�\n-�-�-+-�-+-�: ${(account?.balance ?? 0).toLocaleString("ru-RU")} -�-�-�`,
        { parse_mode: "Markdown", reply_markup: ADMIN_KB }
      );
      return;
    }
    if (msg.text === "-�-�-+-�-+-� -�-�-�-�-�-+-+-�-�") {
      botSessions.set(chatId, { state: "admin_awaiting_balance_nick" });
      bot.sendMessage(chatId, "-�-�-�-�-+ -+-+-� -+-+-+ TG ID -�-�-�-�-�-+-+-�-�:");
      return;
    }
    return;
  }

  // G��G�� -�-P-�-�-�-P-�-�-�-�-�-� G��G��
  switch (msg.text) {
    case "-�-�-+-�-+-+-�": {
      if (!account) { bot.sendMessage(chatId, "-�-�-�-�-�-+-� -+-� -+-�-�-�-�-+. -�-+-�-�-+ -� -+-�-�-+-�-�-� -�-�-�-�-+ Telegram.", { reply_markup: USER_KB }); return; }
      const regDate = new Date(account.createdAt).toLocaleDateString("ru-RU");
      bot.sendMessage(chatId,
        `*-�-�-+-�-+-+-�*\n\n-�-+-�: \`${account.username}\`\nID: \`${account.id}\`\n-�-�-+-�-+-�: *${(account.balance ?? 0).toLocaleString("ru-RU")} -�-�-�*\n-�-+-+-�: ${account.role === "admin" ? "-�-�-+-+-+-+-�-�-�-�-�-+-�" : "-+-+-+-�-+-+-�-�-�-�-+-�"}\nTelegram: ${account.telegram ? `@${account.telegram}` : "-+-� -+-�-+-�-�-+-�-+"}\n-�-�-�-� -�-�-�.: ${regDate}`,
        { parse_mode: "Markdown", reply_markup: USER_KB }
      );
      return;
    }
    case "-�-+-+-+-+-+-+-�-� -�-�-+-�-+-�": {
      bot.sendMessage(chatId, "*-�-+-+-+-+-+-�-+-+-� -�-�-+-�-+-�-�*\n\n-�-�-�-�-�-+ -�-�-+-+-�:", {
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: [
          [{ text: "50 G�+",   callback_data: "topup_50"   }, { text: "100 G�+",  callback_data: "topup_100"  }, { text: "200 G�+",  callback_data: "topup_200"  }],
          [{ text: "500 G�+",  callback_data: "topup_500"  }, { text: "1000 G�+", callback_data: "topup_1000" }, { text: "2000 G�+", callback_data: "topup_2000" }],
          [{ text: "-�-�-�-�-�-� -�-�-+-+-�", callback_data: "topup_custom" }],
        ]}
      });
      return;
    }
    case "-�-+-+ -+-�-�-�-�-�-+-+-�": {
      const list = [...tickets.values()].filter(t => t.userId === tgId).sort((a, b) => b.createdAt - a.createdAt).slice(0, 10);
      if (list.length === 0) { bot.sendMessage(chatId, "*-P-�-�-�-�-�-+-+-�*\n\n-� -�-�-�-� -+-+-�-� -+-�-� -+-�-�-�-�-�-+-+-�.", { parse_mode: "Markdown", reply_markup: USER_KB }); return; }
      const STATUS = { open: "-+-�-�-�-�-�", in_progress: "-� -�-�-�-+-�-�", answered: "-+-�-�-�-�-+-+-+", closed: "-+-�-�-�-�-�" };
      const lines = list.map(t => `*#${t.id}*  [${STATUS[t.status] || t.status}]  ${t.category}\n${t.preview?.slice(0, 55)}`).join("\n\n");
      bot.sendMessage(chatId, `*-P-�-�-�-�-�-+-+-�*\n\n${lines}`, { parse_mode: "Markdown", reply_markup: USER_KB });
      return;
    }
    case "-�-+-�-+-� -+-�-�-�-�-�-+-+-�": {
      botSessions.set(chatId, { state: "awaiting_ticket_desc", category: null });
      bot.sendMessage(chatId, "-�-�-�-�-�-+ -�-�-�-�-�-+-�-+-� -+-�-�-�-�-�-+-+-�:", {
        reply_markup: { inline_keyboard: [
          [{ text: "-�-�-�-+-+-�-�-�-�-+-� -+-�-+-�-+-�-+-�", callback_data: "tcat_tech"    }],
          [{ text: "-�-+-+-�-+-� -+-+ -�-�-�-�-�-+-�-�",   callback_data: "tcat_account" }],
          [{ text: "-�-+-+-�-+-� -+-+ -+-+-�-�-+-�-�",     callback_data: "tcat_pay"     }],
          [{ text: "-�-�-� -+-+-+ -+-�-+-�-�-�",        callback_data: "tcat_bug"     }],
          [{ text: "-�-�-+-+-�-� -+-� -+-�-�-+-�-�",      callback_data: "tcat_report"  }],
          [{ text: "-�-�-�-�-+-�",                callback_data: "tcat_other"   }],
        ]}
      });
      return;
    }
  }
});

// G��G��G�� Callback -�-+-+-+-�-+ G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��

bot.on("callback_query", async (q) => {
  const tgId    = String(q.from.id);
  const chatId  = q.message.chat.id;
  const account = await redisAccounts.get(tgId);
  const isAdm   = account?.role === "admin" || isAdminId(tgId);
  bot.answerCallbackQuery(q.id);

  // G��G�� -�-�-�-�-�: -�-+-+-�-�-� -�-+-�-�-�-+-� G��G��
  if (q.data.startsWith("admin_filter_")) {
    if (!isAdm) return;
    const filter = q.data.replace("admin_filter_", "");
    await showAdminTicketList(chatId, filter);
    return;
  }

  // G��G�� -�-�-�-�-�: -+-�-�-�-�-�-� -�-+-�-�-� G��G��
  if (q.data.startsWith("admin_ticket_")) {
    if (!isAdm) return;
    const ticketId = parseInt(q.data.replace("admin_ticket_", ""), 10);
    botSessions.set(chatId, { state: "admin_viewing_ticket", ticketId });
    await showAdminTicket(chatId, ticketId);
    return;
  }

  // G��G�� -�-�-�-�-�: -�-+-�-+-+-�-� -�-�-�-�-�-� G��G��
  if (q.data.startsWith("admin_setstatus_")) {
    if (!isAdm) return;
    const [, , ticketIdStr, status] = q.data.split("_");
    const ticketId = parseInt(ticketIdStr, 10);
    const t = tickets.get(ticketId);
    if (t) {
      t.status = status;
      t.messages.push({ id: uuidv4(), from: "system", text: `-�-�-�-�-�-� -+-+-+-�-+-�-+: ${TICKET_STATUS_LABELS[status] || status}`, time: Date.now() });
      broadcastToAdmins({ type: "ticket_update", ticket: ticketSummary(t) });
      broadcastToTicket(ticketId, null, { type: "ticket_update", ticket: ticketSummary(t) });
      // -�-�-�-�-+-+-+-�-� -+-+-+-�-+-+-�-�-�-�-+-�
      if (status === "answered") {
        try { await bot.sendMessage(t.userId, `-�-+ -�-�-+-�-+-� -�-+-�-�-�-� \`#${ticketId}\` -+-�-+-�-�-+ -+-�-�-�-�. -�-�-+-�-�-�-� -+-� -�-�-�-�-� -+-+-+ -+-�-�-+-+ "-�-+-+ -+-�-�-�-�-�-+-+-�".`, { parse_mode: "Markdown", reply_markup: USER_KB }); } catch {}
      }
      bot.answerCallbackQuery(q.id, { text: `-�-�-�-�-�-�: ${TICKET_STATUS_LABELS[status]}`, show_alert: false });
      await showAdminTicket(chatId, ticketId);
    }
    return;
  }

  // G��G�� -�-+-+-+-+-+-�-+-+-� G��G��
  if (q.data.startsWith("topup_")) {
    const sub = q.data.split("_")[1];
    if (sub === "custom") {
      botSessions.set(chatId, { state: "awaiting_topup_amount" });
      bot.sendMessage(chatId, "-�-�-�-�-+ -�-�-+-+-� -+-+-+-+-+-+-�-+-+-� -� -�-�-�-+-�-�:", { reply_markup: { force_reply: true, input_field_placeholder: "-�-�-+-�-+-+-�-�: 350" } });
      return;
    }
    const amount = parseInt(sub, 10);
    if (!account) { bot.sendMessage(chatId, "-�-+-�-�-+ -� -+-�-�-+-�-�-� -�-�-�-�-+ Telegram.", { reply_markup: USER_KB }); return; }
    const ticketId = ++ticketCounter;
    const dateStr  = new Date().toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
    const t = { id: ticketId, userId: tgId, tgChatId: String(chatId), username: account.username, category: "-�-+-+-+-+-+-�-+-+-� -�-�-+-�-+-�-�", preview: `${amount} -�-�-� -+ -�-�-�-�-+ -�-+-�-�`, paymentAmount: amount, status: "open", unread: 1, createdAt: Date.now(), messages: [
      { id: uuidv4(), from: "system", text: `-�-+-�-�-� #${ticketId} -�-+-+-�-�-+ -�-�-�-�-+ -�-+-�-�.`, time: Date.now() },
      { id: uuidv4(), from: tgId, username: account.username, text: `-�-+-+-+-+-+-�-+-+-� -+-� ${amount} -�-�-�`, time: Date.now() },
    ]};
    tickets.set(ticketId, t);
    saveTicket(t);
    broadcastToAdmins({ type: "new_ticket", ticket: ticketSummary(t) });
    bot.sendMessage(chatId,
      `*-�-�-�-�-�-� -+-� -+-+-+-+-+-+-�-+-+-� G�� -�-+-�-�-� #${ticketId}*\n\n-�-�-�-�-�-+-�: \`${account.username}\`\n-�-�-+-+-�: *${amount} -�-�-�* (${amount} G�+)\n-�-�-�-�: ${dateStr}\n\n-�-�-+-+-+-+-�-�-�-�-�-+-� -+-�-�-�-�-+-� -+ -+-�-+-�-+-�-� -�-�-�-�-+-+-+-�-�. -�-+-�-+-� -+-+-+-�-�-� -+-�-�-+-+ -�-+-+-+-�-� -+ -+-�-+-�-�-�-+-+ -�-�-�-+-+-�-+-� -�-�-�-�.`,
      { parse_mode: "Markdown", reply_markup: { inline_keyboard: [
        [{ text: "-P-�-+-�-�-�-+-�-� -�-�-�",        callback_data: `send_receipt_${ticketId}` }],
        [{ text: "-�-�-+-+-�-�-�-� -� -+-+-�-�-�-�-�-�-�", callback_data: "new_ticket_cb"            }],
      ]}}
    );
    return;
  }

  // G��G�� -�-+-�-+-� -+-�-�-�-�-�-+-+-� inline G��G��
  if (q.data === "new_ticket_cb") {
    botSessions.set(chatId, { state: "awaiting_ticket_desc", category: null });
    bot.sendMessage(chatId, "-�-�-�-�-�-+ -�-�-�-�-�-+-�-+-� -+-�-�-�-�-�-+-+-�:", {
      reply_markup: { inline_keyboard: [
        [{ text: "-�-�-�-+-+-�-�-�-�-+-� -+-�-+-�-+-�-+-�", callback_data: "tcat_tech"    }],
        [{ text: "-�-+-+-�-+-� -+-+ -�-�-�-�-�-+-�-�",   callback_data: "tcat_account" }],
        [{ text: "-�-+-+-�-+-� -+-+ -+-+-�-�-+-�-�",     callback_data: "tcat_pay"     }],
        [{ text: "-�-�-� -+-+-+ -+-�-+-�-�-�",        callback_data: "tcat_bug"     }],
        [{ text: "-�-�-+-+-�-� -+-� -+-�-�-+-�-�",      callback_data: "tcat_report"  }],
        [{ text: "-�-�-�-�-+-�",                callback_data: "tcat_other"   }],
      ]}
    });
    return;
  }

  // G��G�� -�-�-�-�-�-+-�-+-� -�-+-�-�-�-� G��G��
  const CAT_MAP = { tcat_tech: "-�-�-�-+-+-�-�-�-�-+-� -+-�-+-�-+-�-+-�", tcat_account: "-�-+-+-�-+-� -+-+ -�-�-�-�-�-+-�-�", tcat_pay: "-�-+-+-�-+-� -+-+ -+-+-�-�-+-�-�", tcat_bug: "-�-�-� -+-+-+ -+-�-+-�-�-�", tcat_report: "-�-�-+-+-�-� -+-� -+-�-�-+-�-�", tcat_other: "-�-�-�-�-+-�" };
  if (q.data in CAT_MAP) {
    const category = CAT_MAP[q.data];
    botSessions.set(chatId, { state: "awaiting_ticket_desc", category });
    bot.sendMessage(chatId, `-�-�-�-�-�-+-�-+-�: *${category}*\n\n-P-+-+-�-+ -+-�-+-�-+-�-+-� -+-+-�-�-+-�-+-+:`, { parse_mode: "Markdown" });
    return;
  }

  // G��G�� -P-�-+-�-�-�-+-�-� -�-�-� G��G��
  if (q.data.startsWith("send_receipt_")) {
    const ticketId = parseInt(q.data.split("_")[2], 10);
    botSessions.set(chatId, { state: "awaiting_receipt", ticketId });
    bot.sendMessage(chatId, `-�-+-�-�-� \`#${ticketId}\` G�� -+-�-+-�-�-�-+-+ -�-�-�-+-+-�-+-� -+-+-+ -�-+-�-+ -�-�-�-� -�-+-�-�-�-�-�-+-+ -�-+-+-�-�-�-+-+-�-+.`,
      { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "-P-�-+-�-+-�", callback_data: "cancel_input" }]] } }
    );
    return;
  }

  // G��G�� -�-+-�-�-�-�-�-�-+-�-�/-+-�-�-+-+-+-+-�-� -+-+-+-�-�-� G��G��
  if (q.data.startsWith("confirm_pay_")) {
    if (!isAdm) { bot.answerCallbackQuery(q.id, { text: "-�-�-� -+-�-�-�.", show_alert: true }); return; }
    const parts    = q.data.split("_");
    const ticketId = parseInt(parts[2], 10);
    const userId   = parts[3];
    const amount   = parseInt(parts[4], 10);
    const acc      = await redisAccounts.get(userId);
    const ticket   = tickets.get(ticketId);
    if (acc && amount > 0) {
      acc.balance = (acc.balance || 0) + amount;
      await redisAccounts.set(userId, acc);
      if (ticket) { ticket.status = "closed"; ticket.messages.push({ id: uuidv4(), from: "system", text: `-P-+-+-�-�-� -+-+-�-�-�-�-�-�-�-�-+-�. -�-�-�-+-�-+-�-+-+ ${amount} -�-�-�.`, time: Date.now() }); broadcastToAdmins({ type: "ticket_update", ticket: ticketSummary(ticket) }); }
      try { await bot.sendMessage(userId, `-P-+-+-�-�-� -+-+-�-�-�-�-�-�-�-�-+-�.\n+*${amount} -�-�-�* -+-�-�-+-�-+-�-+-+. -�-�-+-�-+-�: *${acc.balance.toLocaleString("ru-RU")} -�-�-�*`, { parse_mode: "Markdown", reply_markup: USER_KB }); } catch {}
      sendToUser(userId, { type: "balance_update", balance: acc.balance });
      bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: q.message.message_id }).catch(() => {});
      bot.answerCallbackQuery(q.id, { text: `+${amount} -�-�-� -+-�-�-+-�-+-�-+-+`, show_alert: true });
    } else { bot.answerCallbackQuery(q.id, { text: "-�-�-�-�-�-+-� -+-� -+-�-�-�-�-+.", show_alert: true }); }
    return;
  }

  if (q.data.startsWith("reject_pay_")) {
    if (!isAdm) { bot.answerCallbackQuery(q.id, { text: "-�-�-� -+-�-�-�.", show_alert: true }); return; }
    const parts    = q.data.split("_");
    const ticketId = parseInt(parts[2], 10);
    const userId   = parts[3];
    const ticket   = tickets.get(ticketId);
    if (ticket) { ticket.status = "open"; ticket.messages.push({ id: uuidv4(), from: "system", text: "-P-+-+-�-�-� -+-�-�-+-+-+-�-+-�.", time: Date.now() }); broadcastToAdmins({ type: "ticket_update", ticket: ticketSummary(ticket) }); }
    try { await bot.sendMessage(userId, `-P-+-+-�-�-� -+-+ -�-+-�-�-�-� \`#${ticketId}\` -+-� -+-+-�-�-�-�-�-�-�-�-+-�. -�-�-+-+-�-+-�-� -� -+-+-�-�-�-�-�-�-�.`, { parse_mode: "Markdown", reply_markup: USER_KB }); } catch {}
    bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: q.message.message_id }).catch(() => {});
    bot.answerCallbackQuery(q.id, { text: "-P-+-+-�-�-� -+-�-�-+-+-+-�-+-�.", show_alert: true });
    return;
  }

  if (q.data === "cancel_input") {
    botSessions.delete(chatId);
    mainMenu(chatId, account);
    return;
  }
});

// G��G��G�� -�-+-+-�-�-�-+-+-� (-�-+-�-�-+-�-+-+-�) G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��

bot.on("message", async (msg) => {
  if (msg.text?.startsWith("/")) return;
  const chatId  = msg.chat.id;
  const tgId    = String(msg.from.id);
  const account = await redisAccounts.get(tgId);
  const session = botSessions.get(chatId);
  const isAdm   = account?.role === "admin" || isAdminId(tgId);

  // G��G�� -�-�-�-�-�: reply -+-� -�-+-�-�-� G��G��
  if (!session && isAdm && msg.reply_to_message) {
    const replyText = msg.reply_to_message.caption || msg.reply_to_message.text || "";
    const match     = replyText.match(/-�-+-�-�-�[:\s#]+(\d+)/i);
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
        try { await bot.sendMessage(ticket.userId, `-P-�-�-�-� -+-+ -�-+-�-�-�-� \`#${ticketId}\`:\n\n${text}`, { parse_mode: "Markdown", reply_markup: USER_KB }); } catch {}
        bot.sendMessage(chatId, `-P-�-�-�-� -+-�-+-�-�-�-+-�-+ -� -�-+-�-�-� \`#${ticketId}\`.`, { parse_mode: "Markdown" });
        return;
      }
    }
  }

  // G��G�� -�-�-�-�-�: -+-�-+-�-+-+-�-� -�-+-�-�-�-� G�� -�-�-�-�-� = -+-�-�-�-� -� -�-+-�-�-� G��G��
  if (!session && isAdm) return;

  // G��G�� -�-+-�-�-+-�-�-�-�-+-�-� -�-+-+-+-�-+ (-�-�-+ -�-�-�-�-+-+) G��G��
  if (!session && msg.text) {
    const text = msg.text.trim();

    // -�-+-+-�-+-+-�-�-�-�-+-�-�-�-+-� -�-+-+-+-�-+
    if (text === "-�-�-+-�-+-+-�") {
      if (!account) return bot.sendMessage(chatId, "-�-�-�-�-�-+-� -+-� -+-�-�-�-�-+. -�-+-�-�-+ -� -+-�-�-+-�-�-� -�-�-�-�-+ Telegram.", { reply_markup: USER_KB });
      const isAdm2 = account.role === "admin";
      return bot.sendMessage(chatId,
        `*${account.username}*\n\nID: \`${account.id}\`\n-�-�-+-�-+-�: *${(account.balance ?? 0).toLocaleString("ru-RU")} -�-�-�*\n-�-+-+-�: ${isAdm2 ? "-�-�-+-+-+-+-�-�-�-�-�-+-�" : "-+-�-�-+-�"}\nTelegram: ${account.telegram ? `@${account.telegram}` : "G��"}`,
        { parse_mode: "Markdown", reply_markup: getKb(account) }
      );
    }

    if (text === "-�-+-+-+-+-+-+-�-� -�-�-+-�-+-�") {
      return bot.sendMessage(chatId, "=�Ʀ *-�-+-+-+-+-+-�-+-+-� -�-�-+-�-+-�-�*\n\n-�-�-�-�-�-+ -�-�-+-+-�:", {
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: [
          [{ text: "50 -�-�-�",  callback_data: "topup_50"  }, { text: "100 -�-�-�", callback_data: "topup_100" }],
          [{ text: "250 -�-�-�", callback_data: "topup_250" }, { text: "500 -�-�-�", callback_data: "topup_500" }],
          [{ text: "1000 -�-�-�", callback_data: "topup_1000" }],
          [{ text: "-�-�-�-�-�-� -�-�-+-+-�", callback_data: "topup_custom" }],
        ]}
      });
    }

    if (text === "-�-+-+ -+-�-�-�-�-�-+-+-�") {
      const userTickets = [...tickets.values()]
        .filter(t => t.userId === tgId || (account && t.userId === account.id))
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 10);
      if (userTickets.length === 0) {
        return bot.sendMessage(chatId, "=�Ľ -�-�-� -+-�-�-�-�-�-+-+-�.", { reply_markup: USER_KB });
      }
      const lines = userTickets.map(t => {
        const emoji = { open: "=���", answered: "=���", closed: "Gܽ", in_progress: "=���" }[t.status] || "Gܬ";
        return `${emoji} *#${t.id}* G�� ${t.category}\nG�� _${t.preview?.slice(0, 50)}_`;
      }).join("\n\n");
      return bot.sendMessage(chatId, `=�Ľ *-�-�-+-+ -+-�-�-�-�-�-+-+-�:*\n\n${lines}`, { parse_mode: "Markdown", reply_markup: USER_KB });
    }

    if (text === "-�-+-�-+-� -+-�-�-�-�-�-+-+-�") {
      return bot.sendMessage(chatId, "-�-�-�-�-�-+ -�-�-�-�-�-+-�-+-� -+-�-�-�-�-�-+-+-�:", {
        reply_markup: { inline_keyboard: [
          [{ text: "=��� -�-�-�. -+-�-+-�-+-�-+-�",  callback_data: "tcat_tech"    }],
          [{ text: "=��� -�-�-�-�-�-+-�",         callback_data: "tcat_account" }],
          [{ text: "=�Ʀ -�-+-�-�-+-�-�",         callback_data: "tcat_pay"     }],
          [{ text: "=�ɢ -�-�-� / -+-�-+-�-�-�",    callback_data: "tcat_bug"     }],
          [{ text: "G��n+� -�-�-+-+-�-�",          callback_data: "tcat_report"  }],
          [{ text: "G�� -�-�-�-�-+-�",           callback_data: "tcat_other"   }],
        ]}
      });
    }

    // -�-�-+-+-+-�-�-+-� -�-+-+-+-�-+
    if (isAdm && text === "-�-+-�-�-�-�") {
      return showAdminTicketList(chatId, "open");
    }

    if (isAdm && text === "-�-�-+-�-+-� -�-�-�-�-�-+-+-�-�") {
      botSessions.set(chatId, { state: "admin_awaiting_balance_nick" });
      return bot.sendMessage(chatId, "-�-�-�-�-+ -+-+-� -+-+-+ TG ID -�-�-�-�-�-+-+-�-�:");
    }
  }

  if (!session) return;

  // -�-�-+-� -�-�-�-�-+-+-+-+-� -�-�-+-+-�
  if (session.state === "awaiting_topup_amount") {
    const amount = parseInt(msg.text?.trim(), 10);
    botSessions.delete(chatId);
    if (!amount || amount < 50 || amount > 100000) { bot.sendMessage(chatId, "-�-�-+-+-� -�-+-+-�-+-� -�-�-�-� -+-� 50 -�-+ 100 000 -�-�-�-+-�-�.", { reply_markup: USER_KB }); return; }
    if (!account) { bot.sendMessage(chatId, "-�-+-�-�-+ -� -+-�-�-+-�-�-� -�-�-�-�-+ Telegram.", { reply_markup: USER_KB }); return; }
    const ticketId = ++ticketCounter;
    const dateStr  = new Date().toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
    const t = { id: ticketId, userId: tgId, tgChatId: String(chatId), username: account.username, category: "-�-+-+-+-+-+-�-+-+-� -�-�-+-�-+-�-�", preview: `${amount} -�-�-� -+ -�-�-�-�-+ -�-+-�-�`, paymentAmount: amount, status: "open", unread: 1, createdAt: Date.now(), messages: [
      { id: uuidv4(), from: "system", text: `-�-+-�-�-� #${ticketId} -�-+-+-�-�-+ -�-�-�-�-+ -�-+-�-�.`, time: Date.now() },
      { id: uuidv4(), from: tgId, username: account.username, text: `-�-+-+-+-+-+-�-+-+-� -+-� ${amount} -�-�-�`, time: Date.now() },
    ]};
    tickets.set(ticketId, t);
    saveTicket(t);
    broadcastToAdmins({ type: "new_ticket", ticket: ticketSummary(t) });
    bot.sendMessage(chatId,
      `*-�-�-�-�-�-� -+-� -+-+-+-+-+-+-�-+-+-� G�� -�-+-�-�-� #${ticketId}*\n\n-�-�-�-�-�-+-�: \`${account.username}\`\n-�-�-+-+-�: *${amount} -�-�-�* (${amount} G�+)\n-�-�-�-�: ${dateStr}\n\n-�-�-+-+-+-+-�-�-�-�-�-+-� -+-�-�-�-�-+-� -+ -+-�-+-�-+-�-� -�-�-�-�-+-+-+-�-�. -�-+-�-+-� -+-+-+-�-�-� -+-�-�-+-+ -�-+-+-+-�-� -+ -+-�-+-�-�-�-+-+ -�-�-�-+-+-�-+-� -�-�-�-�.`,
      { parse_mode: "Markdown", reply_markup: { inline_keyboard: [
        [{ text: "-P-�-+-�-�-�-+-�-� -�-�-�",        callback_data: `send_receipt_${ticketId}` }],
        [{ text: "-�-�-+-+-�-�-�-� -� -+-+-�-�-�-�-�-�-�", callback_data: "new_ticket_cb"            }],
      ]}}
    );
    return;
  }

  // G��G�� -�-�-�-�-�: -+-+-+-�-� -�-�-+-�-+-�-� -�-�-�-�-�-+-+-�-� G��G��
  if (session.state === "admin_awaiting_balance_nick") {
    botSessions.delete(chatId);
    const q = msg.text?.trim();
    const found = [...redisAccounts._map.values()].find(a =>
      a.username?.toLowerCase() === q.toLowerCase() ||
      a.telegram?.toLowerCase() === q.replace("@","").toLowerCase() ||
      a.id === q
    );
    if (!found) { bot.sendMessage(chatId, "-�-+-+-�-+-+-�-�-�-�-+-� -+-� -+-�-�-�-�-+.", { reply_markup: ADMIN_KB }); return; }
    bot.sendMessage(chatId,
      `*${found.username}*\nID: \`${found.id}\`\nTelegram: ${found.telegram ? `@${found.telegram}` : "G��"}\n-�-�-+-�-+-�: *${(found.balance ?? 0).toLocaleString("ru-RU")} -�-�-�*\n-�-+-+-�: ${found.role}`,
      { parse_mode: "Markdown", reply_markup: { inline_keyboard: [
        [{ text: "-�-+-�-�-�-+-�-� 100 -�-�-�",  callback_data: `bal_add_${found.id}_100`  },
         { text: "-�-+-�-�-�-+-�-� 500 -�-�-�",  callback_data: `bal_add_${found.id}_500`  }],
        [{ text: "-P-�-+-�-+-+-�-� -�-�-+-�-+-�",   callback_data: `bal_zero_${found.id}`     }],
      ]}
    });
    return;
  }

  // -�-+-+-�-�-�-+-+-� -�-�-�-�
  if (session.state === "awaiting_receipt") {
    const ticketId = session.ticketId;
    const ticket   = tickets.get(ticketId);
    const hasPhoto = msg.photo?.length > 0;
    const hasDoc   = !!msg.document;
    if (!hasPhoto && !hasDoc) { bot.sendMessage(chatId, "-�-�-+-�-+-+ -�-+-�-+ -+-+-+ -�-�-�-+-+-�-+-� (-�-�-�-+)."); return; }
    botSessions.delete(chatId);
    if (ticket) {
      const fileId = hasPhoto ? msg.photo[msg.photo.length - 1].file_id : msg.document.file_id;
      ticket.messages.push({ id: uuidv4(), from: tgId, username: account?.username || "Telegram", text: `[-�-�-�, file_id: ${fileId}]`, time: Date.now() });
      ticket.unread = (ticket.unread || 0) + 1; ticket.status = "open";
      broadcastToAdmins({ type: "ticket_update", ticket: ticketSummary(ticket) });
    }
    for (const [tid, acc] of redisAccounts._map.entries()) {
      if (acc.role !== "admin") continue;
      try {
        const inv       = ticket ? [...invoices.values()].find(i => i.ticketId === ticketId) : null;
        const invAmount = inv?.amount || "?";
        const invMethod = inv ? (METHOD_NAMES[inv.method] || inv.method) : "?";
        const caption   = `-�-�-� -+-� -+-+-+-+-+-+-�-+-+-�\n\n-�-�-�-+-�: ${account?.username || tgId}\n-�-�-+-+-�: ${invAmount} -�-�-�\n-�-+-+-�-+-�: ${invMethod}\n-�-+-�-�-�: #${ticketId}`;
        const rm        = { inline_keyboard: [[
          { text: "-�-+-�-�-�-�-�-�-+-�-�", callback_data: `confirm_pay_${ticketId}_${tgId}_${invAmount}` },
          { text: "-P-�-�-+-+-+-+-�-�",   callback_data: `reject_pay_${ticketId}_${tgId}`               },
        ]]};
        if (hasPhoto) await bot.sendPhoto(tid, msg.photo[msg.photo.length - 1].file_id, { caption, reply_markup: rm });
        else          await bot.sendDocument(tid, msg.document.file_id, { caption, reply_markup: rm });
      } catch (e) { console.error("[admin notify]", e.message); }
    }
    bot.sendMessage(chatId, `-�-�-� -+-+-+-�-�-�-+. -�-+-�-�-� \`#${ticketId}\` -+-�-+-+-�-+-�-+ G�� -�-�-+-+-+-+-�-�-�-�-�-+-� -+-�-+-�-�-�-+-� -+-+-+-�-�-� -+ -+-�-�-+-�-+-+-� -�-�-+-�-+-�.`, { parse_mode: "Markdown", reply_markup: USER_KB });
    return;
  }

  // -P-+-+-�-�-+-+-� -�-+-�-�-�-�
  if (session.state === "awaiting_ticket_desc") {
    const text = msg.text?.trim();
    if (!text || text.length < 5) { bot.sendMessage(chatId, "-�-+-+-�-�-+-+ -�-+-�-+-�-�-+-� -+-+-+-�-�-+-+-�. -�-�-+-+-�-+ -+-+-�-�-+-�-+-�-�."); return; }
    const ticketId = ++ticketCounter;
    const ticket = { id: ticketId, userId: tgId, username: account?.username || msg.from.username || "Telegram", category: session.category || "-�-�-�-�-+-�", preview: text.slice(0, 60), status: "open", unread: 1, createdAt: Date.now(), messages: [
      { id: uuidv4(), from: "system", text: `-�-+-�-�-� #${ticketId} -�-+-+-�-�-+.`, time: Date.now() },
      { id: uuidv4(), from: tgId, username: account?.username || "Telegram", text, time: Date.now() },
    ]};
    tickets.set(ticketId, ticket);
    saveTicket(ticket);
    botSessions.delete(chatId);
    broadcastToAdmins({ type: "new_ticket", ticket: ticketSummary(ticket) });
    bot.sendMessage(chatId,
      `-P-�-�-�-�-�-+-+-� -�-+-+-�-�-+-+.\n\n-�-+-�-�-� \`#${ticketId}\` G�� ${ticket.category}.\n-P-�-�-�-�-+-+ -�-�-� -+-+-�-+-+ -�-�-+-�-�-�.`,
      { parse_mode: "Markdown", reply_markup: USER_KB }
    );
  }
});

// G��G�� -�-�-+-�-+-� -�-�-�-�-�-+-+-�-� (inline, -�-+-� admin) G��G��
bot.on("callback_query", async (q) => {});
// -�-+-+-+-+-+-+-�-�-+-�-+-�-� listener -�-+-� bal_ -�-+-+-+-�-�-�-+-� G�� -�-�-� -+-�-�-�-�-+-�-�-+ -�-�-�-�, -�-+-�-�-�-+-+ inline
// -�-�-�-+-+ -+-�-�-�-�-�-�-�-+-�-� bal_ -� -+-�-+-+-�-+-+-+ callback handler G�� -�-+-�-�-�-+-+ -+-�-�-�-� cancel_input

// -�-�-�-�: -�-�-�-�-�-+ -�-�-� -+-�-+-+ listener -�-+-� bal_
const origListeners = bot.listeners("callback_query").slice();
bot.removeAllListeners("callback_query");
bot.on("callback_query", async (q) => {
  const tgId  = String(q.from.id);
  const chatId = q.message.chat.id;
  const isAdm  = isAdminId(tgId) || (await redisAccounts.get(tgId))?.role === "admin";

  if (q.data.startsWith("bal_")) {
    if (!isAdm) { bot.answerCallbackQuery(q.id, { text: "-�-�-� -+-�-�-�.", show_alert: true }); return; }
    const parts  = q.data.split("_");
    const action = parts[1]; // add | zero
    const userId = parts[2];
    const amount = parseInt(parts[3] || "0", 10);
    const acc    = await redisAccounts.get(userId);
    if (!acc) { bot.answerCallbackQuery(q.id, { text: "-�-+-+-�-+-+-�-�-�-�-+-� -+-� -+-�-�-�-�-+.", show_alert: true }); return; }
    if (action === "add") acc.balance = (acc.balance || 0) + amount;
    if (action === "zero") acc.balance = 0;
    await redisAccounts.set(userId, acc);
    sendToUser(userId, { type: "balance_update", balance: acc.balance });
    bot.answerCallbackQuery(q.id, { text: `-�-�-+-�-+-�: ${acc.balance} -�-�-�`, show_alert: true });
    bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: q.message.message_id }).catch(() => {});
    return;
  }

  // -�-�-�-�-�-�-�-+ -+-�-�-�-+-�-+-�-+ listeners
  for (const fn of origListeners) fn(q);
});

bot.on("polling_error", (err) => { if (!err.message?.includes("409")) console.error("[bot]", err.message); });


// G��G��G�� Start G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��G��
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
