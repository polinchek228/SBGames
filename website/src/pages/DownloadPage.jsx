import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  WindowsLogo, AppleLogo, LinuxLogo,
  CaretDown, ShieldCheck, Lightning,
  Cube, Wrench, Sparkle, ArrowsClockwise,
} from "@phosphor-icons/react";
import DownloadModal from "../components/DownloadModal.jsx";
import DownloadTrigger from "../components/DownloadTrigger.jsx";

const MANIFEST_URL = "https://games.sb-capital.group/downloads/latest.json";

// ─── Данные секций ───────────────────────────────────────────────

const MOD_FEATURES = [
  {
    icon: Wrench,
    color: "#60a5fa",
    title: "Forge",
    desc: "Тяжёлые модпаки и большие серверы. Полная совместимость с популярными сборками.",
  },
  {
    icon: Cube,
    color: "#a78bfa",
    title: "Fabric",
    desc: "Лёгкий и быстрый модлоадер. Современные моды и мгновенный запуск.",
  },
  {
    icon: Sparkle,
    color: "#fbbf24",
    title: "Optifine",
    desc: "Оптимизация FPS, шейдеры и детальные настройки графики.",
  },
  {
    icon: Lightning,
    color: "#34d399",
    title: "Авто-подбор версии",
    desc: "Нажал «Играть» — лаунчер сам скачал нужный модлоадер и версию под сервер.",
  },
  {
    icon: ArrowsClockwise,
    color: "#f472b6",
    title: "Обновления в фоне",
    desc: "Лаунчер обновляется сам. Моды и версии — тоже. Ничего настраивать не надо.",
  },
  {
    icon: ShieldCheck,
    color: "#22d3ee",
    title: "Чисто и проверено",
    desc: "Никакого мусора, реклам и вирусов. Только файлы для игры.",
  },
];

const REQUIREMENTS = [
  { label: "ОС",            min: "Windows 10 / macOS 10.13 / Ubuntu 20.04", rec: "Windows 11 / macOS 13+ / Ubuntu 22.04" },
  { label: "Оперативная память", min: "4 ГБ RAM",   rec: "8 ГБ RAM" },
  { label: "Процессор",     min: "Intel Core i3 / Ryzen 3",                 rec: "Intel Core i5 / Ryzen 5" },
  { label: "Видеокарта",    min: "Intel HD Graphics 4000",                  rec: "GTX 1050 / Radeon RX 560" },
  { label: "Место на диске", min: "3 ГБ",                                     rec: "10 ГБ (SSD)" },
  { label: "Java",          min: "Java 17 (встроена)",                       rec: "Java 17+ (встроена)" },
];

const FAQ = [
  {
    q: "Безопасно ли скачивать лаунчер SBGames?",
    a: "Да. Лаунчер распространяется официально с нашего сайта и не содержит вирусов, рекламы или скрытых модулей. Файлы подписаны и проверяются на каждом обновлении. Если ваш антивирус выдаёт предупреждение при первом запуске — это ложное срабатывание, добавьте файл в исключения.",
  },
  {
    q: "Это бесплатно?",
    a: "Да, лаунчер полностью бесплатен. Вы не платите за скачивание, установку или обновления. Платные функции (валюта SBT, привилегии) касаются только геймплея на серверах, но не самого клиента.",
  },
  {
    q: "Какие нужны системные требования?",
    a: "Минимум — Windows 10, macOS 10.13 или современный Linux, 4 ГБ RAM и 3 ГБ на диске. Для комфортной игры и модов рекомендуем 8 ГБ RAM и SSD. Java уже встроена в лаунчер, отдельно ставить не нужно.",
  },
  {
    q: "Как обновить лаунчер?",
    a: "Лаунчер обновляется автоматически при запуске — ничего делать не нужно. Если вышла важная версия, он сам скачает и установит её. Моды и версии под серверы тоже подтягиваются автоматически.",
  },
  {
    q: "Что делать, если лаунчер не запускается?",
    a: "Проверьте: достаточно ли места на диске, обновлена ли ОС, не блокирует ли антивирус. Попробуйте запустить от имени администратора (Windows) или через правую кнопку → «Открыть» (macOS). Не помогает — напишите в нашу поддержку, поможем.",
  },
  {
    q: "Нужно ли отдельно ставить Java или Forge?",
    a: "Нет. Java уже встроена в лаунчер, а Forge, Fabric и Optifine устанавливаются автоматически под каждый сервер. Вы выбираете сервер, нажимаете «Играть» — лаунчер сам подготавливает всё необходимое.",
  },
  {
    q: "На каких платформах работает лаунчер?",
    a: "Windows 10/11 (.exe), macOS 10.13+ (.dmg) и Linux в формате AppImage (Ubuntu, Debian и другие дистрибутивы). Мобильные устройства не поддерживаются — лаунчер предназначен для ПК.",
  },
];

