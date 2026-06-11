import React, { useState } from "react";
import { AnimatePresence } from "framer-motion";
import LoginPage from "./pages/LoginPage.jsx";
import MainLayout from "./pages/MainLayout.jsx";
import CustomCursor from "./components/CustomCursor.jsx";
import { NotificationProvider } from "./components/NotificationSystem.jsx";

export default function App() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("sbgames_user") || "null"); } catch { return null; }
  });

  const handleLogin = (data) => {
    const user  = data?.user  ?? data;
    const token = data?.token ?? null;
    if (!user || typeof user !== "object") return;
    localStorage.setItem("sbgames_user",  JSON.stringify(user));
    if (token) localStorage.setItem("sbgames_token", token);
    setUser(user);
  };

  const handleLogout = () => {
    localStorage.removeItem("sbgames_user");
    localStorage.removeItem("sbgames_token");
    setUser(null);
  };

  return (
    <NotificationProvider>
      <CustomCursor />
      <AnimatePresence>
        {!user ? (
          <LoginPage key="login" onLogin={handleLogin} />
        ) : (
          <MainLayout key="main" user={user} onLogout={handleLogout} />
        )}
      </AnimatePresence>
    </NotificationProvider>
  );
}
