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
function inline(text) {
  return text
    .replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, '<img src="$2" alt="$1" loading="lazy">')
    .replace(/\`([^\`]+)\`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>")
    .replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, '<a href="$2" rel="nofollow">$1</a>');
}

function mdToHtml(md) {
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let i = 0;

  const isTableSep = (s) => /^\s*\|?[\s:|-]+\|?\s*$/.test(s) && s.includes("-");

  while (i < lines.length) {
    let line = lines[i];

    // fenced code
    if (/^\s*```/.test(line)) {
      const buf = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) { buf.push(esc(lines[i])); i++; }
      i++;
      out.push("<pre><code>" + buf.join("\n") + "</code></pre>");
      continue;
    }

    // table: header line followed by separator
    if (line.includes("|") && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const splitRow = (r) => r.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map((c) => c.trim());
      const headers = splitRow(line);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim() !== "") { rows.push(splitRow(lines[i])); i++; }
      let t = "<table><thead><tr>" + headers.map((h) => "<th>" + inline(esc(h)) + "</th>").join("") + "</tr></thead><tbody>";
      for (const r of rows) t += "<tr>" + r.map((c) => "<td>" + inline(esc(c)) + "</td>").join("") + "</tr>";
      t += "</tbody></table>";
      out.push(t);
      continue;
    }

    // heading
    let h;
    if ((h = line.match(/^(#{1,6})\s+(.*)$/))) {
      out.push("<h" + h[1].length + ">" + inline(esc(h[2])) + "</h" + h[1].length + ">");
      i++; continue;
    }

    // hr
    if (/^\s*(---|\*\*\*|___)\s*$/.test(line)) { out.push("<hr>"); i++; continue; }

    // blockquote (one or more lines)
    if (/^\s*>\s?/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) { buf.push(inline(esc(lines[i].replace(/^\s*>\s?/, "")))); i++; }
      out.push("<blockquote>" + buf.join("<br>") + "</blockquote>");
      continue;
    }

    // ordered list
    if (/^\s*\d+[.)]\s+/.test(line)) {
      out.push("<ol>");
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        out.push("<li>" + inline(esc(lines[i].replace(/^\s*\d+[.)]\s+/, ""))) + "</li>"); i++;
      }
      out.push("</ol>"); continue;
    }

    // unordered list (supports one nesting level via indentation)
    if (/^\s*[-*+]\s+/.test(line)) {
      out.push("<ul>");
      let openNested = false;
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        const indent = lines[i].match(/^(\s*)/)[1].length;
        const content = inline(esc(lines[i].replace(/^\s*[-*+]\s+/, "")));
        if (indent >= 2) {
          if (!openNested) { out.push("<ul>"); openNested = true; }
          out.push("<li>" + content + "</li>");
        } else {
          if (openNested) { out.push("</ul>"); openNested = false; }
          out.push("<li>" + content + "</li>");
        }
        i++;
      }
      if (openNested) out.push("</ul>");
      out.push("</ul>"); continue;
    }

    // blank
    if (line.trim() === "") { i++; continue; }

    // paragraph (collect consecutive non-empty, non-special lines)
    const para = [];
    while (i < lines.length && lines[i].trim() !== "" &&
           !/^\s*(#{1,6}\s|>|\d+[.)]\s|[-*+]\s|```|---|\*\*\*|___)/.test(lines[i]) &&
           !(lines[i].includes("|") && i + 1 < lines.length && isTableSep(lines[i + 1]))) {
      para.push(inline(esc(lines[i]))); i++;
    }
    out.push("<p>" + para.join("<br>") + "</p>");
  }
  return out.join("\n");
}

// ─── Блок «Похожие материалы» (внутренние ссылки для SEO) ───────────────
function renderRelated(related) {
  const cards = related.map(r => {
    const cat = CATEGORIES[r.catKey] || { title: r.catKey };
    return `      <a class="related-card" href="/forum/${r.catKey}/${r.slug}">
        <div class="related-cat">${escapeHtml(cat.title)}</div>
        <div class="related-title">${escapeHtml(r.title)}</div>
      </a>`;
  }).join("\n");
  return `    <div class="related">
      <h3>Похожие материалы</h3>
      <div class="related-grid">
${cards}
      </div>
    </div>`;
}

