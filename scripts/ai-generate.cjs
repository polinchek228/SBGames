/**
 * generate-articles.cjs — генерирует свежие SEO-статьи через LLM (FreeQwenApi).
 *
 * Поток одной статьи:
 *   1. Берёт следующую тему из content/forum/_ai-topics.json (сверяя с _ai-state.json,
 *      чтобы не повторяться). Тема уже привязана к РЕАЛЬНОЙ категории (mods/articles/...).
 *   2. Зовёт LLM с сильным «человеческим» системным промптом.
 *   3. Валидирует ответ (frontmatter, длина, slug-уникальность).
 *   4. Сохраняет .md в content/forum/<категория темы>/.
 *   5. Обновляет _ai-state.json.
 *
 * Запуск: node scripts/ai-generate.cjs            (1 статья)
 *         AI_ARTICLES_PER_RUN=3 node scripts/ai-generate.cjs   (3 статьи)
 *
 * Конфиг через env:
 *   AI_API_BASE  — OpenAI-совместимый эндпоинт (по умолч. локальный FreeQwenApi)
 *   AI_API_KEY   — ключ (FreeQwenApi может не требовать)
 *   AI_MODEL     — модель (по умолч. qwen-max)
 *   AI_TIMEOUT_MS — таймаут запроса (по умолч. 360000 = 6 мин, под puppeteer-прокси)
 */
"use strict";

const fs = require("fs");
const path = require("path");

