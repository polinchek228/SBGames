import React, { useState, useEffect, Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import { getUser, refreshUser } from "./lib/api.js";

// Lazy-load pages for code splitting
const HomePage = lazy(() => import("./pages/HomePage.jsx"));
const CabinetPage = lazy(() => import("./pages/CabinetPage.jsx"));
const TopupPage = lazy(() => import("./pages/TopupPage.jsx"));
const SupportPage = lazy(() => import("./pages/SupportPage.jsx"));
const RulesPage = lazy(() => import("./pages/RulesPage.jsx"));
const LoginPage = lazy(() => import("./pages/LoginPage.jsx"));
const DownloadPage = lazy(() => import("./pages/DownloadPage.jsx"));
const HowToPlayPage = lazy(() => import("./pages/HowToPlayPage.jsx"));
const AdminPage = lazy(() => import("./pages/AdminPage.jsx"));
const ReferralPage = lazy(() => import("./pages/ReferralPage.jsx"));
const AffiliatePage = lazy(() => import("./pages/AffiliatePage.jsx"));
const ForumIndex = lazy(() => import("./pages/forum/ForumIndex.jsx"));
const ForumCategory = lazy(() => import("./pages/forum/ForumCategory.jsx"));
const ForumArticle = lazy(() => import("./pages/forum/ForumArticle.jsx"));

function RequireAuth({ user, children }) {
  const location = useLocation();
  if (!user) {
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

function InviteRedirect() {
  const { code } = useParams();
  if (code) localStorage.setItem("referral", code.toUpperCase());
  if (getUser()) return <Navigate to="/affiliate/dashboard" replace />;
  return <Navigate to="/login" replace />;
}

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return <div style={{ padding: 40, textAlign: "center" }}>
        <h2>Ошибка</h2>
        <p>{this.state.error?.message}</p>
        <button onClick={() => window.location.reload()}>Перезагрузить</button>
      </div>;
    }
    return this.props.children;
  }
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
        <ErrorBoundary>
          <Suspense fallback={
            <div className="flex items-center justify-center min-h-[60vh]">
              <div className="w-8 h-8 border-2 border-white/20 border-t-blue-500 rounded-full animate-spin" />
            </div>
          }>
            <Routes>
              <Route path="/"           element={<HomePage />} />
              <Route path="/login"      element={<LoginPage onLogin={handleLogin} />} />
              <Route path="/invite/:code" element={<InviteRedirect />} />
              <Route path="/rules"      element={<RulesPage />} />
              <Route path="/download"   element={<DownloadPage />} />
              <Route path="/howtoplay"  element={<HowToPlayPage />} />
              <Route path="/cabinet"    element={<RequireAuth user={user}><CabinetPage user={user} /></RequireAuth>} />
              <Route path="/topup"      element={<RequireAuth user={user}><TopupPage user={user} /></RequireAuth>} />
              <Route path="/support"    element={<RequireAuth user={user}><SupportPage user={user} /></RequireAuth>} />
              <Route path="/admin"      element={<RequireAdmin user={user}><AdminPage user={user} /></RequireAdmin>} />
              <Route path="/affiliate"  element={<ReferralPage />} />
              <Route path="/affiliate/dashboard" element={<RequireAuth user={user}><AffiliatePage user={user} /></RequireAuth>} />
              <Route path="/forum"                element={<ForumIndex />} />
              <Route path="/forum/read/:slug"     element={<ForumArticle />} />
              <Route path="/forum/:category"      element={<ForumCategory />} />
              <Route path="*"           element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </div>
    </BrowserRouter>
  );
}
