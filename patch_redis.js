#!/usr/bin/env node
// Patch: Replace all in-memory Map stores with Redis-backed persistent stores
const fs = require("fs");
const path = "/opt/sbgames-auth/server_index.js";
let code = fs.readFileSync(path, "utf8");

// ── 1. Inject RedisMap class after the loadJwtSecret function ──
const REDIS_MAP_CLASS = `
// ─── RedisMap: persistent Map backed by Redis ──────────────────────────────────
class RedisMap {
  constructor(prefix, opts = {}) {
    this.prefix = prefix;
    this.cache = new Map();
    this._fromJSON = opts.fromJSON || (v => v);
    this._toJSON   = opts.toJSON   || (v => v);
  }
  get(key)            { return this.cache.get(key); }
  set(key, value)     { this.cache.set(key, value); redis.set(this.prefix + ":" + key, JSON.stringify(this._toJSON(value))).catch(() => {}); }
  delete(key)         { this.cache.delete(key); redis.del(this.prefix + ":" + key).catch(() => {}); }
  has(key)            { return this.cache.has(key); }
  values()            { return this.cache.values(); }
  entries()           { return this.cache.entries(); }
  async loadAll()     {
    try {
      const keys = await redis.keys(this.prefix + ":*");
      for (const rk of keys) {
        const k = rk.slice(this.prefix.length + 1);
        const raw = await redis.get(rk);
        if (raw) this.cache.set(k, this._fromJSON(JSON.parse(raw)));
      }
      console.log("[redis-map] loaded " + this.cache.size + " keys from " + this.prefix);
    } catch (e) { console.error("[redis-map] loadAll failed for " + this.prefix, e.message); }
  }
}
`;

// Find the spot after loadJwtSecret (after the closing brace of that function)
const jwtMarker = 'loadJwtSecret();';
if (code.includes(jwtMarker)) {
  code = code.replace(jwtMarker, jwtMarker + '\n' + REDIS_MAP_CLASS);
  console.log("[patch] ✓ RedisMap class injected after loadJwtSecret()");
} else {
  console.error("[patch] ✗ Could not find loadJwtSecret() call");
  process.exit(1);
}

// ── 2. Replace in-memory Map declarations ──

// 2a. friendships, friendRequests, dms (line ~257-259)
const storesOld = `const friendships    = new Map();
const friendRequests = new Map();
const dms            = new Map();`;
const storesNew = `const friendships    = new RedisMap("sbgames:friends",   { fromJSON: v => new Set(v), toJSON: v => [...v] });
const friendRequests = new RedisMap("sbgames:freq",    { fromJSON: v => Array.isArray(v) ? v : [], toJSON: v => v });
const dms            = new RedisMap("sbgames:dms",     { fromJSON: v => Array.isArray(v) ? v : [], toJSON: v => v });`;
if (code.includes(storesOld)) {
  code = code.replace(storesOld, storesNew);
  console.log("[patch] ✓ friendships/friendRequests/dms → RedisMap");
} else {
  console.error("[patch] ✗ Could not find friendships/friendRequests/dms block");
}

// 2b. profileComments (line ~635)
const pcOld = `const profileComments = new Map();`;
const pcNew = `const profileComments = new RedisMap("sbgames:comments", { fromJSON: v => Array.isArray(v) ? v : [], toJSON: v => v });`;
if (code.includes(pcOld)) {
  code = code.replace(pcOld, pcNew);
  console.log("[patch] ✓ profileComments → RedisMap");
} else {
  console.error("[patch] ✗ Could not find profileComments");
}

// 2c. activityStore (line ~739)
const asOld = `const activityStore = new Map();`;
const asNew = `const activityStore = new RedisMap("sbgames:activity", { fromJSON: v => Array.isArray(v) ? v : [], toJSON: v => v });`;
if (code.includes(asOld)) {
  code = code.replace(asOld, asNew);
  console.log("[patch] ✓ activityStore → RedisMap");
} else {
  console.error("[patch] ✗ Could not find activityStore");
}