// Минимальный загрузчик .env (без зависимостей): подхватывает корневой .env,
// чтобы ключи (OpenRouter и т.п.) не лежали в коде и не утекали в git.
(function loadEnv() {
  try {
    const envPath = path.resolve(__dirname, "..", ".env");
    if (!fs.existsSync(envPath)) return;
    for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      let val = m[2].trim().replace(/^["']|["']$/g, "");
      if (process.env[m[1]] === undefined) process.env[m[1]] = val;
    }
  } catch (e) { /* ignore */ }
})();

const ROOT = path.resolve(__dirname, "..");
const FORUM_DIR = path.join(ROOT, "content", "forum");
const TOPICS_FILE = path.join(FORUM_DIR, "_ai-topics.json");
const STATE_FILE = path.join(FORUM_DIR, "_ai-state.json");

const API_BASE = process.env.AI_API_BASE || "http://localhost:3264/api";
const API_KEY = process.env.AI_API_KEY || "";
const MODEL = process.env.AI_MODEL || "qwen-max-latest";
const PER_RUN = parseInt(process.env.AI_ARTICLES_PER_RUN || "1", 10);
const TIMEOUT_MS = parseInt(process.env.AI_TIMEOUT_MS || "360000", 10);
const MAX_RETRIES = parseInt(process.env.AI_MAX_RETRIES || "3", 10);
const RETRY_DELAY_MS = parseInt(process.env.AI_RETRY_DELAY_MS || "8000", 10);

// Категории, куда разрешено писать (должны совпадать с build-forum.cjs).
const VALID_CATEGORIES = new Set(["mods", "articles", "textures", "maps", "skins", "shaders", "modpacks"]);

// Человекочитаемые названия категорий для промпта.
const CATEGORY_LABEL = {
  mods: "мод (карточка мода)",
  articles: "статья/гайд (общая тема, обновления, инструкции)",
  textures: "текстуры (ресурс-пак)",
  maps: "карта",
  skins: "скин",
  shaders: "шейдер",
  modpacks: "сборка модов",
};

// ─── Системный промпт — ядро «обучения» модели ──────────────────────────
// Развёрнутый промпт превращает LLM в живого автора Minecraft-контента:
// личный тон, актуальность, анти-повтор, SEO-структура, строгий Markdown.
const SYSTEM_PROMPT = `Ты — технический редактор базы знаний по Minecraft. Пишешь информационные статьи для русскоязычного сообщества (геймеры ищут конкретные ответы в Google/Yandex).

ГЛАВНОЕ: статья — это СПРАВОЧНЫЙ материал, а НЕ личный блог. Пиши нейтрально и по делу, как качественная энциклопедическая статья или редакционный гайд.

## СТИЛЬ (строго)

- НИКОГДА не пиши от первого лица. Запрещены: «я», «мне», «по моему опыту», «я обычно», «как-то раз», «у меня», «мы с друзьями», любые личные истории и выдуманные случаи из жизни.
- Пиши обезличенно и информативно: «чтобы установить мод, нужно…», «эта карта подходит для…», «частая ошибка — …».
- Тон — спокойный, экспертный, без воды и без «развлекательной» болтовни.
- Без обращений к читателю в стиле «представь», «согласись», «поверь мне».
- Грамотный русский, без канцелярита.

## ФАКТЫ И ВЕРСИИ (критично — не ошибаться)

- НЕ выдумывай факты, версии, фичи, названия модов. Если данных нет — пиши общие принципы, не сочиняй.
- Редакции Minecraft: Java Edition и Bedrock Edition. НЕ приписывай версию к редакции, если это не указано в теме явно. Номер версии (например 1.20.1, 1.21.x, 26.1, 26.2, 26.3) сам по себе НЕ означает Bedrock — по умолчанию считай контекст Java Edition, если в теме не сказано иное.
- Версии 26.1 / 26.2 / 26.3 — это современные версии Minecraft (2026 год). Указывай их как актуальные, но не выдумывай несуществующие подробности их changelog.
- Не называй версию «бедрок-версией» или «джава-версией», если этого не следует из темы. Если редакция неважна — просто говори «версия Minecraft X».
- Если тебе дан веб-контекст ниже — опирайся на него для актуальных данных. Не противоречь ему.

## ЧЕГО НЕ ДЕЛАТЬ (штампы = брак)

- НЕ используй клише: «в современном мире», «в заключение», «стоит отметить», «нельзя не упомянуть», «играет важную роль», «открывает новые горизонты», «в данной статье мы рассмотрим».
- НЕ лей воду ради объёма. Каждое предложение несёт факт или пользу.
- НЕ повторяй одну мысль разными словами.
- НЕ ставь эмодзи (максимум — ни одного; допустимо 0).

## SEO-СТРУКТУРА

- Один H1. Подзаголовки H2/H3 с ключевыми словами естественно (не спам).
- Ключевой запрос — в заголовке и первом абзаце, читаемо.
- Списки и таблицы там, где реально помогают (инструкции пошагово — нумерованный список; сравнения — таблица).
- Длина: 700–1400 слов.

## ОБЯЗАТЕЛЬНЫЙ БЛОК FAQ

В конце статьи добавь раздел с РОВНО таким заголовком:

## Частые вопросы

И 3–5 пар «вопрос-ответ». Каждый вопрос — H3, ответ — абзац под ним:

### Реальный вопрос, как его задают в поиске?
Конкретный ответ в 1–3 предложениях, по делу.

Вопросы — из реальных поисковых интентов (как установить, совместимо ли с версией, почему вылетает, какая версия нужна, как настроить).

## ЛАУНЧЕР SBGAMES (наш продукт)

SBGames — бесплатный лаунчер Minecraft (Windows, macOS, Linux), скачивается с сайта. Позволяет играть бесплатно (в т.ч. без покупки лицензии), с модами, скинами и своими серверами.

- Где тема касается «как играть бесплатно», «без лицензии», «как скачать Minecraft» — рекомендуй лаунчер SBGames как решение, нейтрально, без навязчивости.
- НИКОГДА не упоминай чужие лаунчеры (TLauncher и любые другие). Если тема о них — переводи на SBGames.
- Не пиши про взлом, кряки, торренты.
- В конце каждой статьи добавляй короткий блок-призыв:

  > **Лаунчер SBGames** — бесплатный лаунчер Minecraft с модами, скинами и серверами. Скачать: [games.sb-capital.group](https://games.sb-capital.group)

  Формулировку варьируй, ссылка та же.

## ФОРМАТ ВЫВОДА (СТРОГО)

Верни ТОЛЬКО Markdown-документ, начинающийся с YAML-frontmatter, без сопроводительного текста, без markdown-блоков-обёрток, без комментариев.

Frontmatter (поле category бери из задания, не выдумывай):
---
slug: kebab-case-url-уникальный
title: "Заголовок с ключевым словом"
category: <укажу в задании>
version: "1.20.1"
tags: [ключевые, слова]
excerpt: "Краткое описание 1-2 предложения для meta description."
author: "SB Games"
---

Дальше тело статьи: ## подзаголовки, **жирный**, списки, таблицы, абзацы.
slug — латиница kebab-case, уникальный. title — русский, читаемый, с ключевым словом.`;

// ─── LLM-клиент (OpenAI-совместимый chat/completions) ───────────────────
async function generateArticle(topic, version) {
  let __webctx = "";
  if (process.env.AI_WEB_LOCAL !== "0") {
    try { __webctx = await require("./web-search.cjs").contextFor(topic.q); if (__webctx) console.log("[gen] веб-данные подтянуты (" + __webctx.length + " симв.)"); }
    catch (e) { console.log("[gen] веб-поиск не удался: " + e.message); }
  }
  const userPrompt = `Напиши ${CATEGORY_LABEL[topic.cat] || "статью"} по запросу: "${topic.q}".
Категория (поле category в frontmatter): ${topic.cat}
Версия Minecraft: ${version}.
Угол/фокус статьи: ${topic.angle || "общий полезный гайд"}.

Требования:
- Статья должна полностью раскрывать запрос и давать практическую пользу читателю.
- Используй реальные факты о Minecraft ${version}. Не выдумывай.
- Заголовок (title) должен включать ключевой запрос естественно.
- slug: на латинице, kebab-case, уникальный, по теме.
- В поле category обязательно поставь: ${topic.cat}
- Соблюдай все правила из системного промпта.

Верни ТОЛЬКО Markdown с frontmatter.`;

  const body = {
    model: MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: (__webctx ? __webctx + "\n\n" : "") + userPrompt },
    ],
    temperature: 0.85,
    max_tokens: 8000,
    ...(process.env.AI_WEB_SEARCH !== "0" ? { plugins: [{ id: "web", max_results: Number(process.env.AI_WEB_RESULTS || 5) }] } : {}),
  };

  const headers = { "Content-Type": "application/json" };
  if (API_KEY) headers["Authorization"] = `Bearer ${API_KEY}`;

  const url = `${API_BASE}/chat/completions`;
  const payload = JSON.stringify(body);

  // Ретраи: puppeteer-прокси Qwen иногда отдаёт anti-bot challenge / 5xx — пробуем несколько раз.
  let lastErr;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    console.log(`[gen] → ${url}  модель: ${MODEL}  (попытка ${attempt}/${MAX_RETRIES})`);
    try {
      const content = await httpPostJson(url, headers, payload, TIMEOUT_MS);
      if (!content) throw new Error("пустой ответ от модели");
      return content.trim();
    } catch (e) {
      lastErr = e;
      console.warn(`[gen] попытка ${attempt} не удалась: ${e.message}`);
      if (attempt < MAX_RETRIES) {
        const w = RETRY_DELAY_MS * attempt;
        console.log(`[gen] пауза ${Math.round(w/1000)}с перед повтором...`);
        await new Promise(r => setTimeout(r, w));
      }
    }
  }
  throw lastErr;
}

