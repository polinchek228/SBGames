import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow, LogicalPosition } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import {
  Play, X, Bell, Settings, MessageCircle, LogOut,
  Coins, Users, ChevronRight, Power,
} from "lucide-react";
import { Headset, GameController, ShoppingBag, User, Trophy, Newspaper } from "@phosphor-icons/react";

const ICON_BASE = { color: "rgba(255,255,255,0.6)", weight: "regular" };
const ICON_ACTIVE = { color: "#fff", weight: "fill" };

export default function TrayPopup() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState("main");
  const [notifs, setNotifs] = useState([]);
  const [playing, setPlaying] = useState(false);

  // Получаем данные из main окна
  useEffect(() => {
    invoke("tray_get_state").then(s => {
      if (s) {
        setUser(s.user);
        setNotifs(s.notifs || []);
        setPlaying(s.playing);
      }
    });
  }, []);

  // Слушаем обновления
  useEffect(() => {
    const unlisten = listen("tray_state_update", (e) => {
      setUser(e.payload.user);
      setNotifs(e.payload.notifs || []);
      setPlaying(e.payload.playing);
    });
    return () => { unlisten.then(fn => fn()); };
  }, []);

  // Позиционируем у трея при монтировании
  useEffect(() => {
    (async () => {
      try {
        const win = getCurrentWindow();
        // Позиция: правый нижний угол у трея (стандартный Windows tray)
        const factor = window.devicePixelRatio || 1;
        const w = 360, h = 520;
        // Получаем размеры экрана
        const sw = window.screen.width;
        const sh = window.screen.height;
        await win.setPosition(new LogicalPosition(sw - w - 16, sh - h - 56));
        await win.setSize({ type: "Logical", width: w, height: h });
        await win.setFocus();
        await win.show();
      } catch {}
    })();
  }, []);

  const close = () => invoke("tray_hide").catch(() => {});

  const nav = (pageId) => {
    invoke("navigate_to", { page: pageId });
    close();
  };

  const launch = () => {
    invoke("tray_launch_game");
    close();
  };

  const logout = () => {
    invoke("tray_logout");
    close();
  };

  const unread = notifs.filter(n => !n.read).length;

  return (
    <div style={{
      width: "100vw", height: "100vh",
      background: "linear-gradient(180deg, rgba(15,15,20,0.98) 0%, rgba(8,8,12,0.98) 100%)",
      borderRadius: 18, overflow: "hidden",
      color: "#fff", fontFamily: "system-ui",
      boxShadow: "0 24px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.06)",
    }}>
      <AnimatePresence mode="wait">
        {page === "main" ? (
          <motion.div key="main"
            initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.15 }}
            className="flex flex-col h-full p-4 gap-3"
          >
            {/* Header */}
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(37,99,235,0.15)" }}>
                <GameController size={15} weight="fill" style={{ color: "#60a5fa" }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-bold text-white">SB Games</p>
                <p className="text-[9px]" style={{ color: "rgba(255,255,255,0.25)" }}>
                  {playing ? "В игре" : "В лаунчере"}
                </p>
              </div>
              <button onClick={close}
                className="w-6 h-6 rounded-lg flex items-center justify-center transition-all"
                style={{ color: "rgba(255,255,255,0.3)" }}
                onMouseEnter={e => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
                onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.3)"; e.currentTarget.style.background = "transparent"; }}>
                <X size={12} />
              </button>
            </div>

            {/* User card */}
            {user && (
              <div className="rounded-2xl p-3 flex items-center gap-3"
                style={{ background: "rgba(255,255,255,0.04)" }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-[13px] font-black flex-shrink-0"
                  style={{ background: user.role === "admin" ? "rgba(239,68,68,0.15)" : "rgba(37,99,235,0.15)",
                           color: user.role === "admin" ? "#fca5a5" : "#93c5fd" }}>
                  {user.username?.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-white truncate">{user.username}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Coins size={9} style={{ color: "#60a5fa" }} />
                    <span className="text-[10px] font-bold tabular-nums text-white">{user.balance ?? 0}</span>
                    <span className="text-[9px]" style={{ color: "rgba(255,255,255,0.25)" }}>СБТ</span>
                  </div>
                </div>
              </div>
            )}

            {/* Play button */}
            <motion.button onClick={launch} whileTap={{ scale: 0.97 }}
              className="rounded-2xl py-3 flex items-center justify-center gap-2 text-[13px] font-bold transition-all"
              style={{ background: playing ? "rgba(52,211,153,0.2)" : "rgba(37,99,235,0.85)", color: playing ? "#34d399" : "#fff" }}
              disabled={playing}
            >
              <Play size={14} weight="fill" />
              {playing ? "В игре" : "Играть на STARWARS"}
            </motion.button>

            {/* Quick nav */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: "profile",     label: "Профиль",   icon: User,        },
                { id: "leaderboard", label: "Топ",       icon: Trophy,      },
                { id: "shop",        label: "Магазин",   icon: ShoppingBag, },
                { id: "news",        label: "Новости",   icon: Newspaper,   },
                { id: "support",     label: "Помощь",    icon: Headset,     },
                { id: "notifs",      label: "Уведомления", icon: Bell,      badge: unread },
              ].map(({ id, label, icon: Icon, badge }) => (
                <motion.button key={id} whileTap={{ scale: 0.96 }}
                  onClick={() => id === "notifs" ? setPage("notifs") : nav(id)}
                  className="relative rounded-2xl p-3 flex items-center gap-2.5 transition-all duration-150"
                  style={{ background: "rgba(255,255,255,0.03)" }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.07)"}
                  onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: id === "notifs" ? "rgba(139,92,246,0.15)" : "rgba(255,255,255,0.06)" }}>
                    {typeof Icon === "function" && Icon.render ? <Icon size={13} style={{ color: id === "notifs" ? "#a78bfa" : "rgba(255,255,255,0.5)" }} /> : <Icon size={13} style={{ color: id === "notifs" ? "#a78bfa" : "rgba(255,255,255,0.5)" }} />}
                  </div>
                  <span className="text-[11px] font-medium text-white flex-1 text-left">{label}</span>
                  {badge > 0 && (
                    <span className="min-w-[16px] h-4 px-1 rounded-full text-[9px] font-black flex items-center justify-center"
                      style={{ background: "#7c3aed", color: "#fff" }}>
                      {badge > 9 ? "9+" : badge}
                    </span>
                  )}
                </motion.button>
              ))}
            </div>

            {/* Footer */}
            <div className="mt-auto flex items-center gap-1.5">
              <motion.button whileTap={{ scale: 0.95 }} onClick={logout}
                className="flex-1 rounded-xl py-2 text-[11px] font-medium flex items-center justify-center gap-1.5 transition-all"
                style={{ background: "rgba(239,68,68,0.08)", color: "rgba(252,165,165,0.6)" }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.18)"; e.currentTarget.style.color = "#fca5a5"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(239,68,68,0.08)"; e.currentTarget.style.color = "rgba(252,165,165,0.6)"; }}>
                <Power size={11} />Выйти
              </motion.button>
            </div>
          </motion.div>
        ) : (
          /* Уведомления */
          <motion.div key="notifs"
            initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.15 }}
            className="flex flex-col h-full"
          >
            <div className="flex items-center gap-2.5 p-4"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <motion.button whileTap={{ scale: 0.9 }} onClick={() => setPage("main")}
                className="w-6 h-6 rounded-lg flex items-center justify-center"
                style={{ color: "rgba(255,255,255,0.4)" }}
                onMouseEnter={e => e.currentTarget.style.color = "#fff"}
                onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.4)"}>
                <ChevronRight size={13} style={{ transform: "rotate(180deg)" }} />
              </motion.button>
              <p className="text-[12px] font-bold text-white flex-1">Уведомления</p>
              <span className="text-[10px] px-2 py-0.5 rounded-md"
                style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)" }}>
                {unread} новых
              </span>
            </div>

            <div className="flex-1 overflow-y-auto px-2 py-2">
              {notifs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full opacity-30">
                  <Bell size={24} className="text-white mb-2" />
                  <p className="text-[11px] text-white">Нет уведомлений</p>
                </div>
              ) : (
                notifs.slice(0, 15).map((n, i) => (
                  <motion.div key={n.id}
                    initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                    className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl mb-1"
                    style={{ background: n.read ? "transparent" : "rgba(139,92,246,0.08)" }}>
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5"
                      style={{ background: n.read ? "transparent" : "#7c3aed", boxShadow: n.read ? "none" : "0 0 5px rgba(124,58,237,0.6)" }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-semibold text-white">{n.title}</p>
                      <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>{n.body}</p>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
