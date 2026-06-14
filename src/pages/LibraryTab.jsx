import React, { useState, useEffect, useCallback } from "react";
import { Search, ArrowUpDown, Loader2 } from "lucide-react";
import { authedFetch } from "../lib/api.js";
import { LIBRARY_CATALOG } from "./catalog.js";

const TYPE_LABELS = {
  all:                "Все",
  frame:              "Рамки",
  background:         "Фоны",
  avatar_animated:    "Анимации",
  badge:              "Бейджи",
};

const SORT_OPTIONS = [
  { id: "price_asc",  label: "Цена ↑" },
  { id: "price_desc", label: "Цена ↓" },
  { id: "name",       label: "А-Я" },
];

function ItemIcon({ type, color, name }) {
  if (type === "frame") {
    return (
      <div className="relative w-[72px] h-[72px]">
        {/* Outer glow */}
        <div className="absolute -inset-2 rounded-2xl"
          style={{
            background: `linear-gradient(135deg, ${color}40, transparent 40%, ${color}25)`,
            filter: "blur(6px)",
          }} />
        {/* Border layers */}
        <div className="absolute -inset-1.5 rounded-[18px]"
          style={{
            background: `linear-gradient(135deg, ${color}, ${color}55, ${color})`,
            boxShadow: `0 0 20px ${color}30, inset 0 0 12px ${color}15`,
          }} />
        <div className="absolute -inset-0.5 rounded-[15px]"
          style={{
            background: `conic-gradient(from 45deg, ${color}90, transparent 25%, ${color}60 50%, transparent 75%, ${color}90)`,
          }} />
        {/* Inner fill */}
        <div className="relative w-full h-full rounded-[13px] flex items-center justify-center overflow-hidden"
          style={{ background: `linear-gradient(160deg, #0c0c12, #08080e)`, border: `1px solid ${color}20` }}>
          {/* Silhouette */}
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.25 }}>
            <circle cx="12" cy="8" r="4" fill={color} />
            <path d="M4 20c0-4.4 3.6-8 8-8s8 3.6 8 8" fill={color} />
          </svg>
        </div>
      </div>
    );
  }
  if (type === "background") {
    return (
      <div className="w-[72px] h-[52px] rounded-xl overflow-hidden relative"
        style={{ border: `1.5px solid ${color}18` }}>
        {/* Multiple gradient layers for depth */}
        <div className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse at 25% 20%, ${color}55 0%, transparent 55%),
              radial-gradient(ellipse at 75% 80%, ${color}35 0%, transparent 50%),
              radial-gradient(ellipse at 50% 50%, ${color}15 0%, transparent 70%),
              linear-gradient(160deg, #06060c 0%, #0a0a18 50%, #04040a 100%)
            `,
          }} />
        {/* Stars / particles */}
        <div className="absolute inset-0" style={{ background: `radial-gradient(1px 1px at 20% 30%, ${color}80, transparent), radial-gradient(1px 1px at 60% 20%, ${color}60, transparent), radial-gradient(1px 1px at 80% 60%, ${color}50, transparent), radial-gradient(1px 1px at 40% 70%, ${color}40, transparent)` }} />
      </div>
    );
  }
  if (type === "avatar_animated") {
    return (
      <div className="relative w-[72px] h-[72px]">
        {/* Animated ring */}
        <div className="absolute inset-0 rounded-full"
          style={{
            background: `conic-gradient(from 0deg, ${color}, ${color}20, ${color}80, ${color}20, ${color})`,
            animation: "spin 3s linear infinite",
            filter: "blur(1px)",
          }} />
        <div className="absolute inset-[3px] rounded-full"
          style={{ background: "#0a0a10" }} />
        {/* Inner glow pulse */}
        <div className="absolute inset-[3px] rounded-full"
          style={{
            background: `radial-gradient(circle at 50% 50%, ${color}25, transparent 70%)`,
            animation: "pulse 2s ease-in-out infinite",
          }} />
        {/* Center silhouette */}
        <div className="relative w-full h-full rounded-full flex items-center justify-center">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.35 }}>
            <circle cx="12" cy="8" r="4" fill={color} />
            <path d="M4 20c0-4.4 3.6-8 8-8s8 3.6 8 8" fill={color} />
          </svg>
        </div>
      </div>
    );
  }
  // badge — pill shape with icon
  return (
    <div className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl"
      style={{
        background: `linear-gradient(135deg, ${color}20, ${color}08)`,
        border: `1.5px solid ${color}35`,
        boxShadow: `0 0 16px ${color}12`,
      }}>
      <div className="w-5 h-5 rounded-full flex items-center justify-center"
        style={{ background: `${color}18` }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill={color}>
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      </div>
      <span className="text-[10px] font-bold tracking-wide uppercase" style={{ color }}>
        {name}
      </span>
    </div>
  );
}

export default function LibraryTab({ user, equip, setEquip }) {
  const [owned, setOwned] = useState([]);
  const [activeType, setActiveType] = useState("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("price_asc");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await authedFetch("/api/inventory");
      setOwned(data.owned || []);
      setEquip(data.equip || {});
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
        setEquip(r.equip);
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
        setEquip(r.equip);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  // filter + sort
  let items = LIBRARY_CATALOG;
  if (activeType !== "all") items = items.filter((i) => i.type === activeType);
  if (search.trim()) {
    const q = search.toLowerCase();
    items = items.filter((i) => i.name.toLowerCase().includes(q));
  }
  if (sort === "price_asc")  items = [...items].sort((a, b) => a.price - b.price);
  if (sort === "price_desc") items = [...items].sort((a, b) => b.price - a.price);
  if (sort === "name")       items = [...items].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="flex flex-col h-full">
      {/* ── Top bar ── */}
      <div className="flex items-center gap-3 px-5 pt-4 pb-3 flex-shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        {/* Search */}
        <div className="relative flex-1 max-w-[220px]">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/20" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Найти предмет…"
            className="w-full h-8 pl-8 pr-3 rounded-lg text-[11px] text-white/80 placeholder:text-white/20 outline-none"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
          />
        </div>

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
            <img src="/money.png" alt="" className="w-3.5 h-3.5" onError={(e) => { e.currentTarget.style.display = "none"; }} />
            <span className="text-[13px] font-black text-white tabular-nums">{balance.toLocaleString("en-US")}</span>
            <span className="text-[9px] text-white/20">SBT</span>
          </div>
        </div>
      </div>

      {/* ── Type tabs ── */}
      <div className="flex items-center gap-1 px-5 pt-3 pb-2 flex-shrink-0 overflow-x-auto">
        {Object.entries(TYPE_LABELS).map(([type, label]) => {
          const count = type === "all"
            ? LIBRARY_CATALOG.length
            : LIBRARY_CATALOG.filter((i) => i.type === type).length;
          const active = activeType === type;
          return (
            <button
              key={type}
              onClick={() => setActiveType(type)}
              className="relative px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all whitespace-nowrap"
              style={{
                color: active ? "#fff" : "rgba(255,255,255,0.3)",
                background: active ? "rgba(255,255,255,0.08)" : "transparent",
              }}
            >
              {label}
              <span className="ml-1.5 text-[9px] tabular-nums" style={{ color: active ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.15)" }}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Content ── */}
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
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <p className="text-[12px] text-white/20">Ничего не найдено</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
            {items.map((item) => {
              const isOwned  = isAdmin || owned.includes(item.id);
              const isEquip  = equip[item.type] === item.id;
              const isBusy   = busy === item.id;
              const canAfford = isAdmin || balance >= item.price;

              return (
                <div
                  key={item.id}
                  className="group relative rounded-xl overflow-hidden cursor-pointer transition-all duration-150"
                  style={{
                    background: isEquip ? "rgba(99,102,241,0.08)" : "rgba(255,255,255,0.02)",
                    border: isEquip ? "1.5px solid rgba(99,102,241,0.25)" : "1.5px solid rgba(255,255,255,0.04)",
                  }}
                  onMouseEnter={(e) => { if (!isEquip) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                  onMouseLeave={(e) => { if (!isEquip) e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}
                >
                  {/* Visual */}
                  <div className="relative h-[90px] flex items-center justify-center overflow-hidden"
                    style={{
                      background: `radial-gradient(ellipse at 50% 120%, ${item.color}18 0%, transparent 70%), #08080c`,
                    }}>
                    <ItemIcon type={item.type} color={item.color} name={item.name} />

                    {/* Status badges */}
                    {isEquip && (
                      <span className="absolute top-1.5 left-1.5 text-[8px] font-bold px-1.5 py-0.5 rounded"
                        style={{ background: "rgba(99,102,241,0.35)", color: "#e0e7ff" }}>
                        ЭКИП.
                      </span>
                    )}
                    {!isOwned && !canAfford && (
                      <span className="absolute top-1.5 right-1.5 text-[8px] font-bold px-1.5 py-0.5 rounded"
                        style={{ background: "rgba(239,68,68,0.15)", color: "#fca5a5" }}>
                        МАЛО СБТ
                      </span>
                    )}

                    {/* Hover actions */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                      style={{ background: "rgba(0,0,0,0.55)" }}>
                      {isOwned ? (
                        isEquip ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); unequip(item.type); }}
                            disabled={isBusy}
                            className="px-3 py-1.5 rounded-lg text-[10px] font-bold"
                            style={{ background: "rgba(99,102,241,0.35)", color: "#e0e7ff" }}>
                            {isBusy ? "…" : "Снять"}
                          </button>
                        ) : (
                          <button
                            onClick={(e) => { e.stopPropagation(); equipItem(item); }}
                            disabled={isBusy}
                            className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-white"
                            style={{ background: "rgba(37,99,235,0.8)" }}>
                            {isBusy ? "…" : "Экипировать"}
                          </button>
                        )
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); buy(item); }}
                          disabled={isBusy || !canAfford}
                          className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-white disabled:opacity-40"
                          style={{ background: "rgba(37,99,235,0.8)" }}>
                          {isBusy ? "…" : "Купить"}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Name + price */}
                  <div className="px-2.5 py-2">
                    <p className="text-[11px] font-semibold text-white/80 truncate">{item.name}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <img src="/money.png" alt="" className="w-2.5 h-2.5" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                      <span className="text-[10px] font-bold tabular-nums"
                        style={{
                          color: isOwned ? "#4ade80" : canAfford ? "rgba(255,255,255,0.6)" : "rgba(248,113,113,0.6)",
                        }}>
                        {isOwned ? "Куплено" : item.price.toLocaleString("en-US")}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
