import React, { useState, useEffect, useLayoutEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import HomePage from "./pages/HomePage.jsx";
import CabinetPage from "./pages/CabinetPage.jsx";
import TopupPage from "./pages/TopupPage.jsx";
import SupportPage from "./pages/SupportPage.jsx";
import RulesPage from "./pages/RulesPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import DownloadPage from "./pages/DownloadPage.jsx";
import HowToPlayPage from "./pages/HowToPlayPage.jsx";
import AdminPage from "./pages/AdminPage.jsx";
import { getUser, refreshUser } from "./lib/api.js";

function RequireAuth({ children }) {
  const user = getUser();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function RequireAdmin({ user, children }) {
  if (!user || user.role !== "admin") return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const [user, setUser] = useState(getUser);

  // При каждом открытии страницы синхронизируем роль с сервером
  useEffect(() => {
    refreshUser(setUser);
  }, []);

  const handleLogin = (u, token) => {
    localStorage.setItem("sbgames_user", JSON.stringify(u));
    if (token) localStorage.setItem("sbgames_token", token);
    setUser(u);
  };

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-black text-white">
        <Navbar user={user} />
        <Routes>
          <Route path="/"           element={<HomePage />} />
          <Route path="/login"      element={<LoginPage onLogin={handleLogin} />} />
          <Route path="/rules"      element={<RulesPage />} />
          <Route path="/download"   element={<DownloadPage />} />
          <Route path="/howtoplay"  element={<HowToPlayPage />} />
          <Route path="/cabinet"    element={<RequireAuth><CabinetPage user={user} /></RequireAuth>} />
          <Route path="/topup"      element={<RequireAuth><TopupPage user={user} /></RequireAuth>} />
          <Route path="/support"    element={<RequireAuth><SupportPage user={user} /></RequireAuth>} />
          <Route path="/admin"      element={<RequireAdmin user={user}><AdminPage user={user} /></RequireAdmin>} />
          <Route path="*"           element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
