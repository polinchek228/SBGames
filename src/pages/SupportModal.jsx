import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronDown, Send, Headphones, CheckCheck, Clock } from "lucide-react";

import { API_URL } from "../lib/api.js";

const CATEGORIES = [
  "Выберите тему...",
  "Технические проблемы",
  "Вопрос по аккаунту",
  "Вопрос по покупке",
  "Баг / ошибка в игре",
  "Жалоба на игрока",
  "Другое",
];

// step: "form" → "chat"
export default function SupportModal({ user, onClose }) {
  const [step, setStep] = useState("form");
  const [ticketId, setTicketId] = useState(null);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <motion.div
        className="relative z-10 w-[520px] max-h-[85vh] flex flex-col rounded-2xl bg-[#0c0c0c] border border-white/[0.08] shadow-[0_24px_80px_rgba(0,0,0,0.9)] overflow-hidden"
        initial={{ scale: 0.94, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.94, y: 20 }}
        transition={{ type: "spring", damping: 28, stiffness: 320 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600/15 flex items-center justify-center">
              <Headphones size={15} className="text-blue-400" />
            </div>
            <div>
              <p className="text-[13px] font-bold text-white">Поддержка</p>
              <p className="text-[10px] text-white/30">
                {step === "form" ? "Опишите вашу проблему" : `Тикет #${ticketId}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg text-white/30 hover:text-white hover:bg-white/[0.06] flex items-center justify-center transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <AnimatePresence mode="wait">
          {step === "form" ? (
            <TicketForm
              key="form"
              user={user}
              onSubmit={(id) => { setTicketId(id); setStep("chat"); }}
            />
          ) : (
            <SupportChat
              key="chat"
              ticketId={ticketId}
              user={user}
            />
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

// ─── Ticket creation form ─────────────────────────────────────────────────────
function TicketForm({ user, onSubmit }) {
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const dropRef = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (dropRef.current && !dropRef.current.contains(e.target)) setCatOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const canSubmit = category !== CATEGORIES[0] && text.trim().length >= 10;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/support/ticket`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user?.id || "dev",
          username: user?.username || "Player",
          category,
          message: text.trim(),
        }),
      });
      const data = await res.json();
      onSubmit(data.ticketId || Math.floor(Math.random() * 9000 + 1000));
    } catch {
      // Fallback: dev mode без сервера
      onSubmit(Math.floor(Math.random() * 9000 + 1000));
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.form
      onSubmit={handleSubmit}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col gap-4 p-5 overflow-y-auto"
    >
      {/* Category dropdown */}
      <div>
        <label className="block text-[10px] text-white/30 tracking-widest uppercase mb-2">Тема обращения</label>
        <div className="relative" ref={dropRef}>
          <button
            type="button"
            onClick={() => setCatOpen(v => !v)}
            className={`w-full flex items-center justify-between rounded-xl bg-white/[0.04] border px-4 py-3 text-[13px] transition-all duration-150 ${
              catOpen ? "border-blue-500/40" : "border-white/[0.08] hover:border-white/[0.15]"
            } ${category === CATEGORIES[0] ? "text-white/25" : "text-white"}`}
          >
            {category}
            <ChevronDown size={14} className={`text-white/30 transition-transform duration-200 ${catOpen ? "rotate-180" : ""}`} />
          </button>

          <AnimatePresence>
            {catOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
                className="absolute top-full mt-1.5 left-0 right-0 z-20 rounded-xl bg-[#141414] border border-white/[0.08] overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.8)]"
              >
                {CATEGORIES.slice(1).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => { setCategory(cat); setCatOpen(false); }}
                    className={`w-full text-left px-4 py-2.5 text-[12px] transition-colors hover:bg-white/[0.06] ${
                      category === cat ? "text-blue-400" : "text-white/60"
                    }`}
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
        <label className="block text-[10px] text-white/30 tracking-widest uppercase mb-2">Описание проблемы</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Опишите проблему подробно..."
          rows={5}
          className="w-full rounded-xl bg-white/[0.04] border border-white/[0.08] focus:border-blue-500/40 text-white placeholder-white/20 text-[13px] px-4 py-3 outline-none resize-none transition-all duration-150"
        />
        <p className={`text-[10px] mt-1.5 text-right transition-colors ${text.length >= 10 ? "text-white/25" : "text-white/15"}`}>
          {text.length} / минимум 10 символов
        </p>
      </div>

      <button
        type="submit"
        disabled={!canSubmit || loading}
        className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold text-[13px] py-3 transition-all duration-200 shadow-[0_0_20px_rgba(37,99,235,0.3)]"
      >
        {loading
          ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          : <><Send size={14} />Отправить заявку</>
        }
      </button>
    </motion.form>
  );
}

