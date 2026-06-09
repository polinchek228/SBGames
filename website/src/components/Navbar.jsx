import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  House, User, CurrencyDollar, Headset, Shield, SignOut, SealWarning,
} from "@phosphor-icons/react";

const NAV = [
  { to: "/",        label: "Главная",    icon: House },
  { to: "/cabinet", label: "Кабинет",    icon: User },
  { to: "/topup",   label: "Пополнение", icon: CurrencyDollar },
  { to: "/support", label: "Поддержка",  icon: Headset },
  { to: "/rules",   label: "Правила",    icon: Shield },
];

export default function Navbar({ user, onLogout }) {
  const { pathname } = useLocation();
  const nav = useNavigate();

  return (
    <header className="sticky top-0 z-50 flex justify-center pt-4 pb-2 px-4">
      <div
        className="flex items-center gap-1 px-2 py-1.5 rounded-2xl"
        style={{
          background: "rgba(12,12,12,0.95)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 4px 24px rgba(0,0,0,0.7)",
          backdropFilter: "blur(20px)",
        }}
      >
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 px-2 mr-1">
          <div className="w-6 h-6 rounded-md overflow-hidden flex-shrink-0">
            <img src="/logo.jpg" alt="" className="w-full h-full object-cover" />
          </div>
          <span className="text-[13px] font-black tracking-wide whitespace-nowrap">
            <span className="text-white">SB</span>
            <span style={{ color: "#818cf8" }}>Games</span>
          </span>
        </Link>

        {/* Nav items */}
        {NAV.map(({ to, label, icon: Icon }) => {
          const active = pathname === to;
          return (
            <Link key={to} to={to}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-medium transition-all duration-150 whitespace-nowrap"
              style={active
                ? { background: "rgba(255,255,255,0.1)", color: "#fff" }
                : { color: "rgba(255,255,255,0.38)" }
              }
            >
              <Icon size={13} weight={active ? "fill" : "regular"} />
              {label}
            </Link>
          );
        })}

        {/* Auth */}
        <div className="ml-1 pl-1" style={{ borderLeft: "1px solid rgba(255,255,255,0.08)" }}>
          {user ? (
            <button onClick={onLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-medium transition-all duration-150"
              style={{ color: "rgba(255,255,255,0.38)" }}
              onMouseEnter={e => { e.currentTarget.style.color = "#f87171"; e.currentTarget.style.background = "rgba(239,68,68,0.08)"; }}
              onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.38)"; e.currentTarget.style.background = "transparent"; }}
            >
              <SignOut size={13} />
              Выйти
            </button>
          ) : (
            <Link to="/login"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-medium transition-all"
              style={{ background: "#2563EB", color: "#fff" }}
            >
              <User size={13} />
              Войти
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