// HTTP-клиент на встроенном http/https — без undici headersTimeout (5 мин),
// чтобы дождаться медленного puppeteer-прокси (таймаут контролируем сами через req.setTimeout).
function httpPostJson(url, headers, payload, timeoutMs) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const mod = u.protocol === "https:" ? require("https") : require("http");
    const req = mod.request({
      hostname: u.hostname,
      port: u.port || (u.protocol === "https:" ? 443 : 80),
      path: u.pathname + u.search,
      method: "POST",
      headers: { ...headers, "Content-Length": Buffer.byteLength(payload) },
    }, (res) => {
      let data = "";
      res.setEncoding("utf8");
      res.on("data", (ch) => (data += ch));
      res.on("end", () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
        }
        try {
          const j = JSON.parse(data);
          resolve(j?.choices?.[0]?.message?.content || j?.choices?.[0]?.message?.reasoning || j?.content || "");
        } catch (e) {
          reject(new Error("не удалось распарсить JSON ответа: " + e.message));
        }
      });
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error(`таймаут ${timeoutMs}мс`)));
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

// ─── Утилиты ────────────────────────────────────────────────────────────
function loadJson(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); }
  catch { return fallback; }
}
function saveJson(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), "utf8");
}

// Собираем все уже существующие slug/title во ВСЕХ категориях, чтобы не дублировать
function existingSlugsAndTitles() {
  const slugs = new Set();
  const titles = new Set();
  for (const cat of VALID_CATEGORIES) {
    const dir = path.join(FORUM_DIR, cat);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter(f => f.endsWith(".md"))) {
      const raw = fs.readFileSync(path.join(dir, f), "utf8");
      const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      if (m) {
        const slug = m[1].match(/slug:\s*(.+)/);
        const title = m[1].match(/title:\s*"?(.+?)"?\s*$/m);
        if (slug) slugs.add(slug[1].trim());
        if (title) titles.add(title[1].trim().toLowerCase());
      }
    }
  }
  return { slugs, titles };
}

