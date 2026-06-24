/**
 * build-forum.cjs — собирает контентный форум из Markdown.
 *
 * Вход:  content/forum/<category>/*.md  (frontmatter + тело Markdown)
 * Выход: dist/forum/_index.json        (сводный индекс для React-каталогов)
 *        dist/forum/<category>/<slug>/index.html  (prerendered SEO-страницы)
 *        обновлённый dist/sitemap.xml  (+ forum-URLs + изображения)
 *
 * Запуск: node scripts/build-forum.cjs  (также встроен в npm run build — см. package.json)
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const CONTENT_DIR = path.join(ROOT, "content", "forum");
const DIST_DIR = path.join(ROOT, "website", "dist");
const FORUM_DIST = path.join(DIST_DIR, "forum");
const SITE_ORIGIN = "https://games.sb-capital.group";

// ─── Категории и их метаданные (для UI + sitemap) ───────────────────────
const CATEGORIES = {
  mods:      { title: "Моды",            icon: "Cube",        desc: "Модификации для Minecraft — от оптимизации до контента." },
  articles:  { title: "Статьи",          icon: "BookOpen",    desc: "Официальные обновления, гайды и новости Minecraft." },
  ai:        { title: "Гайды",           icon: "Sparkle",     desc: "Полезные гайды и разборы по Minecraft.", hidden: true },
  textures:  { title: "Текстуры",        icon: "PaintBrush",  desc: "Ресурс-паки и текстуры высокого разрешения." },
  maps:      { title: "Карты",           icon: "Map",         desc: "Приключения, выживание, паркур и мини-игры." },
  skins:     { title: "Скины",           icon: "Smiley",      desc: "Скины для персонажа." },
  shaders:   { title: "Шейдеры",         icon: "Sun",         desc: "Шейдер-паки для красивой графики." },
  modpacks:  { title: "Сборки модов",    icon: "Stack",       desc: "Готовые модпаки под разные стили игры." },
};

// ─── Простейший парсер frontmatter (YAML-подмножество) ──────────────────
function parseFrontmatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!m) return { data: {}, body: raw };
  const yamlBlock = m[1];
  const body = m[2];
  const data = {};
  let i = 0;
  const lines = yamlBlock.split(/\r?\n/);
  while (i < lines.length) {
    const line = lines[i];
    const kv = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!kv) { i++; continue; }
    const key = kv[1];
    let val = kv[2].trim();
    // массив, начинающийся на той же строке: [a, b]
    if (val.startsWith("[") && val.endsWith("]")) {
      val = val.slice(1, -1).split(",").map(s => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
      data[key] = val;
      i++;
      continue;
    }
    // многострочный массив:
    //   key:
    //     - a
    //     - b
    if (val === "" && lines[i + 1] && /^\s+-\s/.test(lines[i + 1])) {
      const arr = [];
      i++;
      while (i < lines.length && /^\s+-\s/.test(lines[i])) {
        arr.push(lines[i].replace(/^\s+-\s+/, "").trim().replace(/^["']|["']$/g, ""));
        i++;
      }
      data[key] = arr;
      continue;
    }
    // скаляр (строка в кавычках или без)
    data[key] = val.replace(/^["']|["']$/g, "");
    i++;
  }
  return { data, body };
}

// ─── Минимальный Markdown → HTML (без зависимостей) ─────────────────────
function mdToHtml(md) {
  // Экранируем HTML
  let html = md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Блочные элементы построчно
  const lines = html.split(/\r?\n/);
  const out = [];
  let inList = false;
  let inCode = false;
  let codeBuf = [];

  const flushList = () => { if (inList) { out.push("</ul>"); inList = false; } };

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];

    // ```код``
    if (/^```/.test(line.trim())) {
      if (inCode) {
        out.push(`<pre><code>${codeBuf.join("\n")}</code></pre>`);
        codeBuf = [];
        inCode = false;
      } else {
        flushList();
        inCode = true;
      }
      continue;
    }
    if (inCode) { codeBuf.push(line); continue; }

    // Заголовки
    let h;
    if ((h = line.match(/^(#{1,6})\s+(.*)$/))) {
      flushList();
      const level = h[1].length;
      out.push(`<h${level}>${inline(h[2])}</h${level}>`);
      continue;
    }
    // Цитата
    if (/^&gt;\s?/.test(line)) {
      flushList();
      out.push(`<blockquote>${inline(line.replace(/^&gt;\s?/, ""))}</blockquote>`);
      continue;
    }
    // Список
    if (/^[-*]\s+/.test(line)) {
      if (!inList) { out.push("<ul>"); inList = true; }
      out.push(`<li>${inline(line.replace(/^[-*]\s+/, ""))}</li>`);
      continue;
    }
    // Пустая строка
    if (line.trim() === "") { flushList(); continue; }
    // Параграф
    flushList();
    out.push(`<p>${inline(line)}</p>`);
  }
  flushList();
  if (inCode) out.push(`<pre><code>${codeBuf.join("\n")}</code></pre>`);

  return out.join("\n");
}

// Инлайн-форматирование: **bold**, *italic*, `code`, [text](url)
function inline(text) {
  return text
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

// ─── Шаблон prerendered страницы в нашем дизайне ────────────────────────
function pageHtml(item, category) {
  const cat = CATEGORIES[category] || { title: category };
  const canonical = `${SITE_ORIGIN}/forum/${category}/${item.slug}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": item.title,
    "description": item.excerpt || "",
    "datePublished": item.publishedAt,
    "author": { "@type": "Organization", "name": item.author || "SB Games", "url": SITE_ORIGIN },
    "publisher": { "@type": "Organization", "name": "SB Games", "logo": { "@type": "ImageObject", "url": `${SITE_ORIGIN}/logo.jpg` } },
    "mainEntityOfPage": canonical,
    "image": item.image ? `${SITE_ORIGIN}${item.image}` : undefined,
  };
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Главная", "item": SITE_ORIGIN + "/" },
      { "@type": "ListItem", "position": 2, "name": "Форум", "item": SITE_ORIGIN + "/forum" },
      { "@type": "ListItem", "position": 3, "name": cat.title, "item": `${SITE_ORIGIN}/forum/${category}` },
      { "@type": "ListItem", "position": 4, "name": item.title, "item": canonical },
    ],
  };

  const bodyHtml = mdToHtml(item.__body);
  const tagsHtml = (item.tags || []).map(t => `<span class="f-tag">${escapeHtml(t)}</span>`).join("");
  const metaParts = [];
  if (item.version) metaParts.push(`<span>MC ${escapeHtml(item.version)}</span>`);
  if (item.loader && item.loader.length) metaParts.push(`<span>${escapeHtml(item.loader.join(" · "))}</span>`);
  metaParts.push(`<time>${escapeHtml(item.publishedAt || "")}</time>`);

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(item.title)} — SB Games</title>
  <meta name="description" content="${escapeHtml(item.excerpt || item.title)}">
  <link rel="canonical" href="${canonical}">
  <meta property="og:type" content="article">
  <meta property="og:title" content="${escapeHtml(item.title)}">
  <meta property="og:description" content="${escapeHtml(item.excerpt || "")}">
  <meta property="og:url" content="${canonical}">
  ${item.image ? `<meta property="og:image" content="${SITE_ORIGIN}${item.image}">` : ""}
  <meta property="og:site_name" content="SB Games">
  <meta property="og:locale" content="ru_RU">
  <link rel="icon" href="/logo.jpg">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  <script type="application/ld+json">${JSON.stringify(breadcrumb)}</script>
  <style>
    *,*::before,*::after { box-sizing: border-box; }
    html,body { margin:0; padding:0; background:#0a0a0e; color:#fff; font-family:'Inter',system-ui,-apple-system,sans-serif; line-height:1.6; }
    a { color:#60a5fa; text-decoration:none; }
    a:hover { text-decoration:underline; }
    .wrap { max-width:800px; margin:0 auto; padding:32px 24px 80px; }
    .crumb { font-size:12px; color:rgba(255,255,255,0.4); margin-bottom:18px; letter-spacing:0.02em; }
    .crumb a { color:rgba(255,255,255,0.5); }
    .crumb span { margin:0 8px; color:rgba(255,255,255,0.25); }
    h1 { font-size:clamp(28px,5vw,40px); font-weight:900; line-height:1.1; margin:0 0 14px; letter-spacing:0.01em; }
    .meta { display:flex; flex-wrap:wrap; gap:14px; align-items:center; font-size:13px; color:rgba(255,255,255,0.45); margin-bottom:8px; }
    .meta span, .meta time { }
    .tags { display:flex; flex-wrap:wrap; gap:8px; margin:14px 0 28px; }
    .f-tag { font-size:11px; font-weight:600; padding:4px 10px; border-radius:8px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.08); color:rgba(255,255,255,0.6); }
    .hero { ${item.image ? `background-image:linear-gradient(to top,rgba(0,0,0,0.7),rgba(0,0,0,0.2)),url('${item.image}'); background-size:cover; background-position:center;` : ""} min-height:180px; border-radius:16px; margin:0 0 28px; border:1px solid rgba(255,255,255,0.06); }
    .article { font-size:16px; color:rgba(255,255,255,0.82); }
    .article h2 { font-size:24px; font-weight:800; margin:36px 0 12px; color:#fff; }
    .article h3 { font-size:19px; font-weight:700; margin:28px 0 10px; color:#fff; }
    .article p { margin:0 0 16px; }
    .article ul { margin:0 0 16px; padding-left:22px; }
    .article li { margin-bottom:6px; }
    .article blockquote { border-left:3px solid #3b82f6; padding:6px 0 6px 16px; margin:0 0 16px; color:rgba(255,255,255,0.6); font-style:italic; }
    .article code { background:rgba(255,255,255,0.08); padding:2px 6px; border-radius:4px; font-size:14px; font-family:'Courier New',monospace; }
    .article pre { background:rgba(0,0,0,0.4); border:1px solid rgba(255,255,255,0.08); border-radius:10px; padding:14px 16px; overflow-x:auto; }
    .article pre code { background:none; padding:0; }
    .article strong { color:#fff; }
    .footer { text-align:center; color:rgba(255,255,255,0.18); font-size:12px; margin-top:48px; padding-top:24px; border-top:1px solid rgba(255,255,255,0.06); }
    .cta { margin:40px 0 0; padding:24px; border-radius:16px; background:linear-gradient(135deg,rgba(37,99,235,0.14),rgba(0,0,0,0)); border:1px solid rgba(255,255,255,0.08); text-align:center; }
    .cta h3 { margin:0 0 6px; }
    .cta p { margin:0 0 16px; color:rgba(255,255,255,0.5); font-size:14px; }
    .btn { display:inline-block; padding:12px 26px; background:#fff; color:#000; border-radius:10px; font-weight:700; font-size:13px; }
    .btn:hover { text-decoration:none; opacity:0.92; }
    @media(max-width:600px){ .wrap{ padding:24px 16px 60px; } }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="crumb"><a href="/">Главная</a><span>/</span><a href="/forum">Форум</a><span>/</span><a href="/forum/${category}">${escapeHtml(cat.title)}</a></div>
    <h1>${escapeHtml(item.title)}</h1>
    <div class="meta">${metaParts.join('<span style="color:rgba(255,255,255,0.2)">·</span>')}</div>
    ${(item.tags && item.tags.length) ? `<div class="tags">${tagsHtml}</div>` : ""}
    ${item.image ? `<div class="hero"></div>` : ""}
    <article class="article">
${bodyHtml}
    </article>
    <div class="cta">
      <h3>Играй на серверах SB Games</h3>
      <p>Один лаунчер на все серверы. Моды ставятся автоматически.</p>
      <a class="btn" href="/download">Скачать лаунчер</a>
    </div>
    <div class="footer">© 2026 SBGames. All rights reserved.</div>
  </div>
</body>
</html>`;
}

function escapeHtml(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ─── Главная сборка ─────────────────────────────────────────────────────
function build() {
  if (!fs.existsSync(CONTENT_DIR)) {
    console.warn("[forum] content/forum не найден — пропуск.");
    return;
  }

  // убедимся, что dist существует (запуск может идти до vite build)
  fs.mkdirSync(FORUM_DIST, { recursive: true });

  const index = { categories: {} };

  for (const [catKey, catMeta] of Object.entries(CATEGORIES)) {
    const catDir = path.join(CONTENT_DIR, catKey);
    index.categories[catKey] = { ...catMeta, slug: catKey, items: [] };
    if (!fs.existsSync(catDir)) continue;

    const files = fs.readdirSync(catDir).filter(f => f.endsWith(".md"));
    for (const file of files) {
      const raw = fs.readFileSync(path.join(catDir, file), "utf8");
      const { data, body } = parseFrontmatter(raw);
      if (!data.slug || !data.title) {
        console.warn(`[forum] пропуск ${catKey}/${file}: нет slug/title`);
        continue;
      }
      const item = {
        slug: data.slug,
        title: data.title,
        category: catKey,
        version: data.version || null,
        loader: data.loader || [],
        tags: data.tags || [],
        image: data.image || null,
        excerpt: data.excerpt || "",
        ai_generated: data.ai_generated === true || data.ai_generated === "true",
        publishedAt: data.publishedAt || null,
        author: data.author || "SB Games",
        __body: body,
      };

      // prerendered HTML
      const outDir = path.join(FORUM_DIST, catKey, item.slug);
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(path.join(outDir, "index.html"), pageHtml(item, catKey), "utf8");

      // в индекс для React — без тела
      const { __body, ...idxItem } = item;
      index.categories[catKey].items.push(idxItem);
    }

    // сортировка по дате (свежие сверху)
    index.categories[catKey].items.sort((a, b) => (b.publishedAt || "").localeCompare(a.publishedAt || ""));
    console.log(`[forum] ${catKey}: ${index.categories[catKey].items.length} статей`);
  }

  // сводный индекс
  fs.writeFileSync(path.join(FORUM_DIST, "_index.json"), JSON.stringify(index, null, 2), "utf8");
  console.log("[forum] _index.json записан");

  // обновить sitemap
  patchSitemap(index);
}

function patchSitemap(index) {
  const sitemapPath = path.join(DIST_DIR, "sitemap.xml");
  let xml = "";
  if (fs.existsSync(sitemapPath)) xml = fs.readFileSync(sitemapPath, "utf8");

  const today = new Date().toISOString().slice(0, 10);
  const urls = [];
  urls.push(`  <url>\n    <loc>${SITE_ORIGIN}/forum</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>0.9</priority>\n  </url>`);

  for (const [catKey, cat] of Object.entries(index.categories)) {
    if (cat.hidden) continue; // скрытый блок тоже в sitemap (хотим индекс), но без отдельной страницы категории
    urls.push(`  <url>\n    <loc>${SITE_ORIGIN}/forum/${catKey}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>0.8</priority>\n  </url>`);
    for (const it of cat.items) {
      const img = it.image ? `\n    <image:image>\n      <image:loc>${SITE_ORIGIN}${it.image}</image:loc>\n      <image:title>${escapeHtml(it.title)}</image:title>\n    </image:image>` : "";
      urls.push(`  <url>\n    <loc>${SITE_ORIGIN}/forum/${catKey}/${it.slug}</loc>\n    <lastmod>${it.publishedAt || today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>${img}\n  </url>`);
    }
  }

  const newXml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urls.join("\n")}\n</urlset>\n`;

  // если sitemap уже содержал не-forum URL'ы — мы их перезаписываем целиком.
  // Для SBGames sitemap генерируется из public/sitemap.xml + forum, поэтому здесь
  // мы отдаём приоритет forum-URL'ам, а базовые страницы добавим из публичного шаблона.
  let baseUrls = "";
  const baseSitemap = path.join(ROOT, "website", "public", "sitemap.xml");
  if (fs.existsSync(baseSitemap)) {
    const base = fs.readFileSync(baseSitemap, "utf8");
    const matches = base.match(/<url>[\s\S]*?<\/url>/g) || [];
    baseUrls = matches.join("\n") + "\n";
  }

  fs.writeFileSync(sitemapPath, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${baseUrls}${urls.join("\n")}\n</urlset>\n`, "utf8");
  console.log("[forum] sitemap.xml обновлён");
}

build();
