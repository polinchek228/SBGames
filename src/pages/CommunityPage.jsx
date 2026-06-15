import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  UsersThree, ChatCircle, X, UserCirclePlus,
  WifiHigh, WifiSlash, PaperPlaneTilt, Check, Checks,
  CaretLeft, Users, UserPlus, SignOut,
} from "@phosphor-icons/react";
import { Eye } from "lucide-react";
import { WS_URL, getToken, authFetch } from "../lib/api.js";
import { useNotifications } from "../components/NotificationSystem.jsx";

// Подсвечивает совпадение в строке
function highlight(text, query) {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <span style={{ color: "#60a5fa", fontWeight: 700 }}>{text.slice(idx, idx + query.length)}</span>
      {text.slice(idx + query.length)}
    </>
  );
}

const STATUS_DOT = {
  online:  "#4ade80",
  offline: "rgba(255,255,255,0.12)",
};

// ─── Shared WS hook (ФИКС БЕСКОНЕЧНОГО ПОДКЛЮЧЕНИЯ) ───────────────────────────
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
    let connectTimer;

    function open() {
      if (dead) return;
      
      const socket = new WebSocket(WS_URL);
      wsRef.current = socket;

      socket.onopen = () => {
        if (dead) {
          if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
            socket.close();
          }
          return;
        }
        setConnected(true);
        
        const u = userRef.current;
        const token = getToken();
        
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ 
            type: "auth", 
            userId: u.id, 
            username: u.username || u.telegram, 
            token: token 
          }));
        }
      };

      socket.onmessage = (e) => {
        try { 
          onRef.current?.(JSON.parse(e.data)); 
        } catch {}
      };

      socket.onclose = (event) => {
        setConnected(false);
        wsRef.current = null;
        
        if (!dead) {
          clearTimeout(timerRef.current);
          timerRef.current = setTimeout(open, 4000); 
        }
      };

      socket.onerror = () => {
        if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
          socket.close();
        }
      };
    }

    // Delay to avoid React StrictMode double-invocation closing the socket before it connects
    connectTimer = setTimeout(open, 100);

    return () => { 
      dead = true; 
      clearTimeout(connectTimer);
      clearTimeout(timerRef.current); 
      if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
        wsRef.current.close(); 
      }
      wsRef.current = null;
    };
  }, [user?.id]);

  const send = useCallback((data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    } else {
      console.warn("[WS] Cannot send data, socket not open:", data);
    }
  }, []);

  return { connected, send };
}


