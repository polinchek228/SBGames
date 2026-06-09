import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Loader2, CheckCircle2 } from "lucide-react";
import { TelegramLogo } from "@phosphor-icons/react";
import { API_URL } from "../lib/api.js";

export default function LoginPage({ onLogin }) {
  const [step,    setStep]    = useState("start");
  const [code,    setCode]    = useState(null);
  const [tgUser,  setTgUser]  = useState(null);
  const [nick,    setNick]    = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const pollRef = React.useRef(null);

  const handleStart = async () => {
    setLoading(true);
    setError("");
    try {
      const res  = await fetch(`${API_URL}/auth/create-code`, { method: "POST" });
      const data = await res.json();
      setCode(data.code);
      setStep("waiting");
      window.open(`https://t.me/sbgamessupport_bot?start=auth_${data.code}`, "_blank");
    } catch {
      setError("Не удалось подключиться к серверу");
    } finally {
      setLoading(false);
    }
  };

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

  const handleNick = async (e) => {
    e.preventDefault();
    const clean = nick.trim().replace(/^@/, "");
    if (!/^[a-zA-Z0-9_]{3,16}$/.test(clean)) { setError("Ник: 3–16 символов, только буквы/цифры/_"); return; }
    setLoading(true); setError("");
    try {
      const res  = await fetch(`${API_URL}/auth/tg-login`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tgUser, username: clean }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setStep("success");
      setTimeout(() => onLogin(data.user, data.token), 800);
    } catch (err) {
      setError(err.message);
    } finally { setLoading(false); }
  };

  return (
    <main className="relative z-10 flex items-center justify-center min-h-[80vh] px-4">
      <div className="w-full max-w-[380px]">
        <div className="rounded-2xl p-8 flex flex-col gap-6"
          style={{ background: "rgba(10,10,10,0.97)", boxShadow: "0 8px 60px rgba(0,0,0,0.8)" }}
        >
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl overflow-hidden">
              <img src="/logo.jpg" alt="" className="w-full h-full object-cover" />
            </div>
            <div className="text-center">
              <p className="text-[20px] font-black text-white">SB GAMES</p>
              <p className="text-[11px] tracking-[0.15em] uppercase mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>Вход в аккаунт</p>
            </div>
          </div>

          {step === "start" && (
            <>
              <p className="text-[13px] text-center" style={{ color: "rgba(255,255,255,0.45)" }}>
                Войдите через Telegram — откроется бот, нажмите <strong className="text-white/70">СТАРТ</strong>
              </p>
              <button onClick={handleStart} disabled={loading}
                className="flex items-center justify-center gap-3 py-3 rounded-xl font-bold text-[14px] disabled:opacity-50 transition-all"
                style={{ background: "#2CA5E0", color: "#fff" }}
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <TelegramLogo size={20} weight="fill" />}
                Войти через Telegram
              </button>
              {error && <p className="text-[11px] text-red-400 text-center">{error}</p>}
            </>
          )}

          {step === "waiting" && (
            <div className="flex flex-col items-center gap-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ background: "rgba(44,165,224,0.1)", border: "1px solid rgba(44,165,224,0.2)" }}
              >
                <TelegramLogo size={28} weight="fill" style={{ color: "#2CA5E0" }} />
              </div>
              <div className="text-center">
                <p className="font-bold text-white">Открой Telegram</p>
                <p className="text-[12px] mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>
                  Нажми <strong className="text-white/70">СТАРТ</strong> в боте <span className="text-blue-400">@sbgamessupport_bot</span>
                </p>
              </div>
              <div className="flex items-center gap-2 w-full rounded-xl px-4 py-3"
                style={{ background: "rgba(255,255,255,0.04)" }}
              >
                <Loader2 size={14} className="animate-spin text-white/30" />
                <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.35)" }}>Ожидаем подтверждение...</span>
              </div>
              <button onClick={() => { clearInterval(pollRef.current); setStep("start"); setCode(null); }}
                className="text-[11px]" style={{ color: "rgba(255,255,255,0.2)" }}
              >Отмена</button>
            </div>
          )}

          {step === "nick" && (
            <form onSubmit={handleNick} className="flex flex-col gap-3">
              <p className="text-[14px] font-bold text-white">Привет, {tgUser?.first_name}!</p>
              <p className="text-[12px]" style={{ color: "rgba(255,255,255,0.4)" }}>Придумай игровой ник</p>
              <input value={nick} onChange={e => { setNick(e.target.value); setError(""); }}
                placeholder="Твой ник (3–16 символов)" autoFocus
                className="w-full rounded-xl px-4 py-3 text-[14px]"
                style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${error ? "rgba(239,68,68,0.5)" : "rgba(255,255,255,0.09)"}`, color: "#fff" }}
              />
              {error && <p className="text-[11px] text-red-400">{error}</p>}
              <button type="submit" disabled={loading || !nick.trim()}
                className="py-3 rounded-xl font-bold text-[13px] disabled:opacity-30 text-white bg-blue-600 hover:bg-blue-500 transition-colors"
              >
                {loading ? "Загрузка..." : "Войти →"}
              </button>
            </form>
          )}

          {step === "success" && (
            <div className="flex flex-col items-center gap-3">
              <CheckCircle2 size={40} className="text-green-400" />
              <p className="font-bold text-white">Добро пожаловать!</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
