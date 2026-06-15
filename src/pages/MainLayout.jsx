import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  GameController, User, Trophy, ShoppingBag,
  Newspaper, Headset, UsersThree, SignOut,
} from "@phosphor-icons/react";
import Titlebar from "../components/Titlebar.jsx";
import PlayPage from "./PlayPage.jsx";
import ProfilePage from "./ProfilePage.jsx";
import NewsPage from "./NewsPage.jsx";
import ShopPage from "./ShopPage.jsx";
import SupportPage from "./SupportPage.jsx";
import CommunityPage from "./CommunityPage.jsx";
import LeaderboardPage from "./LeaderboardPage.jsx";
import DownloadProgress from "../components/DownloadProgress.jsx";
import { NotificationBell, useNotifications, pushNotification } from "../components/NotificationSystem.jsx";
import { notifyDesktop, setDiscordPresence, invoke } from "../lib/tauri.js";
import { WS_URL, getToken } from "../lib/api.js";
import { CATALOG_BY_ID } from "./catalog.js";

const NAV_ITEMS = [
  { id: "play",        label: "ИГРАТЬ",      icon: GameController },
  { id: "profile",     label: "ПРОФИЛЬ",     icon: User },
  { id: "leaderboard", label: "ВОСХОЖДЕНИЕ", icon: Trophy },
  { id: "shop",        label: "МАГАЗИН",     icon: ShoppingBag },
  { id: "news",        label: "НОВОСТИ",     icon: Newspaper },
  { id: "support",     label: "ПОМОЩЬ",      icon: Headset },
];

/* ── Global background video (experimental setting) ─────────────────────── */
function GlobalBackground() {
  const [videoSrc, setVideoSrc] = useState(null);

  useEffect(() => {
    const update = () => {
      try {
        const settings = JSON.parse(localStorage.getItem("sbgames_settings")) || {};
        if (!settings.globalBg) { setVideoSrc(null); return; }
        const userData = JSON.parse(localStorage.getItem("sbgames_user")) || {};
        const bgId = userData?.equip?.background;
        if (!bgId) { setVideoSrc(null); return; }
        const item = CATALOG_BY_ID[bgId];
        if (item?.video) setVideoSrc(item.video);
        else setVideoSrc(null);
      } catch { setVideoSrc(null); }
    };
    update();
    // Re-check when settings or user data change
    const onStorage = (e) => {
      if (e.key === "sbgames_settings" || e.key === "sbgames_user") update();
    };
    window.addEventListener("storage", onStorage);
    // Also poll briefly to catch same-tab changes
    const iv = setInterval(update, 1500);
    return () => { window.removeEventListener("storage", onStorage); clearInterval(iv); };
  }, []);

  if (!videoSrc) return null;
  return (
    <video
      key={videoSrc}
      autoPlay loop muted playsInline
      src={videoSrc}
      style={{
        position: "absolute", inset: 0, width: "100%", height: "100%",
        objectFit: "cover", zIndex: 0, pointerEvents: "none",
      }}
    />
  );
}

