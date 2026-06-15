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

/* ── Item visual previews (clean, Steam-style) ──────────────────────────────── */

function FramePreview({ color, item, large }) {
  const outerSz = large ? 160 : 120;

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <div 
        className="relative flex items-center justify-center transition-all duration-300"
        style={{ 
          width: outerSz, 
          height: outerSz,
          borderRadius: 12,
          background: "rgba(255,255,255,0.01)",
          boxShadow: `inset 0 0 16px ${color}05`,
        }}
      >
        <div 
          className="absolute inset-4 rounded-full pointer-events-none opacity-20" 
          style={{ background: `radial-gradient(circle, ${color}25 0%, transparent 75%)`, filter: "blur(8px)" }} 
        />

        {/* Mini avatar preview in top-left corner (Steam-style) */}
        {!large && item?.image && (
          <div className="absolute top-1 left-1 w-7 h-7 rounded-lg overflow-hidden border border-white/5 z-20 shadow-lg">
            <img src="/logo.jpg" alt="" className="w-full h-full object-cover opacity-80" />
            <img src={item.image} alt="" className="absolute inset-0 w-full h-full object-cover" />
          </div>
        )}
        
        {/* The Frame Image itself — full size inside preview */}
        {item?.image ? (
          <img
            src={item.image}
            alt={item.name}
            className="w-[92%] h-[92%] object-contain z-10 select-none pointer-events-none"
          />
        ) : (
          <div
            className="w-[85%] h-[85%] z-10"
            style={{
              border: `3px solid ${color}`,
              borderRadius: 14,
              boxShadow: `0 0 16px ${color}35`,
            }}
          />
        )}
      </div>
    </div>
  );
}

