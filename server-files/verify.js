// Server-side modpack verification for SBGames launcher.
//
// Схема:
//   Лаунчер при запуске MC пишет в Redis:
//     session:{user} = JSON { serverId, modHashes:[...], sha, ts, token }
//
//   Когда появится MC сервер с плагином — плагин делает:
//     GET /api/verify/check?user=X&token=Y
//   → возвращает session, плагин сверяет своими хешами.
//
// Прямо сейчас (без MC плагина) — это используется так:
//   /api/verify/report — лаунчер пушит хеши при запуске
//   /api/verify/check  — внешний сервис (плагин/bungeecord/velocity) тянет
//   /api/verify/banlist — забаненные users

const crypto  = require("crypto");
const fs      = require("fs");
const path    = require("path");
const express = require("express");
const router  = express.Router();

const MODPACK_DIR = process.env.MODPACK_DIR || "/opt/sbgames-modpack";

// HMAC-подпись для токена сессии (защита от подмены client-side)
const SESSION_SECRET = process.env.SESSION_SECRET || "sbg-session-2026-secret";

// ВАЖНО: должен быть доступен redis из sbgames-auth. Подключаем напрямую.
let redis = null;
try {
    const Redis = require("ioredis");
    redis = new Redis({ host: "127.0.0.1", port: 6379, lazyConnect: true });
    redis.connect().catch(err => console.error("[verify] redis:", err.message));
} catch (e) { console.error("[verify] ioredis not installed:", e.message); }

// Загружаем whitelist хешей модов из текущей версии
function getExpectedHashes() {
    if (!fs.existsSync(MODPACK_DIR)) return { version: null, hashes: [] };
    const versions = fs.readdirSync(MODPACK_DIR)
        .filter(d => { try { return fs.statSync(path.join(MODPACK_DIR,d)).isDirectory(); } catch { return false; } });
    if (!versions.length) return { version: null, hashes: [] };
    versions.sort((a, b) => fs.statSync(path.join(MODPACK_DIR,b)).mtimeMs - fs.statSync(path.join(MODPACK_DIR,a)).mtimeMs);
    const latest = versions[0];
    const modsDir = path.join(MODPACK_DIR, latest, "mods");
    if (!fs.existsSync(modsDir)) return { version: latest, hashes: [] };
    const hashes = [];
    for (const f of fs.readdirSync(modsDir)) {
        if (!f.endsWith(".jar")) continue;
        try {
            const buf = fs.readFileSync(path.join(modsDir, f));
            const sha = crypto.createHash("sha256").update(buf).digest("hex");
            hashes.push({ name: f, sha256: sha, size: buf.length });
        } catch {}
    }
    return { version: latest, hashes };
}

// ─── Routes ────────────────────────────────────────────────────────────────

// POST /api/verify/report — лаунчер пушит хеши при старте MC
// body: { user, serverId, hashes: [sha256...], minecraftVersion, forgeVersion }
router.post("/report", async (req, res) => {
    try {
        const { user, serverId, hashes, minecraftVersion, forgeVersion } = req.body || {};
        if (!user || !Array.isArray(hashes)) {
            return res.status(400).json({ error: "user + hashes required" });
        }
        const expected = getExpectedHashes();
        const expectedSet = new Set(expected.hashes.map(h => h.sha256.toLowerCase()));

        // Считаем сколько модов из лаунчера НЕ в whitelist
        const unknown = hashes.filter(h => !expectedSet.has(String(h).toLowerCase()));
        // Сколько модов из whitelist ОТСУТСТВУЕТ у клиента
        const provided = new Set(hashes.map(h => String(h).toLowerCase()));
        const missing  = expected.hashes.filter(h => !provided.has(h.sha256.toLowerCase()));

        const ok = unknown.length === 0 && missing.length === 0;
        const token = crypto.createHmac("sha256", SESSION_SECRET)
            .update(`${user}|${serverId || ""}|${Date.now()}`)
            .digest("hex").substring(0, 32);

        if (redis) {
            const session = {
                user, serverId, ts: Date.now(),
                modpackVersion: expected.version,
                minecraftVersion, forgeVersion,
                totalExpected: expected.hashes.length,
                totalProvided: hashes.length,
                unknownCount: unknown.length,
                missingCount:  missing.length,
                ok, token,
            };
            await redis.setex(`session:${user}`, 3600, JSON.stringify(session));
            if (!ok) {
                await redis.sadd("banned:mods", user);
                await redis.setex(`banned:mods:${user}`, 3600,
                    JSON.stringify({ reason: unknown.length ? "unknown" : "missing",
                                    unknown: unknown.slice(0, 5),
                                    missing: missing.slice(0, 5), ts: Date.now() }));
            } else {
                await redis.srem("banned:mods", user);
            }
        }

        res.json({
            ok, token, expected: expected.hashes.length, provided: hashes.length,
            unknown: unknown.length, missing: missing.length,
            modpackVersion: expected.version,
        });
    } catch (e) {
        console.error("[verify] report:", e);
        res.status(500).json({ error: e.message });
    }
});

// GET /api/verify/check?user=X — внешний сервис (MC плагин, BungeeCord) проверяет
router.get("/check", async (req, res) => {
    const { user } = req.query;
    if (!user) return res.status(400).json({ error: "user required" });
    if (!redis) return res.status(503).json({ error: "redis not connected" });
    const raw = await redis.get(`session:${user}`);
    if (!raw) return res.json({ ok: false, reason: "no session" });
    const session = JSON.parse(raw);
    res.json(session);
});

// GET /api/verify/expected — выдать whitelist (для тестов)
router.get("/expected", (req, res) => {
    res.json(getExpectedHashes());
});

// GET /api/verify/banlist
router.get("/banlist", async (req, res) => {
    if (!redis) return res.json({ banned: [] });
    const list = await redis.smembers("banned:mods");
    res.json({ banned: list });
});

module.exports = router;
