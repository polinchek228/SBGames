import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, ArrowUpDown, Loader2, Package, X,
  Frame, Image, Sparkles, Award, LayoutGrid,
  Filter, Tag, GripVertical,
} from "lucide-react";
import { authedFetch } from "../lib/api.js";
import { LIBRARY_CATALOG, RARITIES } from "./catalog.js";

/* ── Type metadata ────────────────────────────────────────────────────────── */

const TYPE_META = {
  all:              { label: "Все",         icon: LayoutGrid, color: "#94a3b8" },
  frame:            { label: "Рамки",       icon: Frame,      color: "#3b82f6" },
  background:       { label: "Фоны",        icon: Image,      color: "#6366f1" },
  avatar_animated:  { label: "Анимации",    icon: Sparkles,   color: "#f59e0b" },
  badge:            { label: "Бейджи",      icon: Award,      color: "#ef4444" },
};

const SORT_OPTIONS = [
  { id: "price_asc",  label: "Цена ↑" },
  { id: "price_desc", label: "Цена ↓" },
  { id: "name",       label: "А-Я" },
];

/* ── Item visual previews ─────────────────────────────────────────────────── */

function FramePreview({ color, name }) {
  return (
    <div className="relative w-[80px] h-[80px]">
      <div className="absolute -inset-3 rounded-2xl"
        style={{
          background: `radial-gradient(ellipse, ${color}30, transparent 70%)`,
          filter: "blur(8px)",
        }} />
      <div className="absolute -inset-1.5 rounded-[20px]"
        style={{
          background: `linear-gradient(135deg, ${color}, ${color}55, ${color})`,
          boxShadow: `0 0 24px ${color}30, inset 0 0 16px ${color}15`,
        }} />
      <div className="absolute -inset-0.5 rounded-[17px]"
        style={{
          background: `conic-gradient(from 45deg, ${color}90, transparent 25%, ${color}60 50%, transparent 75%, ${color}90)`,
        }} />
      <div className="relative w-full h-full rounded-[15px] flex items-center justify-center overflow-hidden"
        style={{ background: "linear-gradient(160deg, #0c0c12, #08080e)", border: `1px solid ${color}20` }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.3 }}>
          <circle cx="12" cy="8" r="4" fill={color} />
          <path d="M4 20c0-4.4 3.6-8 8-8s8 3.6 8 8" fill={color} />
        </svg>
      </div>
    </div>
  );
}

function BackgroundPreview({ color }) {
  return (
    <div className="w-[80px] h-[56px] rounded-xl overflow-hidden relative"
      style={{ border: `1.5px solid ${color}18`, boxShadow: `0 0 20px ${color}10` }}>
      <div className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse at 25% 20%, ${color}55 0%, transparent 55%),
            radial-gradient(ellipse at 75% 80%, ${color}35 0%, transparent 50%),
            radial-gradient(ellipse at 50% 50%, ${color}15 0%, transparent 70%),
            linear-gradient(160deg, #06060c 0%, #0a0a18 50%, #04040a 100%)
          `,
        }} />
      <div className="absolute inset-0"
        style={{
          background: `radial-gradient(1px 1px at 20% 30%, ${color}80, transparent),
                       radial-gradient(1px 1px at 60% 20%, ${color}60, transparent),
                       radial-gradient(1px 1px at 80% 60%, ${color}50, transparent),
                       radial-gradient(1px 1px at 40% 70%, ${color}40, transparent)`,
        }} />
    </div>
  );
}

function AnimatedPreview({ color }) {
  return (
    <div className="relative w-[80px] h-[80px]">
      <div className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(from 0deg, ${color}, ${color}20, ${color}80, ${color}20, ${color})`,
          animation: "spin 3s linear infinite",
          filter: "blur(1.5px)",
        }} />
      <div className="absolute inset-[4px] rounded-full" style={{ background: "#0a0a10" }} />
      <div className="absolute inset-[4px] rounded-full"
        style={{
          background: `radial-gradient(circle, ${color}30, transparent 70%)`,
          animation: "pulse 2s ease-in-out infinite",
        }} />
      <div className="relative w-full h-full rounded-full flex items-center justify-center">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.4 }}>
          <circle cx="12" cy="8" r="4" fill={color} />
          <path d="M4 20c0-4.4 3.6-8 8-8s8 3.6 8 8" fill={color} />
        </svg>
      </div>
    </div>
  );
}

