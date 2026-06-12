import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { CircleNotch, Copy, Check, ArrowLeft, TelegramLogo, Sparkle } from "@phosphor-icons/react";
import { API_URL } from "../lib/api.js";

export default function LoginPage({ onLogin }) {
  const [step, setStep] = useState("choose");   // choose | widget | code | nick | success
  const [tgUser, setTgUser] = useState(null);
  const [nick, setNick] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loginCode, setLoginCode] = useState("");
  const [copied, setCopied] = useState(false);
  const widgetRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!widgetRef.current || step !== "widget") return;

    window.onTelegramAuth = async (data) => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`${API_URL}/auth/widget-login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.message || "Не удалось войти");

        if (json.needNick) {
          setTgUser(json.tgUser);
          setNick(json.tgUser.username || "");
          setStep("nick");
        } else {
          finishLogin(json.user, json.token);
        }
      } catch (e) {
        setError(e.message);
        setLoading(false);
      }
    };

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.setAttribute("data-telegram-login", "sbgamescbot");
    script.setAttribute("data-size", "large");
    script.setAttribute("data-onauth", "onTelegramAuth(user)");
    script.setAttribute("data-request-access", "write");
    script.async = true;
    widgetRef.current.appendChild(script);

    return () => { delete window.onTelegramAuth; };
  }, [step]);

  useEffect(() => {
    if (step === "code") generateLoginCode();
  }, [step]);

  const finishLogin = (user, token) => {
    setStep("success");
    setTimeout(() => {
      onLogin(user, token);
      navigate("/");
    }, 700);
  };

  const generateLoginCode = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/auth/create-code`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Не удалось создать код");
      setLoginCode(json.code);
      pollForLogin(json.code);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const pollForLogin = (code) => {
    let stopped = false;
    const interval = setInterval(async () => {
      if (stopped) return;
      try {
        const res = await fetch(`${API_URL}/auth/check-code`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });
        const json = await res.json();
        if (json.user) {
          stopped = true; clearInterval(interval);
          if (json.needNick) {
            setTgUser(json.tgUser);
            setNick(json.tgUser.username || "");
            setStep("nick");
          } else {
            finishLogin(json.user, json.token);
          }
        }
      } catch {}
    }, 2000);
    setTimeout(() => { stopped = true; clearInterval(interval); }, 5 * 60 * 1000);
  };

  const handleNick = async (e) => {
    e.preventDefault();
    const clean = nick.trim().replace(/^@/, "");
    if (!/^[a-zA-Z0-9_]{3,16}$/.test(clean)) {
      setError("Ник: 3–16 символов, только буквы/цифры/_");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/auth/tg-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tgUser, username: clean }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      finishLogin(data.user, data.token);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const copy = () => {
    navigator.clipboard.writeText(loginCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const botLink = `https://t.me/sbgamescbot?start=code_${loginCode}`;

  return (
    <main style={{
      minHeight: "calc(100vh - 80px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "24px",
    }}>
      <style>{`
        @keyframes lpGlow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(59,130,246,0.4); }
          50%      { box-shadow: 0 0 0 14px rgba(59,130,246,0); }
        }
        @keyframes lpSpin { to { transform: rotate(360deg); } }
        @keyframes lpPulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50%      { opacity: 1;   transform: scale(1.05); }
        }
        .lp-input:focus {
          outline: none;
          border-color: rgba(59,130,246,0.6) !important;
          background: rgba(59,130,246,0.06) !important;
        }
        .lp-btn-primary { transition: all 0.15s; }
        .lp-btn-primary:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(59,130,246,0.3); }
        .lp-btn-primary:active:not(:disabled) { transform: translateY(0); }
        .lp-card { transition: all 0.2s; }
        .lp-card:hover { background: rgba(255,255,255,0.05) !important; border-color: rgba(59,130,246,0.4) !important; transform: translateY(-2px); }
      `}</style>

      <AnimatePresence mode="wait">
        {step === "success" ? (
          <motion.div key="ok"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 280, damping: 24 }}
            style={{ textAlign: "center" }}
          >
            <div style={{
              width: 80, height: 80, borderRadius: "50%",
              background: "linear-gradient(135deg, #10b981, #059669)",
              margin: "0 auto 20px",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 0 40px rgba(16,185,129,0.4)",
            }}>
              <Check size={40} weight="bold" color="#fff" />
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: "#fff", margin: "0 0 8px" }}>Готово</h1>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>Входим в аккаунт…</p>
          </motion.div>
        ) : (
          <motion.div key="form"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{ width: "100%", maxWidth: 440 }}
          >
            {/* Логотип + приветствие */}
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <div style={{
                width: 64, height: 64, borderRadius: 20,
                background: "linear-gradient(135deg, #2563eb, #60a5fa)",
                margin: "0 auto 16px",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 12px 32px rgba(37,99,235,0.4)",
                animation: "lpGlow 2.5s ease-out infinite",
              }}>
                <Sparkle size={28} weight="fill" color="#fff" />
              </div>
              <h1 style={{ fontSize: 26, fontWeight: 800, color: "#fff", margin: "0 0 6px", letterSpacing: "-0.01em" }}>
                Вход в SB Games
              </h1>
              <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, margin: 0 }}>
                Один аккаунт для всех серверов
              </p>
            </div>

            <AnimatePresence mode="wait">
              {step === "choose" && (
                <motion.div key="choose"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  style={{ display: "flex", flexDirection: "column", gap: 10 }}
                >
                  <button className="lp-card lp-btn-primary"
                    onClick={() => setStep("widget")}
                    style={{
                      width: "100%", padding: "18px 20px",
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 16, cursor: "pointer", textAlign: "left",
                      display: "flex", alignItems: "center", gap: 16,
                      color: "#fff", fontFamily: "inherit",
                    }}
                  >
                    <div style={{
                      width: 44, height: 44, borderRadius: 12,
                      background: "rgba(59,130,246,0.15)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0,
                    }}>
                      <TelegramLogo size={24} weight="fill" color="#60a5fa" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 2 }}>Через Telegram</div>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>Один клик — и ты в аккаунте</div>
                    </div>
                    <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 18 }}>›</span>
                  </button>

                  <button className="lp-card lp-btn-primary"
                    onClick={() => setStep("code")}
                    style={{
                      width: "100%", padding: "18px 20px",
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 16, cursor: "pointer", textAlign: "left",
                      display: "flex", alignItems: "center", gap: 16,
                      color: "#fff", fontFamily: "inherit",
                    }}
                  >
                    <div style={{
                      width: 44, height: 44, borderRadius: 12,
                      background: "rgba(168,85,247,0.15)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0,
                    }}>
                      <span style={{ fontSize: 18, fontWeight: 800, color: "#c084fc", fontFamily: "monospace" }}>#</span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 2 }}>Через код</div>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>Получи код и отправь боту</div>
                    </div>
                    <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 18 }}>›</span>
                  </button>

                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", textAlign: "center", marginTop: 16, lineHeight: 1.5 }}>
                    Нужен Telegram-аккаунт. <br/>Бот @sbgamescbot спросит разрешение на вход.
                  </p>
                </motion.div>
              )}

              {step === "widget" && (
                <motion.div key="widget"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                >
                  <button onClick={() => { setStep("choose"); setError(""); setLoading(false); }}
                    style={{
                      background: "transparent", border: "none", color: "rgba(255,255,255,0.4)",
                      fontSize: 13, cursor: "pointer", padding: "4px 0 16px",
                      display: "flex", alignItems: "center", gap: 4, fontFamily: "inherit",
                    }}
                  >
                    <ArrowLeft size={14} /> Назад
                  </button>
                  <div style={{
                    padding: "32px 24px",
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 16,
                    display: "flex", justifyContent: "center",
                    minHeight: 100,
                  }}>
                    {loading
                      ? <CircleNotch size={24} style={{ color: "#60a5fa", animation: "lpSpin 1s linear infinite" }} />
                      : <div ref={widgetRef} />
                    }
                  </div>
                  {error && <p style={{ color: "#fca5a5", fontSize: 13, marginTop: 12, textAlign: "center" }}>{error}</p>}
                </motion.div>
              )}

              {step === "code" && (
                <motion.div key="code"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                >
                  <button onClick={() => { setStep("choose"); setError(""); setLoginCode(""); }}
                    style={{
                      background: "transparent", border: "none", color: "rgba(255,255,255,0.4)",
                      fontSize: 13, cursor: "pointer", padding: "4px 0 16px",
                      display: "flex", alignItems: "center", gap: 4, fontFamily: "inherit",
                    }}
                  >
                    <ArrowLeft size={14} /> Назад
                  </button>

                  {loginCode ? (
                    <>
                      <div style={{
                        padding: "20px",
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 16,
                        marginBottom: 12,
                      }}>
                        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>
                          Твой код
                        </p>
                        <div style={{
                          display: "flex", alignItems: "center", gap: 10,
                          padding: "12px 14px",
                          background: "rgba(59,130,246,0.08)",
                          border: "1px solid rgba(59,130,246,0.25)",
                          borderRadius: 10,
                        }}>
                          <code style={{
                            flex: 1, fontSize: 22, fontWeight: 800,
                            color: "#fff", letterSpacing: "0.2em", fontFamily: "monospace",
                            animation: "lpPulse 2s ease-in-out infinite",
                          }}>{loginCode}</code>
                          <button onClick={copy}
                            style={{
                              width: 36, height: 36, borderRadius: 8,
                              background: copied ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.06)",
                              border: copied ? "1px solid rgba(16,185,129,0.3)" : "1px solid rgba(255,255,255,0.08)",
                              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                            }}>
                            {copied ? <Check size={16} color="#10b981" /> : <Copy size={16} color="rgba(255,255,255,0.6)" />}
                          </button>
                        </div>
                      </div>

                      <a className="lp-btn-primary" href={botLink} target="_blank" rel="noopener noreferrer"
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "center",
                          gap: 10, width: "100%", padding: "16px",
                          background: "linear-gradient(135deg, #2563eb, #3b82f6)",
                          color: "#fff", fontSize: 15, fontWeight: 700,
                          borderRadius: 12, textDecoration: "none",
                          boxShadow: "0 8px 24px rgba(37,99,235,0.3)",
                        }}>
                        <TelegramLogo size={20} weight="fill" />
                        Открыть @sbgamescbot
                      </a>

                      <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 16, textAlign: "center", lineHeight: 1.6 }}>
                        Отправь код боту и он откроет тебе вход.<br/>Код действует 5 минут.
                      </p>
                    </>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "40px 0" }}>
                      <CircleNotch size={20} style={{ color: "#60a5fa", animation: "lpSpin 1s linear infinite" }} />
                      <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>Генерируем код…</span>
                    </div>
                  )}
                  {error && <p style={{ color: "#fca5a5", fontSize: 13, marginTop: 12, textAlign: "center" }}>{error}</p>}
                </motion.div>
              )}

              {step === "nick" && (
                <motion.div key="nick"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                >
                  <div style={{ textAlign: "center", marginBottom: 24 }}>
                    {tgUser?.photo_url && (
                      <img src={tgUser.photo_url} alt=""
                        style={{ width: 72, height: 72, borderRadius: "50%", marginBottom: 12, border: "2px solid rgba(59,130,246,0.4)" }} />
                    )}
                    <h2 style={{ fontSize: 20, fontWeight: 700, color: "#fff", margin: "0 0 4px" }}>
                      Привет, {tgUser?.first_name || "друг"}!
                    </h2>
                    <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, margin: 0 }}>
                      Придумай ник для игры
                    </p>
                  </div>

                  <form onSubmit={handleNick} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ position: "relative" }}>
                      <span style={{
                        position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)",
                        color: "rgba(255,255,255,0.3)", fontSize: 16, fontWeight: 600,
                      }}>@</span>
                      <input className="lp-input"
                        type="text"
                        value={nick}
                        onChange={(e) => { setNick(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "")); setError(""); }}
                        placeholder="никнейм"
                        autoFocus
                        maxLength={16}
                        style={{
                          width: "100%", padding: "14px 16px 14px 36px",
                          background: error ? "rgba(239,68,68,0.05)" : "rgba(255,255,255,0.04)",
                          border: error ? "1px solid rgba(239,68,68,0.4)" : "1px solid rgba(255,255,255,0.1)",
                          borderRadius: 12, color: "#fff", fontSize: 15,
                          fontFamily: "inherit", boxSizing: "border-box",
                          transition: "all 0.15s",
                        }}
                      />
                    </div>
                    <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: -4 }}>
                      3–16 символов, буквы/цифры/подчёркивание
                    </p>

                    {error && <p style={{ color: "#fca5a5", fontSize: 12, margin: 0 }}>{error}</p>}

                    <button className="lp-btn-primary" type="submit"
                      disabled={loading || nick.length < 3}
                      style={{
                        marginTop: 4, padding: "14px",
                        background: loading || nick.length < 3 ? "rgba(59,130,246,0.4)" : "linear-gradient(135deg, #2563eb, #3b82f6)",
                        color: "#fff", fontSize: 14, fontWeight: 700,
                        border: "none", borderRadius: 12,
                        cursor: loading || nick.length < 3 ? "not-allowed" : "pointer",
                        boxShadow: loading || nick.length < 3 ? "none" : "0 8px 24px rgba(37,99,235,0.3)",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      }}
                    >
                      {loading ? <CircleNotch size={16} style={{ animation: "lpSpin 1s linear infinite" }} /> : "Готово"}
                    </button>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
