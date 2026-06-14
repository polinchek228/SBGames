import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Star, Flame, Shield, Target, Swords, Crown, Zap, Award, Filter } from "lucide-react";
import { getUnlockedAchievements } from "./AchievementShowcase.jsx";

const CATEGORIES = {
  all:       { label: "Все",          color: "rgba(255,255,255,0.5)" },
  general:   { label: "Общие",        color: "#3b82f6" },
  social:    { label: "Социальные",   color: "#10b981" },
  servers:   { label: "Серверы",      color: "#6366f1" },
  store:     { label: "Магазин",      color: "#8b5cf6" },
  special:   { label: "Особые",       color: "#ef4444" },
};

const ACHIEVEMENTS = [
  { id: "first_join",      icon: Star,      color: "#3b82f6", name: "Первый вход",       desc: "Впервые зашёл на сервер",                category: "general",   xp: 10 },
  { id: "play_10h",        icon: Flame,     color: "#f59e0b", name: "Новичок",           desc: "Накопил 10 часов на сервере",            category: "general",   xp: 25 },
  { id: "play_50h",        icon: Flame,     color: "#f97316", name: "Завсегдатай",        desc: "50 часов на сервере",                   category: "general",   xp: 75 },
  { id: "play_100h",       icon: Flame,     color: "#ef4444", name: "Захватчик",          desc: "100 часов на сервере",                   category: "general",   xp: 150 },
  { id: "first_friend",    icon: Shield,    color: "#10b981", name: "Первый друг",        desc: "Добавил первого друга",                  category: "social",    xp: 15 },
  { id: "friends_5",       icon: Shield,    color: "#06b6d4", name: "Социальная бабочка", desc: "5 друзей в списке",                      category: "social",    xp: 40 },
  { id: "first_item",      icon: Award,     color: "#8b5cf6", name: "Коллекционер",       desc: "Получил первый предмет",                 category: "store",     xp: 20 },
  { id: "items_10",        icon: Award,     color: "#a855f7", name: "Скупщик",            desc: "10 предметов в инвентаре",               category: "store",     xp: 50 },
  { id: "admin",           icon: Crown,     color: "#ef4444", name: "Админ",              desc: "Получил роль администратора",            category: "special",   xp: 100 },
  { id: "skin_changed",    icon: Target,    color: "#ec4899", name: "Модник",             desc: "Сменил скин в лаунчере",                 category: "general",   xp: 15 },
  { id: "server_starwars", icon: Swords,    color: "#6366f1", name: "Звёздные войны",     desc: "Заходил на сервер STARWARS",             category: "servers",   xp: 30 },
  { id: "first_purchase",  icon: Zap,       color: "#eab308", name: "Первая покупка",     desc: "Купил первый предмет в каталоге",        category: "store",     xp: 20 },
  { id: "badge_collector", icon: Trophy,    color: "#d946ef", name: "Собиратель бейджей", desc: "3不同类型 бейджей в инвентаре",          category: "store",     xp: 45 },
  { id: "night_owl",       icon: Star,      color: "#64748b", name: "Сова",               desc: "Зашёл между 0:00 и 5:00",                category: "general",   xp: 10 },
  { id: "weekend_warrior", icon: Swords,    color: "#f43f5e", name: "Выходной воин",      desc: "Заиграл в выходные",                     category: "general",   xp: 15 },
  { id: "max_level",       icon: Crown,     color: "#fbbf24", name: "Максимум",           desc: "Достиг 100 уровня",                      category: "general",   xp: 200 },
];

function formatDate(id) {
  try {
    const dates = JSON.parse(localStorage.getItem("sbgames_achievement_dates") || "{}");
    if (dates[id]) return new Date(dates[id]).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
  } catch {}
  return null;
}

