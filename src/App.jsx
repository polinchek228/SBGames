import React, { useState } from "react";
import { AnimatePresence } from "framer-motion";
import LoginPage from "./pages/LoginPage.jsx";
import MainLayout from "./pages/MainLayout.jsx";
import CustomCursor from "./components/CustomCursor.jsx";
import UpdateNotifier from "./components/UpdateNotifier.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { NotificationProvider } from "./components/NotificationSystem.jsx";

const USER_KEY  = "sbgames_user";
const TOKEN_KEY = "sbgames_token";

// Минимальный контракт, без которого MainLayout бесполезен/небезопасен.
// Если сохранённая сессия не проходит проверку — считаем что юзер не залогинен
// и показываем экран логина (а не падаем в MainLayout с чёрным экраном).
function isValidUser(u) {
  return u && typeof u === "object" &&
    (u.id !== undefined && u.id !== null) &&
    typeof u.username === "string" && u.username.length > 0;
}

// Чтение сохранённой сессии с защитой от мусора/битого JSON.
function loadStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (isValidUser(parsed)) return parsed;
    // Битая/неполная сессия — выкидываем, чтобы не крашить MainLayout.
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TOKEN_KEY);
    return null;
  } catch {
    try { localStorage.removeItem(USER_KEY); } catch {}
    return null;
  }
}

export default function App() {
  const [user, setUser] = useState(() => loadStoredUser());

  const handleLogin = (data) => {
    const candidate = data?.user ?? data;
    const token     = data?.token ?? null;
    // Guard: мусорный/неполный ответ сервера не должен пускать в MainLayout
    // (иначе валился весь рендер → чёрный экран). Молча игнорируем.
    if (!isValidUser(candidate)) {
      console.warn("[App] handleLogin rejected invalid user payload:", data);
      return;
    }
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(candidate));
      if (token) localStorage.setItem(TOKEN_KEY, token);
      // In-memory зеркало на случай, если localStorage в WKWebView ведёт себя
      // нестабильно при перезагрузке/миграции webview.
      window.__sbg_session = candidate;
    } catch {}
    setUser(candidate);
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(TOKEN_KEY);
      window.__sbg_session = null;
    } catch {}
    setUser(null);
  };

  return (
    <ErrorBoundary>
      <NotificationProvider>
        <CustomCursor />
        <UpdateNotifier />
        <AnimatePresence mode="wait">
          {!user ? (
            <LoginPage key="login" onLogin={handleLogin} />
          ) : (
            <MainLayout key="main" user={user} onLogout={handleLogout} />
          )}
        </AnimatePresence>
      </NotificationProvider>
    </ErrorBoundary>
  );
}
