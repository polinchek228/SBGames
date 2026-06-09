import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, CheckCircle2 } from "lucide-react";
import { TelegramLogo } from "@phosphor-icons/react";
import Titlebar from "../components/Titlebar.jsx";
import { API_URL } from "../lib/api.js";

async function openURL(url) {
  try {
    // Tauri v2: opener plugin через invoke
    if (window.__TAURI_INTERNALS__) {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("plugin:opener|open_url", { url }).catch(() => {
        // fallback — shell:open
        invoke("plugin:shell|open", { path: url }).catch(() => {});
      });
      return;
    }
  } catch {}
  // Browser fallback
  window.open(url, "_blank");
}

export default function LoginPage({ onLogin }) {
  const [step,    setStep]    = useState("start"); // start | waiting | nick | success
  const [code,    setCode]    = useState(null);
  const [tgUser,  setTgUser]  = useState(null);
  const [nick,    setNick]    = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const pollRef = useRef(null);

  // Генерируем код и начинаем поллинг
  const handleStartAuth = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/create-code`, { method: "POST" });
      const data = await res.json();
      setCode(data.code);
      setLoading(false);
      setStep("waiting");
      // Открываем бота с кодом
      await openURL(`https://t.me/sbgamessupport_bot?start=auth_${data.code}`);
    } catch {
      setError("Не удалось подключиться к серверу");
      setLoading(false);
    }
  };

  // Поллинг — ждём пока бот подтвердит
  useEffect(() => {
    if (step !== "waiting" || !code) return;
    pollRef.current = setInterval(async () => {
      try {
        const res  = await fetch(`${API_URL}/auth/check-code?code=${code}`);
        const data = await res.json();
        if (data.confirmed && data.tgUser) {
          clearInterval(pollRef.current);
          setTgUser(data.tgUser);
          setStep("nick");
        }
      } catch {}
    }, 2000);
    return () => clearInterval(pollRef.current);
  }, [step, code]);

  const handleNickSubmit = async (e) => {
    e.preventDefault();
    const clean = nick.trim().replace(/^@/, "");
    if (!clean) return;
    if (!/^[a-zA-Z0-9_]{3,16}$/.test(clean)) {
      setError("Ник: 3–16 символов, только буквы/цифры/_");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res  = await fetch(`${API_URL}/auth/tg-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tgUser, username: clean }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Ошибка");
      setStep("success");
      setTimeout(() => onLogin(data.user), 900);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-black overflow-hidden">
      <Titlebar />
      <div className="flex-1 relative flex items-center justify-center">
        {/* Ambient */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full bg-blue-600 opacity-[0.04] blur-[100px]" />
        </div>

        <AnimatePresence mode="wait">

          {/* ── Шаг 1: кнопка входа ── */}
          {step === "start" && (
            <motion.div key="start"
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
              className="relative z-10 w-[380px] mx-auto px-4"
            >
              <div className="rounded-2xl bg-[#0a0a0a] p-8 flex flex-col items-center gap-6"
                style={{ border: "1px solid rgba(255,255,255,0.07)", boxShadow: "0 8px 60px rgba(0,0,0,0.9)" }}
              >
                <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-[0_0_30px_rgba(37,99,235,0.2)]">
                  <img src="/logo.jpg" alt="SB Games" className="w-full h-full object-cover" />
                </div>
                <div className="text-center">
                  <h1 className="text-[22px] font-display font-black tracking-tight text-white">SB GAMES</h1>
                  <p className="text-[11px] text-white/30 mt-1 tracking-[0.15em] uppercase">Launcher</p>
                </div>
                <p className="text-[13px] text-white/45 text-center leading-relaxed">
                  Войди через Telegram — откроется бот, нажми <strong className="text-white/70">СТАРТ</strong>
                </p>
                <button onClick={handleStartAuth} disabled={loading}
                  className="w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl font-bold text-[14px] transition-all duration-200 disabled:opacity-50"
                  style={{ background: "#2CA5E0", color: "#fff", boxShadow: "0 0 24px rgba(44,165,224,0.3)" }}
                >
                  {loading
                    ? <Loader2 size={18} className="animate-spin" />
                    : <TelegramLogo size={20} weight="fill" />
                  }
                  Войти через Telegram
                </button>
                {error && <p className="text-[11px] text-red-400">{error}</p>}
              </div>
            </motion.div>
          )}

          {/* ── Шаг 2: ожидание подтверждения ── */}
          {step === "waiting" && (
            <motion.div key="waiting"
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
              className="relative z-10 w-[380px] mx-auto px-4"
            >
              <div className="rounded-2xl bg-[#0a0a0a] p-8 flex flex-col items-center gap-6"
                style={{ border: "1px solid rgba(255,255,255,0.07)", boxShadow: "0 8px 60px rgba(0,0,0,0.9)" }}
              >
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                  style={{ background: "rgba(44,165,224,0.1)", border: "1px solid rgba(44,165,224,0.2)" }}
                >
                  <TelegramLogo size={32} weight="fill" style={{ color: "#2CA5E0" }} />
                </div>
                <div className="text-center">
                  <p className="text-[15px] font-bold text-white">Открой Telegram</p>
                  <p className="text-[12px] text-white/40 mt-2 leading-relaxed">
                    Нажми <span className="text-white/70 font-semibold">СТАРТ</span> в боте<br/>
                    <span className="text-blue-400">@sbgamessupport_bot</span>
                  </p>
                </div>
                <div className="flex items-center gap-3 w-full rounded-xl px-4 py-3"
                  style={{ background: "rgba(255,255,255,0.04)" }}
                >
                  <Loader2 size={14} className="animate-spin text-white/30 flex-shrink-0" />
                  <span className="text-[11px] text-white/35">Ожидаем подтверждение...</span>
                </div>
                <button onClick={() => { clearInterval(pollRef.current); setStep("start"); setCode(null); }}
                  className="text-[11px] text-white/20 hover:text-white/40 transition-colors"
                >
                  Отмена
                </button>
              </div>
            </motion.div>
          )}

          {/* ── Шаг 3: ввод ника ── */}
          {step === "nick" && (
            <motion.div key="nick"
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
              className="relative z-10 w-[380px] mx-auto px-4"
            >
              <div className="rounded-2xl bg-[#0a0a0a] p-8 flex flex-col gap-5"
                style={{ border: "1px solid rgba(255,255,255,0.07)", boxShadow: "0 8px 60px rgba(0,0,0,0.9)" }}
              >
                <div className="flex flex-col items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl overflow-hidden">
                    <img src="/logo.jpg" alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="text-center">
                    <p className="text-[16px] font-black text-white">Привет, {tgUser?.first_name}!</p>
                    <p className="text-[12px] text-white/35 mt-1">Придумай игровой ник</p>
                  </div>
                </div>

                <form onSubmit={handleNickSubmit} className="flex flex-col gap-3">
                  <input
                    value={nick}
                    onChange={e => { setNick(e.target.value); setError(""); }}
                    placeholder="Твой ник (3–16 символов)"
                    autoFocus
                    className="w-full rounded-xl px-4 py-3 text-[14px] outline-none transition-all"
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      border: error ? "1px solid rgba(239,68,68,0.5)" : "1px solid rgba(255,255,255,0.09)",
                      color: "#fff",
                      caretColor: "#fff",
                    }}
                  />
                  {error && <p className="text-[11px] text-red-400 px-1">{error}</p>}
                  <button type="submit" disabled={loading || !nick.trim()}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-[13px] transition-all disabled:opacity-30"
                    style={{ background: "#2563EB", color: "#fff" }}
                  >
                    {loading ? <Loader2 size={16} className="animate-spin" /> : "Войти →"}
                  </button>
                </form>
              </div>
            </motion.div>
          )}

          {/* ── Шаг 4: успех ── */}
          {step === "success" && (
            <motion.div key="success"
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-4"
            >
              <CheckCircle2 size={48} className="text-green-400" />
              <p className="text-[16px] font-bold text-white">Добро пожаловать!</p>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