// ─── Main component ───────────────────────────────────────────────────────────
export default function CommunityPage({ onClose, user, onBadgeChange, onViewProfile }) {
  const [tab,         setTab]         = useState("friends");
  const [friends,     setFriends]     = useState([]);
  const [requests,    setRequests]    = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [onlineIds,   setOnlineIds]   = useState(new Set());
  const [addNick,     setAddNick]     = useState("");
  const [addStatus,   setAddStatus]   = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [searching,  setSearching]  = useState(false);
  const [chatWith,    setChatWith]    = useState(null);
  const [messages,    setMessages]    = useState([]);

  // Группы
  const [groups,         setGroups]         = useState([]);
  const [groupInvites,   setGroupInvites]   = useState([]);
  const [activeGroup,    setActiveGroup]    = useState(null);
  const [groupMessages,  setGroupMessages]  = useState([]);

  // Debounced поиск по всем зарегистрированным игрокам
  useEffect(() => {
    if (tab !== "add" || addNick.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const r = await authFetch(`/auth/search?q=${encodeURIComponent(addNick)}&limit=20`);
        const d = await r.json();
        setSearchResults(d.users || []);
      } catch { setSearchResults([]); }
      finally { setSearching(false); }
    }, 200);
    return () => clearTimeout(t);
  }, [addNick, tab]);

  const { push: pushNotif } = useNotifications() || {};

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
        pushNotif?.(`Заявка в друзья`, `${msg.request.fromUsername} хочет добавить вас`, "friend");
        break;
      case "friend_accepted":
        setFriends(prev => [...prev, { id: msg.byId, username: msg.byUsername }]);
        pushNotif?.("Заявка принята", `${msg.byUsername} теперь твой друг`, "friend");
        break;
      case "friend_request_sent":
        setAddStatus({ ok: true, msg: `Заявка отправлена → ${msg.toUsername}` });
        setAddNick("");
        pushNotif?.("Заявка отправлена", `Ждём ответа от ${msg.toUsername}`, "info");
        break;
      case "friend_error":
        setAddStatus({ ok: false, msg: msg.message });
        break;
      case "online_users":
        setOnlineUsers(msg.users || []);
        setOnlineIds(new Set((msg.users || []).map(u => u.id)));
        break;
      case "dm_message":
        if (chatWith && (msg.with === chatWith.id || msg.message.from === chatWith.id)) {
          setMessages(prev => [...prev, msg.message]);
        } else {
          pushNotif?.("Новое сообщение", `От @${msg.message.fromUsername || "игрока"}`, "dm");
        }
        break;
      case "profile_comment":
        pushNotif?.("Комментарий", `@${msg.comment.fromUsername} оставил комментарий`, "comment");
        break;
      case "market_sold":
        pushNotif?.("Предмет продан", `${msg.buyerName} купил твой лот за ${msg.price} SBT`, "market");
        break;
      case "group_message":
        if (activeGroup?.id === msg.groupId) {
          setGroupMessages(prev => [...prev, msg.message]);
        }
        break;
      case "group_update":
        setGroups(prev => prev.map(g => g.id === msg.group.id ? msg.group : g));
        if (activeGroup?.id === msg.group.id) setActiveGroup(msg.group);
        break;
      case "group_invite":
        setGroupInvites(prev => [...prev, msg.invite]);
        pushNotif?.("Приглашение в группу", `${msg.invite.fromUsername} зовёт в «${msg.invite.groupName}»`, "group");
        break;
      case "dm_history":
        setMessages(msg.messages || []);
        break;
    }
  }, [chatWith, onBadgeChange, pushNotif, activeGroup]);

  const { connected, send } = useCommunityWS(user, handleEvent);

  // Загрузить мои группы и приглашения при готовности WS
  useEffect(() => {
    if (!connected) return;
    (async () => {
      try {
        const r1 = await authFetch("/api/groups");
        const d1 = await r1.json();
        setGroups(d1.groups || []);
      } catch {}
      try {
        const r2 = await authFetch("/api/groups/invites");
        const d2 = await r2.json();
        setGroupInvites(d2.invites || []);
      } catch {}
    })();
  }, [connected]);

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
            <div className="flex items-center gap-1.5 mt-1">
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[8px] font-black tracking-wider transition-all duration-300 ${
                connected
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
              }`}>
                <motion.span
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  className={`w-1 h-1 rounded-full ${connected ? "bg-emerald-400" : "bg-amber-400"}`}
                  style={{
                    boxShadow: connected ? "0 0 6px #34d399" : "0 0 6px #fbbf24"
                  }}
                />
                {connected ? "СЕТЬ АКТИВНА" : "ПОДКЛЮЧЕНИЕ"}
              </span>
              {connected && (
                <span className="text-[8px] font-bold text-white/30 tracking-wider">
                  · {friends.length} ДРУЗЕЙ
                </span>
              )}
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
            { id: "groups",  label: "Группы",    icon: Users, badge: groupInvites.length },
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
                  <FriendRow key={f.id} f={f} online={onlineIds.has(f.id)} i={i} onChat={() => openChat(f)} onProfile={() => onViewProfile(f.id)} />
                ))}
              </>
            )}
          </motion.div>
        )}

        {/* ADD FRIEND с глобальным поиском по всем игрокам */}
        {tab === "add" && (
          <motion.div key="add" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex-1 px-3 py-3 flex flex-col gap-3"
          >
            <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.4)" }}>
              Введи ник — найдём среди всех зарегистрированных
            </p>

            {/* Input */}
            <div className="flex gap-2">
              <input
                value={addNick}
                onChange={e => { setAddNick(e.target.value); setAddStatus(null); }}
                onKeyDown={e => e.key === "Enter" && sendFriendRequest()}
                placeholder="Ник игрока..."
                className="flex-1 rounded-xl text-[12px] px-3 py-2 outline-none"
                style={{ background: "rgba(255,255,255,0.06)", color: "#fff", caretColor: "#60a5fa" }}
              />
              <motion.button onClick={sendFriendRequest}
                whileTap={{ scale: 0.9 }}
                className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors flex-shrink-0"
                style={{ background: "rgba(37,99,235,0.7)", color: "#fff" }}
              >
                <UserCirclePlus size={16} />
              </motion.button>
            </div>

            {addStatus && (
              <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                className="text-[11px] px-1"
                style={{ color: addStatus.ok ? "#4ade80" : "#f87171" }}
              >
                {addStatus.msg}
              </motion.p>
            )}

            {/* Результаты поиска */}
            {addNick.length >= 2 && (
              <div className="flex flex-col gap-1 mt-1">
                <span className="text-[9px] uppercase tracking-widest px-1 flex items-center gap-2"
                  style={{ color: "rgba(255,255,255,0.18)" }}>
                  {searching ? "Поиск..." :
                    searchResults.length === 0 ? "Не найдено" :
                    `Найдено · ${searchResults.length}`}
                  {searching && (
                    <div className="w-3 h-3 border border-white/20 border-t-white/60 rounded-full animate-spin" />
                  )}
                </span>

                <AnimatePresence>
                  {searchResults.map((u, i) => {
                    const isFriend   = friends.some(f => f.id === u.id);
                    const isMe       = u.id === user?.id;
                    const online     = onlineIds.has(u.id);
                    return (
                      <motion.div key={u.id}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="flex items-center gap-2.5 px-2 py-2 rounded-xl"
                        style={{ background: "rgba(255,255,255,0.03)" }}
                      >
                        <div className="relative flex-shrink-0">
                          <div className="w-7 h-7 rounded-xl flex items-center justify-center text-[10px] font-black"
                            style={{
                              background: u.role === "admin" ? "rgba(239,68,68,0.15)" : "rgba(37,99,235,0.15)",
                              color: u.role === "admin" ? "#fca5a5" : "#93c5fd",
                            }}
                          >
                            {u.username?.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-black"
                            style={{ background: online ? "#4ade80" : "rgba(255,255,255,0.15)" }}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-semibold truncate" style={{ color: "rgba(255,255,255,0.85)" }}>
                            {highlight(u.username, addNick)}
                            {u.role === "admin" && <span className="ml-1 text-[8px] text-red-400/60">ADMIN</span>}
                          </p>
                          <p className="text-[9px]" style={{ color: online ? "rgba(74,222,128,0.6)" : "rgba(255,255,255,0.2)" }}>
                            {isMe ? "это ты" : online ? "в сети" : isFriend ? "уже в друзьях" : "не в сети"}
                          </p>
                        </div>
                        {!isMe && !isFriend && (
                          <div className="flex gap-1 flex-shrink-0">
                            <motion.button
                              whileTap={{ scale: 0.9 }}
                              onClick={() => onViewProfile(u.id)}
                              className="w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-150"
                              style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}
                              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.12)"; e.currentTarget.style.color = "rgba(255,255,255,0.7)"; }}
                              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "rgba(255,255,255,0.4)"; }}
                            >
                              <Eye size={12} />
                            </motion.button>
                            <motion.button
                              whileTap={{ scale: 0.9 }}
                              onClick={() => {
                                setAddNick(u.username);
                                setTimeout(sendFriendRequest, 50);
                              }}
                              className="w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-150"
                              style={{ background: "rgba(37,99,235,0.2)", color: "#93c5fd" }}
                              onMouseEnter={e => e.currentTarget.style.background = "rgba(37,99,235,0.4)"}
                              onMouseLeave={e => e.currentTarget.style.background = "rgba(37,99,235,0.2)"}
                            >
                              <UserCirclePlus size={12} />
                            </motion.button>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}

            {/* Подсказка при пустом поле */}
            {addNick.length < 2 && (
              <div className="flex flex-col gap-1 mt-1">
                <p className="text-[9px] uppercase tracking-widest px-1"
                  style={{ color: "rgba(255,255,255,0.18)" }}>
                  Начни вводить ник (мин. 2 символа)
                </p>
              </div>
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
                    <button onClick={() => onViewProfile(req.fromId)}
                      className="w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-black flex-shrink-0 cursor-pointer"
                      style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.6)" }}
                    >
                      {req.fromUsername?.slice(0, 2).toUpperCase()}
                    </button>
                    <div className="flex-1 min-w-0">
                      <button onClick={() => onViewProfile(req.fromId)}
                        className="text-left"
                      >
                        <p className="text-[11px] font-semibold truncate text-white hover:text-blue-300 transition-colors">{req.fromUsername}</p>
                      </button>
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
            {/* DM Header with profile link */}
            <div className="flex items-center gap-2 px-3 py-2.5 flex-shrink-0"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
            >
              <button onClick={() => setChatWith(null)}
                className="w-6 h-6 rounded-lg flex items-center justify-center"
                style={{ color: "rgba(255,255,255,0.4)" }}
              >
                <CaretLeft size={14} weight="bold" />
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-bold text-white truncate">{chatWith.username}</p>
              </div>
              <button onClick={() => { onViewProfile(chatWith.id); setChatWith(null); }}
                className="w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-150"
                style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.35)" }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.12)"; e.currentTarget.style.color = "rgba(255,255,255,0.6)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "rgba(255,255,255,0.35)"; }}
              >
                <Eye size={13} />
              </button>
            </div>
            <DMChat
              chatWith={chatWith}
              messages={messages}
              userId={user?.id}
              onSend={sendDM}
            />
          </motion.div>
        )}

        {/* GROUPS LIST */}
        {tab === "groups" && !activeGroup && (
          <GroupsPanel
            user={user}
            groups={groups}
            groupInvites={groupInvites}
            onlineIds={onlineIds}
            onOpenGroup={async (g) => {
              setActiveGroup(g);
              try {
                const r = await authFetch(`/api/groups/${g.id}/messages`);
                const d = await r.json();
                setGroupMessages(d.messages || []);
              } catch {}
            }}
            onCreate={(g) => setGroups(prev => [g, ...prev])}
            onAcceptInvite={async (gid) => {
              try {
                const r = await authFetch(`/api/groups/${gid}/respond`, { method: "POST", body: JSON.stringify({ accept: true }) });
                const d = await r.json();
                setGroupInvites(prev => prev.filter(i => i.groupId !== gid));
                setGroups(prev => prev.find(x => x.id === gid) ? prev.map(x => x.id === gid ? d.group : x) : [d.group, ...prev]);
              } catch {}
            }}
            onDeclineInvite={async (gid) => {
              try {
                await authFetch(`/api/groups/${gid}/respond`, { method: "POST", body: JSON.stringify({ accept: false }) });
              } catch {}
              setGroupInvites(prev => prev.filter(i => i.groupId !== gid));
            }}
          />
        )}

        {/* GROUP CHAT */}
        {tab === "groups" && activeGroup && (
          <motion.div key={`grp-${activeGroup.id}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex-1 flex flex-col overflow-hidden">
            <GroupChat
              group={activeGroup}
              user={user}
              messages={groupMessages}
              send={send}
              onLeave={async () => {
                try { await authFetch(`/api/groups/${activeGroup.id}/leave`, { method: "POST" }); } catch {}
                setGroups(prev => prev.filter(x => x.id !== activeGroup.id));
                setActiveGroup(null);
                setGroupMessages([]);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Friend row ───────────────────────────────────────────────────────────────
function FriendRow({ f, online, i, onChat, onProfile }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: i * 0.03 }}
      className="flex items-center gap-2.5 px-2 py-2 rounded-xl transition-all duration-150"
      onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
    >
      <button onClick={onProfile} className="relative flex-shrink-0 cursor-pointer">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-black"
          style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.45)" }}
        >
          {f.username?.slice(0, 2).toUpperCase()}
        </div>
        <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-black"
          style={{ background: online ? STATUS_DOT.online : STATUS_DOT.offline }}
        />
      </button>
      <button onClick={onProfile} className="flex-1 min-w-0 text-left">
        <p className="text-[11px] font-semibold truncate" style={{ color: "rgba(255,255,255,0.82)" }}>{f.username}</p>
        <p className="text-[9px]" style={{ color: online ? "rgba(74,222,128,0.7)" : "rgba(255,255,255,0.2)" }}>
          {online ? "в сети" : "не в сети"}
        </p>
      </button>
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


