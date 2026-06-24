# Forum / Content Platform — Design Spec

**Date:** 2026-06-24
**Goal:** Контентная платформа (форум) внутри сайта в нашем тёмном дизайне: каталог модов/текстур/карт/скинов/шейдеров/сборок с фильтрами, статьи про официальные обновления Minecraft, и скрытый AI-блок, который генерит SEO-статьи на лету для привлечения поискового трафика.

## Решения (из брейншторма)

- **Хранение контента**: Markdown-файлы + frontmatter (см. структуру ниже).
- **Рендеринг**: гибрид — каталоги/фильтры на React (SPA), детальные страницы → **prerendered HTML** (максимальный SEO, контент прямо в HTML для Yandex/Google).
- **AI-движок**: cron-скрипт `ai-generate.cjs` → зовёт **FreeQwenApi** (`http://localhost:3264/api/chat/completions`, OpenAI-совместимый) → пишет `.md` файлы.
- **LLM**: универсальный OpenAI-совместимый клиент (работает с FreeQwenApi / OpenAI / GigaChat / Ollama).

## Структура контента (источник)

```
content/forum/                     ← Markdown, коммитится в репо
├── _index.json                    ← генерируется билд-скриптом (сводный индекс)
├── mods/                          (OptiFine.md, JEI.md, Sodium.md …)
├── articles/                      (официальные обновления Minecraft — руками/редактором)
├── ai/                            ← СКРЫТЫЙ блок AI-статей для трафика
├── textures/
├── maps/
├── skins/
├── shaders/
└── modpacks/
```

### Frontmatter каждого `.md`

```yaml
---
slug: optifine-1-20-1            # уникальный, = URL /forum/mods/optifine-1-20-1
title: "OptiFine для Minecraft 1.20.1 — установка и настройка"
category: mods                    # mods|articles|ai|textures|maps|skins|shaders|modpacks
version: "1.20.1"                 # версия MC (для фильтра)
loader: [forge, fabric]           # модлоадеры (для фильтра)
tags: [оптимизация, fps, шейдеры]
image: /forum/mods/optifine.jpg   # превью
ai_generated: false               # true для ai/ — скрытый маркер
publishedAt: 2026-06-24
excerpt: "Оптимизация FPS и шейдеры для Minecraft 1.20.1."
---

Тело в Markdown…
```

## Категории форума (как на референсах)

| Категория | Фильтры | Референс |
|---|---|---|
| `mods` | версия MC, модлоадер (Forge/Fabric/Quilt), теги | minecraft-inside.ru/mods |
| `articles` | дата, теги (обновления, гайды, новости) | tlauncher.ru/news |
| `textures` | разрешение (16x/32x/64x/128x), стиль | — |
| `maps` | жанр (выживание/приключение/паркур), версия | — |
| `skins` | теги | — |
| `shaders` | версия, тип | — |
| `modpacks` | модлоадер, размер, версия | — |
| `ai` (СКРЫТЫЙ) | не в меню, доступ по ссылке/поиск | трафик из поиска |

## Архитектура рендеринга (гибрид SPA + prerender)

```
npm run build
   │
   ├─ vite build (существующий)
   │
   └─ node scripts/build-forum.cjs   ← НОВЫЙ
        ├─ читает content/forum/**/*.md (frontmatter + body)
        ├─ пишет dist/forum/_index.json        (для React-каталогов)
        ├─ для КАЖДОЙ статьи:
        │    парсит Markdown → HTML
        │    оборачивает в наш дизайн (тёмный, как DownloadPage)
        │    пишет dist/forum/<category>/<slug>/index.html  (SEO HTML)
        │    + inject JSON-LD (Article + Breadcrumb)
        └─ обновляет sitemap.xml (+ все forum-URLs)
```

**Почему так:** каталог с фильтрами = интерактив → React. Статья = текст → готовый HTML (Yandex парсит HTML, а не JS-рендер). Это воспроизводит то, как работают tlauncher/minecraft-inside (серверный рендер).

### Роутинг
- `/forum` → главная форума (React: сетка категорий)
- `/forum/<category>` → React-каталог с фильтрами (грузит `_index.json`, фильтрует клиентски)
- `/forum/<category>/<slug>` → **prerendered HTML** (отдаётся nginx/express как статики)

## Дизайн (наш стиль)

Тот же язык, что DownloadPage/HomePage:
- `background: #000`, `rgba(255,255,255,0.0x)` карточки, border `1px solid rgba(255,255,255,0.06)`
- phosphor-icons, framer-motion fade-in
- `clamp()` заголовки, max-width 1100
- Карточка контента: image (filter brightness 0.5) + title + meta (версия/loader) + теги

## AI-пайплайн (`scripts/ai-generate.cjs`) — детально

### Источник «свежего» (актуальность, не повтор)
- **`content/forum/_ai-state.json`** — состояние генератора:
  ```json
  {
    "lastRun": "2026-06-24T12:00:00Z",
    "writtenTopics": ["как установить forge 1.20.1", "лучшие моды на выживание", ...],
    "lastMcVersionChecked": "1.20.1",
    "cursor": 0
  }
  ```
- **Пул тем** (`content/forum/_ai-topics.json`) — большой список целевых SEO-запросов + шаблоны. Скрипт берёт следующий неиспользованный.
- **Анти-повтор**: перед генерацией темы скрипт сверяет с `writtenTopics` и со всеми существующими `slug`/`title` в `content/forum/ai/`. Если тема уже покрыта — пропускает.
- **Актуальность версий**: пул тем параметризован версией MC; скрипт может тянуть «последнюю стабильную версию» из `latest.json` манифеста или захардкоженного списка, и подставлять актуальную версию в промпт.

