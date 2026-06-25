import React, { useState, useEffect, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Cube, BookOpen, Sparkle, PaintBrush, MapTrifold,
  Smiley, Sun, Stack, CaretLeft, MagnifyingGlass, X,
} from "@phosphor-icons/react";
import { API_URL } from "../../lib/api.js";

const ICONS = { Cube, BookOpen, Sparkle, PaintBrush, Map: MapTrifold, Smiley, Sun, Stack };

const INDEX_URL = "/forum/_index.json";

// Live-статьи (Redis) открываются SPA-роутом /forum/read/<slug>.
// Статичные (Markdown/prerendered) — прямым переходом на /forum/<cat>/<slug> (готовый SEO HTML).
const itemHref = (it) => it._live ? `/forum/read/${it.slug}` : `/forum/${it.category}/${it.slug}`;

export default function ForumCategory() {
  const { category } = useParams();
  const [index, setIndex] = useState(null);
  const [liveItems, setLiveItems] = useState([]);
  const [error, setError] = useState(false);

  const [q, setQ] = useState("");
  const [version, setVersion] = useState("");
  const [loader, setLoader] = useState("");
  const [activeTag, setActiveTag] = useState("");

  // Статичный индекс (Markdown-контент)
  useEffect(() => {
    fetch(INDEX_URL)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setIndex(d); else setError(true); })
      .catch(() => setError(true));
  }, []);

  // Живые статьи из API для текущей категории
  useEffect(() => {
    setLiveItems([]);
    fetch(`${API_URL}/forum/articles?category=${encodeURIComponent(category)}`)
      .then(r => r.ok ? r.json() : [])
      .then(items => setLiveItems((items || []).map(it => ({ ...it, _live: true }))))
      .catch(() => setLiveItems([]));
  }, [category]);

  const catMeta = index?.categories?.[category];
  // Склейка: живые сверху (свежее), потом статичные
  const staticItems = catMeta?.items || [];
  const allItems = [...liveItems, ...staticItems];

  // Производные списки фильтров из данных (склеенный список)
  const versions = useMemo(() => {
    const s = new Set(allItems.map(i => i.version).filter(Boolean));
    return [...s].sort();
  }, [allItems]);

  const loaders = useMemo(() => {
    const s = new Set();
    allItems.forEach(i => (i.loader || []).forEach(l => s.add(l)));
    return [...s];
  }, [allItems]);

  const tags = useMemo(() => {
    const s = new Set();
    allItems.forEach(i => (i.tags || []).forEach(t => s.add(t)));
    return [...s].sort();
  }, [allItems]);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return allItems.filter(it => {
      if (version && it.version !== version) return false;
      if (loader && !(it.loader || []).includes(loader)) return false;
      if (activeTag && !(it.tags || []).includes(activeTag)) return false;
      if (ql) {
        const hay = `${it.title} ${it.excerpt} ${(it.tags || []).join(" ")}`.toLowerCase();
        if (!hay.includes(ql)) return false;
      }
      return true;
    });
  }, [allItems, q, version, loader, activeTag]);

  const clearAll = () => { setQ(""); setVersion(""); setLoader(""); setActiveTag(""); };

  const hasFilters = q || version || loader || activeTag;

  return (
    <main style={{ background: "#000", minHeight: "100vh", color: "#fff", fontFamily: "inherit" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px 64px" }}>

        {/* Хлебные крошки + заголовок */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          style={{ marginBottom: 26 }}
        >
          <Link to="/forum" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 16, textDecoration: "none" }}>
            <CaretLeft size={13} weight="bold" /> Форум
          </Link>
          {catMeta ? (
            <>
              <h1 style={{ fontSize: "clamp(28px, 5vw, 40px)", fontWeight: 900, margin: "0 0 8px", letterSpacing: "0.01em" }}>{catMeta.title}</h1>
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 15, lineHeight: 1.55, margin: 0, maxWidth: 560 }}>{catMeta.desc}</p>
            </>
          ) : error ? (
            <h1 style={{ fontSize: 28, fontWeight: 800 }}>Категория не найдена</h1>
          ) : (
            <div style={{ height: 40 }} />
          )}
        </motion.div>

        {!catMeta && liveItems.length === 0 ? null : (
          <>
            {/* Панель фильтров */}
            <div style={{
              marginBottom: 24, padding: "16px 18px", borderRadius: 16,
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
              display: "flex", flexDirection: "column", gap: 14,
            }}>
              {/* Поиск */}
              <div style={{ position: "relative" }}>
                <MagnifyingGlass size={16} weight="bold" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.3)" }} />
                <input
                  value={q}
                  onChange={e => setQ(e.target.value)}
                  placeholder="Поиск по названию, описанию, тегам…"
                  style={{
                    width: "100%", padding: "12px 14px 12px 40px", borderRadius: 11,
                    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                    color: "#fff", fontSize: 14, fontFamily: "inherit", outline: "none",
                  }}
                />
              </div>

              {/* Селекты */}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {versions.length > 0 && (
                  <Select value={version} onChange={setVersion} placeholder="Версия MC" options={versions} />
                )}
                {loaders.length > 0 && (
                  <Select value={loader} onChange={setLoader} placeholder="Модлоадер" options={loaders} />
                )}
                {tags.length > 0 && (
                  <Select value={activeTag} onChange={setActiveTag} placeholder="Тег" options={tags} />
                )}
                {hasFilters && (
                  <button onClick={clearAll} style={{
                    display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 14px", borderRadius: 11,
                    background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)",
                    fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                  }}>
                    <X size={14} weight="bold" /> Сбросить
                  </button>
                )}
              </div>
            </div>

            {/* Счётчик */}
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", margin: "0 0 16px" }}>
              Найдено: <strong style={{ color: "rgba(255,255,255,0.7)" }}>{filtered.length}</strong>
            </p>

            {/* Сетка карточек */}
            {filtered.length === 0 ? (
              <div style={{ padding: "48px", textAlign: "center", color: "rgba(255,255,255,0.35)", borderRadius: 16, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                Ничего не найдено. Попробуйте сбросить фильтры.
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
                {filtered.map((it, i) => (
                  <motion.a
                    key={it.slug}
                    href={itemHref(it)}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.03 * i }}
                    style={{
                      display: "flex", flexDirection: "column", borderRadius: 16, overflow: "hidden",
                      textDecoration: "none", color: "#fff",
                      background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
                      transition: "border-color 0.15s, transform 0.15s",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(96,165,250,0.3)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; e.currentTarget.style.transform = "none"; }}
                  >
                    {/* превью */}
                    <div style={{
                      height: 150, position: "relative", overflow: "hidden",
                      background: it.image
                        ? `linear-gradient(to top, rgba(0,0,0,0.6), rgba(0,0,0,0.1)), url('${it.image}') center/cover`
                        : "linear-gradient(135deg, rgba(96,165,250,0.15), rgba(0,0,0,0.3))",
                    }}>
                      <div style={{ position: "absolute", bottom: 10, left: 12, display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {it.version && <Chip>MC {it.version}</Chip>}
                        {(it.loader || []).slice(0, 1).map(l => <Chip key={l} accent>{l}</Chip>)}
                      </div>
                    </div>
                    {/* контент */}
                    <div style={{ padding: "16px 18px", flex: 1, display: "flex", flexDirection: "column" }}>
                      <h3 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 8px", lineHeight: 1.35 }}>{it.title}</h3>
                      <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", lineHeight: 1.5, margin: "0 0 12px", flex: 1 }}>
                        {it.excerpt}
                      </p>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {(it.tags || []).slice(0, 3).map(t => (
                          <span key={t} style={{ fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 6, background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.45)" }}>{t}</span>
                        ))}
                      </div>
                    </div>
                  </motion.a>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function Select({ value, onChange, placeholder, options }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        padding: "10px 14px", borderRadius: 11, fontFamily: "inherit", fontSize: 13, fontWeight: 600,
        background: "rgba(255,255,255,0.04)", border: `1px solid ${value ? "rgba(96,165,250,0.35)" : "rgba(255,255,255,0.08)"}`,
        color: value ? "#fff" : "rgba(255,255,255,0.5)", outline: "none", cursor: "pointer",
      }}
    >
      <option value="">{placeholder}</option>
      {options.map(o => <option key={o} value={o} style={{ background: "#0a0a0e" }}>{o}</option>)}
    </select>
  );
}

function Chip({ children, accent }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase",
      padding: "3px 8px", borderRadius: 6, color: accent ? "#60a5fa" : "rgba(255,255,255,0.8)",
      background: accent ? "rgba(96,165,250,0.18)" : "rgba(0,0,0,0.45)",
      border: accent ? "1px solid rgba(96,165,250,0.3)" : "1px solid rgba(255,255,255,0.1)",
    }}>{children}</span>
  );
}
