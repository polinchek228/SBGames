import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TelegramLogo, PaperPlaneTilt, Plus } from "@phosphor-icons/react";
import { Send } from "lucide-react";
import { API_URL, WS_URL, getToken } from "../lib/api.js";

const CATEGORIES = ["Технические проблемы","Вопрос по аккаунту","Вопрос по покупке","Баг / ошибка","Жалоба на игрока","Другое"];
const STATUS_COLORS = { open: "#facc15", answered: "#4ade80", closed: "rgba(255,255,255,0.2)" };

export default function SupportPage({ user }) {
  const [tickets,  setTickets]  = useState([]);
  const [active,   setActive]   = useState(null);
  const [messages, setMessages] = useState([]);
  const [input,    setInput]    = useState("");
  const [view,     setView]     = useState("list"); // list | new | chat
  const [cat,      setCat]      = useState(CATEGORIES[0]);
  const [desc,     setDesc]     = useState("");
  const wsRef   = useRef(null);
  const bottomRef = useRef(null);

  // Simple WS connect
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
        if (msg.type === "message" && active?.id === msg.ticketId) {
          setMessages(prev => prev.find(m => m.id === msg.message.id) ? prev : [...prev, msg.message]);
        }
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
    const ticket = { id: data.ticketId, category: cat, preview: desc.slice(0, 50), status: "open" };
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
    <main className="relative z-10 max-w-5xl mx-auto px-4 pb-16">
      <div className="text-center mb-8">
        <h1 className="text-[28px] font-black text-white mb-2">Поддержка</h1>
        <p className="text-[13px]" style={{ color: "rgba(255,255,255,0.4)" }}>
          Мы отвечаем быстро и по делу. Опиши проблему — поможем и вернёмся с решением.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Left: sidebar */}
        <div className="flex flex-col gap-3">
          <a href="https://t.me/sbgamessupport_bot" target="_blank" rel="noreferrer"
            className="rounded-2xl p-4 flex items-center gap-3 transition-colors"
            style={{ background: "rgba(44,165,224,0.1)", border: "1px solid rgba(44,165,224,0.2)" }}
          >
            <TelegramLogo size={20} style={{ color: "#2CA5E0" }} />
            <div>
              <p className="text-[13px] font-semibold text-white">Telegram поддержка</p>
              <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.4)" }}>Напиши напрямую — быстрый ответ.</p>
            </div>
          </a>

          <button onClick={() => setView("new")}
            className="flex items-center gap-2 rounded-xl py-2.5 px-4 text-[12px] font-semibold text-white transition-colors"
            style={{ background: "rgba(37,99,235,0.2)", border: "1px solid rgba(37,99,235,0.3)" }}
          >
            <Plus size={14} /> Новое обращение
          </button>

          {tickets.map(t => (
            <button key={t.id} onClick={() => openTicket(t)}
              className="rounded-2xl p-4 text-left transition-colors"
              style={{
                background: active?.id === t.id ? "rgba(255,255,255,0.07)" : "rgba(12,12,12,0.95)",
                border: "1px solid rgba(255,255,255,0.07)"
              }}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="text-[12px] font-semibold text-white/80 truncate">{t.category}</p>
                <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1" style={{ background: STATUS_COLORS[t.status] }} />
              </div>
              <p className="text-[10px] truncate" style={{ color: "rgba(255,255,255,0.3)" }}>{t.preview}</p>
              <p className="text-[9px] mt-1" style={{ color: "rgba(255,255,255,0.15)" }}>#{t.id}</p>
            </button>
          ))}
        </div>

        {/* Right: chat / new form */}
        <div className="col-span-2 rounded-2xl overflow-hidden flex flex-col"
          style={{ background: "rgba(12,12,12,0.95)", border: "1px solid rgba(255,255,255,0.07)", minHeight: 400 }}
        >
          <AnimatePresence mode="wait">
            {view === "list" && (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center flex-1 gap-4 p-8 h-full"
              >
                <p className="text-[28px]">💬</p>
                <p className="text-white/40 text-[14px]">Выберите обращение или создайте новое</p>
              </motion.div>
            )}

            {view === "new" && (
              <motion.div key="new" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex flex-col gap-4 p-6"
              >
                <div className="flex items-center justify-between">
                  <p className="text-[15px] font-bold text-white">Новое обращение</p>
                  <button onClick={() => setView("list")} className="text-white/30 hover:text-white/60 text-[11px]">Отмена</button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORIES.map(c => (
                    <button key={c} onClick={() => setCat(c)}
                      className="rounded-xl px-3 py-2 text-left text-[12px] transition-all"
                      style={cat === c
                        ? { background: "rgba(37,99,235,0.2)", border: "1px solid rgba(37,99,235,0.4)", color: "#93c5fd" }
                        : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.55)" }
                      }
                    >{c}</button>
                  ))}
                </div>
                <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={5}
                  placeholder="Опиши проблему подробно..."
                  className="w-full rounded-xl px-4 py-3 text-[13px] resize-none"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", color: "#fff" }}
                />
                <button onClick={createTicket} disabled={!desc.trim()}
                  className="py-3 rounded-xl font-bold text-[13px] text-white disabled:opacity-30 transition-colors bg-blue-600 hover:bg-blue-500"
                >
                  Отправить заявку
                </button>
              </motion.div>
            )}

            {view === "chat" && active && (
              <motion.div key="chat" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex flex-col h-full"
              >
                <div className="px-5 py-4 flex items-center justify-between"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <div>
                    <p className="text-[14px] font-bold text-white">Обращение #{active.id}</p>
                    <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.3)" }}>{active.category}</p>
                  </div>
                  <button onClick={() => setView("list")} className="text-[11px]" style={{ color: "rgba(255,255,255,0.3)" }}>← Назад</button>
                </div>
                <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3" style={{ minHeight: 0 }}>
                  {messages.map(msg => {
                    const isMe = msg.from === user.id || msg.role === "user";
                    if (msg.from === "system") return (
                      <p key={msg.id} className="text-center text-[11px]" style={{ color: "rgba(255,255,255,0.25)" }}>{msg.text}</p>
                    );
                    return (
                      <div key={msg.id} className={`flex flex-col gap-1 max-w-[75%] ${isMe ? "self-end items-end" : "self-start items-start"}`}>
                        {!isMe && <span className="text-[9px] px-1" style={{ color: "rgba(255,255,255,0.3)" }}>{msg.username}</span>}
                        <div className="px-4 py-2.5 rounded-2xl text-[13px] leading-relaxed"
                          style={isMe
                            ? { background: "#2563EB", color: "#fff", borderBottomRightRadius: 4 }
                            : { background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.85)", borderBottomLeftRadius: 4 }
                          }
                        >{msg.text}</div>
                        <span className="text-[9px] px-1" style={{ color: "rgba(255,255,255,0.2)" }}>
                          {new Date(msg.time).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    );
                  })}
                  <div ref={bottomRef} />
                </div>
                <form onSubmit={e => { e.preventDefault(); sendMsg(); }}
                  className="flex items-end gap-2 px-4 py-3"
                  style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <input value={input} onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendMsg())}
                    placeholder="Напиши сообщение..."
                    className="flex-1 rounded-xl px-4 py-2.5 text-[13px]"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff" }}
                  />
                  <button type="submit" disabled={!input.trim()}
                    className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-600 hover:bg-blue-500 disabled:opacity-30 transition-colors"
                  >
                    <Send size={14} className="text-white" />
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </main>
  );
}
