import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, CheckCircle2 } from "lucide-react";
import { TelegramLogo, GoogleLogo, Gift } from "@phosphor-icons/react";
import QRCodeLib from "qrcode";
import Titlebar from "../components/Titlebar.jsx";
import { API_URL } from "../lib/api.js";

async function openURL(url) {
  try {
    if (window.__TAURI_INTERNALS__) {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("plugin:opener|open_url", { url }).catch(() => {
        invoke("plugin:shell|open", { path: url }).catch(() => {});
      });
      return;
    }
  } catch {}
  window.open(url, "_blank");
}

function QRCodeComponent({ value, size = 180 }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    if (canvasRef.current && value) {
      QRCodeLib.toCanvas(canvasRef.current, value, {
        width: size,
        margin: 2,
        color: { dark: "#000000", light: "#ffffff" },
      });
    }
  }, [value, size]);
  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      style={{ display: "block", borderRadius: 8 }}
    />
  );
}

const PILL_STYLE = {
  background: "rgba(18,18,18,0.95)",
  border: "1px solid rgba(255,255,255,0.08)",
  boxShadow: "0 4px 24px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)",
  backdropFilter: "blur(20px)",
};

export default function LoginPage({ onLogin }) {
  const [step, setStep] = useState("auth");
  const [activeMethod, setActiveMethod] = useState("qr");
  const [code, setCode] = useState(null);
  const [tgUser, setTgUser] = useState(null);
  const [googleState, setGoogleState] = useState(null);
  const [nick, setNick] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const pollRef = useRef(null);
  const referralCodeRef = useRef(new URLSearchParams(window.location.search).get("ref") || null);
  const [referralInput, setReferralInput] = useState(referralCodeRef.current || "");

  const stopPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);
  };

  const tryAutoLogin = async (tgUser, retries = 3) => {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const res = await fetch(`${API_URL}/auth/tg-login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tgUser }),
        });
        if (res.status === 429) {
          await new Promise(r => setTimeout(r, 2000));
          continue;
        }
        const data = await res.json().catch(() => ({}));
        // Успешный автологин — аккаунт уже существует
        if (data.user && data.token) {
          setStep("success");
          setTimeout(() => onLogin(data), 700);
          return true;
        }
        // Новый пользователь: сервер просит ник (needNick) ИЛИ вернул 400.
        // В обоих случаях показываем форму ника, а не зацикливаемся молча.
        if (data.needNick || res.status === 400) {
          setTgUser(tgUser);
          setLoading(false);
          setStep("nick");
          return false;
        }
      } catch {}
      await new Promise(r => setTimeout(r, 1000));
    }
    // Все попытки исчерпаны — не оставляем пустой экран, ведём на форму ника
    setTgUser(tgUser);
    setLoading(false);
    setStep("nick");
    return false;
  };

  const startPolling = (authCode) => {
    stopPolling();
    if (!authCode) return; // не поллим пока код не получен
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}/auth/check-code?code=${authCode}`);
        if (res.status === 429) return; // ждём, не спамим
        const data = await res.json();
        if (data.confirmed && data.tgUser) {
          clearInterval(pollRef.current);
          // Пробуем автологин — если ник уже сохранён, не спрашиваем повторно
          await tryAutoLogin(data.tgUser);
        }
      } catch {}
    }, 2500);
  };

  const handleQRAuth = async () => {
    stopPolling();
    setCode(null);
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/auth/create-code`, { method: "POST" });
      if (res.status === 429) {
        setError("Слишком часто — подожди минуту");
        setLoading(false);
        return;
      }
      const data = await res.json();
      setCode(data.code);
      setLoading(false);
      startPolling(data.code);
    } catch (e) {
      const msg = (e && e.message) ? e.message : String(e);
      setError("ERR:" + msg);
      setLoading(false);
    }
  };

  const handleCodeAuth = async () => {
    stopPolling();
    setCode(null);
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/auth/create-code`, { method: "POST" });
      const data = await res.json();
      setCode(data.code);
      setLoading(false);
      await openURL(`https://t.me/sbgamescbot?start=auth_${data.code}`);
      startPolling(data.code);
    } catch (e) {
      const msg = (e && e.message) ? e.message : String(e);
      setError("ERR:" + msg);
      setLoading(false);
    }
  };

  const handleMethodSwitch = (m) => {
    if (m === activeMethod) return;
    setActiveMethod(m);
    setCode(null);
    setError("");
    stopPolling();
    if (m === "qr") handleQRAuth();
    else if (m === "bot") handleCodeAuth();
    else if (m === "google") handleGoogleAuth();
  };

  const startGooglePolling = (state) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}/auth/google/check?state=${state}`);
        const data = await res.json();
        if (data.status === "done" && data.token) {
          clearInterval(pollRef.current);
          setStep("success");
          setTimeout(() => onLogin({ user: data.user, token: data.token }), 700);
        } else if (data.status === "need_nick") {
          clearInterval(pollRef.current);
          setGoogleState(state);
          setStep("google-nick");
        } else if (data.status === "expired") {
          clearInterval(pollRef.current);
          setError("Ссылка устарела, попробуй снова");
        }
      } catch {}
    }, 2000);
  };

  const handleGoogleAuth = async () => {
    stopPolling();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/auth/google/init`);
      const data = await res.json();
      setGoogleState(data.state);
      setLoading(false);
      await openURL(data.url);
      startGooglePolling(data.state);
    } catch (e) {
      const msg = (e && e.message) ? e.message : String(e);
      setError("ERR:" + msg);
      setLoading(false);
    }
  };

  // Auto-init on mount
  useEffect(() => {
    handleQRAuth();
    return () => stopPolling();
  }, []);

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
      const res = await fetch(`${API_URL}/auth/tg-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tgUser, username: clean, referralCode: referralInput || referralCodeRef.current }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Ошибка");
      setStep("success");
      setTimeout(() => onLogin(data), 900);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleNickSubmit = async (e) => {
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
      const res = await fetch(`${API_URL}/auth/google/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: googleState, username: clean, referralCode: referralInput || referralCodeRef.current }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Ошибка");
      setStep("success");
      setTimeout(() => onLogin(data), 900);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      className="w-full h-full flex flex-col bg-black overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      <Titlebar />

      <div className="flex-1 flex items-center justify-center">
        <AnimatePresence mode="wait">

          {step === "auth" && (
            <motion.div
              key="auth"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col items-center gap-5"
            >
              {/* Header pill */}
              <div
                className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl"
                style={PILL_STYLE}
              >
                <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0">
                  <img src="/logo.jpg" alt="SB Games" className="w-full h-full object-cover" />
                </div>
                <div className="flex flex-col leading-tight">
                  <span className="text-[13px] font-bold text-white tracking-wide">SB GAMES</span>
                  <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>
                    Вход через @sbgamescbot
                  </span>
                </div>

                <div
                  className="w-px h-6 mx-1 flex-shrink-0"
                  style={{ background: "rgba(255,255,255,0.08)" }}
                />

                {/* Referral banner when ?ref= in URL */}
                {referralCodeRef.current && (
                  <div
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
                    style={{
                      background: "rgba(16,185,129,0.12)",
                      border: "1px solid rgba(16,185,129,0.2)",
                    }}
                  >
                    <Gift size={12} style={{ color: "#6ee7b7" }} />
                    <span className="text-[11px] font-medium" style={{ color: "#6ee7b7" }}>
                      Реферальная ссылка
                    </span>
                  </div>
                )}

                {/* Method tabs */}
                {[
                  { id: "qr", label: "QR-код" },
                  { id: "bot", label: "Открыть бот" },
                  { id: "google", label: "Google" },
                ].map(({ id, label }) => {
                  const active = activeMethod === id;
                  return (
                    <button
                      key={id}
                      onClick={() => handleMethodSwitch(id)}
                      className="relative px-3 py-1.5 rounded-xl text-[11px] font-medium tracking-wide transition-all duration-150 whitespace-nowrap"
                      style={active
                        ? { color: "#fff", background: "rgba(255,255,255,0.1)" }
                        : { color: "rgba(255,255,255,0.35)" }
                      }
                      onMouseEnter={e => { if (!active) e.currentTarget.style.color = "rgba(255,255,255,0.65)"; }}
                      onMouseLeave={e => { if (!active) e.currentTarget.style.color = "rgba(255,255,255,0.35)"; }}
                    >
                      {active && (
                        <motion.div
                          layoutId="method-active"
                          className="absolute inset-0 rounded-xl"
                          style={{ background: "rgba(255,255,255,0.07)" }}
                          transition={{ type: "spring", stiffness: 400, damping: 35 }}
                        />
                      )}
                      <span className="relative z-10">{label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Content area */}
              <AnimatePresence mode="wait">
                {activeMethod === "qr" && (
                  <motion.div
                    key="qr-content"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.15 }}
                    className="flex flex-col items-center gap-4"
                  >
                    {loading && !code ? (
                      <div className="w-[180px] h-[180px] flex items-center justify-center">
                        <Loader2 size={24} className="animate-spin" style={{ color: "rgba(255,255,255,0.25)" }} />
                      </div>
                    ) : code ? (
                      <div
                        className="p-3 rounded-2xl"
                        style={{
                          background: "rgba(18,18,18,0.95)",
                          border: "1px solid rgba(255,255,255,0.08)",
                        }}
                      >
                        <QRCodeComponent
                          value={`https://t.me/sbgamescbot?start=auth_${code}`}
                          size={180}
                        />
                      </div>
                    ) : null}

                    {code && (
                      <div className="text-center">
                        <p className="text-[12px] font-semibold" style={{ color: "rgba(255,255,255,0.7)" }}>
                          Подтвердите вход в <span style={{ color: "#2CA5E0" }}>@Sbgamescbot</span>
                        </p>
                        <p className="text-[11px] mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>
                          Отсканируйте QR-код камерой телефона
                        </p>
                      </div>
                    )}

                    <div
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl"
                      style={PILL_STYLE}
                    >
                      <Loader2 size={12} className="animate-spin flex-shrink-0" style={{ color: "rgba(255,255,255,0.3)" }} />
                      <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.35)" }}>
                        Ожидаем подтверждение...
                      </span>
                    </div>
                  </motion.div>
                )}

                {activeMethod === "bot" && (
                  <motion.div
                    key="bot-content"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.15 }}
                    className="flex flex-col items-center gap-4"
                  >
                    <div
                      className="flex flex-col items-center gap-3 px-8 py-6 rounded-2xl"
                      style={PILL_STYLE}
                    >
                      <TelegramLogo size={36} weight="fill" style={{ color: "#2CA5E0" }} />
                      <div className="text-center">
                        <p className="text-[13px] font-semibold text-white">Telegram открыт</p>
                        <p className="text-[11px] mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>
                          Нажмите <span style={{ color: "rgba(255,255,255,0.7)" }}>СТАРТ</span> в боте{" "}
                          <span style={{ color: "#2CA5E0" }}>@sbgamescbot</span>
                        </p>
                      </div>
                    </div>

                    <div
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl"
                      style={PILL_STYLE}
                    >
                      <Loader2 size={12} className="animate-spin flex-shrink-0" style={{ color: "rgba(255,255,255,0.3)" }} />
                      <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.35)" }}>
                        Ожидаем подтверждение...
                      </span>
                    </div>
                  </motion.div>
                )}

                {activeMethod === "google" && (
                  <motion.div
                    key="google-content"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.15 }}
                    className="flex flex-col items-center gap-4"
                  >
                    {loading ? (
                      <div className="w-[180px] h-[120px] flex items-center justify-center">
                        <Loader2 size={24} className="animate-spin" style={{ color: "rgba(255,255,255,0.25)" }} />
                      </div>
                    ) : (
                      <div
                        className="flex flex-col items-center gap-3 px-8 py-6 rounded-2xl"
                        style={PILL_STYLE}
                      >
                        <GoogleLogo size={36} weight="bold" style={{ color: "#fff" }} />
                        <div className="text-center">
                          <p className="text-[13px] font-semibold text-white">Google открыт</p>
                          <p className="text-[11px] mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>
                            Войди в аккаунт Google в браузере
                          </p>
                        </div>
                      </div>
                    )}
                    {googleState && !loading && (
                      <div
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl"
                        style={PILL_STYLE}
                      >
                        <Loader2 size={12} className="animate-spin flex-shrink-0" style={{ color: "rgba(255,255,255,0.3)" }} />
                        <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.35)" }}>
                          Ожидаем подтверждение...
                        </span>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-[11px] px-4 py-2 rounded-xl"
                  style={{ color: "rgba(239,68,68,0.9)", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)" }}
                >
                  {error}
                </motion.p>
              )}
            </motion.div>
          )}

          {step === "nick" && (
            <motion.div
              key="nick"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col items-center gap-5"
            >
              {/* Header pill */}
              <div
                className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl"
                style={PILL_STYLE}
              >
                <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0">
                  <img src="/logo.jpg" alt="SB Games" className="w-full h-full object-cover" />
                </div>
                <div className="flex flex-col leading-tight">
                  <span className="text-[13px] font-bold text-white tracking-wide">SB GAMES</span>
                  <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>
                    Привет, {tgUser?.first_name}!
                  </span>
                </div>
              </div>

              {/* Nick form */}
              <form
                onSubmit={handleNickSubmit}
                className="flex flex-col gap-3 w-[280px]"
              >
                <p className="text-[12px] text-center" style={{ color: "rgba(255,255,255,0.35)" }}>
                  Придумай игровой ник
                </p>

                <input
                  value={nick}
                  onChange={(e) => { setNick(e.target.value); setError(""); }}
                  placeholder="Ник (3–16 символов)"
                  autoFocus
                  autoCapitalize="none"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  className="w-full rounded-xl px-4 py-2.5 text-[13px] outline-none transition-all"
                  style={{
                    background: "rgba(18,18,18,0.95)",
                    border: error ? "1px solid rgba(239,68,68,0.4)" : "1px solid rgba(255,255,255,0.08)",
                    color: "#fff",
                    caretColor: "#60a5fa",
                    backdropFilter: "blur(20px)",
                  }}
                />

                <div className="relative">
                  <Gift size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "rgba(255,255,255,0.25)" }} />
                  <input
                    value={referralInput}
                    onChange={(e) => setReferralInput(e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase())}
                    placeholder="Реферальный код (необязательно)"
                    maxLength={8}
                    autoCapitalize="characters"
                    autoComplete="off"
                    className="w-full rounded-xl pl-9 pr-4 py-2.5 text-[13px] outline-none transition-all"
                    style={{
                      background: "rgba(18,18,18,0.95)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      color: "rgba(255,255,255,0.5)",
                      caretColor: "#60a5fa",
                      backdropFilter: "blur(20px)",
                    }}
                  />
                </div>

                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -2 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-[11px] px-1"
                    style={{ color: "rgba(239,68,68,0.9)" }}
                  >
                    {error}
                  </motion.p>
                )}

                <button
                  type="submit"
                  disabled={loading || !nick.trim()}
                  className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-xl text-[11px] font-medium tracking-wide transition-all duration-150 disabled:opacity-40"
                  style={{ color: "#fff", background: "rgba(37,99,235,0.7)", border: "1px solid rgba(37,99,235,0.4)" }}
                >
                  {loading ? (
                    <>
                      <Loader2 size={12} className="animate-spin" />
                      Загрузка...
                    </>
                  ) : (
                    "Войти →"
                  )}
                </button>
              </form>
            </motion.div>
          )}

          {step === "google-nick" && (
            <motion.div
              key="google-nick"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col items-center gap-5"
            >
              <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl" style={PILL_STYLE}>
                <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0">
                  <img src="/logo.jpg" alt="SB Games" className="w-full h-full object-cover" />
                </div>
                <div className="flex flex-col leading-tight">
                  <span className="text-[13px] font-bold text-white tracking-wide">SB GAMES</span>
                  <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>
                    Google-аккаунт привязан!
                  </span>
                </div>
              </div>
              <form onSubmit={handleGoogleNickSubmit} className="flex flex-col gap-3 w-[280px]">
                <p className="text-[12px] text-center" style={{ color: "rgba(255,255,255,0.35)" }}>
                  Придумай игровой ник
                </p>
                <input
                  value={nick}
                  onChange={(e) => { setNick(e.target.value); setError(""); }}
                  placeholder="Ник (3–16 символов)"
                  autoFocus
                  autoCapitalize="none"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  className="w-full rounded-xl px-4 py-2.5 text-[13px] outline-none transition-all"
                  style={{
                    background: "rgba(18,18,18,0.95)",
                    border: error ? "1px solid rgba(239,68,68,0.4)" : "1px solid rgba(255,255,255,0.08)",
                    color: "#fff",
                    caretColor: "#60a5fa",
                    backdropFilter: "blur(20px)",
                  }}
                />
                <div className="relative">
                  <Gift size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "rgba(255,255,255,0.25)" }} />
                  <input
                    value={referralInput}
                    onChange={(e) => setReferralInput(e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase())}
                    placeholder="Реферальный код (необязательно)"
                    maxLength={8}
                    autoCapitalize="characters"
                    autoComplete="off"
                    className="w-full rounded-xl pl-9 pr-4 py-2.5 text-[13px] outline-none transition-all"
                    style={{
                      background: "rgba(18,18,18,0.95)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      color: "rgba(255,255,255,0.5)",
                      caretColor: "#60a5fa",
                      backdropFilter: "blur(20px)",
                    }}
                  />
                </div>
                {error && (
                  <motion.p initial={{ opacity: 0, y: -2 }} animate={{ opacity: 1, y: 0 }}
                    className="text-[11px] px-1" style={{ color: "rgba(239,68,68,0.9)" }}>
                    {error}
                  </motion.p>
                )}
                <button type="submit" disabled={loading || !nick.trim()}
                  className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-xl text-[11px] font-medium tracking-wide transition-all duration-150 disabled:opacity-40"
                  style={{ color: "#fff", background: "rgba(37,99,235,0.7)", border: "1px solid rgba(37,99,235,0.4)" }}>
                  {loading ? <><Loader2 size={12} className="animate-spin" />Загрузка...</> : "Войти"}
                </button>
              </form>
            </motion.div>
          )}

          {step === "success" && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col items-center gap-4"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.15, type: "spring", stiffness: 300 }}
              >
                <CheckCircle2 size={48} className="text-green-400" />
              </motion.div>
              <p className="text-[16px] font-semibold text-white">Добро пожаловать!</p>
              <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.3)" }}>
                Загружаем лаунчер...
              </p>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </motion.div>
  );
}
