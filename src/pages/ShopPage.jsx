import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Storefront, Shield, Sword, PawPrint, Sparkle,
  ShoppingCartSimple, Crown, Star, Lightning, Ghost,
  Skull, Flame, Wind, Diamond, Gift, Info, X, Tag,
  ArrowsLeftRight, Plus, ListChecks, CaretLeft,
} from "@phosphor-icons/react";
import { authedFetch } from "../lib/api.js";
import { useNotifications } from "../components/NotificationSystem.jsx";

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

export default function ShopPage({ user, onBalanceChange }) {
  const [mode, setMode] = useState("choose"); // "choose" | "donate" | "market"

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)" }}>
      <AnimatePresence mode="wait">

        {/* ─── Экран выбора ─── */}
        {mode === "choose" && (
          <motion.div key="choose"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.18 }}
            className="flex-1 flex flex-col items-center justify-center gap-6 px-8"
          >
            <div className="text-center mb-2">
              <p className="text-[22px] font-black text-white mb-1">Магазин</p>
              <p className="text-[13px]" style={{ color: "rgba(255,255,255,0.4)" }}>Куда хочешь перейти?</p>
            </div>

            <div className="flex gap-4 w-full max-w-[460px]">
              {/* Донат */}
              <button onClick={() => setMode("donate")}
                className="flex-1 flex flex-col items-center gap-4 rounded-2xl py-10 transition-all duration-150 group"
                style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.18)" }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(99,102,241,0.16)"; e.currentTarget.style.borderColor = "rgba(99,102,241,0.35)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(99,102,241,0.08)"; e.currentTarget.style.borderColor = "rgba(99,102,241,0.18)"; }}
              >
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                  style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.25)" }}>
                  <Storefront size={30} weight="fill" style={{ color: "#818cf8" }} />
                </div>
                <div className="text-center">
                  <p className="text-[16px] font-black text-white">Донат</p>
                  <p className="text-[11px] mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>Скины, рамки, фоны и&nbsp;привилегии</p>
                </div>
              </button>

              {/* Торговая площадка */}
              <button onClick={() => setMode("market")}
                className="flex-1 flex flex-col items-center gap-4 rounded-2xl py-10 transition-all duration-150 group"
                style={{ background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.18)" }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(168,85,247,0.16)"; e.currentTarget.style.borderColor = "rgba(168,85,247,0.35)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(168,85,247,0.08)"; e.currentTarget.style.borderColor = "rgba(168,85,247,0.18)"; }}
              >
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                  style={{ background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.25)" }}>
                  <ArrowsLeftRight size={30} weight="fill" style={{ color: "#c084fc" }} />
                </div>
                <div className="text-center">
                  <p className="text-[16px] font-black text-white">Торговая площадка</p>
                  <p className="text-[11px] mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>Покупай и&nbsp;продавай предметы</p>
                </div>
              </button>
            </div>
          </motion.div>
        )}

        {/* ─── Донат ─── */}
        {mode === "donate" && (
          <motion.div key="donate"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.18 }}
            className="flex-1 flex flex-col overflow-hidden"
          >
            <button onClick={() => setMode("choose")}
              className="self-start flex items-center gap-1.5 mt-4 ml-6 px-3 py-1.5 rounded-xl text-[12px] font-semibold transition-all flex-shrink-0"
              style={{ color: "rgba(255,255,255,0.5)", background: "rgba(255,255,255,0.05)" }}
              onMouseEnter={e => e.currentTarget.style.color = "#fff"}
              onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.5)"}>
              <CaretLeft size={13} weight="bold" /> Назад
            </button>
            <DonateView user={user} onBalanceChange={onBalanceChange} />
          </motion.div>
        )}

        {/* ─── Торговая площадка ─── */}
        {mode === "market" && (
          <motion.div key="market"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.18 }}
            className="flex-1 flex flex-col overflow-hidden"
          >
            <button onClick={() => setMode("choose")}
              className="self-start flex items-center gap-1.5 mt-4 ml-6 px-3 py-1.5 rounded-xl text-[12px] font-semibold transition-all flex-shrink-0"
              style={{ color: "rgba(255,255,255,0.5)", background: "rgba(255,255,255,0.05)" }}
              onMouseEnter={e => e.currentTarget.style.color = "#fff"}
              onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.5)"}>
              <CaretLeft size={13} weight="bold" /> Назад
            </button>
            <MarketplaceView />
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}

