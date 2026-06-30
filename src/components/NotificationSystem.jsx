import React, { useState, useEffect, useCallback, useRef, createContext, useContext } from "react";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import { X, Bell, CheckCircle, Users, Coins, MessageCircle, Info, Trash2, MessageSquareText, ShoppingCart } from "lucide-react";
import { notifyDesktop } from "../lib/tauri.js";

// ─── Sound effects via Web Audio API ──────────────────────────────────────────
let _audioCtx = null;
function getAudioCtx() {
  if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return _audioCtx;
}

function playTone(freq, duration, type = "sine", volume = 0.12) {
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch {}
}

const SOUNDS = {
  friend:  () => { playTone(880, 0.12, "sine", 0.10); setTimeout(() => playTone(1175, 0.15, "sine", 0.10), 100); },
  balance: () => { playTone(660, 0.08, "sine", 0.10); setTimeout(() => playTone(880, 0.08, "sine", 0.10), 70); setTimeout(() => playTone(1100, 0.12, "sine", 0.10), 140); },
  ticket:  () => { playTone(523, 0.15, "triangle", 0.10); setTimeout(() => playTone(659, 0.18, "triangle", 0.10), 120); },
  system:  () => { playTone(698, 0.12, "sine", 0.08); },
  success: () => { playTone(523, 0.1, "sine", 0.10); setTimeout(() => playTone(784, 0.15, "sine", 0.10), 80); },
  dm:      () => { playTone(784, 0.08, "sine", 0.10); setTimeout(() => playTone(988, 0.12, "sine", 0.10), 80); },
  comment: () => { playTone(587, 0.1, "triangle", 0.10); setTimeout(() => playTone(740, 0.12, "triangle", 0.10), 90); },
  market:  () => { playTone(523, 0.08, "sine", 0.10); setTimeout(() => playTone(660, 0.08, "sine", 0.10), 60); setTimeout(() => playTone(880, 0.1, "sine", 0.10), 120); },
  group:   () => { playTone(440, 0.12, "triangle", 0.10); setTimeout(() => playTone(554, 0.15, "triangle", 0.10), 110); },
};

function playNotifSound(type) {
  try {
    const settings = JSON.parse(localStorage.getItem("sbgames_settings") || "{}");
    if (settings.notifSound === false) return;
    (SOUNDS[type] || SOUNDS.system)();
  } catch {}
}

// ─── Context ──────────────────────────────────────────────────────────────────
const NotifCtx = createContext(null);
export function useNotifications() { return useContext(NotifCtx); }

let _globalPush = null;
export function pushNotification(title, body, type = "system") {
  if (_globalPush) _globalPush(title, body, type);
}

const ICONS = {
  friend:  { icon: Users,          color: "#60a5fa", accent: "#3b82f6" },
  balance: { icon: Coins,          color: "#34d399", accent: "#10b981" },
  ticket:  { icon: MessageCircle,  color: "#f59e0b", accent: "#f59e0b" },
  system:  { icon: Info,           color: "#60a5fa", accent: "#2563eb" },
  success: { icon: CheckCircle,    color: "#34d399", accent: "#10b981" },
  dm:      { icon: MessageSquareText, color: "#38bdf8", accent: "#0ea5e9" },
  comment: { icon: MessageCircle,  color: "#fb923c", accent: "#f97316" },
  market:  { icon: ShoppingCart,   color: "#4ade80", accent: "#22c55e" },
  group:   { icon: Users,           color: "#c084fc", accent: "#a855f7" },
};

// ─── Provider ─────────────────────────────────────────────────────────────────
export function NotificationProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [inbox,  setInbox]  = useState(() => {
    try { return JSON.parse(localStorage.getItem("sbg_notifs") || "[]"); }
    catch { return []; }
  });
  const [unread, setUnread] = useState(0);
  const idRef = useRef(0);

  useEffect(() => {
    setUnread(inbox.filter(n => !n.read).length);
  }, [inbox]);

  const push = useCallback((title, body, type = "system") => {
    const id = ++idRef.current;
    const notif = { id, title, body, type, time: Date.now(), read: false };

    // Тосты в лаунчере отключены — уведомления идут через ОС (Windows/Mac)
    // setToasts(prev => [notif, ...prev].slice(0, 5));
    // setTimeout(() => setToasts(prev => prev.filter(n => n.id !== id)), 4500);

    setInbox(prev => {
      const next = [notif, ...prev].slice(0, 50);
      localStorage.setItem("sbg_notifs", JSON.stringify(next));
      return next;
    });

    notifyDesktop(title, body, type);
    playNotifSound(type);
  }, []);

  useEffect(() => {
    _globalPush = push;
    return () => { _globalPush = null; };
  }, [push]);

  const markAllRead = useCallback(() => {
    setInbox(prev => {
      const next = prev.map(n => ({ ...n, read: true }));
      localStorage.setItem("sbg_notifs", JSON.stringify(next));
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setInbox([]);
    localStorage.removeItem("sbg_notifs");
  }, []);

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(n => n.id !== id));
  }, []);

  return (
    <NotifCtx.Provider value={{ push, inbox, unread, markAllRead, clearAll }}>
      {children}
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </NotifCtx.Provider>
  );
}