function BadgePreview({ color, name }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl"
      style={{
        background: `linear-gradient(135deg, ${color}20, ${color}08)`,
        border: `1.5px solid ${color}35`,
        boxShadow: `0 0 20px ${color}12`,
      }}>
      <div className="w-6 h-6 rounded-full flex items-center justify-center"
        style={{ background: `${color}18` }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill={color}>
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      </div>
      <span className="text-[11px] font-bold tracking-wide uppercase" style={{ color }}>{name}</span>
    </div>
  );
}

function ItemVisual({ type, color, name }) {
  switch (type) {
    case "frame":           return <FramePreview color={color} name={name} />;
    case "background":      return <BackgroundPreview color={color} />;
    case "avatar_animated": return <AnimatedPreview color={color} />;
    case "badge":           return <BadgePreview color={color} name={name} />;
    default:                return <Package size={32} style={{ color: "rgba(255,255,255,0.15)" }} />;
  }
}

/* ── Large visual for modal ───────────────────────────────────────────────── */

function ItemVisualLarge({ type, color, name }) {
  switch (type) {
    case "frame":
      return (
        <div className="relative w-[160px] h-[160px]">
          <div className="absolute -inset-6 rounded-3xl"
            style={{ background: `radial-gradient(ellipse, ${color}35, transparent 70%)`, filter: "blur(12px)" }} />
          <div className="absolute -inset-3 rounded-[28px]"
            style={{ background: `linear-gradient(135deg, ${color}, ${color}55, ${color})`, boxShadow: `0 0 40px ${color}40, inset 0 0 24px ${color}20` }} />
          <div className="absolute -inset-1 rounded-[24px]"
            style={{ background: `conic-gradient(from 45deg, ${color}90, transparent 25%, ${color}60 50%, transparent 75%, ${color}90)` }} />
          <div className="relative w-full h-full rounded-[20px] flex items-center justify-center overflow-hidden"
            style={{ background: "linear-gradient(160deg, #0c0c12, #08080e)", border: `1.5px solid ${color}25` }}>
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.25 }}>
              <circle cx="12" cy="8" r="4" fill={color} />
              <path d="M4 20c0-4.4 3.6-8 8-8s8 3.6 8 8" fill={color} />
            </svg>
          </div>
        </div>
      );
    case "background":
      return (
        <div className="w-[200px] h-[130px] rounded-2xl overflow-hidden relative"
          style={{ border: `2px solid ${color}20`, boxShadow: `0 0 40px ${color}15` }}>
          <div className="absolute inset-0"
            style={{
              background: `
                radial-gradient(ellipse at 25% 20%, ${color}55 0%, transparent 55%),
                radial-gradient(ellipse at 75% 80%, ${color}35 0%, transparent 50%),
                radial-gradient(ellipse at 50% 50%, ${color}15 0%, transparent 70%),
                linear-gradient(160deg, #06060c 0%, #0a0a18 50%, #04040a 100%)
              `,
            }} />
          <div className="absolute inset-0"
            style={{
              background: `radial-gradient(2px 2px at 20% 30%, ${color}80, transparent),
                           radial-gradient(2px 2px at 60% 20%, ${color}60, transparent),
                           radial-gradient(2px 2px at 80% 60%, ${color}50, transparent),
                           radial-gradient(2px 2px at 40% 70%, ${color}40, transparent)`,
            }} />
        </div>
      );
    case "avatar_animated":
      return (
        <div className="relative w-[140px] h-[140px]">
          <div className="absolute inset-0 rounded-full"
            style={{
              background: `conic-gradient(from 0deg, ${color}, ${color}20, ${color}80, ${color}20, ${color})`,
              animation: "spin 3s linear infinite",
              filter: "blur(2px)",
            }} />
          <div className="absolute inset-[6px] rounded-full" style={{ background: "#0a0a10" }} />
          <div className="absolute inset-[6px] rounded-full"
            style={{ background: `radial-gradient(circle, ${color}30, transparent 70%)`, animation: "pulse 2s ease-in-out infinite" }} />
          <div className="relative w-full h-full rounded-full flex items-center justify-center">
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.35 }}>
              <circle cx="12" cy="8" r="4" fill={color} />
              <path d="M4 20c0-4.4 3.6-8 8-8s8 3.6 8 8" fill={color} />
            </svg>
          </div>
        </div>
      );
    case "badge":
      return (
        <div className="flex items-center gap-3 px-8 py-5 rounded-2xl"
          style={{
            background: `linear-gradient(135deg, ${color}20, ${color}08)`,
            border: `2px solid ${color}35`,
            boxShadow: `0 0 30px ${color}15`,
          }}>
          <div className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: `${color}18` }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill={color}>
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </div>
          <span className="text-[18px] font-black tracking-wide uppercase" style={{ color }}>{name}</span>
        </div>
      );
    default:
      return <Package size={64} style={{ color: "rgba(255,255,255,0.15)" }} />;
  }
}

