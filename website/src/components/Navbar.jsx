import React from "react";
import { Link, useLocation } from "react-router-dom";
import { House, User, CurrencyDollar, Headset, Shield, SignOut, GameController } from "@phosphor-icons/react";

const NAV = [
  { to:"/",        label:"Главная",    icon:House          },
  { to:"/cabinet", label:"Кабинет",    icon:User           },
  { to:"/topup",   label:"Пополнение", icon:CurrencyDollar },
  { to:"/support", label:"Поддержка",  icon:Headset        },
  { to:"/rules",   label:"Правила",    icon:Shield         },
];

const CARD = { background:"#0d0d0d", borderRadius:16 };
const LOGO = { width:24, height:24, borderRadius:6, overflow:"hidden", flexShrink:0 };

export default function Navbar({ user, onLogout }) {
  const { pathname } = useLocation();
  return (
    <header style={{ position:"sticky", top:0, zIndex:50, display:"flex", justifyContent:"center", padding:"14px 16px 8px" }}>
      <div style={{
        display:"flex", alignItems:"center", gap:2, padding:"4px 6px",
        background:"rgba(10,10,10,0.92)", borderRadius:20,
        boxShadow:"0 4px 24px rgba(0,0,0,0.6)",
        backdropFilter:"blur(20px)", WebkitBackdropFilter:"blur(20px)",
      }}>
        <Link to="/" style={{ display:"flex", alignItems:"center", gap:8, padding:"4px 10px 4px 6px", marginRight:4 }}>
          <div style={LOGO}><img src="/logo.jpg" alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/></div>
          <span style={{ fontSize:13, fontWeight:900, letterSpacing:"0.02em", whiteSpace:"nowrap" }}>
            <span style={{ color:"#fff" }}>SB</span><span style={{ color:"#818cf8" }}>Games</span>
          </span>
        </Link>

        {NAV.map(({ to, label, icon:Icon }) => {
          const active = pathname === to;
          return (
            <Link key={to} to={to} style={{
              display:"flex", alignItems:"center", gap:6,
              padding:"6px 12px", borderRadius:12,
              fontSize:12, fontWeight:500, whiteSpace:"nowrap",
              background: active ? "rgba(255,255,255,0.95)" : "transparent",
              color: active ? "#000" : "rgba(255,255,255,0.4)",
              transition:"all 0.15s",
            }}>
              <Icon size={13} weight={active ? "fill" : "regular"} />
              {label}
            </Link>
          );
        })}

        <div style={{ width:1, height:16, background:"rgba(255,255,255,0.08)", margin:"0 4px" }} />
        {user ? (
          <button onClick={onLogout} style={{
            display:"flex", alignItems:"center", gap:6, padding:"6px 12px", borderRadius:12,
            fontSize:12, fontWeight:500, color:"rgba(255,255,255,0.35)", background:"transparent",
            border:"none", cursor:"pointer",
          }}
            onMouseEnter={e=>{e.currentTarget.style.color="#f87171";e.currentTarget.style.background="rgba(239,68,68,0.08)";}}
            onMouseLeave={e=>{e.currentTarget.style.color="rgba(255,255,255,0.35)";e.currentTarget.style.background="transparent";}}
          >
            <SignOut size={13}/> Выйти
          </button>
        ) : (
          <Link to="/login" style={{
            display:"flex", alignItems:"center", gap:6, padding:"6px 12px", borderRadius:12,
            fontSize:12, fontWeight:500, color:"rgba(255,255,255,0.4)", background:"transparent", textDecoration:"none",
          }}>
            <User size={13}/> Войти
          </Link>
        )}
      </div>
    </header>
  );
}
