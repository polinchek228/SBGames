import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";

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
    <div className="flex flex-col gap-2.5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[9px] uppercase tracking-[0.18em] font-bold"
          style={{ color: "rgba(255,255,255,0.18)" }}>
          Витрина
        </span>
        <div className="flex items-center gap-2">
          <div className="w-20 h-[2px] rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${progress}%`, background: "rgba(255,255,255,0.3)" }} />
          </div>
          <span className="text-[9px] tabular-nums" style={{ color: "rgba(255,255,255,0.25)" }}>
            {totalUnlocked}/{ACHIEVEMENTS.length}
          </span>
        </div>
      </div>

      {/* 5 slots */}
      <div className="flex gap-2">
        {featured.map((ach, i) => {
          const isLocked = ach.locked;
          return (
            <motion.div
              key={ach.id}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05, type: "spring", stiffness: 400, damping: 22 }}
              whileHover={!isLocked ? { scale: 1.06, y: -2 } : {}}
              title={isLocked ? "???" : ach.name}
              className="flex-1 flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl relative overflow-hidden cursor-default"
              style={{
                background: isLocked ? "rgba(255,255,255,0.02)" : `${ach.color}0e`,
                border: isLocked ? "1px solid rgba(255,255,255,0.04)" : `1px solid ${ach.color}25`,
              }}
            >
              {!isLocked && (
                <div className="absolute top-0 left-0 right-0 h-px"
                  style={{ background: `linear-gradient(90deg, transparent, ${ach.color}70, transparent)` }} />
              )}
              <span className="text-[22px] leading-none select-none"
                style={{
                  color: isLocked ? "rgba(255,255,255,0.07)" : ach.color,
                  filter: !isLocked ? `drop-shadow(0 0 8px ${ach.color}55)` : "none",
                }}>
                {isLocked ? "·" : ach.symbol}
              </span>
              <span className="text-[8px] font-bold leading-none text-center w-full px-1 truncate"
                style={{ color: isLocked ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.4)" }}>
                {isLocked ? "???" : ach.name.split(" ")[0]}
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

export { ACHIEVEMENTS };
