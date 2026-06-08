import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Loader2, CheckCircle2, XCircle, AtSign } from "lucide-react";
import Titlebar from "../components/Titlebar.jsx";

const API_URL = "http://94.26.83.31:3000";
const BOT_USERNAME = "sbgamessupport_bot";

// step: "tg" → пользователь логинится через TG Widget
//       "nick" → ввод игрового ника
//       "success" → успех
export default function LoginPage({ onLogin }) {
  const [step, setStep] = useState("tg");
  const [tgUser, setTgUser] = useState(null);  // данные от TG Widget
  const [nick, setNick] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const widgetRef = useRef(null);

  // Монтируем Telegram Login Widget
  useEffect(() => {
    if (step !== "tg" || !widgetRef.current) return;
    widgetRef.current.innerHTML = "";

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.setAttribute("data-telegram-login", BOT_USERNAME);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "12");
    script.setAttribute("data-auth-url", "");       // не редирект
    script.setAttribute("data-request-access", "write");
    script.setAttribute("data-userpic", "false");
    script.async = true;

    // Telegram вызовет window.onTelegramAuth
    window.onTelegramAuth = (user) => {
      setTgUser(user);
      setStep("nick");
    };
    script.setAttribute("data-onauth", "onTelegramAuth(user)");

    widgetRef.current.appendChild(script);
    return () => { delete window.onTelegramAuth; };
  }, [step]);

  const handleNickSubmit = async (e) => {
    e.preventDefault();
    const clean = nick.trim().replace(/^@/, "");
    if (!clean) return;
    if (!/^[a-zA-Z0-9_]{3,16}$/.test(clean)) {
      setError("Ник: 3–16 символов, только буквы/цифры/подчёркивание");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/tg-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tgUser, username: clean }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Ошибка сервера");
      setStep("success");
      setTimeout(() => onLogin(data.user), 900);
    } catch (err) {
      setError(err.message || "Не удалось подключиться к серверу");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-black overflow-hidden">
      <Titlebar />

      {/* Ambient glow */}
      <div className="flex-1 relative flex items-center justify-center">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] rounded-full bg-blue-600 opacity-[0.035] blur-[120px]" />
          <div className="absolute bottom-0 left-1/3 w-[300px] h-[200px] rounded-full bg-blue-500 opacity-[0.03] blur-[80px]" />
        </div>

        <AnimatePresence mode="wait">
          {step === "tg" && (
            <motion.div
              key="tg"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16, scale: 0.97 }}
              transition={{ duration: 0.35 }}
              className="relative z-10 w-[420px] mx-auto px-4"
            >
              <div className="rounded-2xl border border-white/[0.07] bg-[#0a0a0a] p-9 shadow-[0_8px_60px_rgba(0,0,0,0.9)]">
                {/* Logo */}
                <div className="flex flex-col items-center mb-8">
                  <div className="w-[72px] h-[72px] rounded-2xl overflow-hidden mb-5 shadow-[0_0_30px_rgba(37,99,235,0.2)]">
                    <img src="/logo.jpg" alt="SB Games" className="w-full h-full object-cover" />
                  </div>
                  <h1 className="text-[22px] font-display font-black tracking-tight text-white">SB GAMES</h1>
                  <p className="text-[11px] text-white/30 mt-1 tracking-[0.15em] uppercase">Launcher</p>
                </div>

                <div className="mb-6 text-center">
                  <p className="text-[13px] text-white/60 leading-relaxed">
                    Войдите через Telegram — это безопасно и занимает секунду
                  </p>
                </div>

                {/* TG Widget container */}
                <div
                  ref={widgetRef}
                  className="flex justify-center mb-4 min-h-[48px] items-center"
                />

                {/* Dev bypass */}
                <div className="flex justify-center mt-3">
                  <button
                    onClick={() => {
                      setTgUser({ id: 99999, first_name: "Dev", username: "devuser" });
                      setStep("nick");
                    }}
                    className="text-[10px] text-white/15 hover:text-white/30 transition-colors"
                  >
                    войти без TG (dev)
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {step === "nick" && (
            <motion.div
              key="nick"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16, scale: 0.97 }}
              transition={{ duration: 0.35 }}
              className="relative z-10 w-[420px] mx-auto px-4"
            >
              <div className="rounded-2xl border border-white/[0.07] bg-[#0a0a0a] p-9 shadow-[0_8px_60px_rgba(0,0,0,0.9)]">
                {/* Logo */}
                <div className="flex flex-col items-center mb-7">
                  <div className="w-[72px] h-[72px] rounded-2xl overflow-hidden mb-5 shadow-[0_0_30px_rgba(37,99,235,0.2)]">
                    <img src="/logo.jpg" alt="SB Games" className="w-full h-full object-cover" />
                  </div>
                  <h1 className="text-[22px] font-display font-black tracking-tight text-white">SB GAMES</h1>
                  <p className="text-[11px] text-white/30 mt-1 tracking-[0.15em] uppercase">Launcher</p>
                </div>

                {/* TG user confirmed */}
                {tgUser && (
                  <div className="flex items-center gap-3 rounded-xl bg-white/[0.03] border border-white/[0.06] px-4 py-3 mb-6">
                    <div className="w-7 h-7 rounded-lg bg-blue-600/20 flex items-center justify-center flex-shrink-0">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <path d="M22 2L11 13" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] text-white/80 font-medium truncate">
                        {tgUser.first_name}{tgUser.last_name ? ` ${tgUser.last_name}` : ""}
                        {tgUser.username && <span className="text-blue-400 ml-1">@{tgUser.username}</span>}
                      </p>
                      <p className="text-[10px] text-white/30">Telegram подтверждён</p>
                    </div>
                    <div className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
                  </div>
                )}

                <form onSubmit={handleNickSubmit} className="space-y-3">
                  <div>
                    <label className="block text-[11px] text-white/40 mb-2 tracking-wider uppercase">
                      Игровой ник
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/25">
                        <AtSign size={14} />
                      </span>
                      <input
                        type="text"
                        value={nick}
                        onChange={(e) => { setNick(e.target.value); setError(""); }}
                        placeholder="Ваш ник в игре"
                        maxLength={16}
                        autoFocus
                        className="w-full rounded-xl bg-white/[0.04] border border-white/[0.08] focus:border-blue-500/60 focus:bg-white/[0.06] text-white placeholder-white/20 text-[13px] py-3 pl-9 pr-4 outline-none transition-all duration-200"
                        autoComplete="off"
                        spellCheck={false}
                      />
                    </div>
                    <p className="text-[10px] text-white/20 mt-1.5 pl-1">
                      3–16 символов · буквы, цифры, _
                    </p>
                  </div>

                  <AnimatePresence>
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center gap-2 text-red-400/90 text-[12px] px-1"
                      >
                        <XCircle size={13} /> {error}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <button
                    type="submit"
                    disabled={loading || nick.trim().length < 3}
                    className="w-full rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold text-[13px] tracking-wider py-3 flex items-center justify-center gap-2 transition-all duration-200 shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)]"
                  >
                    {loading ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <>ВОЙТИ В СИСТЕМУ <ArrowRight size={15} /></>
                    )}
                  </button>
                </form>

                <button
                  onClick={() => { setStep("tg"); setTgUser(null); setNick(""); setError(""); }}
                  className="w-full mt-3 text-[11px] text-white/20 hover:text-white/40 transition-colors text-center"
                >
                  ← Назад
                </button>
              </div>
            </motion.div>
          )}

          {step === "success" && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative z-10 flex flex-col items-center gap-4"
            >
              <div className="w-20 h-20 rounded-3xl overflow-hidden shadow-[0_0_40px_rgba(34,197,94,0.3)]">
                <img src="/logo.jpg" alt="logo" className="w-full h-full object-cover" />
              </div>
              <CheckCircle2 size={36} className="text-green-400" />
              <p className="text-white font-bold text-lg">Добро пожаловать!</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
