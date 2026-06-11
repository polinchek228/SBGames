import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, ChevronLeft, Plus, CheckCheck, X,
  Shield, MessageCircle, CreditCard, Coins,
} from "lucide-react";
import { Headset } from "@phosphor-icons/react";
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
  open:     { label: "Открыт",   color: "#fbbf24", bg: "rgba(251,191,36,0.1)"  },
  answered: { label: "Ответили", color: "#34d399", bg: "rgba(52,211,153,0.1)"  },
  closed:   { label: "Закрыт",   color: "rgba(255,255,255,0.2)", bg: "rgba(255,255,255,0.05)" },
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
        token: getToken(),
      }));
    };
    socket.onmessage = (e) => { try { onMessage(JSON.parse(e.data)); } catch {} };
    socket.onclose   = () => { setConnected(false); setTimeout(connect, 3000); };
    socket.onerror   = () => socket.close();
  }, [url, user]);

  useEffect(() => { connect(); return () => ws.current?.close(); }, [connect]);

  const send = useCallback((data) => {
    if (ws.current?.readyState === WebSocket.OPEN) ws.current.send(JSON.stringify(data));
  }, []);

  return { connected, send };
}

export default function SupportPage({ user }) {
  const isAdmin = user?.role === "admin";
  if (isAdmin) return <AdminPanel user={user} />;
  return <UserPanel user={user} />;
}

