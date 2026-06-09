import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Storefront, Shield, Sword, PawPrint, Sparkle,
  ShoppingCartSimple, Crown, Star, Lightning, Ghost,
  Skull, Flame, Wind, Diamond, Gift, Info,
} from "@phosphor-icons/react";

// Серверы — без "Все", пользователь выбирает сам
const SERVERS = [
  { id: "starwars", label: "StarWars",    color: "#818cf8", emoji: "⚔️" },
  { id: "global",   label: "Глобальные", color: "#3b82f6", emoji: "🌐" },
];

const CATEGORIES = [
  { id: "Все",     icon: Storefront },
  { id: "Броня",   icon: Shield },
  { id: "Оружие",  icon: Sword },
  { id: "Питомцы", icon: PawPrint },
  { id: "Эффекты", icon: Sparkle },
];

const ITEM_ICONS = {
  1: Crown, 2: Sword, 3: Ghost, 4: Wind,
  5: Star, 6: Lightning, 7: Skull, 8: Flame, 9: Diamond, 10: Gift,
};

const ITEMS = [
  { id: 1, name: "Мандалорская броня",  server: "starwars", category: "Броня",   price: 420, rarity: "legendary", desc: "Легендарная броня с джетпаком. Исходно принадлежала роду Манда'лор — одному из древнейших кланов галактики." },
  { id: 2, name: "Световой меч",        server: "starwars", category: "Оружие",  price: 280, rarity: "epic",      desc: "Синий световой меч Ордена Джедаев. Кристалл Кайбера настроен на своего владельца." },
  { id: 3, name: "Дроид-спутник",       server: "starwars", category: "Питомцы", price: 230, rarity: "rare",      desc: "Маленький дроид-астромех следует за тобой везде и помогает в бою." },
  { id: 4, name: "Аура Тёмной Силы",    server: "starwars", category: "Эффекты", price: 175, rarity: "rare",      desc: "Тёмная сторона Силы окутывает тебя мрачным сиянием. Пугает союзников." },
  { id: 8, name: "Плащ Ситха",          server: "starwars", category: "Броня",   price: 190, rarity: "uncommon",  desc: "Тёмно-красный плащ с капюшоном. Любимая одежда лорда Вейдера." },
  { id: 5, name: "VIP Статус",          server: "global",   category: "Эффекты", price: 599, rarity: "legendary", desc: "VIP-бейдж и привилегии на всех серверах. Уникальный ник-эффект и доступ к закрытым ивентам." },
  { id: 6, name: "Молния-клинок",       server: "global",   category: "Оружие",  price: 165, rarity: "uncommon",  desc: "Электрический след за клинком. Совместим с любым сервером." },
  { id: 7, name: "Нагрудник Бездны",    server: "global",   category: "Броня",   price: 410, rarity: "legendary", desc: "Броня из фрагментов Бездны. Поглощает урон и отражает часть обратно." },
  { id: 9, name: "Кристалл Силы",       server: "global",   category: "Питомцы", price: 250, rarity: "epic",      desc: "Светящийся кристалл Кайбера парит рядом с тобой." },
  { id: 10, name: "Ивент-набор",        server: "global",   category: "Эффекты", price: 99,  rarity: "uncommon",  desc: "Эксклюзивный набор сезонного события. Ограниченный тираж." },
];

const RARITY = {
  legendary: { label: "Легендарный", color: "#f59e0b", bg: "rgba(245,158,11,0.07)" },
  epic:      { label: "Эпический",   color: "#a855f7", bg: "rgba(168,85,247,0.07)" },
  rare:      { label: "Редкий",      color: "#3b82f6", bg: "rgba(59,130,246,0.07)" },
  uncommon:  { label: "Необычный",   color: "#22c55e", bg: "rgba(34,197,94,0.07)" },
};