// Извлекаем frontmatter и проверяем валидность ответа модели
function extractFrontmatter(md) {
  const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!m) return null;
  const fm = m[1];
  const body = m[2];
  const get = (key) => {
    const r = fm.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
    return r ? r[1].trim().replace(/^["']|["']$/g, "") : null;
  };
  const getArr = (key) => {
    const r = fm.match(new RegExp(`^${key}:\\s*\\[(.*?)\\]`, "m"));
    if (!r) return [];
    return r[1].split(",").map(s => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
  };
  return {
    slug: get("slug"),
    title: get("title"),
    category: get("category"),
    excerpt: get("excerpt"),
    tags: getArr("tags"),
    body,
  };
}

function validate(item, existing) {
  if (!item || !item.slug || !item.title) return "нет frontmatter/slug/title";
  if (!/^[a-z0-9-]+$/.test(item.slug)) return `slug не kebab-case: ${item.slug}`;
  if (existing.slugs.has(item.slug)) return `slug уже существует: ${item.slug}`;
  if (existing.titles.has(item.title.toLowerCase())) return `title уже существует`;
  const words = (item.body || "").trim().split(/\s+/).length;
  if (words < 350) return `слишком коротко: ${words} слов`;
  return null; // валидно
}

// ─── Главная ────────────────────────────────────────────────────────────
async function main() {
  console.log("[gen] запуск генератора");
  console.log(`[gen] API: ${API_BASE} | модель: ${MODEL} | за запуск: ${PER_RUN} | таймаут: ${TIMEOUT_MS}мс`);

  const topics = loadJson(TOPICS_FILE, null);
  if (!topics || !Array.isArray(topics.topics)) {
    console.error("[gen] _ai-topics.json не найден или битый");
    process.exit(1);
  }
  const version = topics.version || "1.20.1";
  const state = loadJson(STATE_FILE, { writtenTopics: [], writtenSlugs: [], cursor: 0, totalGenerated: 0 });

  const existing = existingSlugsAndTitles();
  // также учитываем ранее записанные в state
  for (const s of (state.writtenSlugs || [])) existing.slugs.add(s);

  let generated = 0;
  let skipped = 0;

  for (const topic of topics.topics) {
    if (generated >= PER_RUN) break;

    // Категория темы должна быть валидной
    if (!VALID_CATEGORIES.has(topic.cat)) {
      console.warn(`[gen] тема "${topic.q}": неизвестная категория "${topic.cat}" — пропуск`);
      skipped++;
      continue;
    }

    // Анти-повтор: пропускаем темы, которые уже генерировали
    const qNorm = topic.q.replace("{ver}", version);
    if ((state.writtenTopics || []).includes(qNorm)) { skipped++; continue; }

    console.log(`\n[gen] категория: ${topic.cat} | тема: "${qNorm}"`);
    let raw;
    try {
      raw = await generateArticle({ ...topic, q: qNorm }, version);
    } catch (e) {
      console.error(`[gen] ОШИБКА генерации: ${e.message}`);
      console.error("[gen] Проверь, что FreeQwenApi запущен на " + API_BASE);
      break;
    }

    const item = extractFrontmatter(raw);
    const err = validate(item, existing);
    if (err) {
      console.warn(`[gen] пропуск (валидация): ${err}`);
      continue;
    }

    // Запись файла в категорию темы (модель могла подменить category — берём из темы как истину)
    const catDir = path.join(FORUM_DIR, topic.cat);
    fs.mkdirSync(catDir, { recursive: true });
    // если модель подменила category в frontmatter — восстанавливаем
    const fixedMd = raw.replace(/^category:.*$/m, `category: ${topic.cat}`);
    const outPath = path.join(catDir, `${item.slug}.md`);
    fs.writeFileSync(outPath, fixedMd, "utf8");
    console.log(`[gen] ✓ записан: content/forum/${topic.cat}/${item.slug}.md`);

    existing.slugs.add(item.slug);
    existing.titles.add(item.title.toLowerCase());
    state.writtenTopics.push(qNorm);
    state.writtenSlugs.push(item.slug);
    state.totalGenerated = (state.totalGenerated || 0) + 1;
    generated++;

    // пауза между запросами, чтобы не упереться в лимит
    if (generated < PER_RUN) await new Promise(r => setTimeout(r, 2000));
  }

  state.lastRun = new Date().toISOString();
  saveJson(STATE_FILE, state);

  console.log(`\n[gen] готово: сгенерировано ${generated}, пропущено ${skipped}, всего ${state.totalGenerated}`);
  if (generated === 0 && skipped === topics.topics.length) {
    console.log("[gen] все темы из пула уже отработаны — пополните _ai-topics.json");
  }
}

main().catch(e => { console.error("[gen] фатальная ошибка:", e); process.exit(1); });