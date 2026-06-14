import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Trophy, Star, Flame, Shield, Target, Swords, Crown, Zap, Award } from "lucide-react";

const ACHIEVEMENTS = [
  { id: "first_join",      icon: Star,      color: "#3b82f6", name: "Первый вход",       desc: "Впервые зашёл на сервер",               category: "general" },
  { id: "play_10h",        icon: Flame,     color: "#f59e0b", name: "Новичок",           desc: "Накопил 10 часов на сервере",            category: "general" },
  { id: "play_50h",        icon: Flame,     color: "#f97316", name: "Завсегдатай",        desc: "Накопил 50 часов на сервере",            category: "general" },
  { id: "play_100h",       icon: Flame,     color: "#ef4444", name: "Захватчик",          desc: "100 часов на сервере",                   category: "general" },
  { id: "first_friend",    icon: Shield,    color: "#10b981", name: "Первый друг",        desc: "Добавил первого друга",                  category: "social" },
  { id: "friends_5",       icon: Shield,    color: "#06b6d4", name: "Социальная бабочка", desc: "5 друзей в списке",                      category: "social" },
  { id: "first_item",      icon: Award,     color: "#8b5cf6", name: "Коллекционер",       desc: "Получил первый предмет",                 category: "store" },
  { id: "items_10",        icon: Award,     color: "#a855f7", name: "Скупщик",            desc: "10 предметов в инвентаре",               category: "store" },
  { id: "admin",           icon: Crown,     color: "#ef4444", name: "Админ",              desc: "Получил роль администратора",            category: "special" },
  { id: "skin_changed",    icon: Target,    color: "#ec4899", name: "Модник",             desc: "Сменил скин в лаунчере",                 category: "general" },
  { id: "server_starwars", icon: Swords,    color: "#6366f1", name: "Звёздные войны",     desc: "Заходил на сервер STARWARS",             category: "servers" },
  { id: "first_purchase",  icon: Zap,       color: "#eab308", name: "Первая покупка",     desc: "Купил первый предмет в каталоге",        category: "store" },
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

function formatDate(id) {
  try {
    const dates = JSON.parse(localStorage.getItem("sbgames_achievement_dates") || "{}");
    if (dates[id]) return new Date(dates[id]).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
  } catch {}
  return "";
}

function trackDate(id) {
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

  const featured = ACHIEVEMENTS.filter(a => unlockedSet.has(a.id)).slice(0, 5);
  while (featured.length < 5) {
    const locked = ACHIEVEMENTS.find(a => !unlockedSet.has(a.id) && !featured.some(f => f.id === a.id));
    if (!locked) break;
    featured.push({ ...locked, locked: true });
  }

  const totalUnlocked = ACHIEVEMENTS.filter(a => unlockedSet.has(a.id)).length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.14em] font-semibold"
          style={{ color: "rgba(255,255,255,0.18)" }}>
          Витрина достижений
        </p>
        <span className="text-[10px] tabular-nums" style={{ color: "rgba(255,255,255,0.3)" }}>
          {totalUnlocked}/{ACHIEVEMENTS.length}
        </span>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none">
        {featured.map((ach, i) => {
          const Icon = ach.icon;
          const isLocked = ach.locked;
          return (
            <motion.div
              key={ach.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07, type: "spring", stiffness: 350, damping: 24 }}
              whileHover={{ y: -3, scale: 1.03 }}
              className="flex-1 min-w-[130px] max-w-[170px] flex flex-col items-center text-center px-3 py-3.5 rounded-xl flex-shrink-0 relative overflow-hidden"
              style={{
                background: isLocked
                  ? "rgba(255,255,255,0.04)"
                  : `linear-gradient(160deg, ${ach.color}18, ${ach.color}08)`,
                border: isLocked
                  ? "1.5px solid rgba(255,255,255,0.06)"
                  : `1.5px solid ${ach.color}35`,
                boxShadow: isLocked ? "none" : `0 0 16px ${ach.color}10`,
              }}
            >
              {!isLocked && (
                <div className="absolute top-0 left-0 right-0 h-[2px]"
                  style={{ background: `linear-gradient(90deg, transparent, ${ach.color}, transparent)` }} />
              )}

              <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-2 relative"
                style={{
                  background: isLocked ? "rgba(255,255,255,0.05)" : `${ach.color}20`,
                  border: isLocked ? "none" : `1px solid ${ach.color}20`,
                }}>
                <Icon size={18} style={{ color: isLocked ? "rgba(255,255,255,0.15)" : ach.color }} weight="fill" />
                {!isLocked && (
                  <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center"
                    style={{ background: ach.color, boxShadow: `0 0 8px ${ach.color}50` }}>
                    <svg width="7" height="7" viewBox="0 0 12 12" fill="white">
                      <path d="M10 3L4.5 8.5L2 6" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                )}
              </div>

              <p className="text-[11px] font-bold leading-tight mb-0.5"
                style={{ color: isLocked ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.85)" }}>
                {ach.name}
              </p>
              <p className="text-[9px] leading-tight"
                style={{ color: isLocked ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.35)" }}>
                {ach.desc}
              </p>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

export { ACHIEVEMENTS, trackDate };
