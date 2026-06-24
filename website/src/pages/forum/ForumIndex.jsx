import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Cube, BookOpen, Sparkle, PaintBrush, MapTrifold,
  Smiley, Sun, Stack, CaretRight,
} from "@phosphor-icons/react";

const ICONS = {
  Cube, BookOpen, Sparkle, PaintBrush, Map: MapTrifold, Smiley, Sun, Stack,
};

const INDEX_URL = "/forum/_index.json";

export default function ForumIndex() {
  const [index, setIndex] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(INDEX_URL)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setIndex(d); else setError(true); })
      .catch(() => setError(true));
  }, []);

  // считаем счётчики (ai-категория скрыта из сетки, но тоже считаем для общей статистики)
  const cats = index ? Object.entries(index.categories).filter(([, c]) => !c.hidden) : [];
  const totalItems = index ? Object.values(index.categories).reduce((s, c) => s + (c.items?.length || 0), 0) : 0;

  return (
    <main style={{ background: "#000", minHeight: "100vh", color: "#fff", fontFamily: "inherit" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px 64px" }}>

        {/* HERO */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          style={{ marginBottom: 40 }}
        >
          <div style={{ display: "inline-block", background: "rgba(96,165,250,0.12)", color: "#60a5fa", fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", borderRadius: 20, padding: "5px 13px", marginBottom: 14 }}>
            Сообщество
          </div>
          <h1 style={{ fontSize: "clamp(34px, 6vw, 52px)", fontWeight: 900, letterSpacing: "0.01em", lineHeight: 1.05, margin: "0 0 12px" }}>
            Форум SB Games
          </h1>
          <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 16, lineHeight: 1.6, maxWidth: 560, margin: "0 0 6px" }}>
            Моды, текстуры, карты, скины, шейдеры и сборки для Minecraft. Плюс гайды и разборы обновлений.
          </p>
          {!error && index && (
            <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>
              {totalItems} материалов · {cats.length} категорий
            </p>
          )}
        </motion.section>

        {/* СЕТКА КАТЕГОРИЙ */}
        {error ? (
          <div style={{ padding: "40px", textAlign: "center", color: "rgba(255,255,255,0.4)", borderRadius: 16, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            Каталог скоро откроется. Загляните позже.
          </div>
        ) : !index ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
            <div style={{ width: 28, height: 28, border: "2px solid rgba(255,255,255,0.15)", borderTopColor: "#60a5fa", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
            {cats.map(([key, cat], i) => {
              const Icon = ICONS[cat.icon] || Cube;
              const count = cat.items?.length || 0;
              return (
                <motion.div
                  key={key}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.05 * i }}
                >
                  <Link
                    to={`/forum/${key}`}
                    style={{
                      display: "block", padding: "24px 22px", borderRadius: 18, textDecoration: "none", color: "#fff",
                      background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
                      height: "100%", transition: "border-color 0.15s, transform 0.15s",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(96,165,250,0.3)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; e.currentTarget.style.transform = "none"; }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(96,165,250,0.12)", border: "1px solid rgba(96,165,250,0.2)" }}>
                        <Icon size={22} weight="fill" color="#60a5fa" />
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.35)", letterSpacing: "0.06em" }}>
                        {count} {plural(count, ["материал", "материала", "материалов"])}
                      </span>
                    </div>
                    <h2 style={{ fontSize: 19, fontWeight: 800, margin: "0 0 6px" }}>{cat.title}</h2>
                    <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", lineHeight: 1.5, margin: "0 0 14px" }}>{cat.desc}</p>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "#60a5fa" }}>
                      Открыть <CaretRight size={13} weight="bold" />
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

function plural(n, forms) {
  const n10 = n % 10, n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return forms[0];
  if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return forms[1];
  return forms[2];
}
