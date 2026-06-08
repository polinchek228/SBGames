import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Storefront, Shield, Sword, PawPrint, Sparkle,
  ShoppingCartSimple, Crown, Star, Lightning, Ghost,
  Skull, Flame, Wind, Diamond, Gift,
} from "@phosphor-icons/react";

const SERVERS = [
  { id: "all",      label: "Все",        color: null },
  { id: "starwars", label: "StarWars",   color: "#818cf8" },
  { id: "global",   label: "Глобальные", color: "#3b82f6" },
];

const CATEGORIES = [
  { id: "Все",     icon: Storefront },
  { id: "Броня",   icon: Shield },
  { id: "Оружие",  icon: Sword },
  { id: "Питомцы", icon: PawPrint },
  { id: "Эффекты", icon: Sparkle },
];

// Иконки для карточек
const ITEM_ICONS = {
  1: Crown,    // Мандалорская броня
  2: Sword,    // Световой меч
  3: Ghost,    // Голодранец-Дроид
  4: Wind,     // Тёмная Аура
  5: Star,     // VIP статус
  6: Lightning,// Молния-клинок
  7: Skull,    // Нагрудник Бездны
  8: Flame,    // Огненная аура (StarWars)
  9: Diamond,  // Кристалл силы
  10: Gift,    // Ивент-набор
};

const ITEMS = [
  // StarWars
  { id: 1,  name: "Мандалорская броня",  server: "starwars", category: "Броня",   price: 420, rarity: "legendary", desc: "Легендарная броня с джетпаком" },
  { id: 2,  name: "Световой меч",        server: "starwars", category: "Оружие",  price: 280, rarity: "epic",      desc: "Синий световой меч Ордена Джедаев" },
  { id: 3,  name: "Дроид-спутник",       server: "starwars", category: "Питомцы", price: 230, rarity: "rare",      desc: "Маленький дроид следует за тобой" },
  { id: 4,  name: "Аура Тёмной Силы",   server: "starwars", category: "Эффекты", price: 175, rarity: "rare",      desc: "Тёмная сторона Силы окутывает тебя" },
  { id: 8,  name: "Плащ Ситха",         server: "starwars", category: "Броня",   price: 190, rarity: "uncommon",  desc: "Тёмно-красный плащ с капюшоном" },
  // Global
  { id: 5,  name: "VIP Статус",          server: "global",   category: "Эффекты", price: 599, rarity: "legendary", desc: "VIP-бейдж и привилегии на всех серверах" },
  { id: 6,  name: "Молния-клинок",       server: "global",   category: "Оружие",  price: 165, rarity: "uncommon",  desc: "Электрический след за клинком" },
  { id: 7,  name: "Нагрудник Бездны",   server: "global",   category: "Броня",   price: 410, rarity: "legendary", desc: "Броня из фрагментов Бездны" },
  { id: 9,  name: "Кристалл Силы",      server: "global",   category: "Питомцы", price: 250, rarity: "epic",      desc: "Светящийся кристалл Кайбера" },
  { id: 10, name: "Ивент-набор",         server: "global",   category: "Эффекты", price: 99,  rarity: "uncommon",  desc: "Эксклюзивный набор сезонного события" },
];

const RARITY = {
  legendary: { label: "Легендарный", color: "#f59e0b", bg: "rgba(245,158,11,0.07)" },
  epic:      { label: "Эпический",   color: "#a855f7", bg: "rgba(168,85,247,0.07)" },
  rare:      { label: "Редкий",      color: "#3b82f6", bg: "rgba(59,130,246,0.07)" },
  uncommon:  { label: "Необычный",   color: "#22c55e", bg: "rgba(34,197,94,0.07)" },
};