/* ── Equip slot (drop target) ─────────────────────────────────────────────── */

function EquipSlot({ type, meta, equippedItem, onDrop, onClear }) {
  const [over, setOver] = useState(false);

  const handleDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setOver(true); };
  const handleDragLeave = () => setOver(false);
  const handleDrop = (e) => {
    e.preventDefault();
    setOver(false);
    const itemId = e.dataTransfer.getData("text/plain");
    if (itemId) onDrop(itemId, type);
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="relative flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-150 cursor-pointer group"
      style={{
        background: over ? `${meta.color}18` : equippedItem ? `${equippedItem.color}0a` : "rgba(255,255,255,0.025)",
        border: over ? `1.5px dashed ${meta.color}50` : equippedItem ? `1px solid ${equippedItem.color}20` : "1px solid rgba(255,255,255,0.04)",
      }}
    >
      <meta.icon size={13} style={{ color: over ? meta.color : equippedItem ? equippedItem.color : "rgba(255,255,255,0.15)" }} />
      {equippedItem ? (
        <>
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: equippedItem.color, boxShadow: `0 0 6px ${equippedItem.color}60` }} />
          <span className="text-[10px] font-semibold truncate" style={{ color: equippedItem.color }}>{equippedItem.name}</span>
          <button
            onClick={() => onClear(type)}
            className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded"
            style={{ color: "rgba(255,255,255,0.3)" }}
          >
            <X size={10} />
          </button>
        </>
      ) : (
        <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.15)" }}>
          {over ? "Отпусти сюда" : `Перетащи ${meta.label.toLowerCase()}`}
        </span>
      )}
    </div>
  );
}

/* ── Item Modal ────────────────────────────────────────────────────────────── */

