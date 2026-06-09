import React, { useState } from "react";
import { AnimatePresence } from "framer-motion";
import LoginPage from "./pages/LoginPage.jsx";
import MainLayout from "./pages/MainLayout.jsx";
import CustomCursor from "./components/CustomCursor.jsx";

export default function App() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("sbgames_user") || "null"); } catch { return null; }
  });

  const handleLogin = (data) => {
    // data может быть { user, token } или просто user
    const userData = data?.user || data;
    const token    = data?.token;
    localStorage.setItem("sbgames_user", JSON.stringify(userData));
    if (token) localStorage.setItem("sbgames_token", token);
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem("sbgames_user");
    localStorage.removeItem("sbgames_token");
    setUser(null);
  };

  return (
    <>
      <CustomCursor />
      <AnimatePresence mode="wait">
        {!user ? (
          <LoginPage key="login" onLogin={handleLogin} />
        ) : (
          <MainLayout key="main" user={user} onLogout={handleLogout} />
        )}
      </AnimatePresence>
    </>
  );
}
