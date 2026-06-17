import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  UsersThree, ChatCircle, X, UserCirclePlus,
  WifiHigh, WifiSlash, PaperPlaneTilt, Check, Checks,
  CaretLeft, Users, UserPlus, SignOut,
} from "@phosphor-icons/react";
import { Eye, Plus } from "lucide-react";
import { authFetch } from "../lib/api.js";
import { sendWS, onWSMessage, isWSConnected } from "../lib/ws.js";
import { useNotifications } from "../components/NotificationSystem.jsx";

function highlight(text, query) {
  if (!query || !text) return text;
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

const STATUS_DOT = { online: "#4ade80", offline: "rgba(255,255,255,0.12)" };

// ─── Main component ───────────────────────────────────────────────────────────
export default function CommunityPage({ user, onBadgeChange, onViewProfile, mini, suppressNotifications }) {
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
  const [lastMessages, setLastMessages] = useState({});
  const [unread,      setUnread]      = useState({});

  const [groups,         setGroups]         = useState([]);
  const [groupInvites,   setGroupInvites]   = useState([]);
  const [activeGroup,    setActiveGroup]    = useState(null);
  const [groupMessages,  setGroupMessages]  = useState([]);

  useEffect(() => {
    if (tab !== "add" || addNick.length < 2) { setSearchResults([]); return; }
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

  const { push: pushNotifRaw } = useNotifications() || {};
  const pushNotif = suppressNotifications ? null : pushNotifRaw;

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
          if (prev.some(r => r.fromId === msg.request.fromId)) return prev;
          const next = [...prev, msg.request];
          onBadgeChange?.(next.length);
          return next;
        });
        break;
      case "friend_accepted":
        setFriends(prev => prev.some(f => f.id === msg.byId) ? prev : [...prev, { id: msg.byId, username: msg.byUsername }]);
        break;
      case "friend_request_sent":
        setAddStatus({ ok: true, msg: `Заявка отправлена: ${msg.toUsername}` });
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
      case "dm_message": {
        if (!msg.message) break;
        const partnerId = msg.with || msg.message.from;
        if (chatWith && (msg.with === chatWith.id || msg.message.from === chatWith.id)) {
          setMessages(prev => [...prev, msg.message]);
        } else if (partnerId) {
          setUnread(prev => ({ ...prev, [partnerId]: (prev[partnerId] || 0) + 1 }));
          pushNotif?.("Новое сообщение", `От @${msg.message.fromUsername || "игрока"}`, "dm");
        }
        if (partnerId && msg.message) {
          setLastMessages(prev => ({ ...prev, [partnerId]: { text: msg.message.text, time: msg.message.time, from: msg.message.from } }));
        }
        break;
      }
      case "profile_comment":
        pushNotif?.("Комментарий", `@${msg.comment.fromUsername} оставил комментарий`, "comment");
        break;
      case "market_sold":
        pushNotif?.("Предмет продан", `${msg.buyerName} купил твой лот за ${msg.price} SBT`, "market");
        break;
      case "group_message":
        if (activeGroup?.id === msg.groupId) setGroupMessages(prev => [...prev, msg.message]);
        break;
      case "group_update":
        setGroups(prev => prev.map(g => g.id === msg.group.id ? msg.group : g));
        if (activeGroup?.id === msg.group.id) setActiveGroup(msg.group);
        break;
      case "group_invite":
        setGroupInvites(prev => [...prev, msg.invite]);
        pushNotif?.("Приглашение в группу", `${msg.invite.fromUsername} зовёт в "${msg.invite.groupName}"`, "group");
        break;
      case "group_kicked":
        setGroups(prev => prev.filter(g => g.id !== msg.groupId));
        if (activeGroup?.id === msg.groupId) { setActiveGroup(null); setGroupMessages([]); }
        pushNotif?.("Кик из группы", `Тебя исключили из "${msg.groupName}"`, "group");
        break;
      case "groups_list":
        setGroups(msg.groups || []);
        break;
      case "group_invites_list":
        setGroupInvites(msg.invites || []);
        break;
      case "dm_history":
        setMessages(msg.messages || []);
        break;
    }
  }, [chatWith, onBadgeChange, pushNotif, activeGroup]);

  // ─── Subscribe to shared WS messages ──────────────────────────────────
  const [connected, setConnected] = useState(isWSConnected());

  useEffect(() => {
    setConnected(isWSConnected());
    const unsub = onWSMessage((msg) => {
      if (msg.type === "_ws_status") { setConnected(msg.connected); return; }
      handleEvent(msg);
    });
    return unsub;
  }, [handleEvent]);

  useEffect(() => {
    if (!connected) return;
    sendWS({ type: "community_sync" });
    (async () => {
      try { const r = await authFetch("/api/groups"); const d = await r.json(); setGroups(d.groups || []); } catch {}
      try { const r = await authFetch("/api/groups/invites"); const d = await r.json(); setGroupInvites(d.invites || []); } catch {}
    })();
  }, [connected]);

  const sendFriendRequest = () => {
    if (!addNick.trim()) return;
    setAddStatus(null);
    sendWS({ type: "friend_request_send", toUsername: addNick.trim() });
  };

  const respondRequest = (fromId, accept) => {
    sendWS({ type: "friend_request_respond", fromId, accept });
    setRequests(prev => { const next = prev.filter(r => r.fromId !== fromId); onBadgeChange?.(next.length); return next; });
    if (accept) {
      const req = requests.find(r => r.fromId === fromId);
      if (req) setFriends(prev => [...prev, { id: req.fromId, username: req.fromUsername }]);
    }
  };

  const openChat = (friend) => {
    setChatWith(friend);
    setMessages([]);
    setTab("friends");
    setUnread(prev => { const n = { ...prev }; delete n[friend.id]; return n; });
    sendWS({ type: "dm_history", withId: friend.id });
  };

  const sendDM = (text) => {
    if (!text.trim() || !chatWith) return;
    sendWS({ type: "dm_send", toId: chatWith.id, text });
    setLastMessages(prev => ({ ...prev, [chatWith.id]: { text, time: Date.now(), from: user?.id } }));
  };

  const totalBadge = requests.length;

  // Build conversation list: friends sorted by online, then by last message time
  const conversations = friends
    .map(f => ({
      ...f,
      online: onlineIds.has(f.id),
      lastMsg: lastMessages[f.id] || null,
      unreadCount: unread[f.id] || 0,
    }))
    .sort((a, b) => {
      if (a.online !== b.online) return a.online ? -1 : 1;
      const ta = a.lastMsg?.time || 0;
      const tb = b.lastMsg?.time || 0;
      return tb - ta;
    });

  return (
    <div className={"h-full flex " + (mini ? "flex-col" : "w-full")} style={{ background: mini ? "rgba(8,8,10,0.97)" : "transparent" }}>

      {/* ─── Left sidebar (hidden in mini mode) ─── */}
      {!mini && (
      <div className="w-72 h-full flex flex-col flex-shrink-0"
        style={{ background: "rgba(8,8,10,0.92)", borderRight: "1px solid rgba(255,255,255,0.06)" }}>

        {/* Header */}
        <div className="flex items-center gap-3 px-5 pt-5 pb-4 flex-shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <UsersThree size={18} weight="fill" style={{ color: "rgba(255,255,255,0.65)" }} />
          <div>
            <p className="text-[13px] font-bold text-white">Сообщество</p>
            <div className="flex items-center gap-2 mt-1">
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-black tracking-wider transition-all duration-300 ${
                connected
                  ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/25"
                  : "bg-amber-500/15 text-amber-300 border border-amber-500/25"
              }`}>
                <motion.span
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-emerald-400" : "bg-amber-400"}`}
                  style={{ boxShadow: connected ? "0 0 6px #34d399" : "0 0 6px #fbbf24" }}
                />
                {connected ? "ОНЛАЙН" : "ПОДКЛЮЧЕНИЕ"}
              </span>
              {connected && (
                <span className="text-[9px] font-bold text-white/50 tracking-wider">
                  &middot; {friends.length} друзей
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        {!(tab === "friends" && chatWith) && (
          <div className="flex flex-col gap-1 px-3 py-3 flex-shrink-0">
            {[
              { id: "friends",   label: "Друзья",     icon: UsersThree, badge: 0 },
              { id: "add",       label: "Добавить",   icon: UserCirclePlus, badge: 0 },
              { id: "requests",  label: "Заявки",     icon: ChatCircle, badge: totalBadge },
              { id: "groups",    label: "Группы",      icon: Users, badge: groupInvites.length },
            ].map(({ id, label, icon: Icon, badge }) => (
              <button key={id} onClick={() => { setTab(id); if (id === "friends") setChatWith(null); if (id === "groups") sendWS({ type: "community_sync" }); }}
                className="relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[12px] font-semibold transition-all duration-150"
                style={tab === id
                  ? { background: "rgba(255,255,255,0.08)", color: "#fff" }
                  : { color: "rgba(255,255,255,0.6)" }
                }
              >
                <Icon size={15} weight={tab === id ? "fill" : "regular"} />
                {label}
                {badge > 0 && (
                  <span className="ml-auto min-w-[20px] h-5 px-1.5 rounded-full bg-blue-600 text-[10px] font-black text-white flex items-center justify-center">
                    {badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* When in DM, show back + chat header in sidebar */}
        {tab === "friends" && chatWith && (
          <div className="px-3 py-3 flex-shrink-0">
            <button onClick={() => { setChatWith(null); }}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-semibold transition-all"
              style={{ color: "rgba(255,255,255,0.6)" }}
            >
              <CaretLeft size={16} weight="bold" />
              Назад к друзьям
            </button>
            <div className="flex items-center gap-3 px-3 pt-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-[13px] font-black"
                  style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.5)" }}>
                  {chatWith.username?.slice(0, 2).toUpperCase()}
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-black"
                  style={{ background: onlineIds.has(chatWith.id) ? "#4ade80" : STATUS_DOT.offline }} />
              </div>
              <div>
                <p className="text-[13px] font-bold text-white">{chatWith.username}</p>
                <p className="text-[10px]" style={{ color: onlineIds.has(chatWith.id) ? "rgba(74,222,128,0.7)" : "rgba(255,255,255,0.4)" }}>
                  {onlineIds.has(chatWith.id) ? "в сети" : "не в сети"}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Friend request badge at bottom */}
        {requests.length > 0 && !(tab === "requests") && (
          <div className="mt-auto px-3 pb-3 flex-shrink-0">
            <div className="rounded-xl p-3 flex items-center gap-2.5"
              style={{ background: "rgba(37,99,235,0.1)", border: "1px solid rgba(37,99,235,0.15)" }}
              onClick={() => setTab("requests")}
            >
              <ChatCircle size={16} weight="fill" style={{ color: "#60a5fa" }} />
              <span className="text-[11px] font-semibold" style={{ color: "#93c5fd" }}>
                {requests.length} {requests.length === 1 ? "заявка" : "заявок"}
              </span>
            </div>
          </div>
        )}
      </div>
      )}

      {/* ─── Right content area ─── */}
      <div className="flex-1 min-w-0 h-full flex flex-col overflow-hidden"
        style={{ background: "rgba(8,8,10,0.82)" }}>

        {/* Mini-mode horizontal tabs (when sidebar hidden) */}
        {mini && !(tab === "friends" && chatWith) && (
          <div className="flex gap-1 px-2 py-2 flex-shrink-0"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            {[
              { id: "friends",   label: "Друзья",     icon: UsersThree, badge: 0 },
              { id: "add",       label: "Добавить",   icon: UserCirclePlus, badge: 0 },
              { id: "requests",  label: "Заявки",     icon: ChatCircle, badge: totalBadge },
              { id: "groups",    label: "Группы",      icon: Users, badge: groupInvites.length },
            ].map(({ id, label, icon: Icon, badge }) => (
              <button key={id} onClick={() => { setTab(id); if (id === "friends") setChatWith(null); if (id === "groups") sendWS({ type: "community_sync" }); }}
                className="relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
                style={tab === id
                  ? { background: "rgba(255,255,255,0.08)", color: "#fff" }
                  : { color: "rgba(255,255,255,0.5)" }
                }>
                <Icon size={12} weight={tab === id ? "fill" : "regular"} />
                {label}
                {badge > 0 && (
                  <span className="ml-0.5 min-w-[16px] h-4 px-1 rounded-full bg-blue-600 text-[9px] font-black text-white flex items-center justify-center">
                    {badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        <AnimatePresence mode="wait">

          {/* ═══ FRIENDS (with chat) ═══ */}
          {tab === "friends" && !chatWith && (
            <motion.div key="fr" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex-1 overflow-y-auto px-3 pb-3 flex flex-col">
              {friends.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <UsersThree size={32} style={{ color: "rgba(255,255,255,0.07)" }} />
                  <p className="text-[12px]" style={{ color: "rgba(255,255,255,0.35)" }}>Нет друзей</p>
                  <button onClick={() => setTab("add")}
                    className="text-[11px] text-blue-400/60 hover:text-blue-400 transition-colors mt-1">
                    Добавить друга &rarr;
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-[10px] uppercase tracking-widest px-2 py-3"
                    style={{ color: "rgba(255,255,255,0.35)" }}>
                    Друзья &middot; {friends.length}
                  </p>
                  {conversations.map((f, i) => (
                    <ConversationRow key={f.id} f={f} i={i} myId={user?.id}
                      onOpen={() => openChat(f)} onProfile={() => onViewProfile(f.id)} />
                  ))}
                </>
              )}
            </motion.div>
          )}

          {/* ═══ DM CHAT ═══ */}
          {tab === "friends" && chatWith && (
            <motion.div key={`dm-${chatWith.id}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex-1 flex flex-col overflow-hidden">
              {/* Compact header in mini mode */}
              {mini && (
                <div className="flex items-center gap-2.5 px-3 py-2.5 flex-shrink-0"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <button onClick={() => setChatWith(null)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ color: "rgba(255,255,255,0.4)" }}>
                    <CaretLeft size={14} weight="bold" />
                  </button>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                    style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.5)" }}>
                    {chatWith.username?.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-white truncate">{chatWith.username}</p>
                    <p className="text-[10px]" style={{ color: onlineIds.has(chatWith.id) ? "rgba(74,222,128,0.7)" : "rgba(255,255,255,0.35)" }}>
                      {onlineIds.has(chatWith.id) ? "в сети" : "не в сети"}
                    </p>
                  </div>
                </div>
              )}
              <DMChat
                chatWith={chatWith}
                messages={messages}
                userId={user?.id}
                onSend={sendDM}
                onBack={() => setChatWith(null)}
                onViewProfile={() => { onViewProfile(chatWith.id); setChatWith(null); }}
                online={onlineIds.has(chatWith.id)}
              />
            </motion.div>
          )}

          {/* ═══ ADD FRIEND ═══ */}
          {tab === "add" && (
            <motion.div key="add" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex-1 px-4 py-4 flex flex-col gap-4">
              <p className="text-[12px]" style={{ color: "rgba(255,255,255,0.55)" }}>
                Введи ник &mdash; найдём среди всех зарегистрированных
              </p>
              <div className="flex gap-2.5">
                <input
                  value={addNick}
                  onChange={e => { setAddNick(e.target.value); setAddStatus(null); }}
                  onKeyDown={e => e.key === "Enter" && sendFriendRequest()}
                  placeholder="Ник игрока..."
                  className="flex-1 rounded-xl text-[13px] px-4 py-3 outline-none"
                  style={{ background: "rgba(255,255,255,0.06)", color: "#fff", caretColor: "#60a5fa" }}
                />
                <motion.button onClick={sendFriendRequest}
                  whileTap={{ scale: 0.9 }}
                  className="w-11 h-11 rounded-xl flex items-center justify-center transition-colors flex-shrink-0"
                  style={{ background: "rgba(37,99,235,0.7)", color: "#fff" }}>
                  <UserCirclePlus size={18} />
                </motion.button>
              </div>
              {addStatus && (
                <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                  className="text-[12px] px-1"
                  style={{ color: addStatus.ok ? "#4ade80" : "#f87171" }}>
                  {addStatus.msg}
                </motion.p>
              )}
              {addNick.length >= 2 && (
                <div className="flex flex-col gap-1 mt-1">
                  <span className="text-[10px] uppercase tracking-widest px-1 flex items-center gap-2"
                    style={{ color: "rgba(255,255,255,0.35)" }}>
                    {searching ? "Поиск..." : searchResults.length === 0 ? "Не найдено" : `Найдено: ${searchResults.length}`}
                    {searching && <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />}
                  </span>
                  <AnimatePresence>
                    {searchResults.map((u, i) => {
                      const isFriend = friends.some(f => f.id === u.id);
                      const isMe = u.id === user?.id;
                      const online = onlineIds.has(u.id) || u.online;
                      return (
                        <motion.div key={u.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.03 }}
                          className="flex items-center gap-3 px-3 py-3 rounded-xl"
                          style={{ background: "rgba(255,255,255,0.03)" }}>
                          <div className="relative flex-shrink-0">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-[11px] font-black"
                              style={{
                                background: u.role === "admin" ? "rgba(239,68,68,0.15)" : "rgba(37,99,235,0.15)",
                                color: u.role === "admin" ? "#fca5a5" : "#93c5fd",
                              }}>
                              {u.username?.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-black"
                              style={{ background: online ? "#4ade80" : "rgba(255,255,255,0.15)" }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-semibold truncate" style={{ color: "rgba(255,255,255,0.85)" }}>
                              {highlight(u.username, addNick)}
                              {u.role === "admin" && <span className="ml-1 text-[9px] text-red-400/60">ADMIN</span>}
                            </p>
                            <p className="text-[10px]" style={{ color: online ? "rgba(74,222,128,0.7)" : "rgba(255,255,255,0.4)" }}>
                              {isMe ? "это ты" : online ? "в сети" : isFriend ? "уже в друзьях" : "не в сети"}
                            </p>
                          </div>
                          {!isMe && !isFriend && (
                            <div className="flex gap-1.5 flex-shrink-0">
                              <motion.button whileTap={{ scale: 0.9 }}
                                onClick={() => onViewProfile(u.id)}
                                className="w-9 h-9 rounded-xl flex items-center justify-center transition-all"
                                style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}
                                onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.12)"; e.currentTarget.style.color = "rgba(255,255,255,0.7)"; }}
                                onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "rgba(255,255,255,0.4)"; }}>
                                <Eye size={14} />
                              </motion.button>
                              <motion.button whileTap={{ scale: 0.9 }}
                                onClick={() => { setAddNick(u.username); setTimeout(sendFriendRequest, 50); }}
                                className="w-9 h-9 rounded-xl flex items-center justify-center transition-all"
                                style={{ background: "rgba(37,99,235,0.2)", color: "#93c5fd" }}
                                onMouseEnter={e => e.currentTarget.style.background = "rgba(37,99,235,0.4)"}
                                onMouseLeave={e => e.currentTarget.style.background = "rgba(37,99,235,0.2)"}>
                                <UserCirclePlus size={14} />
                              </motion.button>
                            </div>
                          )}
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
              {addNick.length < 2 && (
                <p className="text-[10px] uppercase tracking-widest px-1"
                  style={{ color: "rgba(255,255,255,0.35)" }}>
                  Начни вводить ник (мин. 2 символа)
                </p>
              )}
            </motion.div>
          )}

          {/* ═══ REQUESTS ═══ */}
          {tab === "requests" && (
            <motion.div key="req" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex-1 overflow-y-auto px-3 pb-3">
              {requests.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <ChatCircle size={32} style={{ color: "rgba(255,255,255,0.07)" }} />
                  <p className="text-[12px]" style={{ color: "rgba(255,255,255,0.35)" }}>Нет входящих заявок</p>
                </div>
              ) : (
                <>
                  <p className="text-[10px] uppercase tracking-widest px-2 py-3"
                    style={{ color: "rgba(255,255,255,0.35)" }}>
                    Входящие заявки &middot; {requests.length}
                  </p>
                  {requests.map(req => (
                    <div key={req.fromId}
                      className="flex items-center gap-3 px-3 py-3 rounded-xl"
                      style={{ background: "rgba(255,255,255,0.03)" }}>
                      <button onClick={() => onViewProfile(req.fromId)} className="flex-shrink-0 cursor-pointer">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-[11px] font-black"
                          style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.6)" }}>
                          {req.fromUsername?.slice(0, 2).toUpperCase()}
                        </div>
                      </button>
                      <div className="flex-1 min-w-0">
                        <button onClick={() => onViewProfile(req.fromId)} className="text-left">
                          <p className="text-[12px] font-semibold truncate text-white hover:text-blue-300 transition-colors">{req.fromUsername}</p>
                        </button>
                        <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>Хочет добавить вас</p>
                      </div>
                      <div className="flex gap-1.5">
                        <button onClick={() => respondRequest(req.fromId, true)}
                          className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
                          style={{ background: "rgba(34,197,94,0.2)", color: "#4ade80" }}>
                          <Check size={15} weight="bold" />
                        </button>
                        <button onClick={() => respondRequest(req.fromId, false)}
                          className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
                          style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.35)" }}>
                          <X size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </motion.div>
          )}

          {/* ═══ GROUPS ═══ */}
          {tab === "groups" && !activeGroup && (
            <GroupsPanel
              user={user} groups={groups} groupInvites={groupInvites} onlineIds={onlineIds}
              onOpenGroup={async (g) => {
                setActiveGroup(g);
                try { const r = await authFetch(`/api/groups/${g.id}/messages`); const d = await r.json(); setGroupMessages(d.messages || []); } catch {}
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
                try { await authFetch(`/api/groups/${gid}/respond`, { method: "POST", body: JSON.stringify({ accept: false }) }); } catch {}
                setGroupInvites(prev => prev.filter(i => i.groupId !== gid));
              }}
            />
          )}

          {tab === "groups" && activeGroup && (
            <motion.div key={`grp-${activeGroup.id}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex-1 flex flex-col overflow-hidden">
              <GroupChat
                group={activeGroup} user={user} messages={groupMessages}
                onLeave={async () => {
                  try { await authFetch(`/api/groups/${activeGroup.id}/leave`, { method: "POST" }); } catch {}
                  setGroups(prev => prev.filter(x => x.id !== activeGroup.id));
                  setActiveGroup(null); setGroupMessages([]);
                }}
                onKick={async (userId) => {
                  sendWS({ type: "group_kick", groupId: activeGroup.id, userId });
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Conversation Row (Telegram-style) ─────────────────────────────────────
function ConversationRow({ f, i, myId, onOpen, onProfile }) {
  const lastText = f.lastMsg
    ? (f.lastMsg.from === myId ? "Ты: " : "") + f.lastMsg.text
    : null;
  const lastTime = f.lastMsg
    ? new Date(f.lastMsg.time).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <motion.div initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
      transition={{ delay: i * 0.03 }}>
      <button onClick={onOpen}
        className="w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all text-left"
        onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
        onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
        <div className="relative flex-shrink-0 cursor-pointer" onClick={(e) => { e.stopPropagation(); onProfile(); }}>
          <div className="w-11 h-11 rounded-xl flex items-center justify-center text-[13px] font-black"
            style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.5)" }}>
            {f.username?.slice(0, 2).toUpperCase()}
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-black"
            style={{ background: f.online ? "#4ade80" : STATUS_DOT.offline }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[13px] font-semibold truncate" style={{ color: "rgba(255,255,255,0.88)" }}>
              {f.username}
            </p>
            {lastTime && (
              <span className="text-[10px] flex-shrink-0" style={{ color: "rgba(255,255,255,0.35)" }}>
                {lastTime}
              </span>
            )}
          </div>
          <div className="flex items-center justify-between gap-2 mt-0.5">
            <p className="text-[11px] truncate" style={{ color: lastText ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.25)" }}>
              {lastText || (f.online ? "в сети" : "не в сети")}
            </p>
            {f.unreadCount > 0 && (
              <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-blue-600 text-[9px] font-black text-white flex items-center justify-center flex-shrink-0">
                {f.unreadCount}
              </span>
            )}
          </div>
        </div>
      </button>
    </motion.div>
  );
}

// ─── DM Chat (Telegram-style) ──────────────────────────────────────────────
function DMChat({ chatWith, messages, userId, onSend, onBack, onViewProfile, online }) {
  const [input, setInput] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const handleSend = (e) => {
    e?.preventDefault();
    if (!input.trim()) return;
    onSend(input.trim());
    setInput("");
  };

  // Group messages by date
  const groupedMessages = [];
  let lastDate = "";
  messages.forEach(msg => {
    const d = new Date(msg.time).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
    if (d !== lastDate) { groupedMessages.push({ type: "date", date: d }); lastDate = d; }
    groupedMessages.push({ type: "msg", msg });
  });

  return (
    <>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-2 min-h-0">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center flex-1 gap-3">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-[18px] font-black"
              style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.3)" }}>
              {chatWith.username?.slice(0, 2).toUpperCase()}
            </div>
            <p className="text-[13px] font-semibold" style={{ color: "rgba(255,255,255,0.5)" }}>{chatWith.username}</p>
            <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.3)" }}>Начни переписку</p>
          </div>
        )}
        {groupedMessages.map((item, i) => {
          if (item.type === "date") {
            return (
              <div key={`date-${i}`} className="flex justify-center py-2">
                <span className="text-[10px] px-3 py-1 rounded-full font-semibold"
                  style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}>
                  {item.date}
                </span>
              </div>
            );
          }
          const msg = item.msg;
          const isMe = msg.from === userId;
          return (
            <div key={msg.id || i} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
              <div className="px-4 py-2.5 rounded-2xl text-[13px] leading-relaxed max-w-[80%]"
                style={isMe
                  ? { background: "#2563EB", color: "#fff", borderBottomRightRadius: 4 }
                  : { background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.85)", borderBottomLeftRadius: 4 }
                }>
                {msg.text}
              </div>
              <div className="flex items-center gap-1 px-1 mt-0.5">
                <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>
                  {new Date(msg.time).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                </span>
                {isMe && <Checks size={12} style={{ color: "rgba(37,99,235,0.7)" }} />}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend}
        className="flex items-end gap-2.5 px-4 py-3 flex-shrink-0"
        style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") handleSend(e); }}
          placeholder="Написать сообщение..."
          className="flex-1 rounded-xl text-[13px] px-4 py-3 outline-none"
          style={{ background: "rgba(255,255,255,0.06)", color: "#fff", caretColor: "#fff" }}
        />
        <button type="submit" disabled={!input.trim()}
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors disabled:opacity-30"
          style={{ background: "#2563EB", color: "#fff" }}>
          <PaperPlaneTilt size={16} weight="fill" />
        </button>
      </form>
    </>
  );
}

// ─── GroupsPanel ─────────────────────────────────────────────────────────────
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
    <div className="flex-1 overflow-y-auto px-3 pb-3">
      {groupInvites.length > 0 && (
        <div className="mb-4">
          <p className="text-[10px] uppercase tracking-widest px-2 py-2"
            style={{ color: "rgba(168,85,247,0.7)" }}>
            Приглашения &middot; {groupInvites.length}
          </p>
          {groupInvites.map((inv, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-xl p-3.5 mb-2"
              style={{ background: "rgba(168,85,247,0.06)", border: "1px solid rgba(168,85,247,0.12)" }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "linear-gradient(135deg, #6366f1, #a855f7)", color: "#fff", fontWeight: 700, fontSize: 13 }}>
                  {inv.groupName?.slice(0, 1).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-white truncate">{inv.groupName}</p>
                  <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>от @{inv.fromUsername}</p>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={() => onAcceptInvite(inv.groupId)}
                  className="flex-1 py-2 rounded-xl text-[11px] font-bold text-white transition-all"
                  style={{ background: "rgba(168,85,247,0.45)" }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(168,85,247,0.65)"}
                  onMouseLeave={e => e.currentTarget.style.background = "rgba(168,85,247,0.45)"}>
                  Принять
                </button>
                <button onClick={() => onDeclineInvite(inv.groupId)}
                  className="flex-1 py-2 rounded-xl text-[11px] font-semibold transition-all"
                  style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.45)" }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.08)"}
                  onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.04)"}>
                  Отклонить
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {!creating ? (
        <button onClick={() => setCreating(true)}
          className="w-full mb-4 py-3 rounded-xl text-[12px] font-bold flex items-center justify-center gap-2 text-white transition-all"
          style={{ background: "rgba(99,102,241,0.15)", border: "1px dashed rgba(99,102,241,0.3)" }}
          onMouseEnter={e => e.currentTarget.style.background = "rgba(99,102,241,0.25)"}
          onMouseLeave={e => e.currentTarget.style.background = "rgba(99,102,241,0.15)"}>
          <Plus size={14} /> Создать группу
        </button>
      ) : (
        <div className="mb-4 rounded-xl p-4" style={{ background: "rgba(255,255,255,0.04)" }}>
          <input value={name} onChange={e => setName(e.target.value)} maxLength={40} autoFocus
            placeholder="Название команды..."
            onKeyDown={e => { if (e.key === "Enter") create(); if (e.key === "Escape") { setCreating(false); setName(""); } }}
            className="w-full rounded-xl px-4 py-3 text-[12px] outline-none"
            style={{ background: "rgba(255,255,255,0.05)", color: "#fff", border: "1px solid rgba(255,255,255,0.08)" }} />
          <div className="flex gap-2 mt-3">
            <button onClick={() => { setCreating(false); setName(""); setErr(null); }}
              className="flex-1 py-2 rounded-xl text-[11px] font-semibold"
              style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)" }}>Отмена</button>
            <button onClick={create} disabled={busy || name.trim().length < 2}
              className="flex-1 py-2 rounded-xl text-[11px] font-bold text-white disabled:opacity-40"
              style={{ background: "rgba(168,85,247,0.5)" }}>Создать</button>
          </div>
          {err && <p className="text-[11px] mt-2" style={{ color: "#fca5a5" }}>{err}</p>}
        </div>
      )}

      <p className="text-[10px] uppercase tracking-widest px-2 py-2"
        style={{ color: "rgba(255,255,255,0.35)" }}>
        Группы &middot; {groups.length}
      </p>
      {groups.length === 0 ? (
        <div className="flex flex-col items-center py-10 gap-3">
          <Users size={28} weight="thin" style={{ color: "rgba(255,255,255,0.15)" }} />
          <p className="text-[12px] text-center" style={{ color: "rgba(255,255,255,0.3)" }}>
            Нет групп. Создай или войди по приглашению.
          </p>
        </div>
      ) : (
        groups.map((g, idx) => {
          const onlineCount = g.members.filter(m => onlineIds.has(m)).length;
          const isOwner = g.ownerId === user?.id;
          return (
            <motion.div key={g.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.03 }} className="mb-2">
              <button onClick={() => onOpenGroup(g)}
                className="w-full text-left px-3 py-3 rounded-xl transition-all"
                onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: "linear-gradient(135deg, #6366f1, #a855f7)", color: "#fff", fontWeight: 700, fontSize: 15 }}>
                    {g.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] font-semibold text-white truncate">{g.name}</p>
                      {isOwner && (
                        <span className="text-[8px] px-1.5 py-0.5 rounded font-black tracking-wider"
                          style={{ background: "rgba(251,191,36,0.12)", color: "rgba(251,191,36,0.8)" }}>OWNER</span>
                      )}
                    </div>
                    <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.4)" }}>
                      {g.members.length} &middot; {onlineCount > 0 ? `${onlineCount} в сети` : "никого нет"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {g.members.slice(0, 3).map(m => (
                      <div key={m} className="w-6 h-6 rounded-lg flex items-center justify-center text-[8px] font-bold"
                        style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.3)" }}>
                        {(g.memberNames?.[m] || m).slice(0, 2).toUpperCase()}
                      </div>
                    ))}
                    {g.members.length > 3 && (
                      <span className="text-[9px]" style={{ color: "rgba(255,255,255,0.3)" }}>+{g.members.length - 3}</span>
                    )}
                  </div>
                </div>
              </button>
            </motion.div>
          );
        })
      )}
    </div>
  );
}

// ─── GroupChat ───────────────────────────────────────────────────────────────
function GroupChat({ group, user, messages, onLeave, onKick }) {
  const [input, setInput] = useState("");
  const [showMembers, setShowMembers] = useState(false);
  const [inviteNick, setInviteNick] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteMsg, setInviteMsg] = useState(null);
  const bottomRef = useRef(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  const isOwner = group.ownerId === user?.id;

  const submit = (e) => {
    e?.preventDefault();
    const t = input.trim();
    if (!t) return;
    sendWS({ type: "group_send", groupId: group.id, text: t });
    setInput("");
  };

  const invite = async () => {
    const nick = inviteNick.trim();
    if (!nick || inviteBusy) return;
    setInviteBusy(true); setInviteMsg(null);
    try {
      await authFetch(`/api/groups/${group.id}/invite`, { method: "POST", body: JSON.stringify({ username: nick }) });
      setInviteNick("");
      setInviteMsg({ ok: true, text: `Приглашение отправлено @${nick}` });
    } catch (e) { setInviteMsg({ ok: false, text: e.message?.replace(/^\d+:\s*/, "") || "Ошибка" }); }
    setInviteBusy(false);
  };

  return (
    <>
      <div className="flex items-center gap-3 px-5 py-3.5 flex-shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        <button onClick={onLeave} className="w-9 h-9 rounded-xl flex items-center justify-center transition-all"
          style={{ color: "rgba(255,255,255,0.4)" }}
          onMouseEnter={e => e.currentTarget.style.color = "rgba(255,255,255,0.7)"}
          onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.4)"}>
          <CaretLeft size={16} weight="bold" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold text-white truncate">{group.name}</p>
          <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>{group.members.length} участников</p>
        </div>
        <button onClick={() => setShowMembers(!showMembers)}
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-all"
          style={{ background: showMembers ? "rgba(255,255,255,0.1)" : "transparent", color: "rgba(255,255,255,0.5)" }}
          onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.08)"}
          onMouseLeave={e => e.currentTarget.style.background = showMembers ? "rgba(255,255,255,0.1)" : "transparent"}>
          <Users size={16} weight={showMembers ? "fill" : "regular"} />
        </button>
      </div>

      <AnimatePresence>
        {showMembers && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden flex-shrink-0"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
            <div className="px-5 py-3 max-h-56 overflow-y-auto">
              <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: "rgba(255,255,255,0.35)" }}>
                Участники &middot; {group.members.length}
              </p>
              {group.members.map(mid => {
                const memberName = group.memberNames?.[mid] || mid;
                return (
                <div key={mid} className="flex items-center gap-2.5 py-2">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[9px] font-bold"
                    style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}>
                    {memberName.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="text-[11px] flex-1" style={{ color: "rgba(255,255,255,0.65)" }}>
                    {mid === user?.id ? "Ты" : memberName}
                    {mid === group.ownerId && (
                      <span className="ml-1.5 text-[9px] px-1 py-0.5 rounded"
                        style={{ background: "rgba(251,191,36,0.12)", color: "rgba(251,191,36,0.8)" }}>OWNER</span>
                    )}
                  </span>
                  {isOwner && mid !== user?.id && (
                    <button onClick={() => onKick?.(mid)}
                      className="text-[10px] px-2.5 py-1 rounded-lg transition-all"
                      style={{ background: "rgba(239,68,68,0.1)", color: "rgba(239,68,68,0.6)" }}
                      onMouseEnter={e => e.currentTarget.style.background = "rgba(239,68,68,0.2)"}
                      onMouseLeave={e => e.currentTarget.style.background = "rgba(239,68,68,0.1)"}>
                      Кик
                    </button>
                  )}
                </div>
                );
              })}
              <div className="flex gap-2 mt-3 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                <input value={inviteNick} onChange={e => setInviteNick(e.target.value)}
                  placeholder="Ник игрока..." maxLength={16}
                  onKeyDown={e => { if (e.key === "Enter") invite(); }}
                  className="flex-1 rounded-lg px-3 py-2 text-[11px] outline-none"
                  style={{ background: "rgba(255,255,255,0.05)", color: "#fff" }} />
                <button onClick={invite} disabled={!inviteNick.trim() || inviteBusy}
                  className="px-3 py-2 rounded-lg text-[11px] font-bold text-white disabled:opacity-40"
                  style={{ background: "rgba(99,102,241,0.4)" }}>
                  <UserPlus size={13} />
                </button>
              </div>
              {inviteMsg && (
                <p className="text-[10px] mt-1" style={{ color: inviteMsg.ok ? "#4ade80" : "#fca5a5" }}>
                  {inviteMsg.text}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-2">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center py-14 gap-3">
            <ChatCircle size={28} weight="thin" style={{ color: "rgba(255,255,255,0.12)" }} />
            <p className="text-[12px] text-center" style={{ color: "rgba(255,255,255,0.3)" }}>Начни общение с командой.</p>
          </div>
        ) : (
          messages.map((m, i) => {
            const isMe = m.fromId === user?.id;
            return (
              <div key={m.id || i} className={"flex flex-col gap-0.5 max-w-[78%] " + (isMe ? "self-end items-end" : "self-start items-start")}>
                {!isMe && <span className="text-[10px] px-1" style={{ color: "rgba(255,255,255,0.35)" }}>@{m.fromUsername}</span>}
                <div className="px-4 py-2 rounded-2xl text-[13px] leading-relaxed"
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
        className="flex items-end gap-2.5 px-5 py-3 flex-shrink-0"
        style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
        <textarea value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(e); } }}
          placeholder="Сообщение команде..." rows={1}
          className="flex-1 rounded-xl text-[13px] px-4 py-3 outline-none resize-none"
          style={{ background: "rgba(255,255,255,0.05)", color: "#fff", maxHeight: 80, caretColor: "#c4b5fd" }} />
        <button type="submit" disabled={!input.trim()}
          className="w-10 h-10 flex-shrink-0 rounded-xl flex items-center justify-center disabled:opacity-30 transition-all"
          style={{ background: "rgba(168,85,247,0.5)", color: "#fff" }}>
          <PaperPlaneTilt size={14} weight="fill" />
        </button>
      </form>
    </>
  );
}
