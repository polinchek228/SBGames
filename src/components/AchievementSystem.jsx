import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getUnlockedAchievements } from "./AchievementShowcase.jsx";

const CATEGORIES = {
  all:     { label: "Все"         },
  general: { label: "Общие"       },
  social:  { label: "Социальные"  },
  servers: { label: "Серверы"     },
  store:   { label: "Магазин"     },
  special: { label: "Особые"      },
};

const ACHIEVEMENTS = [
  { id: "first_join",      symbol: "◈", color: "#3b82f6", name: "Первый вход",        desc: "Впервые зашёл на сервер",              category: "general",  xp: 10  },
  { id: "play_10h",        symbol: "◉", color: "#f59e0b", name: "Новичок",            desc: "Накопил 10 часов на сервере",          category: "general",  xp: 25  },
  { id: "play_50h",        symbol: "◉", color: "#f97316", name: "Завсегдатай",        desc: "50 часов на сервере",                  category: "general",  xp: 75  },
  { id: "play_100h",       symbol: "◉", color: "#ef4444", name: "Захватчик",          desc: "100 часов на сервере",                 category: "general",  xp: 150 },
  { id: "first_friend",    symbol: "◎", color: "#10b981", name: "Первый друг",        desc: "Добавил первого друга",                category: "social",   xp: 15  },
  { id: "friends_5",       symbol: "◎", color: "#06b6d4", name: "Социальная бабочка", desc: "5 друзей в списке",                    category: "social",   xp: 40  },
  { id: "first_item",      symbol: "◇", color: "#8b5cf6", name: "Коллекционер",       desc: "Получил первый предмет",               category: "store",    xp: 20  },
  { id: "items_10",        symbol: "◇", color: "#a855f7", name: "Скупщик",            desc: "10 предметов в инвентаре",             category: "store",    xp: 50  },
  { id: "admin",           symbol: "◆", color: "#ef4444", name: "Администратор",      desc: "Получил роль администратора",          category: "special",  xp: 100 },
  { id: "skin_changed",    symbol: "◈", color: "#ec4899", name: "Модник",             desc: "Сменил скин в лаунчере",               category: "general",  xp: 15  },
  { id: "server_starwars", symbol: "⬡", color: "#6366f1", name: "Звёздные войны",     desc: "Заходил на сервер STARWARS",           category: "servers",  xp: 30  },
  { id: "first_purchase",  symbol: "◈", color: "#eab308", name: "Первая покупка",     desc: "Купил первый предмет в каталоге",      category: "store",    xp: 20  },
  { id: "night_owl",       symbol: "◐", color: "#64748b", name: "Сова",               desc: "Зашёл между 0:00 и 5:00",              category: "general",  xp: 10  },
  { id: "weekend_warrior", symbol: "⬡", color: "#f43f5e", name: "Выходной воин",      desc: "Заиграл в выходные",                   category: "general",  xp: 15  },
  { id: "max_level",       symbol: "◆", color: "#fbbf24", name: "Максимум",           desc: "Достиг 100 уровня",                    category: "general",  xp: 200 },
];

function formatDate(id) {
  try {
    const dates = JSON.parse(localStorage.getItem("sbgames_achievement_dates") || "{}");
    if (dates[id]) return new Date(dates[id]).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
  } catch {}
  return null;
}