// ─── Донат (старая логика магазина) ───────────────────────────────────────────
function DonateView({ user, onBalanceChange }) {
  const [server,   setServer]   = useState(() => localStorage.getItem("sbg_donate_server")   || SERVERS[0].id);
  const [category, setCategory] = useState(() => localStorage.getItem("sbg_donate_category") || "Все");
  const [cart,     setCart]     = useState(new Set());
  const [detail,   setDetail]   = useState(null);
  const [showCart, setShowCart]  = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const { push: pushNotif } = useNotifications() || {};

  const handleCheckout = async () => {
    if (checkingOut || cart.size === 0) return;
    setCheckingOut(true);
    try {
      const ids = [...cart];
      const r = await authedFetch("/api/shop/buy", {
        method: "POST",
        body: JSON.stringify({ itemIds: ids }),
      });
      if (onBalanceChange) onBalanceChange(r.balance);
      pushNotif?.("Заказ оформлен", "Предметы добавлены в ваш инвентарь", "success");
      setCart(new Set());
      setShowCart(false);
    } catch (e) {
      pushNotif?.("Ошибка заказа", e.message || "Не удалось оформить заказ", "error");
    } finally {
      setCheckingOut(false);
    }
  };
  useEffect(() => { localStorage.setItem("sbg_donate_server",   server);   }, [server]);
  useEffect(() => { localStorage.setItem("sbg_donate_category", category); }, [category]);

  const filtered = ITEMS.filter(i =>
    i.server === server &&
    (category === "Все" || i.category === category)
  );

  const toggleCart = (id) => setCart(prev => {
    const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s;
  });

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-1 pb-3 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <Storefront size={17} weight="fill" className="text-white/60" />
          <div>
            <h1 className="text-[15px] font-display font-black tracking-tight text-white">Донат-магазин</h1>
            <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.5)" }}>Прямые покупки у SB Games</p>
          </div>
        </div>
        <AnimatePresence>
          {cart.size > 0 && (
            <motion.button initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }}
              onClick={() => setShowCart(true)}
              className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 cursor-pointer transition-all duration-150"
              style={{ background: "rgba(37,99,235,0.15)", color: "#93c5fd" }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(37,99,235,0.3)"}
              onMouseLeave={e => e.currentTarget.style.background = "rgba(37,99,235,0.15)"}
            >
              <ShoppingCartSimple size={13} weight="fill" />
              <span className="text-[11px] font-bold">{cart.size}</span>
            </motion.button>
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
              : { background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.6)" }
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
              : { color: "rgba(255,255,255,0.5)" }
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
            <p className="text-[12px]" style={{ color: "rgba(255,255,255,0.45)" }}>Нет предметов</p>
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
                  style={{ background: "rgba(14,14,14,0.55)", backdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.06)", cursor: "pointer" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(20,20,20,0.65)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(14,14,14,0.55)"; }}
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
                    <div className="absolute bottom-0 left-0 right-0 h-8" style={{ background: "linear-gradient(to top, rgba(14,14,14,0.55), transparent)" }} />
                  </div>

                  {/* ── Контент ── */}
                  <div className="px-4 pb-4 pt-2 flex flex-col gap-2.5 flex-1">
                    <div>
                      {item.name && <p className="text-[13px] font-bold text-white leading-tight">{item.name}</p>}
                      <p className="text-[10px] mt-1 leading-relaxed line-clamp-2"
                        style={{ color: "rgba(255,255,255,0.6)" }}
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
                        <img src="/money.png" alt="" className="w-3.5 h-3.5 object-contain" style={{ filter: "drop-shadow(0 0 3px rgba(37,99,235,0.6))" }} />
                        <span className="text-[14px] font-black text-white tabular-nums">{item.price}</span>
                        <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.5)" }}>SBT</span>
                      </div>
                      {/* Подробнее */}
                      <button
                        onClick={e => { e.stopPropagation(); setDetail(item); }}
                        className="text-[10px] font-semibold px-2.5 py-1.5 rounded-xl transition-all duration-150"
                        style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.65)" }}
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
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setDetail(null)} />
            <motion.div
              initial={{ scale: 0.92, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 12 }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              className="relative z-10 w-[440px] rounded-3xl overflow-hidden"
              style={{ background: "rgba(10,10,10,0.85)", backdropFilter: "blur(24px)", boxShadow: "0 24px 80px rgba(0,0,0,0.9)" }}
            >
              {/* Banner with rarity glow */}
              <div className="relative h-[160px] flex items-center justify-center overflow-hidden"
                style={{ background: `radial-gradient(ellipse at 50% 130%, ${RARITY[detail.rarity].color}35 0%, transparent 70%), linear-gradient(160deg, ${RARITY[detail.rarity].color}15 0%, #000 100%)` }}
              >
                <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 50% 100%, ${RARITY[detail.rarity].color}20, transparent 65%)` }} />
                <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.1, type: "spring" }}>
                  {React.createElement(ITEM_ICONS[detail.id] || Diamond, {
                    size: 72, weight: "fill", style: { color: RARITY[detail.rarity].color, filter: `drop-shadow(0 0 24px ${RARITY[detail.rarity].color}60)` }
                  })}
                </motion.div>
                {/* Rarity badge */}
                <div className="absolute top-4 right-4">
                  <span className="text-[9px] font-bold tracking-wider px-2.5 py-1 rounded-lg"
                    style={{ color: RARITY[detail.rarity].color, background: "rgba(0,0,0,0.7)", border: `1px solid ${RARITY[detail.rarity].color}30` }}
                  >
                    {RARITY[detail.rarity].label.toUpperCase()}
                  </span>
                </div>
                {/* Close */}
                <button onClick={() => setDetail(null)}
                  className="absolute top-4 left-4 w-8 h-8 rounded-xl flex items-center justify-center transition-all"
                  style={{ background: "rgba(0,0,0,0.5)", color: "rgba(255,255,255,0.5)" }}
                  onMouseEnter={e => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.background = "rgba(255,255,255,0.1)"; }}
                  onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.5)"; e.currentTarget.style.background = "rgba(0,0,0,0.5)"; }}
                >
                  <X size={14} />
                </button>
              </div>

              {/* Content */}
              <div className="p-6">
                {detail.name && <h2 className="text-[18px] font-black text-white mb-1">{detail.name}</h2>}
                <p className="text-[12px] mb-4" style={{ color: "rgba(255,255,255,0.65)" }}>
                  {detail.server === "starwars" ? "StarWars сервер" : "Глобальный"} · {detail.category}
                </p>
                <p className="text-[13px] leading-relaxed mb-5" style={{ color: "rgba(255,255,255,0.75)" }}>
                  {detail.desc}
                </p>

                {/* Price + buttons */}
                <div className="flex items-center justify-between pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className="flex items-center gap-2">
                    <img src="/money.png" alt="" className="w-5 h-5" style={{ filter: "drop-shadow(0 0 4px rgba(37,99,235,0.6))" }} />
                    <span className="text-[22px] font-black text-white tabular-nums">{detail.price}</span>
                    <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.75)" }}>SBT</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { toggleCart(detail.id); setDetail(null); }}
                      className="px-6 py-2.5 rounded-xl text-[12px] font-bold text-white transition-all"
                      style={{ background: cart.has(detail.id) ? `linear-gradient(135deg, ${RARITY[detail.rarity].color}, ${RARITY[detail.rarity].color}aa)` : "linear-gradient(135deg, #2563EB, #3b82f6)", boxShadow: `0 0 20px ${cart.has(detail.id) ? RARITY[detail.rarity].color + "30" : "rgba(37,99,235,0.3)"}` }}
                    >
                      {cart.has(detail.id) ? "В корзине ✓" : "В корзину"}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cart panel */}
      <AnimatePresence>
        {showCart && cart.size > 0 && (
          <motion.div
            className="fixed inset-0 z-50 flex justify-end"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCart(false)} />
            <motion.div
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="relative z-10 w-[380px] h-full flex flex-col"
              style={{ background: "rgba(10,10,14,0.88)", backdropFilter: "blur(20px)", borderLeft: "1px solid rgba(255,255,255,0.06)" }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 flex-shrink-0"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
              >
                <div className="flex items-center gap-2.5">
                  <ShoppingCartSimple size={16} weight="fill" style={{ color: "#93c5fd" }} />
                  <p className="text-[14px] font-bold text-white">Корзина ({cart.size})</p>
                </div>
                <button onClick={() => setShowCart(false)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
                  style={{ color: "rgba(255,255,255,0.6)" }}
                  onMouseEnter={e => e.currentTarget.style.color = "#fff"}
                  onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.6)"}
                >
                  <X size={14} />
                </button>
              </div>

              {/* Items */}
              <div className="flex-1 overflow-y-auto px-5 py-3">
                {[...cart].map(id => {
                  const item = ITEMS.find(i => i.id === id);
                  if (!item) return null;
                  const r = RARITY[item.rarity];
                  const ItemIcon = ITEM_ICONS[item.id] || Diamond;
                  return (
                    <motion.div key={id} layout initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                      className="flex items-center gap-3 p-3 rounded-xl mb-2"
                      style={{ background: "rgba(255,255,255,0.03)" }}
                    >
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: `${r.color}15` }}
                      >
                        <ItemIcon size={20} weight="fill" style={{ color: r.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        {item.name && <p className="text-[12px] font-semibold text-white truncate">{item.name}</p>}
                        <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.75)" }}>{r.label}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <img src="/money.png" alt="" className="w-3 h-3" />
                          <span className="text-[12px] font-bold text-white tabular-nums">{item.price}</span>
                        </div>
                        <button onClick={() => toggleCart(id)}
                          className="w-6 h-6 rounded-lg flex items-center justify-center transition-all"
                          style={{ color: "rgba(239,68,68,0.5)" }}
                          onMouseEnter={e => e.currentTarget.style.color = "#fca5a5"}
                          onMouseLeave={e => e.currentTarget.style.color = "rgba(239,68,68,0.5)"}
                        >
                          <X size={11} />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="px-5 py-4 flex-shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[12px]" style={{ color: "rgba(255,255,255,0.65)" }}>Итого:</span>
                  <div className="flex items-center gap-1.5">
                    <img src="/money.png" alt="" className="w-4 h-4" style={{ filter: "drop-shadow(0 0 4px rgba(37,99,235,0.6))" }} />
                    <span className="text-[18px] font-black text-white tabular-nums">
                      {[...cart].reduce((sum, id) => sum + (ITEMS.find(i => i.id === id)?.price || 0), 0)}
                    </span>
                    <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.75)" }}>SBT</span>
                  </div>
                </div>
                <button
                  onClick={handleCheckout}
                  disabled={checkingOut}
                  className="w-full py-3 rounded-xl text-[13px] font-bold text-white transition-all disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg, #2563EB, #3b82f6)", boxShadow: "0 0 20px rgba(37,99,235,0.3)" }}
                  onMouseEnter={e => e.currentTarget.style.boxShadow = "0 0 30px rgba(37,99,235,0.5)"}
                  onMouseLeave={e => e.currentTarget.style.boxShadow = "0 0 20px rgba(37,99,235,0.3)"}
                >
                  {checkingOut ? "Оформление…" : "Оформить заказ"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Торговая площадка (P2P — листинги из инвентаря) ──────────────────────────
const MARKET_TYPE_LABELS = {
  frame: "Рамки",
  background: "Фоны",
  avatar_animated: "Аним. аватарки",
  badge: "Бейджи",
};
const TYPE_BG = { frame: "#3b82f6", background: "#6366f1", avatar_animated: "#a855f7", badge: "#facc15" };

function MarketplaceView() {
  const [listings, setListings] = useState([]);
  const [owned, setOwned]       = useState([]);
  const [equip, setEquip]       = useState({});
  const [catalog, setCatalog]   = useState([]);
  const [filter, setFilter]     = useState("all");
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [sellOpen, setSellOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const typeQuery = filter !== "all" ? `?type=${filter}` : "";
      const data = await authedFetch(`/api/market/listings${typeQuery}`);
      setListings(data.listings || []);
    } catch (e) {
      setError("Не удалось загрузить маркет");
    } finally { setLoading(false); }
  }, [filter]);

  const loadOwned = useCallback(async () => {
    try {
      const data = await authedFetch("/api/inventory");
      setOwned(data.market || []);
      setEquip(data.equip || {});
      setCatalog(data.marketCatalog || []);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadOwned(); }, [loadOwned]);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-1 pb-3 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <ArrowsLeftRight size={17} weight="fill" className="text-white/60" />
          <div>
            <h1 className="text-[15px] font-display font-black tracking-tight text-white">Торговая площадка</h1>
            <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.5)" }}>
              Глобальный P2P-трейд предметами из Библиотеки
            </p>
          </div>
        </div>
        <button onClick={() => setSellOpen(true)}
          disabled={owned.length === 0}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-bold text-white disabled:opacity-30"
          style={{ background: "linear-gradient(90deg, #6366f1, #a855f7)" }}>
          <Plus size={12} weight="bold" />Продать
        </button>
      </div>

      {/* Filter chips */}
      <div className="flex items-center gap-1.5 px-6 pb-3 flex-shrink-0 flex-wrap">
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>Все</FilterChip>
        {Object.entries(MARKET_TYPE_LABELS).map(([id, label]) => (
          <FilterChip key={id} active={filter === id} onClick={() => setFilter(id)}>{label}</FilterChip>
        ))}
      </div>

      {error && (
        <div className="mx-6 mb-2 rounded-xl px-3 py-2 text-[11px]"
          style={{ background: "rgba(239,68,68,0.08)", color: "#fca5a5" }}>
          {error}
        </div>
      )}

      {/* Listings grid */}
      <div className="flex-1 overflow-y-auto px-6 pb-6 min-h-0">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-white/55 text-[12px]">
            Загружаем…
          </div>
        ) : listings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <ArrowsLeftRight size={28} style={{ color: "rgba(255,255,255,0.08)" }} />
            <p className="text-[12px]" style={{ color: "rgba(255,255,255,0.5)" }}>
              Нет активных листингов. Выстави свой предмет — продай за SBT.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {listings.map((l, i) => (
              <ListingCard key={l.id} listing={l} onBought={load} onCancelled={load} />
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {sellOpen && (
          <SellModal
            owned={owned}
            catalog={catalog}
            onClose={() => setSellOpen(false)}
            onCreated={() => { setSellOpen(false); load(); loadOwned(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function FilterChip({ active, onClick, children }) {
  return (
    <button onClick={onClick}
      className="px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-150"
      style={active
        ? { background: "rgba(168,85,247,0.18)", color: "#e9d5ff" }
        : { background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.65)" }
      }>
      {children}
    </button>
  );
}

const CATALOG = {
  m_cosmic_chest:   { type: "chest",    name: "Космический кейс",  preview: "linear-gradient(135deg,#1e1b4b,#7c3aed,#ec4899)" },
  m_saber_relic:    { type: "relic",    name: "Реликвия Силы",     preview: "linear-gradient(135deg,#0c4a6e,#0ea5e9,#22d3ee)" },
  m_dragon_scale:   { type: "material", name: "Драконья чешуя",    preview: "linear-gradient(135deg,#7f1d1d,#dc2626,#fb923c)" },
  m_ghost_cape:     { type: "skin",     name: "Призрачный плащ",   preview: "linear-gradient(135deg,#1e293b,#475569,#94a3b8)" },
  m_ember_token:    { type: "token",    name: "Угольный жетон",    preview: "linear-gradient(135deg,#7f1d1d,#ea580c)" },
  m_neon_disc:      { type: "disc",     name: "Неоновый диск",     preview: "linear-gradient(135deg,#581c87,#a855f7,#22d3ee)" },
  m_void_pearl:     { type: "pearl",    name: "Жемчужина Бездны",  preview: "linear-gradient(135deg,#020617,#1e1b4b,#0ea5e9)" },
  m_aurora_shard:   { type: "shard",    name: "Осколок Авроры",    preview: "linear-gradient(135deg,#0c4a6e,#22d3ee,#a855f7)" },
};

function ListingCard({ listing, onBought }) {
  const item = CATALOG[listing.itemId] || { name: listing.name, preview: "#888", type: listing.itemType };
  const [buying, setBuying] = useState(false);

  const buy = async () => {
    if (buying) return;
    setBuying(true);
    try {
      await authedFetch(`/api/market/buy/${listing.id}`, { method: "POST" });
      onBought?.();
    } catch (e) { alert(e.message); }
    finally { setBuying(false); }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl p-3 flex flex-col gap-2.5"
      style={{ background: "rgba(255,255,255,0.03)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.05)" }}>
      <div className="aspect-square rounded-xl flex items-center justify-center relative overflow-hidden"
        style={{ background: "rgba(0,0,0,0.4)" }}>
        <div className="w-12 h-12 rounded-xl"
          style={{ background: item.preview, boxShadow: `0 0 20px ${item.preview}55` }} />
        <span className="absolute top-2 left-2 text-[8px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider"
          style={{ color: "#fff", background: "rgba(0,0,0,0.7)" }}>
          {MARKET_TYPE_LABELS[item.type] || item.type}
        </span>
      </div>
      <div>
        {item.name && <p className="text-[12px] font-bold text-white">{item.name}</p>}
        <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.65)" }}>
          @{listing.sellerName}
        </p>
      </div>
      <button onClick={buy} disabled={buying}
        className="rounded-xl py-1.5 text-[11px] font-bold flex items-center justify-center gap-1.5 text-white"
        style={{ background: "rgba(99,102,241,0.5)" }}>
        <Tag size={11} weight="fill" />
        {buying ? "Покупаем…" : `${listing.price} SBT`}
      </button>
    </motion.div>
  );
}

function SellModal({ owned, catalog, onClose, onCreated }) {
  const [picked, setPicked] = useState(null);
  const [price, setPrice]   = useState(100);
  const [busy, setBusy]     = useState(false);
  const [error, setError]   = useState(null);

  const submit = async () => {
    if (!picked || busy) return;
    setBusy(true); setError(null);
    try {
      await authedFetch("/api/market/sell", { method: "POST", body: JSON.stringify({ itemId: picked, price }) });
      onCreated?.();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  return (
    <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ scale: 0.94, y: 8 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.94, y: 8 }}
        className="relative z-10 w-[440px] rounded-2xl overflow-hidden"
        style={{ background: "rgba(10,10,10,0.85)", backdropFilter: "blur(24px)", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 24px 80px rgba(0,0,0,0.9)" }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div>
            <p className="text-[13px] font-bold text-white">Выставить на продажу</p>
            <p className="text-[10px] text-white/55 mt-0.5">Предмет уйдёт из инвентаря, деньги поступят после покупки</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg text-white/55 hover:text-white hover:bg-white/[0.07] flex items-center justify-center">
            <X size={12} />
          </button>
        </div>
        <div className="p-5 flex flex-col gap-3">
          <p className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: "rgba(255,255,255,0.75)" }}>
            Выбери предмет
          </p>
          {owned.length === 0 ? (
            <p className="text-[11px] py-6 text-center" style={{ color: "rgba(255,255,255,0.75)" }}>
              У тебя нет предметов в библиотеке.
            </p>
          ) : (
            <div className="grid grid-cols-4 gap-2 max-h-[200px] overflow-y-auto">
              {owned.map(id => {
                const item = CATALOG[id] || { name: id, preview: "#888", type: "?" };
                return (
                  <button key={id} onClick={() => setPicked(id)}
                    className="relative rounded-xl p-2 flex flex-col items-center gap-1"
                    style={{
                      background: picked === id ? "rgba(168,85,247,0.18)" : "rgba(255,255,255,0.04)",
                      border: picked === id ? "1.5px solid rgba(168,85,247,0.5)" : "1.5px solid transparent",
                    }}>
                    <div className="w-10 h-10 rounded-lg"
                      style={{ background: item.preview, boxShadow: `0 0 12px ${item.preview}55` }} />
                    {item.name && <span className="text-[9px] text-white truncate w-full text-center">{item.name}</span>}
                  </button>
                );
              })}
            </div>
          )}

          {picked && (
            <div className="flex flex-col gap-1.5 mt-2">
              <label className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: "rgba(255,255,255,0.75)" }}>
                Цена (SBT)
              </label>
              <input type="number" min="10" max="100000" step="10" value={price}
                onChange={e => setPrice(Math.max(10, Math.min(100000, parseInt(e.target.value) || 0)))}
                className="w-full rounded-xl px-3 py-2 text-[13px] font-bold outline-none"
                style={{ background: "rgba(255,255,255,0.05)", color: "#fff", border: "1px solid rgba(255,255,255,0.08)" }} />
            </div>
          )}

          {error && (
            <div className="rounded-xl px-3 py-2 text-[11px]"
              style={{ background: "rgba(239,68,68,0.08)", color: "#fca5a5" }}>
              {error}
            </div>
          )}

          <div className="flex items-center gap-2 mt-2">
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-[12px] font-semibold"
              style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.5)" }}>
              Отмена
            </button>
            <button onClick={submit} disabled={!picked || busy}
              className="flex-1 py-2.5 rounded-xl text-[12px] font-bold text-white disabled:opacity-30"
              style={{ background: "linear-gradient(90deg, #6366f1, #a855f7)" }}>
              {busy ? "Создаём…" : "Выставить"}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
