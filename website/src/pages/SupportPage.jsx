import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TelegramLogo, Plus, PaperPlaneRight, Headset,
  CaretLeft, Checks, ChatCircle,
} from "@phosphor-icons/react";
import { API_URL, WS_URL, getToken } from "../lib/api.js";

const CATEGORIES = [
  "Технические проблемы",
  "Вопрос по аккаунту",
  "Вопрос по покупке",
  "Баг / ошибка в игре",
  "Жалоба на игрока",
  "Другое",
];

const STATUS_META = {
  open:     { label: "Открыт",   color: "#fbbf24", bg: "rgba(251,191,36,0.1)"   },
  answered: { label: "Ответили", color: "#34d399", bg: "rgba(52,211,153,0.1)"   },
  closed:   { label: "Закрыт",   color: "rgba(255,255,255,0.4)", bg: "rgba(255,255,255,0.05)" },
};

/* ─── WebSocket hook with auto-reconnect ──────────────────────────────────── */
function useWS(url, user, onMessage) {
  const ws        = useRef(null);
  const deadRef   = useRef(false);
  const timer     = useRef(null);
  const msgRef    = useRef(onMessage);
  const userRef   = useRef(user);
  const [connected, setConnected] = useState(false);
  useEffect(() => { msgRef.current  = onMessage; }, [onMessage]);
  useEffect(() => { userRef.current = user;      }, [user]);

  useEffect(() => {
    deadRef.current = false;
    const connect = () => {
      if (deadRef.current) return;
      if (ws.current?.readyState === WebSocket.OPEN || ws.current?.readyState === WebSocket.CONNECTING) return;
      const s = new WebSocket(url);
      ws.current = s;
      s.onopen = () => {
        if (deadRef.current) { s.close(); return; }
        setConnected(true);
        const u = userRef.current;
        s.send(JSON.stringify({ type: "auth", userId: u?.id, username: u?.username, token: getToken() }));
      };
      s.onmessage = (e) => { try { msgRef.current?.(JSON.parse(e.data)); } catch {} };
      s.onclose   = () => { if (!deadRef.current) { setConnected(false); timer.current = setTimeout(connect, 3000); } };
      s.onerror   = () => { if (s.readyState !== WebSocket.CLOSED) s.close(); };
    };
    timer.current = setTimeout(connect, 100);
    return () => { deadRef.current = true; clearTimeout(timer.current); ws.current?.close(); };
  }, [url, user?.id]);

  const send = useCallback((data) => {
    if (ws.current?.readyState === WebSocket.OPEN) ws.current.send(JSON.stringify(data));
  }, []);

  return { connected, send };
}