// ─── Support Chat ─────────────────────────────────────────────────────────────
function SupportChat({ ticketId, user }) {
  const [messages, setMessages] = useState([
    {
      id: 1,
      from: "support",
      text: `Здравствуйте! Ваша заявка #${ticketId} принята. Администратор скоро ответит — обычно это занимает до 10 минут.`,
      time: new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
      read: true,
    },
  ]);
  const [input, setInput] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Mock admin reply after first user message
  const mockAdminReply = (userMsg) => {
    const replies = [
      "Понял вас. Дайте мне секунду, проверю вашу ситуацию.",
      "Спасибо за подробное описание! Сейчас разберёмся.",
      "Принял к рассмотрению. Уточните — на каком сервере это произошло?",
    ];
    const reply = replies[Math.floor(Math.random() * replies.length)];
    setTimeout(() => {
      setMessages(prev => [...prev, {
        id: Date.now(),
        from: "support",
        text: reply,
        time: new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
        read: false,
      }]);
    }, 1500 + Math.random() * 1500);
  };

  const handleSend = (e) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    const msg = {
      id: Date.now(),
      from: "user",
      text: trimmed,
      time: new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
      read: true,
    };
    setMessages(prev => [...prev, msg]);
    setInput("");
    if (messages.filter(m => m.from === "user").length === 0) {
      mockAdminReply(trimmed);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col flex-1 overflow-hidden"
    >
      {/* Status bar */}
      <div className="px-5 py-2.5 border-b border-white/[0.05] flex items-center gap-2 flex-shrink-0">
        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        <span className="text-[11px] text-white/40">Администратор онлайн · Тикет #{ticketId}</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex flex-col gap-1 max-w-[80%] ${msg.from === "user" ? "self-end items-end" : "self-start items-start"}`}
          >
            {msg.from === "support" && (
              <span className="text-[9px] text-white/25 px-1">Поддержка</span>
            )}
            <div
              className={`px-3.5 py-2.5 rounded-2xl text-[13px] leading-relaxed ${
                msg.from === "user"
                  ? "bg-blue-600 text-white rounded-tr-sm"
                  : "bg-white/[0.07] text-white/80 rounded-tl-sm"
              }`}
            >
              {msg.text}
            </div>
            <div className="flex items-center gap-1 px-1">
              <span className="text-[9px] text-white/20">{msg.time}</span>
              {msg.from === "user" && <CheckCheck size={10} className="text-blue-400/60" />}
            </div>
          </motion.div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSend}
        className="flex items-end gap-2 px-4 py-3 border-t border-white/[0.05] flex-shrink-0"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(e); } }}
          placeholder="Написать сообщение..."
          rows={1}
          className="flex-1 rounded-xl bg-white/[0.05] border border-white/[0.08] focus:border-blue-500/30 text-white placeholder-white/20 text-[13px] px-3.5 py-2.5 outline-none resize-none transition-all duration-150"
          style={{ maxHeight: 80, overflowY: "auto" }}
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="w-9 h-9 flex-shrink-0 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-all duration-150"
        >
          <Send size={14} className="text-white" />
        </button>
      </form>
    </motion.div>
  );
}