// GroupsPanel
function GroupsPanel({ user, groups, groupInvites, onlineIds, onOpenGroup, onCreate, onAcceptInvite, onDeclineInvite }) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const create = async () => {
    if (busy || name.trim().length < 2) return;
    setBusy(true); setErr(null);
    try {
      const r = await authFetch("/api/groups", { method: "POST", body: JSON.stringify({ name: name.trim() }) });
      const d = await r.json();
      onCreate(d.group);
      setName(""); setCreating(false);
    } catch (e) { setErr("Ошибка создания"); }
    finally { setBusy(false); }
  };

  return (
    <div className="flex-1 overflow-y-auto px-2 pb-2">
      {groupInvites.length > 0 && (
        <div className="mb-3">
          <p className="text-[9px] uppercase tracking-widest px-2 py-2"
            style={{ color: "rgba(168,85,247,0.7)" }}>
            Приглашения ({groupInvites.length})
          </p>
          {groupInvites.map((inv, i) => (
            <div key={i} className="rounded-2xl p-3 mb-1.5"
              style={{ background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.2)" }}>
              <p className="text-[11px] text-white">
                <b>@{inv.fromUsername}</b> зовёт в <b>{'«'}{inv.groupName}{'»'}</b>
              </p>
              <div className="flex gap-1.5 mt-2">
                <button onClick={() => onAcceptInvite(inv.groupId)}
                  className="flex-1 py-1.5 rounded-lg text-[10px] font-bold text-white"
                  style={{ background: "rgba(168,85,247,0.5)" }}>Принять</button>
                <button onClick={() => onDeclineInvite(inv.groupId)}
                  className="flex-1 py-1.5 rounded-lg text-[10px] font-semibold"
                  style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)" }}>Отклонить</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!creating ? (
        <button onClick={() => setCreating(true)}
          className="w-full mb-3 py-2.5 rounded-2xl text-[12px] font-bold flex items-center justify-center gap-1.5 text-white"
          style={{ background: "linear-gradient(90deg, #6366f1, #a855f7)" }}>
          + Создать группу
        </button>
      ) : (
        <div className="mb-3 rounded-2xl p-3" style={{ background: "rgba(255,255,255,0.04)" }}>
          <input value={name} onChange={e => setName(e.target.value)} maxLength={40}
            placeholder="Название команды…"
            className="w-full rounded-xl px-3 py-2 text-[12px] outline-none"
            style={{ background: "rgba(255,255,255,0.05)", color: "#fff", border: "1px solid rgba(255,255,255,0.08)" }} />
          <div className="flex gap-1.5 mt-2">
            <button onClick={() => { setCreating(false); setName(""); setErr(null); }}
              className="flex-1 py-1.5 rounded-lg text-[10px] font-semibold"
              style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)" }}>Отмена</button>
            <button onClick={create} disabled={busy || name.trim().length < 2}
              className="flex-1 py-1.5 rounded-lg text-[10px] font-bold text-white disabled:opacity-40"
              style={{ background: "rgba(168,85,247,0.5)" }}>Создать</button>
          </div>
          {err && <p className="text-[10px] mt-1" style={{ color: "#fca5a5" }}>{err}</p>}
        </div>
      )}

      <p className="text-[9px] uppercase tracking-widest px-2 py-2"
        style={{ color: "rgba(255,255,255,0.18)" }}>
        Мои группы · {groups.length}
      </p>
      {groups.length === 0 ? (
        <p className="text-[11px] text-center py-8" style={{ color: "rgba(255,255,255,0.2)" }}>
          Создай свою первую команду — пригласи друзей.
        </p>
      ) : (
        groups.map(g => {
          const onlineCount = g.members.filter(m => onlineIds.has(m)).length;
          return (
            <button key={g.id} onClick={() => onOpenGroup(g)}
              className="w-full text-left rounded-2xl px-3 py-2.5 mb-1.5 transition-colors"
              style={{ background: "rgba(255,255,255,0.03)" }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.06)"}
              onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "linear-gradient(135deg, #6366f1, #a855f7)", color: "#fff", fontWeight: 700, fontSize: 13 }}>
                  {g.name.slice(0, 1).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-white truncate">{g.name}</p>
                  <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>
                    {g.members.length} участников · {onlineCount} в сети
                  </p>
                </div>
                {g.ownerId === user?.id && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded"
                    style={{ background: "rgba(251,191,36,0.15)", color: "rgba(251,191,36,0.9)" }}>OWNER</span>
                )}
              </div>
            </button>
          );
        })
      )}
    </div>
  );
}