export default function ShopPage() {
  const [server,   setServer]   = useState(SERVERS[0].id);
  const [category, setCategory] = useState("Все");
  const [cart,     setCart]     = useState(new Set());
  const [detail,   setDetail]   = useState(null); // item для детального просмотра

  const filtered = ITEMS.filter(i =>
    i.server === server &&
    (category === "Все" || i.category === category)
  );

  const toggleCart = (id) => setCart(prev => {
    const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s;
  });

  return (
    <div className="flex flex-col h-full bg-black overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-4 pb-3 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <Storefront size={19} weight="fill" className="text-white/60" />
          <div>
            <h1 className="text-[17px] font-display font-black tracking-tight text-white">Магазин</h1>
            <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.25)" }}>Уникальные предметы</p>
          </div>
        </div>
        <AnimatePresence>
          {cart.size > 0 && (
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }}
              className="flex items-center gap-1.5 rounded-xl px-3 py-1.5"
              style={{ background: "rgba(37,99,235,0.15)", color: "#93c5fd" }}
            >
              <ShoppingCartSimple size={13} weight="fill" />
              <span className="text-[11px] font-bold">{cart.size}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Server selector — без "Все" */}
      <div className="flex items-center gap-2 px-6 pb-2 flex-shrink-0">
        {SERVERS.map(s => (
          <button key={s.id} onClick={() => setServer(s.id)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-semibold transition-all duration-150"
            style={server === s.id
              ? { background: `${s.color}20`, color: s.color, boxShadow: `0 0 0 1px ${s.color}35` }
              : { background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.35)" }
            }
          >
            <span>{s.emoji}</span>
            {s.label}
          </button>
        ))}
      </div>

      {/* Category tabs */}
      <div className="flex items-center gap-1 px-6 pb-3 flex-shrink-0">
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
              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  onClick={() => setDetail(item)}
                  className="flex flex-col rounded-2xl overflow-hidden group"
                  style={{ background: "#0e0e0e", cursor: "pointer" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "#141414"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "#0e0e0e"; }}
                >
                  {/* ── Обложка-баннер ── */}
                  <div className="relative h-[110px] flex-shrink-0 overflow-hidden"
                    style={{
                      background: `radial-gradient(ellipse at 50% 120%, ${r.color}30 0%, transparent 70%), linear-gradient(160deg, ${r.color}12 0%, #000 100%)`,
                    }}
                  >
                    {/* Glow */}
                    <div className="absolute inset-0"
                      style={{ background: `radial-gradient(circle at 50% 100%, ${r.color}20, transparent 65%)` }}
                    />
                    {/* Большая иконка по центру */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <ItemIcon
                        size={52}
                        weight="fill"
                        style={{
                          color: r.color,
                          opacity: 0.85,
                          filter: `drop-shadow(0 0 16px ${r.color}60)`,
                          transition: "transform 0.2s",
                        }}
                        className="group-hover:scale-110"
                      />
                    </div>
                    {/* Rarity badge */}
                    <div className="absolute top-2.5 right-2.5">
                      <span className="text-[9px] font-bold tracking-wider px-2 py-1 rounded-lg"
                        style={{ color: r.color, background: `rgba(0,0,0,0.7)`, border: `1px solid ${r.color}30` }}
                      >
                        {r.label.toUpperCase()}
                      </span>
                    </div>
                    {/* Server badge */}
                    {server === "all" && (() => {
                      const srvColor = SERVERS.find(s => s.id === item.server)?.color;
                      const srvLabel = SERVERS.find(s => s.id === item.server)?.label;
                      return srvColor ? (
                        <div className="absolute top-2.5 left-2.5">
                          <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-md"
                            style={{ color: srvColor, background: `rgba(0,0,0,0.7)`, border: `1px solid ${srvColor}30` }}
                          >{srvLabel}</span>
                        </div>
                      ) : null;
                    })()}
                    {/* Bottom fade */}
                    <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-[#0e0e0e] to-transparent" />
                  </div>

                  {/* ── Контент ── */}
                  <div className="px-4 pb-4 pt-2 flex flex-col gap-2.5 flex-1">
                    <div>
                      <p className="text-[13px] font-bold text-white leading-tight">{item.name}</p>
                      <p className="text-[10px] mt-1 leading-relaxed line-clamp-2"
                        style={{ color: "rgba(255,255,255,0.35)" }}
                      >
                        {item.desc}
                      </p>
                    </div>

                    {/* ── Нижняя строка: цена | Подробнее | Купить ── */}
                    <div className="flex items-center gap-2 mt-auto pt-2"
                      style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
                    >
                      {/* Цена */}
                      <div className="flex items-center gap-1 flex-1">
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                        <span className="text-[14px] font-black text-white tabular-nums">{item.price}</span>
                        <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.28)" }}>СБТ</span>
                      </div>
                      {/* Подробнее */}
                      <button
                        onClick={e => { e.stopPropagation(); setDetail(item); }}
                        className="text-[10px] font-semibold px-2.5 py-1.5 rounded-xl transition-all duration-150"
                        style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)" }}
                      >
                        Подробнее
                      </button>
                      {/* Купить */}
                      <button
                        onClick={e => { e.stopPropagation(); toggleCart(item.id); }}
                        className="flex items-center gap-1 text-[11px] font-bold px-3 py-1.5 rounded-xl transition-all duration-150"
                        style={inCart
                          ? { background: `${r.color}22`, color: r.color }
                          : { background: "rgba(37,99,235,0.2)", color: "#93c5fd" }
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

      {/* Detail modal */}
      <AnimatePresence>
        {detail && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/70" onClick={() => setDetail(null)} />
            <motion.div
              initial={{ scale: 0.92, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 12 }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              className="relative z-10 w-[420px] rounded-2xl overflow-hidden"
              style={{ background: "#0c0c0c", boxShadow: "0 24px 80px rgba(0,0,0,0.9)" }}
            >
              {/* Top bar */}
              <div className="h-[3px]"
                style={{ background: `linear-gradient(90deg, transparent, ${RARITY[detail.rarity].color}, transparent)` }}
              />
              <div className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
                    style={{ background: `${RARITY[detail.rarity].color}15` }}
                  >
                    {React.createElement(ITEM_ICONS[detail.id] || Diamond, {
                      size: 28, weight: "fill", style: { color: RARITY[detail.rarity].color }
                    })}
                  </div>
                  <div>
                    <p className="text-[16px] font-black text-white">{detail.name}</p>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg"
                      style={{ color: RARITY[detail.rarity].color, background: `${RARITY[detail.rarity].color}15` }}
                    >
                      {RARITY[detail.rarity].label.toUpperCase()}
                    </span>
                  </div>
                </div>
                <p className="text-[13px] leading-relaxed mb-5" style={{ color: "rgba(255,255,255,0.55)" }}>
                  {detail.desc}
                </p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    <span className="text-[18px] font-black text-white">{detail.price}</span>
                    <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.3)" }}>СБТ</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setDetail(null)}
                      className="px-4 py-2 rounded-xl text-[12px] font-semibold transition-colors"
                      style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}
                    >
                      Закрыть
                    </button>
                    <button onClick={() => { toggleCart(detail.id); setDetail(null); }}
                      className="px-5 py-2 rounded-xl text-[12px] font-bold text-white transition-colors"
                      style={{ background: cart.has(detail.id) ? `${RARITY[detail.rarity].color}40` : "#2563EB" }}
                    >
                      {cart.has(detail.id) ? "Убрать" : "Купить"}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