export default function MainLayout({ user, onLogout }) {
  const [page, setPage] = useState("play");
  const [showCommunity, setShowCommunity] = useState(false);
  const [viewUserId, setViewUserId] = useState(null);
  const [friendBadge, setFriendBadge] = useState(0);
  const [balance, setBalance] = useState(user?.balance ?? 0);
  const balanceRef = useRef(balance);
  balanceRef.current = balance;
  const userRef = useRef(user);
  userRef.current = user;

  // ─── WS-уведомления (баланс, друзья, тикеты) ──────────────────────────
  useEffect(() => {
    let dead = false;
    let ws;
    let reconnectTimer;

    const connect = () => {
      if (dead) return;
      ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        if (dead) { ws.close(); return; }
        const u = userRef.current;
        ws.send(JSON.stringify({
          type: "auth",
          userId: u?.id,
          username: u?.username,
          token: getToken(),
        }));
      };

      ws.onmessage = async (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === "balance_update") {
            const diff = msg.balance - balanceRef.current;
            setBalance(msg.balance);
            pushNotification("Баланс пополнен", `+${diff} СБТ · Новый баланс: ${msg.balance} СБТ`, "balance");
            await notifyDesktop("SB Games", `Баланс пополнен: ${msg.balance} СБТ`);
          }
          if (msg.type === "friend_accepted") {
            pushNotification("Новый друг", `${msg.byUsername} принял вашу заявку`, "friend");
            await notifyDesktop("SB Games", `${msg.byUsername} принял заявку в друзья`);
          }
          if (msg.type === "ticket_update" && msg.ticket?.status === "answered") {
            pushNotification("Поддержка ответила", `Ответ по обращению #${msg.ticket.id}`, "ticket");
            await notifyDesktop("Поддержка SB Games", `Ответ по обращению #${msg.ticket.id}`);
          }
        } catch {}
      };

      ws.onclose = () => {
        if (!dead) reconnectTimer = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        if (ws.readyState !== WebSocket.CLOSED) ws.close();
      };
    };

    // Delay to avoid React StrictMode double-invocation closing the socket before it connects
    const timer = setTimeout(connect, 100);

    return () => {
      dead = true;
      clearTimeout(timer);
      clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [user?.id]);

  // Discord — в лаунчере
  useEffect(() => {
    setDiscordPresence("В лаунчере", "SB Games", "sbgames");
  }, []);

  // Запрос разрешения на уведомления при первом входе
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  // Приветственное уведомление — только один раз за всё время
  useEffect(() => {
    if (!user) return;
    if (localStorage.getItem("sbg_welcomed")) return;
    const timer = setTimeout(() => {
      if (!localStorage.getItem("sbg_welcomed")) {
        pushNotification("Добро пожаловать!", `Привет, ${user.username}! Это SB Games лаунчер.`, "system");
        localStorage.setItem("sbg_welcomed", "1");
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [user]);

  // Трей-навигация: Rust шлёт window.__navigateTo('play' | 'support')
  useEffect(() => {
    window.__navigateTo = (id) => {
      const valid = NAV_ITEMS.find(n => n.id === id);
      if (valid) setPage(id);
    };
    // IPC с треем: пушим актуальный стейт в popup
    const pushTrayState = () => {
      invoke("tray_update_state", {
        user:    user ? { id: user.id, username: user.username, role: user.role, balance } : null,
        notifs:  null, // notifs обновляются ниже отдельно
        playing: false,
      });
    };
    window.__requestTrayState = pushTrayState;
    window.__launchGame = () => {
      const playBtn = document.querySelector('[data-launch-btn]');
      if (playBtn) playBtn.click();
    };
    window.__logout = () => onLogout();
    pushTrayState();
    return () => {
      delete window.__navigateTo;
      delete window.__requestTrayState;
      delete window.__launchGame;
      delete window.__logout;
    };
  }, [user, balance, onLogout]);

  // Синхронизируем уведомления в трей
  const { inbox } = useNotifications() || { inbox: [] };
  useEffect(() => {
    invoke("tray_update_state", { user: null, notifs: inbox, playing: false });
  }, [inbox]);

  const renderPage = (id) => {
    switch (id) {
      case "play":        return <PlayPage user={user} onOpenCommunity={() => setShowCommunity(true)} />;
      case "profile":     return <ProfilePage user={user} viewUserId={viewUserId} onBack={() => setViewUserId(null)} />;
      case "leaderboard": return <LeaderboardPage />;
      case "news":        return <NewsPage />;
      case "shop":        return <ShopPage user={user} onBalanceChange={setBalance} />;
      case "support":     return <SupportPage user={user} />;
      default:            return null;
    }
  };

  return (
    <motion.div
      className="w-full h-full flex flex-col bg-black"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Titlebar />

      {/* ── Full-width header bar ── */}
      <div
        className="w-full flex-shrink-0 grid items-center px-3"
        style={{
          height: "46px",
          background: "rgba(8,8,10,0.98)",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          backdropFilter: "blur(20px)",
          zIndex: 50,
          gridTemplateColumns: "1fr auto 1fr",
        }}
      >
        {/* Left spacer */}
        <div />

        {/* Nav items — centered */}
        <div className="flex items-center gap-1 justify-self-center">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
            const active = page === id;
            return (
              <button
                key={id}
                onClick={() => setPage(id)}
                className="flex items-center gap-2 px-4 h-[34px] text-[11px] font-bold tracking-widest whitespace-nowrap transition-all duration-300 ease-out select-none active:scale-95"
                style={active
                  ? {
                      background: "linear-gradient(135deg, rgba(37,99,235,0.95), rgba(59,130,246,0.9))",
                      color: "#fff",
                      borderRadius: "10px",
                      boxShadow: "0 0 20px rgba(37,99,235,0.4), 0 2px 10px rgba(37,99,235,0.3), inset 0 1px 0 rgba(255,255,255,0.15)",
                    }
                  : {
                      background: "transparent",
                      color: "rgba(255,255,255,0.35)",
                    }
                }
                onMouseEnter={e => { if (!active) { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "rgba(255,255,255,0.7)"; } }}
                onMouseLeave={e => { if (!active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.35)"; } }}
              >
                <Icon size={14} weight={active ? "fill" : "bold"} />
                {label}
              </button>
            );
          })}
        </div>

        {/* Right group: balance + community + logout */}
        <div className="flex items-center gap-2.5 justify-self-end">
          {/* Balance pill with coin icon */}
          <div
            className="flex items-center gap-2 px-3 h-[34px] rounded-xl select-none"
            style={{
              background: "transparent",
            }}
          >
            <img src="/money.png" alt="coin" className="w-4 h-4 object-contain" style={{ filter: "drop-shadow(0 0 4px rgba(37,99,235,0.6))" }} />
            <span className="text-[13px] font-bold text-white tabular-nums">{balance}</span>
          </div>

          {/* Notification bell */}
          <NotificationBell />

          {/* Community toggle */}
          <button
            onClick={() => setShowCommunity(v => !v)}
            className="relative w-[34px] h-[34px] rounded-xl flex items-center justify-center transition-all duration-150"
            style={showCommunity
              ? { background: "linear-gradient(135deg, rgba(37,99,235,0.9), rgba(59,130,246,0.85))", color: "#fff", boxShadow: "0 0 12px rgba(37,99,235,0.3)" }
              : { background: "transparent", color: "rgba(255,255,255,0.35)" }
            }
            onMouseEnter={e => { if (!showCommunity) { e.currentTarget.style.color = "rgba(255,255,255,0.7)"; e.currentTarget.style.background = "rgba(255,255,255,0.06)"; } }}
            onMouseLeave={e => { if (!showCommunity) { e.currentTarget.style.color = "rgba(255,255,255,0.35)"; e.currentTarget.style.background = "transparent"; } }}
          >
            <UsersThree size={15} weight={showCommunity ? "fill" : "bold"} />
            {friendBadge > 0 && (
              <span className="absolute -top-1 -right-1 w-[18px] h-[18px] rounded-full bg-blue-600 text-[9px] font-black text-white flex items-center justify-center"
                style={{ boxShadow: "0 0 8px rgba(37,99,235,0.5)" }}>
                {friendBadge}
              </span>
            )}
          </button>

          {/* Logout */}
          <button
            onClick={onLogout}
            className="w-[34px] h-[34px] rounded-xl flex items-center justify-center transition-all duration-150"
            style={{ background: "transparent", color: "rgba(255,255,255,0.35)" }}
            onMouseEnter={e => { e.currentTarget.style.color = "rgba(239,68,68,0.9)"; e.currentTarget.style.background = "rgba(239,68,68,0.1)"; }}
            onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.35)"; e.currentTarget.style.background = "transparent"; }}
          >
            <SignOut size={15} weight="bold" />
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 relative overflow-hidden">
        <GlobalBackground />
        {NAV_ITEMS.map(({ id }) => (
          <motion.div
            key={id}
            className="absolute inset-0 overflow-hidden"
            animate={{ opacity: page === id ? 1 : 0, pointerEvents: page === id ? "auto" : "none" }}
            transition={{ duration: 0.12 }}
            style={{ zIndex: page === id ? 1 : 0 }}
          >
            {renderPage(id)}
          </motion.div>
        ))}

        <AnimatePresence>
          {showCommunity && (
            <motion.div
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 32, stiffness: 320 }}
              className="absolute top-0 right-0 bottom-0 z-30"
            >
              <CommunityPage onClose={() => setShowCommunity(false)} user={user} onBadgeChange={setFriendBadge}
                onViewProfile={(id) => { setShowCommunity(false); setViewUserId(id); setPage("profile"); }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 6. Download progress overlay */}
      <DownloadProgress />
    </motion.div>
  );
}
