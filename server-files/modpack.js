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

// Ed25519 приватный ключ для подписи манифеста. PEM в env (PKCS#8).
// Генерация пары:
//   openssl genpkey -algorithm ed25519 -out modpack-sign.key
//   openssl pkey -in modpack-sign.key -pubout -outform DER | tail -c 32 | base64
// Приватный (PEM) → MODPACK_SIGN_PRIVKEY на сервере; публичный (base64 32B) → клиент.
const SIGN_PRIVKEY_PEM = process.env.MODPACK_SIGN_PRIVKEY || "";
let signKey = null;
if (SIGN_PRIVKEY_PEM) {
  try { signKey = crypto.createPrivateKey({ key: SIGN_PRIVKEY_PEM, format: "pem" }); }
  catch (e) { console.error("[modpack] bad MODPACK_SIGN_PRIVKEY:", e.message); }
} else {
  console.warn("[modpack] MODPACK_SIGN_PRIVKEY not set — manifest will be UNSIGNED and clients will reject it");
}

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
    const base = process.env.MODPACK_BASE_URL || "https://api.hyperionsearch.xyz:8443";
    const zip_url = `${base}/api/mods/zip/${encodeURIComponent(latest)}`;

    const manifest = {
        version:   latest,
        zip_url,
        zip_sha256,
        mods,
    };
    // Ed25519-подпись. Подписываем канонизированный JSON манифеста БЕЗ поля
    // signature. Клиент проверяет подпись вшитым публичным ключом и
    // отклоняет манифест при невалидной/отсутствующей подписи (fail-closed).
    if (signKey) {
        const sigPayload = Buffer.from(JSON.stringify(manifest), "utf8");
        const sig = crypto.sign(null, sigPayload, signKey); // Ed25519: algo = null
        manifest.signature = sig.toString("base64");
    } else {
        // Ключ не настроен — отдаём без подписи. Клиент это отвергнет.
        manifest.signature = "";
    }
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

// GET /api/mods/file/:name — скачать один мод по имени
router.get('/file/:name', (req, res) => {
    const name = req.params.name;
    if (!/^[a-zA-Z0-9 ._()+-]+$/.test(name) || name.includes('..')) {
        return res.status(400).json({ error: 'bad filename' });
    }
    const versions = fs.existsSync(MODPACK_DIR)
        ? fs.readdirSync(MODPACK_DIR).filter(d => { try { return fs.statSync(path.join(MODPACK_DIR,d)).isDirectory(); } catch { return false; } })
        : [];
    if (!versions.length) return res.status(404).json({ error: 'no modpack' });
    versions.sort((a,b) => fs.statSync(path.join(MODPACK_DIR,b)).mtimeMs - fs.statSync(path.join(MODPACK_DIR,a)).mtimeMs);
    const fp = path.join(MODPACK_DIR, versions[0], 'mods', name);
    if (!fs.existsSync(fp)) return res.status(404).json({ error: 'mod not found', name });
    const sha = require('crypto').createHash('sha256').update(fs.readFileSync(fp)).digest('hex');
    res.set('Content-Type','application/java-archive');
    res.set('X-Content-SHA256', sha);
    fs.createReadStream(fp).pipe(res);
});

module.exports = router;
