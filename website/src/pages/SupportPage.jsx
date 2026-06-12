import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TelegramLogo, Plus } from "@phosphor-icons/react";
import { Send } from "lucide-react";
import { API_URL, WS_URL, getToken } from "../lib/api.js";

const card = { background: "rgba(255,255,255,0.03)", borderRadius: 18, border: "1px solid rgba(255,255,255,0.06)" };
const STATUS_COLORS = { open: "#facc15", answered: "#4ade80", closed: "rgba(255,255,255,0.2)" };
const CATEGORIES = ["Технические проблемы","Вопрос по аккаунту","Вопрос по покупке","Баг / ошибка","Жалоба на игрока","Другое"];

export default function SupportPage({ user }) {
  const [tickets,  setTickets]  = useState([]);
  const [active,   setActive]   = useState(null);
  const [messages, setMessages] = useState([]);
  const [input,    setInput]    = useState("");
  const [view,     setView]     = useState("list");
  const [cat,      setCat]      = useState(CATEGORIES[0]);
  const [desc,     setDesc]     = useState("");
  const wsRef    = useRef(null);
  const bottomRef = useRef(null);

  // Загружаем тикеты пользователя при монтировании
  useEffect(() => {
    if (!user?.id) return;
    fetch(`${API_URL}/support/tickets`)
      .then(r => r.json())
      .then(d => {
        const myTickets = (d.tickets || []).filter(t => t.userId === user.id || t.username === user.username);
        setTickets(myTickets);
      })
      .catch(() => {});
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const socket = new WebSocket(WS_URL);
    wsRef.current = socket;
    socket.onopen = () => {
      socket.send(JSON.stringify({ type: "auth", userId: user.id, username: user.username, token: getToken() }));
    };
    socket.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "ticket_messages") setMessages(msg.messages || []);
        if (msg.type === "message" && active?.id === msg.ticketId)
          setMessages(prev => prev.find(m => m.id === msg.message.id) ? prev : [...prev, msg.message]);
        if (msg.type === "ticket_update") {
          setTickets(prev => prev.map(t => t.id === msg.ticket.id ? { ...t, ...msg.ticket } : t));
          setActive(prev => prev?.id === msg.ticket.id ? { ...prev, ...msg.ticket } : prev);
        }
        if (msg.type === "balance_update" && user)
          user.balance = msg.balance;
      } catch {}
    };
    return () => socket.close();
  }, [user?.id]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const openTicket = (t) => {
    setActive(t);
    setView("chat");
    setMessages([]);
    wsRef.current?.send(JSON.stringify({ type: "subscribe_ticket", ticketId: t.id }));
  };

  const createTicket = async () => {
    if (!desc.trim()) return;
    const res = await fetch(`${API_URL}/support/ticket`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, username: user.username, category: cat, message: desc }),
    });
    const data = await res.json();
    const ticket = { id: data.ticketId, category: cat, preview: desc.slice(0, 50), status: "open", createdAt: Date.now() };
    setTickets(prev => [ticket, ...prev]);
    setDesc(""); setView("list");
  };

  const sendMsg = () => {
    const text = input.trim();
    if (!text || !active) return;
    const msg = { id: Date.now().toString(), from: user.id, username: user.username, role: "user", text, time: Date.now() };
    setMessages(prev => [...prev, msg]);
    wsRef.current?.send(JSON.stringify({ type: "message", ticketId: active.id, text }));
    setInput("");
  };

  return (
    <main style={{ background: "#000", minHeight: "100vh", color: "#fff", fontFamily: "inherit" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 24px 64px" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Поддержка</h1>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>
            Мы отвечаем быстро и по делу. Опиши проблему — поможем и вернёмся с решением.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 16, alignItems: "start" }}>

          {/* SIDEBAR */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

            {/* Telegram card */}
            <motion.a
              initial={{ opacity: 0, x: -14 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35 }}
              href="https://t.me/sbgamescbot" target="_blank" rel="noreferrer"
              style={{
                ...card, padding: "16px 16px", display: "flex", alignItems: "center", gap: 12,
                textDecoration: "none", color: "#fff",
              }}
            >
              <div style={{
                width: 38, height: 38, borderRadius: 9, flexShrink: 0,
                background: "rgba(41,182,246,0.12)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <TelegramLogo size={20} color="#29b6f6" weight="fill" />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>Telegram поддержка</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>Напиши напрямую — быстрый ответ</div>
              </div>
            </motion.a>

            {/* Tickets panel */}
            <motion.div
              initial={{ opacity: 0, x: -14 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35, delay: 0.05 }}
              style={{ ...card, padding: "16px 14px" }}
            >
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.13em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 10 }}>
                Тикеты
              </div>

              <button onClick={() => setView("new")}
                style={{
                  width: "100%", background: "rgba(37,99,235,0.15)", border: "1px solid rgba(37,99,235,0.28)",
                  color: "#93c5fd", borderRadius: 9, padding: "10px 12px",
                  fontWeight: 600, fontSize: 12, cursor: "pointer", marginBottom: 8, textAlign: "left",
                  display: "flex", alignItems: "center", gap: 6,
                }}
              >
                <Plus size={12} /> Новое обращение
              </button>

              {tickets.length === 0 && view !== "new" && (
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", textAlign: "center", padding: "10px 0" }}>
                  Нет тикетов
                </div>
              )}

              {tickets.map(t => (
                <button key={t.id} onClick={() => openTicket(t)}
                  style={{
                    width: "100%", textAlign: "left", cursor: "pointer", borderRadius: 9,
                    padding: "11px 12px", marginBottom: 4,
                    background: active?.id === t.id ? "rgba(255,255,255,0.06)" : "transparent",
                    border: active?.id === t.id ? "1px solid rgba(59,130,246,0.35)" : "1px solid transparent",
                    color: "#fff",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
                    <span style={{ fontWeight: 600, fontSize: 12 }}>{t.category}</span>
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: STATUS_COLORS[t.status] ?? STATUS_COLORS.open, flexShrink: 0 }} />
                  </div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginBottom: 2 }}>{t.preview}</div>
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.15)" }}>#{t.id}</div>
                </button>
              ))}
            </motion.div>
          </div>

          {/* CHAT AREA */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.08 }}
            style={{ ...card, display: "flex", flexDirection: "column", height: 540, overflow: "hidden" }}
          >
            <AnimatePresence mode="wait">

              {/* Empty state */}
              {view === "list" && (
                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}
                >
                  <span style={{ fontSize: 28 }}>💬</span>
                  <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 13 }}>Выберите обращение или создайте новое</span>
                </motion.div>
              )}

              {/* New ticket form */}
              {view === "new" && (
                <motion.div key="new" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  style={{ flex: 1, overflow: "auto", padding: "22px 24px", display: "flex", flexDirection: "column", gap: 14 }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 15, fontWeight: 700 }}>Новое обращение</span>
                    <button onClick={() => setView("list")} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.35)", cursor: "pointer", fontSize: 12 }}>
                      Отмена
                    </button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {CATEGORIES.map(c => (
                      <button key={c} onClick={() => setCat(c)}
                        style={{
                          borderRadius: 9, padding: "9px 11px", textAlign: "left", fontSize: 12, cursor: "pointer",
                          ...(cat === c
                            ? { background: "rgba(37,99,235,0.2)", border: "1px solid rgba(37,99,235,0.4)", color: "#93c5fd" }
                            : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.55)" }),
                        }}
                      >{c}</button>
                    ))}
                  </div>
                  <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={5}
                    placeholder="Опиши проблему подробно..."
                    style={{
                      width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 10, padding: "12px 14px", color: "#fff", fontSize: 13,
                      resize: "none", outline: "none", boxSizing: "border-box",
                    }}
                  />
                  <button onClick={createTicket} disabled={!desc.trim()}
                    style={{
                      background: "#3b82f6", color: "#fff", border: "none", borderRadius: 10,
                      padding: "13px 0", fontWeight: 700, fontSize: 13, cursor: desc.trim() ? "pointer" : "not-allowed",
                      opacity: desc.trim() ? 1 : 0.4, transition: "opacity 0.12s",
                    }}
                  >
                    Отправить заявку
                  </button>
                </motion.div>
              )}

              {/* Chat */}
              {view === "chat" && active && (
                <motion.div key="chat" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}
                >
                  {/* Header */}
                  <div style={{ padding: "16px 22px", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>Обращение #{active.id}</div>
                      {active.status === "answered" && (
                        <span style={{
                          background: "rgba(139,92,246,0.18)", color: "#c4b5fd",
                          fontSize: 10, fontWeight: 700, borderRadius: 20, padding: "3px 10px",
                        }}>Ответ получен</span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 3 }}>
                      Создано {active.createdAt ? new Date(active.createdAt).toLocaleDateString("ru-RU") : active.category}
                    </div>
                  </div>

                  {/* Messages */}
                  <div style={{ flex: 1, overflowY: "auto", padding: "16px 22px", display: "flex", flexDirection: "column", gap: 10, minHeight: 0 }}>
                    {messages.map(msg => {
                      const isMe = msg.from === user?.id || msg.role === "user";
                      if (msg.from === "system") return (
                        <p key={msg.id} style={{ textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.25)" }}>{msg.text}</p>
                      );
                      return (
                        <div key={msg.id} style={{ display: "flex", flexDirection: "column", gap: 3, maxWidth: "74%", alignSelf: isMe ? "flex-end" : "flex-start", alignItems: isMe ? "flex-end" : "flex-start" }}>
                          {!isMe && <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", paddingLeft: 2 }}>{msg.username}</span>}
                          <div style={{
                            padding: "10px 14px", fontSize: 13, lineHeight: 1.5,
                            ...(isMe
                              ? { background: "#2563eb", color: "#fff", borderRadius: "14px 14px 4px 14px" }
                              : { background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.85)", borderRadius: "14px 14px 14px 4px", border: "1px solid rgba(255,255,255,0.06)" }),
                          }}>
                            {msg.text}
                          </div>
                          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", paddingLeft: 2, paddingRight: 2 }}>
                            {new Date(msg.time).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      );
                    })}
                    <div ref={bottomRef} />
                  </div>

                  {/* Input */}
                  {active?.status === "closed" ? (
                    <div style={{ padding: "14px 16px", borderTop: "1px solid rgba(255,255,255,0.06)", flexShrink: 0, textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.25)" }}>
                      Тикет закрыт — переписка недоступна
                    </div>
                  ) : (
                  <form onSubmit={e => { e.preventDefault(); sendMsg(); }}
                    style={{ display: "flex", gap: 8, padding: "12px 16px", borderTop: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}
                  >
                    <input value={input} onChange={e => setInput(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendMsg())}
                      placeholder="Напиши сообщение..."
                      style={{
                        flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 10, padding: "11px 15px", color: "#fff", fontSize: 13, outline: "none",
                      }}
                    />
                    <button type="submit" disabled={!input.trim()}
                      style={{
                        width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                        background: "#3b82f6", border: "none", cursor: input.trim() ? "pointer" : "not-allowed",
                        opacity: input.trim() ? 1 : 0.35, display: "flex", alignItems: "center", justifyContent: "center",
                        transition: "opacity 0.12s",
                      }}
                    >
                      <Send size={16} color="#fff" />
                    </button>
                  </form>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </main>
  );
}