export default function ShopPage() {
  const [server,   setServer]   = useState("all");
  const [category, setCategory] = useState("Все");
  const [cart,     setCart]     = useState(new Set());

  const filtered = ITEMS.filter(i =>
    (server   === "all" || i.server   === server) &&
    (category === "Все" || i.category === category)
  );

  const toggleCart = (id) => setCart(prev => {
    const s = new Set(prev);
    s.has(id) ? s.delete(id) : s.add(id);
    return s;
  });

  return (
    <div className="flex flex-col h-full bg-black overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-5 pb-3 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <Storefront size={19} weight="fill" className="text-white/60" />
          <div>
            <h1 className="text-[17px] font-display font-black tracking-tight text-white">Магазин</h1>
            <p className="text-[11px] text-white/25">Уникальные предметы и косметика</p>
          </div>
        </div>
        <AnimatePresence>
          {cart.size > 0 && (
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }}
              className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 cursor-pointer"
              style={{ background: "rgba(37,99,235,0.15)", color: "#93c5fd" }}
            >
              <ShoppingCartSimple size={13} weight="fill" />
              <span className="text-[11px] font-bold">{cart.size}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Server tabs */}
      <div className="flex items-center gap-1 px-6 pb-2 flex-shrink-0">
        {SERVERS.map(s => (
          <button key={s.id} onClick={() => setServer(s.id)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-150"
            style={server === s.id
              ? { background: s.color ? `${s.color}18` : "rgba(255,255,255,0.09)", color: s.color || "#fff" }
              : { color: "rgba(255,255,255,0.28)" }
            }
          >
            {s.color && <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />}
            {s.label}
          </button>
        ))}
      </div>

      {/* Category tabs */}
      <div className="flex items-center gap-1 px-6 pb-4 flex-shrink-0">
        {CATEGORIES.map(({ id, icon: Icon }) => (
          <button key={id} onClick={() => setCategory(id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-150"
            style={category === id
              ? { background: "rgba(255,255,255,0.08)", color: "#fff" }
              : { color: "rgba(255,255,255,0.25)" }
            }
          >
            <Icon size={12} weight={category === id ? "fill" : "regular"} />
            {id}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-6 pb-6 min-h-0">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Storefront size={28} style={{ color: "rgba(255,255,255,0.08)" }} />
            <p className="text-[12px]" style={{ color: "rgba(255,255,255,0.2)" }}>Нет предметов</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3 auto-rows-max">
            {filtered.map((item, i) => {
              const r = RARITY[item.rarity];
              const inCart = cart.has(item.id);
              const ItemIcon = ITEM_ICONS[item.id] || Diamond;
              const srvColor = SERVERS.find(s => s.id === item.server)?.color;
              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04, layout: { duration: 0.2 } }}
                  className="flex flex-col rounded-2xl overflow-hidden"
                  style={{ background: r.bg }}
                >
                  {/* Rarity bar */}
                  <div className="h-[2px] flex-shrink-0"
                    style={{ background: `linear-gradient(90deg, transparent, ${r.color}60, transparent)` }}
                  />

                  <div className="p-4 flex flex-col gap-3 flex-1">
                    {/* Icon + rarity badge */}
                    <div className="flex items-start justify-between">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: `${r.color}18` }}
                      >
                        <ItemIcon size={20} weight="fill" style={{ color: r.color }} />
                      </div>
                      <span className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-lg"
                        style={{ color: r.color, background: `${r.color}15` }}
                      >
                        {r.label.toUpperCase()}
                      </span>
                    </div>

                    {/* Server badge if "all" tab */}
                    {server === "all" && srvColor && (
                      <span className="self-start text-[8px] font-bold tracking-widest px-1.5 py-0.5 rounded-md uppercase"
                        style={{ color: srvColor, background: `${srvColor}18` }}
                      >
                        {SERVERS.find(s => s.id === item.server)?.label}
                      </span>
                    )}

                    {/* Name + desc */}
                    <div>
                      <p className="text-[13px] font-bold text-white leading-tight">{item.name}</p>
                      <p className="text-[10px] mt-1 leading-relaxed" style={{ color: "rgba(255,255,255,0.35)" }}>
                        {item.desc}
                      </p>
                    </div>

                    {/* Price + buy */}
                    <div className="flex items-center justify-between mt-auto pt-2"
                      style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
                    >
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                        <span className="text-[15px] font-black text-white tabular-nums">{item.price}</span>
                        <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.28)" }}>СБТ</span>
                      </div>
                      <button
                        onClick={() => toggleCart(item.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all duration-150"
                        style={inCart
                          ? { background: `${r.color}20`, color: r.color }
                          : { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.45)" }
                        }
                      >
                        <ShoppingCartSimple size={12} weight={inCart ? "fill" : "regular"} />
                        {inCart ? "В корзине" : "Купить"}
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