export default function AchievementSystem({ user }) {
  const [unlocked, setUnlocked] = useState(getUnlockedAchievements);
  const [activeCategory, setActiveCategory] = useState("all");

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === "sbgames_achievements") setUnlocked(getUnlockedAchievements());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const unlockedSet = new Set(unlocked);

  const filtered = useMemo(() => {
    if (activeCategory === "all") return ACHIEVEMENTS;
    return ACHIEVEMENTS.filter(a => a.category === activeCategory);
  }, [activeCategory]);

  const totalUnlocked = ACHIEVEMENTS.filter(a => unlockedSet.has(a.id)).length;
  const totalXp = ACHIEVEMENTS.filter(a => unlockedSet.has(a.id)).reduce((s, a) => s + a.xp, 0);
  const maxXp = ACHIEVEMENTS.reduce((s, a) => s + a.xp, 0);
  const progress = maxXp ? Math.round((totalXp / maxXp) * 100) : 0;

  return (
    <div className="flex flex-col gap-4">

      {/* ── Stats header ── */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <span className="text-[9px] uppercase tracking-[0.18em] font-bold"
            style={{ color: "rgba(255,255,255,0.55)" }}>Достижения</span>
          <span className="text-[20px] font-black text-white leading-none tabular-nums">
            {totalUnlocked}
            <span className="text-[13px] font-medium ml-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>
              /{ACHIEVEMENTS.length}
            </span>
          </span>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-[11px] font-black tabular-nums" style={{ color: "#f59e0b" }}>
            {totalXp} XP
          </span>
          <div className="flex items-center gap-1.5">
            <div className="w-28 h-[3px] rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.1)" }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                className="h-full rounded-full"
                style={{ background: "linear-gradient(90deg, #f59e0b, #fbbf24)" }}
              />
            </div>
            <span className="text-[9px] tabular-nums" style={{ color: "rgba(255,255,255,0.5)" }}>{progress}%</span>
          </div>
        </div>
      </div>

      {/* ── Category tabs ── */}
      <div className="flex gap-1 overflow-x-auto scrollbar-none">
        {Object.entries(CATEGORIES).map(([key, cat]) => {
          const active = activeCategory === key;
          return (
            <button
              key={key}
              onClick={() => setActiveCategory(key)}
              className="px-3 py-1.5 rounded-lg text-[10px] font-semibold whitespace-nowrap transition-all duration-150 flex-shrink-0"
              style={{
                background: active ? "rgba(255,255,255,0.12)" : "transparent",
                color: active ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.55)",
                border: active ? "1px solid rgba(255,255,255,0.15)" : "1px solid transparent",
              }}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* ── List ── */}
      <div className="flex flex-col gap-1">
        <AnimatePresence mode="popLayout">
          {filtered.map((ach, i) => {
            const isUnlocked = unlockedSet.has(ach.id);
            const date = formatDate(ach.id);

            return (
              <motion.div
                key={ach.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ delay: i * 0.025, duration: 0.18 }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150"
                style={{
                  background: isUnlocked ? `${ach.color}0a` : "rgba(255,255,255,0.04)",
                  border: isUnlocked ? `1px solid ${ach.color}20` : "1px solid rgba(255,255,255,0.08)",
                  opacity: isUnlocked ? 1 : 0.75,
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = isUnlocked ? `${ach.color}14` : "rgba(255,255,255,0.06)";
                  e.currentTarget.style.opacity = "1";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = isUnlocked ? `${ach.color}0a` : "rgba(255,255,255,0.04)";
                  e.currentTarget.style.opacity = isUnlocked ? "1" : "0.75";
                }}
              >
                {/* Symbol slot */}
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: isUnlocked ? `${ach.color}18` : "rgba(255,255,255,0.06)" }}>
                  <span className="text-[15px] leading-none select-none"
                    style={{
                      color: isUnlocked ? ach.color : "rgba(255,255,255,0.35)",
                      filter: isUnlocked ? `drop-shadow(0 0 5px ${ach.color}50)` : "none",
                    }}>
                    {isUnlocked ? ach.symbol : "·"}
                  </span>
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold leading-none mb-0.5 truncate"
                    style={{ color: isUnlocked ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.6)" }}>
                    {ach.name}
                  </p>
                  <p className="text-[9px] truncate"
                    style={{ color: isUnlocked ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.4)" }}>
                    {ach.desc}
                  </p>
                </div>

                {/* Right: XP + date */}
                <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                  <span className="text-[10px] font-black tabular-nums"
                    style={{ color: isUnlocked ? "#f59e0b" : "rgba(255,255,255,0.5)" }}>
                    +{ach.xp} XP
                  </span>
                  {date && (
                    <span className="text-[8px] tabular-nums" style={{ color: "rgba(255,255,255,0.45)" }}>
                      {date}
                    </span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {filtered.length === 0 && (
          <p className="text-[11px] text-center py-6" style={{ color: "rgba(255,255,255,0.4)" }}>
            Нет достижений
          </p>
        )}
      </div>
    </div>
  );
}

export { ACHIEVEMENTS };