function ItemModal({ item, isOwned, isEquipped, canAfford, isAdmin, busy, onBuy, onEquip, onUnequip, onClose }) {
  if (!item) return null;
  const meta = TYPE_META[item.type] || TYPE_META.all;
  const rarity = RARITIES[item.rarity];

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }} />

      {/* Modal */}
      <motion.div
        className="relative w-full max-w-[480px] rounded-3xl overflow-hidden"
        style={{
          background: "linear-gradient(180deg, rgba(20,20,28,0.98) 0%, rgba(12,12,18,0.99) 100%)",
          border: `1.5px solid ${item.color}20`,
          boxShadow: `0 0 60px ${item.color}15, 0 25px 50px rgba(0,0,0,0.5)`,
        }}
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 p-1.5 rounded-xl transition-all"
          style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)" }}
        >
          <X size={14} />
        </button>

        {/* Preview area */}
        <div className="relative h-[220px] flex items-center justify-center"
          style={{
            background: `radial-gradient(ellipse at 50% 120%, ${item.color}18 0%, transparent 70%), rgba(0,0,0,0.3)`,
          }}>
          <ItemVisualLarge type={item.type} color={item.color} name={item.name} />
        </div>

        {/* Content */}
        <div className="p-5 flex flex-col gap-3">
          {/* Type + rarity */}
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider"
              style={{ background: `${meta.color}18`, color: meta.color, border: `1px solid ${meta.color}25` }}>
              {meta.label}
            </span>
            {rarity && (
              <span className="text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider"
                style={{ background: `${rarity.color}18`, color: rarity.color, border: `1px solid ${rarity.color}25` }}>
                {rarity.label}
              </span>
            )}
          </div>

          {/* Name */}
          <h3 className="text-[18px] font-black text-white">{item.name}</h3>

          {/* Description */}
          {item.desc && (
            <p className="text-[12px] leading-relaxed" style={{ color: "rgba(255,255,255,0.4)" }}>
              {item.desc}
            </p>
          )}

          {/* Price + actions */}
          <div className="flex items-center gap-3 mt-2">
            <div className="flex items-center gap-2">
              <img src="/money.png" alt="" className="w-4 h-4"
                onError={(e) => { e.currentTarget.style.display = "none"; }} />
              <span className="text-[16px] font-black tabular-nums"
                style={{ color: isOwned ? "#4ade80" : canAfford ? "rgba(255,255,255,0.8)" : "rgba(248,113,113,0.6)" }}>
                {isOwned ? "Куплено" : item.price.toLocaleString("en-US")}
              </span>
              {!isOwned && <span className="text-[10px] text-white/20">SBT</span>}
            </div>

            <div className="flex-1" />

            {isOwned ? (
              isEquipped ? (
                <button
                  onClick={() => onUnequip(item.type)}
                  disabled={busy}
                  className="px-5 py-2.5 rounded-xl text-[12px] font-bold transition-all"
                  style={{ background: "rgba(239,68,68,0.2)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.3)" }}
                >
                  {busy ? "…" : "Снять"}
                </button>
              ) : (
                <button
                  onClick={() => onEquip(item)}
                  disabled={busy}
                  className="px-5 py-2.5 rounded-xl text-[12px] font-bold text-white transition-all"
                  style={{ background: `${item.color}cc`, boxShadow: `0 0 20px ${item.color}40` }}
                >
                  {busy ? "…" : "Экипировать"}
                </button>
              )
            ) : (
              <button
                onClick={() => onBuy(item)}
                disabled={busy || !canAfford}
                className="px-5 py-2.5 rounded-xl text-[12px] font-bold text-white disabled:opacity-40 transition-all"
                style={{ background: `${item.color}cc`, boxShadow: `0 0 20px ${item.color}40` }}
              >
                {busy ? "…" : "Купить"}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ── Card component ───────────────────────────────────────────────────────── */

const LibraryCard = React.forwardRef(function LibraryCard({ item, isOwned, isEquipped, canAfford, isAdmin, busy, onBuy, onEquip, onUnequip, onOpen }, ref) {
  const meta = TYPE_META[item.type] || TYPE_META.all;
  const rarity = RARITIES[item.rarity];

  const handleDragStart = (e) => {
    if (!isOwned) { e.preventDefault(); return; }
    e.dataTransfer.setData("text/plain", item.id);
    e.dataTransfer.effectAllowed = "move";
  };

  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="group relative rounded-2xl overflow-hidden cursor-pointer transition-all duration-200"
      draggable={isOwned}
      onDragStart={handleDragStart}
      onClick={() => onOpen(item)}
      style={{
        background: isEquipped ? `${item.color}0a` : "rgba(255,255,255,0.025)",
        border: isEquipped ? `1.5px solid ${item.color}35` : "1.5px solid rgba(255,255,255,0.04)",
      }}
    >
      {/* Equipped glow ring */}
      {isEquipped && (
        <div className="absolute -inset-px rounded-2xl pointer-events-none"
          style={{
            background: `conic-gradient(from 0deg, ${item.color}15, transparent 25%, ${item.color}10 50%, transparent 75%, ${item.color}15)`,
            animation: "spin 8s linear infinite",
          }} />
      )}

      {/* Drag handle indicator */}
      {isOwned && (
        <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-40 transition-opacity">
          <GripVertical size={12} className="text-white" />
        </div>
      )}

      {/* Visual area */}
      <div className="relative h-[110px] flex items-center justify-center overflow-hidden"
        style={{
          background: `radial-gradient(ellipse at 50% 120%, ${item.color}12 0%, transparent 70%), rgba(0,0,0,0.3)`,
        }}>
        <ItemVisual type={item.type} color={item.color} name={item.name} />

        {/* Type badge */}
        <span className="absolute top-2 left-2 text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider"
          style={{ background: `${meta.color}18`, color: meta.color, border: `1px solid ${meta.color}25` }}>
          {meta.label}
        </span>

        {/* Rarity badge */}
        {rarity && (
          <span className="absolute bottom-2 left-2 text-[7px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider"
            style={{ background: `${rarity.color}15`, color: rarity.color }}>
            {rarity.label}
          </span>
        )}

        {/* Status badges */}
        {isEquipped && (
          <span className="absolute top-2 right-2 text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider"
            style={{ background: "rgba(34,197,94,0.25)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.3)" }}>
            ЭКИП.
          </span>
        )}
        {!isOwned && !canAfford && (
          <span className="absolute top-2 right-2 text-[8px] font-black px-2 py-0.5 rounded-full"
            style={{ background: "rgba(239,68,68,0.15)", color: "#fca5a5" }}>
            МАЛО СБТ
          </span>
        )}

        {/* Hover overlay — buttons */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(2px)" }}>
          {isOwned ? (
            isEquipped ? (
              <button
                onClick={(e) => { e.stopPropagation(); onUnequip(); }}
                disabled={busy}
                className="px-4 py-2 rounded-xl text-[11px] font-bold transition-all"
                style={{ background: "rgba(239,68,68,0.25)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.3)" }}
              >
                {busy ? "…" : "Снять"}
              </button>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); onEquip(); }}
                disabled={busy}
                className="px-4 py-2 rounded-xl text-[11px] font-bold text-white transition-all"
                style={{ background: `${item.color}cc`, boxShadow: `0 0 16px ${item.color}40` }}
              >
                {busy ? "…" : "Экипировать"}
              </button>
            )
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); onBuy(); }}
              disabled={busy || !canAfford}
              className="px-4 py-2 rounded-xl text-[11px] font-bold text-white disabled:opacity-40 transition-all"
              style={{ background: `${item.color}cc`, boxShadow: `0 0 16px ${item.color}40` }}
            >
              {busy ? "…" : "Купить"}
            </button>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="px-3 py-2.5">
        <p className="text-[12px] font-bold text-white truncate">{item.name}</p>
        {item.desc && (
          <p className="text-[10px] mt-1 leading-relaxed line-clamp-2"
            style={{ color: "rgba(255,255,255,0.3)" }}>
            {item.desc}
          </p>
        )}
        <div className="flex items-center gap-1.5 mt-2">
          <img src="/money.png" alt="" className="w-3 h-3"
            onError={(e) => { e.currentTarget.style.display = "none"; }} />
          <span className="text-[11px] font-bold tabular-nums"
            style={{
              color: isOwned ? "#4ade80" : canAfford ? "rgba(255,255,255,0.6)" : "rgba(248,113,113,0.6)",
            }}>
            {isOwned ? "Куплено" : item.price.toLocaleString("en-US")}
          </span>
        </div>
      </div>
    </motion.div>
  );
});

