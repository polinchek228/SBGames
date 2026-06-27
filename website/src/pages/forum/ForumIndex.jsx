import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Cube, BookOpen, Sparkle, PaintBrush, MapTrifold, Smiley, Sun, Stack, CaretRight, MagnifyingGlass } from "@phosphor-icons/react";

const ICONS = { Cube, BookOpen, Sparkle, PaintBrush, Map: MapTrifold, Smiley, Sun, Stack };
const ACCENT = "#3b82f6";
const INDEX_URL = "/forum/_index.json";

export default function ForumIndex() {
  const [index, setIndex] = useState(null);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetch(INDEX_URL).then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setIndex(d); else setError(true); })
      .catch(() => setError(true));
  }, []);

  const cats = index ? Object.entries(index.categories).filter(([, c]) => !c.hidden) : [];
  const totalItems = index ? Object.values(index.categories).reduce((s, c) => s + (c.items?.length || 0), 0) : 0;

  const allItems = useMemo(() => index
    ? Object.entries(index.categories).filter(([, c]) => !c.hidden)
        .flatMap(([key, c]) => (c.items || []).map(it => ({ ...it, _cat: key, _catTitle: c.title })))
    : [], [index]);
  const latest = useMemo(() => [...allItems]
    .sort((a, b) => new Date(b.date || b.updated || 0) - new Date(a.date || a.updated || 0))
    .slice(0, 8), [allItems]);

  const q = query.trim().toLowerCase();
  const results = q ? allItems.filter(it =>
    (it.title || "").toLowerCase().includes(q) ||
    (it.excerpt || "").toLowerCase().includes(q) ||
    (it._catTitle || "").toLowerCase().includes(q)).slice(0, 24) : [];

  const glass = {
    background: "linear-gradient(180deg, #0d0e12, #0a0b0e)",
    border: "1px solid rgba(255,255,255,0.06)",
  };

  return (
    <main style={{ background: "#070709", minHeight: "100vh", color: "#fff", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "relative", maxWidth: 1500, margin: "0 auto", padding: "32px 32px 80px" }}>

        {/* ===== HEADER ===== */}
        <header style={{ padding: "8px 0 26px", borderBottom: "1px solid rgba(255,255,255,0.08)", marginBottom: 32 }}>
          <h1 style={{ fontSize: "clamp(26px, 3.5vw, 38px)", fontWeight: 800, letterSpacing: "-0.02em", margin: "0 0 10px" }}>
            Форум SBGames
          </h1>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 15, lineHeight: 1.55, margin: "0 0 22px", maxWidth: 660 }}>
            Гайды по модам, текстурам, картам, скинам, шейдерам и сборкам Minecraft. Свежие материалы каждый день.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
            <div style={{ position: "relative", flex: "1 1 300px", maxWidth: 440 }}>
              <MagnifyingGlass size={18} weight="bold" color="rgba(255,255,255,0.35)" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
              <input
                value={query} onChange={e => setQuery(e.target.value)}
                placeholder="Поиск по статьям…"
                style={{ width: "100%", boxSizing: "border-box", padding: "11px 14px 11px 40px", fontSize: 14, color: "#fff", borderRadius: 10, outline: "none", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)" }}
                onFocus={e => e.target.style.borderColor = "rgba(59,130,246,0.6)"}
                onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.12)"}
              />
            </div>
            {!error && index && (
              <div style={{ display: "flex", gap: 22, color: "rgba(255,255,255,0.45)", fontSize: 13.5 }}>
                <span><b style={{ color: "#fff", fontWeight: 700 }}>{totalItems}</b> материалов</span>
                <span><b style={{ color: "#fff", fontWeight: 700 }}>{cats.length}</b> категорий</span>
              </div>
            )}
          </div>
        </header>

        {/* ===== РЕЗУЛЬТАТЫ ПОИСКА ===== */}
        {q ? (
          <section>
            <SectionTitle>{results.length ? "Найдено: " + results.length : "Ничего не найдено"}</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
              {results.map((it, i) => <ArticleCard key={it._cat + "/" + it.slug} it={it} i={i} glass={glass} />)}
            </div>
          </section>
        ) : error ? (
          <div style={{ ...glass, padding: 48, textAlign: "center", color: "rgba(255,255,255,0.4)", borderRadius: 18 }}>
            Каталог скоро откроется. Загляните позже.
          </div>
        ) : !index ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
            <div style={{ width: 28, height: 28, border: "2px solid rgba(255,255,255,0.12)", borderTopColor: ACCENT, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          </div>
        ) : (
          <>
            <SectionTitle>Категории</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 14 }}>
              {cats.map(([key, cat], i) => {
                const Icon = ICONS[cat.icon] || Cube;
                const count = cat.items?.length || 0;
                return (
                  <motion.div key={key} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.04 * i }}>
                    <Link to={"/forum/" + key}
                      style={{ position: "relative", overflow: "hidden", display: "block", padding: "24px 22px", borderRadius: 18, textDecoration: "none", color: "#fff", height: "100%", ...glass, transition: "transform 0.18s, border-color 0.18s, background 0.18s" }}
                      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.borderColor = "rgba(59,130,246,0.5)"; e.currentTarget.style.background = "rgba(59,130,246,0.06)"; }}
                      onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                        <div style={{ width: 50, height: 50, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.25)" }}>
                          <Icon size={25} weight="duotone" color={ACCENT} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.5)", background: "rgba(255,255,255,0.05)", borderRadius: 20, padding: "4px 11px" }}>
                          {count} {plural(count, ["материал", "материала", "материалов"])}
                        </span>
                      </div>
                      <h3 style={{ fontSize: 19, fontWeight: 800, margin: "0 0 6px" }}>{cat.title}</h3>
                      <p style={{ fontSize: 13.5, color: "rgba(255,255,255,0.45)", lineHeight: 1.5, margin: "0 0 16px" }}>{cat.desc}</p>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: ACCENT }}>
                        Открыть <CaretRight size={14} weight="bold" />
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </div>

            {latest.length > 0 && (
              <section style={{ marginTop: 44 }}>
                <SectionTitle>Свежие материалы</SectionTitle>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
                  {latest.map((it, i) => <ArticleCard key={it._cat + "/" + it.slug} it={it} i={i} glass={glass} />)}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function SectionTitle({ children, noMargin }) {
  return <h2 style={{ fontSize: 22, fontWeight: 800, margin: noMargin ? 0 : "0 0 20px", letterSpacing: "-0.01em" }}>{children}</h2>;
}

function Stat({ value, label }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 26, fontWeight: 900, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
    </div>
  );
}

function ArticleCard({ it, i, glass }) {
  const d = it.date || it.updated;
  const dateStr = d ? new Date(d).toLocaleDateString("ru-RU", { day: "numeric", month: "short" }) : "";
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, delay: 0.03 * (i || 0) }}>
      <Link to={"/forum/" + it._cat + "/" + it.slug}
        style={{ display: "flex", flexDirection: "column", height: "100%", padding: "18px", borderRadius: 16, textDecoration: "none", color: "#fff", ...glass, transition: "transform 0.16s, border-color 0.16s" }}
        onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.borderColor = "rgba(59,130,246,0.45)"; }}
        onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <span style={{ width: 6, height: 6, borderRadius: 2, background: ACCENT }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: "0.05em", textTransform: "uppercase" }}>{it._catTitle}</span>
        </div>
        <h3 style={{ fontSize: 15.5, fontWeight: 700, lineHeight: 1.35, margin: "0 0 8px", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{it.title}</h3>
        {it.excerpt && <p style={{ fontSize: 12.5, color: "rgba(255,255,255,0.42)", lineHeight: 1.5, margin: "0 0 12px", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{it.excerpt}</p>}
        <div style={{ marginTop: "auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {dateStr && <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{dateStr}</span>}
          <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: ACCENT }}>Читать <CaretRight size={11} weight="bold" /></span>
        </div>
      </Link>
    </motion.div>
  );
}

function plural(n, forms) {
  const n10 = n % 10, n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return forms[0];
  if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return forms[1];
  return forms[2];
}