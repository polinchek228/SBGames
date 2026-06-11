import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, CheckCircle2, QrCode, Link2, Zap } from "lucide-react";
import { TelegramLogo } from "@phosphor-icons/react";
import QRCodeLib from "qrcode";
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

// QR код компонент
function QRCodeComponent({ value, size = 240 }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    if (canvasRef.current && value) {
      QRCodeLib.toCanvas(canvasRef.current, value, { width: size });
    }
  }, [value, size]);
  return <canvas ref={canvasRef} />;
}

export default function LoginPage({ onLogin }) {
  const [step,     setStep]    = useState("method"); // method | qr | code_waiting | nick | success
  const [method,   setMethod]  = useState(null); // "qr" | "code" | "widget"
  const [code,     setCode]    = useState(null);
  const [tgUser,   setTgUser]  = useState(null);
  const [nick,     setNick]    = useState("");
  const [loading,  setLoading] = useState(false);
  const [error,    setError]   = useState("");
  const pollRef = useRef(null);

  // QR код метод
  const handleQRAuth = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/auth/create-code`, { method: "POST" });
      const data = await res.json();
      setCode(data.code);
      setMethod("qr");
      setStep("qr");
      setLoading(false);
      startPolling(data.code);
    } catch {
      setError("Ошибка подключения");
      setLoading(false);
    }
  };

  // Код метод (текущий)
  const handleCodeAuth = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/auth/create-code`, { method: "POST" });
      const data = await res.json();
      setCode(data.code);
      setMethod("code");
      setStep("code_waiting");
      setLoading(false);
      await openURL(`https://t.me/sbgamescbot?start=auth_${data.code}`);
      startPolling(data.code);
    } catch {
      setError("Ошибка подключения");
      setLoading(false);
    }
  };

  // Widget метод (для будущего)
  const handleWidgetAuth = async () => {
    setLoading(true);
    setMethod("widget");
    setStep("widget");
    setLoading(false);
  };

  const startPolling = (authCode) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res  = await fetch(`${API_URL}/auth/check-code?code=${authCode}`);
        const data = await res.json();
        if (data.confirmed && data.tgUser) {
          clearInterval(pollRef.current);
          setTgUser(data.tgUser);
          setStep("nick");
        }
      } catch {}
    }, 2000);
  };

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

          {/* ── Шаг 1: выбор метода входа ── */}
          {step === "method" && (
            <motion.div key="method"
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
              className="relative z-10 w-[420px] mx-auto px-4"
            >
              <div className="rounded-2xl bg-[#0a0a0a] p-8 flex flex-col items-center gap-8"
                style={{ border: "1px solid rgba(255,255,255,0.07)", boxShadow: "0 8px 60px rgba(0,0,0,0.9)" }}
              >
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-[0_0_30px_rgba(37,99,235,0.2)]">
                    <img src="/logo.jpg" alt="SB Games" className="w-full h-full object-cover" />
                  </div>
                  <div className="text-center">
                    <h1 className="text-[22px] font-display font-black tracking-tight text-white">SB GAMES</h1>
                    <p className="text-[11px] text-white/30 mt-1 tracking-[0.15em] uppercase">Launcher</p>
                  </div>
                  <p className="text-[13px] text-white/45 text-center mt-2">Выбери способ входа через Telegram</p>
                </div>

                <div className="w-full flex flex-col gap-3">
                  {/* QR код */}
                  <motion.button onClick={handleQRAuth} disabled={loading}
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    className="w-full p-4 rounded-xl flex items-center gap-4 transition-all disabled:opacity-50"
                    style={{ background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.3)" }}
                  >
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "rgba(59,130,246,0.2)" }}>
                      <QrCode size={20} className="text-blue-400" />
                    </div>
                    <div className="text-left flex-1">
                      <p className="text-[14px] font-semibold text-white">QR код</p>
                      <p className="text-[11px] text-white/40">Быстро через камеру</p>
                    </div>
                    <Zap size={16} className="text-yellow-400" />
                  </motion.button>

                  {/* Telegram ссылка */}
                  <motion.button onClick={handleCodeAuth} disabled={loading}
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    className="w-full p-4 rounded-xl flex items-center gap-4 transition-all disabled:opacity-50"
                    style={{ background: "rgba(44,165,224,0.1)", border: "1px solid rgba(44,165,224,0.3)" }}
                  >
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "rgba(44,165,224,0.2)" }}>
                      <Link2 size={20} style={{ color: "#2CA5E0" }} />
                    </div>
                    <div className="text-left flex-1">
                      <p className="text-[14px] font-semibold text-white">Telegram</p>
                      <p className="text-[11px] text-white/40">Открыть бота с кодом</p>
                    </div>
                    <TelegramLogo size={16} weight="fill" style={{ color: "#2CA5E0" }} />
                  </motion.button>
                </div>

                {error && <p className="text-[11px] text-red-400">{error}</p>}
              </div>
            </motion.div>
          )}

          {/* ── QR код экран ── */}
          {step === "qr" && (
            <motion.div key="qr"
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
              className="relative z-10 w-[420px] mx-auto px-4"
            >
              <div className="rounded-2xl bg-[#0a0a0a] p-8 flex flex-col items-center gap-6"
                style={{ border: "1px solid rgba(255,255,255,0.07)", boxShadow: "0 8px 60px rgba(0,0,0,0.9)" }}
              >
                <div className="text-center">
                  <p className="text-[15px] font-bold text-white">Сканируй QR код</p>
                  <p className="text-[12px] text-white/40 mt-2">Открой Telegram и отправь фото</p>
                </div>

                {code && (
                  <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                    <QRCodeComponent value={`https://t.me/sbgamescbot?start=auth_${code}`} size={240} />
                  </div>
                )}

                <div className="flex items-center gap-3 w-full rounded-xl px-4 py-3"
                  style={{ background: "rgba(255,255,255,0.04)" }}
                >
                  <Loader2 size={14} className="animate-spin text-white/30 flex-shrink-0" />
                  <span className="text-[11px] text-white/35">Ожидаем подтверждение...</span>
                </div>

                <button onClick={() => { clearInterval(pollRef.current); setStep("method"); setCode(null); }}
                  className="text-[11px] text-white/20 hover:text-white/40 transition-colors"
                >
                  Назад
                </button>
              </div>
            </motion.div>
          )}

          {/* ── Telegram код экран ── */}
          {step === "code_waiting" && (
            <motion.div key="code_waiting"
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
                    <span className="text-blue-400">@sbgamescbot</span>
                  </p>
                </div>
                <div className="flex items-center gap-3 w-full rounded-xl px-4 py-3"
                  style={{ background: "rgba(255,255,255,0.04)" }}
                >
                  <Loader2 size={14} className="animate-spin text-white/30 flex-shrink-0" />
                  <span className="text-[11px] text-white/35">Ожидаем подтверждение...</span>
                </div>
                <button onClick={() => { clearInterval(pollRef.current); setStep("method"); setCode(null); }}
                  className="text-[11px] text-white/20 hover:text-white/40 transition-colors"
                >
                  Назад
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