/* ── Equipped preview strip (with drop slots) ────────────────────────────── */

function EquippedStrip({ equip, onDrop, onClear }) {
  return (
    <div className="flex items-center gap-2 px-5 py-2 flex-shrink-0 overflow-x-auto"
      style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <span className="text-[9px] uppercase tracking-widest font-semibold mr-1 flex-shrink-0"
        style={{ color: "rgba(255,255,255,0.18)" }}>
        Слоты
      </span>
      {Object.entries(TYPE_META).filter(([k]) => k !== "all").map(([type, meta]) => {
        const itemId = equip[type];
        const equippedItem = itemId ? LIBRARY_CATALOG.find(i => i.id === itemId) : null;
        return (
          <EquipSlot
            key={type}
            type={type}
            meta={meta}
            equippedItem={equippedItem}
            onDrop={onDrop}
            onClear={onClear}
          />
        );
      })}
    </div>
  );
}

/* ── Price range filter ───────────────────────────────────────────────────── */

function PriceRange({ min, max, onChange }) {
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        value={min}
        onChange={(e) => onChange(Number(e.target.value), max)}
        placeholder="от"
        className="w-16 h-7 px-2 rounded-lg text-[10px] text-white/60 placeholder:text-white/20 outline-none"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
        min={0}
      />
      <span className="text-[10px] text-white/20">—</span>
      <input
        type="number"
        value={max}
        onChange={(e) => onChange(min, Number(e.target.value))}
        placeholder="до"
        className="w-16 h-7 px-2 rounded-lg text-[10px] text-white/60 placeholder:text-white/20 outline-none"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
        min={0}
      />
    </div>
  );
}

