import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  UsersThree, ChatCircle, X, UserCirclePlus,
  WifiHigh, WifiSlash, PaperPlaneTilt, Check, Checks,
  CaretLeft, Users, UserPlus, SignOut, Phone, PhoneSlash,
  Microphone, MicrophoneSlash, MonitorArrowUp, VideoCamera,
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
export default function CommunityPage({ user, onBadgeChange, onViewProfile, mini, suppressNotifications, pendingCall, onPendingCallConsumed }) {
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

  const [parties,       setParties]       = useState([]);    // all parties user is in
  const [partyInvites,  setPartyInvites]  = useState([]);

  // refs to avoid stale closures in handleEvent without re-subscribing WS
  const chatWithRef   = useRef(null);
  const activeGroupRef = useRef(null);
  useEffect(() => { chatWithRef.current   = chatWith;   }, [chatWith]);
  useEffect(() => { activeGroupRef.current = activeGroup; }, [activeGroup]);

  // ─── Call state ──────────────────────────────────────────────────────────────
  const [incomingCall,   setIncomingCall]   = useState(null); // { fromId, fromUsername, offer, callType }
  const [activeCall,     setActiveCall]     = useState(null); // { type:'dm'|'group', peerId, groupId, muted, sharing }
  const [groupVoiceIds,  setGroupVoiceIds]  = useState([]);   // participants in active group voice
  const pcRef        = useRef({});   // { [peerId]: RTCPeerConnection }
  const localStream  = useRef(null);
  const screenStream = useRef(null);

  // Поглощаем входящий звонок из MainLayout (когда сайдбар открывается по incoming_call)
  useEffect(() => {
    if (pendingCall) {
      setIncomingCall({ fromId: pendingCall.fromId, fromUsername: pendingCall.fromUsername, offer: pendingCall.offer, callType: pendingCall.callType });
      onPendingCallConsumed?.();
    }
  }, [pendingCall]);

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
        const cw = chatWithRef.current;
        if (cw && (msg.with === cw.id || msg.message.from === cw.id)) {
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
        if (activeGroupRef.current?.id === msg.groupId) setGroupMessages(prev => [...prev, msg.message]);
        break;
      case "group_update":
        setGroups(prev => prev.map(g => g.id === msg.group.id ? msg.group : g));
        if (activeGroupRef.current?.id === msg.group.id) setActiveGroup(msg.group);
        break;
      case "clan_levelup":
        pushNotif?.("Новый уровень клана", `Ваш клан достиг уровня ${msg.level}!`, "group");
        break;
      case "group_error":
        pushNotif?.("Ошибка клана", msg.text || "Не удалось отправить", "group");
        break;
      case "group_invite":
        setGroupInvites(prev => [...prev, msg.invite]);
        pushNotif?.("Приглашение в группу", `${msg.invite.fromUsername} зовёт в "${msg.invite.groupName}"`, "group");
        break;
      case "group_kicked":
        setGroups(prev => prev.filter(g => g.id !== msg.groupId));
        if (activeGroupRef.current?.id === msg.groupId) { setActiveGroup(null); setGroupMessages([]); }
        pushNotif?.("Кик из группы", `Тебя исключили из "${msg.groupName}"`, "group");
        break;
      case "groups_list":
        setGroups(msg.groups || []);
        break;
      case "group_invites_list":
        setGroupInvites(msg.invites || []);
        break;

      // ─── Parties ────────────────────────────────────────────────────────────
      case "parties_list":
        setParties(msg.parties || []);
        break;
      case "party_invite_received":
        setPartyInvites(prev => [...prev.filter(i => i.partyId !== msg.invite.partyId), msg.invite]);
        pushNotif?.("Приглашение в группу", `${msg.invite.fromUsername} зовёт в «${msg.invite.partyName || "группу"}»`, "group");
        break;
      case "party_invites_list":
        setPartyInvites(msg.invites || []);
        break;

      case "dm_history":
        setMessages(msg.messages || []);
        break;

      // ─── Call signaling ─────────────────────────────────────────────────��──
      case "incoming_call":
        setIncomingCall({ fromId: msg.fromId, fromUsername: msg.fromUsername, offer: msg.offer, callType: msg.callType });
        break;
      case "call_answered":
        (async () => {
          const pc = pcRef.current[msg.fromId];
          if (pc && msg.answer) await pc.setRemoteDescription(new RTCSessionDescription(msg.answer));
        })();
        break;
      case "call_ice_candidate":
        (async () => {
          const pc = pcRef.current[msg.fromId];
          if (pc && msg.candidate) await pc.addIceCandidate(new RTCIceCandidate(msg.candidate)).catch(() => {});
        })();
        break;
      case "call_rejected":
        teardownCall();
        break;
      case "call_ended":
        teardownCall();
        break;
      case "group_call_state":
        setGroupVoiceIds(msg.participants || []);
        break;
      case "group_call_offer":
        (async () => {
          const pc = createPeerConnection(msg.fromId, msg.groupId, false);
          await pc.setRemoteDescription(new RTCSessionDescription(msg.offer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          sendWS({ type: "group_call_answer", groupId: msg.groupId, toId: msg.fromId, answer });
        })();
        break;
      case "group_call_answer":
        (async () => {
          const pc = pcRef.current[msg.fromId];
          if (pc && msg.answer) await pc.setRemoteDescription(new RTCSessionDescription(msg.answer));
        })();
        break;
      case "group_call_ice_candidate":
        (async () => {
          const pc = pcRef.current[msg.fromId];
          if (pc && msg.candidate) await pc.addIceCandidate(new RTCIceCandidate(msg.candidate)).catch(() => {});
        })();
        break;
    }
  }, [onBadgeChange, pushNotif]);

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

  // ─── WebRTC helpers ──────────────────────────────────────────────────────────
  const STUN = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

  function createPeerConnection(peerId, groupId, isOffer) {
    const pc = new RTCPeerConnection(STUN);
    pcRef.current[peerId] = pc;

    if (localStream.current) {
      const tracks = localStream.current.getTracks();
      if (tracks.length > 0) {
        tracks.forEach(t => pc.addTrack(t, localStream.current));
      } else {
        // Нет аудио-треков (микро не найден) — создаём трансивер чтобы ontrack сработал
        pc.addTransceiver("audio", { direction: "sendrecv" });
      }
    } else {
      pc.addTransceiver("audio", { direction: "sendrecv" });
    }
    if (screenStream.current) screenStream.current.getTracks().forEach(t => pc.addTrack(t, screenStream.current));

    pc.onicecandidate = e => {
      if (!e.candidate) return;
      if (groupId) sendWS({ type: "group_call_ice", groupId, toId: peerId, candidate: e.candidate });
      else sendWS({ type: "call_ice", toId: peerId, candidate: e.candidate });
    };

    pc.ontrack = e => {
      // Создаём <audio> динамически, т.к. pcRef — ref и React не перерендеривает компонент
      let audio = document.getElementById(`audio-${peerId}`);
      if (!audio) {
        audio = document.createElement("audio");
        audio.id = `audio-${peerId}`;
        audio.autoplay = true;
        audio.playsInline = true;
        audio.style.display = "none";
        document.body.appendChild(audio);
      }
      if (e.streams[0]) { audio.srcObject = e.streams[0]; audio.play().catch(() => {}); }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "closed") {
        pc.close(); delete pcRef.current[peerId];
        // Если это был активный звонок — завершаем UI
        setActiveCall(prev => {
          if (prev && prev.peerId === peerId) {
            document.querySelectorAll(`audio[id^='audio-${peerId}']`).forEach(el => el.remove());
            return null;
          }
          return prev;
        });
      }
    };
    return pc;
  }

  function teardownCall() {
    Object.values(pcRef.current).forEach(pc => { try { pc.close(); } catch {} });
    pcRef.current = {};
    if (localStream.current) { localStream.current.getTracks().forEach(t => t.stop()); localStream.current = null; }
    if (screenStream.current) { screenStream.current.getTracks().forEach(t => t.stop()); screenStream.current = null; }
    // Удаляем динамически созданные audio-элементы
    document.querySelectorAll("audio[id^='audio-']").forEach(el => el.remove());
    setActiveCall(null);
    setIncomingCall(null);
    setGroupVoiceIds([]);
  }

  const startDMCall = async (peer) => {
    if (!isWSConnected()) {
      pushNotif?.("Ошибка", "Нет соединения с сервером. Попробуй позже.", "error");
      return;
    }
    try {
      // Пытаемся захватить микро. Если его нет — звонок всё равно стартует (только приём).
      try {
        localStream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        localStream.current = new MediaStream(); // пустой стрим — нет аудио, но WebRTC жив
      }
      const pc = createPeerConnection(peer.id, null, true);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      sendWS({ type: "call_offer", toId: peer.id, offer });
      setActiveCall({ type: "dm", peerId: peer.id, peerName: peer.username, muted: false, sharing: false });
    } catch (e) {
      console.error("startDMCall error:", e);
      pushNotif?.("Ошибка", "Не удалось начать звонок: " + (e.message || e), "error");
    }
  };

  const acceptDMCall = async () => {
    if (!incomingCall) return;
    try {
      try {
        localStream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        localStream.current = new MediaStream();
      }
      const pc = createPeerConnection(incomingCall.fromId, null, false);
      await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      sendWS({ type: "call_answer", toId: incomingCall.fromId, answer });
      setActiveCall({ type: "dm", peerId: incomingCall.fromId, peerName: incomingCall.fromUsername, muted: false, sharing: false });
      setIncomingCall(null);
    } catch (e) {
      console.error("acceptDMCall error:", e);
    }
  };

  const rejectCall = () => {
    if (incomingCall) sendWS({ type: "call_reject", toId: incomingCall.fromId });
    setIncomingCall(null);
  };

  const hangUp = () => {
    if (activeCall?.type === "dm") sendWS({ type: "call_end", toId: activeCall.peerId });
    if (activeCall?.type === "group") sendWS({ type: "group_call_leave", groupId: activeCall.groupId });
    teardownCall();
  };

  const joinGroupCall = async (groupId, existingParticipants = []) => {
    try {
      try {
        localStream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        localStream.current = new MediaStream();
      }
      sendWS({ type: "group_call_join", groupId });
      setActiveCall({ type: "group", groupId, muted: false, sharing: false });
      for (const peerId of existingParticipants) {
        if (peerId === user?.id) continue;
        const pc = createPeerConnection(peerId, groupId, true);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        sendWS({ type: "group_call_offer", groupId, toId: peerId, offer });
      }
    } catch (e) {
      console.error("joinGroupCall error:", e);
    }
  };

  const toggleMute = () => {
    if (!localStream.current) return;
    localStream.current.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
    setActiveCall(prev => prev ? { ...prev, muted: !prev.muted } : prev);
  };

  const startScreenShare = async () => {
    try {
      screenStream.current = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const videoTrack = screenStream.current.getVideoTracks()[0];
      for (const pc of Object.values(pcRef.current)) {
        const sender = pc.getSenders().find(s => s.track?.kind === "video");
        if (sender) sender.replaceTrack(videoTrack);
        else pc.addTrack(videoTrack, screenStream.current);
      }
      videoTrack.onended = stopScreenShare;
      setActiveCall(prev => prev ? { ...prev, sharing: true } : prev);
    } catch {}
  };

  const stopScreenShare = () => {
    if (screenStream.current) { screenStream.current.getTracks().forEach(t => t.stop()); screenStream.current = null; }
    setActiveCall(prev => prev ? { ...prev, sharing: false } : prev);
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

      {/* ─── Hidden audio elements for remote streams ─── */}
      {Object.keys(pcRef.current).map(peerId => (
        <audio key={peerId} id={`audio-${peerId}`} autoPlay playsInline style={{ display: "none" }} />
      ))}

      {/* ─── Incoming call modal ─── */}
      <AnimatePresence>
        {incomingCall && (
          <IncomingCallModal
            call={incomingCall}
            onAccept={acceptDMCall}
            onReject={rejectCall}
          />
        )}
      </AnimatePresence>

      {/* ─── Active call overlay ─── */}
      <AnimatePresence>
        {activeCall && (
          <CallOverlay
            call={activeCall}
            groupVoiceIds={groupVoiceIds}
            friends={friends}
            localStream={localStream}
            onMute={toggleMute}
            onShare={activeCall.sharing ? stopScreenShare : startScreenShare}
            onHangUp={hangUp}
          />
        )}
      </AnimatePresence>

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
          <div className="flex flex-col px-3 py-3 gap-1 flex-shrink-0">

            {/* Top row: Добавить + Заявки */}
            <div className="flex gap-1.5 mb-1">
              {[
                { id: "add",      label: "Добавить", icon: UserCirclePlus, badge: 0 },
                { id: "requests", label: "Заявки",   icon: ChatCircle,     badge: totalBadge },
              ].map(({ id, label, icon: Icon, badge }) => (
                <button key={id}
                  onClick={() => setTab(id)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-semibold transition-all duration-150 relative"
                  style={tab === id
                    ? { background: "rgba(255,255,255,0.10)", color: "#fff" }
                    : { background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.5)" }
                  }
                >
                  <Icon size={13} weight={tab === id ? "fill" : "regular"} />
                  {label}
                  {badge > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-blue-600 text-[9px] font-black text-white flex items-center justify-center">
                      {badge}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "4px 2px 6px" }} />

            {/* Main nav: Друзья / Кланы / Группы */}
            {[
              { id: "friends", label: "Друзья",  icon: UsersThree, badge: 0 },
              { id: "groups",  label: "Кланы",   icon: Users,      badge: groupInvites.length },
              { id: "parties", label: "Группы",  icon: UsersThree, badge: 0 },
            ].map(({ id, label, icon: Icon, badge }) => (
              <button key={id}
                onClick={() => { setTab(id); if (id === "friends") setChatWith(null); if (id === "groups") sendWS({ type: "community_sync" }); }}
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
            <div className="flex items-center justify-between gap-3 px-3 pt-3">
              <div className="flex items-center gap-3">
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
              {!activeCall && (
                <button onClick={() => startDMCall(chatWith)} aria-label="Позвонить"
                  className="w-9 h-9 rounded-xl flex items-center justify-center transition-all"
                  style={{ background: "rgba(37,99,235,0.15)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.2)" }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(37,99,235,0.3)"}
                  onMouseLeave={e => e.currentTarget.style.background = "rgba(37,99,235,0.15)"}>
                  <Phone size={14} weight="fill" />
                </button>
              )}
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
          <div className="flex flex-col gap-1 px-2 py-2 flex-shrink-0"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            {/* Top: Добавить + Заявки */}
            <div className="flex gap-1">
              {[
                { id: "add",      label: "Добавить", icon: UserCirclePlus, badge: 0 },
                { id: "requests", label: "Заявки",   icon: ChatCircle,     badge: totalBadge },
              ].map(({ id, label, icon: Icon, badge }) => (
                <button key={id} onClick={() => setTab(id)}
                  className="flex-1 relative flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-semibold transition-all"
                  style={tab === id
                    ? { background: "rgba(255,255,255,0.10)", color: "#fff" }
                    : { background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.5)" }
                  }>
                  <Icon size={11} weight={tab === id ? "fill" : "regular"} />
                  {label}
                  {badge > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[14px] h-3.5 px-0.5 rounded-full bg-blue-600 text-[8px] font-black text-white flex items-center justify-center">
                      {badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
            {/* Divider */}
            <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "2px 0" }} />
            {/* Bottom: Друзья + Кланы + Группы */}
            <div className="flex gap-1">
              {[
                { id: "friends", label: "Друзья",  icon: UsersThree, badge: 0 },
                { id: "groups",  label: "Кланы",   icon: Users,      badge: groupInvites.length },
                { id: "parties", label: "Группы",  icon: UsersThree, badge: 0 },
              ].map(({ id, label, icon: Icon, badge }) => (
                <button key={id} onClick={() => { setTab(id); if (id === "friends") setChatWith(null); if (id === "groups") sendWS({ type: "community_sync" }); }}
                  className="flex-1 relative flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-semibold transition-all"
                  style={tab === id
                    ? { background: "rgba(255,255,255,0.08)", color: "#fff" }
                    : { color: "rgba(255,255,255,0.5)" }
                  }>
                  <Icon size={11} weight={tab === id ? "fill" : "regular"} />
                  {label}
                  {badge > 0 && (
                    <span className="ml-0.5 min-w-[14px] h-3.5 px-0.5 rounded-full bg-blue-600 text-[8px] font-black text-white flex items-center justify-center">
                      {badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
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
                  aria-label="Добавить друга"
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
                groupVoiceIds={groupVoiceIds}
                activeCall={activeCall}
                onJoinCall={() => joinGroupCall(activeGroup.id, groupVoiceIds)}
                onHangCall={hangUp}
                onBack={() => { setActiveGroup(null); setGroupMessages([]); }}
                onLeave={async () => {
                  if (activeCall?.type === "group" && activeCall.groupId === activeGroup.id) hangUp();
                  try { await authFetch(`/api/groups/${activeGroup.id}/leave`, { method: "POST" }); } catch {}
                  setGroups(prev => prev.filter(x => x.id !== activeGroup.id));
                  setActiveGroup(null); setGroupMessages([]);
                }}
                onKick={async (userId) => {
                  sendWS({ type: "group_kick", groupId: activeGroup.id, userId });
                }}
                onSetRole={async (userId, role) => {
                  try {
                    const r = await authFetch(`/api/groups/${activeGroup.id}/role`, { method: "PUT", body: JSON.stringify({ userId, role }) });
                    const d = await r.json();
                    if (d.group) { setGroups(prev => prev.map(x => x.id === d.group.id ? d.group : x)); setActiveGroup(d.group); }
                  } catch {}
                }}
                onEditDescription={async (description) => {
                  try {
                    const r = await authFetch(`/api/groups/${activeGroup.id}/description`, { method: "PUT", body: JSON.stringify({ description }) });
                    const d = await r.json();
                    if (d.group) { setGroups(prev => prev.map(x => x.id === d.group.id ? d.group : x)); setActiveGroup(d.group); }
                  } catch {}
                }}
                onToggleClosed={async (closed) => {
                  try {
                    const r = await authFetch(`/api/groups/${activeGroup.id}/closed`, { method: "PUT", body: JSON.stringify({ closed }) });
                    const d = await r.json();
                    if (d.group) { setGroups(prev => prev.map(x => x.id === d.group.id ? d.group : x)); setActiveGroup(d.group); }
                  } catch {}
                }}
              />
            </motion.div>
          )}

          {/* ═══ PARTIES ═══ */}
          {tab === "parties" && (
            <PartiesPanel
              user={user} friends={friends} onlineIds={onlineIds}
              parties={parties} partyInvites={partyInvites}
              onCreate={(name) => sendWS({ type: "party_create", name })}
              onInvite={(partyId, toId) => sendWS({ type: "party_invite", partyId, toId })}
              onLeave={(partyId) => sendWS({ type: "party_leave", partyId })}
              onKick={(partyId, userId) => sendWS({ type: "party_kick", partyId, userId })}
              onAcceptInvite={(partyId) => sendWS({ type: "party_invite_respond", partyId, accept: true })}
              onDeclineInvite={(partyId) => sendWS({ type: "party_invite_respond", partyId, accept: false })}
            />
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
        <button type="submit" disabled={!input.trim()} aria-label="Отправить сообщение"
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
  const [subTab, setSubTab] = useState("join");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const [browseList, setBrowseList] = useState([]);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [appliedIds, setAppliedIds] = useState(new Set());
  const [applyingId, setApplyingId] = useState(null);
  const [viewingGroup, setViewingGroup] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const inAnyClan = groups.length > 0;
  const myClan = groups[0] || null;

  const create = async () => {
    if (busy || name.trim().length < 2) return;
    setBusy(true); setErr(null);
    try {
      const r = await authFetch("/api/groups", { method: "POST", body: JSON.stringify({ name: name.trim(), description: description.trim() }) });
      const d = await r.json();
      onCreate(d.group);
      setName(""); setDescription(""); setCreating(false);
      setSubTab("my");
    } catch (e) { setErr("Ошибка создания"); }
    finally { setBusy(false); }
  };

  const loadBrowse = useCallback(async () => {
    setBrowseLoading(true);
    try {
      const r = await authFetch("/api/groups/browse");
      const d = await r.json();
      setBrowseList(d.groups || []);
    } catch { setBrowseList([]); }
    finally { setBrowseLoading(false); }
  }, []);

  useEffect(() => {
    if (subTab === "join" || subTab === "browse") loadBrowse();
  }, [subTab, loadBrowse]);

  const apply = async (gid) => {
    if (applyingId || inAnyClan) return;
    setApplyingId(gid);
    try {
      const r = await authFetch(`/api/groups/${gid}/apply`, { method: "POST", body: JSON.stringify({}) });
      if (r.ok) setAppliedIds(prev => new Set(prev).add(gid));
    } catch {}
    finally { setApplyingId(null); }
  };

  const TAB_STYLE = (active) => ({
    background: active ? "rgba(168,85,247,0.2)" : "rgba(255,255,255,0.03)",
    border: active ? "1px solid rgba(168,85,247,0.3)" : "1px solid rgba(255,255,255,0.06)",
    color: active ? "rgba(168,85,247,0.9)" : "rgba(255,255,255,0.4)"
  });

  /* ── Detail view (browse or my) ── */
  if (viewingGroup) {
    const g = viewingGroup;
    const members = g.members || [];
    const memberNames = g.memberNames || {};
    const lvl = g.levelInfo?.level || 1;
    const li = g.levelInfo || {};
    const isMember = members.includes(user?.id);
    const isApplied = appliedIds.has(g.id);
    const onlineCount = members.filter(m => onlineIds.has(m)).length;

    return (
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        <div className="mb-4">
          <button onClick={() => setViewingGroup(null)}
            className="flex items-center gap-1.5 text-[11px] font-semibold mb-3 transition-all"
            style={{ color: "rgba(168,85,247,0.7)" }}
            onMouseEnter={e => e.currentTarget.style.color = "rgba(168,85,247,1)"}
            onMouseLeave={e => e.currentTarget.style.color = "rgba(168,85,247,0.7)"}>
            <CaretLeft size={12} weight="bold" /> Назад к списку
          </button>

          <div className="flex items-center gap-3 mb-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #2563eb, #3b82f6)", color: "#fff", fontWeight: 700, fontSize: 22 }}>
              {g.name.slice(0, 1).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-[15px] font-bold text-white truncate">{g.name}</p>
                <span className="text-[9px] px-1.5 py-0.5 rounded-md font-black"
                  style={{ background: "#1e3a8a", border: "1px solid rgba(59,130,246,0.4)", color: "#93c5fd" }}>
                  Ур. {lvl}
                </span>
                {g.closed && (
                  <span className="text-[8px] px-1.5 py-0.5 rounded-md font-black tracking-wider"
                    style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", color: "rgba(239,68,68,0.8)" }}>
                    ЗАКРЫТ
                  </span>
                )}
              </div>
              <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
                {members.length} чел &middot; {onlineCount > 0 ? `${onlineCount} онлайн` : "никого"}
              </p>
            </div>
          </div>

          {g.description && (
            <div className="rounded-xl p-3.5 mb-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <p className="text-[11px] leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>{g.description}</p>
            </div>
          )}

          <div className="rounded-xl p-3.5 mb-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.3)" }}>Уровень клана</p>
              <p className="text-[10px] font-bold" style={{ color: "rgba(96,165,250,0.8)" }}>
                {lvl} / {li.maxLevel || 7}
              </p>
            </div>
            <div className="h-2 rounded-full overflow-hidden mb-2" style={{ background: "rgba(255,255,255,0.07)" }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${li.xpPct || 0}%`, background: "linear-gradient(90deg, #2563eb, #3b82f6)" }} />
            </div>
            {li.nextLevel ? (
              <p className="text-[9px]" style={{ color: "rgba(255,255,255,0.35)" }}>
                До ур. {li.nextLevel}: {li.xp || 0}/{li.maxXp || 0} игроков с {li.nextHoursPerMember || 0}ч+
              </p>
            ) : (
              <p className="text-[9px]" style={{ color: "rgba(251,191,36,0.6)" }}>Максимальный уровень!</p>
            )}
          </div>

          <div className="rounded-xl p-3.5 mb-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="text-[10px] uppercase tracking-wider mb-3" style={{ color: "rgba(255,255,255,0.3)" }}>
              Участники &middot; {members.length}
            </p>
            {members.slice(0, 20).map(mid => {
              const role = mid === g.ownerId ? "owner" : (g.memberRoles?.[mid] || "member");
              const roleLabel = { owner: "OWNER", leader: "РУКОВОДИТЕЛЬ", elder: "СТАРШИНА", member: "" }[role];
              const roleColor = { owner: "rgba(251,191,36,0.8)", leader: "rgba(96,165,250,0.8)", elder: "rgba(168,85,247,0.8)", member: "" }[role];
              const roleBg = { owner: "rgba(251,191,36,0.12)", leader: "rgba(96,165,250,0.12)", elder: "rgba(168,85,247,0.12)", member: "" }[role];
              return (
              <div key={mid} className="flex items-center gap-2.5 py-1.5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-[10px] font-bold"
                  style={{ background: "rgba(99,102,241,0.2)", color: "rgba(168,85,247,0.8)" }}>
                  {(memberNames[mid] || "?").slice(0, 1).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  <p className="text-[12px] text-white truncate">{memberNames[mid] || mid}</p>
                  {roleLabel && (
                    <span className="text-[8px] px-1.5 py-0.5 rounded font-black tracking-wider flex-shrink-0"
                      style={{ background: roleBg, color: roleColor }}>{roleLabel}</span>
                  )}
                  {onlineIds.has(mid) && (
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "#22c55e" }} />
                  )}
                </div>
                <span className="text-[9px] font-mono flex-shrink-0" style={{ color: "rgba(255,255,255,0.3)" }}>
                  {li.memberHours?.[mid] != null ? `${Math.round((li.memberHours[mid] || 0) * 10) / 10}ч` : "0ч"}
                </span>
              </div>
              );
            })}
          </div>

          {!isMember && !g.closed && (
            <button onClick={() => apply(g.id)} disabled={applyingId === g.id || isApplied || inAnyClan}
              className="w-full py-3 rounded-xl text-[12px] font-bold text-white transition-all disabled:opacity-40"
              style={{ background: isApplied ? "rgba(34,197,94,0.3)" : inAnyClan ? "rgba(255,255,255,0.05)" : "rgba(168,85,247,0.45)" }}
              onMouseEnter={e => { if (!isApplied && !inAnyClan) e.currentTarget.style.background = "rgba(168,85,247,0.65)"; }}
              onMouseLeave={e => { if (!isApplied && !inAnyClan) e.currentTarget.style.background = "rgba(168,85,247,0.45)"; }}>
              {isApplied ? "Заявка отправлена" : inAnyClan ? "Вы уже в клане" : "Подать заявку"}
            </button>
          )}
          {!isMember && g.closed && (
            <div className="w-full py-3 rounded-xl text-[11px] font-semibold text-center"
              style={{ background: "rgba(239,68,68,0.08)", color: "rgba(239,68,68,0.6)", border: "1px solid rgba(239,68,68,0.15)" }}>
              Клан закрыт &mdash; только по приглашению
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ── Tab buttons ── */
  const tabs = [
    { id: "join",   label: "Вступить" },
    { id: "my",     label: "Мой клан" },
  ];

  return (
    <div className="flex-1 overflow-y-auto px-3 pb-3">
      <div className="flex gap-1.5 mb-4 px-1">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id)}
            className="flex-1 py-2.5 rounded-xl text-[11px] font-bold transition-all"
            style={TAB_STYLE(subTab === t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Все кланы (legacy, redirect to join) ── */}
      {subTab === "browse" && null}

      {/* ── Вступить (создать / вступить) ── */}
      {subTab === "join" && (
        <>
          {inAnyClan ? (
            <div className="flex flex-col items-center py-8 gap-3">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: "rgba(168,85,247,0.12)" }}>
                <Users size={20} style={{ color: "rgba(168,85,247,0.6)" }} />
              </div>
              <p className="text-[12px] font-semibold text-center" style={{ color: "rgba(255,255,255,0.6)" }}>
                Вы уже в клане
              </p>
              <p className="text-[11px] text-center px-6" style={{ color: "rgba(255,255,255,0.35)" }}>
                Чтобы вступить в другой клан, сначала покиньте текущий.
              </p>
            </div>
          ) : (
            <>
              <p className="text-[10px] uppercase tracking-widest px-2 py-2"
                style={{ color: "rgba(255,255,255,0.35)" }}>
                Список кланов
              </p>
              {/* Search */}
              <div className="mb-3 px-1">
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Поиск клана..."
                  className="w-full rounded-xl px-4 py-2.5 text-[11px] outline-none transition-all"
                  style={{ background: "rgba(255,255,255,0.05)", color: "#fff", border: "1px solid rgba(255,255,255,0.08)" }}
                  onFocus={e => e.currentTarget.style.borderColor = "rgba(168,85,247,0.4)"}
                  onBlur={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"}
                />
              </div>
              {browseLoading ? (
                <div className="flex flex-col items-center py-8 gap-3">
                  <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: "rgba(168,85,247,0.2)", borderTopColor: "rgba(168,85,247,0.7)" }} />
                  <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.35)" }}>Загрузка...</p>
                </div>
              ) : (() => {
                const filtered = browseList.filter(g =>
                  g.name.toLowerCase().includes(searchQuery.toLowerCase())
                );
                if (filtered.length === 0) return (
                  <div className="flex flex-col items-center py-6 gap-2">
                    <Users size={24} weight="thin" style={{ color: "rgba(255,255,255,0.12)" }} />
                    <p className="text-[11px] text-center" style={{ color: "rgba(255,255,255,0.25)" }}>
                      {searchQuery ? "Ничего не найдено" : "Нет доступных кланов"}
                    </p>
                  </div>
                );
                return filtered.map((g, idx) => {
                  const lvl = g.levelInfo?.level || 1;
                  const isApplied = appliedIds.has(g.id);
                  const isMember = (g.members || []).includes(user?.id);
                  return (
                    <motion.div key={g.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.03 }} className="mb-2">
                      <button onClick={() => setViewingGroup(g)}
                        className="w-full text-left px-3 py-3 rounded-xl transition-all"
                        onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                        <div className="flex items-center gap-3">
                          <div className="relative flex-shrink-0">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                              style={{ background: "linear-gradient(135deg, #2563eb, #3b82f6)", color: "#fff", fontWeight: 700, fontSize: 15 }}>
                              {g.name.slice(0, 1).toUpperCase()}
                            </div>
                            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-md flex items-center justify-center text-[8px] font-black"
                              style={{ background: "#1e3a8a", border: "1px solid rgba(59,130,246,0.4)", color: "#93c5fd" }}>
                              {lvl}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-[13px] font-semibold text-white truncate">{g.name}</p>
                              {g.closed && (
                                <span className="text-[8px] px-1.5 py-0.5 rounded font-black tracking-wider"
                                  style={{ background: "rgba(239,68,68,0.12)", color: "rgba(239,68,68,0.7)" }}>ЗАКРЫТ</span>
                              )}
                            </div>
                            <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>
                              {g.memberCount || (g.members || []).length} чел &middot; {g.ownerName ? `@${g.ownerName}` : ""}
                            </p>
                          </div>
                          {isApplied && (
                            <span className="text-[9px] px-2 py-1 rounded-lg font-bold flex-shrink-0"
                              style={{ background: "rgba(34,197,94,0.15)", color: "rgba(34,197,94,0.8)" }}>
                              Заявка
                            </span>
                          )}
                          {isMember && (
                            <span className="text-[9px] px-2 py-1 rounded-lg font-bold flex-shrink-0"
                              style={{ background: "rgba(168,85,247,0.15)", color: "rgba(168,85,247,0.8)" }}>
                              Участник
                            </span>
                          )}
                        </div>
                      </button>
                    </motion.div>
                  );
                });
              })()}

              {/* ── Создать клан (внизу) ── */}
              <p className="text-[10px] uppercase tracking-widest px-2 py-2 mt-5 mb-2"
                style={{ color: "rgba(168,85,247,0.7)" }}>
                Создать клан
              </p>
              {!creating ? (
                <button onClick={() => setCreating(true)}
                  className="w-full py-3 rounded-xl text-[12px] font-bold flex items-center justify-center gap-2 text-white transition-all"
                  style={{ background: "rgba(99,102,241,0.15)", border: "1px dashed rgba(99,102,241,0.3)" }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(99,102,241,0.25)"}
                  onMouseLeave={e => e.currentTarget.style.background = "rgba(99,102,241,0.15)"}>
                  <Plus size={14} /> Создать клан
                </button>
              ) : (
                <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.04)" }}>
                  <input value={name} onChange={e => setName(e.target.value)} maxLength={40} autoFocus
                    placeholder="Название клана..."
                    onKeyDown={e => { if (e.key === "Enter") create(); if (e.key === "Escape") { setCreating(false); setName(""); } }}
                    className="w-full rounded-xl px-4 py-3 text-[12px] outline-none"
                    style={{ background: "rgba(255,255,255,0.05)", color: "#fff", border: "1px solid rgba(255,255,255,0.08)" }} />
                  <input value={description} onChange={e => setDescription(e.target.value)} maxLength={200}
                    placeholder="Описание (необязательно)..."
                    className="w-full rounded-xl px-4 py-3 text-[12px] outline-none mt-2"
                    style={{ background: "rgba(255,255,255,0.05)", color: "#fff", border: "1px solid rgba(255,255,255,0.08)" }} />
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => { setCreating(false); setName(""); setDescription(""); setErr(null); }}
                      className="flex-1 py-2 rounded-xl text-[11px] font-semibold"
                      style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)" }}>Отмена</button>
                    <button onClick={create} disabled={busy || name.trim().length < 2}
                      className="flex-1 py-2 rounded-xl text-[11px] font-bold text-white disabled:opacity-40"
                      style={{ background: "rgba(168,85,247,0.5)" }}>Создать</button>
                  </div>
                  {err && <p className="text-[11px] mt-2" style={{ color: "#fca5a5" }}>{err}</p>}
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ── Мой клан ── */}
      {subTab === "my" && (
        <>
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

          {!myClan ? (
            <div className="flex flex-col items-center py-10 gap-3">
              <Users size={28} weight="thin" style={{ color: "rgba(255,255,255,0.15)" }} />
              <p className="text-[12px] text-center" style={{ color: "rgba(255,255,255,0.3)" }}>
                Вы не в клане.
              </p>
              <button onClick={() => setSubTab("join")}
                className="mt-1 px-5 py-2.5 rounded-xl text-[11px] font-bold text-white transition-all"
                style={{ background: "rgba(168,85,247,0.35)" }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(168,85,247,0.5)"}
                onMouseLeave={e => e.currentTarget.style.background = "rgba(168,85,247,0.35)"}>
                Вступить или создать
              </button>
            </div>
          ) : (
            (() => {
              const g = myClan;
              const onlineCount = (g.members || []).filter(m => onlineIds.has(m)).length;
              const isOwner = g.ownerId === user?.id;
              const lvl = g.levelInfo?.level || 1;
              const li = g.levelInfo || {};
              return (
                <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="mb-2">
                  <button onClick={() => setViewingGroup(g)}
                    className="w-full text-left px-3 py-3 rounded-xl transition-all"
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <div className="flex items-center gap-3">
                      <div className="relative flex-shrink-0">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                          style={{ background: "linear-gradient(135deg, #2563eb, #3b82f6)", color: "#fff", fontWeight: 700, fontSize: 15 }}>
                          {g.name.slice(0, 1).toUpperCase()}
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-md flex items-center justify-center text-[8px] font-black"
                          style={{ background: "#1e3a8a", border: "1px solid rgba(59,130,246,0.4)", color: "#93c5fd" }}>
                          {lvl}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-[13px] font-semibold text-white truncate">{g.name}</p>
                          {isOwner && (
                            <span className="text-[8px] px-1.5 py-0.5 rounded font-black tracking-wider"
                              style={{ background: "rgba(251,191,36,0.12)", color: "rgba(251,191,36,0.8)" }}>OWNER</span>
                          )}
                          {g.closed && (
                            <span className="text-[8px] px-1.5 py-0.5 rounded font-black tracking-wider"
                              style={{ background: "rgba(239,68,68,0.12)", color: "rgba(239,68,68,0.7)" }}>ЗАКРЫТ</span>
                          )}
                        </div>
                        <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>
                          {g.members?.length || 0} чел &middot; {onlineCount > 0 ? `${onlineCount} онлайн` : "никого"}
                        </p>
                        <div className="mt-1 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
                          <div className="h-full rounded-full" style={{ width: `${li.xpPct || 0}%`, background: "linear-gradient(90deg, #2563eb, #3b82f6)" }} />
                        </div>
                      </div>
                    </div>
                  </button>
                  <button onClick={() => onOpenGroup(g)}
                    className="w-full mt-2 py-2.5 rounded-xl text-[11px] font-bold text-white flex items-center justify-center gap-2 transition-all"
                    style={{ background: "rgba(168,85,247,0.3)", border: "1px solid rgba(168,85,247,0.25)" }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(168,85,247,0.5)"}
                    onMouseLeave={e => e.currentTarget.style.background = "rgba(168,85,247,0.3)"}>
                    <ChatCircle size={14} /> Открыть чат клана
                  </button>
                </motion.div>
              );
            })()
          )}
        </>
      )}
    </div>
  );
}

// ─── PartiesPanel (временные пати для игры) ──────────────────────────────────
// ─── PartiesPanel (временные пати для игры) ──────────────────────────────────
function PartiesPanel({ user, friends, onlineIds, parties, partyInvites, onCreate, onInvite, onLeave, onKick, onAcceptInvite, onDeclineInvite }) {
  const [creating, setCreating] = useState(false);
  const [newName,  setNewName]  = useState("");
  const [activeParty, setActiveParty] = useState(null); // открытая партия

  const openParty = parties.find(p => p.id === activeParty);

  // если открытая партия пропала (удалили/вышли) — сбросим
  React.useEffect(() => {
    if (activeParty && !parties.find(p => p.id === activeParty)) setActiveParty(null);
  }, [parties, activeParty]);

  /* ── Экран конкретной партии ── */
  if (openParty) {
    const isLeader = openParty.leaderId === user?.id;
    const memberIds = new Set(openParty.members.map(m => m.id));
    const invitableFriends = friends.filter(f => !memberIds.has(f.id));
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Шапка */}
        <div className="flex items-center gap-2 px-4 py-3 flex-shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <button onClick={() => setActiveParty(null)}
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ color: "rgba(255,255,255,0.4)" }}>
            <CaretLeft size={14} weight="bold" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-white truncate">{openParty.name}</p>
            <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>{openParty.members.length} игроков</p>
          </div>
          <button onClick={() => onLeave(openParty.id)}
            className="px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all"
            style={{ background: "rgba(239,68,68,0.1)", color: "rgba(239,68,68,0.7)" }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(239,68,68,0.2)"}
            onMouseLeave={e => e.currentTarget.style.background = "rgba(239,68,68,0.1)"}>
            Покинуть
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2">
          {/* Участники */}
          {openParty.members.map(m => {
            const online = onlineIds.has(m.id);
            return (
              <div key={m.id} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
                style={{ background: "rgba(255,255,255,0.03)" }}>
                <div className="relative flex-shrink-0">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold"
                    style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}>
                    {m.username?.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-black"
                    style={{ background: online ? "#4ade80" : "rgba(255,255,255,0.15)" }} />
                </div>
                <span className="text-[12px] flex-1" style={{ color: "rgba(255,255,255,0.8)" }}>
                  {m.id === user?.id ? "Ты" : m.username}
                </span>
                {m.id === openParty.leaderId && (
                  <span className="text-[8px] px-1.5 py-0.5 rounded font-black tracking-wider"
                    style={{ background: "rgba(251,191,36,0.12)", color: "rgba(251,191,36,0.8)" }}>ЛИДЕР</span>
                )}
                {isLeader && m.id !== user?.id && (
                  <button onClick={() => onKick(openParty.id, m.id)}
                    className="text-[9px] px-2 py-1 rounded-lg transition-all"
                    style={{ background: "rgba(239,68,68,0.1)", color: "rgba(239,68,68,0.6)" }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(239,68,68,0.2)"}
                    onMouseLeave={e => e.currentTarget.style.background = "rgba(239,68,68,0.1)"}>
                    Кик
                  </button>
                )}
              </div>
            );
          })}

          {/* Пригласить */}
          {isLeader && invitableFriends.length > 0 && (
            <>
              <p className="text-[9px] uppercase tracking-widest px-1 pt-2" style={{ color: "rgba(255,255,255,0.28)" }}>
                Позвать друга
              </p>
              {invitableFriends.map(f => (
                <button key={f.id} onClick={() => onInvite(openParty.id, f.id)}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all"
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(37,99,235,0.1)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                    style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)" }}>
                    {f.username?.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="text-[12px] flex-1" style={{ color: "rgba(255,255,255,0.7)" }}>{f.username}</span>
                  <UserPlus size={12} style={{ color: "rgba(96,165,250,0.5)" }} />
                </button>
              ))}
            </>
          )}
        </div>
      </div>
    );
  }

  /* ── Главный экран: список партий ── */
  return (
    <div className="flex-1 overflow-y-auto px-3 py-3">

      {/* Приглашения */}
      {partyInvites.length > 0 && (
        <div className="mb-3">
          <p className="text-[9px] uppercase tracking-widest px-1 pb-1.5" style={{ color: "rgba(96,165,250,0.7)" }}>
            Приглашения &middot; {partyInvites.length}
          </p>
          {partyInvites.map(inv => (
            <motion.div key={inv.partyId} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-xl p-3 mb-2 flex items-center gap-3"
              style={{ background: "rgba(37,99,235,0.07)", border: "1px solid rgba(59,130,246,0.14)" }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold flex-shrink-0"
                style={{ background: "rgba(37,99,235,0.2)", color: "#93c5fd" }}>
                {inv.fromUsername?.slice(0, 1).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-white truncate">{inv.partyName || "Группа"}</p>
                <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>от @{inv.fromUsername}</p>
              </div>
              <button onClick={() => onAcceptInvite(inv.partyId)}
                className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-white transition-all"
                style={{ background: "rgba(37,99,235,0.6)" }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(37,99,235,0.8)"}
                onMouseLeave={e => e.currentTarget.style.background = "rgba(37,99,235,0.6)"}>
                Войти
              </button>
              <button onClick={() => onDeclineInvite(inv.partyId)}
                className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
                style={{ color: "rgba(255,255,255,0.3)" }}
                onMouseEnter={e => e.currentTarget.style.color = "#f87171"}
                onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.3)"}>
                <X size={12} />
              </button>
            </motion.div>
          ))}
        </div>
      )}

      {/* Мои группы */}
      {parties.length > 0 && (
        <div className="mb-3">
          <p className="text-[9px] uppercase tracking-widest px-1 pb-1.5" style={{ color: "rgba(255,255,255,0.28)" }}>
            Мои группы &middot; {parties.length}
          </p>
          {parties.map((p, idx) => (
            <motion.div key={p.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04 }}>
              <button onClick={() => setActiveParty(p.id)}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all mb-1.5"
                onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-[12px] font-black flex-shrink-0"
                  style={{ background: "rgba(37,99,235,0.15)", border: "1px solid rgba(59,130,246,0.2)", color: "#60a5fa" }}>
                  {p.name?.slice(0, 1).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-white truncate">{p.name}</p>
                  <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>
                    {p.members.length} игрок{p.members.length !== 1 ? "ов" : ""}
                    {p.members.some(m => onlineIds.has(m.id) && m.id !== user?.id) && (
                      <span style={{ color: "#4ade80" }}> &middot; есть онлайн</span>
                    )}
                  </p>
                </div>
                <div className="flex gap-1">
                  {p.members.slice(0, 4).map(m => (
                    <div key={m.id} className="w-6 h-6 rounded-md flex items-center justify-center text-[8px] font-bold"
                      style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}>
                      {m.username?.slice(0, 2).toUpperCase()}
                    </div>
                  ))}
                </div>
              </button>
            </motion.div>
          ))}
        </div>
      )}

      {/* Создать группу */}
      {!creating ? (
        <button onClick={() => setCreating(true)}
          className="w-full py-3 rounded-xl text-[12px] font-bold flex items-center justify-center gap-2 text-white transition-all"
          style={{ background: "rgba(37,99,235,0.12)", border: "1px dashed rgba(59,130,246,0.25)" }}
          onMouseEnter={e => e.currentTarget.style.background = "rgba(37,99,235,0.22)"}
          onMouseLeave={e => e.currentTarget.style.background = "rgba(37,99,235,0.12)"}>
          <Plus size={13} /> Создать группу
        </button>
      ) : (
        <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)" }}>
          <input value={newName} onChange={e => setNewName(e.target.value)} maxLength={40} autoFocus
            placeholder="Название группы..."
            onKeyDown={e => {
              if (e.key === "Enter" && newName.trim()) { onCreate(newName.trim()); setNewName(""); setCreating(false); }
              if (e.key === "Escape") { setCreating(false); setNewName(""); }
            }}
            className="w-full rounded-lg px-3 py-2 text-[12px] outline-none mb-2"
            style={{ background: "rgba(255,255,255,0.05)", color: "#fff", border: "1px solid rgba(255,255,255,0.08)" }} />
          <div className="flex gap-2">
            <button onClick={() => { setCreating(false); setNewName(""); }}
              className="flex-1 py-2 rounded-lg text-[11px] font-semibold"
              style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)" }}>
              Отмена
            </button>
            <button onClick={() => { if (newName.trim()) { onCreate(newName.trim()); setNewName(""); setCreating(false); } }}
              disabled={!newName.trim()}
              className="flex-1 py-2 rounded-lg text-[11px] font-bold text-white disabled:opacity-40 transition-all"
              style={{ background: "rgba(37,99,235,0.6)" }}>
              Создать
            </button>
          </div>
        </div>
      )}

      {parties.length === 0 && !creating && partyInvites.length === 0 && (
        <div className="flex flex-col items-center py-10 gap-2 mt-2">
          <UsersThree size={28} weight="thin" style={{ color: "rgba(255,255,255,0.1)" }} />
          <p className="text-[11px] text-center" style={{ color: "rgba(255,255,255,0.3)" }}>
            Создай группу и позови друзей играть вместе
          </p>
        </div>
      )}
    </div>
  );
}

// ─── GroupChat ───────────────────────────────────────────────────────────────
function GroupChat({ group, user, messages, onLeave, onBack, onKick, onSetRole, onEditDescription, onToggleClosed, groupVoiceIds = [], activeCall, onJoinCall, onHangCall }) {
  const { push: pushNotif } = useNotifications() || {};
  const [input, setInput] = useState("");
  const [showMembers, setShowMembers] = useState(false);
  const [inviteNick, setInviteNick] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteMsg, setInviteMsg] = useState(null);
  const [editDesc, setEditDesc] = useState(false);
  const [descVal, setDescVal] = useState(group.description || "");
  const bottomRef = useRef(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  const isOwner = group.ownerId === user?.id;
  const myRole = isOwner ? "owner" : (group.memberRoles?.[user?.id] || "member");
  const canKickMembers = isOwner || myRole === "leader";
  const canManage = isOwner || myRole === "leader";
  const inThisCall = activeCall?.type === "group" && activeCall.groupId === group.id;
  const memberNames = group.memberNames || {};

  const submit = (e) => {
    e?.preventDefault();
    const t = input.trim();
    if (!t) return;
    if (!isWSConnected()) { pushNotif?.("Нет соединения", "Не удалось отправить — WS отключён", "error"); return; }
    sendWS({ type: "group_send", groupId: group.id, text: t });
    setInput("");
  };

  const invite = async () => {
    const nick = inviteNick.trim();
    if (!nick || inviteBusy) return;
    setInviteBusy(true); setInviteMsg(null);
    try {
      const r = await authFetch(`/api/groups/${group.id}/invite`, { method: "POST", body: JSON.stringify({ username: nick }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setInviteMsg({ ok: false, text: d.message || "Ошибка" }); setInviteBusy(false); return; }
      setInviteNick("");
      setInviteMsg({ ok: true, text: `Приглашение отправлено @${nick}` });
    } catch (e) { setInviteMsg({ ok: false, text: e.message?.replace(/^\d+:\s*/, "") || "Ошибка" }); }
    setInviteBusy(false);
  };

  return (
    <>
      <div className="flex items-center gap-3 px-5 py-3.5 flex-shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        <button onClick={onBack || onLeave} aria-label="Назад" className="w-9 h-9 rounded-xl flex items-center justify-center transition-all"
          style={{ color: "rgba(255,255,255,0.4)" }}
          onMouseEnter={e => e.currentTarget.style.color = "rgba(255,255,255,0.7)"}
          onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.4)"}>
          <CaretLeft size={16} weight="bold" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-[13px] font-bold text-white truncate">{group.name}</p>
            {group.levelInfo?.level && (
              <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md flex-shrink-0"
                style={{ background: "rgba(37,99,235,0.2)", color: "#93c5fd", border: "1px solid rgba(59,130,246,0.25)" }}>
                LVL {group.levelInfo.level}
              </span>
            )}
          </div>
          <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>
            {group.members.length} участников
            {groupVoiceIds.length > 0 && <span style={{ color: "#4ade80" }}> &middot; {groupVoiceIds.length} в голосе</span>}
          </p>
        </div>
        <button onClick={() => setShowMembers(!showMembers)} aria-label={showMembers ? "Скрыть участников" : "Показать участников"} aria-expanded={showMembers}
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-all"
          style={{ background: showMembers ? "rgba(255,255,255,0.1)" : "transparent", color: "rgba(255,255,255,0.5)" }}
          onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.08)"}
          onMouseLeave={e => e.currentTarget.style.background = showMembers ? "rgba(255,255,255,0.1)" : "transparent"}>
          <Users size={16} weight={showMembers ? "fill" : "regular"} />
        </button>
      </div>

      {/* ─── Voice call card ─── */}
      {(groupVoiceIds.length > 0 || inThisCall) && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
          className="flex-shrink-0 px-5 pt-3 pb-0">
          <div className="rounded-2xl p-3.5"
            style={{
              background: inThisCall
                ? "linear-gradient(135deg, rgba(34,197,94,0.08) 0%, rgba(37,99,235,0.08) 100%)"
                : "rgba(37,99,235,0.06)",
              border: inThisCall
                ? "1px solid rgba(34,197,94,0.2)"
                : "1px solid rgba(59,130,246,0.15)",
            }}>
            <div className="flex items-center gap-2.5 mb-2.5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{
                  background: inThisCall ? "rgba(34,197,94,0.15)" : "rgba(37,99,235,0.15)",
                  border: inThisCall ? "1px solid rgba(34,197,94,0.25)" : "1px solid rgba(59,130,246,0.2)",
                }}>
                <Phone size={14} weight="fill" style={{ color: inThisCall ? "#4ade80" : "#60a5fa" }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold" style={{ color: inThisCall ? "#4ade80" : "#93c5fd" }}>
                  {inThisCall ? "Голосовой чат" : groupVoiceIds.length > 0 ? "Идёт голосовой чат" : "Голосовой чат"}
                </p>
                <p className="text-[9px]" style={{ color: "rgba(255,255,255,0.35)" }}>
                  {groupVoiceIds.length > 0
                    ? `${groupVoiceIds.length} ${groupVoiceIds.length === 1 ? "участник" : groupVoiceIds.length < 5 ? "участника" : "участников"}`
                    : "Никто не в голосе"}
                </p>
              </div>
              {!inThisCall && groupVoiceIds.length > 0 && (
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                  onClick={onJoinCall}
                  className="px-4 py-2 rounded-xl text-[11px] font-bold text-white flex-shrink-0"
                  style={{ background: "rgba(34,197,94,0.4)" }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(34,197,94,0.55)"}
                  onMouseLeave={e => e.currentTarget.style.background = "rgba(34,197,94,0.4)"}>
                  Присоединиться
                </motion.button>
              )}
              {inThisCall && (
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                  onClick={onHangCall}
                  className="px-4 py-2 rounded-xl text-[11px] font-bold flex-shrink-0"
                  style={{ background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(239,68,68,0.25)"}
                  onMouseLeave={e => e.currentTarget.style.background = "rgba(239,68,68,0.15)"}>
                  Покинуть
                </motion.button>
              )}
            </div>
            {groupVoiceIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {groupVoiceIds.map(uid => (
                  <div key={uid} className="flex items-center gap-1.5 px-2 py-1 rounded-lg"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#4ade80" }} />
                    <span className="text-[10px] font-semibold" style={{ color: "rgba(255,255,255,0.7)" }}>
                      {uid === user?.id ? "Ты" : (memberNames[uid] || uid)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}
      {!inThisCall && groupVoiceIds.length === 0 && (
        <div className="flex-shrink-0 px-5 pt-3 pb-0">
          <button onClick={onJoinCall}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[11px] font-bold transition-all"
            style={{ background: "rgba(37,99,235,0.08)", color: "rgba(96,165,250,0.7)", border: "1px dashed rgba(59,130,246,0.2)" }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(37,99,235,0.15)"; e.currentTarget.style.color = "rgba(96,165,250,1)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(37,99,235,0.08)"; e.currentTarget.style.color = "rgba(96,165,250,0.7)"; }}>
            <Phone size={12} weight="fill" /> Начать голосовой чат
          </button>
        </div>
      )}

      <AnimatePresence>
        {showMembers && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden flex-shrink-0"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
            <div className="px-5 py-3 max-h-56 overflow-y-auto">
              <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: "rgba(255,255,255,0.35)" }}>
                Участники клана &middot; {group.members.length}
              </p>
              {group.members.map(mid => {
                const memberName = group.memberNames?.[mid] || mid;
                const role = mid === group.ownerId ? "owner" : (group.memberRoles?.[mid] || "member");
                const roleLabel = { owner: "OWNER", leader: "РУКОВОДИТЕЛЬ", elder: "СТАРШИНА", member: "" }[role];
                const roleColor = { owner: "rgba(251,191,36,0.8)", leader: "rgba(96,165,250,0.8)", elder: "rgba(168,85,247,0.8)", member: "" }[role];
                const roleBg = { owner: "rgba(251,191,36,0.12)", leader: "rgba(96,165,250,0.12)", elder: "rgba(168,85,247,0.12)", member: "" }[role];
                return (
                <div key={mid} className="flex items-center gap-2.5 py-2">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[9px] font-bold"
                    style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}>
                    {memberName.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="text-[11px] flex-1" style={{ color: "rgba(255,255,255,0.65)" }}>
                    {mid === user?.id ? "Ты" : memberName}
                    {roleLabel && (
                      <span className="ml-1.5 text-[8px] px-1.5 py-0.5 rounded font-black tracking-wider"
                        style={{ background: roleBg, color: roleColor }}>{roleLabel}</span>
                    )}
                  </span>
                  <span className="text-[9px] font-mono flex-shrink-0" style={{ color: "rgba(255,255,255,0.3)" }}>
                    {group.levelInfo?.memberHours?.[mid] != null ? `${Math.round((group.levelInfo.memberHours[mid] || 0) * 10) / 10}ч` : "0ч"}
                  </span>
                  {canKickMembers && mid !== user?.id && mid !== group.ownerId && !(isOwner && role === "leader") && (
                    <div className="flex gap-1">
                      {isOwner && mid !== group.ownerId && (
                        <div className="relative group/drop">
                          <button className="text-[9px] px-1.5 py-1 rounded-lg transition-all"
                            style={{ background: "rgba(96,165,250,0.1)", color: "rgba(96,165,250,0.6)" }}
                            onMouseEnter={e => e.currentTarget.style.background = "rgba(96,165,250,0.2)"}
                            onMouseLeave={e => e.currentTarget.style.background = "rgba(96,165,250,0.1)"}>
                            &#9660;
                          </button>
                          <div className="absolute right-0 top-full mt-1 z-50 hidden group-hover/drop:block min-w-[140px] py-1 rounded-xl"
                            style={{ background: "rgba(20,20,30,0.97)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(12px)" }}>
                            {role !== "leader" && (
                              <button onClick={() => onSetRole?.(mid, "leader")}
                                className="w-full text-left px-3 py-2 text-[10px] transition-all"
                                style={{ color: "rgba(96,165,250,0.8)" }}
                                onMouseEnter={e => e.currentTarget.style.background = "rgba(96,165,250,0.1)"}
                                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                                Сделать руководителем
                              </button>
                            )}
                            {role !== "elder" && (
                              <button onClick={() => onSetRole?.(mid, "elder")}
                                className="w-full text-left px-3 py-2 text-[10px] transition-all"
                                style={{ color: "rgba(168,85,247,0.8)" }}
                                onMouseEnter={e => e.currentTarget.style.background = "rgba(168,85,247,0.1)"}
                                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                                Сделать старшиной
                              </button>
                            )}
                            {role !== "member" && (
                              <button onClick={() => onSetRole?.(mid, "member")}
                                className="w-full text-left px-3 py-2 text-[10px] transition-all"
                                style={{ color: "rgba(255,255,255,0.4)" }}
                                onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
                                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                                Снять звание
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                      <button onClick={() => onKick?.(mid)}
                        className="text-[10px] px-2.5 py-1 rounded-lg transition-all"
                        style={{ background: "rgba(239,68,68,0.1)", color: "rgba(239,68,68,0.6)" }}
                        onMouseEnter={e => e.currentTarget.style.background = "rgba(239,68,68,0.2)"}
                        onMouseLeave={e => e.currentTarget.style.background = "rgba(239,68,68,0.1)"}>
                        Кик
                      </button>
                    </div>
                  )}
                </div>
                );
              })}
              <div className="flex gap-2 mt-3 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                <input value={inviteNick} onChange={e => setInviteNick(e.target.value)}
                  placeholder="Пригласить в клан..." maxLength={16}
                  onKeyDown={e => { if (e.key === "Enter") invite(); }}
                  className="flex-1 rounded-lg px-3 py-2 text-[11px] outline-none"
                  style={{ background: "rgba(255,255,255,0.05)", color: "#fff" }} />
                <button onClick={invite} disabled={!inviteNick.trim() || inviteBusy}
                  className="px-3 py-2 rounded-lg text-[11px] font-bold text-white disabled:opacity-40"
                  style={{ background: "rgba(37,99,235,0.4)" }}>
                  <UserPlus size={13} />
                </button>
              </div>
              <button onClick={onLeave} className="w-full mt-2 py-2 rounded-lg text-[10px] font-semibold transition-all"
                style={{ background: "rgba(239,68,68,0.08)", color: "rgba(239,68,68,0.6)" }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(239,68,68,0.18)"}
                onMouseLeave={e => e.currentTarget.style.background = "rgba(239,68,68,0.08)"}>
                Покинуть клан
              </button>
              {canManage && (
                <div className="mt-2 pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                  <p className="text-[9px] uppercase tracking-widest mb-1.5" style={{ color: "rgba(255,255,255,0.28)" }}>Настройки клана</p>
                  {!editDesc ? (
                    <button onClick={() => { setEditDesc(true); setDescVal(group.description || ""); }}
                      className="w-full text-left px-3 py-2 rounded-lg text-[10px] transition-all"
                      style={{ background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.5)" }}
                      onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.06)"}
                      onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}>
                      {group.description ? `Описание: ${group.description.slice(0, 40)}...` : "Добавить описание"}
                    </button>
                  ) : (
                    <div>
                      <input value={descVal} onChange={e => setDescVal(e.target.value)} maxLength={200} autoFocus
                        placeholder="Описание клана..."
                        className="w-full rounded-lg px-3 py-2 text-[11px] outline-none mb-1.5"
                        style={{ background: "rgba(255,255,255,0.05)", color: "#fff", border: "1px solid rgba(255,255,255,0.08)" }} />
                      <div className="flex gap-1.5">
                        <button onClick={() => setEditDesc(false)}
                          className="flex-1 py-1.5 rounded-lg text-[10px] font-semibold"
                          style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)" }}>Отмена</button>
                        <button onClick={() => { onEditDescription?.(descVal); setEditDesc(false); }}
                          className="flex-1 py-1.5 rounded-lg text-[10px] font-bold text-white"
                          style={{ background: "rgba(96,165,250,0.4)" }}>Сохранить</button>
                      </div>
                    </div>
                  )}
                  {isOwner && (
                    <div className="mt-2 pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                      <button onClick={() => onToggleClosed?.(!group.closed)}
                        className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-[10px] transition-all"
                        style={{ background: group.closed ? "rgba(239,68,68,0.1)" : "rgba(255,255,255,0.03)", color: group.closed ? "rgba(239,68,68,0.7)" : "rgba(255,255,255,0.5)" }}
                        onMouseEnter={e => e.currentTarget.style.background = group.closed ? "rgba(239,68,68,0.18)" : "rgba(255,255,255,0.06)"}
                        onMouseLeave={e => e.currentTarget.style.background = group.closed ? "rgba(239,68,68,0.1)" : "rgba(255,255,255,0.03)"}>
                        <span>{group.closed ? "Клан закрыт" : "Клан открыт"}</span>
                        <span className="text-[8px] px-2 py-0.5 rounded-full font-bold"
                          style={{ background: group.closed ? "rgba(239,68,68,0.2)" : "rgba(34,197,94,0.2)", color: group.closed ? "rgba(239,68,68,0.8)" : "rgba(34,197,94,0.8)" }}>
                          {group.closed ? "CLOSED" : "OPEN"}
                        </span>
                      </button>
                      <p className="text-[8px] mt-1 px-1" style={{ color: "rgba(255,255,255,0.2)" }}>
                        {group.closed ? "Только по приглашению" : "Любой может подать заявку"}
                      </p>
                    </div>
                  )}
                </div>
              )}
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
          aria-label="Сообщение команде" placeholder="Сообщение команде..." rows={1}
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

// ─── IncomingCallModal ────────────────────────────────────────────────────────
function IncomingCallModal({ call, onAccept, onReject }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: -20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: -20 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
      style={{
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 99999, display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
      }}
    >
      <div style={{
        width: 300, borderRadius: 20,
        background: "rgba(20, 20, 28, 0.97)",
        backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 24px 64px rgba(0,0,0,0.8)",
        padding: "28px 24px 24px",
        textAlign: "center",
      }}>
        <div style={{ position: "relative", display: "inline-block", marginBottom: 16 }}>
          <motion.div
            animate={{ scale: [1, 1.12, 1] }}
            transition={{ repeat: Infinity, duration: 1.4 }}
            style={{
              position: "absolute", inset: -8, borderRadius: "50%",
              background: "rgba(37,99,235,0.2)",
            }}
          />
          <div style={{
            width: 64, height: 64, borderRadius: "50%",
            background: "rgba(37,99,235,0.15)", border: "2px solid rgba(59,130,246,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 22, fontWeight: 900, color: "#60a5fa", position: "relative",
          }}>
            {call.fromUsername?.slice(0, 2).toUpperCase()}
          </div>
        </div>

        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4 }}>
          Входящий звонок
        </p>
        <p style={{ color: "#fff", fontSize: 18, fontWeight: 800, marginBottom: 24 }}>
          {call.fromUsername}
        </p>

        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={onReject}
            style={{
              flex: 1, padding: "12px 0", borderRadius: 14, border: "none", cursor: "pointer",
              background: "rgba(239,68,68,0.15)", color: "#f87171", fontWeight: 700, fontSize: 13,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(239,68,68,0.3)"}
            onMouseLeave={e => e.currentTarget.style.background = "rgba(239,68,68,0.15)"}>
            <PhoneSlash size={16} weight="fill" />
            Отклонить
          </button>
          <button onClick={onAccept}
            style={{
              flex: 1, padding: "12px 0", borderRadius: 14, border: "none", cursor: "pointer",
              background: "rgba(34,197,94,0.2)", color: "#4ade80", fontWeight: 700, fontSize: 13,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(34,197,94,0.35)"}
            onMouseLeave={e => e.currentTarget.style.background = "rgba(34,197,94,0.2)"}>
            <Phone size={16} weight="fill" />
            Принять
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── CallOverlay ──────────────────────────────────────────────────────────────
function CallOverlay({ call, groupVoiceIds, friends, localStream, onMute, onShare, onHangUp }) {
  const selfVideoRef = React.useRef(null);
  const [elapsed, setElapsed] = React.useState(0);
  const startRef = React.useRef(Date.now());

  React.useEffect(() => {
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  // Привязываем локальный стрим к video-элементу
  React.useEffect(() => {
    const video = selfVideoRef.current;
    if (!video || !localStream?.current) return;
    // Останавливаем предыдущий srcObject чтобы не дублировать
    video.srcObject = null;
    const tracks = localStream.current.getTracks();
    if (tracks.length > 0) {
      video.srcObject = localStream.current;
    }
  }, [call]);

  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const label = call.type === "dm"
    ? (call.peerName || "Собеседник")
    : `Голосовой чат · ${groupVoiceIds.length}`;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: 30 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, y: 30 }}
      transition={{ type: "spring", stiffness: 350, damping: 28 }}
      style={{
        position: "fixed", bottom: 24, right: 24, zIndex: 99999,
        width: 320, borderRadius: 22, overflow: "hidden",
        background: "rgba(16, 16, 24, 0.97)",
        backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 20px 60px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.05)",
      }}
    >
      {/* Accent line */}
      <div style={{ height: 2, background: "linear-gradient(90deg, transparent, #2563eb, transparent)" }} />

      {/* Self-video preview */}
      <div style={{ padding: "12px 12px 0" }}>
        <video
          ref={selfVideoRef}
          autoPlay muted playsInline
          style={{
            width: "100%", height: 100, borderRadius: 14, objectFit: "cover",
            background: "#0a0a12",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        />
      </div>

      {/* Info */}
      <div style={{ padding: "10px 16px 4px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 12,
            background: "linear-gradient(135deg, rgba(37,99,235,0.2), rgba(37,99,235,0.05))",
            border: "1px solid rgba(59,130,246,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Phone size={15} weight="fill" style={{ color: "#60a5fa" }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ color: "#fff", fontSize: 13, fontWeight: 700, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</p>
            <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, margin: 0, fontWeight: 600, fontFamily: "monospace" }}>
              {fmt(elapsed)}{call.muted ? " · Выкл. микро" : ""}{call.sharing ? " · Экран" : ""}
            </p>
          </div>
        </div>
      </div>

      {/* Participants (group) */}
      {call.type === "group" && groupVoiceIds.length > 0 && (
        <div style={{ display: "flex", gap: 6, padding: "6px 16px", flexWrap: "wrap" }}>
          {groupVoiceIds.map(uid => {
            const f = friends.find(x => x.id === uid);
            return (
              <div key={uid} style={{
                padding: "4px 10px", borderRadius: 8,
                background: "rgba(37,99,235,0.12)", border: "1px solid rgba(59,130,246,0.2)",
                fontSize: 10, fontWeight: 700, color: "#93c5fd",
              }}>
                {f?.username || "?"}
              </div>
            );
          })}
        </div>
      )}

      {/* Controls */}
      <div style={{ display: "flex", gap: 8, padding: "10px 16px 14px" }}>
        <button onClick={onMute} style={{
          flex: 1, padding: "10px 0", borderRadius: 12, border: "none", cursor: "pointer",
          background: call.muted ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.06)",
          color: call.muted ? "#f87171" : "rgba(255,255,255,0.6)",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
          fontSize: 11, fontWeight: 600, transition: "background 0.15s",
        }}>
          {call.muted ? <MicrophoneSlash size={14} weight="fill" /> : <Microphone size={14} weight="fill" />}
          {call.muted ? "Вкл" : "Выкл"}
        </button>
        <button onClick={onShare} style={{
          flex: 1, padding: "10px 0", borderRadius: 12, border: "none", cursor: "pointer",
          background: call.sharing ? "rgba(37,99,235,0.25)" : "rgba(255,255,255,0.06)",
          color: call.sharing ? "#60a5fa" : "rgba(255,255,255,0.6)",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
          fontSize: 11, fontWeight: 600, transition: "background 0.15s",
        }}>
          <MonitorArrowUp size={14} weight="fill" />
          {call.sharing ? "Стоп" : "Экран"}
        </button>
        <button onClick={onHangUp} style={{
          flex: 1, padding: "10px 0", borderRadius: 12, border: "none", cursor: "pointer",
          background: "rgba(239,68,68,0.15)", color: "#f87171",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
          fontSize: 11, fontWeight: 600, transition: "background 0.15s",
        }}>
          <PhoneSlash size={14} weight="fill" />
          Завершить
        </button>
      </div>
    </motion.div>
  );
}