// GroupChat
function GroupChat({ group, user, messages, send, onLeave }) {
  const [input, setInput] = useState("");
  const bottomRef = useRef(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  const submit = (e) => {
    e?.preventDefault();
    const t = input.trim();
    if (!t) return;
    send({ type: "group_send", groupId: group.id, text: t });
    setInput("");
  };
  return (
    <>
      <div className="flex items-center gap-2 px-4 py-3 flex-shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        <button onClick={onLeave} className="w-6 h-6 rounded-lg flex items-center justify-center"
          style={{ color: "rgba(255,255,255,0.4)" }}>
          <CaretLeft size={14} weight="bold" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-bold text-white truncate">{group.name}</p>
          <p className="text-[9px]" style={{ color: "rgba(255,255,255,0.3)" }}>
            {group.members.length} участников
          </p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-1.5">
        {messages.length === 0 ? (
          <p className="text-[11px] text-center py-8" style={{ color: "rgba(255,255,255,0.2)" }}>
            Начни общение с командой.
          </p>
        ) : (
          messages.map((m, i) => {
            const isMe = m.fromId === user?.id;
            return (
              <div key={m.id || i} className={"flex flex-col gap-0.5 max-w-[78%] " + (isMe ? "self-end items-end" : "self-start items-start")}>
                {!isMe && <span className="text-[9px] px-1" style={{ color: "rgba(255,255,255,0.22)" }}>@{m.fromUsername}</span>}
                <div className="px-3 py-1.5 rounded-2xl text-[12px] leading-relaxed"
                  style={isMe
                    ? { background: "rgba(168,85,247,0.4)", color: "#fff", borderBottomRightRadius: 4 }
                    : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.85)", borderBottomLeftRadius: 4 }
                  }>{m.text}</div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={submit}
        className="flex items-end gap-2 px-4 py-3 flex-shrink-0"
        style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
        <textarea value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(e); } }}
          placeholder="Сообщение команде…" rows={1}
          className="flex-1 rounded-2xl text-[12px] px-3 py-2 outline-none resize-none"
          style={{ background: "rgba(255,255,255,0.05)", color: "#fff", maxHeight: 80, caretColor: "#c4b5fd" }} />
        <button type="submit" disabled={!input.trim()}
          className="w-8 h-8 flex-shrink-0 rounded-xl flex items-center justify-center disabled:opacity-30"
          style={{ background: "rgba(168,85,247,0.5)", color: "#fff" }}>
          <PaperPlaneTilt size={12} weight="fill" />
        </button>
      </form>
    </>
  );
}
