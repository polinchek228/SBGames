import React, { useState } from "react";
import { AnimatePresence } from "framer-motion";
import LoginPage from "./pages/LoginPage.jsx";
import MainLayout from "./pages/MainLayout.jsx";
import CustomCursor from "./components/CustomCursor.jsx";

export default function App() {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem("sbgames_user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const handleLogin = (userData) => {
    localStorage.setItem("sbgames_user", JSON.stringify(userData));
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem("sbgames_user");
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
