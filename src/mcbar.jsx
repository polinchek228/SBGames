import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { Power } from "@phosphor-icons/react";

export default function McBar() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const time = now.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

  // Кнопка закрытия шлёт Rust команду
  const close = () => {
    if (window.__TAURI_INTERNALS__) {
      window.__TAURI_INTERNALS__.invoke("kill_minecraft").catch(() => {});
    }
  };

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: "linear-gradient(180deg, rgba(15,15,22,0.97) 0%, rgba(8,8,12,0.97) 100%)",
        borderBottom: "1px solid rgba(37,99,235,0.4)",
        boxShadow: "0 4px 20px rgba(0,0,0,0.5), inset 0 -1px 0 rgba(255,255,255,0.04)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 12px",
        fontFamily: "system-ui, sans-serif",
        color: "#fff",
        WebkitUserSelect: "none",
        userSelect: "none",
      }}
    >
      {/* Лого слева */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <div
          style={{
            width: 18,
            height: 18,
            borderRadius: 5,
            background: "linear-gradient(135deg, #2563eb 0%, #60a5fa 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 0 8px rgba(37,99,235,0.6)",
            fontSize: 10,
            fontWeight: 900,
          }}
        >
          S
        </div>
        <span
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: "rgba(255,255,255,0.7)",
            letterSpacing: 0.4,
            textTransform: "uppercase",
          }}
        >
          SBGames Launcher
        </span>
      </div>

      {/* Центр — большой логотип */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 900,
            background: "linear-gradient(90deg, #60a5fa 0%, #2563eb 50%, #60a5fa 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            letterSpacing: 1.5,
          }}
        >
          SBGAMES
        </span>
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "#22c55e",
            boxShadow: "0 0 6px #22c55e",
            animation: "pulse 1.5s ease-in-out infinite",
          }}
        />
      </div>

      {/* Справа — часы + кнопка */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "rgba(255,255,255,0.5)",
            fontVariantNumeric: "tabular-nums",
            letterSpacing: 0.5,
          }}
        >
          {time}
        </span>
        <button
          onClick={close}
          title="Закрыть игру"
          style={{
            width: 22,
            height: 22,
            borderRadius: 5,
            background: "rgba(239,68,68,0.12)",
            border: "1px solid rgba(239,68,68,0.25)",
            color: "#fca5a5",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(239,68,68,0.3)";
            e.currentTarget.style.color = "#fff";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(239,68,68,0.12)";
            e.currentTarget.style.color = "#fca5a5";
          }}
        >
          <Power size={11} weight="fill" />
        </button>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.85); }
        }
      `}</style>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<McBar />);
