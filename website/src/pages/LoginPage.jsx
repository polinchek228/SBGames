import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Copy, Check } from "lucide-react";
import { API_URL } from "../lib/api.js";

export default function LoginPage({ onLogin }) {
  const [step, setStep] = useState("start");
  const [method, setMethod] = useState(null);
  const [tgUser, setTgUser] = useState(null);
  const [nick, setNick] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loginCode, setLoginCode] = useState("");
  const [copied, setCopied] = useState(false);
  const widgetRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!widgetRef.current || method !== "widget") return;

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
        if (!res.ok) throw new Error(json.message || "Ошибка авторизации");

        if (json.needNick) {
          setTgUser(json.tgUser);
          setNick(json.tgUser.username || "");
          setStep("nick");
        } else {
          setStep("success");
          setTimeout(() => {
            onLogin(json.user, json.token);
            navigate("/");
          }, 800);
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

    return () => {
      delete window.onTelegramAuth;
    };
  }, [method]);

  useEffect(() => {
    if (method === "bot-link") {
      generateLoginCode();
    }
  }, [method]);

  const generateLoginCode = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/auth/generate-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Ошибка");
      setLoginCode(json.code);
      pollForLogin(json.code);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const pollForLogin = (code) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}/auth/check-code`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });
        const json = await res.json();
        if (json.user) {
          clearInterval(interval);
          setStep("success");
          setTimeout(() => {
            onLogin(json.user, json.token);
            navigate("/");
          }, 800);
        }
      } catch {}
    }, 2000);

    setTimeout(() => clearInterval(interval), 5 * 60 * 1000);
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
      setStep("success");
      setTimeout(() => {
        onLogin(data.user, data.token);
        navigate("/");
      }, 800);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(loginCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const botLink = `https://t.me/sbgamescbot?start=code_${loginCode}`;

  // Success screen with minimalist design
  if (step === "success") {
    return (
      <main style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "80vh", padding: "16px" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "16px" }}>
            <Check size={40} style={{ color: "#3b82f6" }} />
          </div>
          <h1 style={{ fontSize: "24px", fontWeight: "bold", color: "#fff", marginBottom: "8px" }}>
            Добро пожаловать!
          </h1>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "14px" }}>Перенаправление...</p>
        </div>
      </main>
    );
  }

  // Main container with minimalist glassed design
  const containerStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "80vh",
    padding: "16px",
  };

  const contentStyle = {
    width: "100%",
    maxWidth: "480px",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  };

  const headerStyle = {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "16px",
    background: "rgba(10,10,10,0.94)",
    borderRadius: "14px",
    border: "1px solid rgba(255,255,255,0.09)",
    boxShadow: "0 4px 32px rgba(0,0,0,0.7)",
    backdropFilter: "blur(24px)",
    WebkitBackdropFilter: "blur(24px)",
    marginBottom: "8px",
  };

  const titleStyle = {
    fontSize: "18px",
    fontWeight: "600",
    color: "#fff",
    letterSpacing: "0.02em",
  };

  const botRequiredStyle = {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "12px 16px",
    background: "rgba(59,130,246,0.1)",
    border: "1px solid rgba(59,130,246,0.3)",
    borderRadius: "12px",
    marginBottom: "16px",
  };

  const botLabelStyle = {
    fontSize: "12px",
    color: "rgba(255,255,255,0.6)",
  };

  const botNameStyle = {
    fontSize: "14px",
    fontWeight: "600",
    color: "#3b82f6",
    fontFamily: "monospace",
  };

  const buttonStyle = {
    width: "100%",
    padding: "12px 16px",
    background: "#3b82f6",
    color: "#fff",
    border: "none",
    borderRadius: "12px",
    fontSize: "14px",
    fontWeight: "500",
    cursor: "pointer",
    transition: "all 0.15s",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
  };

  const buttonSecondaryStyle = {
    ...buttonStyle,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.1)",
  };

  const methodButtonsStyle = {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  };

  const codeBlockStyle = {
    padding: "12px 16px",
    background: "rgba(59,130,246,0.05)",
    border: "1px solid rgba(59,130,246,0.2)",
    borderRadius: "12px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "12px",
  };

  const codeTextStyle = {
    flex: 1,
    fontSize: "16px",
    fontWeight: "600",
    fontFamily: "monospace",
    color: "#fff",
    letterSpacing: "0.1em",
  };

  const backButtonStyle = {
    padding: "8px 12px",
    background: "transparent",
    color: "rgba(255,255,255,0.4)",
    border: "none",
    fontSize: "13px",
    cursor: "pointer",
    transition: "color 0.15s",
    fontWeight: "500",
    display: "flex",
    alignItems: "center",
    gap: "6px",
  };

  const infoBoxStyle = {
    padding: "12px 16px",
    background: "rgba(59,130,246,0.1)",
    border: "1px solid rgba(59,130,246,0.3)",
    borderRadius: "12px",
    fontSize: "12px",
    color: "rgba(255,255,255,0.7)",
    lineHeight: "1.5",
  };

  const inputStyle = {
    width: "100%",
    padding: "12px 16px",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "12px",
    color: "#fff",
    fontSize: "14px",
    fontFamily: "inherit",
    boxSizing: "border-box",
    transition: "all 0.15s",
  };

  const errorStyle = {
    fontSize: "12px",
    color: "#ef4444",
    marginTop: "8px",
  };

  // Loading state
  if (!method && loading) {
    return (
      <main style={containerStyle}>
        <div style={contentStyle}>
          <div style={headerStyle}>
            <span style={titleStyle}>Вход в SBGames</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "32px" }}>
            <Loader2 size={20} style={{ color: "#3b82f6", animation: "spin 1s linear infinite" }} />
            <span style={{ color: "rgba(255,255,255,0.6)", fontSize: "14px" }}>Загружаем...</span>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main style={containerStyle}>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        button:hover {
          opacity: 0.9;
        }
        button:active {
          transform: scale(0.98);
        }
        input:focus {
          outline: none;
          border-color: rgba(59, 130, 246, 0.5) !important;
          background: rgba(59, 130, 246, 0.05) !important;
        }
      `}</style>

      <div style={contentStyle}>
        {/* Header */}
        <div style={headerStyle}>
          <span style={titleStyle}>Вход в SBGames</span>
        </div>

        {/* Bot requirement notice */}
        <div style={botRequiredStyle}>
          <span style={botLabelStyle}>Требуется бот:</span>
          <span style={botNameStyle}>@sbgamescbot</span>
        </div>

        {/* Main content */}
        {!method ? (
          // Method selection
          <div>
            <div style={methodButtonsStyle}>
              <button
                onClick={() => setMethod("widget")}
                style={{
                  ...buttonStyle,
                  background: "#3b82f6",
                }}
                onMouseOver={(e) => (e.target.style.background = "#2563eb")}
                onMouseOut={(e) => (e.target.style.background = "#3b82f6")}
              >
                Telegram Widget
              </button>

              <button
                onClick={() => setMethod("bot-link")}
                style={buttonSecondaryStyle}
                onMouseOver={(e) => (e.target.style.background = "rgba(255,255,255,0.12)")}
                onMouseOut={(e) => (e.target.style.background = "rgba(255,255,255,0.08)")}
              >
                Код + Bot Link
              </button>
            </div>

            <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", marginTop: "16px", textAlign: "center" }}>
              Выбери способ входа через Telegram
            </p>
          </div>
        ) : step === "start" && method === "widget" ? (
          // Widget method
          <div>
            <button
              onClick={() => setMethod(null)}
              style={backButtonStyle}
              onMouseOver={(e) => (e.target.style.color = "rgba(255,255,255,0.6)")}
              onMouseOut={(e) => (e.target.style.color = "rgba(255,255,255,0.4)")}
            >
              ← Назад
            </button>

            {loading ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "32px 0" }}>
                <Loader2 size={20} style={{ color: "#3b82f6", animation: "spin 1s linear infinite" }} />
                <span style={{ color: "rgba(255,255,255,0.6)", fontSize: "14px" }}>Загружаем виджет...</span>
              </div>
            ) : (
              <div style={{ display: "flex", justifyContent: "center", padding: "16px 0" }}>
                <div ref={widgetRef} />
              </div>
            )}

            {error && <p style={errorStyle}>{error}</p>}
          </div>
        ) : step === "start" && method === "bot-link" ? (
          // Bot link method
          <div>
            <button
              onClick={() => setMethod(null)}
              style={backButtonStyle}
              onMouseOver={(e) => (e.target.style.color = "rgba(255,255,255,0.6)")}
              onMouseOut={(e) => (e.target.style.color = "rgba(255,255,255,0.4)")}
            >
              ← Назад
            </button>

            {loginCode ? (
              <div>
                <div style={codeBlockStyle}>
                  <code style={codeTextStyle}>{loginCode}</code>
                  <button
                    onClick={copyToClipboard}
                    style={{
                      background: "transparent",
                      border: "none",
                      padding: "4px 8px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      color: "rgba(255,255,255,0.6)",
                      transition: "color 0.15s",
                    }}
                    onMouseOver={(e) => (e.target.style.color = "#3b82f6")}
                    onMouseOut={(e) => (e.target.style.color = "rgba(255,255,255,0.6)")}
                    title="Скопировать"
                  >
                    {copied ? (
                      <Check size={16} style={{ color: "#10b981" }} />
                    ) : (
                      <Copy size={16} />
                    )}
                  </button>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <a
                    href={botLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      ...buttonStyle,
                      background: "#3b82f6",
                      textDecoration: "none",
                    }}
                    onMouseOver={(e) => (e.target.style.background = "#2563eb")}
                    onMouseOut={(e) => (e.target.style.background = "#3b82f6")}
                  >
                    Открыть бот с кодом
                  </a>

                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(loginCode);
                      window.open("https://t.me/sbgamescbot", "_blank");
                    }}
                    style={buttonSecondaryStyle}
                    onMouseOver={(e) => (e.target.style.background = "rgba(255,255,255,0.12)")}
                    onMouseOut={(e) => (e.target.style.background = "rgba(255,255,255,0.08)")}
                  >
                    Скопировать и открыть бот
                  </button>
                </div>

                <div style={infoBoxStyle}>
                  Отправь код боту или нажми на кнопку выше. Вход произойдёт автоматически.
                </div>
              </div>
            ) : loading ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "32px 0" }}>
                <Loader2 size={20} style={{ color: "#3b82f6", animation: "spin 1s linear infinite" }} />
                <span style={{ color: "rgba(255,255,255,0.6)", fontSize: "14px" }}>Генерируем код...</span>
              </div>
            ) : null}

            {error && <p style={errorStyle}>{error}</p>}
          </div>
        ) : step === "nick" ? (
          // Nick form
          <div>
            <form onSubmit={handleNick} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <p style={{ color: "#fff", fontWeight: "600", marginBottom: "4px" }}>
                  Привет, {tgUser?.first_name}!
                </p>
                <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "13px" }}>Придумай игровой ник</p>
              </div>

              <input
                type="text"
                value={nick}
                onChange={(e) => {
                  setNick(e.target.value);
                  setError("");
                }}
                placeholder="Ник (3–16 символов)"
                autoFocus
                style={{
                  ...inputStyle,
                  borderColor: error ? "#ef4444" : "rgba(255,255,255,0.1)",
                }}
              />

              {error && <p style={errorStyle}>{error}</p>}

              <button
                type="submit"
                disabled={loading || !nick.trim()}
                style={{
                  ...buttonStyle,
                  background: loading || !nick.trim() ? "rgba(255,255,255,0.08)" : "#3b82f6",
                  opacity: loading || !nick.trim() ? 0.5 : 1,
                  cursor: loading || !nick.trim() ? "not-allowed" : "pointer",
                }}
                onMouseOver={(e) => {
                  if (!loading && nick.trim()) {
                    e.target.style.background = "#2563eb";
                  }
                }}
                onMouseOut={(e) => {
                  if (!loading && nick.trim()) {
                    e.target.style.background = "#3b82f6";
                  }
                }}
              >
                {loading ? (
                  <>
                    <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
                    Загрузка...
                  </>
                ) : (
                  "Войти"
                )}
              </button>
            </form>
          </div>
        ) : null}
      </div>
    </main>
  );
}