// ─── Toast stack — Steam style, top-right corner ─────────────────────────────
function ToastStack({ toasts, onDismiss }) {
  return (
    <div className="fixed top-4 right-4 flex flex-col gap-2 pointer-events-none"
      style={{ width: 340, zIndex: 100000 }}
    >
      <AnimatePresence>
        {toasts.map((n) => (
          <Toast key={`${n.id}-${n.time}`} notif={n} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function Toast({ notif, onDismiss }) {
  const meta = ICONS[notif.type] || ICONS.system;
  const Icon = meta.icon;
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const start = Date.now();
    const total = 4500;
    let raf;
    const tick = () => {
      const pct = Math.max(0, 100 - ((Date.now() - start) / total) * 100);
      setProgress(pct);
      if (pct > 0) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 80, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 80, scale: 0.85, filter: "blur(4px)" }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      style={{ pointerEvents: "auto" }}
    >
      <div
        className="relative rounded-xl overflow-hidden"
        style={{
          background: "rgba(20, 20, 28, 0.97)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.08)",
        }}
      >
        {/* Accent top line */}
        <div className="h-[2px] w-full" style={{ background: `linear-gradient(90deg, transparent, ${meta.accent}, transparent)` }} />

        <div className="flex items-start gap-3 p-3.5">
          {/* Icon */}
          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{
              background: `linear-gradient(135deg, ${meta.accent}20, ${meta.accent}08)`,
              border: `1px solid ${meta.accent}25`,
            }}
          >
            <Icon size={15} style={{ color: meta.color }} />
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0 pt-0.5">
            <p className="text-[11.5px] font-bold text-white leading-tight tracking-wide">{notif.title}</p>
            <p className="text-[10.5px] mt-1 leading-snug" style={{ color: "rgba(255,255,255,0.45)" }}>
              {notif.body}
            </p>
          </div>

          {/* Close */}
          <button
            onClick={() => onDismiss(notif.id)}
            aria-label="Закрыть уведомление"
            className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-all duration-100"
            style={{ color: "rgba(255,255,255,0.2)" }}
            onMouseEnter={e => e.currentTarget.style.color = "rgba(255,255,255,0.7)"}
            onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.2)"}
          >
            <X size={11} />
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-[2px] w-full" style={{ background: "rgba(255,255,255,0.03)" }}>
          <div
            className="h-full"
            style={{
              width: `${progress}%`,
              background: `linear-gradient(90deg, ${meta.accent}60, ${meta.accent})`,
              transition: "width 0.08s linear",
            }}
          />
        </div>
      </div>
    </motion.div>
  );
}

// ─── Bell icon + panel — Steam style ──────────────────────────────────────────
export function NotificationBell() {
  const { inbox, unread, markAllRead, clearAll } = useNotifications();
  const [open, setOpen] = useState(false);
  const controls = useAnimation();
  const prevUnread = useRef(unread);
  const bellRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    if (unread > prevUnread.current) {
      controls.start({
        rotate: [0, -15, 15, -10, 10, -5, 5, 0],
        transition: { duration: 0.5, ease: "easeInOut" },
      });
    }
    prevUnread.current = unread;
  }, [unread, controls]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      const inBell = bellRef.current?.contains(e.target);
      const inPanel = panelRef.current?.contains(e.target);
      if (!inBell && !inPanel) setOpen(false);
    };
    const timer = setTimeout(() => document.addEventListener("mousedown", handler), 0);
    return () => { clearTimeout(timer); document.removeEventListener("mousedown", handler); };
  }, [open]);

  const toggle = () => {
    setOpen(v => !v);
    if (!open) markAllRead();
  };

  const hasInbox = inbox.length > 0;

  return (
    <div className="relative" style={{ zIndex: 100 }}>
      <div ref={bellRef}>
        <motion.button
          onClick={toggle}
          animate={controls}
          whileTap={{ scale: 0.88 }}
          aria-label={`Уведомления${unread > 0 ? `, ${unread} непрочитанных` : ""}`}
          aria-expanded={open}
          className="relative w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-150"
          style={open
            ? { background: "rgba(37,99,235,0.2)", color: "#60a5fa" }
            : { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.45)" }
          }
          onMouseEnter={e => { if (!open) { e.currentTarget.style.color = "#60a5fa"; e.currentTarget.style.background = "rgba(37,99,235,0.14)"; } }}
          onMouseLeave={e => { if (!open) { e.currentTarget.style.color = "rgba(255,255,255,0.45)"; e.currentTarget.style.background = "rgba(255,255,255,0.06)"; } }}
        >
          <Bell size={14} />

          <AnimatePresence>
            {unread > 0 && (
              <motion.span
                key="badge"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 28 }}
                className="absolute -top-1 -right-1 min-w-[14px] h-[14px] px-0.5 rounded-full flex items-center justify-center text-[8px] font-black text-white"
                style={{ background: "#2563eb", boxShadow: "0 0 8px rgba(37,99,235,0.6)" }}
              >
                {unread > 9 ? "9+" : unread}
              </motion.span>
            )}
          </AnimatePresence>

          {unread === 0 && hasInbox && !open && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full"
              style={{ background: "#2563eb", boxShadow: "0 0 6px rgba(37,99,235,0.5)" }}
            />
          )}

          {unread > 0 && !open && (
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full animate-ping"
              style={{ background: "rgba(37,99,235,0.35)" }}
            />
          )}
        </motion.button>
      </div>

      {/* Panel — Steam style dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, scale: 0.95, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -8 }}
            transition={{ type: "spring", stiffness: 450, damping: 32 }}
            className="absolute top-10 right-0 w-[320px] rounded-xl overflow-hidden"
            style={{
              zIndex: 100001,
              background: "rgba(20, 20, 28, 0.97)",
              backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
              boxShadow: "0 12px 48px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.08)",
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
            >
              <div className="flex items-center gap-2">
                <Bell size={12} style={{ color: "rgba(255,255,255,0.3)" }} />
                <p className="text-[11px] font-bold text-white tracking-wide uppercase">Уведомления</p>
                {unread > 0 && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                    style={{ background: "rgba(37,99,235,0.15)", color: "#60a5fa" }}>
                    {unread}
                  </span>
                )}
              </div>
              {inbox.length > 0 && (
                <button onClick={clearAll}
                  className="flex items-center gap-1 text-[9px] font-semibold transition-colors duration-100 px-2 py-1 rounded"
                  style={{ color: "rgba(255,255,255,0.25)" }}
                  onMouseEnter={e => { e.currentTarget.style.color = "#f87171"; e.currentTarget.style.background = "rgba(248,113,113,0.1)"; }}
                  onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.25)"; e.currentTarget.style.background = "transparent"; }}
                >
                  <Trash2 size={10} />
                  Очистить
                </button>
              )}
            </div>

            {/* List */}
            <div className="max-h-[380px] overflow-y-auto">
              {inbox.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-12">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.04)" }}>
                    <Bell size={20} style={{ color: "rgba(255,255,255,0.12)" }} />
                  </div>
                  <div className="text-center">
                    <p className="text-[11px] font-semibold" style={{ color: "rgba(255,255,255,0.3)" }}>Пусто</p>
                    <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.15)" }}>Уведомления появятся здесь</p>
                  </div>
                </div>
              ) : (
                inbox.slice(0, 20).map((n, i) => {
                  const meta = ICONS[n.type] || ICONS.system;
                  const Icon = meta.icon;
                  return (
                    <motion.div
                      key={`${n.id}-${n.time}`}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.025 }}
                      className="flex items-start gap-3 px-4 py-3 transition-all duration-100 cursor-default"
                      style={{
                        background: n.read ? "transparent" : "rgba(37,99,235,0.05)",
                        borderBottom: "1px solid rgba(255,255,255,0.03)",
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}
                      onMouseLeave={e => e.currentTarget.style.background = n.read ? "transparent" : "rgba(37,99,235,0.05)"}
                    >
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{
                          background: `linear-gradient(135deg, ${meta.accent}18, ${meta.accent}06)`,
                          border: `1px solid ${meta.accent}20`,
                        }}
                      >
                        <Icon size={12} style={{ color: meta.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold text-white leading-tight">{n.title}</p>
                        <p className="text-[10px] mt-0.5 leading-snug" style={{ color: "rgba(255,255,255,0.4)" }}>
                          {n.body}
                        </p>
                        <p className="text-[9px] mt-1 font-medium" style={{ color: "rgba(255,255,255,0.18)" }}>
                          {ago(n.time)}
                        </p>
                      </div>
                      {!n.read && (
                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5"
                          style={{ background: meta.accent, boxShadow: `0 0 6px ${meta.accent}80` }}
                        />
                      )}
                    </motion.div>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ago(ts) {
  const d = Math.floor((Date.now() - ts) / 1000);
  if (d < 60)    return "только что";
  if (d < 3600)  return `${Math.floor(d / 60)} мин назад`;
  if (d < 86400) return `${Math.floor(d / 3600)} ч назад`;
  return `${Math.floor(d / 86400)} д назад`;
}
