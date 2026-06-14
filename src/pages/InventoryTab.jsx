import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck, Sword, PawPrint, Sparkle, Star,
  Loader2, Package, Check, X, Search, Filter,
} from "lucide-react";
import { authedFetch } from "../lib/api.js";

const CATEGORY_META = {
  all:      { label: "Все",         icon: Package, color: "#94a3b8" },
  armor:    { label: "Броня",       icon: ShieldCheck, color: "#3b82f6" },
  weapon:   { label: "Оружие",      icon: Sword,  color: "#ef4444" },
  pet:      { label: "Питомцы",     icon: PawPrint, color: "#a855f7" },
  effect:   { label: "Эффекты",     icon: Sparkle, color: "#f59e0b" },
};

const RARITY = {
  legendary: { label: "Легендарный", color: "#f59e0b", glow: "rgba(245,158,11,0.25)" },
  epic:      { label: "Эпический",   color: "#a855f7", glow: "rgba(168,85,247,0.25)" },
  rare:      { label: "Редкий",      color: "#3b82f6", glow: "rgba(59,130,246,0.25)" },
  uncommon:  { label: "Необычный",   color: "#22c55e", glow: "rgba(34,197,94,0.25)" },
  common:    { label: "Обычный",     color: "#94a3b8", glow: "rgba(148,163,184,0.15)" },
};

const SERVER_FILTERS = [
  { id: "all",     label: "Все" },
  { id: "starwars", label: "StarWars" },
  { id: "global",  label: "Глобальные" },
];

function ItemCard({ item, equipped, onEquip, onUnequip, busy }) {
  const rarity = RARITY[item.rarity] || RARITY.common;
  const isEquipped = equipped;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="group relative rounded-2xl overflow-hidden cursor-pointer transition-all duration-200"
      style={{
        background: isEquipped ? `${rarity.glow}` : "rgba(255,255,255,0.03)",
        border: isEquipped ? `1.5px solid ${rarity.color}40` : "1.5px solid rgba(255,255,255,0.05)",
      }}
    >
      {/* Rarity glow */}
      {item.rarity === "legendary" && (
        <div className="absolute -inset-px rounded-2xl pointer-events-none"
          style={{
            border: `1.5px solid ${rarity.color}30`,
            boxShadow: `0 0 12px ${rarity.color}15`,
          }}
        />
      )}

      {/* Icon area */}
      <div className="relative h-[100px] flex items-center justify-center overflow-hidden"
        style={{
          background: `radial-gradient(ellipse at 50% 120%, ${rarity.color}12 0%, transparent 70%), rgba(0,0,0,0.3)`,
        }}
      >
        {/* Big icon */}
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{
            background: `${rarity.color}15`,
            boxShadow: `0 0 24px ${rarity.color}20`,
          }}
        >
          <Package size={28} style={{ color: rarity.color, opacity: 0.8 }} />
        </div>

        {/* Rarity badge */}
        <span className="absolute top-2 left-2 text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider"
          style={{
            background: `${rarity.color}20`,
            color: rarity.color,
            border: `1px solid ${rarity.color}30`,
          }}
        >
          {rarity.label}
        </span>

        {/* Equipped badge */}
        {isEquipped && (
          <span className="absolute top-2 right-2 text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider"
            style={{ background: "rgba(34,197,94,0.25)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.3)" }}
          >
            <Check size={8} className="inline -mt-0.5" /> Экип.
          </span>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          style={{ background: "rgba(0,0,0,0.6)" }}
        >
          {isEquipped ? (
            <button
              onClick={(e) => { e.stopPropagation(); onUnequip?.(item); }}
              disabled={busy}
              className="px-4 py-2 rounded-xl text-[11px] font-bold transition-all"
              style={{ background: "rgba(239,68,68,0.25)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.3)" }}
            >
              {busy ? "…" : "Снять"}
            </button>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); onEquip?.(item); }}
              disabled={busy}
              className="px-4 py-2 rounded-xl text-[11px] font-bold text-white transition-all"
              style={{ background: `${rarity.color}cc`, boxShadow: `0 0 16px ${rarity.color}40` }}
            >
              {busy ? "…" : "Экипировать"}
            </button>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="px-3 py-2.5">
        <p className="text-[12px] font-bold text-white truncate">{item.name}</p>
        <div className="flex items-center gap-1.5 mt-1">
          <span className="text-[9px] px-1.5 py-0.5 rounded-md"
            style={{ background: `${rarity.color}12`, color: `${rarity.color}cc` }}>
            {item.category}
          </span>
          {item.server === "starwars" && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-md"
              style={{ background: "rgba(129,140,248,0.1)", color: "rgba(129,140,248,0.7)" }}>
              StarWars
            </span>
          )}
        </div>
        {item.desc && (
          <p className="text-[10px] mt-1.5 leading-relaxed line-clamp-2"
            style={{ color: "rgba(255,255,255,0.35)" }}>
            {item.desc}
          </p>
        )}
      </div>
    </motion.div>
  );
}