function BackgroundPreview({ color, item, large }) {
  if (item?.video) {
    return (
      <div className="w-full h-full relative bg-black flex items-center justify-center overflow-hidden">
        <video
          src={item.video}
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover opacity-80"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent pointer-events-none" />
      </div>
    );
  }

  return (
    <div className="w-[80px] h-[56px] rounded-xl overflow-hidden relative"
      style={{ border: `1.5px solid ${color}20` }}>
      <div className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse at 25% 20%, ${color}55 0%, transparent 55%),
            radial-gradient(ellipse at 75% 80%, ${color}35 0%, transparent 50%),
            radial-gradient(ellipse at 50% 50%, ${color}15 0%, transparent 70%),
            linear-gradient(160deg, #06060c 0%, #0a0a18 50%, #04040a 100%)
          `,
        }} />
      {/* Static particles */}
      <div className="absolute inset-0"
        style={{
          background: `radial-gradient(1.5px 1.5px at 20% 30%, ${color}80, transparent),
                       radial-gradient(1px 1px at 60% 20%, ${color}60, transparent),
                       radial-gradient(1.5px 1.5px at 80% 60%, ${color}50, transparent),
                       radial-gradient(1px 1px at 40% 75%, ${color}40, transparent)`,
        }} />
    </div>
  );
}

// Badge Icon Helper with actual SVG shapes
function BadgeIcon({ name, color, size }) {
  const normName = name?.toLowerCase() || "";
  if (normName.includes("сердце") || normName.includes("heart") || normName.includes("cross")) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
        <path d="M12 2v6h-6v4h6v6h4v-6h6v-4h-6v-6z" />
      </svg>
    );
  }
  if (normName.includes("звезда") || normName.includes("star")) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
        <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
      </svg>
    );
  }
  if (normName.includes("пламя") || normName.includes("flame")) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
        <path d="M17.66 11.57c-.77-3.95-2.5-6.86-5.65-8.57 0 0 .1 3.11-1.9 4.67-1.9 1.48-3.8 3.53-3.8 6.42 0 3.47 2.8 6.28 6.27 6.28 3.47 0 6.27-2.81 6.27-6.28 0-1-.29-1.91-.79-2.72-.19.2-.38.4-.59.59-.44.44-1.02.73-1.67.73-1.3 0-2.35-1.05-2.35-2.35 0-.65.26-1.24.69-1.67.2-.2.4-.38.59-.59.33-.33.53-.78.53-1.27v-.71c-.01-.01-.01-.01-.01-.02-.1-.01-.2-.01-.3-.01-.89 0-1.74.34-2.38.96-.33.32-.59.7-.77 1.13-.19.46-.29.96-.29 1.47 0 .54.12 1.05.34 1.51.21.46.52.86.91 1.18.39.32.86.55 1.37.68.5.13 1.03.18 1.56.14.78-.06 1.51-.38 2.07-.9.55-.52.92-1.22 1.02-2.02.04-.32.06-.65.06-.98 0-.96-.4-1.83-1.05-2.48z" />
      </svg>
    );
  }
  if (normName.includes("бриллиант") || normName.includes("diamond")) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
        <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14l-4-4h8l-4 4zm-4-6l4-4 4 4H8z" />
      </svg>
    );
  }
  if (normName.includes("череп") || normName.includes("skull")) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
        <path d="M12 2C7.03 2 3 6.03 3 11c0 3.32 1.82 6.22 4.5 7.75V21c0 .55.45 1 1 1h7c.55 0 1-.45 1-1v-2.25c2.68-1.53 4.5-4.43 4.5-7.75 0-4.97-4.03-9-9-9zm-3 9c-.83 0-1.5-.67-1.5-1.5S8.17 8 9 8s1.5.67 1.5 1.5S9.83 11 9 11zm6 0c-.83 0-1.5-.67-1.5-1.5S14.17 8 15 8s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

function AnimatedPreview({ color, large }) {
  const outerSz = large ? 110 : 78;
  const br = large ? 18 : 12;

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <div 
        className="relative flex items-center justify-center" 
        style={{ 
          width: outerSz, 
          height: outerSz,
          background: `radial-gradient(circle, ${color}22 0%, transparent 70%)` 
        }}
      >
        {/* Real Avatar */}
        <img
          src="/logo.jpg"
          alt="Avatar"
          className="object-cover"
          style={{
            width: outerSz - 8,
            height: outerSz - 8,
            borderRadius: br,
            border: `2px solid ${color}80`,
            boxShadow: `0 0 16px ${color}35`,
          }}
          onError={(e) => {
            e.currentTarget.src = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80";
          }}
        />
      </div>
    </div>
  );
}

function BadgePreview({ color, name, large, icon }) {
  const sz = large ? 48 : 34;
  const br = large ? 16 : 12;

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <div 
        className="flex items-center justify-center relative transition-all duration-300"
        style={{
          width: large ? 110 : 78,
          height: large ? 110 : 78,
          borderRadius: br,
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.04)",
          boxShadow: `inset 0 0 12px ${color}08`,
        }}
      >
        <div 
          className="absolute inset-2 rounded-full pointer-events-none opacity-40" 
          style={{ background: `radial-gradient(circle, ${color}33 0%, transparent 75%)`, filter: "blur(6px)" }} 
        />
        <div className="relative z-10 flex flex-col items-center gap-1.5">
          {icon ? (
            <img src={icon} alt={name} className="object-contain drop-shadow-lg"
              style={{ width: sz, height: sz }}
              onError={e => { e.currentTarget.style.display = "none"; }} />
          ) : (
            <BadgeIcon name={name} color={color} size={sz} />
          )}
          {large && (
            <span className="text-[10px] font-black uppercase tracking-wider" style={{ color, textShadow: `0 0 8px ${color}40` }}>
              {name}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function ItemVisual({ type, color, name, item, large = false }) {
  switch (type) {
    case "frame":           return <FramePreview color={color} item={item} large={large} />;
    case "background":      return <BackgroundPreview color={color} item={item} large={large} />;
    case "avatar_animated": return <AnimatedPreview color={color} large={large} />;
    case "badge":           return <BadgePreview color={color} name={name} large={large} icon={item?.icon} />;
    default:                return <Package size={32} style={{ color: "rgba(255,255,255,0.4)" }} />;
  }
}

/* ── Large visual for modal ───────────────────────────────────────────────── */

function ItemVisualLarge({ type, color, name, item }) {
  return <ItemVisual type={type} color={color} name={name} item={item} large />;
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
        background: over ? `${meta.color}18` : equippedItem ? `${equippedItem.color}0a` : "rgba(255,255,255,0.06)",
        border: over ? `1.5px dashed ${meta.color}50` : equippedItem ? `1px solid ${equippedItem.color}20` : "1px solid rgba(255,255,255,0.12)",
      }}
    >
      <meta.icon size={13} style={{ color: over ? meta.color : equippedItem ? equippedItem.color : "rgba(255,255,255,0.4)" }} />
      {equippedItem ? (
        <>
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: equippedItem.color, boxShadow: `0 0 6px ${equippedItem.color}60` }} />
          <span className="text-[10px] font-semibold truncate" style={{ color: equippedItem.color }}>{equippedItem.name}</span>
          <button
            onClick={() => onClear(type)}
            className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded"
            style={{ color: "rgba(255,255,255,0.5)" }}
          >
            <X size={10} />
          </button>
        </>
      ) : (
        <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>
          {over ? "Отпусти сюда" : `Перетащи ${meta.label.toLowerCase()}`}
        </span>
      )}
    </div>
  );
}

/* ── Item Modal ────────────────────────────────────────────────────────────── */

function ItemModal({ item, isOwned, isEquipped, canAfford, isAdmin, busy, onBuy, onEquip, onUnequip, onClose }) {
  if (!item) return null;

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.85)" }} />

      {/* Ambient glow behind modal */}
      <div className="absolute pointer-events-none"
        style={{
          width: 340, height: 340,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${item.color}25 0%, transparent 70%)`,
          filter: "blur(40px)",
        }} />

      {/* Modal */}
      <motion.div
        className="relative w-full max-w-[340px] rounded-2xl overflow-hidden"
        style={{
          background: "linear-gradient(180deg, #111118 0%, #0d0d12 100%)",
          boxShadow: `0 0 0 1px rgba(255,255,255,0.06), 0 40px 80px rgba(0,0,0,0.85), 0 0 80px ${item.color}18`,
        }}
        initial={{ scale: 0.92, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 20 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-30 w-7 h-7 rounded-lg flex items-center justify-center transition-all"
          style={{ background: "rgba(0,0,0,0.4)", color: "rgba(255,255,255,0.6)", backdropFilter: "blur(8px)" }}
          onMouseEnter={e => { e.currentTarget.style.color = "rgba(255,255,255,0.9)"; }}
          onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.6)"; }}
        >
          <X size={13} />
        </button>

        {/* Preview — full bleed */}
        <div className="relative overflow-hidden"
          style={{ height: item.type === "background" ? 240 : 210, background: item.type === "background" ? "#000" : "#09090e" }}>

          {/* Colored ambient inside preview */}
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: `radial-gradient(ellipse at 50% 80%, ${item.color}18 0%, transparent 65%)` }} />

          <ItemVisual type={item.type} color={item.color} name={item.name} item={item} large />

          {/* Gradient fade into info section */}
          <div className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none"
            style={{ background: "linear-gradient(to bottom, transparent 0%, #0d0d12 100%)" }} />

          {/* Equipped badge */}
          {isEquipped && (
            <div className="absolute top-3 left-3 z-20">
              <span className="text-[8px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider"
                style={{ background: "rgba(34,197,94,0.2)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.25)", backdropFilter: "blur(6px)" }}>
                ✓ В экипировке
              </span>
            </div>
          )}
        </div>

        {/* Info — overlaps preview via negative margin */}
        <div className="px-5 pb-5 -mt-8 relative z-10 flex flex-col gap-3.5">

          {/* Name */}
          <h3 className="text-[22px] font-black text-white leading-tight tracking-tight"
            style={{ textShadow: `0 0 40px ${item.color}40` }}>
            {item.name}
          </h3>

          {/* Divider */}
          <div className="h-px" style={{ background: "rgba(255,255,255,0.06)" }} />

          {/* Price row */}
          <div className="flex items-center justify-between">
            {isOwned ? (
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span className="text-[12px] font-bold" style={{ color: "rgba(255,255,255,0.65)" }}>Уже в коллекции</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <img src="/money.png" alt="" className="w-4 h-4 object-contain"
                  onError={(e) => { e.currentTarget.style.display = "none"; }} />
                <span className="text-[18px] font-black tabular-nums leading-none"
                  style={{ color: canAfford ? "rgba(255,255,255,0.9)" : "#f87171" }}>
                  {item.price.toLocaleString("en-US")}
                </span>
                <span className="text-[10px] font-semibold" style={{ color: "rgba(255,255,255,0.5)" }}>SBT</span>
              </div>
            )}
          </div>

          {/* Action button */}
          {isOwned ? (
            isEquipped ? (
              <button
                onClick={() => onUnequip(item.type)}
                disabled={busy}
                className="w-full py-3 rounded-xl text-[13px] font-black tracking-wide transition-all duration-150 active:scale-[0.98] disabled:opacity-40"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  color: "rgba(255,255,255,0.6)",
                  border: "1px solid rgba(255,255,255,0.12)",
                }}
              >
                {busy ? "…" : "Снять"}
              </button>
            ) : (
              <button
                onClick={() => onEquip(item)}
                disabled={busy}
                className="w-full py-3 rounded-xl text-[13px] font-black tracking-wide text-white transition-all duration-200 active:scale-[0.98] disabled:opacity-40"
                style={{
                  background: `linear-gradient(135deg, ${item.color} 0%, ${item.color}cc 100%)`,
                  boxShadow: `0 4px 24px ${item.color}50`,
                }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 6px 32px ${item.color}70`; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = `0 4px 24px ${item.color}50`; }}
              >
                {busy ? "…" : "Экипировать"}
              </button>
            )
          ) : (
            <button
              onClick={() => onBuy(item)}
              disabled={busy || !canAfford}
              className="w-full py-3 rounded-xl text-[13px] font-black tracking-wide text-white transition-all duration-200 active:scale-[0.98] disabled:opacity-35"
              style={{
                background: canAfford
                  ? `linear-gradient(135deg, ${item.color} 0%, ${item.color}cc 100%)`
                  : "rgba(255,255,255,0.05)",
                boxShadow: canAfford ? `0 4px 24px ${item.color}50` : "none",
                color: canAfford ? "white" : "rgba(255,255,255,0.5)",
              }}
              onMouseEnter={e => { if (canAfford && !busy) e.currentTarget.style.boxShadow = `0 6px 32px ${item.color}70`; }}
              onMouseLeave={e => { if (canAfford && !busy) e.currentTarget.style.boxShadow = `0 4px 24px ${item.color}50`; }}
            >
              {busy ? "…" : canAfford ? "Купить" : "Недостаточно SBT"}
            </button>
          )}
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
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="group relative rounded-xl overflow-hidden cursor-pointer flex flex-col"
      draggable={isOwned}
      onDragStart={handleDragStart}
      onClick={() => onOpen(item)}
      style={{
        background: "rgba(13,13,18,0.7)",
        backdropFilter: "blur(12px)",
        border: isEquipped ? `1.5px solid ${item.color}80` : "1.5px solid rgba(255,255,255,0.12)",
        boxShadow: isEquipped 
          ? `0 8px 24px -8px ${item.color}40, 0 0 0 1px ${item.color}15`
          : "0 4px 20px rgba(0,0,0,0.4)",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = isEquipped ? `${item.color}` : "rgba(255,255,255,0.25)";
        e.currentTarget.style.boxShadow = `0 12px 30px -8px ${item.color}45, 0 0 0 1px ${item.color}20`;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = isEquipped ? `${item.color}80` : "rgba(255,255,255,0.12)";
        e.currentTarget.style.boxShadow = isEquipped 
          ? `0 8px 24px -8px ${item.color}40, 0 0 0 1px ${item.color}15`
          : "0 4px 20px rgba(0,0,0,0.4)";
      }}
    >
      {/* Hover highlight */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"
        style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, transparent 50%)" }} />

      {/* Equipped indicator — thin colored top bar */}
      {isEquipped && (
        <div className="absolute top-0 left-0 right-0 h-[2px] z-25"
          style={{ background: `linear-gradient(90deg, transparent, ${item.color}, transparent)`, boxShadow: `0 0 8px ${item.color}40` }} />
      )}

      {/* Visual area */}
      <div className="relative w-full overflow-hidden transition-all duration-300 group-hover:brightness-110"
        style={{ 
          height: item.type === "background" ? 150 : 130,
          background: item.type === "background" ? "#000" : `linear-gradient(160deg, #0c0c14 0%, ${item.color}10 60%, #08080f 100%)`,
          borderBottom: "1px solid rgba(255,255,255,0.08)"
        }}
      >
        <ItemVisual type={item.type} color={item.color} name={item.name} item={item} />

        {/* Equipped badge */}
        {isEquipped && (
          <span className="absolute top-2 right-2 text-[8px] font-black px-2 py-0.5 rounded-md z-20 uppercase tracking-wider"
            style={{ background: "rgba(34,197,94,0.2)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.3)", backdropFilter: "blur(6px)" }}>
            ✓
          </span>
        )}
      </div>

      {/* Info */}
      <div className="px-3 py-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-black text-white leading-tight truncate">{item.name}</p>
            {item.desc && (
              <p className="text-[10px] mt-1 leading-relaxed line-clamp-1"
                style={{ color: "rgba(255,255,255,0.5)" }}>
                {item.desc}
              </p>
            )}
          </div>
          {/* Price or owned badge */}
          {isOwned ? (
            <span className="text-[9px] font-black px-2 py-0.5 rounded-full flex-shrink-0"
              style={{ background: "rgba(34,197,94,0.15)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.25)" }}>
              ✓
            </span>
          ) : (
            <div className="flex items-center gap-1 flex-shrink-0 bg-white/[0.03] px-1.5 py-0.5 rounded-lg border border-white/[0.04]">
              <img src="/money.png" alt="" className="w-3 h-3 object-contain"
                onError={(e) => { e.currentTarget.style.display = "none"; }} />
              <span className="text-[10px] font-black tabular-nums"
                style={{ color: canAfford ? "rgba(255,255,255,0.85)" : "#f87171" }}>
                {item.price.toLocaleString("en-US")}
              </span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
});

/* ── Equipped preview strip (with drop slots) ────────────────────────────── */

function EquippedStrip({ equip, onDrop, onClear }) {
  return (
    <div className="flex items-center gap-2 px-5 py-2 flex-shrink-0 overflow-x-auto"
      style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
      <span className="text-[9px] uppercase tracking-widest font-semibold mr-1 flex-shrink-0"
        style={{ color: "rgba(255,255,255,0.55)" }}>
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
        className="w-16 h-7 px-2 rounded-lg text-[10px] text-white/60 placeholder:text-white/40 outline-none"
        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}
        min={0}
      />
      <span className="text-[10px] text-white/50">—</span>
      <input
        type="number"
        value={max}
        onChange={(e) => onChange(min, Number(e.target.value))}
        placeholder="до"
        className="w-16 h-7 px-2 rounded-lg text-[10px] text-white/60 placeholder:text-white/40 outline-none"
        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}
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
  const [isOffline, setIsOffline] = useState(false);
  const [modalItem, setModalItem] = useState(null);
  const [rarityFilter, setRarityFilter] = useState("all");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [shopFilter, setShopFilter] = useState("all"); // "all" | "free" | "paid"
  const [showSort, setShowSort]     = useState(false);
  const sortRef                     = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setIsOffline(false);
    try {
      const data = await authedFetch("/api/inventory");
      const ownedVal = data.owned || [];
      const equipVal = data.equip || {};
      setOwned(ownedVal);
      setEquip((prev) => ({ ...prev, ...equipVal }));
      localStorage.setItem("sbg_pers_inventory", JSON.stringify({ owned: ownedVal, equip: equipVal }));
    } catch {
      try {
        const cached = localStorage.getItem("sbg_pers_inventory");
        if (cached) {
          const parsed = JSON.parse(cached);
          setOwned(parsed.owned || []);
          setEquip((prev) => ({ ...prev, ...(parsed.equip || {}) }));
          setIsOffline(true);
        } else {
          setError("Не удалось загрузить инвентарь");
        }
      } catch {
        setError("Не удалось загрузить инвентарь");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // close sort dropdown on outside click
  useEffect(() => {
    if (!showSort) return;
    const handler = (e) => { if (sortRef.current && !sortRef.current.contains(e.target)) setShowSort(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showSort]);

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
        style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
        {/* Search */}
        <div className="relative flex-1 max-w-[240px]">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/50" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Найти предмет…"
            className="w-full h-8 pl-8 pr-3 rounded-lg text-[11px] text-white/80 placeholder:text-white/40 outline-none"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}
          />
        </div>

        {/* Filter toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[11px] transition-all"
          style={{
            color: showFilters ? "#60a5fa" : "rgba(255,255,255,0.6)",
            background: showFilters ? "rgba(96,165,250,0.1)" : "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.12)",
          }}
        >
          <Filter size={12} />
          Фильтры
        </button>

        {/* Sort — custom dropdown */}
        <div className="relative" ref={sortRef}>
          <button
            onClick={() => setShowSort(v => !v)}
            className="h-8 pl-2.5 pr-7 rounded-lg text-[11px] cursor-pointer outline-none text-left"
            style={{
              background: showSort ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${showSort ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.12)"}`,
              color: "rgba(255,255,255,0.85)",
            }}
          >
            {SORT_OPTIONS.find(o => o.id === sort)?.label}
          </button>
          <ArrowUpDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: showSort ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.4)" }} />

          <AnimatePresence>
            {showSort && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.12 }}
                className="absolute right-0 top-full mt-1 z-50 overflow-hidden rounded-lg"
                style={{
                  background: "#111116",
                  border: "1px solid rgba(255,255,255,0.1)",
                  boxShadow: "0 12px 40px rgba(0,0,0,0.7)",
                  minWidth: 110,
                }}
              >
                {SORT_OPTIONS.map((o) => (
                  <button
                    key={o.id}
                    onClick={() => { setSort(o.id); setShowSort(false); }}
                    className="w-full text-left px-3 py-1.5 text-[11px] transition-colors"
                    style={{
                      color: sort === o.id ? "#60a5fa" : "rgba(255,255,255,0.6)",
                      background: sort === o.id ? "rgba(96,165,250,0.1)" : "transparent",
                    }}
                    onMouseEnter={e => { if (sort !== o.id) e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
                    onMouseLeave={e => { if (sort !== o.id) e.currentTarget.style.background = "transparent"; }}
                  >
                    {o.label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Balance */}
        <div className="flex items-center gap-2 ml-auto">
          {isOffline && (
            <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 mr-1 tracking-wider">
              АВТОНОМНЫЙ РЕЖИМ
            </span>
          )}
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
            <span className="text-[9px] text-white/50">SBT</span>
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
              style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
              {/* Shop filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] uppercase tracking-widest font-semibold mr-0.5"
                  style={{ color: "rgba(255,255,255,0.55)" }}>Магазин</span>
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
                      color: shopFilter === o.id ? "#60a5fa" : "rgba(255,255,255,0.5)",
                      background: shopFilter === o.id ? "rgba(96,165,250,0.1)" : "transparent",
                      border: `1px solid ${shopFilter === o.id ? "rgba(96,165,250,0.3)" : "rgba(255,255,255,0.1)"}`,
                    }}
                  >
                    {o.label}
                  </button>
                ))}
              </div>

              <div className="w-px h-5 mx-1" style={{ background: "rgba(255,255,255,0.12)" }} />

              {/* Rarity chips */}
              <div className="flex items-center gap-1.5">
                <Tag size={11} className="text-white/50" />
                {Object.entries(RARITIES).map(([key, r]) => (
                  <button
                    key={key}
                    onClick={() => setRarityFilter(rarityFilter === key ? "all" : key)}
                    className="px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all"
                    style={{
                      color: rarityFilter === key ? r.color : "rgba(255,255,255,0.5)",
                      background: rarityFilter === key ? `${r.color}15` : "transparent",
                      border: `1px solid ${rarityFilter === key ? `${r.color}30` : "rgba(255,255,255,0.1)"}`,
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
                color: active ? meta.color : "rgba(255,255,255,0.6)",
                background: active ? `${meta.color}15` : "transparent",
              }}
            >
              <Icon size={12} />
              {meta.label}
              <span className="text-[9px] tabular-nums"
                style={{ color: active ? `${meta.color}99` : "rgba(255,255,255,0.4)" }}>
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
            <Package size={36} style={{ color: "rgba(255,255,255,0.2)" }} />
            <p className="text-[12px]" style={{ color: "rgba(255,255,255,0.5)" }}>
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
