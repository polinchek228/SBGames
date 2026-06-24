/**
 * ai-generate.cjs — генерирует свежие SEO-статьи через LLM (FreeQwenApi).
 *
 * Поток одной статьи:
 *   1. Берёт следующую тему из content/forum/_ai-topics.json (сверяя с _ai-state.json,
 *      чтобы не повторяться).
 *   2. Зовёт LLM с сильным «человеческим» системным промптом.
 *   3. Валидирует ответ (frontmatter, длина, slug-уникальность).
 *   4. Сохраняет .md в content/forum/ai/.
 *   5. Обновляет _ai-state.json.
 *
 * Запуск: node scripts/ai-generate.cjs            (1 статья)
 *         AI_ARTICLES_PER_RUN=3 node scripts/ai-generate.cjs   (3 статьи)
 *
 * Конфиг через env:
 *   AI_API_BASE  — OpenAI-совместимый эндпоинт (по умолч. локальный FreeQwenApi)
 *   AI_API_KEY   — ключ (FreeQwenApi может не требовать)
 *   AI_MODEL     — модель (по умолч. qwen-max)
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const FORUM_DIR = path.join(ROOT, "content", "forum");
const TOPICS_FILE = path.join(FORUM_DIR, "_ai-topics.json");
const STATE_FILE = path.join(FORUM_DIR, "_ai-state.json");

const API_BASE = process.env.AI_API_BASE || "http://localhost:3264/api";
const API_KEY = process.env.AI_API_KEY || "";
const MODEL = process.env.AI_MODEL || "qwen-max";
const PER_RUN = parseInt(process.env.AI_ARTICLES_PER_RUN || "1", 10);

// ─── Системный промпт — ядро «обучения» модели ──────────────────────────
// Развёрнутый промпт превращает LLM в живого автора Minecraft-контента:
// личный тон, актуальность, анти-повтор, SEO-структура, строгий Markdown.
const SYSTEM_PROMPT = `Ты — опытный игрок и автор контента по Minecraft с 10-летним стажем.
Пишешь для русскоязычного сообщества (геймеры, которые ищут конкретные ответы в Google/Yandex).
Твоя задача — писать СВЕЖИЕ, ПОЛЕЗНЫЕ, УНИКАЛЬНЫЕ статьи, которые реально помогают и при этом
хорошо ранжируются в поиске.

## КАК ПИСАТЬ (живой человек, не робот)

- Пиши от первого лица, как реальный игрок делится опытом: «я обычно делаю так», «по моему опыту»,
  «многие новички спотыкаются на этом».
- Разговорный, но грамотный тон. Без канцелярита. Без воды.
- Чередуй длину предложений: короткое. Потом подлиннее, с запятыми и уточнением.
  Потом снова короткое. Это держит ритм живого текста.
- Сразу к делу. Никаких вводных вроде «в современном мире Minecraft», «важно отметить»,
  «в данной статье мы рассмотрим».
- Личные наблюдения и нюансы, которых нет в вики: что реально ломается, какие подводные камни,
  что обычно делают неправильно.

## ЧЕГО НЕ ДЕЛАТЬ (ИИ-штампы = мгновенный брак)

- НЕ используй клише: «в современном мире», «в заключение», «стоит отметить», «нельзя не упомянуть»,
  «играет важную роль», «открывает новые горизонты».
- НЕ пиши водные абзацы ради объёма. Каждое предложение несёт информацию или живое наблюдение.
- НЕ повторяй одни и те же мысли в разных формулировках.
- НЕ выдумывай версии, моды, фичи, которых не существует. Если не уверен — пиши общие принципы.
- НЕ вставляй эмодзи без нужды. Максимум 1-2 за статью, только если уместно.

## АКТУАЛЬНОСТЬ

- Всегда указывай версию Minecraft и/или модлоадер (если тема об этом).
- Если речь об обновлении/моде — описывай РЕАЛЬНЫЕ фичи, которые существуют.
- Не пиши про устаревшие механики как про актуальные.

## SEO-СТРУКТУРА

- Один H1 (заголовок) — не больше.
- Подзаголовки H2/H3 с ключевыми словами естественным образом (не спам).
- Ключевой запрос из темы должен быть в заголовке и первых абзацах — но читаемо, без тавтологии.
- Плотность ключей естественная: лучше меньше, но в тему, чем переспам.
- Списки и таблицы там, где они реально помогают (инструкции, сравнения).
- Длина: 700–1400 слов. Читается за 3-5 минут.

## ФОРМАТ ВЫВОДА (СТРОГО)

Верни ТОЛЬКО готовый Markdown-документ, начинающийся с frontmatter в формате YAML,
без какого-либо сопроводительного текста, без \`\`\`markdown-обёрток, без комментариев.

Формат frontmatter:
---
slug: kebab-case-url-уникальный
title: "Заголовок статьи (естественный, с ключевым словом)"
category: ai
version: "1.20.1"
tags: [ключевые, слова, из, темы]
excerpt: "Краткое описание 1-2 предложения для meta description."
author: "SB Games"
---

Дальше тело статьи в Markdown: ## подзаголовки, **жирный**, списки, абзацы.

slug обязан быть на латинице (kebab-case), уникальным, отражать суть темы.
title — на русском, читаемый, с ключевым словом.`;

// ─── LLM-клиент (OpenAI-совместимый chat/completions) ───────────────────
async function generateArticle(topic, version) {
  const userPrompt = `Напиши статью по запросу: "${topic.q}".
Версия Minecraft: ${version}.
Угол/фокус статьи: ${topic.angle || "общий полезный гайд"}.

Требования:
- Статья должна полностью раскрывать запрос и давать практическую пользу читателю.
- Используй реальные факты о Minecraft ${version}. Не выдумывай.
- Заголовок (title) должен включать ключевой запрос естественно.
- slug: на латинице, kebab-case, уникальный, по теме.
- Соблюдай все правила из системного промпта.

Верни ТОЛЬКО Markdown с frontmatter.`;

  const body = {
    model: MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.85,
  };

  const headers = { "Content-Type": "application/json" };
  if (API_KEY) headers["Authorization"] = `Bearer ${API_KEY}`;

  const url = `${API_BASE}/chat/completions`;
  console.log(`[ai] → ${url}  модель: ${MODEL}`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 180000); // 3 минуты на генерацию
  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}: ${txt.slice(0, 200)}`);
    }
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content || data?.content || "";
    if (!content) throw new Error("пустой ответ от модели");
    return content.trim();
  } catch (e) {
    clearTimeout(timeout);
    throw e;
  }
}

// ─── Утилиты ────────────────────────────────────────────────────────────
function loadJson(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); }
  catch { return fallback; }
}
function saveJson(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), "utf8");
}

// Собираем все уже существующие slug/title в ai/, чтобы не дублировать
function existingAiSlugsAndTitles() {
  const slugs = new Set();
  const titles = new Set();
  const aiDir = path.join(FORUM_DIR, "ai");
  if (fs.existsSync(aiDir)) {
    for (const f of fs.readdirSync(aiDir).filter(f => f.endsWith(".md"))) {
      const raw = fs.readFileSync(path.join(aiDir, f), "utf8");
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

// Извлекаем slug и проверяем валидность ответа модели
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
  console.log("[ai] запуск генератора");
  console.log(`[ai] API: ${API_BASE} | модель: ${MODEL} | за запуск: ${PER_RUN}`);

  const topics = loadJson(TOPICS_FILE, null);
  if (!topics || !Array.isArray(topics.topics)) {
    console.error("[ai] _ai-topics.json не найден или битый");
    process.exit(1);
  }
  const version = topics.version || "1.20.1";
  const state = loadJson(STATE_FILE, { writtenTopics: [], writtenSlugs: [], cursor: 0, totalGenerated: 0 });

  // Проверка доступности API — лёгкий health-check по /models (не обязательно)
  // Пропускаем: если эндпоинт не отвечает, упадём на первом запросе с понятной ошибкой.

  const existing = existingAiSlugsAndTitles();
  // также учитываем ранее записанные в state
  for (const s of (state.writtenSlugs || [])) existing.slugs.add(s);

  let generated = 0;
  let skipped = 0;

  for (const topic of topics.topics) {
    if (generated >= PER_RUN) break;

    // Анти-повтор: пропускаем темы, которые уже генерировали
    const qNorm = topic.q.replace("{ver}", version);
    if ((state.writtenTopics || []).includes(qNorm)) { skipped++; continue; }

    console.log(`\n[ai] тема: "${qNorm}"`);
    let raw;
    try {
      raw = await generateArticle({ ...topic, q: qNorm }, version);
    } catch (e) {
      console.error(`[ai] ОШИБКА генерации: ${e.message}`);
      console.error("[ai] Проверь, что FreeQwenApi запущен на " + API_BASE);
      break;
    }

    const item = extractFrontmatter(raw);
    const err = validate(item, existing);
    if (err) {
      console.warn(`[ai] пропуск (валидация): ${err}`);
      continue;
    }

    // Запись файла
    const aiDir = path.join(FORUM_DIR, "ai");
    fs.mkdirSync(aiDir, { recursive: true });
    const outPath = path.join(aiDir, `${item.slug}.md`);
    fs.writeFileSync(outPath, raw, "utf8");
    console.log(`[ai] ✓ записан: content/forum/ai/${item.slug}.md`);

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

  console.log(`\n[ai] готово: сгенерировано ${generated}, пропущено ${skipped}, всего ${state.totalGenerated}`);
  if (generated === 0 && skipped === topics.topics.length) {
    console.log("[ai] все темы из пула уже отработаны — пополните _ai-topics.json");
  }
}

main().catch(e => { console.error("[ai] фатальная ошибка:", e); process.exit(1); });
