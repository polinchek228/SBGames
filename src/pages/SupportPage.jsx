import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Headphones, Plus, ChevronDown, Send, CheckCheck,
  ChevronLeft, Shield, Circle, X, MessageSquare,
} from "lucide-react";


import { API_URL, WS_URL } from "../lib/api.js";

const CATEGORIES = [
  "Технические проблемы",
  "Вопрос по аккаунту",
  "Вопрос по покупке",
  "Баг / ошибка в игре",
  "Жалоба на игрока",
  "Другое",
];

const STATUS_LABEL = { open: "Открыт", answered: "Ответили", closed: "Закрыт" };
const STATUS_CL = {
  open:     "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  answered: "text-green-400  bg-green-500/10  border-green-500/20",
  closed:   "text-white/25   bg-white/[0.04]  border-white/[0.07]",
};

function useWS(url, user, onMessage) {
  const ws = useRef(null);
  const [connected, setConnected] = useState(false);

  const connect = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) return;
    const socket = new WebSocket(url);
    ws.current = socket;

    socket.onopen = () => {
      setConnected(true);
      socket.send(JSON.stringify({
        type: "auth",
        userId: user?.id,
        username: user?.username || user?.telegram,
      }));
    };
    socket.onmessage = (e) => { try { onMessage(JSON.parse(e.data)); } catch {} };
    socket.onclose = () => { setConnected(false); setTimeout(connect, 3000); };
    socket.onerror = () => socket.close();
  }, [url, user]);

  useEffect(() => { connect(); return () => ws.current?.close(); }, [connect]);

  const send = useCallback((data) => {
    if (ws.current?.readyState === WebSocket.OPEN) ws.current.send(JSON.stringify(data));
  }, []);

  return { connected, send };
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function SupportPage({ user }) {
  const isAdmin = (user?.username || "").toLowerCase() === "efseea" ||
                  (user?.telegram  || "").toLowerCase() === "efseea";

  if (isAdmin) return <AdminPanel user={user} />;
  return <UserPanel user={user} />;
}

