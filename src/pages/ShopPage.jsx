import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Storefront,
  ShoppingCartSimple, Gift, X,
  ArrowsLeftRight, CaretLeft, Plus, Tag,
} from "@phosphor-icons/react";
import { authedFetch, API_URL } from "../lib/api.js";
import { useNotifications } from "../components/NotificationSystem.jsx";
import { CATALOG_BY_ID, LIBRARY_CATALOG } from "./catalog.js";
function rarityForPrice(price) {
  if (price >= 2000) return { label: "Легендарный", color: "#f59e0b", bg: "rgba(245,158,11,0.07)" };
  if (price >= 750)  return { label: "Эпический",   color: "#a855f7", bg: "rgba(168,85,247,0.07)" };
  if (price >= 250)  return { label: "Редкий",      color: "#3b82f6", bg: "rgba(59,130,246,0.07)" };
  return { label: "Обычный", color: "#22c55e", bg: "rgba(34,197,94,0.07)" };
}

export default function ShopPage({ user, onBalanceChange, onViewProfile }) {
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
                style={{ background: "rgba(99,102,241,0.08)" }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(99,102,241,0.16)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(99,102,241,0.08)"; }}
              >
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                  style={{ background: "rgba(99,102,241,0.15)" }}>
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
                style={{ background: "rgba(168,85,247,0.08)" }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(168,85,247,0.16)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(168,85,247,0.08)"; }}
              >
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                  style={{ background: "rgba(168,85,247,0.15)" }}>
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
            <MarketplaceView onViewProfile={onViewProfile} />
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}

// ─── Донат (DB-backed каталог через /api/inventory/catalog) ──────────────────
function DonateView({ user, onBalanceChange }) {
  const [items,    setItems]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [category, setCategory] = useState(() => localStorage.getItem("sbg_donate_category") || "Все");
  const [cart,     setCart]     = useState(new Set());
  const [detail,   setDetail]   = useState(null);
  const [showCart, setShowCart]  = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const { push: pushNotif } = useNotifications() || {};

  // Загружаем каталог из БД — те же товары, что админ редактирует на сайте.
  useEffect(() => {
    authedFetch("/api/inventory/catalog")
      .then(d => { setItems(d.items || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // Динамические категории из загруженных товаров.
  const categories = ["Все", ...Array.from(new Set(items.map(i => i.category).filter(Boolean)))];
  useEffect(() => { if (categories.length > 1 && !categories.includes(category)) setCategory("Все"); }, [categories.join("|")]);

  // Покупка: каждый товар отдельно через /api/inventory/buy (работает с Redis-каталогом).
  const handleCheckout = async () => {
    if (checkingOut || cart.size === 0) return;
    setCheckingOut(true);
    let lastBalance = null, okCount = 0, lastErr = "";
    for (const id of [...cart]) {
      try {
        const r = await authedFetch("/api/inventory/buy", { method: "POST", body: JSON.stringify({ itemId: id }) });
        if (r.balance != null) lastBalance = r.balance;
        okCount++;
      } catch (e) { lastErr = e.message || "Ошибка"; }
    }
    if (onBalanceChange && lastBalance != null) onBalanceChange(lastBalance);
    if (okCount > 0) {
      setCart(new Set()); setShowCart(false);
      pushNotif?.("Покупка", `Товаров куплено: ${okCount}`, "market");
    }
    setCheckingOut(false);
  };
  useEffect(() => { localStorage.setItem("sbg_donate_category", category); }, [category]);

  const filtered = useMemo(() => items.filter(i => category === "Все" || i.category === category), [items, category]);
  const toggleCart = (id) => setCart(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const findItem = (id) => items.find(i => i.id === id);

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
              aria-label={`Корзина, ${cart.size} товаров`}
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

      {/* Category tabs — динамические из загруженного каталога */}
      <div className="flex items-center gap-1 px-6 pb-3 flex-shrink-0 overflow-x-auto">
        {categories.map(id => (
          <button key={id} onClick={() => setCategory(id)}
            className="px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-150 whitespace-nowrap"
            style={category === id ? { background: "rgba(255,255,255,0.08)", color: "#fff" } : { color: "rgba(255,255,255,0.5)" }}
          >{id}</button>
        ))}
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-6 pb-6 min-h-0">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-7 h-7 rounded-full border-2 border-white/10 border-t-blue-500 animate-spin" />
            <p className="text-[12px]" style={{ color: "rgba(255,255,255,0.45)" }}>Загрузка каталога…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Storefront size={28} style={{ color: "rgba(255,255,255,0.08)" }} />
            <p className="text-[12px]" style={{ color: "rgba(255,255,255,0.45)" }}>Нет предметов</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3 auto-rows-max">
            {filtered.map((item, i) => {
              const r = rarityForPrice(item.price || 0);
              const inCart = cart.has(item.id);
              const thumb = item.image || (item.preview && !String(item.preview).startsWith("linear") ? item.preview : null);
              return (
                <motion.div key={item.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                  onClick={() => setDetail(item)}
                  className="flex flex-col rounded-2xl overflow-hidden group"
                  style={{ background: "rgba(14,14,14,0.55)", backdropFilter: "blur(16px)", cursor: "pointer" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(20,20,20,0.65)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(14,14,14,0.55)"; }}
                >
                  <div className="relative h-[110px] flex-shrink-0 overflow-hidden"
                    style={{ background: thumb ? "#000" : `radial-gradient(ellipse at 50% 120%, ${r.color}30 0%, transparent 70%), linear-gradient(160deg, ${r.color}12 0%, #000 100%)` }}
                  >
                    {thumb && <img src={thumb} alt={item.name || ""} className="absolute inset-0 w-full h-full object-cover" style={{ opacity: 0.9 }} onError={e => { e.currentTarget.style.display = "none"; }} />}
                    {!thumb && <div className="absolute inset-0 flex items-center justify-center"><Gift size={48} weight="fill" style={{ color: r.color, opacity: 0.7, filter: `drop-shadow(0 0 14px ${r.color}50)` }} className="group-hover:scale-110 transition-transform" /></div>}
                    <div className="absolute top-2.5 right-2.5">
                      <span className="text-[9px] font-bold tracking-wider px-2 py-1 rounded-lg" style={{ color: r.color, background: "rgba(0,0,0,0.7)" }}>{r.label.toUpperCase()}</span>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 h-8" style={{ background: "linear-gradient(to top, rgba(14,14,14,0.55), transparent)" }} />
                  </div>
                  <div className="px-4 pb-4 pt-2 flex flex-col gap-2.5 flex-1">
                    <div>
                      {item.subcategory && <p className="text-[9px] font-bold tracking-wide uppercase" style={{ color: "rgba(255,255,255,0.35)" }}>{item.subcategory}</p>}
                      {item.name && <p className="text-[13px] font-bold text-white leading-tight">{item.name}</p>}
                      {item.description && <p className="text-[10px] mt-1 leading-relaxed line-clamp-2" style={{ color: "rgba(255,255,255,0.6)" }}>{item.description}</p>}
                    </div>
                    <div className="flex items-center gap-2 mt-auto pt-2">
                      <div className="flex items-center gap-1 flex-1">
                        <img src="/money.png" alt="SBT" className="w-3.5 h-3.5 object-contain" style={{ filter: "drop-shadow(0 0 3px rgba(37,99,235,0.6))" }} />
                        <span className="text-[14px] font-black text-white tabular-nums">{(item.price || 0).toLocaleString("ru-RU")}</span>
                        <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.5)" }}>SBT</span>
                      </div>
                      <button onClick={e => { e.stopPropagation(); setDetail(item); }} className="text-[10px] font-semibold px-2.5 py-1.5 rounded-xl transition-all duration-150" style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.65)" }}>Подробнее</button>
                      <button onClick={e => { e.stopPropagation(); toggleCart(item.id); }} className="flex items-center gap-1 text-[11px] font-bold px-3 py-1.5 rounded-xl transition-all duration-150" style={inCart ? { background: `${r.color}22`, color: r.color } : { background: "rgba(37,99,235,0.2)", color: "#93c5fd" }}>
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
        {detail && (() => {
          const r = rarityForPrice(detail.price || 0);
          const inCart = cart.has(detail.id);
          const thumb = detail.image || (detail.preview && !String(detail.preview).startsWith("linear") ? detail.preview : null);
          return (
            <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDetail(null)}>
              <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
              <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} onClick={e => e.stopPropagation()}
                role="dialog" aria-modal="true" aria-label={detail.name || "Товар"}
                className="relative w-full max-w-[440px] rounded-2xl overflow-hidden"
                style={{ background: "rgba(14,14,14,0.92)", backdropFilter: "blur(24px)" }}
              >
                <div className="relative h-[180px] overflow-hidden" style={{ background: thumb ? "#000" : `radial-gradient(ellipse at 50% 130%, ${r.color}35 0%, transparent 70%), linear-gradient(160deg, ${r.color}15 0%, #000 100%)` }}>
                  {thumb && <img src={thumb} alt={detail.name || "Товар"} className="absolute inset-0 w-full h-full object-cover" style={{ opacity: 0.92 }} />}
                  {!thumb && <div className="absolute inset-0 flex items-center justify-center"><Gift size={64} weight="fill" style={{ color: r.color, filter: `drop-shadow(0 0 20px ${r.color}50)` }} /></div>}
                  <div className="absolute top-4 right-4"><span className="text-[9px] font-bold tracking-wider px-2.5 py-1 rounded-lg" style={{ color: r.color, background: "rgba(0,0,0,0.7)" }}>{r.label.toUpperCase()}</span></div>
                  <button onClick={() => setDetail(null)} aria-label="Закрыть" className="absolute top-4 left-4 w-8 h-8 rounded-xl flex items-center justify-center transition-all" style={{ background: "rgba(0,0,0,0.5)", color: "rgba(255,255,255,0.5)" }} onMouseEnter={e => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.background = "rgba(255,255,255,0.1)"; }} onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.5)"; e.currentTarget.style.background = "rgba(0,0,0,0.5)"; }}><X size={14} /></button>
                </div>
                <div className="p-6">
                  {detail.subcategory && <p className="text-[10px] font-bold tracking-wide uppercase mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>{detail.subcategory}</p>}
                  {detail.name && <h2 className="text-[18px] font-black text-white mb-1">{detail.name}</h2>}
                  <p className="text-[12px] mb-4" style={{ color: "rgba(255,255,255,0.65)" }}>{detail.category}{detail.subcategory ? ` · ${detail.subcategory}` : ""}</p>
                  {detail.description && <p className="text-[13px] leading-relaxed mb-5" style={{ color: "rgba(255,255,255,0.75)" }}>{detail.description}</p>}
                  <div className="flex items-center justify-between pt-4">
                    <div className="flex items-center gap-2">
                      <img src="/money.png" alt="SBT" className="w-5 h-5" style={{ filter: "drop-shadow(0 0 4px rgba(37,99,235,0.6))" }} />
                      <span className="text-[22px] font-black text-white tabular-nums">{(detail.price || 0).toLocaleString("ru-RU")}</span>
                      <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.75)" }}>SBT</span>
                    </div>
                    <button onClick={() => { toggleCart(detail.id); setDetail(null); }} className="px-6 py-2.5 rounded-xl text-[12px] font-bold text-white transition-all" style={{ background: inCart ? `linear-gradient(135deg, ${r.color}, ${r.color}aa)` : "linear-gradient(135deg, #2563EB, #3b82f6)", boxShadow: `0 0 20px ${inCart ? r.color + "30" : "rgba(37,99,235,0.3)"}` }}>{inCart ? "В корзине ✓" : "В корзину"}</button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* Cart panel */}
      <AnimatePresence>
        {showCart && cart.size > 0 && (
          <motion.div className="fixed inset-0 z-50 flex justify-end" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCart(false)} />
            <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 30, stiffness: 300 }}
              role="dialog" aria-modal="true" aria-label="Корзина"
              className="relative z-10 w-[380px] h-full flex flex-col" style={{ background: "rgba(10,10,14,0.88)", backdropFilter: "blur(20px)" }}
            >
              <div className="flex items-center justify-between px-5 py-4 flex-shrink-0">
                <div className="flex items-center gap-2.5"><ShoppingCartSimple size={16} weight="fill" style={{ color: "#93c5fd" }} /><p className="text-[14px] font-bold text-white">Корзина ({cart.size})</p></div>
                <button onClick={() => setShowCart(false)} aria-label="Закрыть корзину" className="w-7 h-7 rounded-lg flex items-center justify-center transition-all" style={{ color: "rgba(255,255,255,0.6)" }} onMouseEnter={e => e.currentTarget.style.color = "#fff"} onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.6)"}><X size={14} /></button>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-3">
                {[...cart].map(id => {
                  const item = findItem(id); if (!item) return null;
                  const r = rarityForPrice(item.price || 0);
                  const thumb = item.image || (item.preview && !String(item.preview).startsWith("linear") ? item.preview : null);
                  return (
                    <motion.div key={id} layout initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-3 p-3 rounded-xl mb-2" style={{ background: "rgba(255,255,255,0.03)" }}>
                      <div className="w-10 h-10 rounded-xl flex-shrink-0 overflow-hidden flex items-center justify-center" style={{ background: thumb ? "#000" : `${r.color}15` }}>
                        {thumb ? <img src={thumb} alt={item.name || "Товар"} className="w-full h-full object-cover" /> : <Gift size={18} weight="fill" style={{ color: r.color }} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        {item.name && <p className="text-[12px] font-semibold text-white truncate">{item.name}</p>}
                        <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.6)" }}>{r.label}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1"><img src="/money.png" alt="SBT" className="w-3 h-3" /><span className="text-[12px] font-bold text-white tabular-nums">{(item.price || 0).toLocaleString("ru-RU")}</span></div>
                        <button onClick={() => toggleCart(id)} aria-label="Удалить из корзины" className="w-6 h-6 rounded-lg flex items-center justify-center transition-all" style={{ background: "rgba(239,68,68,0.1)", color: "#fca5a5" }}><X size={11} /></button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
              <div className="px-5 py-4 flex-shrink-0">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[12px]" style={{ color: "rgba(255,255,255,0.65)" }}>Итого:</span>
                  <div className="flex items-center gap-1.5">
                    <img src="/money.png" alt="SBT" className="w-4 h-4" style={{ filter: "drop-shadow(0 0 4px rgba(37,99,235,0.6))" }} />
                    <span className="text-[18px] font-black text-white tabular-nums">{[...cart].reduce((sum, id) => sum + (findItem(id)?.price || 0), 0).toLocaleString("ru-RU")}</span>
                    <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.75)" }}>SBT</span>
                  </div>
                </div>
                <button onClick={handleCheckout} disabled={checkingOut} className="w-full py-3 rounded-xl text-[13px] font-bold text-white transition-all disabled:opacity-50" style={{ background: "linear-gradient(135deg, #2563EB, #3b82f6)", boxShadow: "0 0 20px rgba(37,99,235,0.3)" }} onMouseEnter={e => e.currentTarget.style.boxShadow = "0 0 30px rgba(37,99,235,0.5)"} onMouseLeave={e => e.currentTarget.style.boxShadow = "0 0 20px rgba(37,99,235,0.3)"}>{checkingOut ? "Оформление…" : "Оформить заказ"}</button>
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

const MKT_SERVERS = [
  { id: "all",      name: "Все серверы",    image: null, color: "#60a5fa" },
  { id: "starwars", name: "Starwars",       image: "https://games.sb-capital.group/servers/starwars.jpg", color: "#818cf8" },
  { id: "minigames",name: "Minigames",      image: "https://games.sb-capital.group/servers/minigames.jpg", color: "#22c55e" },
  { id: "gta",      name: "GTA",            image: "https://games.sb-capital.group/servers/gta.jpg", color: "#ef4444" },
  { id: "vanilla_plus", name: "Vanila+",    image: "https://games.sb-capital.group/servers/vanilla.jpg", color: "#06b6d4" },
  { id: "anarchy",  name: "Анархия",        image: "https://games.sb-capital.group/servers/anarchy.jpg", color: "#f59e0b" },
];

function MarketplaceView({ onViewProfile }) {
  const [listings, setListings] = useState([]);
  const [owned, setOwned]       = useState([]);
  const [equip, setEquip]       = useState({});
  const [catalog, setCatalog]   = useState([]);
  const [filter, setFilter]     = useState("all");
  const [serverFilter, setServerFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortTab, setSortTab]   = useState("popular");
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [sellOpen, setSellOpen] = useState(false);

  const loadListings = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filter !== "all") params.set("type", filter);
      if (serverFilter !== "all") params.set("server", serverFilter);
      const qs = params.toString();
      const data = await authedFetch(`/api/market/listings${qs ? `?${qs}` : ""}`);
      setListings(data.listings || []);
    } catch (e) {
      setError("Не удалось загрузить маркет");
    }
  }, [filter, serverFilter]);

  const loadOwned = useCallback(async () => {
    try {
      const data = await authedFetch("/api/inventory");
      const marketItems = data.market || [];
      const cosmeticItems = (data.owned || []).filter(id => !marketItems.includes(id));
      setOwned([...marketItems, ...cosmeticItems]);
      setEquip(data.equip || {});
      setCatalog([...(data.marketCatalog || []), ...(data.catalog || [])]);
    } catch {}
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { await Promise.all([loadListings(), loadOwned()]); }
    finally { setLoading(false); }
  }, [loadListings, loadOwned]);

  useEffect(() => { load(); }, [load]);

  const filteredListings = useMemo(() => {
    let items = [...listings];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(l => {
        const item = CATALOG[l.itemId] || {};
        return (item.name || l.name || "").toLowerCase().includes(q)
          || (l.sellerName || "").toLowerCase().includes(q);
      });
    }
    if (sortTab === "popular") items.sort((a, b) => (b.views || 0) - (a.views || 0));
    else if (sortTab === "new") items.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    else if (sortTab === "cheap") items.sort((a, b) => a.price - b.price);
    return items;
  }, [listings, searchQuery, sortTab]);

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="px-6 pt-4 pb-3 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div>
            <h1 className="text-[17px] font-black text-white">Торговая площадка</h1>
            </div>
            <button onClick={() => setSellOpen(true)}
              disabled={owned.length === 0}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-bold text-white disabled:opacity-30 transition-all"
              style={{ background: "linear-gradient(135deg, #2563eb, #3b82f6)", boxShadow: "0 4px 16px rgba(37,99,235,0.3)" }}>
              <Plus size={12} /> Продать
            </button>
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Поиск предметов…"
              className="w-full rounded-lg text-[12px] px-3 py-2.5 pl-9 outline-none"
              style={{ background: "rgba(255,255,255,0.06)", color: "#fff" }} />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
            </svg>
          </div>

          {/* Sort tabs */}
          <div className="flex gap-1 p-0.5 rounded-lg" style={{ background: "rgba(255,255,255,0.03)" }}>
            {[
              { id: "popular", label: "Популярные" },
              { id: "new", label: "Новые" },
              { id: "cheap", label: "Дешевле" },
            ].map(tab => (
              <button key={tab.id} onClick={() => setSortTab(tab.id)}
                className="flex-1 py-2 rounded-md text-[11px] font-semibold transition-all"
                style={{
                  background: sortTab === tab.id ? "rgba(255,255,255,0.08)" : "transparent",
                  color: sortTab === tab.id ? "#fff" : "rgba(255,255,255,0.35)",
                }}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* List header */}
        <div className="flex items-center px-6 py-2.5 flex-shrink-0">
          <span className="flex-1 text-[10px] uppercase tracking-wider font-semibold" style={{ color: "rgba(255,255,255,0.3)" }}>Предмет</span>
          <span className="w-24 text-[10px] uppercase tracking-wider font-semibold text-center" style={{ color: "rgba(255,255,255,0.3)" }}>Цена</span>
          <span className="w-24" />
        </div>

        {/* Listings */}
        <div className="flex-1 overflow-y-auto px-6 pb-4 min-h-0">
          {error && (
            <div className="mb-2 rounded-lg px-3 py-2 text-[11px]"
              style={{ background: "rgba(239,68,68,0.08)", color: "#fca5a5" }}>
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-16" style={{ color: "rgba(255,255,255,0.3)" }}>
              <div className="w-5 h-5 border-[2px] border-white/10 border-t-white/50 rounded-full animate-spin" />
            </div>
          ) : filteredListings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <ArrowsLeftRight size={28} style={{ color: "rgba(255,255,255,0.06)" }} />
              <p className="text-[12px]" style={{ color: "rgba(255,255,255,0.3)" }}>
                {searchQuery ? "Ничего не найдено" : "Нет активных листингов"}
              </p>
              <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.15)" }}>
                {!searchQuery && "Выстави свой предмет — продай за SBT"}
              </p>
            </div>
          ) : (
            <div className="flex flex-col">
              {filteredListings.map((l, i) => (
                <ListingRow key={l.id} listing={l} index={i} onBought={load} onViewProfile={onViewProfile} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Sidebar — servers */}
      <div className="w-[200px] flex-shrink-0 flex flex-col py-4 px-3" style={{ background: "rgba(255,255,255,0.02)" }}>
        <span className="text-[10px] uppercase tracking-widest font-bold mb-3 px-2" style={{ color: "rgba(255,255,255,0.25)" }}>Сервер</span>
        <div className="flex flex-col gap-1">
          {MKT_SERVERS.map(s => {
            const active = serverFilter === s.id;
            const count = s.id === "all" ? listings.length : listings.filter(l => l.server === s.id).length;
            return (
              <button key={s.id} onClick={() => setServerFilter(s.id)}
                className="flex items-center gap-2.5 px-2 py-2 rounded-xl transition-all text-left"
                style={{
                  background: active ? "rgba(255,255,255,0.06)" : "transparent",
                }}>
                {s.image ? (
                  <img src={s.image} alt={s.name} className="w-8 h-8 rounded-lg object-cover flex-shrink-0"
                    style={{ opacity: active ? 1 : 0.5 }} />
                ) : (
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(255,255,255,0.06)" }}>
                    <span className="text-[10px] font-bold" style={{ color: s.color, opacity: active ? 1 : 0.5 }}>✦</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold truncate" style={{ color: active ? "#fff" : "rgba(255,255,255,0.4)" }}>{s.name}</p>
                  <p className="text-[9px]" style={{ color: "rgba(255,255,255,0.2)" }}>{count} листингов</p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-auto px-2 pt-4">
          <p className="text-[10px] leading-relaxed" style={{ color: "rgba(255,255,255,0.2)" }}>
            Все сделки P2P. Предметы и SBT хранятся на сервере до подтверждения.
          </p>
        </div>
      </div>

      <AnimatePresence>
        {sellOpen && (
          <SellModal
            owned={owned}
            catalog={catalog}
            onClose={() => setSellOpen(false)}
            onCreated={() => { setSellOpen(false); load(); }}
          />
        )}
      </AnimatePresence>
    </div>
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

function ListingRow({ listing, index, onBought, onViewProfile }) {
  const catItem = CATALOG_BY_ID[listing.itemId];
  const mktItem = CATALOG[listing.itemId];
  const item = mktItem || catItem || {};
  const name = mktItem?.name || catItem?.name || listing.name || "—";
  const accentColor = item.color || "#888";
  const hasImage = !!(catItem?.image || catItem?.icon);
  const hasGradient = !!mktItem?.preview?.startsWith?.("linear");
  const [buying, setBuying] = useState(false);
  const { push: pushNotif } = useNotifications() || {};

  const buy = async () => {
    if (buying) return;
    setBuying(true);
    try {
      await authedFetch(`/api/market/buy/${listing.id}`, { method: "POST" });
      pushNotif?.("Покупка", `${name} куплен`, "market");
      onBought?.();
    } catch (e) { pushNotif?.("Ошибка", e.message, "group"); }
    finally { setBuying(false); }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.12, delay: Math.min(index * 0.02, 0.3) }}
      className="flex items-center gap-4 py-3 -mx-3 px-3 rounded-lg transition-all"
      onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
      {/* Item */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-10 h-10 rounded-lg flex-shrink-0 overflow-hidden flex items-center justify-center"
          style={{ background: hasGradient ? mktItem.preview : `linear-gradient(135deg, ${accentColor}30, ${accentColor}15)` }}>
          {hasImage ? (
            <img src={catItem.image || catItem.icon} alt="" className="w-full h-full object-cover"
              onError={e => { e.currentTarget.style.display = "none"; }} />
          ) : hasGradient ? (
            <div className="w-5 h-5 rounded" style={{ background: mktItem.preview, opacity: 0.8 }} />
          ) : null}
        </div>
        <div className="min-w-0">
          <p className="text-[12px] font-semibold text-white truncate">{name}</p>
          <button onClick={() => onViewProfile?.(listing.sellerId)} className="text-[10px] truncate text-left hover:underline"
            style={{ color: "rgba(255,255,255,0.35)" }}>
            @{listing.sellerName}
          </button>
        </div>
      </div>

      {/* Price */}
      <div className="w-24 text-center">
        <span className="text-[13px] font-black" style={{ color: "#60a5fa" }}>{listing.price}</span>
        <span className="text-[9px] ml-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>SBT</span>
      </div>

      {/* Buy */}
      <div className="w-24 flex justify-end">
        <button onClick={buy} disabled={buying}
          className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-white transition-all"
          style={{ background: "linear-gradient(135deg, #2563eb, #3b82f6)" }}>
          {buying ? "…" : "Купить"}
        </button>
      </div>
    </motion.div>
  );
}

function SellModal({ owned, catalog, onClose, onCreated }) {
  const [picked, setPicked] = useState(null);
  const [price, setPrice]   = useState(100);
  const [busy, setBusy]     = useState(false);
  const [error, setError]   = useState(null);

  const allItems = useMemo(() => {
    const shopMap = {};
    for (const item of (catalog || [])) shopMap[item.id] = item;
    const map = {};
    for (const id of owned) {
      const mkt = CATALOG[id];
      if (mkt) { map[id] = { name: mkt.name, preview: mkt.preview, type: mkt.type, source: "market" }; continue; }
      const cat = CATALOG_BY_ID[id] || shopMap[id];
      if (cat) {
        const name = cat.name || (cat.type === "background" ? `Фон ${id.replace("bg_fon", "")}` : id.replace(/_/g, " "));
        const preview = cat.image || cat.icon || null;
        const video = cat.video || null;
        map[id] = { name, preview, video, color: cat.color || "#888", type: cat.type || "?", rarity: cat.rarity, source: "shop" };
        continue;
      }
      map[id] = { name: id.replace(/_/g, " "), preview: null, video: null, color: "#888", type: "?", source: "unknown" };
    }
    return map;
  }, [owned, catalog]);

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
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <motion.div initial={{ scale: 0.94, y: 8 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.94, y: 8 }}
        className="relative z-10 w-[440px] rounded-2xl overflow-hidden"
        style={{ background: "rgba(12,12,18,0.95)", boxShadow: "0 24px 80px rgba(0,0,0,0.9)" }}>
        <div className="flex items-center justify-between px-5 py-4">
          <div>
            <p className="text-[13px] font-bold text-white">Выставить на продажу</p>
            <p className="text-[10px] text-white/55 mt-0.5">Предмет уйдёт из инвентаря, деньги поступят после покупки</p>
          </div>
          <button onClick={onClose} aria-label="Закрыть" className="w-7 h-7 rounded-lg text-white/55 hover:text-white hover:bg-white/[0.07] flex items-center justify-center">
            <X size={12} />
          </button>
        </div>
        <div className="p-5 flex flex-col gap-3">
          <p className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: "rgba(255,255,255,0.75)" }}>
            Выбери предмет
          </p>
          {owned.length === 0 ? (
            <p className="text-[11px] py-6 text-center" style={{ color: "rgba(255,255,255,0.75)" }}>
              Нет предметов для продажи.
            </p>
          ) : (
            <div className="sell-modal-grid grid grid-cols-4 gap-2 max-h-[280px] overflow-y-auto pr-1">
              {owned.map(id => {
                const item = allItems[id];
                if (!item) return null;
                const hasImage = !!item.preview;
                const hasVideo = !!item.video;
                const accentColor = item.color || "#888";
                return (
                  <button key={id} onClick={() => setPicked(id)}
                    className="relative rounded-xl p-2 flex flex-col items-center gap-1.5 transition-all"
                    style={{
                      background: picked === id ? "rgba(168,85,247,0.18)" : "rgba(255,255,255,0.04)",
                      boxShadow: picked === id ? `0 0 16px ${accentColor}30` : "none",
                      border: picked === id ? `1px solid ${accentColor}40` : "1px solid transparent",
                    }}>
                    <div className="w-12 h-12 rounded-lg overflow-hidden flex items-center justify-center"
                      style={{ background: `linear-gradient(135deg, ${accentColor}30, ${accentColor}15)` }}>
                      {hasImage ? (
                        <img src={item.preview} alt="" className="w-full h-full object-cover" onError={e => { e.currentTarget.style.display = "none"; }} />
                      ) : hasVideo ? (
                        <video src={item.video} className="w-full h-full object-cover" preload="metadata" muted
                          onError={e => { e.currentTarget.style.display = "none"; }} />
                      ) : (
                        <div className="w-6 h-6 rounded" style={{ background: accentColor, opacity: 0.6 }} />
                      )}
                    </div>
                    <span className="text-[9px] text-white/70 truncate w-full text-center leading-tight">{item.name}</span>
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
                style={{ background: "rgba(255,255,255,0.05)", color: "#fff" }} />
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
              className="flex-1 py-2.5 rounded-xl text-[12px] font-bold text-white disabled:opacity-30 transition-all"
              style={{ background: "linear-gradient(135deg, #2563eb, #3b82f6)" }}>
              {busy ? "Создаём…" : "Выставить"}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
