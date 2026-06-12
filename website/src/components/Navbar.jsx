import React from "react";
import { Link, useLocation } from "react-router-dom";
import { House, User, Coins, Headset, Scroll, Shield } from "@phosphor-icons/react";

const NAV = [
  { to:"/",        label:"Главная",    icon:House    },
  { to:"/cabinet", label:"Кабинет",    icon:User     },
  { to:"/topup",   label:"Пополнение", icon:Coins    },
  { to:"/support", label:"Поддержка",  icon:Headset  },
  { to:"/rules",   label:"Правила",    icon:Scroll   },
  { to:"/admin",   label:"Админ",      icon:Shield   },
];

const LOGO = { width:28, height:28, borderRadius:8, overflow:"hidden", flexShrink:0 };

export default function Navbar({ user }) {
  const { pathname } = useLocation();
  const isAdmin = user?.role === "admin";
  const visibleNav = NAV.filter(({ to }) => to !== "/admin" || isAdmin);
  return (
    <header style={{ position:"sticky", top:0, zIndex:50, display:"flex", justifyContent:"center", padding:"16px 16px 10px" }}>
      <div style={{
        display:"flex", alignItems:"center", gap:2, padding:"6px 8px",
        background:"rgba(10,10,10,0.94)", borderRadius:22,
        border:"1px solid rgba(255,255,255,0.09)",
        boxShadow:"0 4px 32px rgba(0,0,0,0.7)",
        backdropFilter:"blur(24px)", WebkitBackdropFilter:"blur(24px)",
      }}>
        <Link to="/" style={{ display:"flex", alignItems:"center", gap:9, padding:"5px 12px 5px 6px" }}>
          <div style={LOGO}><img src="/logo.jpg" alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/></div>
          <span style={{ fontSize:14, fontWeight:800, letterSpacing:"0.02em", whiteSpace:"nowrap", color:"#fff" }}>
            SBGames
          </span>
        </Link>
        <div style={{ width:1, height:20, background:"rgba(255,255,255,0.1)", margin:"0 6px", flexShrink:0 }} />

        {visibleNav.map(({ to, label, icon:Icon }) => {
          const active = pathname === to;
          return (
            <Link key={to} to={to} style={{
              display:"flex", alignItems:"center", gap:7,
              padding:"8px 14px", borderRadius:14,
              fontSize:13, fontWeight: active ? 700 : 500, whiteSpace:"nowrap",
              background: active ? "rgba(255,255,255,0.08)" : "transparent",
              border: active ? "1px solid rgba(255,255,255,0.2)" : "1px solid transparent",
              color: active ? "#fff" : "rgba(255,255,255,0.4)",
              transition:"all 0.15s",
            }}>
              <Icon size={14} weight={active ? "fill" : "regular"} />
              {label}
            </Link>
          );
        })}
      </div>
    </header>
  );
}
