import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { TelegramLogo, ArrowLeft, Check, Copy, GoogleLogo, Gift } from "@phosphor-icons/react";
import { API_URL } from "../lib/api.js";

const glowCard = {
  position: "relative",
  borderRadius: 24,
  padding: 1,
};

const glowCardBg = {
  background: "rgba(17,17,24,0.85)",
  backdropFilter: "blur(40px)",
  WebkitBackdropFilter: "blur(40px)",
  borderRadius: 24,
  padding: "40px 36px",
  border: "1px solid rgba(255,255,255,0.06)",
};

const inputStyle = (hasError) => ({
  width: "100%",
  padding: "14px 16px",
  boxSizing: "border-box",
  background: "rgba(255,255,255,0.04)",
  border: hasError ? "1.5px solid rgba(239,68,68,0.5)" : "1.5px solid rgba(255,255,255,0.08)",
  borderRadius: 14,
  color: "#fff",
  fontSize: 15,
  fontFamily: "inherit",
  outline: "none",
  transition: "border-color 0.2s, box-shadow 0.2s",
});

export default function LoginPage({ onLogin }) {
  const [step, setStep] = useState("choose");
  const [tgUser, setTgUser] = useState(null);
  const [nick, setNick] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loginCode, setLoginCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [widgetReady, setWidgetReady] = useState(false);
  const [googleState, setGoogleState] = useState(null);
  const widgetRef = useRef(null);
  const googlePollRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = location.state?.from || "/";
  const redirectMessage = location.state?.message || null;
  const [referralFromUrl] = useState(() => {
    const urlCode = new URLSearchParams(window.location.search).get("ref");
    if (urlCode) {
      localStorage.setItem("referral", urlCode);
      return urlCode;
    }
    return localStorage.getItem("referral") || null;
  });
  const referralCodeRef = useRef(referralFromUrl);
  const [referralInput, setReferralInput] = useState(referralFromUrl || "");

  useEffect(() => {
    if (step !== "widget" || !widgetRef.current) return;
    setWidgetReady(false);
    setError("");

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
        if (!res.ok) throw new Error(json.message || "Telegram не пустил");
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

    widgetRef.current.innerHTML = "";
    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.setAttribute("data-telegram-login", "sbgamescbot");
    script.setAttribute("data-size", "large");
    script.setAttribute("data-onauth", "onTelegramAuth(user)");
    script.setAttribute("data-request-access", "write");
    script.async = true;
    script.onload = () => setWidgetReady(true);
    script.onerror = () => setError("Telegram не загрузился. Попробуй позже.");
    widgetRef.current.appendChild(script);

    return () => { delete window.onTelegramAuth; };
  }, [step]);

  useEffect(() => {
    if (step === "code" && !loginCode) generateLoginCode();
  }, [step]);

  const finishLogin = (user, token) => {
    setStep("success");
    setTimeout(() => {
      onLogin(user, token);
      navigate(returnTo);
    }, 800);
  };

  const generateLoginCode = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/auth/create-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "web" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Сервер не ответил");
      setLoginCode(json.code);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/auth/google/init`);
      const data = await res.json();
      setGoogleState(data.state);
      window.open(data.url, "_blank", "noopener");
      setStep("google-wait");
      setLoading(false);
      clearInterval(googlePollRef.current);
      googlePollRef.current = setInterval(async () => {
        try {
          const r = await fetch(`${API_URL}/auth/google/check?state=${data.state}`);
          const d = await r.json();
          if (d.status === "done" && d.token) {
            clearInterval(googlePollRef.current);
            finishLogin(d.user, d.token);
          } else if (d.status === "need_nick") {
            clearInterval(googlePollRef.current);
            setStep("google-nick");
          } else if (d.status === "expired") {
            clearInterval(googlePollRef.current);
            setError("Ссылка устарела, попробуй снова");
            setStep("choose");
          }
        } catch {}
      }, 2000);
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  };

  const handleGoogleNick = async (e) => {
    e.preventDefault();
    const clean = nick.trim().replace(/^@/, "");
    if (!/^[a-zA-Z0-9_]{3,16}$/.test(clean)) { setError("Ник: 3–16 символов, буквы/цифры/_"); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/auth/google/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: googleState, username: clean, referralCode: referralInput || referralCodeRef.current }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      finishLogin(data.user, data.token);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (step !== "code" || !loginCode) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}/auth/check-code?code=${loginCode}`);
        const json = await res.json();
        if (!json.confirmed) return;
        clearInterval(interval);
        const loginRes = await fetch(`${API_URL}/auth/tg-login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tgUser: json.tgUser, referralCode: referralInput || referralCodeRef.current }),
        });
        const loginJson = await loginRes.json();
        if (loginJson.needNick) {
          setTgUser(json.tgUser);
          setNick(json.tgUser.username || "");
          setStep("nick");
        } else if (loginRes.ok) {
          finishLogin(loginJson.user, loginJson.token);
        } else {
          setError(loginJson.message || "Ошибка входа");
        }
      } catch {}
    }, 2000);
    return () => clearInterval(interval);
  }, [step, loginCode]);

  const handleNick = async (e) => {
    e.preventDefault();
    const clean = nick.trim().replace(/^@/, "");
    if (!/^[a-zA-Z0-9_]{3,16}$/.test(clean)) {
      setError("Ник: 3–16 символов, буквы/цифры/_");
      return;
    }
    setLoading(true);
    setError("");
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    try {
      const res = await fetch(`${API_URL}/auth/tg-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tgUser, username: clean, referralCode: referralInput || referralCodeRef.current }),
        signal: ctrl.signal,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Ошибка входа");
      if (!data.token) throw new Error(data.message || "Сервер не вернул токен, попробуй ещё раз");
      finishLogin(data.user, data.token);
    } catch (err) {
      setError(err.name === "AbortError" ? "Сервер не ответил, попробуй ещё раз" : err.message);
      setLoading(false);
    } finally {
      clearTimeout(timer);
    }
  };

  const botLink = `https://t.me/sbgamescbot?start=auth_${loginCode}`;

  /* ---------- SUCCESS ---------- */
  if (step === "success") {
    return (
      <main style={{ minHeight: "calc(100vh - 80px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: 72, height: 72, borderRadius: "50%",
            background: "linear-gradient(135deg, rgba(16,185,129,0.2), rgba(6,182,212,0.2))",
            border: "2px solid rgba(16,185,129,0.4)",
            margin: "0 auto 20px",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 40px rgba(16,185,129,0.15)",
          }}>
            <Check size={36} weight="bold" color="#10b981" />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "#fff", margin: "0 0 8px" }}>Входим</h1>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>Один момент…</p>
        </div>
      </main>
    );
  }

  /* ---------- MAIN ---------- */
  return (
    <main style={{
      minHeight: "calc(100vh - 80px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "24px",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* BG glow */}
      <div style={{
        position: "absolute", top: "-30%", left: "50%", transform: "translateX(-50%)",
        width: 600, height: 600, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", bottom: "-20%", right: "-10%",
        width: 400, height: 400, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(168,85,247,0.06) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      <div style={{ width: "100%", maxWidth: 420, position: "relative", zIndex: 1 }}>

        {/* Logo / Brand */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16, margin: "0 auto 16px",
            background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 8px 32px rgba(59,130,246,0.3)",
          }}>
            <span style={{ fontSize: 24, fontWeight: 900, color: "#fff", fontFamily: "monospace" }}>S&B</span>
          </div>
          <h1 style={{
            fontSize: 28, fontWeight: 900, margin: "0 0 6px",
            background: "linear-gradient(135deg, #fff 30%, rgba(255,255,255,0.6))",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}>
            Вход в аккаунт
          </h1>
          <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 13, margin: 0 }}>
            Выбери способ входа
          </p>
        </div>

        {/* Card */}
        <div style={glowCard}>
          <div style={{
            position: "absolute", inset: -1, borderRadius: 24, padding: 1,
            background: "linear-gradient(135deg, rgba(59,130,246,0.15), rgba(168,85,247,0.1), rgba(59,130,246,0.05))",
            pointerEvents: "none",
          }} />
          <div style={glowCardBg}>

            {redirectMessage && (
              <div style={{
                padding: "12px 16px", marginBottom: 20, borderRadius: 12,
                background: "linear-gradient(135deg, rgba(59,130,246,0.12), rgba(99,102,241,0.08))",
                border: "1px solid rgba(59,130,246,0.2)",
                color: "#93c5fd", fontSize: 13, fontWeight: 600,
                lineHeight: 1.4,
              }}>
                {redirectMessage}
              </div>
            )}

            {referralFromUrl && !redirectMessage && step === "choose" && (
              <div style={{
                padding: "12px 16px", marginBottom: 20, borderRadius: 12,
                background: "linear-gradient(135deg, rgba(16,185,129,0.12), rgba(6,182,212,0.08))",
                border: "1px solid rgba(16,185,129,0.2)",
                color: "#6ee7b7", fontSize: 13, fontWeight: 600, lineHeight: 1.4,
                display: "flex", alignItems: "center", gap: 10,
              }}>
                <Gift size={18} weight="duotone" />
                <span>Вы пришли по реферальной ссылке. Зарегистрируйтесь!</span>
              </div>
            )}

            {/* CHOOSE */}
            {step === "choose" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  {
                    onClick: () => setStep("widget"),
                    icon: <TelegramLogo size={22} weight="fill" color="#fff" />,
                    iconBg: "linear-gradient(135deg, #3b82f6, #2563eb)",
                    iconShadow: "0 4px 16px rgba(59,130,246,0.3)",
                    label: "Войти через Telegram",
                    sub: "Быстрый вход в один клик",
                  },
                  {
                    onClick: () => setStep("code"),
                    icon: <span style={{ fontSize: 20, fontWeight: 800, color: "#fff", fontFamily: "monospace" }}>#</span>,
                    iconBg: "linear-gradient(135deg, #8b5cf6, #7c3aed)",
                    iconShadow: "0 4px 16px rgba(139,92,246,0.3)",
                    label: "Получить код",
                    sub: "Отправь код боту в Telegram",
                  },
                  {
                    onClick: handleGoogleLogin,
                    disabled: loading,
                    icon: <GoogleLogo size={22} weight="bold" color="#fff" />,
                    iconBg: "linear-gradient(135deg, #4285f4, #3b82f6)",
                    iconShadow: "0 4px 16px rgba(66,133,244,0.3)",
                    label: "Войти через Google",
                    sub: "Откроется окно авторизации",
                  },
                ].map(({ onClick, disabled, icon, iconBg, iconShadow, label, sub }) => (
                  <button
                    key={label}
                    onClick={onClick}
                    disabled={disabled}
                    style={{
                      width: "100%", padding: "16px 18px", textAlign: "left",
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.06)",
                      borderRadius: 16, cursor: disabled ? "not-allowed" : "pointer",
                      color: "#fff", fontSize: 14, fontWeight: 600, fontFamily: "inherit",
                      display: "flex", alignItems: "center", gap: 16,
                      transition: "all 0.2s",
                      opacity: disabled ? 0.5 : 1,
                    }}
                    onMouseEnter={e => {
                      if (disabled) return;
                      e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                      e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)";
                      e.currentTarget.style.transform = "translateY(-1px)";
                      e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.3)";
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                      e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  >
                    <div style={{
                      width: 44, height: 44, borderRadius: 12,
                      background: iconBg,
                      boxShadow: iconShadow,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0,
                    }}>
                      {icon}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{label}</div>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 2, fontWeight: 400 }}>
                        {sub}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* WIDGET */}
            {step === "widget" && (
              <div>
                <BackBtn onClick={() => setStep("choose")} />
                <div style={{
                  padding: "28px 24px",
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 16,
                  display: "flex", justifyContent: "center", minHeight: 90,
                  alignItems: "center",
                }}>
                  {!widgetReady && !error && (
                    <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 13 }}>Загружаем…</span>
                  )}
                  <div ref={widgetRef} />
                </div>
                {error && <p style={{ color: "#fca5a5", fontSize: 12, marginTop: 12 }}>{error}</p>}
              </div>
            )}

            {/* CODE */}
            {step === "code" && (
              <div>
                <BackBtn onClick={() => setStep("choose")} />

                {loading && !loginCode ? (
                  <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, textAlign: "center", padding: "20px 0" }}>Генерируем код…</p>
                ) : loginCode ? (
                  <>
                    <div style={{
                      padding: "20px",
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.06)",
                      borderRadius: 16,
                      marginBottom: 16,
                    }}>
                      <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", margin: "0 0 12px", textTransform: "uppercase", letterSpacing: "0.15em", fontWeight: 700 }}>
                        Твой код
                      </p>
                      <div style={{
                        display: "flex", alignItems: "center", gap: 12,
                        padding: "14px 16px",
                        background: "rgba(0,0,0,0.3)",
                        borderRadius: 12,
                        border: "1px solid rgba(255,255,255,0.04)",
                      }}>
                        <code style={{
                          flex: 1, fontSize: 26, fontWeight: 800,
                          color: "#fff", letterSpacing: "0.2em", fontFamily: "monospace",
                          textAlign: "center",
                        }}>{loginCode}</code>
                        <button onClick={() => { navigator.clipboard.writeText(loginCode); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                          style={{
                            width: 36, height: 36, padding: 0,
                            background: copied ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.06)",
                            border: copied ? "1.5px solid rgba(16,185,129,0.3)" : "1.5px solid rgba(255,255,255,0.08)",
                            borderRadius: 10, cursor: "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            transition: "all 0.2s",
                          }}>
                          {copied ? <Check size={16} weight="bold" color="#10b981" /> : <Copy size={16} color="rgba(255,255,255,0.5)" />}
                        </button>
                      </div>
                    </div>

                    <a href={botLink} target="_blank" rel="noopener noreferrer"
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "center",
                        gap: 10, width: "100%", padding: "14px",
                        background: "linear-gradient(135deg, #3b82f6, #2563eb)",
                        color: "#fff",
                        fontSize: 14, fontWeight: 700,
                        borderRadius: 14, textDecoration: "none", boxSizing: "border-box",
                        transition: "all 0.2s",
                        boxShadow: "0 4px 20px rgba(59,130,246,0.3)",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 6px 24px rgba(59,130,246,0.4)"; }}
                      onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 4px 20px rgba(59,130,246,0.3)"; }}
                    >
                      <TelegramLogo size={18} weight="fill" />
                      Открыть @sbgamescbot
                    </a>

                    <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginTop: 14, lineHeight: 1.6, textAlign: "center" }}>
                      Нажми кнопку, отправь боту код.<br />Страница автоматически войдёт в аккаунт.
                    </p>
                  </>
                ) : null}
                {error && <p style={{ color: "#fca5a5", fontSize: 12, marginTop: 12 }}>{error}</p>}
              </div>
            )}

            {/* GOOGLE WAIT */}
            {step === "google-wait" && (
              <div style={{ textAlign: "center", padding: "8px 0" }}>
                <div style={{
                  width: 64, height: 64, borderRadius: "50%", margin: "0 auto 16px",
                  background: "linear-gradient(135deg, rgba(66,133,244,0.2), rgba(59,130,246,0.15))",
                  border: "2px solid rgba(66,133,244,0.3)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 0 40px rgba(66,133,244,0.1)",
                }}>
                  <GoogleLogo size={30} weight="bold" color="#fff" />
                </div>
                <p style={{ color: "#fff", fontWeight: 700, marginBottom: 4, fontSize: 16 }}>Google открыт</p>
                <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginBottom: 20 }}>Войди в Google-аккаунт в открытой вкладке</p>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "rgba(255,255,255,0.35)", fontSize: 12 }}>
                  <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#3b82f6", animation: "pulse 1.5s infinite" }} />
                  Ожидаем подтверждение…
                </div>
                {error && <p style={{ color: "#fca5a5", fontSize: 12, marginTop: 12 }}>{error}</p>}
                <button onClick={() => { clearInterval(googlePollRef.current); setStep("choose"); }}
                  style={{ marginTop: 20, background: "transparent", border: "none", color: "rgba(255,255,255,0.35)", fontSize: 12, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <ArrowLeft size={12} /> Назад
                </button>
              </div>
            )}

            {/* GOOGLE NICK */}
            {step === "google-nick" && (
              <div>
                <p style={{ color: "#fff", fontWeight: 700, marginBottom: 4, fontSize: 16 }}>
                  Google-аккаунт привязан!
                </p>
                <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginBottom: 20 }}>
                  Придумай игровой ник
                </p>
                <form onSubmit={handleGoogleNick}>
                  <input type="text" value={nick}
                    onChange={(e) => { setNick(e.target.value.replace(/[^a-zA-Z0-9_]/g, "")); setError(""); }}
                    placeholder="ник" autoFocus maxLength={16}
                    style={inputStyle(error)} />
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 8, marginBottom: 12 }}>3–16 символов, буквы/цифры/подчёркивание</p>
                  <div style={{ position: "relative", marginBottom: 16 }}>
                    <Gift size={14} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.25)" }} />
                    <input type="text" value={referralInput}
                      onChange={(e) => setReferralInput(e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase())}
                      placeholder="Реферальный код (необязательно)" maxLength={8}
                      autoCapitalize="characters" autoComplete="off"
                      style={{ ...inputStyle(false), paddingLeft: 38, color: "rgba(255,255,255,0.5)" }} />
                  </div>
                  {error && <p style={{ color: "#fca5a5", fontSize: 12, marginBottom: 12 }}>{error}</p>}
                  <button type="submit" disabled={loading || nick.length < 3}
                    style={{
                      width: "100%", padding: "13px",
                      background: nick.length < 3 ? "rgba(59,130,246,0.3)" : "linear-gradient(135deg, #3b82f6, #2563eb)",
                      color: "#fff", fontSize: 14, fontWeight: 700,
                      border: "none", borderRadius: 14,
                      cursor: nick.length < 3 ? "not-allowed" : "pointer",
                      fontFamily: "inherit", transition: "all 0.2s",
                      boxShadow: nick.length >= 3 ? "0 4px 16px rgba(59,130,246,0.25)" : "none",
                    }}>
                    {loading ? "..." : "Готово"}
                  </button>
                </form>
              </div>
            )}

            {/* NICK */}
            {step === "nick" && (
              <div>
                <p style={{ color: "#fff", fontWeight: 700, marginBottom: 4, fontSize: 16 }}>
                  Привет, {tgUser?.first_name || "друг"}!
                </p>
                <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginBottom: 20 }}>
                  Придумай игровой ник
                </p>
                <form onSubmit={handleNick}>
                  <input
                    type="text"
                    value={nick}
                    onChange={(e) => { setNick(e.target.value.replace(/[^a-zA-Z0-9_]/g, "")); setError(""); }}
                    placeholder="ник"
                    autoFocus
                    maxLength={16}
                    style={inputStyle(error)}
                  />
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 8, marginBottom: 12 }}>
                    3–16 символов, буквы/цифры/подчёркивание
                  </p>

                  <div style={{ position: "relative", marginBottom: 16 }}>
                    <Gift size={14} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.25)" }} />
                    <input
                      type="text"
                      value={referralInput}
                      onChange={(e) => setReferralInput(e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase())}
                      placeholder="Реферальный код (необязательно)"
                      maxLength={8}
                      autoCapitalize="characters"
                      autoComplete="off"
                      style={{
                        ...inputStyle(false),
                        paddingLeft: 38,
                        color: "rgba(255,255,255,0.5)",
                      }}
                    />
                  </div>

                  {error && <p style={{ color: "#fca5a5", fontSize: 12, marginBottom: 12 }}>{error}</p>}
                  <button type="submit" disabled={loading || nick.length < 3}
                    style={{
                      width: "100%", padding: "13px",
                      background: loading || nick.length < 3 ? "rgba(59,130,246,0.3)" : "linear-gradient(135deg, #3b82f6, #2563eb)",
                      color: "#fff", fontSize: 14, fontWeight: 700,
                      border: "none", borderRadius: 14,
                      cursor: loading || nick.length < 3 ? "not-allowed" : "pointer",
                      fontFamily: "inherit", transition: "all 0.2s",
                      boxShadow: nick.length >= 3 ? "0 4px 16px rgba(59,130,246,0.25)" : "none",
                    }}>
                    {loading ? "..." : "Готово"}
                  </button>
                </form>
              </div>
            )}

          </div>
        </div>

        {/* Footer */}
        <p style={{ textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.2)", marginTop: 20 }}>
          Входя, ты соглашаешься с правилами сервера
        </p>

      </div>
    </main>
  );
}

function BackBtn({ onClick }) {
  return (
    <button onClick={onClick} style={{
      background: "transparent", border: "none", color: "rgba(255,255,255,0.3)", fontSize: 12,
      cursor: "pointer", padding: "0 0 16px", fontFamily: "inherit",
      display: "inline-flex", alignItems: "center", gap: 4, transition: "color 0.15s",
    }}
      onMouseEnter={e => e.currentTarget.style.color = "rgba(255,255,255,0.6)"}
      onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.3)"}
    >
      <ArrowLeft size={12} /> Назад
    </button>
  );
}