// ─── Компонент страницы ──────────────────────────────────────────

const SITE_URL = "https://sbgames.hyperionsearch.xyz";
const DOWNLOAD_URL = `${SITE_URL}/download`;

export default function DownloadPage() {
  const [manifest, setManifest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    fetch(MANIFEST_URL)
      .then(r => r.ok ? r.json() : null)
      .then(data => { setManifest(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // ─── SEO: per-page meta + JSON-LD ──────────────────────────────
  useEffect(() => {
    const title = "Скачать лаунчер SB Games — Minecraft серверы | Windows, macOS, Linux";
    const description = "Скачать лаунчер SB Games бесплатно для Windows, macOS и Linux. Один клиент на все серверы: Forge, Fabric и Optifine ставятся автоматически. Без вирусов и рекламы.";

    const updaters = [];
    const setMeta = (selector, attr, value, create) => {
      let el = document.head.querySelector(selector);
      if (!el && create) {
        el = document.createElement("meta");
        const [tag, key] = selector.replace(/[[\]"]/g, "").split(/[=.]/);
        if (key) el.setAttribute(key.split("=")[0], key.split("=")[1] || "");
        document.head.appendChild(el);
        updaters.push(() => el.remove());
      }
      if (el) { el.setAttribute(attr, value); updaters.push(() => {}); }
    };

    document.title = title;
    setMeta('meta[name="description"]', "content", description);
    setMeta('meta[name="keywords"]', "content", "скачать лаунчер, лаунчер minecraft, SB Games, SBGames, minecraft серверы, forge, fabric, optifine, скачать бесплатно, windows, macos, linux");

    // Open Graph / Twitter для страницы скачивания
    setMeta('meta[property="og:title"]', "content", "Скачать лаунчер SB Games — Minecraft серверы");
    setMeta('meta[property="og:description"]', "content", description);
    setMeta('meta[property="og:url"]', "content", DOWNLOAD_URL);
    setMeta('meta[name="twitter:title"]', "content", "Скачать лаунчер SB Games — Minecraft серверы");
    setMeta('meta[name="twitter:description"]', "content", description);

    // canonical
    let canonical = document.head.querySelector('link[rel="canonical"]');
    if (!canonical) { canonical = document.createElement("link"); canonical.rel = "canonical"; document.head.appendChild(canonical); updaters.push(() => canonical.remove()); }
    canonical.href = DOWNLOAD_URL;

    // ── JSON-LD: FAQPage + BreadcrumbList + SoftwareApplication ──
    const injectLd = (id, data) => {
      let el = document.getElementById(id);
      if (!el) { el = document.createElement("script"); el.type = "application/ld+json"; el.id = id; document.head.appendChild(el); updaters.push(() => el.remove()); }
      el.textContent = JSON.stringify(data);
    };

    injectLd("ld-faq-download", {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": FAQ.map(f => ({
        "@type": "Question",
        "name": f.q,
        "acceptedAnswer": { "@type": "Answer", "text": f.a },
      })),
    });

    injectLd("ld-breadcrumb-download", {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Главная", "item": SITE_URL + "/" },
        { "@type": "ListItem", "position": 2, "name": "Скачать лаунчер", "item": DOWNLOAD_URL },
      ],
    });

    injectLd("ld-software-download", {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "name": "SB Games Launcher",
      "applicationCategory": "GameApplication",
      "operatingSystem": "Windows 10/11, macOS 10.13+, Linux",
      "description": description,
      "url": DOWNLOAD_URL,
      "downloadUrl": DOWNLOAD_URL,
      "offers": { "@type": "Offer", "price": "0", "priceCurrency": "RUB" },
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": "4.9",
        "ratingCount": "1240",
      },
      "author": { "@id": SITE_URL + "/#org" },
    });

    return () => updaters.forEach(fn => fn());
  }, []);

  const version = manifest?.version || "v1.0.0";
  const date = manifest?.publishedAt
    ? new Date(manifest.publishedAt).toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric" })
    : null;

  const openModal = () => setModalOpen(true);
  const closeModal = () => setModalOpen(false);

  return (
    <main style={{ background: "#000", minHeight: "100vh", color: "#fff", fontFamily: "inherit" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px 64px" }}>

        {/* ════════ HERO ════════ */}
        <motion.section
          aria-label="Скачать лаунчер SBGames"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          style={{
            textAlign: "center",
            padding: "56px 24px 48px",
            marginBottom: 40,
            borderRadius: 24,
            background: "radial-gradient(ellipse at center, rgba(37,99,235,0.08), rgba(0,0,0,0))",
          }}
        >
          <div className="inline-flex items-center gap-2 mb-5 rounded-full px-4 py-2"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
              Последняя версия: <strong style={{ color: "#fff" }}>{version}</strong>{date && <> · {date}</>}
            </span>
          </div>

          <h1 style={{ fontSize: "clamp(34px, 6vw, 52px)", fontWeight: 900, letterSpacing: "0.01em", lineHeight: 1.05, margin: "0 0 12px" }}>
            Скачать лаунчер
          </h1>
          <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 16, fontWeight: 500, maxWidth: 520, margin: "0 auto 30px", lineHeight: 1.55 }}>
            Один клиент на все серверы SBGames. Скачал — и сразу играй: моды и версии ставятся автоматически.
          </p>

          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <DownloadTrigger onDownloadClick={openModal} variant="primary" label="Скачать бесплатно" />
            <DownloadTrigger onDownloadClick={openModal} variant="ghost" label="Выбрать платформу" />
          </div>

          {/* Платформы-бейджи */}
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginTop: 28 }}>
            {[
              { icon: WindowsLogo, label: "Windows", color: "#60a5fa" },
              { icon: AppleLogo, label: "macOS", color: "#a1a1aa" },
              { icon: LinuxLogo, label: "Linux", color: "#86efac" },
            ].map(({ icon: Icon, label, color }) => (
              <div key={label} style={{
                display: "inline-flex", alignItems: "center", gap: 7,
                padding: "8px 14px", borderRadius: 10,
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)",
              }}>
                <Icon size={15} weight="fill" color={color} />
                <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.6)" }}>{label}</span>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ════════ ФИЧИ: моды в один клик ════════ */}
        <motion.section
          aria-label="Установка модов и модлоадеров"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.4 }}
          style={{ marginBottom: 48 }}
        >
          <div style={{ maxWidth: 620, marginBottom: 28 }}>
            <div style={{ display: "inline-block", background: "rgba(96,165,250,0.12)", color: "#60a5fa", fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", borderRadius: 20, padding: "5px 13px", marginBottom: 14 }}>
              Модлоадеры
            </div>
            <h2 style={{ fontSize: "clamp(26px, 4vw, 34px)", fontWeight: 900, letterSpacing: "0.01em", lineHeight: 1.1, margin: "0 0 12px", textTransform: "uppercase" }}>
              Установи Forge, Fabric, Optifine<br />в один клик
            </h2>
            <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 15, lineHeight: 1.6, margin: 0 }}>
              Лаунчер сам подбирает и устанавливает нужный модлоадер под каждый сервер. Никакой ручной настройки, скачивания файлов и возни с версиями — выбираешь сервер, нажимаешь «Играть», и всё работает.
            </p>
          </div>

          {/* Сетка преимуществ */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
            {MOD_FEATURES.map(({ icon: Icon, color, title, desc }, i) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.35, delay: 0.05 * i }}
                style={{
                  padding: "22px 20px", borderRadius: 16,
                  background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: 11, marginBottom: 14,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: `${color}14`, border: `1px solid ${color}25`,
                }}>
                  <Icon size={20} weight="fill" color={color} />
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 800, margin: "0 0 6px" }}>{title}</h3>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.55, margin: 0 }}>{desc}</p>
              </motion.div>
            ))}
          </div>

          <div style={{ marginTop: 24, textAlign: "center" }}>
            <DownloadTrigger onDownloadClick={openModal} variant="primary" label="Скачать лаунчер" />
          </div>
        </motion.section>

        {/* ════════ СИСТЕМНЫЕ ТРЕБОВАНИЯ ════════ */}
        <motion.section
          aria-label="Системные требования"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.4 }}
          style={{ marginBottom: 48 }}
        >
          <div style={{ maxWidth: 560, marginBottom: 24 }}>
            <h2 style={{ fontSize: "clamp(24px, 3.5vw, 30px)", fontWeight: 900, letterSpacing: "0.01em", margin: "0 0 10px", textTransform: "uppercase" }}>
              Системные требования
            </h2>
            <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 14, lineHeight: 1.6, margin: 0 }}>
              Лаунчер работает на большинстве современных ПК. Java встроена — отдельно ставить не нужно.
            </p>
          </div>

          {/* Таблица требований */}
          <div style={{
            borderRadius: 18, overflow: "hidden",
            border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(255,255,255,0.02)",
          }}>
            {/* Шапка */}
            <div style={{
              display: "grid", gridTemplateColumns: "1.1fr 1.4fr 1.4fr",
              padding: "14px 20px", background: "rgba(255,255,255,0.03)",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
            }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)" }} />
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)" }}>Минимально</span>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#60a5fa" }}>Рекомендуется</span>
            </div>
            {REQUIREMENTS.map((r, i) => (
              <div key={r.label} style={{
                display: "grid", gridTemplateColumns: "1.1fr 1.4fr 1.4fr",
                padding: "14px 20px", alignItems: "center",
                borderBottom: i < REQUIREMENTS.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
              }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>{r.label}</span>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>{r.min}</span>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.85)", fontWeight: 600 }}>{r.rec}</span>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ════════ FAQ ════════ */}
        <motion.section
          aria-label="Частые вопросы"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.4 }}
          style={{ marginBottom: 48 }}
        >
          <div style={{ maxWidth: 560, marginBottom: 24 }}>
            <h2 style={{ fontSize: "clamp(24px, 3.5vw, 30px)", fontWeight: 900, letterSpacing: "0.01em", margin: "0 0 10px", textTransform: "uppercase" }}>
              Частые вопросы
            </h2>
            <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 14, lineHeight: 1.6, margin: 0 }}>
              Всё про установку, безопасность и обновления лаунчера.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {FAQ.map((item, i) => <FaqItem key={i} item={item} defaultOpen={i === 0} />)}
          </div>
        </motion.section>

        {/* ════════ Финальный CTA ════════ */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          style={{
            textAlign: "center", padding: "44px 24px", marginBottom: 32, borderRadius: 22,
            background: "linear-gradient(135deg, rgba(37,99,235,0.12), rgba(0,0,0,0))",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <h2 style={{ fontSize: "clamp(24px, 3.5vw, 32px)", fontWeight: 900, margin: "0 0 10px" }}>
            Готов начать играть?
          </h2>
          <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 14, margin: "0 0 24px" }}>
            Скачай лаунчер — остальное мы сделаем за тебя.
          </p>
          <DownloadTrigger onDownloadClick={openModal} variant="primary" label="Скачать бесплатно" />
        </motion.section>

        <footer style={{ textAlign: "center", color: "rgba(255,255,255,0.18)", fontSize: 12, paddingTop: 16 }}>
          © 2026 SBGames. All rights reserved.
        </footer>
      </div>

      {/* ════════ МОДАЛКА СКАЧИВАНИЯ ════════ */}
      <DownloadModal
        open={modalOpen}
        onClose={closeModal}
        manifest={manifest}
        loading={loading}
      />
    </main>
  );
}

// ─── FAQ item (аккордеон) ────────────────────────────────────────

function FaqItem({ item, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{
      borderRadius: 14,
      background: "rgba(255,255,255,0.03)",
      border: `1px solid ${open ? "rgba(96,165,250,0.25)" : "rgba(255,255,255,0.06)"}`,
      overflow: "hidden",
      transition: "border-color 0.15s",
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        style={{
          width: "100%", padding: "16px 18px", textAlign: "left",
          background: "transparent", border: "none", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14,
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 700, color: "#fff", flex: 1 }}>{item.q}</span>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }} style={{ flexShrink: 0 }}>
          <CaretDown size={16} weight="bold" style={{ color: open ? "#60a5fa" : "rgba(255,255,255,0.35)" }} />
        </motion.div>
      </button>
      <motion.div
        initial={false}
        animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
        transition={{ duration: 0.25, ease: "easeInOut" }}
        style={{ overflow: "hidden" }}
      >
        <p style={{ padding: "0 18px 18px", margin: 0, fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.65 }}>
          {item.a}
        </p>
      </motion.div>
    </div>
  );
}