// 2d. groups, groupMessages, groupInvites (line ~857)
// groups stores Set for members, so we need custom transform
const grOld = `const groups = new Map(), groupMessages = new Map(), groupInvites = new Map();`;
const grNew = `const groups = new RedisMap("sbgames:groups", {
  fromJSON: v => ({ ...v, members: new Set(v.members || []) }),
  toJSON:   v => ({ ...v, members: [...(v.members || [])] })
});
const groupMessages = new RedisMap("sbgames:grpmsg", { fromJSON: v => Array.isArray(v) ? v : [], toJSON: v => v });
const groupInvites  = new RedisMap("sbgames:grpinv", { fromJSON: v => Array.isArray(v) ? v : [], toJSON: v => v });`;
if (code.includes(grOld)) {
  code = code.replace(grOld, grNew);
  console.log("[patch] ✓ groups/groupMessages/groupInvites → RedisMap");
} else {
  console.error("[patch] ✗ Could not find groups block");
}

// ── 3. Add loadAllStores and wrap Start section ──
const loadAllFn = `
// ─── Load all persistent stores from Redis on startup ─────────────────────────
async function loadAllStores() {
  await Promise.all([
    friendships.loadAll(),
    friendRequests.loadAll(),
    dms.loadAll(),
    profileComments.loadAll(),
    activityStore.loadAll(),
    groups.loadAll(),
    groupMessages.loadAll(),
    groupInvites.loadAll(),
  ]);
  // Restore groupCounter from loaded groups
  let maxId = 0;
  for (const [id] of groups.entries()) { const n = parseInt(id); if (n > maxId) maxId = n; }
  groupCounter = maxId;
  console.log("[startup] all stores loaded from Redis");
}
`;

// Insert loadAllFn before the Start section
const startSection = `// ─── Start`;
const startReplacement = loadAllFn + `\n` + startSection;
if (!code.includes("loadAllStores")) {
  code = code.replace(startSection, startReplacement);
  console.log("[patch] ✓ loadAllStores function added");
}

// Now replace the Start section to wrap in async IIFE
const startBlock = `// ─── Start ────────────────────────────────────────────────────────────────────
server.listen(PORT, "0.0.0.0", () => console.log(\`SBGames HTTP  :\${PORT}\`));

try {
  const sslOpts = { key: fs.readFileSync(SSL_KEY), cert: fs.readFileSync(SSL_CERT) };
  const httpsServer = https.createServer(sslOpts, app);
  const wssSSL = new WebSocketServer({ server: httpsServer });
  wssSSL.on("connection", (ws) => wss.emit("connection", ws));
  httpsServer.listen(PORT_SSL, "0.0.0.0", () => console.log(\`SBGames HTTPS :\${PORT_SSL}\`));
} catch (e) {
  console.warn("HTTPS not started:", e.message);
}`;

const startBlockNew = `// ─── Start ────────────────────────────────────────────────────────────────────
(async () => {
  await loadAllStores().catch(e => console.error("[startup] loadAllStores error:", e));
  server.listen(PORT, "0.0.0.0", () => console.log(\`SBGames HTTP  :\${PORT}\`));
  try {
    const sslOpts = { key: fs.readFileSync(SSL_KEY), cert: fs.readFileSync(SSL_CERT) };
    const httpsServer = https.createServer(sslOpts, app);
    const wssSSL = new WebSocketServer({ server: httpsServer });
    wssSSL.on("connection", (ws) => wss.emit("connection", ws));
    httpsServer.listen(PORT_SSL, "0.0.0.0", () => console.log(\`SBGames HTTPS :\${PORT_SSL}\`));
  } catch (e) {
    console.warn("HTTPS not started:", e.message);
  }
})();`;

if (code.includes(startBlock)) {
  code = code.replace(startBlock, startBlockNew);
  console.log("[patch] ✓ Start section wrapped in async IIFE with loadAllStores");
} else {
  console.error("[patch] ✗ Could not find full Start section block");
}


// ── 4. Fix the groupInvites.entries() usage (line ~924) ──
// The current code does: for (const [gid, list] of groupInvites.entries())
// RedisMap.entries() returns MapIterator which is fine, but we need to make sure
// it returns [key, value] pairs. Our RedisMap already does this via this.cache.entries().
// No change needed here.

// Write the patched file
fs.writeFileSync(path, code, "utf8");
console.log("[patch] ✓ File written (" + code.length + " bytes)");
console.log("[patch] DONE — restart pm2 to apply");