// ─── Извлечение FAQ из тела (## Частые вопросы → пары H3-вопрос/абзац-ответ) ──
function extractFaq(md) {
  const lines = md.split(/\r?\n/);
  const faqs = [];
  let inFaq = false, q = null, aBuf = [];
  const flush = () => { if (q && aBuf.length) faqs.push({ q, a: aBuf.join(" ").trim() }); q = null; aBuf = []; };
  for (const line of lines) {
    const h2 = line.match(/^##\s+(.*)$/);
    const h3 = line.match(/^###\s+(.*)$/);
    if (h2) {
      if (inFaq) { flush(); inFaq = false; }
      if (/частые\s+вопросы|вопросы\s+и\s+ответы|faq/i.test(h2[1])) inFaq = true;
      continue;
    }
    if (!inFaq) continue;
    if (h3) { flush(); q = h3[1].trim(); continue; }
    if (line.trim() === "") continue;
    if (q) aBuf.push(line.trim());
  }
  flush();
  return faqs;
}

// ─── Шаблон prerendered страницы в нашем дизайне ────────────────────────
function pageHtml(item, category, related = []) {
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

  const faqs = extractFaq(item.__body);
  const faqLd = faqs.length >= 2 ? {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map(f => ({
      "@type": "Question",
      "name": f.q,
      "acceptedAnswer": { "@type": "Answer", "text": f.a },
    })),
  } : null;

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
  ${faqLd ? `<script type="application/ld+json">${JSON.stringify(faqLd)}</script>` : ""}
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
    .related { margin:40px 0 0; }
    .related h3 { font-size:16px; font-weight:800; margin:0 0 14px; letter-spacing:0.02em; }
    .related-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:12px; }
    .related-card { display:block; padding:14px 14px; border-radius:12px; text-decoration:none; color:#fff; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); transition:border-color 0.15s; }
    .related-card:hover { text-decoration:none; border-color:rgba(96,165,250,0.3); }
    .related-cat { font-size:10px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:#60a5fa; margin-bottom:6px; }
    .related-title { font-size:13px; font-weight:600; line-height:1.4; color:rgba(255,255,255,0.85); }
    @media(max-width:600px){ .wrap{ padding:24px 16px 60px; } }
  
    .article p { margin:0 0 16px; }
    .article ul, .article ol { margin:0 0 18px; padding-left:24px; }
    .article li { margin:0 0 8px; }
    .article ul ul, .article ol ol, .article ul ol, .article ol ul { margin:8px 0 4px; }
    .article h4 { font-size:16px; font-weight:700; margin:22px 0 8px; color:#fff; }
    .article hr { border:none; border-top:1px solid rgba(255,255,255,0.1); margin:32px 0; }
    .article img { max-width:100%; height:auto; border-radius:12px; margin:8px 0 20px; border:1px solid rgba(255,255,255,0.08); display:block; }
    .article a { color:#60a5fa; border-bottom:1px solid rgba(96,165,250,0.3); }
    .article a:hover { border-bottom-color:#60a5fa; }
    .article table { width:100%; border-collapse:collapse; margin:8px 0 24px; font-size:14px; overflow:hidden; border-radius:12px; border:1px solid rgba(255,255,255,0.1); }
    .article thead th { background:rgba(96,165,250,0.12); color:#fff; font-weight:700; text-align:left; padding:12px 14px; border-bottom:1px solid rgba(255,255,255,0.12); }
    .article tbody td { padding:11px 14px; border-bottom:1px solid rgba(255,255,255,0.06); color:rgba(255,255,255,0.78); }
    .article tbody tr:nth-child(even) td { background:rgba(255,255,255,0.02); }
    .article tbody tr:last-child td { border-bottom:none; }
    .article tbody tr:hover td { background:rgba(96,165,250,0.05); }
    .article pre { margin:0 0 20px; }

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
    ${(related && related.length) ? renderRelated(related) : ""}
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

  const itemsWithBody = []; // для второго прохода (рендер HTML с related)

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

      // в индекс для React — без тела
      const { __body, ...idxItem } = item;
      index.categories[catKey].items.push(idxItem);

      // сохраняем полное тело для второго прохода (рендер HTML)
      itemsWithBody.push({ item, catKey });
    }

    // сортировка по дате (свежие сверху)
    index.categories[catKey].items.sort((a, b) => (b.publishedAt || "").localeCompare(a.publishedAt || ""));
    console.log(`[forum] ${catKey}: ${index.categories[catKey].items.length} статей`);
  }

  // ── Второй проход: prerendered HTML с блоком «Похожие материалы» ──
  // Считаем related по пересечению тегов (и версии MC как бонус), исключая саму статью.
  for (const { item, catKey } of itemsWithBody) {
    const all = Object.values(index.categories).flatMap(c => c.items.map(i => ({ ...i, catKey: c.slug })));
    const related = all
      .filter(i => i.slug !== item.slug)
      .map(i => {
        const commonTags = (i.tags || []).filter(t => (item.tags || []).includes(t)).length;
        const sameVersion = item.version && i.version === item.version ? 1 : 0;
        return { i, score: commonTags * 2 + sameVersion };
      })
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map(x => x.i);

    const outDir = path.join(FORUM_DIST, catKey, item.slug);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "index.html"), pageHtml(item, catKey, related), "utf8");
  }

  // сводный индекс
  fs.writeFileSync(path.join(FORUM_DIST, "_index.json"), JSON.stringify(index, null, 2), "utf8");
  console.log("[forum] _index.json записан");

  // ── SEO hub-страницы: /forum/ и /forum/<category>/ ──
  writeHubPages(index);

  // обновить sitemap
  patchSitemap(index);
}


function writeHubPages(index) {
  const tplPath = path.join(DIST_DIR, "index.html");
  if (!fs.existsSync(tplPath)) { console.log("[forum] index.html шаблон не найден — пропускаю hub"); return; }
  const tpl = fs.readFileSync(tplPath, "utf8");

  function applySeo(html, { title, desc, canonical, jsonld, rootHtml }) {
    let out = html;
    // убрать существующие SEO-теги из шаблона лаунчера, чтобы не было дублей
    out = out.replace(/[ \t]*<meta\s+name=["']description["'][^>]*>\s*/gi, "");
    out = out.replace(/[ \t]*<link\s+rel=["']canonical["'][^>]*>\s*/gi, "");
    out = out.replace(/[ \t]*<meta\s+property=["']og:(title|description|url|type)["'][^>]*>\s*/gi, "");
    out = out.replace(/[ \t]*<meta\s+name=["']twitter:(title|description|card)["'][^>]*>\s*/gi, "");
    out = out.replace(/<title>[\s\S]*?<\/title>/i, "<title>" + escapeHtml(title) + "</title>");
    if (/<meta\s+name=["']description["'][^>]*>/i.test(out)) {
      out = out.replace(/<meta\s+name=["']description["'][^>]*>/i, '<meta name="description" content="' + escapeHtml(desc) + '">');
    } else {
      out = out.replace(/<\/head>/i, '  <meta name="description" content="' + escapeHtml(desc) + '">\n</head>');
    }
    const head = [
      '<link rel="canonical" href="' + canonical + '">',
      '<meta property="og:type" content="website">',
      '<meta property="og:title" content="' + escapeHtml(title) + '">',
      '<meta property="og:description" content="' + escapeHtml(desc) + '">',
      '<meta property="og:url" content="' + canonical + '">',
      '<meta name="twitter:card" content="summary">',
      '<script type="application/ld+json">' + JSON.stringify(jsonld) + '</script>',
    ].join("\n  ");
    out = out.replace(/<\/head>/i, "  " + head + "\n</head>");
    out = out.replace(/<div id=["']root["']>\s*<\/div>/i, '<div id="root">' + rootHtml + '</div>');
    return out;
  }

  const cats = Object.entries(index.categories).filter(([, c]) => !c.hidden);
  const allItems = cats.flatMap(([k, c]) => (c.items || []).map(it => ({ ...it, _cat: k, _catTitle: c.title })));
  const latest = [...allItems].sort((a, b) => (b.publishedAt || "").localeCompare(a.publishedAt || "")).slice(0, 12);

  // ----- /forum/ -----
  {
    const title = "Форум SBGames — гайды по модам, картам и сборкам Minecraft";
    const desc = "База материалов по Minecraft: моды, текстуры, карты, скины, шейдеры и сборки. Пошаговые гайды и разборы версий. Бесплатный лаунчер SBGames.";
    const canonical = SITE_ORIGIN + "/forum";
    const catLinks = cats.map(([k, c]) =>
      '<li><a href="/forum/' + k + '"><strong>' + escapeHtml(c.title) + '</strong> — ' + escapeHtml(c.desc || "") + ' (' + (c.items ? c.items.length : 0) + ')</a></li>'
    ).join("");
    const latestLinks = latest.map(it =>
      '<li><a href="/forum/' + it._cat + '/' + it.slug + '">' + escapeHtml(it.title) + '</a> — ' + escapeHtml(it._catTitle) + '</li>'
    ).join("");
    const rootHtml = '<main><h1>Форум SBGames</h1>' +
      '<p>' + escapeHtml(desc) + '</p>' +
      '<h2>Категории</h2><ul>' + catLinks + '</ul>' +
      '<h2>Свежие материалы</h2><ul>' + latestLinks + '</ul></main>';
    const jsonld = {
      "@context": "https://schema.org", "@type": "CollectionPage",
      "name": title, "description": desc, "url": canonical,
      "hasPart": cats.map(([k, c]) => ({ "@type": "CollectionPage", "name": c.title, "url": SITE_ORIGIN + "/forum/" + k })),
    };
    fs.mkdirSync(FORUM_DIST, { recursive: true });
    fs.writeFileSync(path.join(FORUM_DIST, "index.html"), applySeo(tpl, { title, desc, canonical, jsonld, rootHtml }), "utf8");
  }

  // ----- /forum/<category>/ -----
  for (const [k, c] of cats) {
    const title = escapeHtml(c.title) + " для Minecraft — скачать и установить | Форум SBGames";
    const desc = (c.desc || c.title) + ". Подборки и гайды для Minecraft на форуме SBGames. Бесплатный лаунчер SBGames для игры с модами.";
    const canonical = SITE_ORIGIN + "/forum/" + k;
    const items = (c.items || []);
    const itemLinks = items.map(it =>
      '<li><a href="/forum/' + k + '/' + it.slug + '">' + escapeHtml(it.title) + '</a>' + (it.excerpt ? ' — ' + escapeHtml(it.excerpt) : '') + '</li>'
    ).join("");
    const rootHtml = '<main><nav><a href="/forum">Форум</a> / ' + escapeHtml(c.title) + '</nav>' +
      '<h1>' + escapeHtml(c.title) + '</h1><p>' + escapeHtml(c.desc || "") + '</p>' +
      '<ul>' + (itemLinks || '<li>Скоро здесь появятся материалы.</li>') + '</ul></main>';
    const jsonld = {
      "@context": "https://schema.org", "@type": "ItemList",
      "name": c.title, "url": canonical,
      "itemListElement": items.map((it, i) => ({ "@type": "ListItem", "position": i + 1, "url": SITE_ORIGIN + "/forum/" + k + "/" + it.slug, "name": it.title })),
    };
    const dir = path.join(FORUM_DIST, k);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "index.html"), applySeo(tpl, { title, desc, canonical, jsonld, rootHtml }), "utf8");
  }

  console.log("[forum] hub-страницы (/forum + категории) сгенерированы: " + (cats.length + 1));
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