// ═══════════════════════════════════════════════════════════════════════════════
// USER PANEL
// ═══════════════════════════════════════════════════════════════════════════════
function UserPanel({ user }) {
  const [view, setView]     = useState("list");   // "list" | "new" | "chat"
  const [tickets, setTickets] = useState([]);
  const [active, setActive]   = useState(null);   // ticket object
  const [messages, setMessages] = useState([]);

  const handleWS = useCallback((msg) => {
    if (msg.type === "message" && active && msg.ticketId === active.id) {
      setMessages(prev => {
        if (prev.find(m => m.id === msg.message.id)) return prev;
        return [...prev, msg.message];
      });
    }
    if (msg.type === "ticket_messages") setMessages(msg.messages);
    if (msg.type === "ticket_closed" && active?.id === msg.ticketId) {
      setActive(t => ({ ...t, status: "closed" }));
    }
    if (msg.type === "ticket_update") {
      setTickets(prev => prev.map(t => t.id === msg.ticket.id ? { ...t, ...msg.ticket } : t));
    }
  }, [active]);

  const { connected, send } = useWS(WS_URL, user, handleWS);

  const openTicket = (t) => {
    setActive(t);
    setMessages([]);
    setView("chat");
    send({ type: "subscribe_ticket", ticketId: t.id });
  };

  const onCreated = (t) => {
    setTickets(prev => [t, ...prev]);
    openTicket(t);
    setMessages(t.messages);
  };

  const sendMsg = (text) => {
    if (!active) return;
    const msg = { id: Date.now().toString(), from: user?.id || "anon", username: user?.username, role: "user", text, time: Date.now() };
    setMessages(prev => [...prev, msg]);
    send({ type: "message", ticketId: active.id, text });
  };

  return (
    <div className="flex h-full bg-black overflow-hidden">
      {/* Left */}
      <div className="w-[250px] flex-shrink-0 border-r border-white/[0.05] flex flex-col bg-[#080808]">
        <div className="flex items-center justify-between px-4 pt-5 pb-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-600/15 flex items-center justify-center">
              <Headphones size={13} className="text-blue-400" />
            </div>
            <span className="text-[13px] font-bold text-white">Поддержка</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-green-400" : "bg-white/20"}`} />
            <button
              onClick={() => setView("new")}
              className="w-7 h-7 rounded-lg bg-blue-600/20 hover:bg-blue-600/35 text-blue-400 flex items-center justify-center transition-colors"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-3 flex flex-col gap-1">
          {tickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 gap-3 py-16 text-center">
              <MessageSquare size={24} className="text-white/10" />
              <p className="text-[11px] text-white/25">Нет обращений</p>
            </div>
          ) : tickets.map(t => (
            <button
              key={t.id}
              onClick={() => openTicket(t)}
              className={`w-full text-left rounded-xl px-3 py-3 transition-all duration-150 ${
                active?.id === t.id && view === "chat" ? "bg-white/[0.07]" : "hover:bg-white/[0.04]"
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="text-[11px] font-semibold text-white/80 truncate">{t.category}</p>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border flex-shrink-0 ${STATUS_CL[t.status]}`}>
                  {STATUS_LABEL[t.status]}
                </span>
              </div>
              <p className="text-[10px] text-white/30 truncate">{t.preview}</p>
              <p className="text-[9px] text-white/15 mt-1">#{t.id}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Right */}
      <div className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          {view === "list" && (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center h-full gap-4"
            >
              <Headphones size={32} className="text-white/10" />
              <p className="text-white/30 text-[13px]">Выберите обращение или создайте новое</p>
              <button onClick={() => setView("new")}
                className="flex items-center gap-2 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/20 text-blue-400 text-[12px] font-semibold px-5 py-2.5 transition-colors"
              >
                <Plus size={14} />Новое обращение
              </button>
            </motion.div>
          )}
          {view === "new" && (
            <motion.div key="new" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
              className="h-full overflow-y-auto"
            >
              <NewTicketForm user={user} onBack={() => setView("list")} onCreated={onCreated} />
            </motion.div>
          )}
          {view === "chat" && active && (
            <motion.div key={`chat-${active.id}`} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
              className="h-full flex flex-col"
            >
              <ChatView
                ticket={active}
                messages={messages}
                user={user}
                onBack={() => setView("list")}
                onSend={sendMsg}
                isAdmin={false}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN PANEL
// ═══════════════════════════════════════════════════════════════════════════════
function AdminPanel({ user }) {
  const [tickets, setTickets] = useState([]);
  const [active, setActive]   = useState(null);
  const [messages, setMessages] = useState([]);
  const [filter, setFilter]   = useState("open");

  const handleWS = useCallback((msg) => {
    if (msg.type === "admin_ready") {
      fetch(`${API_URL}/support/tickets`)
        .then(r => r.json())
        .then(d => setTickets(d.tickets || []));
    }
    if (msg.type === "new_ticket") {
      setTickets(prev => [msg.ticket, ...prev]);
    }
    if (msg.type === "ticket_update") {
      setTickets(prev => prev.map(t => t.id === msg.ticket.id ? { ...t, ...msg.ticket } : t));
    }
    if (msg.type === "message" && active && msg.ticketId === active.id) {
      setMessages(prev => {
        if (prev.find(m => m.id === msg.message.id)) return prev;
        return [...prev, msg.message];
      });
    }
    if (msg.type === "ticket_messages") setMessages(msg.messages);
  }, [active]);

  const { connected, send } = useWS(WS_URL, user, handleWS);

  const openTicket = (t) => {
    setActive(t);
    setMessages([]);
    send({ type: "read_ticket", ticketId: t.id });
    setTickets(prev => prev.map(x => x.id === t.id ? { ...x, unread: 0 } : x));
  };

  const sendMsg = (text) => {
    if (!active) return;
    const msg = { id: Date.now().toString(), from: user?.id, username: user?.username, role: "admin", text, time: Date.now() };
    setMessages(prev => [...prev, msg]);
    send({ type: "message", ticketId: active.id, text });
  };

  const closeTicket = () => {
    if (!active) return;
    send({ type: "close_ticket", ticketId: active.id });
    setActive(t => ({ ...t, status: "closed" }));
  };

  const filtered = tickets.filter(t =>
    filter === "all" ? true : t.status === filter
  );

  return (
    <div className="flex h-full bg-black overflow-hidden">
      {/* Admin sidebar */}
      <div className="w-[260px] flex-shrink-0 border-r border-white/[0.05] flex flex-col bg-[#080808]">
        <div className="px-4 pt-5 pb-3 flex-shrink-0 border-b border-white/[0.04]">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-purple-600/20 flex items-center justify-center">
              <Shield size={13} className="text-purple-400" />
            </div>
            <span className="text-[13px] font-bold text-white">Админ · Поддержка</span>
            <div className={`ml-auto w-1.5 h-1.5 rounded-full ${connected ? "bg-green-400" : "bg-white/20"}`} />
          </div>
          {/* Filter tabs */}
          <div className="flex gap-1">
            {[["open","Открытые"],["answered","Отвечено"],["all","Все"]].map(([val, label]) => (
              <button key={val} onClick={() => setFilter(val)}
                className={`flex-1 text-[10px] py-1.5 rounded-lg transition-all duration-150 ${
                  filter === val ? "bg-white/[0.1] text-white font-semibold" : "text-white/30 hover:text-white/55"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-2 flex flex-col gap-1">
          {filtered.length === 0 ? (
            <p className="text-[11px] text-white/20 text-center mt-8">Нет тикетов</p>
          ) : filtered.map(t => (
            <button key={t.id} onClick={() => openTicket(t)}
              className={`w-full text-left rounded-xl px-3 py-3 transition-all duration-150 relative ${
                active?.id === t.id ? "bg-white/[0.08]" : "hover:bg-white/[0.04]"
              }`}
            >
              {t.unread > 0 && (
                <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-blue-600 text-[9px] text-white font-bold flex items-center justify-center">
                  {t.unread}
                </span>
              )}
              <div className="flex items-start gap-2 mb-1 pr-5">
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border flex-shrink-0 mt-0.5 ${STATUS_CL[t.status]}`}>
                  {STATUS_LABEL[t.status]}
                </span>
              </div>
              <p className="text-[11px] font-semibold text-white/80 truncate">{t.category}</p>
              <p className="text-[10px] text-white/40 truncate mt-0.5">@{t.username} · #{t.id}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Right */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {active ? (
          <ChatView
            ticket={active}
            messages={messages}
            user={user}
            onBack={() => setActive(null)}
            onSend={sendMsg}
            isAdmin={true}
            onClose={closeTicket}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <Shield size={32} className="text-white/10" />
            <p className="text-white/25 text-[13px]">Выберите тикет для ответа</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Shared chat view ─────────────────────────────────────────────────────────
function ChatView({ ticket, messages, user, onBack, onSend, isAdmin, onClose }) {
  const [input, setInput] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const handleSend = (e) => {
    e.preventDefault();
    const t = input.trim();
    if (!t) return;
    onSend(t);
    setInput("");
  };

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.05] flex-shrink-0">
        <button onClick={onBack}
          className="w-7 h-7 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-white/40 hover:text-white flex items-center justify-center transition-colors"
        >
          <ChevronLeft size={14} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-semibold text-white truncate">{ticket.category}</p>
          <p className="text-[10px] text-white/30 mt-0.5">
            #{ticket.id} · {isAdmin ? `@${ticket.username}` : "Поддержка онлайн"}
          </p>
        </div>
        <span className={`text-[9px] font-bold px-2 py-1 rounded border ${STATUS_CL[ticket.status]}`}>
          {STATUS_LABEL[ticket.status]}
        </span>
        {isAdmin && ticket.status !== "closed" && (
          <button onClick={onClose}
            className="w-7 h-7 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 flex items-center justify-center transition-colors"
            title="Закрыть тикет"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-2.5">
        {messages.map((msg) => {
          const isMe = msg.from === user?.id || msg.role === (isAdmin ? "admin" : "user");
          const isSystem = msg.from === "system";
          return (
            <motion.div key={msg.id}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              className={`flex flex-col max-w-[75%] gap-0.5 ${
                isSystem ? "self-center items-center" : isMe ? "self-end items-end" : "self-start items-start"
              }`}
            >
              {!isMe && !isSystem && (
                <span className="text-[9px] text-white/25 px-1">
                  {msg.role === "admin" ? "🛡 Администратор" : `@${msg.username}`}
                </span>
              )}
              {isSystem ? (
                <div className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06]">
                  <p className="text-[10px] text-white/30">{msg.text}</p>
                </div>
              ) : (
                <div className={`px-3.5 py-2.5 rounded-2xl text-[13px] leading-relaxed ${
                  isMe ? "bg-blue-600 text-white rounded-tr-sm" : "bg-white/[0.07] text-white/80 rounded-tl-sm"
                }`}>
                  {msg.text}
                </div>
              )}
              {!isSystem && (
                <div className="flex items-center gap-1 px-1">
                  <span className="text-[9px] text-white/18">
                    {new Date(msg.time).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  {isMe && <CheckCheck size={10} className="text-blue-400/50" />}
                </div>
              )}
            </motion.div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {ticket.status !== "closed" ? (
        <form onSubmit={handleSend} className="flex items-end gap-2 px-4 py-3 border-t border-white/[0.05] flex-shrink-0">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(e); } }}
            placeholder={isAdmin ? "Ответить пользователю..." : "Написать..."}
            rows={1}
            className="flex-1 rounded-xl bg-white/[0.05] border border-white/[0.08] focus:border-blue-500/30 text-white placeholder-white/20 text-[13px] px-3.5 py-2.5 outline-none resize-none transition-all duration-150"
            style={{ maxHeight: 72 }}
          />
          <button type="submit" disabled={!input.trim()}
            className="w-9 h-9 flex-shrink-0 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-25 disabled:cursor-not-allowed flex items-center justify-center transition-all"
          >
            <Send size={13} className="text-white" />
          </button>
        </form>
      ) : (
        <div className="px-4 py-3 border-t border-white/[0.05] flex-shrink-0">
          <p className="text-[11px] text-white/25 text-center">Тикет закрыт</p>
        </div>
      )}
    </>
  );
}

// ─── New ticket form ──────────────────────────────────────────────────────────
function NewTicketForm({ user, onBack, onCreated }) {
  const [category, setCategory] = useState("");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const dropRef = useRef(null);

  useEffect(() => {
    const h = e => { if (dropRef.current && !dropRef.current.contains(e.target)) setCatOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!category || text.trim().length < 10) return;
    setLoading(true);
    let ticketId = Date.now();
    try {
      const r = await fetch(`${API_URL}/support/ticket`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user?.id, username: user?.username, category, message: text.trim() }),
      });
      const d = await r.json();
      if (d.ticketId) ticketId = d.ticketId;
    } catch {}
    const now = Date.now();
    const ticket = {
      id: ticketId, category, preview: text.trim().slice(0, 60),
      status: "open", username: user?.username,
      createdAt: now,
      messages: [
        { id: "sys", from: "system", text: `Тикет #${ticketId} создан.`, time: now },
        { id: "m1",  from: user?.id, username: user?.username, role: "user", text: text.trim(), time: now },
      ],
    };
    setLoading(false);
    onCreated(ticket);
  };

  return (
    <div className="flex flex-col gap-5 p-6 max-w-[560px]">
      <div className="flex items-center gap-3">
        <button onClick={onBack}
          className="w-7 h-7 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-white/40 hover:text-white flex items-center justify-center transition-colors"
        >
          <ChevronLeft size={14} />
        </button>
        <div>
          <h2 className="text-[15px] font-bold text-white">Новое обращение</h2>
          <p className="text-[11px] text-white/30">Опишите проблему — мы поможем</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="block text-[10px] text-white/30 tracking-widest uppercase mb-2">Тема</label>
          <div className="relative" ref={dropRef}>
            <button type="button" onClick={() => setCatOpen(v => !v)}
              className={`w-full flex items-center justify-between rounded-xl bg-white/[0.04] border px-4 py-3 text-[13px] transition-all ${
                catOpen ? "border-blue-500/40" : "border-white/[0.08] hover:border-white/[0.15]"
              } ${!category ? "text-white/25" : "text-white"}`}
            >
              {category || "Выберите тему..."}
              <ChevronDown size={14} className={`text-white/30 transition-transform ${catOpen ? "rotate-180" : ""}`} />
            </button>
            <AnimatePresence>
              {catOpen && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.12 }}
                  className="absolute top-full mt-1 left-0 right-0 z-20 rounded-xl bg-[#141414] border border-white/[0.08] overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.9)]"
                >
                  {CATEGORIES.map(cat => (
                    <button key={cat} type="button" onClick={() => { setCategory(cat); setCatOpen(false); }}
                      className={`w-full text-left px-4 py-2.5 text-[12px] transition-colors hover:bg-white/[0.06] ${category === cat ? "text-blue-400" : "text-white/55"}`}
                    >
                      {cat}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div>
          <label className="block text-[10px] text-white/30 tracking-widest uppercase mb-2">Описание</label>
          <textarea value={text} onChange={e => setText(e.target.value)}
            placeholder="Подробно опишите проблему..."
            rows={6}
            className="w-full rounded-xl bg-white/[0.04] border border-white/[0.08] focus:border-blue-500/40 text-white placeholder-white/20 text-[13px] px-4 py-3 outline-none resize-none transition-all"
          />
          <p className={`text-[10px] mt-1 text-right ${text.length >= 10 ? "text-white/25" : "text-white/15"}`}>{text.length} симв.</p>
        </div>

        <button type="submit" disabled={!category || text.trim().length < 10 || loading}
          className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-25 disabled:cursor-not-allowed text-white font-bold text-[13px] py-3 transition-all shadow-[0_0_20px_rgba(37,99,235,0.25)]"
        >
          {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Send size={14} />Отправить</>}
        </button>
      </form>
    </div>
  );
}
