import React, { useState, useEffect, useCallback, useRef, createContext, useContext } from "react";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import { X, Bell, CheckCircle, Users, Coins, MessageCircle, Info } from "lucide-react";

// ─── Context ──────────────────────────────────────────────────────────────────
const NotifCtx = createContext(null);
export function useNotifications() { return useContext(NotifCtx); }

const ICONS = {
  friend:  { icon: Users,         color: "#60a5fa", bg: "rgba(37,99,235,0.15)"  },
  balance: { icon: Coins,         color: "#34d399", bg: "rgba(52,211,153,0.12)" },
  ticket:  { icon: MessageCircle, color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  system:  { icon: Info,          color: "#a78bfa", bg: "rgba(139,92,246,0.12)" },
  success: { icon: CheckCircle,   color: "#34d399", bg: "rgba(52,211,153,0.12)" },
};

// ─── Provider ─────────────────────────────────────────────────────────────────
export function NotificationProvider({ children }) {
  const [toasts, setToasts] = useState([]);          // всплывающие уведомления
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

    // Toast
    setToasts(prev => [notif, ...prev].slice(0, 5));
    setTimeout(() => setToasts(prev => prev.filter(n => n.id !== id)), 5000);

    // Inbox
    setInbox(prev => {
      const next = [notif, ...prev].slice(0, 50);
      localStorage.setItem("sbg_notifs", JSON.stringify(next));
      return next;
    });
  }, []);

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

// ─── Toast stack (нижний правый угол) ────────────────────────────────────────
function ToastStack({ toasts, onDismiss }) {
  return (
    <div className="fixed bottom-5 right-5 z-[9990] flex flex-col-reverse gap-2.5 pointer-events-none"
      style={{ width: 320 }}
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((n, idx) => (
          <Toast key={n.id} notif={n} idx={idx} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function Toast({ notif, idx, onDismiss }) {
  const meta = ICONS[notif.type] || ICONS.system;
  const Icon = meta.icon;
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const start = Date.now();
    const total = 5000;
    const raf = () => {
      const pct = Math.max(0, 100 - ((Date.now() - start) / total) * 100);
      setProgress(pct);
      if (pct > 0) requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);
  }, []);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 60, scale: 0.92 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 60, scale: 0.88 }}
      transition={{ type: "spring", stiffness: 400, damping: 32 }}
      style={{ pointerEvents: "auto" }}
    >
      <div
        className="relative rounded-2xl overflow-hidden flex items-start gap-3 p-3.5"
        style={{
          background: "rgba(10,10,14,0.97)",
          boxShadow: "0 4px 32px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.06)",
          backdropFilter: "blur(20px)",
        }}
      >
        {/* Icon */}
        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{ background: meta.bg }}
        >
          <Icon size={14} style={{ color: meta.color }} />
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-semibold text-white leading-tight">{notif.title}</p>
          <p className="text-[11px] mt-0.5 leading-snug" style={{ color: "rgba(255,255,255,0.5)" }}>
            {notif.body}
          </p>
        </div>

        {/* Close */}
        <button
          onClick={() => onDismiss(notif.id)}
          className="w-5 h-5 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-150"
          style={{ color: "rgba(255,255,255,0.25)" }}
          onMouseEnter={e => e.currentTarget.style.color = "rgba(255,255,255,0.7)"}
          onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.25)"}
        >
          <X size={10} />
        </button>

        {/* Progress bar */}
        <div className="absolute bottom-0 left-0 right-0 h-[2px]"
          style={{ background: "rgba(255,255,255,0.05)" }}
        >
          <div
            className="h-full transition-none"
            style={{
              width: `${progress}%`,
              background: `linear-gradient(90deg, ${meta.color}80, ${meta.color})`,
              transition: "width 0.1s linear",
            }}
          />
        </div>
      </div>
    </motion.div>
  );
}

