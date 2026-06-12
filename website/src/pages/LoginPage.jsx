import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { API_URL } from "../lib/api.js";

export default function LoginPage({ onLogin }) {
  const [step, setStep] = useState("choose");
  const [tgUser, setTgUser] = useState(null);
  const [nick, setNick] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loginCode, setLoginCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [widgetReady, setWidgetReady] = useState(false);
  const widgetRef = useRef(null);
  const navigate = useNavigate();

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

    // Удаляем старый script если есть
    widgetRef.current.innerHTML = "";
    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.setAttribute("data-telegram-login", "sbgamescbot");
    script.setAttribute("data-size", "large");
    script.setAttribute("data-onauth", "onTelegramAuth(user)");
    script.setAttribute("data-request-access", "write");
    script.async = true;
    script.onload = () => setWidgetReady(true);
    script.onerror = () => setError("Не удалось загрузить Telegram. Попробуй позже.");
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
      navigate("/");
    }, 600);
  };

  const generateLoginCode = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/auth/create-code`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Сервер не ответил");
      setLoginCode(json.code);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleNick = async (e) => {
    e.preventDefault();
    const clean = nick.trim().replace(/^@/, "");
    if (!/^[a-zA-Z0-9_]{3,16}$/.test(clean)) {
      setError("Ник: 3–16 символов, буквы/цифры/_");
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

  const botLink = `https://t.me/sbgamescbot?start=auth_${loginCode}`;

  if (step === "success") {
    return (
      <main style={{ minHeight: "calc(100vh - 80px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✓</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#fff", margin: "0 0 6px" }}>Входим</h1>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>Один момент…</p>
        </div>
      </main>
    );
  }

  // Plain inline styles, no flashy animations
  return (
    <main style={{
      minHeight: "calc(100vh - 80px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "20px",
    }}>
      <div style={{ width: "100%", maxWidth: 400 }}>

        {/* Шапка */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#fff", margin: "0 0 6px" }}>
            Вход в аккаунт
          </h1>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, margin: 0 }}>
            Авторизация через Telegram
          </p>
        </div>

        {/* Шаги */}
        {step === "choose" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button
              onClick={() => setStep("widget")}
              style={{
                width: "100%", padding: "14px 16px", textAlign: "left",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 10, cursor: "pointer", color: "#fff",
                fontSize: 14, fontWeight: 500, fontFamily: "inherit",
                display: "flex", alignItems: "center", gap: 12,
              }}
            >
              <span style={{ fontSize: 18 }}>💬</span>
              <div>
                <div>Войти через Telegram</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2, fontWeight: 400 }}>
                  Один клик в окне Telegram
                </div>
              </div>
            </button>

            <button
              onClick={() => setStep("code")}
              style={{
                width: "100%", padding: "14px 16px", textAlign: "left",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 10, cursor: "pointer", color: "#fff",
                fontSize: 14, fontWeight: 500, fontFamily: "inherit",
                display: "flex", alignItems: "center", gap: 12,
              }}
            >
              <span style={{ fontSize: 18 }}>🔑</span>
              <div>
                <div>Получить код</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2, fontWeight: 400 }}>
                  Отправь код боту в Telegram
                </div>
              </div>
            </button>
          </div>
        )}

        {step === "widget" && (
          <div>
            <button onClick={() => setStep("choose")}
              style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.4)", fontSize: 12, cursor: "pointer", padding: "0 0 16px", fontFamily: "inherit" }}>
              ← Назад
            </button>
            <div style={{
              padding: "24px",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 10,
              display: "flex", justifyContent: "center", minHeight: 80,
              alignItems: "center",
            }}>
              {!widgetReady && !error && (
                <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>Загружаем Telegram…</span>
              )}
              <div ref={widgetRef} />
            </div>
            {error && <p style={{ color: "#ef4444", fontSize: 12, marginTop: 12 }}>{error}</p>}
          </div>
        )}

        {step === "code" && (
          <div>
            <button onClick={() => setStep("choose")}
              style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.4)", fontSize: 12, cursor: "pointer", padding: "0 0 16px", fontFamily: "inherit" }}>
              ← Назад
            </button>

            {loading && !loginCode ? (
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>Генерируем код…</p>
            ) : loginCode ? (
              <>
                <div style={{
                  padding: "16px",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 10,
                  marginBottom: 12,
                }}>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                    Твой код
                  </p>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 12px",
                    background: "rgba(0,0,0,0.3)",
                    borderRadius: 8,
                  }}>
                    <code style={{
                      flex: 1, fontSize: 18, fontWeight: 700,
                      color: "#fff", letterSpacing: "0.15em", fontFamily: "monospace",
                    }}>{loginCode}</code>
                    <button onClick={() => { navigator.clipboard.writeText(loginCode); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                      style={{
                        padding: "4px 10px",
                        background: copied ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.06)",
                        border: copied ? "1px solid rgba(16,185,129,0.3)" : "1px solid rgba(255,255,255,0.08)",
                        color: copied ? "#10b981" : "rgba(255,255,255,0.6)",
                        borderRadius: 6, cursor: "pointer", fontSize: 11, fontFamily: "inherit",
                      }}>
                      {copied ? "Скопировано" : "Копировать"}
                    </button>
                  </div>
                </div>

                <a href={botLink} target="_blank" rel="noopener noreferrer"
                  style={{
                    display: "block", textAlign: "center",
                    width: "100%", padding: "12px",
                    background: "#3b82f6", color: "#fff",
                    fontSize: 14, fontWeight: 600,
                    borderRadius: 10, textDecoration: "none",
                    boxSizing: "border-box",
                  }}>
                  Открыть @sbgamescbot
                </a>

                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 12, lineHeight: 1.5 }}>
                  Открой бот, отправь ему код. Он пустит тебя в аккаунт. Код живёт 10 минут.
                </p>
              </>
            ) : null}
            {error && <p style={{ color: "#ef4444", fontSize: 12, marginTop: 12 }}>{error}</p>}
          </div>
        )}

        {step === "nick" && (
          <div>
            <p style={{ color: "#fff", fontWeight: 600, marginBottom: 4 }}>
              Привет, {tgUser?.first_name || "друг"}!
            </p>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, marginBottom: 16 }}>
              Придумай игровой ник
            </p>
            <form onSubmit={handleNick}>
              <input
                type="text"
                value={nick}
                onChange={(e) => { setNick(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "")); setError(""); }}
                placeholder="ник"
                autoFocus
                maxLength={16}
                style={{
                  width: "100%", padding: "12px 14px", boxSizing: "border-box",
                  background: "rgba(255,255,255,0.05)",
                  border: error ? "1px solid rgba(239,68,68,0.5)" : "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 10, color: "#fff", fontSize: 14, fontFamily: "inherit",
                  marginBottom: 8,
                }}
              />
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginBottom: 12 }}>
                3–16 символов, буквы/цифры/подчёркивание
              </p>
              {error && <p style={{ color: "#ef4444", fontSize: 12, marginBottom: 12 }}>{error}</p>}
              <button type="submit" disabled={loading || nick.length < 3}
                style={{
                  width: "100%", padding: "12px",
                  background: loading || nick.length < 3 ? "rgba(59,130,246,0.4)" : "#3b82f6",
                  color: "#fff", fontSize: 14, fontWeight: 600,
                  border: "none", borderRadius: 10,
                  cursor: loading || nick.length < 3 ? "not-allowed" : "pointer",
                  fontFamily: "inherit",
                }}>
                {loading ? "..." : "Готово"}
              </button>
            </form>
          </div>
        )}
      </div>
    </main>
  );
}