/* ─── Main ──────────────────────────────────────────────────────────────────── */
export default function SupportPage({ user }) {
  const [view,     setView]     = useState("list");
  const [tickets,  setTickets]  = useState([]);
  const [active,   setActive]   = useState(null);
  const [messages, setMessages] = useState([]);

  const handleWS = useCallback((msg) => {
    if (msg.type === "ticket_messages") setMessages(msg.messages || []);
    if (msg.type === "message" && active && msg.ticketId === active.id)
      setMessages(prev => prev.find(m => m.id === msg.message.id) ? prev : [...prev, msg.message]);
    if (msg.type === "ticket_update") {
      setTickets(prev => prev.map(t => t.id === msg.ticket.id ? { ...t, ...msg.ticket } : t));
      setActive(prev => prev?.id === msg.ticket.id ? { ...prev, ...msg.ticket } : prev);
    }
  }, [active]);

  const { connected, send } = useWS(WS_URL, user, handleWS);

  useEffect(() => {
    if (!user?.id) return;
    fetch(`${API_URL}/support/tickets`, {
      headers: { Authorization: `Bearer ${getToken() || ""}` },
    })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => { setTickets(d.tickets || []); })
      .catch(() => {});
  }, [user?.id]);

  const openTicket = (t) => {
    setActive(t); setMessages([]); setView("chat");
    send({ type: "subscribe_ticket", ticketId: t.id });
  };

  const onCreated = (t) => {
    setTickets(prev => [t, ...prev]);
    openTicket(t);
    setMessages(t.messages || []);
  };

  const sendMsg = (text) => {
    if (!active) return;
    const msg = { id: Date.now().toString(), from: user?.id, username: user?.username, role: "user", text, time: Date.now() };
    setMessages(prev => [...prev, msg]);
    send({ type: "message", ticketId: active.id, text });
  };

  return (
    <main style={{ height: "calc(100vh - 70px)", display: "flex", flexDirection: "column" }}>
      <div style={{
        flex: 1, display: "flex", maxWidth: 1100, width: "100%", margin: "0 auto",
        padding: "0 24px 24px", minHeight: 0,
      }}>
        <div style={{
          flex: 1, display: "flex", borderRadius: 20, overflow: "hidden", minHeight: 0,
          background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
        }}>

          {/* ── Sidebar ── */}
          <div style={{ width: 260, flexShrink: 0, display: "flex", flexDirection: "column", borderRight: "1px solid rgba(255,255,255,0.05)" }}>

            {/* Sidebar header */}
            <div style={{ padding: "18px 16px 12px", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 9, background: "rgba(37,99,235,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Headset size={14} weight="fill" color="#60a5fa" />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>Поддержка</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: connected ? "#34d399" : "rgba(255,255,255,0.15)", boxShadow: connected ? "0 0 6px rgba(52,211,153,0.5)" : "none" }} />
                  <button onClick={() => setView("new")} aria-label="Новое обращение" style={{
                    width: 28, height: 28, borderRadius: 9, background: "rgba(37,99,235,0.15)", border: "none",
                    color: "#60a5fa", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(37,99,235,0.28)"}
                    onMouseLeave={e => e.currentTarget.style.background = "rgba(37,99,235,0.15)"}
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>

              {/* Telegram link */}
              <a href="https://t.me/sbgamescbot" target="_blank" rel="noreferrer" style={{
                display: "flex", alignItems: "center", gap: 9, padding: "9px 12px", borderRadius: 11,
                background: "rgba(41,182,246,0.06)", border: "1px solid rgba(41,182,246,0.12)",
                textDecoration: "none", color: "#fff",
              }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(41,182,246,0.1)"}
                onMouseLeave={e => e.currentTarget.style.background = "rgba(41,182,246,0.06)"}
              >
                <TelegramLogo size={14} weight="fill" color="#29b6f6" />
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#fff" }}>Telegram поддержка</div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>Быстрый ответ</div>
                </div>
              </a>
            </div>

            {/* Ticket list */}
            <div style={{ flex: 1, overflowY: "auto", padding: "0 8px 12px", display: "flex", flexDirection: "column", gap: 2 }}>
              {tickets.length === 0 ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, gap: 8, padding: "40px 0" }}>
                  <ChatCircle size={28} color="rgba(255,255,255,0.07)" />
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>Нет обращений</span>
                </div>
              ) : tickets.map(t => {
                const st = STATUS_META[t.status] || STATUS_META.open;
                const isActive = active?.id === t.id && view === "chat";
                return (
                  <button key={t.id} onClick={() => openTicket(t)} style={{
                    width: "100%", textAlign: "left", padding: "10px 12px", borderRadius: 12, cursor: "pointer",
                    background: isActive ? "rgba(37,99,235,0.1)" : "transparent",
                    border: isActive ? "1px solid rgba(59,130,246,0.2)" : "1px solid transparent",
                    color: "#fff",
                  }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, marginBottom: 3 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.category}</span>
                      <span style={{ fontSize: 9, fontWeight: 600, padding: "2px 6px", borderRadius: 6, flexShrink: 0, background: st.bg, color: st.color }}>{st.label}</span>
                    </div>
                    <p style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.preview}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Main area ── */}
          <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", minWidth: 0 }}>
            <AnimatePresence mode="wait">

              {/* Empty state */}
              {view === "list" && (
                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, height: "100%" }}
                >
                  <div style={{ width: 56, height: 56, borderRadius: 18, background: "rgba(37,99,235,0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Headset size={26} weight="fill" color="rgba(96,165,250,0.45)" />
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <p style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 4 }}>Служба поддержки</p>
                    <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>Создайте обращение — ответим в течение часа</p>
                  </div>
                  <button onClick={() => setView("new")} style={{
                    display: "flex", alignItems: "center", gap: 7, padding: "10px 20px", borderRadius: 12,
                    background: "rgba(37,99,235,0.2)", border: "none", color: "#93c5fd",
                    fontSize: 12, fontWeight: 600, cursor: "pointer",
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(37,99,235,0.35)"}
                    onMouseLeave={e => e.currentTarget.style.background = "rgba(37,99,235,0.2)"}
                  >
                    <Plus size={13} />Новое обращение
                  </button>
                </motion.div>
              )}

              {/* New ticket form */}
              {view === "new" && (
                <motion.div key="new" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }} style={{ flex: 1, overflowY: "auto" }}
                >
                  <NewTicketForm user={user} onBack={() => setView("list")} onCreated={onCreated} />
                </motion.div>
              )}

              {/* Chat */}
              {view === "chat" && active && (
                <motion.div key={`chat-${active.id}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }} style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, height: "100%" }}
                >
                  <ChatView ticket={active} messages={messages} user={user}
                    onBack={() => setView("list")} onSend={sendMsg} />
                </motion.div>
              )}

            </AnimatePresence>
          </div>

        </div>
      </div>
    </main>
  );
}

/* ─── New ticket form ────────────────────────────────────────────────────────── */
const DRAFT_KEY = "sbg_web_support_draft";
function NewTicketForm({ user, onBack, onCreated }) {
  const [category, setCategory] = useState(() => { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || "{}").category || ""; } catch { return ""; } });
  const [text,     setText]     = useState(() => { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || "{}").text || ""; } catch { return ""; } });
  const [loading,  setLoading]  = useState(false);
  const [catOpen,  setCatOpen]  = useState(false);
  const dropRef = useRef(null);

  useEffect(() => {
    const h = e => { if (dropRef.current && !dropRef.current.contains(e.target)) setCatOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  useEffect(() => {
    if (category || text) localStorage.setItem(DRAFT_KEY, JSON.stringify({ category, text }));
  }, [category, text]);

  const canSubmit = category && text.trim().length >= 10 && !loading;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    let ticketId = Date.now();
    try {
      const r = await fetch(`${API_URL}/support/ticket`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken() || ""}` },
        body: JSON.stringify({ userId: user?.id, username: user?.username, category, message: text.trim() }),
      });
      const d = await r.json();
      if (d.ticketId) ticketId = d.ticketId;
    } catch {}
    const now = Date.now();
    onCreated({
      id: ticketId, category, preview: text.trim().slice(0, 60),
      status: "open", username: user?.username, createdAt: now,
      messages: [
        { id: "sys", from: "system", text: "Обращение создано. Ожидайте ответа — обычно отвечаем в течение часа.", time: now },
        { id: "m1",  from: user?.id, username: user?.username, role: "user", text: text.trim(), time: now },
      ],
    });
    localStorage.removeItem(DRAFT_KEY);
    setLoading(false);
  };

  return (
    <div style={{ padding: "24px 28px", maxWidth: 520, display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Back */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={onBack} style={{
          width: 28, height: 28, borderRadius: 9, background: "rgba(255,255,255,0.05)", border: "none",
          color: "rgba(255,255,255,0.6)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
        }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.09)"; e.currentTarget.style.color = "#fff"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "rgba(255,255,255,0.6)"; }}
        >
          <CaretLeft size={14} weight="bold" />
        </button>
        <div>
          <p style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>Новое обращение</p>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>Опишите проблему — ответим быстро</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Category */}
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.13em", textTransform: "uppercase", color: "rgba(255,255,255,0.55)", marginBottom: 8 }}>Тема</p>
          <div style={{ position: "relative" }} ref={dropRef}>
            <button type="button" onClick={() => setCatOpen(v => !v)} style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "11px 14px", borderRadius: 12, fontSize: 13, cursor: "pointer",
              background: "rgba(255,255,255,0.04)", color: category ? "#fff" : "rgba(255,255,255,0.45)",
              border: catOpen ? "1px solid rgba(37,99,235,0.4)" : "1px solid rgba(255,255,255,0.07)",
            }}>
              {category || "Выберите тему..."}
              <CaretLeft size={13} style={{ transform: catOpen ? "rotate(90deg)" : "rotate(-90deg)", transition: "transform 0.15s", color: "rgba(255,255,255,0.4)" }} />
            </button>
            <AnimatePresence>
              {catOpen && (
                <motion.div initial={{ opacity: 0, y: -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.98 }} transition={{ duration: 0.15 }}
                  style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 20, borderRadius: 14, overflow: "hidden", background: "#0e0e0e", boxShadow: "0 16px 48px rgba(0,0,0,0.8)" }}
                >
                  {CATEGORIES.map(cat => (
                    <button key={cat} type="button" onClick={() => { setCategory(cat); setCatOpen(false); }} style={{
                      width: "100%", textAlign: "left", padding: "10px 14px", fontSize: 12, cursor: "pointer",
                      background: "transparent", border: "none", color: category === cat ? "#93c5fd" : "rgba(255,255,255,0.5)",
                    }}
                      onMouseEnter={e => { if (category !== cat) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    >{cat}</button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Description */}
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.13em", textTransform: "uppercase", color: "rgba(255,255,255,0.55)", marginBottom: 8 }}>Описание</p>
          <textarea value={text} onChange={e => setText(e.target.value)} rows={6}
            aria-label="Описание проблемы"
            placeholder="Подробно опишите проблему..."
            style={{
              width: "100%", boxSizing: "border-box", padding: "12px 14px", borderRadius: 12,
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)",
              color: "#fff", fontSize: 13, resize: "none", outline: "none", caretColor: "#60a5fa",
            }}
            onFocus={e => e.currentTarget.style.borderColor = "rgba(37,99,235,0.4)"}
            onBlur={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"}
          />
          <p style={{ fontSize: 10, textAlign: "right", marginTop: 4, color: text.length >= 10 ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.25)" }}>
            {text.length} симв.
          </p>
        </div>

        <button type="submit" disabled={!canSubmit} style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          padding: "13px 0", borderRadius: 12, border: "none", fontSize: 13, fontWeight: 600, cursor: canSubmit ? "pointer" : "not-allowed",
          background: canSubmit ? "rgba(37,99,235,0.22)" : "rgba(255,255,255,0.04)",
          color: canSubmit ? "#93c5fd" : "rgba(255,255,255,0.4)",
          transition: "all 0.15s",
        }}
          onMouseEnter={e => { if (canSubmit) e.currentTarget.style.background = "rgba(37,99,235,0.38)"; }}
          onMouseLeave={e => { if (canSubmit) e.currentTarget.style.background = "rgba(37,99,235,0.22)"; }}
        >
          {loading
            ? <div className="animate-spin" style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.15)", borderTopColor: "#60a5fa", borderRadius: "50%" }} />
            : <><PaperPlaneRight size={13} weight="fill" />Отправить</>
          }
        </button>
      </form>
    </div>
  );
}

/* ─── Chat view ──────────────────────────────────────────────────────────────── */
const DRAFT_CHAT_KEY = (id) => `sbg_web_chat_draft_${id}`;
function ChatView({ ticket, messages, user, onBack, onSend }) {
  const [input, setInput] = useState(() => localStorage.getItem(DRAFT_CHAT_KEY(ticket.id)) || "");
  const bottomRef = useRef(null);
  const st = STATUS_META[ticket.status] || STATUS_META.open;

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  useEffect(() => { if (input) localStorage.setItem(DRAFT_CHAT_KEY(ticket.id), input); }, [input, ticket.id]);

  const handleSend = (e) => {
    e.preventDefault();
    const t = input.trim(); if (!t) return;
    onSend(t); setInput(""); localStorage.removeItem(DRAFT_CHAT_KEY(ticket.id));
  };

  return (
    <>
      {/* Chat header */}
      <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <button onClick={onBack} style={{
          width: 28, height: 28, borderRadius: 9, background: "rgba(255,255,255,0.05)", border: "none",
          color: "rgba(255,255,255,0.6)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.09)"; e.currentTarget.style.color = "#fff"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "rgba(255,255,255,0.6)"; }}
        >
          <CaretLeft size={14} weight="bold" />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ticket.category}</p>
          <p style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>Обращение в поддержку</p>
        </div>
        <span style={{ fontSize: 10, fontWeight: 600, padding: "4px 10px", borderRadius: 20, flexShrink: 0, background: st.bg, color: st.color }}>
          {st.label}
        </span>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 8, minHeight: 0 }}>
        {messages.map((msg, i) => {
          const isMe     = msg.from === user?.id || msg.role === "user";
          const isSystem = msg.from === "system";
          return (
            <motion.div key={msg.id || i}
              initial={{ opacity: 0, y: 6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.18 }}
              style={{
                display: "flex", flexDirection: "column", gap: 3, maxWidth: "76%",
                alignSelf: isSystem ? "center" : isMe ? "flex-end" : "flex-start",
                alignItems: isSystem ? "center" : isMe ? "flex-end" : "flex-start",
              }}
            >
              {!isMe && !isSystem && (
                <span style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", paddingLeft: 2 }}>
                  {msg.role === "admin" ? "Администратор" : `@${msg.username}`}
                </span>
              )}
              {isSystem ? (
                <div style={{ padding: "6px 12px", borderRadius: 10, background: "rgba(255,255,255,0.04)" }}>
                  <p style={{ fontSize: 10, color: "rgba(255,255,255,0.45)" }}>{msg.text}</p>
                </div>
              ) : (
                <div style={{
                  padding: "10px 14px", borderRadius: 16, fontSize: 13, lineHeight: 1.5,
                  ...(isMe
                    ? { background: "rgba(37,99,235,0.75)", color: "#fff", borderBottomRightRadius: 4 }
                    : { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.85)", borderBottomLeftRadius: 4, border: "1px solid rgba(255,255,255,0.06)" }),
                }}>
                  {msg.text}
                </div>
              )}
              {!isSystem && (
                <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "0 2px" }}>
                  <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>
                    {msg.time ? new Date(msg.time).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) : ""}
                  </span>
                  {isMe && <Checks size={10} color="rgba(96,165,250,0.4)" />}
                </div>
              )}
            </motion.div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {ticket.status === "closed" ? (
        <div style={{ padding: "14px 20px", borderTop: "1px solid rgba(255,255,255,0.05)", textAlign: "center", flexShrink: 0 }}>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>Тикет закрыт — переписка недоступна</p>
        </div>
      ) : (
        <form onSubmit={handleSend} style={{
          display: "flex", alignItems: "flex-end", gap: 8, padding: "12px 16px",
          borderTop: "1px solid rgba(255,255,255,0.05)", flexShrink: 0,
        }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(e); } }}
            aria-label="Написать сообщение"
            placeholder="Написать..."
            rows={1}
            style={{
              flex: 1, padding: "11px 14px", borderRadius: 12, fontSize: 13, resize: "none", outline: "none",
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)",
              color: "#fff", caretColor: "#60a5fa", maxHeight: 80,
            }}
            onFocus={e => e.currentTarget.style.borderColor = "rgba(37,99,235,0.35)"}
            onBlur={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"}
          />
          <button type="submit" disabled={!input.trim()} aria-label="Отправить" style={{
            width: 40, height: 40, borderRadius: 12, flexShrink: 0, border: "none",
            background: input.trim() ? "rgba(37,99,235,0.7)" : "rgba(255,255,255,0.05)",
            color: input.trim() ? "#fff" : "rgba(255,255,255,0.4)",
            cursor: input.trim() ? "pointer" : "not-allowed",
            display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.12s",
          }}>
            <PaperPlaneRight size={15} weight="fill" />
          </button>
        </form>
      )}
    </>
  );
}