// ═══════════════════════════════════════════
// USER PANEL
// ═══════════════════════════════════════════
function UserPanel({ user }) {
  const [view,     setView]     = useState("list");
  const [tickets,  setTickets]  = useState([]);
  const [active,   setActive]   = useState(null);
  const [messages, setMessages] = useState([]);

  const handleWS = useCallback((msg) => {
    if (msg.type === "message" && active && msg.ticketId === active.id) {
      setMessages(prev => prev.find(m => m.id === msg.message.id) ? prev : [...prev, msg.message]);
    }
    if (msg.type === "ticket_messages") setMessages(msg.messages);
    if (msg.type === "ticket_closed" && active?.id === msg.ticketId)
      setActive(t => ({ ...t, status: "closed" }));
    if (msg.type === "ticket_update")
      setTickets(prev => prev.map(t => t.id === msg.ticket.id ? { ...t, ...msg.ticket } : t));
  }, [active]);

  const { connected, send } = useWS(WS_URL, user, handleWS);

  const openTicket = (t) => {
    setActive(t); setMessages([]); setView("chat");
    send({ type: "subscribe_ticket", ticketId: t.id });
  };
  const onCreated = (t) => { setTickets(prev => [t, ...prev]); openTicket(t); setMessages(t.messages); };
  const sendMsg = (text) => {
    if (!active) return;
    const msg = { id: Date.now().toString(), from: user?.id, username: user?.username, role: "user", text, time: Date.now() };
    setMessages(prev => [...prev, msg]);
    send({ type: "message", ticketId: active.id, text });
  };

  return (
    <div className="flex h-full" style={{ background: "#050505" }}>
      {/* Sidebar */}
      <div className="w-[240px] flex-shrink-0 flex flex-col" style={{ borderRight: "1px solid rgba(255,255,255,0.04)" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(37,99,235,0.12)" }}>
              <Headset size={14} weight="fill" style={{ color: "#60a5fa" }} />
            </div>
            <span className="text-[13px] font-bold text-white">Поддержка</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full"
              style={{ background: connected ? "#34d399" : "rgba(255,255,255,0.15)",
                       boxShadow: connected ? "0 0 6px rgba(52,211,153,0.5)" : "none" }}
            />
            <motion.button onClick={() => setView("new")} whileTap={{ scale: 0.9 }}
              className="w-7 h-7 rounded-xl flex items-center justify-center transition-all duration-150"
              style={{ background: "rgba(37,99,235,0.15)", color: "#60a5fa" }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(37,99,235,0.28)"}
              onMouseLeave={e => e.currentTarget.style.background = "rgba(37,99,235,0.15)"}
            >
              <Plus size={14} />
            </motion.button>
          </div>
        </div>

        {/* Ticket list */}
        <div className="flex-1 overflow-y-auto px-2 pb-3 flex flex-col gap-0.5">
          {tickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 gap-3 py-20">
              <MessageCircle size={28} style={{ color: "rgba(255,255,255,0.07)" }} />
              <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.2)" }}>Нет обращений</p>
            </div>
          ) : tickets.map(t => {
            const st = STATUS_META[t.status] || STATUS_META.open;
            const isActive = active?.id === t.id && view === "chat";
            return (
              <motion.button key={t.id} onClick={() => openTicket(t)}
                whileTap={{ scale: 0.98 }}
                className="w-full text-left rounded-2xl px-3 py-2.5 transition-all duration-150"
                style={{ background: isActive ? "rgba(37,99,235,0.1)" : "transparent" }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="text-[11px] font-semibold text-white truncate">{t.category}</p>
                  <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-lg flex-shrink-0"
                    style={{ background: st.bg, color: st.color }}>
                    {st.label}
                  </span>
                </div>
                <p className="text-[10px] truncate" style={{ color: "rgba(255,255,255,0.28)" }}>{t.preview}</p>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          {view === "list" && (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center h-full gap-5"
            >
              <div className="w-16 h-16 rounded-3xl flex items-center justify-center"
                style={{ background: "rgba(37,99,235,0.08)" }}>
                <Headset size={28} weight="fill" style={{ color: "rgba(96,165,250,0.5)" }} />
              </div>
              <div className="text-center">
                <p className="text-[15px] font-semibold text-white">Служба поддержки</p>
                <p className="text-[12px] mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>
                  Создайте обращение — ответим в течение часа
                </p>
              </div>
              <motion.button onClick={() => setView("new")} whileTap={{ scale: 0.96 }}
                className="flex items-center gap-2 rounded-2xl px-5 py-2.5 text-[12px] font-semibold transition-all duration-150"
                style={{ background: "rgba(37,99,235,0.2)", color: "#93c5fd" }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(37,99,235,0.35)"}
                onMouseLeave={e => e.currentTarget.style.background = "rgba(37,99,235,0.2)"}
              >
                <Plus size={14} />Новое обращение
              </motion.button>
            </motion.div>
          )}

          {view === "new" && (
            <motion.div key="new"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="h-full overflow-y-auto"
            >
              <NewTicketForm user={user} onBack={() => setView("list")} onCreated={onCreated} />
            </motion.div>
          )}

          {view === "chat" && active && (
            <motion.div key={`chat-${active.id}`}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="h-full flex flex-col"
            >
              <ChatView ticket={active} messages={messages} user={user}
                onBack={() => setView("list")} onSend={sendMsg} isAdmin={false} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// ADMIN PANEL
// ═══════════════════════════════════════════
function AdminPanel({ user }) {
  const [tickets,  setTickets]  = useState([]);
  const [active,   setActive]   = useState(null);
  const [messages, setMessages] = useState([]);
  const [filter,   setFilter]   = useState("open");

  const handleWS = useCallback((msg) => {
    if (msg.type === "admin_ready") {
      fetch(`${API_URL}/support/tickets`).then(r => r.json()).then(d => setTickets(d.tickets || []));
    }
    if (msg.type === "new_ticket")    setTickets(prev => [msg.ticket, ...prev]);
    if (msg.type === "ticket_update") setTickets(prev => prev.map(t => t.id === msg.ticket.id ? { ...t, ...msg.ticket } : t));
    if (msg.type === "message" && active && msg.ticketId === active.id)
      setMessages(prev => prev.find(m => m.id === msg.message.id) ? prev : [...prev, msg.message]);
    if (msg.type === "ticket_messages") setMessages(msg.messages);
  }, [active]);

  const { connected, send } = useWS(WS_URL, user, handleWS);

  const openTicket = (t) => {
    setActive(t); setMessages([]);
    send({ type: "read_ticket", ticketId: t.id });
    setTickets(prev => prev.map(x => x.id === t.id ? { ...x, unread: 0 } : x));
  };
  const sendMsg = (text) => {
    if (!active) return;
    const msg = { id: Date.now().toString(), from: user?.id, username: user?.username, role: "admin", text, time: Date.now() };
    setMessages(prev => [...prev, msg]);
    send({ type: "message", ticketId: active.id, text });
  };
  const sendRequisites = (text) => {
    if (!active) return;
    const msg = { id: Date.now().toString(), from: user?.id, username: user?.username, role: "admin", text: `💳 Реквизиты:\n${text}`, time: Date.now() };
    setMessages(prev => [...prev, msg]);
    send({ type: "send_requisites", ticketId: active.id, text });
  };
  const confirmPayment = (amount) => {
    if (!active) return;
    send({ type: "confirm_payment", ticketId: active.id, amount });
    const sysMsg = { id: Date.now().toString(), from: "system", text: `Оплата подтверждена. +${amount} СБТ зачислено.`, time: Date.now() };
    setMessages(prev => [...prev, sysMsg]);
    setActive(t => ({ ...t, status: "closed" }));
    setTickets(prev => prev.map(t => t.id === active.id ? { ...t, status: "closed" } : t));
  };
  const closeTicket = () => {
    if (!active) return;
    send({ type: "close_ticket", ticketId: active.id });
    setActive(t => ({ ...t, status: "closed" }));
  };

  const FILTERS = [["open","Открытые"],["answered","Ответили"],["all","Все"]];
  const filtered = tickets.filter(t => filter === "all" ? true : t.status === filter);

  return (
    <div className="flex h-full" style={{ background: "#050505" }}>
      {/* Sidebar */}
      <div className="w-[250px] flex-shrink-0 flex flex-col" style={{ borderRight: "1px solid rgba(255,255,255,0.04)" }}>
        <div className="px-4 py-4 flex-shrink-0">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-7 h-7 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(168,85,247,0.12)" }}>
              <Shield size={13} style={{ color: "#c084fc" }} />
            </div>
            <span className="text-[13px] font-bold text-white">Тикеты</span>
            <div className="ml-auto w-1.5 h-1.5 rounded-full"
              style={{ background: connected ? "#34d399" : "rgba(255,255,255,0.15)",
                       boxShadow: connected ? "0 0 6px rgba(52,211,153,0.5)" : "none" }}
            />
          </div>
          <div className="flex gap-0.5 p-0.5 rounded-xl" style={{ background: "rgba(255,255,255,0.04)" }}>
            {FILTERS.map(([val, label]) => (
              <button key={val} onClick={() => setFilter(val)}
                className="flex-1 text-[10px] py-1.5 rounded-lg transition-all duration-150 font-medium"
                style={filter === val
                  ? { background: "rgba(255,255,255,0.08)", color: "#fff" }
                  : { color: "rgba(255,255,255,0.3)" }}
              >{label}</button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-3 flex flex-col gap-0.5">
          {filtered.length === 0 ? (
            <p className="text-[11px] text-center mt-10" style={{ color: "rgba(255,255,255,0.18)" }}>Нет тикетов</p>
          ) : filtered.map(t => {
            const st = STATUS_META[t.status] || STATUS_META.open;
            return (
              <motion.button key={t.id} onClick={() => openTicket(t)} whileTap={{ scale: 0.98 }}
                className="w-full text-left rounded-2xl px-3 py-2.5 transition-all duration-150 relative"
                style={{ background: active?.id === t.id ? "rgba(37,99,235,0.1)" : "transparent" }}
                onMouseEnter={e => { if (active?.id !== t.id) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                onMouseLeave={e => { if (active?.id !== t.id) e.currentTarget.style.background = "transparent"; }}
              >
                {t.unread > 0 && (
                  <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-blue-600 text-[9px] text-white font-bold flex items-center justify-center">
                    {t.unread}
                  </span>
                )}
                <div className="flex items-center gap-1.5 mb-1 pr-5">
                  <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md"
                    style={{ background: st.bg, color: st.color }}>{st.label}</span>
                </div>
                <p className="text-[11px] font-semibold text-white truncate">{t.category}</p>
                <p className="text-[10px] mt-0.5 truncate" style={{ color: "rgba(255,255,255,0.3)" }}>
                  @{t.username} · #{t.id}
                </p>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Right */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <AnimatePresence mode="wait">
          {active ? (
            <motion.div key={active.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }} className="flex flex-col h-full"
            >
              <ChatView ticket={active} messages={messages} user={user}
                onBack={() => setActive(null)} onSend={sendMsg}
                onSendRequisites={sendRequisites} onConfirmPayment={confirmPayment}
                isAdmin onClose={closeTicket} />
            </motion.div>
          ) : (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center h-full gap-3"
            >
              <Shield size={28} style={{ color: "rgba(255,255,255,0.07)" }} />
              <p className="text-[12px]" style={{ color: "rgba(255,255,255,0.2)" }}>Выберите тикет</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// CHAT VIEW
// ═══════════════════════════════════════════
function ChatView({ ticket, messages, user, onBack, onSend, onSendRequisites, onConfirmPayment, isAdmin, onClose }) {
  const [input,      setInput]      = useState("");
  const [showReq,    setShowReq]    = useState(false);
  const [reqText,    setReqText]    = useState("");
  const [showPay,    setShowPay]    = useState(false);
  const [payAmount,  setPayAmount]  = useState(String(ticket.paymentAmount || ""));
  const [confirmed,  setConfirmed]  = useState(false);
  const bottomRef = useRef(null);
  const st = STATUS_META[ticket.status] || STATUS_META.open;
  const isPayment = ticket.category === "Пополнение баланса";

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const handleSend = (e) => {
    e.preventDefault();
    const t = input.trim(); if (!t) return;
    onSend(t); setInput("");
  };

  const handleSendRequisites = () => {
    if (!reqText.trim()) return;
    onSendRequisites(reqText.trim());
    setReqText(""); setShowReq(false);
  };

  const handleConfirmPayment = () => {
    const amt = parseInt(payAmount, 10);
    if (!amt || amt <= 0) return;
    onConfirmPayment(amt);
    setConfirmed(true); setShowPay(false);
  };

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 flex-shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
      >
        <motion.button onClick={onBack} whileTap={{ scale: 0.9 }}
          className="w-7 h-7 rounded-xl flex items-center justify-center transition-all duration-150 flex-shrink-0"
          style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)" }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.09)"; e.currentTarget.style.color = "#fff"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "rgba(255,255,255,0.4)"; }}
        >
          <ChevronLeft size={14} />
        </motion.button>

        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-white truncate">{ticket.category}</p>
          <p className="text-[10px] mt-0.5 truncate" style={{ color: "rgba(255,255,255,0.28)" }}>
            #{ticket.id} · {isAdmin ? `@${ticket.username}` : "Поддержка"}
            {ticket.tgChatId && isAdmin && <span style={{ color: "rgba(96,165,250,0.6)" }}> · TG</span>}
          </p>
        </div>

        <span className="text-[10px] font-semibold px-2.5 py-1 rounded-xl flex-shrink-0"
          style={{ background: st.bg, color: st.color }}>{st.label}</span>

        {/* Реквизиты — только для payment-тикетов */}
        {isAdmin && isPayment && ticket.status !== "closed" && (
          <motion.button onClick={() => { setShowReq(v => !v); setShowPay(false); }} whileTap={{ scale: 0.9 }}
            className="w-7 h-7 rounded-xl flex items-center justify-center transition-all duration-150 flex-shrink-0"
            style={showReq
              ? { background: "rgba(37,99,235,0.3)", color: "#93c5fd" }
              : { background: "rgba(37,99,235,0.1)", color: "rgba(96,165,250,0.6)" }}
            title="Отправить реквизиты"
          >
            <CreditCard size={13} />
          </motion.button>
        )}

        {/* Выдать — только для payment-тикетов */}
        {isAdmin && isPayment && ticket.status !== "closed" && !confirmed && (
          <motion.button onClick={() => { setShowPay(v => !v); setShowReq(false); }} whileTap={{ scale: 0.9 }}
            className="flex items-center gap-1.5 px-3 h-7 rounded-xl text-[11px] font-semibold transition-all duration-150 flex-shrink-0"
            style={showPay
              ? { background: "rgba(52,211,153,0.25)", color: "#34d399" }
              : { background: "rgba(52,211,153,0.1)", color: "rgba(52,211,153,0.7)" }}
            title="Выдать баланс и закрыть тикет"
          >
            <Coins size={12} />Выдать
          </motion.button>
        )}

        {confirmed && (
          <span className="text-[11px] font-semibold px-3 py-1 rounded-xl flex-shrink-0"
            style={{ background: "rgba(52,211,153,0.12)", color: "#34d399" }}>
            Выдано ✓
          </span>
        )}

        {/* Закрыть */}
        {isAdmin && ticket.status !== "closed" && (
          <motion.button onClick={onClose} whileTap={{ scale: 0.9 }}
            className="w-7 h-7 rounded-xl flex items-center justify-center transition-all duration-150 flex-shrink-0"
            style={{ background: "rgba(239,68,68,0.08)", color: "rgba(252,165,165,0.5)" }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.18)"; e.currentTarget.style.color = "#fca5a5"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(239,68,68,0.08)"; e.currentTarget.style.color = "rgba(252,165,165,0.5)"; }}
            title="Закрыть тикет"
          >
            <X size={13} />
          </motion.button>
        )}
      </div>

      {/* Реквизиты panel */}
      <AnimatePresence>
        {showReq && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }} className="overflow-hidden flex-shrink-0"
          >
            <div className="px-4 py-3 flex flex-col gap-2"
              style={{ background: "rgba(37,99,235,0.06)", borderBottom: "1px solid rgba(37,99,235,0.12)" }}
            >
              <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "rgba(96,165,250,0.6)" }}>
                Реквизиты для оплаты
              </p>
              <textarea
                value={reqText}
                onChange={e => setReqText(e.target.value)}
                placeholder={"Карта: 2200 0000 0000 0000\nБанк: Сбербанк\nПолучатель: Иван И.\n\nСумма: " + (ticket.paymentAmount || "?") + " ₽"}
                rows={4}
                className="w-full rounded-xl text-[12px] px-3 py-2.5 outline-none resize-none"
                style={{ background: "rgba(255,255,255,0.05)", color: "#fff", caretColor: "#60a5fa" }}
              />
              <div className="flex gap-2">
                <motion.button onClick={handleSendRequisites} whileTap={{ scale: 0.96 }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-semibold transition-all duration-150"
                  style={{ background: reqText.trim() ? "rgba(37,99,235,0.3)" : "rgba(255,255,255,0.05)", color: reqText.trim() ? "#93c5fd" : "rgba(255,255,255,0.2)" }}
                >
                  <Send size={11} />Отправить в TG
                </motion.button>
                <button onClick={() => setShowReq(false)}
                  className="px-3 py-2 rounded-xl text-[11px] transition-colors duration-150"
                  style={{ color: "rgba(255,255,255,0.25)" }}
                >Отмена</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Выдать panel */}
      <AnimatePresence>
        {showPay && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }} className="overflow-hidden flex-shrink-0"
          >
            <div className="px-4 py-3 flex items-center gap-3"
              style={{ background: "rgba(52,211,153,0.05)", borderBottom: "1px solid rgba(52,211,153,0.1)" }}
            >
              <p className="text-[11px]" style={{ color: "rgba(52,211,153,0.7)" }}>Зачислить баланс:</p>
              <input
                type="number"
                value={payAmount}
                onChange={e => setPayAmount(e.target.value)}
                placeholder="Сумма СБТ"
                className="w-28 rounded-xl text-[12px] px-3 py-1.5 outline-none"
                style={{ background: "rgba(255,255,255,0.06)", color: "#fff", caretColor: "#34d399" }}
              />
              <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.3)" }}>СБТ</span>
              <motion.button onClick={handleConfirmPayment} whileTap={{ scale: 0.95 }}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-[11px] font-bold transition-all duration-150 ml-auto"
                style={{ background: payAmount ? "rgba(52,211,153,0.2)" : "rgba(255,255,255,0.05)", color: payAmount ? "#34d399" : "rgba(255,255,255,0.2)" }}
              >
                <Coins size={12} />Выдать и закрыть
              </motion.button>
              <button onClick={() => setShowPay(false)}
                className="px-2 py-1.5 rounded-xl text-[11px] transition-colors"
                style={{ color: "rgba(255,255,255,0.25)" }}
              >✕</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-2">
        {messages.map((msg, i) => {
          const isMe     = msg.from === user?.id || msg.role === (isAdmin ? "admin" : "user");
          const isSystem = msg.from === "system";
          const isReq    = msg.text?.startsWith("💳");
          return (
            <motion.div key={msg.id || i}
              initial={{ opacity: 0, y: 8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
              className={`flex flex-col gap-0.5 max-w-[76%] ${
                isSystem ? "self-center items-center" : isMe ? "self-end items-end" : "self-start items-start"
              }`}
            >
              {!isMe && !isSystem && (
                <span className="text-[9px] px-1 mb-0.5" style={{ color: "rgba(255,255,255,0.22)" }}>
                  {msg.role === "admin" ? "Администратор" : `@${msg.username}`}
                </span>
              )}

              {isSystem ? (
                <div className="px-3 py-1.5 rounded-xl" style={{ background: "rgba(255,255,255,0.04)" }}>
                  <p className="text-[10px] whitespace-pre-line" style={{ color: "rgba(255,255,255,0.28)" }}>{msg.text}</p>
                </div>
              ) : isReq ? (
                <div className="px-4 py-3 rounded-2xl" style={{ background: "rgba(37,99,235,0.15)", borderBottomRightRadius: isMe ? 4 : undefined }}>
                  <p className="text-[11px] font-semibold mb-1.5" style={{ color: "#93c5fd" }}>💳 Реквизиты для оплаты</p>
                  <p className="text-[12px] whitespace-pre-line" style={{ color: "rgba(255,255,255,0.8)", fontFamily: "monospace" }}>
                    {msg.text.replace("💳 Реквизиты:\n", "")}
                  </p>
                </div>
              ) : (
                <div className="px-3.5 py-2.5 rounded-2xl text-[13px] leading-relaxed"
                  style={isMe
                    ? { background: "rgba(37,99,235,0.75)", color: "#fff", borderBottomRightRadius: 4 }
                    : { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.85)", borderBottomLeftRadius: 4 }
                  }
                >
                  {msg.text}
                </div>
              )}

              {!isSystem && (
                <div className="flex items-center gap-1 px-1">
                  <span className="text-[9px]" style={{ color: "rgba(255,255,255,0.15)" }}>
                    {new Date(msg.time).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  {isMe && <CheckCheck size={10} style={{ color: "rgba(96,165,250,0.45)" }} />}
                </div>
              )}
            </motion.div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {ticket.status !== "closed" ? (
        <form onSubmit={handleSend}
          className="flex items-end gap-2 px-4 py-3 flex-shrink-0"
          style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
        >
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(e); } }}
            placeholder={isAdmin ? "Ответить..." : "Написать..."}
            rows={1}
            className="flex-1 rounded-2xl text-[13px] px-4 py-2.5 outline-none resize-none transition-all duration-150"
            style={{ background: "rgba(255,255,255,0.05)", color: "#fff", maxHeight: 80, caretColor: "#60a5fa" }}
          />
          <motion.button type="submit" disabled={!input.trim()} whileTap={{ scale: 0.88 }}
            className="w-9 h-9 flex-shrink-0 rounded-2xl flex items-center justify-center transition-all duration-150"
            style={{ background: input.trim() ? "rgba(37,99,235,0.7)" : "rgba(255,255,255,0.05)", color: input.trim() ? "#fff" : "rgba(255,255,255,0.2)" }}
          >
            <Send size={13} />
          </motion.button>
        </form>
      ) : (
        <div className="px-4 py-3 flex-shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
          <p className="text-[11px] text-center" style={{ color: "rgba(255,255,255,0.2)" }}>Тикет закрыт</p>
        </div>
      )}
    </>
  );
}

// ═══════════════════════════════════════════
// NEW TICKET FORM
// ═══════════════════════════════════════════
function NewTicketForm({ user, onBack, onCreated }) {
  const [category, setCategory] = useState("");
  const [text,     setText]     = useState("");
  const [loading,  setLoading]  = useState(false);
  const [catOpen,  setCatOpen]  = useState(false);
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
    onCreated({
      id: ticketId, category, preview: text.trim().slice(0, 60),
      status: "open", username: user?.username, createdAt: now,
      messages: [
        { id: "sys", from: "system", text: `Тикет #${ticketId} создан.`, time: now },
        { id: "m1",  from: user?.id, username: user?.username, role: "user", text: text.trim(), time: now },
      ],
    });
    setLoading(false);
  };

  const canSubmit = category && text.trim().length >= 10 && !loading;

  return (
    <motion.div
      className="flex flex-col gap-5 p-6 max-w-[520px]"
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* Back */}
      <div className="flex items-center gap-3">
        <motion.button onClick={onBack} whileTap={{ scale: 0.9 }}
          className="w-7 h-7 rounded-xl flex items-center justify-center transition-all duration-150"
          style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)" }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.09)"; e.currentTarget.style.color = "#fff"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "rgba(255,255,255,0.4)"; }}
        >
          <ChevronLeft size={14} />
        </motion.button>
        <div>
          <p className="text-[15px] font-bold text-white">Новое обращение</p>
          <p className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.28)" }}>Опишите проблему — ответим быстро</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Category */}
        <div>
          <p className="text-[10px] uppercase tracking-widest font-semibold mb-2"
            style={{ color: "rgba(255,255,255,0.18)" }}>Тема</p>
          <div className="relative" ref={dropRef}>
            <button type="button" onClick={() => setCatOpen(v => !v)}
              className="w-full flex items-center justify-between rounded-2xl px-4 py-3 text-[13px] transition-all duration-150"
              style={{
                background: "rgba(255,255,255,0.04)",
                color: category ? "#fff" : "rgba(255,255,255,0.25)",
                outline: catOpen ? "1px solid rgba(37,99,235,0.4)" : "1px solid transparent",
              }}
            >
              {category || "Выберите тему..."}
              <motion.span animate={{ rotate: catOpen ? 180 : 0 }} transition={{ duration: 0.15 }}
                style={{ color: "rgba(255,255,255,0.3)", display: "flex" }}
              >
                <ChevronLeft size={14} style={{ transform: "rotate(-90deg)" }} />
              </motion.span>
            </button>
            <AnimatePresence>
              {catOpen && (
                <motion.div initial={{ opacity: 0, y: -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full mt-1.5 left-0 right-0 z-20 rounded-2xl overflow-hidden"
                  style={{ background: "#0e0e0e", boxShadow: "0 16px 48px rgba(0,0,0,0.8)" }}
                >
                  {CATEGORIES.map(cat => (
                    <button key={cat} type="button" onClick={() => { setCategory(cat); setCatOpen(false); }}
                      className="w-full text-left px-4 py-2.5 text-[12px] transition-colors duration-100"
                      style={{ color: category === cat ? "#93c5fd" : "rgba(255,255,255,0.5)" }}
                      onMouseEnter={e => { if (category !== cat) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    >
                      {cat}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Description */}
        <div>
          <p className="text-[10px] uppercase tracking-widest font-semibold mb-2"
            style={{ color: "rgba(255,255,255,0.18)" }}>Описание</p>
          <textarea value={text} onChange={e => setText(e.target.value)}
            placeholder="Подробно опишите проблему..."
            rows={6}
            className="w-full rounded-2xl text-[13px] px-4 py-3 outline-none resize-none transition-all duration-150"
            style={{
              background: "rgba(255,255,255,0.04)",
              color: "#fff",
              caretColor: "#60a5fa",
            }}
          />
          <p className="text-[10px] mt-1 text-right"
            style={{ color: text.length >= 10 ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.1)" }}>
            {text.length} симв.
          </p>
        </div>

        <motion.button type="submit" disabled={!canSubmit} whileTap={{ scale: canSubmit ? 0.97 : 1 }}
          className="flex items-center justify-center gap-2 rounded-2xl py-3 text-[13px] font-semibold transition-all duration-200"
          style={{
            background: canSubmit ? "rgba(37,99,235,0.22)" : "rgba(255,255,255,0.04)",
            color: canSubmit ? "#93c5fd" : "rgba(255,255,255,0.18)",
          }}
          onMouseEnter={e => { if (canSubmit) e.currentTarget.style.background = "rgba(37,99,235,0.38)"; }}
          onMouseLeave={e => { if (canSubmit) e.currentTarget.style.background = "rgba(37,99,235,0.22)"; }}
        >
          {loading
            ? <div className="w-4 h-4 border-2 border-white/20 border-t-blue-400 rounded-full animate-spin" />
            : <><Send size={13} />Отправить</>
          }
        </motion.button>
      </form>
    </motion.div>
  );
}
