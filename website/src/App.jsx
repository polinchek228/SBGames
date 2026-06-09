import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import Snow from "./components/Snow.jsx";
import HomePage from "./pages/HomePage.jsx";
import CabinetPage from "./pages/CabinetPage.jsx";
import TopupPage from "./pages/TopupPage.jsx";
import SupportPage from "./pages/SupportPage.jsx";
import RulesPage from "./pages/RulesPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import { getUser } from "./lib/api.js";

function RequireAuth({ children }) {
  const user = getUser();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const [user, setUser] = useState(getUser);

  const handleLogin = (u, token) => {
    localStorage.setItem("sbgames_user", JSON.stringify(u));
    if (token) localStorage.setItem("sbgames_token", token);
    setUser(u);
  };
  const handleLogout = () => {
    localStorage.removeItem("sbgames_user");
    localStorage.removeItem("sbgames_token");
    setUser(null);
  };

  return (
    <BrowserRouter>
      <Snow />
      <div className="min-h-screen bg-black text-white">
        <Navbar user={user} onLogout={handleLogout} />
        <Routes>
          <Route path="/"        element={<HomePage />} />
          <Route path="/login"   element={<LoginPage onLogin={handleLogin} />} />
          <Route path="/rules"   element={<RulesPage />} />
          <Route path="/cabinet" element={<RequireAuth><CabinetPage user={user} /></RequireAuth>} />
          <Route path="/topup"   element={<RequireAuth><TopupPage user={user} /></RequireAuth>} />
          <Route path="/support" element={<RequireAuth><SupportPage user={user} /></RequireAuth>} />
          <Route path="*"        element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