export default function AchievementSystem({ user }) {
  const [unlocked, setUnlocked] = useState(getUnlockedAchievements);
  const [activeCategory, setActiveCategory] = useState("all");
  const [expandedId, setExpandedId] = useState(null);

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

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.14em] font-semibold"
          style={{ color: "rgba(255,255,255,0.18)" }}>
          Система достижений
        </p>
        <div className="flex items-center gap-3">
          <span className="text-[10px] tabular-nums" style={{ color: "rgba(255,255,255,0.3)" }}>
            {totalUnlocked}/{ACHIEVEMENTS.length}
          </span>
          <span className="text-[10px] font-bold tabular-nums" style={{ color: "#f59e0b" }}>
            {totalXp} XP
          </span>
        </div>
      </div>

      {/* XP Progress bar */}
      <div className="flex items-center gap-2.5">
        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${maxXp ? (totalXp / maxXp) * 100 : 0}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="h-full rounded-full"
            style={{ background: "linear-gradient(90deg, #f59e0b, #fbbf24)" }}
          />
        </div>
        <span className="text-[9px] tabular-nums" style={{ color: "rgba(255,255,255,0.25)" }}>
          {Math.round((totalXp / maxXp) * 100) || 0}%
        </span>
      </div>

      {/* Category filter */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
        {Object.entries(CATEGORIES).map(([key, cat]) => (
          <button
            key={key}
            onClick={() => setActiveCategory(key)}
            className="px-3 py-1.5 rounded-lg text-[10px] font-semibold whitespace-nowrap transition-all duration-200 flex-shrink-0"
            style={{
              background: activeCategory === key ? (key === "all" ? "rgba(255,255,255,0.08)" : `${cat.color}18`) : "rgba(255,255,255,0.025)",
              color: activeCategory === key ? (key === "all" ? "rgba(255,255,255,0.75)" : cat.color) : "rgba(255,255,255,0.3)",
              border: activeCategory === key
                ? `1px solid ${key === "all" ? "rgba(255,255,255,0.08)" : `${cat.color}30`}`
                : "1px solid rgba(255,255,255,0.03)",
            }}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Achievements list */}
      <div className="flex flex-col gap-1.5">
        {filtered.map((ach, i) => {
          const Icon = ach.icon;
          const isUnlocked = unlockedSet.has(ach.id);
          const date = formatDate(ach.id);
          const isExpanded = expandedId === ach.id;
          const catInfo = CATEGORIES[ach.category];

          return (
            <motion.div
              key={ach.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03, type: "spring", stiffness: 400, damping: 26 }}
              onClick={() => setExpandedId(isExpanded ? null : ach.id)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200"
              style={{
                background: isUnlocked
                  ? `linear-gradient(135deg, ${ach.color}08, ${ach.color}03)`
                  : "rgba(255,255,255,0.02)",
                border: isUnlocked
                  ? `1px solid ${ach.color}18`
                  : "1px solid rgba(255,255,255,0.03)",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = isUnlocked ? `${ach.color}10` : "rgba(255,255,255,0.04)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = isUnlocked ? `linear-gradient(135deg, ${ach.color}08, ${ach.color}03)` : "rgba(255,255,255,0.02)"; }}
            >
              <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 relative"
                style={{ background: isUnlocked ? `${ach.color}15` : "rgba(255,255,255,0.04)" }}>
                <Icon size={16} style={{ color: isUnlocked ? ach.color : "rgba(255,255,255,0.12)" }} weight="fill" />
                {isUnlocked && (
                  <div className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full flex items-center justify-center"
                    style={{ background: ach.color, boxShadow: `0 0 6px ${ach.color}50` }}>
                    <svg width="6" height="6" viewBox="0 0 12 12">
                      <path d="M10 3L4.5 8.5L2 6" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[11px] font-bold truncate"
                    style={{ color: isUnlocked ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.3)" }}>
                    {ach.name}
                  </p>
                  <span className="text-[8px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                    style={{
                      background: isUnlocked ? `${catInfo.color}15` : "rgba(255,255,255,0.03)",
                      color: isUnlocked ? catInfo.color : "rgba(255,255,255,0.15)",
                    }}>
                    {catInfo.label}
                  </span>
                </div>
                <p className="text-[10px] truncate"
                  style={{ color: isUnlocked ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.12)" }}>
                  {ach.desc}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-[10px] font-bold tabular-nums"
                  style={{ color: isUnlocked ? "#f59e0b" : "rgba(255,255,255,0.1)" }}>
                  +{ach.xp} XP
                </span>
                {date && (
                  <span className="text-[9px] tabular-nums"
                    style={{ color: "rgba(255,255,255,0.2)" }}>
                    {date}
                  </span>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <p className="text-[11px] text-center py-4" style={{ color: "rgba(255,255,255,0.2)" }}>
          Нет достижений в этой категории
        </p>
      )}
    </div>
  );
}

export { ACHIEVEMENTS };
