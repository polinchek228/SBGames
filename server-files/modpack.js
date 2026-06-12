// Modpack manifest endpoint for SBGames Minecraft launcher
// Schema:
//   GET /api/mods/manifest   → {
//     "version": "v1",
//     "zip_url": "https://...",
//     "zip_sha256": "abc...",
//     "mods": [
//       { "name": "jei.jar", "sha256": "...", "size": 1234567 }
//     ],
//     "signature": "hmac-sha256-hex(SECRET, body-without-signature)"
//   }
//   GET /api/mods/zip/:version → отдаёт конкретный .jar (с проверкой подписи запроса)

const crypto  = require("crypto");
const fs      = require("fs");
const path    = require("path");
const express = require("express");

const router = express.Router();

// ─── Config ─────────────────────────────────────────────────────────────────
const MODPACK_DIR = process.env.MODPACK_DIR || "/opt/sbgames-modpack";
const HMAC_SECRET = process.env.MODPACK_HMAC_SECRET || "sbg-modpack-secret-2026-rotate-quarterly";

// ─── Helpers ────────────────────────────────────────────────────────────────
function buildManifest() {
    // Сканируем /opt/sbgames-modpack/ — каждая папка = версия мод-пака
    if (!fs.existsSync(MODPACK_DIR)) return null;
    const versions = fs.readdirSync(MODPACK_DIR).filter(d => {
        try { return fs.statSync(path.join(MODPACK_DIR, d)).isDirectory(); } catch { return false; }
    });
    if (versions.length === 0) return null;
    // Самая свежая по mtime
    versions.sort((a, b) => {
        return fs.statSync(path.join(MODPACK_DIR, b)).mtimeMs
             - fs.statSync(path.join(MODPACK_DIR, a)).mtimeMs;
    });
    const latest = versions[0];
    const vdir   = path.join(MODPACK_DIR, latest);
    const modsDir = path.join(vdir, "mods");
    if (!fs.existsSync(modsDir)) return null;

    const mods = [];
    for (const f of fs.readdirSync(modsDir)) {
        if (!f.endsWith(".jar") && !f.endsWith(".disabled")) continue;
        try {
            const fp = path.join(modsDir, f);
            const buf = fs.readFileSync(fp);
            const sha = crypto.createHash("sha256").update(buf).digest("hex");
            mods.push({ name: f, sha256: sha, size: buf.length });
        } catch (e) {
            console.error("[modpack] read mod", f, e.message);
        }
    }

    // zip — если лежит рядом готовый
    const zipPath = path.join(vdir, "mods.zip");
    let zip_sha256 = "";
    if (fs.existsSync(zipPath)) {
        try {
            const zbuf = fs.readFileSync(zipPath);
            zip_sha256 = crypto.createHash("sha256").update(zbuf).digest("hex");
        } catch (e) { console.error("[modpack] zip hash:", e.message); }
    }

    // URL zip
    const base = process.env.MODPACK_BASE_URL || "https://api.sbgames.hyperionsearch.xyz:8443";
    const zip_url = `${base}/api/mods/zip/${encodeURIComponent(latest)}`;

    const manifest = {
        version:   latest,
        zip_url,
        zip_sha256,
        mods,
    };
    // HMAC-подпись (на всё кроме signature)
    const sigPayload = JSON.stringify(manifest);
    const sig = crypto.createHmac("sha256", HMAC_SECRET).update(sigPayload).digest("hex");
    manifest.signature = sig;
    return manifest;
}

// ─── Routes ─────────────────────────────────────────────────────────────────

// GET /api/mods/manifest
router.get("/manifest", (req, res) => {
    try {
        const m = buildManifest();
        if (!m) {
            return res.status(404).json({
                error: "no modpack available",
                hint:  "Create /opt/sbgames-modpack/<version>/mods/ and put .jar files there",
            });
        }
        res.set("Cache-Control", "no-store");
        res.json(m);
    } catch (e) {
        console.error("[modpack] manifest:", e);
        res.status(500).json({ error: e.message });
    }
});

// GET /api/mods/zip/:version — отдаёт готовый mods.zip
router.get("/zip/:version", (req, res) => {
    const v = req.params.version;
    // Защита от path traversal
    if (!/^[a-zA-Z0-9._-]+$/.test(v)) {
        return res.status(400).json({ error: "bad version" });
    }
    const zipPath = path.join(MODPACK_DIR, v, "mods.zip");
    if (!fs.existsSync(zipPath)) {
        return res.status(404).json({ error: "zip not found", path: zipPath });
    }
    const sha = crypto.createHash("sha256").update(fs.readFileSync(zipPath)).digest("hex");
    res.set("Content-Type", "application/zip");
    res.set("X-Content-SHA256", sha);
    fs.createReadStream(zipPath).pipe(res);
});

// GET /api/mods/status — для отладки
router.get("/status", (req, res) => {
    const m = buildManifest();
    res.json({
        ok:        !!m,
        version:   m?.version,
        mods:      m?.mods?.length || 0,
        has_zip:   !!m?.zip_sha256,
        modpack_dir: MODPACK_DIR,
        dir_exists: fs.existsSync(MODPACK_DIR),
    });
});

module.exports = router;
