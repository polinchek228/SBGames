import React, { useState } from "react";
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

const NAV_ITEMS = [
  { id: "play",        label: "Играть",      icon: GameController },
  { id: "profile",     label: "Профиль",     icon: User },
  { id: "leaderboard", label: "Восхождение", icon: Trophy },
  { id: "shop",        label: "Магазин",     icon: ShoppingBag },
  { id: "news",        label: "Новости",     icon: Newspaper },
  { id: "support",     label: "Поддержка",   icon: Headset },
];

export default function MainLayout({ user, onLogout }) {
  const [page, setPage] = useState("play");
  const [showCommunity, setShowCommunity] = useState(false);
  const [friendBadge, setFriendBadge] = useState(0);

  const renderPage = () => {
    switch (page) {
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

      {/* ── Floating navbar по центру ── */}
      <div className="relative flex items-center justify-center h-14 flex-shrink-0 px-4">
        {/* Центральная таблетка */}
        <div
          className="flex items-center gap-1 px-2 py-1.5 rounded-2xl"
          style={{
            background: "rgba(18,18,18,0.95)",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 4px 24px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)",
            backdropFilter: "blur(20px)",
          }}
        >
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
            const active = page === id;
            return (
              <button
                key={id}
                onClick={() => setPage(id)}
                className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-medium tracking-wide transition-all duration-150 whitespace-nowrap"
                style={active
                  ? { color: "#fff", background: "rgba(255,255,255,0.1)" }
                  : { color: "rgba(255,255,255,0.35)" }
                }
                onMouseEnter={e => { if (!active) e.currentTarget.style.color = "rgba(255,255,255,0.65)"; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.color = "rgba(255,255,255,0.35)"; }}
              >
                <Icon size={13} weight={active ? "fill" : "regular"} />
                {label}
                {active && (
                  <motion.div
                    layoutId="nav-active"
                    className="absolute inset-0 rounded-xl"
                    style={{ background: "rgba(255,255,255,0.07)" }}
                    transition={{ type: "spring", stiffness: 400, damping: 35 }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Правая группа — абсолютно позиционирована */}
        <div className="absolute right-4 flex items-center gap-1.5">
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
            style={{ background: "rgba(255,255,255,0.04)" }}
          >
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            <span className="text-[12px] font-bold text-white tabular-nums">{user.balance ?? 0}</span>
            <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.25)" }}>СБТ</span>
          </div>
          <button
            onClick={() => setShowCommunity(v => !v)}
            className="relative w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-150"
            style={showCommunity
              ? { background: "#2563EB", color: "#fff" }
              : { background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.4)" }
            }
          >
            <UsersThree size={15} weight={showCommunity ? "fill" : "regular"} />
            {friendBadge > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-blue-600 text-[9px] font-black text-white flex items-center justify-center">
                {friendBadge}
              </span>
            )}
          </button>
          <button
            onClick={onLogout}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-150"
            style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.4)" }}
            onMouseEnter={e => { e.currentTarget.style.color = "rgba(239,68,68,0.9)"; e.currentTarget.style.background = "rgba(239,68,68,0.08)"; }}
            onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.4)"; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
          >
            <SignOut size={15} />
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 relative overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={page}
            className="absolute inset-0 overflow-hidden"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {renderPage()}
          </motion.div>
        </AnimatePresence>

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
    </motion.div>
  );
}