### LLM-вызов (FreeQwenApi)
```js
POST http://localhost:3264/api/chat/completions   // OpenAI-совместимый
{
  "model": "qwen-max",        // или любая из доступных
  "messages": [
    { "role": "system", "content": <СИСТЕМНЫЙ ПРОМПТ — см. ниже> },
    { "role": "user",   "content": <тема + требования к конкретной статье> }
  ],
  "temperature": 0.8
}
```
Эндпоинт/ключ/модель читаются из env с дефолтом на локальный FreeQwenApi:
```
AI_API_BASE=http://localhost:3264/api     // env: AI_API_BASE
AI_API_KEY=                                // FreeQwenApi ключ (или любой)
AI_MODEL=qwen-max                          // env: AI_MODEL
```

### Системный промпт (ядро «обучения»)

Развёрнутый промпт, который делает из LLM живого автора Minecraft-блога. Ключевые блоки:
1. **Роль**: опытный игрок/автор Minecraft-контента, пишет для русскоязычного сообщества.
2. **Стиль = живой человек**: личный тон («я», «по моему опыту»), разговорные обороты, не канцелярит, не списки-перечисления ради списка, varied длина предложений. Запрет на ИИ-штампы («в современном мире», «важно отметить», «в заключение»).
3. **SEO-структура**: один H1, подзаголовки H2/H3 с ключевыми словами, плотность ключей естественная (не спам), мета-описание, alt-мысли для картинок.
4. **Актуальность**: всегда указывать версию MC/модлоадера; если тема про обновление — реальные фичи (берёт из user-промпта или общих знаний о релизе).
5. **Уникальность/анти-повтор**: «не пиши вводные клише, сразу к делу; у каждой статьи свой угол/хук».
6. **Формат вывода**: строгий Markdown с frontmatter (slug, title, excerpt, tags) — чтобы скрипт мог распарсить и записать файл без правок.
7. **Длина**: 800–1500 слов, читается за 3-5 минут.
8. **Запреты**: выдуманные версии/фичи, копипаста, водные абзацы, повтор фраз из предыдущих статей (даётся пара примеров «не пиши так»).

### Флоу одной статьи
1. Взять следующую тему из пула (не в `writtenTopics`).
2. Собрать user-промпт (тема + версия MC + контекст).
3. Вызвать LLM → получить Markdown.
4. Валидация: есть frontmatter, slug уникален, длина > 400 слов, нет явного мусора.
5. Записать `content/forum/ai/<slug>.md`.
6. Дописать slug+title в `_ai-state.json.writtenTopics`.
7. Лог.

### Cron
`scripts/ai-cron.sh` (или systemd timer): `node scripts/ai-generate.cjs` раз в N часов (env `AI_ARTICLES_PER_RUN` — сколько за запуск, дефолт 1-2). После запуска → пересборка сайта (`npm run build`) → авто-деплой.

## SEO (для forum)

- Каждая prerendered HTML-страница: `<title>`, `<meta description>`, `<h1>`, JSON-LD `Article` (+ `BreadcrumbList`), canonical.
- Категории в sitemap.xml + изображения.
- Внутренние ссылки (статья ↔ статья по тегам) — internal linking.
- Скрытый `ai/` блок: в `robots.txt` НЕ закрываем (хотим индекс), но в меню/навигации сайта не показываем.

## Файлы к созданию

```
scripts/
├── build-forum.cjs        ← .md → JSON-индекс + prerendered HTML
├── ai-generate.cjs        ← cron: LLM → .md
├── ai-cron.sh             ← обёртка cron
content/forum/
├── _ai-topics.json        ← пул SEO-тем
├── _ai-state.json         ← состояние генератора
├── mods/ (примеры: OptiFine.md, JEI.md, Sodium.md)
├── articles/ (пример официального обновления)
├── ai/ (первая AI-статья как smoke-тест)
└── textures/, maps/, skins/, shaders/, modpacks/ (по 1 примеру-заглушке)

website/src/pages/forum/
├── ForumIndex.jsx         ← главная форума (сетка категорий)
├── ForumCategory.jsx      ← каталог + фильтры (обобщённый)
└── (детальные страницы — это prerendered HTML, не React)

website/src/App.jsx        ← добавить роуты /forum, /forum/:category
website/src/components/Navbar.jsx  ← ссылка «Форум»
```

## План реализации (по частям)

1. **Каркас генератора + одна категория (mods)** — `build-forum.cjs`, формат Markdown/HTML, дизайн-шаблон, один React-каталог с фильтрами. Smoke-тест на примерах.
2. **Остальные категории** — обобщить, завести заглушки контента.
3. **AI-пайплайн** — `ai-generate.cjs` + системный промпт + FreeQwenApi + первая сгенерённая статья.
4. **SEO-интеграция** — sitemap, JSON-LD, internal linking.
5. **Cron + авто-деплой** — расписание, пересборка.

## Edge cases / ограничения

- Если FreeQwenApi недоступен (localhost:3264 не отвечает) → скрипт логирует ошибку и выходит, НЕ ломая сайт.
- Если LLM вернул невалидный Markdown → пропускаем, пишем в лог, не коммитим мусор.
- Slug-коллизии → добавляем суффикс `-2`.
- Контент `ai/` помечен `ai_generated: true` — при желании можно показывать бейдж «AI» (необязательно).

## Безопасность

- AI-скрипт не имеет доступа к продакшен-данным, только читает/пишет `content/forum/ai/`.
- Markdown-рендер санитизируется (sanitize-html, уже есть зависимость на бэке) — никакой инъекции скриптов в prerendered HTML.
- Prerendered HTML — статика, не выполняет код.
