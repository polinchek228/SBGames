import React, { useState, useEffect } from "react";

const ACHIEVEMENTS = [
  { id: "first_join",      symbol: "◈", color: "#3b82f6", name: "Первый вход",        category: "general" },
  { id: "play_10h",        symbol: "◉", color: "#f59e0b", name: "Новичок",            category: "general" },
  { id: "play_50h",        symbol: "◉", color: "#f97316", name: "Завсегдатай",        category: "general" },
  { id: "play_100h",       symbol: "◉", color: "#ef4444", name: "Захватчик",          category: "general" },
  { id: "first_friend",    symbol: "◎", color: "#10b981", name: "Первый друг",        category: "social"  },
  { id: "friends_5",       symbol: "◎", color: "#06b6d4", name: "Социальная бабочка", category: "social"  },
  { id: "first_item",      symbol: "◇", color: "#8b5cf6", name: "Коллекционер",       category: "store"   },
  { id: "items_10",        symbol: "◇", color: "#a855f7", name: "Скупщик",            category: "store"   },
  { id: "admin",           symbol: "◆", color: "#ef4444", name: "Администратор",      category: "special" },
  { id: "skin_changed",    symbol: "◈", color: "#ec4899", name: "Модник",             category: "general" },
  { id: "server_starwars", symbol: "⬡", color: "#6366f1", name: "Звёздные войны",     category: "servers" },
  { id: "first_purchase",  symbol: "◈", color: "#eab308", name: "Первая покупка",     category: "store"   },
];

export function getUnlockedAchievements() {
  try { return JSON.parse(localStorage.getItem("sbgames_achievements") || "[]"); }
  catch { return []; }
}

export function unlockAchievement(id) {
  const list = getUnlockedAchievements();
  if (list.includes(id)) return false;
  list.push(id);
  localStorage.setItem("sbgames_achievements", JSON.stringify(list));
  return true;
}

export function trackDate(id) {
  try {
    const dates = JSON.parse(localStorage.getItem("sbgames_achievement_dates") || "{}");
    if (!dates[id]) { dates[id] = Date.now(); localStorage.setItem("sbgames_achievement_dates", JSON.stringify(dates)); }
  } catch {}
}

export default function AchievementShowcase({ user, equip, inventory }) {
  const [unlocked, setUnlocked] = useState(getUnlockedAchievements);

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === "sbgames_achievements") setUnlocked(getUnlockedAchievements());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const unlockedSet = new Set(unlocked);
  const totalUnlocked = ACHIEVEMENTS.filter(a => unlockedSet.has(a.id)).length;
  const progress = Math.round((totalUnlocked / ACHIEVEMENTS.length) * 100);

  // Show 5 slots: unlocked first, then locked placeholders
  const featured = [
    ...ACHIEVEMENTS.filter(a => unlockedSet.has(a.id)).slice(0, 5),
  ];
  while (featured.length < 5) {
    const locked = ACHIEVEMENTS.find(a => !unlockedSet.has(a.id) && !featured.some(f => f.id === a.id));
    if (!locked) break;
    featured.push({ ...locked, locked: true });
  }

  return (
    <div className="rounded-2xl p-5 flex flex-col gap-4"
      style={{
        background: "linear-gradient(135deg, rgba(255,255,255,0.045), rgba(255,255,255,0.015))",
        border: "1px solid rgba(255,255,255,0.1)",
        backdropFilter: "blur(16px)",
        boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.2)"
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-1 h-4 rounded-full" style={{ background: "#2563eb" }} />
          <span className="text-[10px] uppercase tracking-[0.16em] font-black"
            style={{ color: "rgba(255,255,255,0.55)" }}>
            Витрина достижений
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] tabular-nums font-bold" style={{ color: "rgba(255,255,255,0.5)" }}>
            {totalUnlocked}/{ACHIEVEMENTS.length}
          </span>
          <div className="w-24 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
            <div className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${progress}%`,
                background: "linear-gradient(90deg, #2563eb, #818cf8)",
                boxShadow: "0 0 8px rgba(37,99,235,0.5)"
              }} />
          </div>
        </div>
      </div>

      {/* 5 slots */}
      <div className="flex gap-2.5">
        {featured.map((ach, i) => {
          const isLocked = ach.locked;
          return (
            <div
              key={ach.id}
              title={isLocked ? "???" : ach.name}
              className={`flex-1 flex flex-col items-center justify-center gap-2 py-4 rounded-xl relative overflow-hidden cursor-default transition-all duration-200 ${!isLocked ? "hover:scale-[1.04] hover:-translate-y-0.5" : ""}`}
              style={{
                background: isLocked ? "rgba(255,255,255,0.03)" : `${ach.color}12`,
                border: isLocked ? "1px solid rgba(255,255,255,0.06)" : `1px solid ${ach.color}30`,
              }}
            >
              {!isLocked && (
                <div className="absolute top-0 left-0 right-0 h-px"
                  style={{ background: `linear-gradient(90deg, transparent, ${ach.color}80, transparent)` }} />
              )}
              {!isLocked && (
                <div className="absolute inset-0 pointer-events-none"
                  style={{ background: `radial-gradient(ellipse at 50% 0%, ${ach.color}15, transparent 70%)` }} />
              )}
              <span className="text-[26px] leading-none select-none"
                style={{
                  color: isLocked ? "rgba(255,255,255,0.12)" : ach.color,
                  filter: !isLocked ? `drop-shadow(0 0 10px ${ach.color}66)` : "none",
                }}>
                {isLocked ? "·" : ach.symbol}
              </span>
              <span className="text-[9px] font-bold leading-none text-center w-full px-1 truncate"
                style={{ color: isLocked ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.65)" }}>
                {isLocked ? "???" : ach.name.split(" ")[0]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { ACHIEVEMENTS };