function ItemDetail({ item, equipped, onEquip, onUnequip, busy, onClose }) {
  const rarity = RARITY[item.rarity] || RARITY.common;
  const isEquipped = equipped;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col gap-4 min-w-0"
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ background: `${rarity.color}15`, boxShadow: `0 0 24px ${rarity.color}20` }}>
          <Package size={28} style={{ color: rarity.color, opacity: 0.8 }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[16px] font-black text-white leading-tight">{item.name}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: `${rarity.color}20`, color: rarity.color, border: `1px solid ${rarity.color}30` }}>
              {rarity.label}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full"
              style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}>
              {item.category}
            </span>
          </div>
        </div>
        <button onClick={onClose}
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all"
          style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.3)" }}
          onMouseEnter={e => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.background = "rgba(255,255,255,0.1)"; }}
          onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.3)"; e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Description */}
      <div className="rounded-2xl p-4"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
        <p className="text-[10px] uppercase tracking-widest font-semibold mb-2"
          style={{ color: "rgba(255,255,255,0.2)" }}>Описание</p>
        <p className="text-[12px] leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}>
          {item.desc || "Нет описания."}
        </p>
      </div>

      {/* Meta */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)" }}>
          <p className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.2)" }}>Сервер</p>
          <p className="text-[12px] font-bold text-white mt-1">
            {item.server === "starwars" ? "StarWars" : "Все серверы"}
          </p>
        </div>
        <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)" }}>
          <p className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.2)" }}>Статус</p>
          <p className="text-[12px] font-bold mt-1" style={{ color: isEquipped ? "#4ade80" : "rgba(255,255,255,0.5)" }}>
            {isEquipped ? "Экипирован" : "В инвентаре"}
          </p>
        </div>
      </div>

      {/* Action */}
      {isEquipped ? (
        <button onClick={() => onUnequip?.(item)} disabled={busy}
          className="w-full py-3 rounded-xl text-[12px] font-bold transition-all"
          style={{ background: "rgba(239,68,68,0.12)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.2)" }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.25)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "rgba(239,68,68,0.12)"; }}
        >
          {busy ? "…" : "Снять"}
        </button>
      ) : (
        <button onClick={() => onEquip?.(item)} disabled={busy}
          className="w-full py-3 rounded-xl text-[12px] font-bold text-white transition-all"
          style={{ background: `${rarity.color}cc`, boxShadow: `0 0 20px ${rarity.color}30` }}
          onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 0 28px ${rarity.color}50`; }}
          onMouseLeave={e => { e.currentTarget.style.boxShadow = `0 0 20px ${rarity.color}30`; }}
        >
          {busy ? "…" : "Экипировать"}
        </button>
      )}
    </motion.div>
  );
}

export default function InventoryTab({ user }) {
  const [items, setItems]       = useState([]);
  const [equipped, setEquipped] = useState({});
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [busy, setBusy]         = useState(null);
  const [activeCategory, setActiveCategory] = useState("all");
  const [activeServer, setActiveServer]     = useState("all");
  const [search, setSearch]     = useState("");
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await authedFetch("/api/inventory");
      setItems(data.gameItems || data.items || []);
      setEquipped(data.equipped || data.equip || {});
    } catch (e) {
      setError("Не удалось загрузить инвентарь");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleEquip = async (item) => {
    if (busy) return;
    setBusy(item.id);
    try {
      await authedFetch("/api/inventory/equip", {
        method: "POST",
        body: JSON.stringify({ itemId: item.id, type: "game" }),
      });
      setEquipped(prev => ({ ...prev, [item.category]: item.id }));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const handleUnequip = async (item) => {
    if (busy) return;
    setBusy(item.id);
    try {
      await authedFetch("/api/inventory/unequip", {
        method: "POST",
        body: JSON.stringify({ type: item.category }),
      });
      setEquipped(prev => {
        const next = { ...prev };
        delete next[item.category];
        return next;
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  // Filter
  let filtered = items;
  if (activeCategory !== "all") {
    const catMap = { armor: "Броня", weapon: "Оружие", pet: "Питомцы", effect: "Эффекты" };
    filtered = filtered.filter(i => i.category === catMap[activeCategory]);
  }
  if (activeServer !== "all") {
    filtered = filtered.filter(i => i.server === activeServer);
  }
  if (search.trim()) {
    const q = search.toLowerCase();
    filtered = filtered.filter(i => i.name.toLowerCase().includes(q) || (i.desc || "").toLowerCase().includes(q));
  }

  const counts = {
    all: items.length,
    armor:  items.filter(i => i.category === "Броня").length,
    weapon: items.filter(i => i.category === "Оружие").length,
    pet:    items.filter(i => i.category === "Питомцы").length,
    effect: items.filter(i => i.category === "Эффекты").length,
  };

  return (
    <div className="flex h-full">
      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="flex items-center gap-3 px-5 pt-4 pb-3 flex-shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
        >
          {/* Search */}
          <div className="relative flex-1 max-w-[220px]">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/20" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Найти предмет…"
              className="w-full h-8 pl-8 pr-3 rounded-lg text-[11px] text-white/80 placeholder:text-white/20 outline-none"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
            />
          </div>

          {/* Server filter */}
          <div className="flex items-center gap-1">
            {SERVER_FILTERS.map(s => (
              <button key={s.id} onClick={() => setActiveServer(s.id)}
                className="px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all"
                style={{
                  background: activeServer === s.id ? "rgba(255,255,255,0.08)" : "transparent",
                  color: activeServer === s.id ? "#fff" : "rgba(255,255,255,0.3)",
                }}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Stats */}
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[11px] font-bold text-white tabular-nums">{items.length}</span>
            <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.25)" }}>предметов</span>
          </div>
        </div>

        {/* Category tabs */}
        <div className="flex items-center gap-1 px-5 pt-3 pb-2 flex-shrink-0 overflow-x-auto">
          {Object.entries(CATEGORY_META).map(([id, meta]) => {
            const Icon = meta.icon;
            const active = activeCategory === id;
            const count = counts[id] || 0;
            return (
              <button key={id} onClick={() => setActiveCategory(id)}
                className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all whitespace-nowrap"
                style={{
                  color: active ? meta.color : "rgba(255,255,255,0.3)",
                  background: active ? `${meta.color}15` : "transparent",
                }}
              >
                <Icon size={12} />
                {meta.label}
                <span className="text-[9px] tabular-nums"
                  style={{ color: active ? `${meta.color}99` : "rgba(255,255,255,0.15)" }}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Grid */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-4">
          {error && (
            <div className="rounded-lg px-3 py-2 text-[11px] mb-3"
              style={{ background: "rgba(239,68,68,0.08)", color: "#fca5a5" }}>
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-16 text-white/30 text-[12px] gap-2">
              <Loader2 size={14} className="animate-spin" /> Загружаем инвентарь…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Package size={32} style={{ color: "rgba(255,255,255,0.1)" }} />
              <p className="text-[12px]" style={{ color: "rgba(255,255,255,0.25)" }}>
                {items.length === 0 ? "Инвентарь пуст" : "Ничего не найдено"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
              <AnimatePresence mode="popLayout">
                {filtered.map(item => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    equipped={equipped[item.category] === item.id}
                    onEquip={handleEquip}
                    onUnequip={handleUnequip}
                    busy={busy === item.id}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* Detail sidebar */}
      <AnimatePresence>
        {selected && (
          <div className="w-[280px] flex-shrink-0 p-4"
            style={{ borderLeft: "1px solid rgba(255,255,255,0.04)" }}>
            <ItemDetail
              item={selected}
              equipped={equipped[selected.category] === selected.id}
              onEquip={handleEquip}
              onUnequip={handleUnequip}
              busy={busy === selected.id}
              onClose={() => setSelected(null)}
            />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
