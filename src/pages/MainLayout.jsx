import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LogOut } from "lucide-react";
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

      {/* ── Navbar ── */}
      <div className="flex items-center justify-between h-11 bg-black border-b border-white/[0.05] flex-shrink-0 px-3">
        <div className="flex items-center gap-0.5 flex-1">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
            const active = page === id;
            return (
              <button
                key={id}
                onClick={() => setPage(id)}
                className={`relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-medium tracking-wide transition-all duration-150 whitespace-nowrap ${
                  active ? "text-white bg-white/[0.07]" : "text-white/35 hover:text-white/65 hover:bg-white/[0.04]"
                }`}
              >
                <Icon size={13} weight={active ? "fill" : "regular"} />
                {label}
                {active && (
                  <motion.div
                    layoutId="nav-pill"
                    className="absolute bottom-0 left-2.5 right-2.5 h-[2px] bg-blue-500 rounded-full"
                    transition={{ type: "spring", stiffness: 400, damping: 35 }}
                  />
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1.5 pl-2">
          <div className="flex items-center gap-1.5 bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            <span className="text-[12px] font-bold text-white tabular-nums">{user.balance ?? 0}</span>
            <span className="text-[10px] text-white/25">СБТ</span>
          </div>
          <button
            onClick={() => setShowCommunity(v => !v)}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-150 ${
              showCommunity ? "bg-blue-600 text-white" : "text-white/35 hover:text-white/70 hover:bg-white/[0.06]"
            }`}
          >
            <UsersThree size={15} weight={showCommunity ? "fill" : "regular"} />
          </button>
          <button
            onClick={onLogout}
            className="w-8 h-8 rounded-lg text-white/35 hover:text-red-400 hover:bg-red-500/10 flex items-center justify-center transition-all duration-150"
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
              <CommunityPage onClose={() => setShowCommunity(false)} user={user} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
