import React, { useState, useEffect, useLayoutEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
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
import ReferralPage from "./pages/ReferralPage.jsx";
import AffiliatePage from "./pages/AffiliatePage.jsx";
import { getUser, refreshUser } from "./lib/api.js";

function RequireAuth({ children }) {
  const user = getUser();
  const location = useLocation();
  if (!user) {
    // Preserve the referral code through the redirect so it reaches /login
    // even if the user landed on a protected page via ?ref=CODE.
    const ref = new URLSearchParams(window.location.search).get("ref")
      || localStorage.getItem("referral") || null;
    return <Navigate to="/login" state={{ from: location.pathname, ref }} replace />;
  }
  return children;
}

function RequireAdmin({ user, children }) {
  if (!user || user.role !== "admin") return <Navigate to="/" replace />;
  return children;
}

// Captures ?ref= from ANY page URL and persists it to localStorage so the
// referral code survives navigation, refreshes, and auth redirects. Must live
// inside <BrowserRouter> so useLocation() fires on every route change.
function ReferralCapture() {
  const location = useLocation();
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref) {
      localStorage.setItem("referral", ref);
      // Strip ?ref= from the URL so it doesn't linger / get shared awkwardly.
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [location]);
  return null;
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
        <ReferralCapture />
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
          <Route path="/affiliate"  element={<ReferralPage />} />
          <Route path="/affiliate/dashboard" element={<RequireAuth><AffiliatePage user={user} /></RequireAuth>} />
          <Route path="*"           element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
