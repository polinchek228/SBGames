import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UsersThree, ChatCircle, X, UserCirclePlus, Circle, WifiHigh, WifiSlash } from "@phosphor-icons/react";

import { WS_URL } from "../lib/api.js";

// Mock-друзья на случай если нет реальных онлайн
const MOCK = [
  { id: "m1", username: "Alex_Master",  status: "online",  server: "PIXELMON" },
  { id: "m2", username: "DragonSlayer", status: "away",    server: "STARWARS" },
  { id: "m3", username: "RedTrainer",   status: "offline", server: null },
  { id: "m4", username: "NightWalker",  status: "online",  server: "PIXELMON" },
  { id: "m5", username: "StarForge",    status: "online",  server: "STARWARS" },
];

const STATUS_STYLE = {
  online:  { dot: "#4ade80", label: "rgba(74,222,128,0.75)",  text: s => s },
  away:    { dot: "#facc15", label: "rgba(250,204,21,0.75)",  text: s => s },
  offline: { dot: "rgba(255,255,255,0.12)", label: "rgba(255,255,255,0.2)", text: () => "не в сети" },
};

function useWS(url, user) {
  const [connected, setConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const wsRef   = useRef(null);
  const timerRef = useRef(null);
  const userRef  = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);

  useEffect(() => {
    if (!user?.id) return;
    let dead = false;

    function open() {
      if (dead) return;
      const socket = new WebSocket(url);
      wsRef.current = socket;

      socket.onopen = () => {
        if (dead) { socket.close(); return; }
        setConnected(true);
        const u = userRef.current;
        socket.send(JSON.stringify({ type: "auth", userId: u.id, username: u.username || u.telegram }));
      };
      socket.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === "online_users") setOnlineUsers(msg.users || []);
        } catch {}
      };
      socket.onclose = () => {
        setConnected(false);
        if (!dead) timerRef.current = setTimeout(open, 4000);
      };
      socket.onerror = () => socket.close();
    }

    open();
    return () => {
      dead = true;
      clearTimeout(timerRef.current);
      wsRef.current?.close();
    };
  }, [url, user?.id]);

  return { connected, onlineUsers };
}

export default function CommunityPage({ onClose, user }) {
  const [tab, setTab] = useState("friends");
  const { connected, onlineUsers } = useWS(WS_URL, user);

  // Если нет реальных онлайн-юзеров — показываем mock, иначе реальных
  // Фильтруем себя из списка онлайн
  const realUsers = onlineUsers.filter(u => u.id !== user?.id);
  const friends = realUsers.length > 0
    ? realUsers.map(u => ({ id: `ws_${u.id}`, username: u.username, status: "online", server: u.server || null }))
    : MOCK;

  const onlineFriends  = friends.filter(f => f.status !== "offline");
  const offlineFriends = friends.filter(f => f.status === "offline");

  return (
    <div className="w-64 h-full flex flex-col" style={{ background: "#080808", borderLeft: "1px solid rgba(255,255,255,0.06)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 flex-shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
      >
        <div className="flex items-center gap-2.5">
          <UsersThree size={15} weight="fill" className="text-white/50" />
          <div>
            <p className="text-[12px] font-bold text-white">Сообщество</p>
            <div className="flex items-center gap-1 mt-0.5">
              {connected
                ? <WifiHigh size={9} className="text-green-400/60" />
                : <WifiSlash size={9} className="text-white/20" />
              }
              <p className="text-[9px] text-white/25">
                {connected ? `${onlineFriends.length} в сети` : "подключение..."}
              </p>
            </div>
          </div>
        </div>
        <button onClick={onClose}
          className="w-6 h-6 rounded-lg text-white/25 hover:text-white/70 flex items-center justify-center transition-colors"
          style={{ background: "rgba(255,255,255,0.04)" }}
        >
          <X size={11} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-3 py-2 flex-shrink-0">
        {[
          { id: "friends", label: "Друзья",  icon: UsersThree },
          { id: "chats",   label: "Чаты",    icon: ChatCircle },
        ].map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-semibold transition-all duration-150"
            style={tab === id
              ? { background: "rgba(255,255,255,0.08)", color: "#fff" }
              : { background: "transparent", color: "rgba(255,255,255,0.3)" }
            }
          >
            <Icon size={11} weight={tab === id ? "fill" : "regular"} />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        <AnimatePresence mode="wait">
          {tab === "friends" ? (
            <motion.div key="fr" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col"
            >
              {onlineFriends.length > 0 && (
                <>
                  <p className="text-[9px] uppercase tracking-widest px-2 py-2" style={{ color: "rgba(255,255,255,0.18)" }}>
                    В сети · {onlineFriends.length}
                  </p>
                  {onlineFriends.map((f, i) => <FriendRow key={f.id} f={f} i={i} />)}
                </>
              )}
              {offlineFriends.length > 0 && (
                <>
                  <p className="text-[9px] uppercase tracking-widest px-2 py-2 mt-1" style={{ color: "rgba(255,255,255,0.18)" }}>
                    Не в сети · {offlineFriends.length}
                  </p>
                  {offlineFriends.map((f, i) => <FriendRow key={f.id} f={f} i={i} />)}
                </>
              )}
            </motion.div>
          ) : (
            <motion.div key="ch" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center gap-3 py-14"
            >
              <ChatCircle size={28} style={{ color: "rgba(255,255,255,0.08)" }} />
              <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.18)" }}>Нет активных чатов</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Add friend */}
      <div className="px-3 pb-3 flex-shrink-0">
        <button className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-medium transition-all duration-150"
          style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.3)" }}
          onMouseEnter={e => { e.currentTarget.style.color = "rgba(255,255,255,0.6)"; }}
          onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.3)"; }}
        >
          <UserCirclePlus size={13} />
          Добавить друга
        </button>
      </div>
    </div>
  );
}

function FriendRow({ f, i }) {
  const st = STATUS_STYLE[f.status] || STATUS_STYLE.offline;
  return (
    <motion.div
      initial={{ opacity: 0, x: 6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: i * 0.03 }}
      className="flex items-center gap-2.5 px-2 py-2 rounded-xl cursor-pointer transition-all duration-150"
      onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-black"
          style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.45)" }}
        >
          {f.username.slice(0, 2).toUpperCase()}
        </div>
        <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-black"
          style={{ background: st.dot }}
        />
      </div>
      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold truncate" style={{ color: "rgba(255,255,255,0.8)" }}>
          {f.username}
        </p>
        <p className="text-[9px] font-medium uppercase tracking-wide truncate" style={{ color: st.label }}>
          {st.text(f.server)}
        </p>
      </div>
    </motion.div>
  );
}
