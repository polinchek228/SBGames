import React from "react";

// ─── ErrorBoundary ──────────────────────────────────────────────────────────
// Раньше любой throw в дереве (синхронный в рендере или асинхронный, упавший в
// setState-фазу) приводил к размонтированию всего React-дерева. Так как у body
// и корневого контейнера background:#000, юзер видел чистый чёрный экран — без
// ошибки, без способа понять что случилось (особенно на macOS WKWebView, где
// invoke/WS при первом монтировании MainLayout могут падать).
//
// Этот boundary ловит ошибку и показывает читаемый fallback со стеком + кнопкой
// «Перезайти». Ошибка пишется в localStorage для дальнейшей диагностики.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null, showStack: false };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    this.setState({ info });
    try {
      localStorage.setItem("sbg_last_error", JSON.stringify({
        time: Date.now(),
        message: error?.message || String(error),
        stack: error?.stack || "",
        componentStack: info?.componentStack || "",
      }));
    } catch {}
    console.error("[ErrorBoundary]", error, info);
  }

  handleRelogin = () => {
    try {
      localStorage.removeItem("sbgames_user");
      localStorage.removeItem("sbgames_token");
    } catch {}
    // Перезагружаем — стартуем с чистого экрана логина.
    window.location.reload();
  };

  handleRetry = () => {
    this.setState({ error: null, info: null, showStack: false });
  };

  render() {
    const { error, info, showStack } = this.state;
    if (!error) return this.props.children;

    const stack = (error.stack || "") + "\n" + (info?.componentStack || "");

    return (
      <div style={{
        position: "absolute", inset: 0, display: "flex",
        alignItems: "center", justifyContent: "center",
        background: "#0a0a0f", color: "#fff", padding: 24,
        fontFamily: "system-ui, -apple-system, sans-serif",
        overflow: "auto",
      }}>
        <div style={{ maxWidth: 560, width: "100%", textAlign: "center" }}>
          <div style={{
            width: 56, height: 56, margin: "0 auto 16px",
            borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(239,68,68,0.12)",
            border: "1px solid rgba(239,68,68,0.3)",
            fontSize: 28,
          }}>⚠</div>

          <h1 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 8px" }}>
            Что-то сломалось
          </h1>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", margin: "0 0 20px" }}>
            Произошла ошибка при загрузке лаунчера. Можно перезайти или показать детали.
          </p>

          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 16 }}>
            <button onClick={this.handleRelogin} style={{
              padding: "10px 20px", borderRadius: 10, cursor: "pointer",
              background: "linear-gradient(135deg,#2563eb,#3b82f6)", border: "none",
              color: "#fff", fontSize: 13, fontWeight: 600,
            }}>
              Перезайти
            </button>
            <button onClick={this.handleRetry} style={{
              padding: "10px 20px", borderRadius: 10, cursor: "pointer",
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: 500,
            }}>
              Повторить
            </button>
          </div>

          <div style={{ textAlign: "left" }}>
            <button onClick={() => this.setState(s => ({ showStack: !s.showStack }))} style={{
              background: "none", border: "none", cursor: "pointer",
              color: "rgba(255,255,255,0.4)", fontSize: 11, padding: 4,
            }}>
              {showStack ? "▼ Скрыть детали" : "▶ Показать детали ошибки"}
            </button>
            {showStack && (
              <pre style={{
                marginTop: 8, padding: 12, borderRadius: 10,
                background: "#000", border: "1px solid rgba(255,255,255,0.08)",
                color: "#f87171", fontSize: 11, lineHeight: 1.5,
                overflow: "auto", maxHeight: 260, whiteSpace: "pre-wrap", wordBreak: "break-word",
              }}>
                {error?.message || String(error)}{"\n\n"}{stack}
              </pre>
            )}
          </div>
        </div>
      </div>
    );
  }
}
