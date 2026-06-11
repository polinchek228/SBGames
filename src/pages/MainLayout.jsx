import React, { useState, useEffect } from "react";
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
import { NotificationBell, useNotifications } from "../components/NotificationSystem.jsx";
import { notify, setDiscordPresence } from "../lib/tauri.js";
import { WS_URL, getToken } from "../lib/api.js";

const NAV_ITEMS = [
  { id: "play",        label: "ИГРАТЬ",      icon: GameController },
  { id: "profile",     label: "ПРОФИЛЬ",     icon: User },
  { id: "leaderboard", label: "ВОСХОЖДЕНИЕ", icon: Trophy },
  { id: "shop",        label: "МАГАЗИН",     icon: ShoppingBag },
  { id: "news",        label: "НОВОСТИ",     icon: Newspaper },
  { id: "support",     label: "ПОМОЩЬ",      icon: Headset },
];

export default function MainLayout({ user, onLogout }) {
  const [page, setPage] = useState("play");
  const [showCommunity, setShowCommunity] = useState(false);
  const [friendBadge, setFriendBadge] = useState(0);
  const [balance, setBalance] = useState(user?.balance ?? 0);
  const { push: pushNotif } = useNotifications() || {};

  // ─── 8. WS-уведомления (баланс, друзья, тикеты) ──────────────────────────
  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: "auth",
        userId: user?.id,
        username: user?.username,
        token: getToken(),
      }));
    };
    ws.onmessage = async (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "balance_update") {
          setBalance(msg.balance);
          pushNotif?.("Баланс пополнен", `+${msg.balance - balance} СБТ · Новый баланс: ${msg.balance} СБТ`, "balance");
          await notify("SB Games", `Баланс пополнен: ${msg.balance} СБТ`);
        }
        if (msg.type === "friend_accepted") {
          pushNotif?.("Новый друг", `${msg.byUsername} принял вашу заявку`, "friend");
          await notify("SB Games", `${msg.byUsername} принял заявку в друзья`);
        }
        if (msg.type === "ticket_update" && msg.ticket?.status === "answered") {
          pushNotif?.("Поддержка ответила", `Ответ по обращению #${msg.ticket.id}`, "ticket");
          await notify("Поддержка SB Games", `Ответ по обращению #${msg.ticket.id}`);
        }
      } catch {}
    };
    ws.onerror = () => {};
    return () => ws.close();
  }, [user]);

  // Discord — в лаунчере
  useEffect(() => {
    setDiscordPresence("В лаунчере", "SB Games", "sbgames");
  }, []);

  // Трей-навигация: Rust шлёт window.__navigateTo('play' | 'support')
  useEffect(() => {
    window.__navigateTo = (id) => {
      const valid = NAV_ITEMS.find(n => n.id === id);
      if (valid) setPage(id);
    };
    return () => { delete window.__navigateTo; };
  }, []);

  const renderPage = (id) => {
    switch (id) {
      case "play":        return <PlayPage user={user} onOpenCommunity={() => setShowCommunity(true)} />;
      case "profile":     return <ProfilePage user={user} />;
      case "leaderboard": return <LeaderboardPage />;
      case "news":        return <NewsPage />;
      case "shop":        return <ShopPage />;
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
        className="w-full flex-shrink-0 relative flex items-center px-3"
        style={{
          height: "46px",
          background: "rgba(8,8,10,0.98)",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          backdropFilter: "blur(20px)",
        }}
      >
        {/* Logo — left */}
        <div
          className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg select-none"
          style={{
            background: "rgba(15,15,20,0.9)",
            boxShadow: "0 0 12px rgba(37,99,235,0.2)",
          }}
        >
          <img src="/logo.jpg" alt="G" className="w-5 h-5 rounded object-cover" />
        </div>

        {/* Nav items — absolutely centered */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-0.5">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
            const active = page === id;
            return (
              <button
                key={id}
                onClick={() => setPage(id)}
                className="flex items-center gap-1.5 px-3 h-[28px] text-[10px] font-semibold tracking-widest whitespace-nowrap transition-all duration-150 select-none"
                style={active
                  ? {
                      background: "rgba(37,99,235,0.85)",
                      color: "#fff",
                      borderRadius: "20px",
                      boxShadow: "0 0 10px rgba(37,99,235,0.35)",
                    }
                  : {
                      background: "transparent",
                      color: "rgba(255,255,255,0.32)",
                      borderRadius: "20px",
                    }
                }
                onMouseEnter={e => { if (!active) e.currentTarget.style.color = "rgba(255,255,255,0.65)"; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.color = "rgba(255,255,255,0.32)"; }}
              >
                <Icon size={11} weight={active ? "fill" : "regular"} />
                {label}
              </button>
            );
          })}
        </div>

        {/* Right group: balance + community + logout */}
        <div className="flex items-center gap-1.5 ml-auto">
          {/* Balance pill with coin icon */}
          <div
            className="flex items-center gap-1.5 px-2.5 h-[28px] rounded-full select-none"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <img src="/money.png" alt="coin" className="w-4 h-4 object-contain" style={{ filter: "drop-shadow(0 0 4px rgba(37,99,235,0.6))" }} />
            <span className="text-[12px] font-bold text-white tabular-nums">{balance}</span>
          </div>

          {/* Notification bell */}
          <NotificationBell />

          {/* Community toggle */}
          <button
            onClick={() => setShowCommunity(v => !v)}
            className="relative w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-150"
            style={showCommunity
              ? { background: "rgba(37,99,235,0.7)", color: "#fff" }
              : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.35)" }
            }
            onMouseEnter={e => { if (!showCommunity) e.currentTarget.style.color = "rgba(255,255,255,0.65)"; }}
            onMouseLeave={e => { if (!showCommunity) e.currentTarget.style.color = "rgba(255,255,255,0.35)"; }}
          >
            <UsersThree size={13} weight={showCommunity ? "fill" : "regular"} />
            {friendBadge > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-blue-600 text-[9px] font-black text-white flex items-center justify-center">
                {friendBadge}
              </span>
            )}
          </button>

          {/* Logout */}
          <button
            onClick={onLogout}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-150"
            style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.35)" }}
            onMouseEnter={e => { e.currentTarget.style.color = "rgba(239,68,68,0.85)"; e.currentTarget.style.background = "rgba(239,68,68,0.08)"; }}
            onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.35)"; e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
          >
            <SignOut size={13} />
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 relative overflow-hidden">
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
              <CommunityPage onClose={() => setShowCommunity(false)} user={user} onBadgeChange={setFriendBadge} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 6. Download progress overlay */}
      <DownloadProgress />
    </motion.div>
  );
}