/* ── Main component ───────────────────────────────────────────────────────── */

export default function LibraryTab({ user, equip, setEquip }) {
  const [owned, setOwned]       = useState([]);
  const [activeType, setActiveType] = useState("all");
  const [search, setSearch]     = useState("");
  const [sort, setSort]         = useState("price_asc");
  const [loading, setLoading]   = useState(true);
  const [busy, setBusy]         = useState(null);
  const [error, setError]       = useState(null);
  const [modalItem, setModalItem] = useState(null);
  const [rarityFilter, setRarityFilter] = useState("all");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [shopFilter, setShopFilter] = useState("all"); // "all" | "free" | "paid"

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await authedFetch("/api/inventory");
      setOwned(data.owned || []);
      setEquip((prev) => ({ ...prev, ...(data.equip || {}) }));
    } catch {
      setError("Не удалось загрузить инвентарь");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const isAdmin = user?.role === "admin";
  const balance = user?.balance ?? 0;

  const buy = async (item) => {
    if (busy) return;
    setBusy(item.id);
    try {
      if (isAdmin) {
        setOwned((prev) => [...prev, item.id]);
      } else {
        const r = await authedFetch("/api/inventory/buy", {
          method: "POST",
          body: JSON.stringify({ itemId: item.id }),
        });
        setOwned(r.inventory);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const equipItem = async (item) => {
    if (busy) return;
    setBusy(item.id);
    try {
      if (isAdmin) {
        setEquip((prev) => ({ ...prev, [item.type]: item.id }));
      } else {
        const r = await authedFetch("/api/inventory/equip", {
          method: "POST",
          body: JSON.stringify({ itemId: item.id }),
        });
        setEquip((prev) => ({ ...prev, ...(r.equip || {}) }));
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const unequip = async (type) => {
    if (busy) return;
    setBusy(type);
    try {
      if (isAdmin) {
        setEquip((prev) => {
          const next = { ...prev };
          delete next[type];
          return next;
        });
      } else {
        const r = await authedFetch("/api/inventory/unequip", {
          method: "POST",
          body: JSON.stringify({ type }),
        });
        setEquip((prev) => ({ ...prev, ...(r.equip || {}) }));
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const handleDrop = async (itemId, slotType) => {
    const item = LIBRARY_CATALOG.find(i => i.id === itemId);
    if (!item || item.type !== slotType) return;
    await equipItem(item);
  };

  // filter + sort
  let items = LIBRARY_CATALOG;
  if (activeType !== "all") items = items.filter((i) => i.type === activeType);
  if (rarityFilter !== "all") items = items.filter((i) => i.rarity === rarityFilter);
  if (shopFilter === "free")  items = items.filter((i) => i.price === 0);
  if (shopFilter === "paid")  items = items.filter((i) => i.price > 0);
  if (priceMin) items = items.filter((i) => i.price >= Number(priceMin));
  if (priceMax) items = items.filter((i) => i.price <= Number(priceMax));
  if (search.trim()) {
    const q = search.toLowerCase();
    items = items.filter((i) => i.name.toLowerCase().includes(q) || (i.desc || "").toLowerCase().includes(q));
  }
  if (sort === "price_asc")  items = [...items].sort((a, b) => a.price - b.price);
  if (sort === "price_desc") items = [...items].sort((a, b) => b.price - a.price);
  if (sort === "name")       items = [...items].sort((a, b) => a.name.localeCompare(b.name));

  const counts = {
    all: LIBRARY_CATALOG.length,
    frame: LIBRARY_CATALOG.filter(i => i.type === "frame").length,
    background: LIBRARY_CATALOG.filter(i => i.type === "background").length,
    avatar_animated: LIBRARY_CATALOG.filter(i => i.type === "avatar_animated").length,
    badge: LIBRARY_CATALOG.filter(i => i.type === "badge").length,
  };

  return (
    <div className="flex flex-col h-full">
      {/* ── Top bar ── */}
      <div className="flex items-center gap-3 px-5 pt-4 pb-3 flex-shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        {/* Search */}
        <div className="relative flex-1 max-w-[240px]">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/20" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Найти предмет…"
            className="w-full h-8 pl-8 pr-3 rounded-lg text-[11px] text-white/80 placeholder:text-white/20 outline-none"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
          />
        </div>

        {/* Filter toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[11px] transition-all"
          style={{
            color: showFilters ? "#60a5fa" : "rgba(255,255,255,0.3)",
            background: showFilters ? "rgba(96,165,250,0.1)" : "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <Filter size={12} />
          Фильтры
        </button>

        {/* Sort */}
        <div className="relative">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="h-8 pl-2.5 pr-6 rounded-lg text-[11px] appearance-none cursor-pointer outline-none"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.06)",
              color: "rgba(255,255,255,0.6)",
            }}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}
                style={{ background: "#0e0e12", color: "rgba(255,255,255,0.7)" }}>
                {o.label}
              </option>
            ))}
          </select>
          <ArrowUpDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/20 pointer-events-none" />
        </div>

        {/* Balance */}
        <div className="flex items-center gap-2 ml-auto">
          {isAdmin && (
            <span className="text-[9px] font-bold px-2 py-0.5 rounded"
              style={{ background: "rgba(168,85,247,0.15)", color: "#c084fc", border: "1px solid rgba(168,85,247,0.2)" }}>
              АДМИН
            </span>
          )}
          <div className="flex items-center gap-1.5">
            <img src="/money.png" alt="" className="w-3.5 h-3.5"
              onError={(e) => { e.currentTarget.style.display = "none"; }} />
            <span className="text-[13px] font-black text-white tabular-nums">{balance.toLocaleString("en-US")}</span>
            <span className="text-[9px] text-white/20">SBT</span>
          </div>
        </div>
      </div>

      {/* ── Expanded filters ── */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden flex-shrink-0"
          >
            <div className="flex items-center gap-3 px-5 py-2.5 flex-wrap"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
              {/* Shop filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] uppercase tracking-widest font-semibold mr-0.5"
                  style={{ color: "rgba(255,255,255,0.18)" }}>Магазин</span>
                {[
                  { id: "all",  label: "Все" },
                  { id: "free", label: "Бесплатные" },
                  { id: "paid", label: "Платные" },
                ].map(o => (
                  <button
                    key={o.id}
                    onClick={() => setShopFilter(o.id)}
                    className="px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all"
                    style={{
                      color: shopFilter === o.id ? "#60a5fa" : "rgba(255,255,255,0.2)",
                      background: shopFilter === o.id ? "rgba(96,165,250,0.1)" : "transparent",
                      border: `1px solid ${shopFilter === o.id ? "rgba(96,165,250,0.3)" : "rgba(255,255,255,0.04)"}`,
                    }}
                  >
                    {o.label}
                  </button>
                ))}
              </div>

              <div className="w-px h-5 mx-1" style={{ background: "rgba(255,255,255,0.06)" }} />

              {/* Rarity chips */}
              <div className="flex items-center gap-1.5">
                <Tag size={11} className="text-white/20" />
                {Object.entries(RARITIES).map(([key, r]) => (
                  <button
                    key={key}
                    onClick={() => setRarityFilter(rarityFilter === key ? "all" : key)}
                    className="px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all"
                    style={{
                      color: rarityFilter === key ? r.color : "rgba(255,255,255,0.2)",
                      background: rarityFilter === key ? `${r.color}15` : "transparent",
                      border: `1px solid ${rarityFilter === key ? `${r.color}30` : "rgba(255,255,255,0.04)"}`,
                    }}
                  >
                    {r.label}
                  </button>
                ))}
              </div>

              {/* Price range */}
              <PriceRange min={priceMin} max={priceMax} onChange={(min, max) => { setPriceMin(min); setPriceMax(max); }} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Equipped strip with drop slots ── */}
      <EquippedStrip equip={equip} onDrop={handleDrop} onClear={(type) => unequip(type)} />

      {/* ── Type tabs ── */}
      <div className="flex items-center gap-1 px-5 pt-3 pb-2 flex-shrink-0 overflow-x-auto">
        {Object.entries(TYPE_META).map(([type, meta]) => {
          const Icon = meta.icon;
          const active = activeType === type;
          return (
            <button
              key={type}
              onClick={() => setActiveType(type)}
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
                {counts[type]}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Content ── */}
      <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-4">
        {error && (
          <div className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-[11px] mb-3"
            style={{ background: "rgba(239,68,68,0.08)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.12)" }}>
            {error}
            <button onClick={() => setError(null)} className="ml-auto"><X size={12} /></button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20 text-white/30 text-[12px] gap-2">
            <Loader2 size={14} className="animate-spin" /> Загружаем инвентарь…
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Package size={36} style={{ color: "rgba(255,255,255,0.08)" }} />
            <p className="text-[12px]" style={{ color: "rgba(255,255,255,0.2)" }}>
              {search ? "Ничего не найдено" : "Каталог пуст"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            <AnimatePresence mode="popLayout">
              {items.map((item) => {
                const isOwned  = isAdmin || owned.includes(item.id);
                const isEquip  = equip[item.type] === item.id;
                const canAfford = isAdmin || balance >= item.price;

                return (
                  <LibraryCard
                    key={item.id}
                    item={item}
                    isOwned={isOwned}
                    isEquipped={isEquip}
                    canAfford={canAfford}
                    isAdmin={isAdmin}
                    busy={busy === item.id}
                    onBuy={() => buy(item)}
                    onEquip={() => equipItem(item)}
                    onUnequip={() => unequip(item.type)}
                    onOpen={() => setModalItem(item)}
                  />
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* ── Item modal ── */}
      <AnimatePresence>
        {modalItem && (
          <ItemModal
            item={modalItem}
            isOwned={isAdmin || owned.includes(modalItem.id)}
            isEquipped={equip[modalItem.type] === modalItem.id}
            canAfford={isAdmin || balance >= modalItem.price}
            isAdmin={isAdmin}
            busy={busy === modalItem.id}
            onBuy={(item) => { buy(item); setModalItem(null); }}
            onEquip={(item) => { equipItem(item); setModalItem(null); }}
            onUnequip={(type) => { unequip(type); setModalItem(null); }}
            onClose={() => setModalItem(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
