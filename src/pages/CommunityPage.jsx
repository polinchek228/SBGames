import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  UsersThree, ChatCircle, X, UserCirclePlus,
  WifiHigh, WifiSlash, PaperPlaneTilt, Check, Checks,
  CaretLeft,
} from "@phosphor-icons/react";
import { WS_URL, getToken } from "../lib/api.js";

const STATUS_DOT = {
  online:  "#4ade80",
  offline: "rgba(255,255,255,0.12)",
};

// ─── Shared WS hook ───────────────────────────────────────────────────────────
export function useCommunityWS(user, onEvent) {
  const wsRef    = useRef(null);
  const timerRef = useRef(null);
  const userRef  = useRef(user);
  const onRef    = useRef(onEvent);
  const [connected, setConnected] = useState(false);
  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => { onRef.current = onEvent; }, [onEvent]);

  useEffect(() => {
    if (!user?.id) return;
    let dead = false;

    function open() {
      if (dead) return;
      const socket = new WebSocket(WS_URL);
      wsRef.current = socket;
      socket.onopen = () => {
        if (dead) { socket.close(); return; }
        setConnected(true);
        const u = userRef.current;
        socket.send(JSON.stringify({ type: "auth", userId: u.id, username: u.username || u.telegram, token: getToken() }));
      };
      socket.onmessage = (e) => {
        try { onRef.current?.(JSON.parse(e.data)); } catch {}
      };
      socket.onclose = () => { setConnected(false); if (!dead) timerRef.current = setTimeout(open, 4000); };
      socket.onerror = () => socket.close();
    }
    open();
    return () => { dead = true; clearTimeout(timerRef.current); wsRef.current?.close(); };
  }, [user?.id]);

  const send = useCallback((data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify(data));
  }, []);

  return { connected, send };
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function CommunityPage({ onClose, user, onBadgeChange }) {
  const [tab,         setTab]         = useState("friends"); // friends | add | chats
  const [friends,     setFriends]     = useState([]);
  const [requests,    setRequests]    = useState([]);
  const [onlineIds,   setOnlineIds]   = useState(new Set());
  const [addNick,     setAddNick]     = useState("");
  const [addStatus,   setAddStatus]   = useState(null); // {ok, msg}
  const [chatWith,    setChatWith]    = useState(null); // friend object
  const [messages,    setMessages]    = useState([]);

  const handleEvent = useCallback((msg) => {
    switch (msg.type) {
      case "friends_list":
        setFriends(msg.friends || []);
        break;
      case "friend_requests":
        setRequests(msg.requests || []);
        onBadgeChange?.(msg.requests?.length || 0);
        break;
      case "friend_request_received":
        setRequests(prev => {
          const next = [...prev, msg.request];
          onBadgeChange?.(next.length);
          return next;
        });
        break;
      case "friend_accepted":
        setFriends(prev => [...prev, { id: msg.byId, username: msg.byUsername }]);
        break;
      case "friend_request_sent":
        setAddStatus({ ok: true, msg: `Заявка отправлена → ${msg.toUsername}` });
        setAddNick("");
        break;
      case "friend_error":
        setAddStatus({ ok: false, msg: msg.message });
        break;
      case "online_users":
        setOnlineIds(new Set((msg.users || []).map(u => u.id)));
        break;
      case "dm_message":
        if (chatWith && (msg.with === chatWith.id || msg.message.from === chatWith.id)) {
          setMessages(prev => [...prev, msg.message]);
        }
        break;
      case "dm_history":
        setMessages(msg.messages || []);
        break;
    }
  }, [chatWith, onBadgeChange]);

  const { connected, send } = useCommunityWS(user, handleEvent);

  const sendFriendRequest = () => {
    if (!addNick.trim()) return;
    setAddStatus(null);
    send({ type: "friend_request_send", toUsername: addNick.trim() });
  };

  const respondRequest = (fromId, accept) => {
    send({ type: "friend_request_respond", fromId, accept });
    setRequests(prev => {
      const next = prev.filter(r => r.fromId !== fromId);
      onBadgeChange?.(next.length);
      return next;
    });
    if (accept) {
      const req = requests.find(r => r.fromId === fromId);
      if (req) setFriends(prev => [...prev, { id: req.fromId, username: req.fromUsername }]);
    }
  };

  const openChat = (friend) => {
    setChatWith(friend);
    setMessages([]);
    setTab("chats");
    send({ type: "dm_history", withId: friend.id });
  };

  const sendDM = (text) => {
    if (!text.trim() || !chatWith) return;
    send({ type: "dm_send", toId: chatWith.id, text });
  };

  const totalBadge = requests.length;

  return (
    <div className="w-72 h-full flex flex-col"
      style={{ background: "#080808", borderLeft: "1px solid rgba(255,255,255,0.06)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 flex-shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
      >
        <div className="flex items-center gap-2.5">
          {tab === "chats" && chatWith ? (
            <button onClick={() => { setChatWith(null); setTab("friends"); }}
              className="w-6 h-6 flex items-center justify-center rounded-lg transition-colors"
              style={{ color: "rgba(255,255,255,0.4)" }}
            >
              <CaretLeft size={14} weight="bold" />
            </button>
          ) : (
            <UsersThree size={15} weight="fill" style={{ color: "rgba(255,255,255,0.5)" }} />
          )}
          <div>
            <p className="text-[12px] font-bold text-white">
              {tab === "chats" && chatWith ? chatWith.username : "Сообщество"}
            </p>
            <div className="flex items-center gap-1 mt-0.5">
              {connected
                ? <WifiHigh size={9} style={{ color: "rgba(74,222,128,0.6)" }} />
                : <WifiSlash size={9} style={{ color: "rgba(255,255,255,0.2)" }} />
              }
              <p className="text-[9px]" style={{ color: "rgba(255,255,255,0.25)" }}>
                {connected ? `${friends.length} друзей` : "подключение..."}
              </p>
            </div>
          </div>
        </div>
        <button onClick={onClose}
          className="w-6 h-6 rounded-lg flex items-center justify-center transition-colors"
          style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.3)" }}
        >
          <X size={11} />
        </button>
      </div>

      {/* Tabs (hidden in DM view) */}
      {!(tab === "chats" && chatWith) && (
        <div className="flex gap-1 px-3 py-2 flex-shrink-0">
          {[
            { id: "friends", label: "Друзья",   icon: UsersThree, badge: 0 },
            { id: "add",     label: "Добавить",  icon: UserCirclePlus, badge: 0 },
            { id: "chats",   label: "Запросы",   icon: ChatCircle, badge: totalBadge },
          ].map(({ id, label, icon: Icon, badge }) => (
            <button key={id} onClick={() => { setTab(id); if (id !== "chats") setChatWith(null); }}
              className="flex-1 relative flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-semibold transition-all duration-150"
              style={tab === id
                ? { background: "rgba(255,255,255,0.08)", color: "#fff" }
                : { color: "rgba(255,255,255,0.28)" }
              }
            >
              <Icon size={11} weight={tab === id ? "fill" : "regular"} />
              {label}
              {badge > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-blue-600 text-[9px] font-black text-white flex items-center justify-center">
                  {badge}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <AnimatePresence mode="wait">
        {/* FRIENDS */}
        {tab === "friends" && (
          <motion.div key="fr" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex-1 overflow-y-auto px-2 pb-2"
          >
            {friends.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <UsersThree size={28} style={{ color: "rgba(255,255,255,0.07)" }} />
                <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.2)" }}>Нет друзей</p>
                <button onClick={() => setTab("add")}
                  className="text-[10px] text-blue-400/60 hover:text-blue-400 transition-colors mt-1"
                >
                  Добавить друга →
                </button>
              </div>
            ) : (
              <>
                <p className="text-[9px] uppercase tracking-widest px-2 py-2"
                  style={{ color: "rgba(255,255,255,0.18)" }}
                >
                  Друзья · {friends.length}
                </p>
                {friends.map((f, i) => (
                  <FriendRow key={f.id} f={f} online={onlineIds.has(f.id)} i={i} onChat={() => openChat(f)} />
                ))}
              </>
            )}
          </motion.div>
        )}

        {/* ADD FRIEND */}
        {tab === "add" && (
          <motion.div key="add" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex-1 px-3 py-3 flex flex-col gap-3"
          >
            <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.4)" }}>
              Введи ник — пользователь получит уведомление в лаунчере
            </p>
            <div className="flex gap-2">
              <input
                value={addNick}
                onChange={e => { setAddNick(e.target.value); setAddStatus(null); }}
                onKeyDown={e => e.key === "Enter" && sendFriendRequest()}
                placeholder="Ник игрока..."
                className="flex-1 rounded-xl text-[12px] px-3 py-2 outline-none"
                style={{ background: "rgba(255,255,255,0.06)", color: "#fff", caretColor: "#fff" }}
              />
              <button onClick={sendFriendRequest}
                className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors flex-shrink-0"
                style={{ background: "#2563EB", color: "#fff" }}
              >
                <UserCirclePlus size={16} />
              </button>
            </div>
            {addStatus && (
              <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                className="text-[11px] px-2"
                style={{ color: addStatus.ok ? "#4ade80" : "#f87171" }}
              >
                {addStatus.msg}
              </motion.p>
            )}
          </motion.div>
        )}

        {/* REQUESTS / DM */}
        {tab === "chats" && !chatWith && (
          <motion.div key="req" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex-1 overflow-y-auto px-2 pb-2 flex flex-col"
          >
            {requests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <ChatCircle size={28} style={{ color: "rgba(255,255,255,0.07)" }} />
                <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.2)" }}>Нет входящих заявок</p>
              </div>
            ) : (
              <>
                <p className="text-[9px] uppercase tracking-widest px-2 py-2"
                  style={{ color: "rgba(255,255,255,0.18)" }}
                >
                  Входящие заявки · {requests.length}
                </p>
                {requests.map(req => (
                  <div key={req.fromId}
                    className="flex items-center gap-2.5 px-2 py-2.5 rounded-xl"
                    style={{ background: "rgba(255,255,255,0.03)" }}
                  >
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-black flex-shrink-0"
                      style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.6)" }}
                    >
                      {req.fromUsername?.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-semibold truncate text-white">{req.fromUsername}</p>
                      <p className="text-[9px]" style={{ color: "rgba(255,255,255,0.25)" }}>Хочет добавить вас</p>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => respondRequest(req.fromId, true)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                        style={{ background: "rgba(34,197,94,0.2)", color: "#4ade80" }}
                      >
                        <Check size={13} weight="bold" />
                      </button>
                      <button onClick={() => respondRequest(req.fromId, false)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                        style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.35)" }}
                      >
                        <X size={11} />
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </motion.div>
        )}

        {/* DM CHAT */}
        {tab === "chats" && chatWith && (
          <motion.div key={`dm-${chatWith.id}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex-1 flex flex-col overflow-hidden"
          >
            <DMChat
              messages={messages}
              userId={user?.id}
              onSend={sendDM}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Friend row ───────────────────────────────────────────────────────────────
function FriendRow({ f, online, i, onChat }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: i * 0.03 }}
      className="flex items-center gap-2.5 px-2 py-2 rounded-xl transition-all duration-150"
      onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
    >
      <div className="relative flex-shrink-0">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-black"
          style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.45)" }}
        >
          {f.username?.slice(0, 2).toUpperCase()}
        </div>
        <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-black"
          style={{ background: online ? STATUS_DOT.online : STATUS_DOT.offline }}
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold truncate" style={{ color: "rgba(255,255,255,0.82)" }}>{f.username}</p>
        <p className="text-[9px]" style={{ color: online ? "rgba(74,222,128,0.7)" : "rgba(255,255,255,0.2)" }}>
          {online ? "в сети" : "не в сети"}
        </p>
      </div>
      <button onClick={onChat}
        className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors flex-shrink-0"
        style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.35)" }}
        onMouseEnter={e => { e.currentTarget.style.background = "rgba(37,99,235,0.2)"; e.currentTarget.style.color = "#93c5fd"; }}
        onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "rgba(255,255,255,0.35)"; }}
      >
        <ChatCircle size={13} />
      </button>
    </motion.div>
  );
}

// ─── DM Chat ──────────────────────────────────────────────────────────────────
function DMChat({ messages, userId, onSend }) {
  const [input, setInput] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const handleSend = (e) => {
    e?.preventDefault();
    if (!input.trim()) return;
    onSend(input.trim());
    setInput("");
  };

  return (
    <>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2 min-h-0">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center flex-1 gap-2">
            <ChatCircle size={24} style={{ color: "rgba(255,255,255,0.07)" }} />
            <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.2)" }}>Начни переписку</p>
          </div>
        )}
        {messages.map(msg => {
          const isMe = msg.from === userId;
          return (
            <div key={msg.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
              <div className="px-3 py-2 rounded-2xl text-[12px] leading-relaxed max-w-[85%]"
                style={isMe
                  ? { background: "#2563EB", color: "#fff", borderBottomRightRadius: 4 }
                  : { background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.85)", borderBottomLeftRadius: 4 }
                }
              >
                {msg.text}
              </div>
              <div className="flex items-center gap-1 px-1 mt-0.5">
                <span className="text-[9px]" style={{ color: "rgba(255,255,255,0.18)" }}>
                  {new Date(msg.time).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                </span>
                {isMe && <Checks size={10} style={{ color: "rgba(37,99,235,0.7)" }} />}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend}
        className="flex items-end gap-2 px-3 py-2.5 flex-shrink-0"
        style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
      >
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") handleSend(e); }}
          placeholder="Написать..."
          className="flex-1 rounded-xl text-[12px] px-3 py-2 outline-none"
          style={{ background: "rgba(255,255,255,0.06)", color: "#fff", caretColor: "#fff" }}
        />
        <button type="submit" disabled={!input.trim()}
          className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors disabled:opacity-30"
          style={{ background: "#2563EB", color: "#fff" }}
        >
          <PaperPlaneTilt size={14} weight="fill" />
        </button>
      </form>
    </>
  );
}