// ─── Bell icon + панель ───────────────────────────────────────────────────────
export function NotificationBell() {
  const { inbox, unread, markAllRead, clearAll } = useNotifications();
  const [open, setOpen] = useState(false);
  const controls = useAnimation();
  const prevUnread = useRef(unread);
  const panelRef = useRef(null);

  // Анимация звонка при новом уведомлении
  useEffect(() => {
    if (unread > prevUnread.current && prevUnread.current > 0) {
      controls.start({
        rotate: [0, -18, 18, -12, 12, -6, 6, 0],
        transition: { duration: 0.55, ease: "easeInOut" },
      });
    }
    prevUnread.current = unread;
  }, [unread, controls]);

  // Закрываем при клике вне (только если панель открыта)
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    // Используем click вместо mousedown — не конфликтует с onClick колокольчика
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [open]);

  const toggle = (e) => {
    e?.stopPropagation();
    if (!open) markAllRead();
    setOpen(v => !v);
  };

  return (
    <div className="relative" ref={panelRef} style={{ zIndex: 100 }}>
      {/* Bell button */}
      <motion.button
        onClick={toggle}
        onMouseDown={(e) => e.stopPropagation()}
        animate={controls}
        whileTap={{ scale: 0.88 }}
        className="relative w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-150"
        style={open
          ? { background: "rgba(139,92,246,0.2)", color: "#a78bfa" }
          : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.35)" }
        }
        onMouseEnter={e => { if (!open) { e.currentTarget.style.color = "rgba(255,255,255,0.7)"; e.currentTarget.style.background = "rgba(255,255,255,0.09)"; } }}
        onMouseLeave={e => { if (!open) { e.currentTarget.style.color = "rgba(255,255,255,0.35)"; e.currentTarget.style.background = "rgba(255,255,255,0.05)"; } }}
      >
        <Bell size={13} />

        {/* Badge */}
        <AnimatePresence>
          {unread > 0 && (
            <motion.span
              key="badge"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 28 }}
              className="absolute -top-1 -right-1 min-w-[14px] h-[14px] px-0.5 rounded-full flex items-center justify-center text-[8px] font-black text-white"
              style={{ background: "#7c3aed", boxShadow: "0 0 8px rgba(124,58,237,0.7)" }}
            >
              {unread > 9 ? "9+" : unread}
            </motion.span>
          )}
        </AnimatePresence>

        {/* Пульс при непрочитанных */}
        {unread > 0 && !open && (
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full animate-ping"
            style={{ background: "rgba(124,58,237,0.4)" }}
          />
        )}
      </motion.button>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: -8 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className="absolute top-9 right-0 w-[300px] rounded-2xl overflow-hidden"
            style={{ zIndex: 10001, background: "rgba(9,9,12,0.98)", boxShadow: "0 8px 48px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.07)" }}
            style={{
              background: "rgba(9,9,12,0.98)",
              boxShadow: "0 8px 48px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.07)",
            }}
          >
            {/* Panel header */}
            <div className="flex items-center justify-between px-4 py-3"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
            >
              <p className="text-[12px] font-bold text-white">Уведомления</p>
              {inbox.length > 0 && (
                <button onClick={clearAll}
                  className="text-[10px] transition-colors duration-150"
                  style={{ color: "rgba(255,255,255,0.25)" }}
                  onMouseEnter={e => e.currentTarget.style.color = "rgba(255,255,255,0.6)"}
                  onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.25)"}
                >
                  Очистить
                </button>
              )}
            </div>

            {/* List */}
            <div className="max-h-[360px] overflow-y-auto">
              {inbox.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 opacity-30">
                  <Bell size={22} className="text-white" />
                  <p className="text-[11px] text-white">Нет уведомлений</p>
                </div>
              ) : (
                inbox.slice(0, 20).map((n, i) => {
                  const meta = ICONS[n.type] || ICONS.system;
                  const Icon = meta.icon;
                  return (
                    <motion.div
                      key={n.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="flex items-start gap-3 px-4 py-3 transition-all duration-150"
                      style={{
                        background: n.read ? "transparent" : "rgba(124,58,237,0.05)",
                        borderBottom: "1px solid rgba(255,255,255,0.03)",
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.04)"}
                      onMouseLeave={e => e.currentTarget.style.background = n.read ? "transparent" : "rgba(124,58,237,0.05)"}
                    >
                      <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ background: meta.bg }}
                      >
                        <Icon size={12} style={{ color: meta.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-semibold text-white leading-tight">{n.title}</p>
                        <p className="text-[10px] mt-0.5 leading-snug" style={{ color: "rgba(255,255,255,0.45)" }}>
                          {n.body}
                        </p>
                        <p className="text-[9px] mt-1" style={{ color: "rgba(255,255,255,0.2)" }}>
                          {ago(n.time)}
                        </p>
                      </div>
                      {!n.read && (
                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5"
                          style={{ background: "#7c3aed", boxShadow: "0 0 6px rgba(124,58,237,0.6)" }}
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
