import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowUpRight } from "@phosphor-icons/react";
import { API_URL } from "../lib/api.js";
import * as skinview3d from "skinview3d";

export default function CabinetPage({ user }) {
  const [skinTab, setSkinTab]   = useState("customize");
  const canvasRef               = useRef(null);
  const viewerRef               = useRef(null);
  const [autoRotate, setAutoRotate] = useState(true);

  useEffect(() => {
    if (!canvasRef.current) return;
    const viewer = new skinview3d.SkinViewer({
      canvas: canvasRef.current,
      width: 260, height: 320,
      skin: `https://minotar.net/skin/${user?.username || "Steve"}`,
      background: 0x000000,
    });
    viewer.animation = new skinview3d.IdleAnimation();
    viewer.animation.speed = 0.5;
    viewer.autoRotate = autoRotate;
    viewerRef.current = viewer;
    return () => viewer.dispose();
  }, [user?.username]);

  useEffect(() => {
    if (viewerRef.current) viewerRef.current.autoRotate = autoRotate;
  }, [autoRotate]);

  const bal = user?.balance ?? 0;

  return (
    <main className="relative z-10 max-w-5xl mx-auto px-4 pb-16">

      {/* User card */}
      <div className="rounded-2xl p-6 mb-5 flex items-center gap-5"
        style={{ background: "rgba(12,12,12,0.95)" }}
      >
        <div className="w-14 h-14 rounded-xl flex items-center justify-center text-[22px] font-black text-white flex-shrink-0"
          style={{ background: "linear-gradient(135deg,#2563EB,#818cf8)" }}
        >
          2
        </div>
        <div className="flex-1">
          <p className="text-[22px] font-black text-white">{user?.username}</p>
          <p className="text-[11px] tracking-widest uppercase mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>
            SB Games — твой любимый комплекс игровых миров
          </p>
          <div className="flex items-center gap-1.5 mt-2">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-500" style={{ boxShadow: "0 0 6px rgba(59,130,246,0.7)" }} />
            <span className="text-[15px] font-black text-white tabular-nums">{bal.toLocaleString("ru-RU")}</span>
            <span className="text-[11px] font-bold" style={{ color: "rgba(255,255,255,0.4)" }}>СБТ</span>
          </div>
        </div>
        <Link to="/topup"
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[12px] font-bold text-white transition-colors"
          style={{ border: "1px solid rgba(255,255,255,0.15)" }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
        >
          Пополнить баланс
          <ArrowUpRight size={13} />
        </Link>
      </div>

      {/* Main 3-col grid */}
      <div className="grid grid-cols-3 gap-4">

        {/* LEFT: профиль + миры */}
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl p-5"
            style={{ background: "rgba(12,12,12,0.95)" }}
          >
            <p className="text-[10px] font-bold tracking-widest uppercase flex items-center gap-1.5 mb-4"
              style={{ color: "rgba(255,255,255,0.5)" }}
            >
              <span>◻</span> Профиль
            </p>
            {[
              { label: "Никнейм",  val: user?.username },
              { label: "ID",       val: `#${user?.id?.slice(0,8)}` },
              { label: "Telegram", val: user?.telegram ? `@${user.telegram}` : "—", blue: !!user?.telegram },
            ].map(({ label, val, blue }) => (
              <div key={label} className="mb-3">
                <p className="text-[9px] uppercase tracking-widest mb-1" style={{ color: "rgba(255,255,255,0.2)" }}>{label}</p>
                <p className="text-[13px] font-semibold rounded-lg px-3 py-2"
                  style={{ background: "rgba(255,255,255,0.04)", color: blue ? "#60a5fa" : "rgba(255,255,255,0.8)" }}
                >
                  {val}
                </p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl p-5"
            style={{ background: "rgba(12,12,12,0.95)" }}
          >
            <p className="text-[10px] font-bold tracking-widest uppercase mb-3" style={{ color: "rgba(255,255,255,0.5)" }}>Миры</p>
            <div className="rounded-xl px-3 py-2.5 flex items-center justify-between"
              style={{ background: "rgba(129,140,248,0.1)", border: "1px solid rgba(129,140,248,0.25)" }}
            >
              <span className="text-[12px] font-bold" style={{ color: "#a5b4fc" }}>STARWARS</span>
              <div className="w-2 h-2 rounded-full" style={{ background: "#818cf8" }} />
            </div>
          </div>
        </div>

        {/* CENTER: 3D skin */}
        <div className="rounded-2xl overflow-hidden flex flex-col"
          style={{ background: "rgba(12,12,12,0.95)" }}
        >
          <div className="px-4 pt-4 pb-2 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.4)" }}>
                STARWARS MODE
              </span>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center bg-black">
            <canvas ref={canvasRef} style={{ display: "block" }} />
          </div>
          <div className="px-4 pb-4 pt-2">
            <button
              className="w-full rounded-xl py-2 text-[11px] font-semibold flex items-center justify-center gap-2 transition-colors"
              style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)" }}
              onClick={() => setAutoRotate(v => !v)}
            >
              ⟳ {autoRotate ? "Авто-вращение вкл" : "Авто-вращение выкл"}
            </button>
          </div>
        </div>

        {/* RIGHT: активность + помощь */}
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl p-5"
            style={{ background: "rgba(12,12,12,0.95)" }}
          >
            <p className="text-[10px] font-bold tracking-widest uppercase flex items-center gap-1.5 mb-4"
              style={{ color: "rgba(255,255,255,0.5)" }}
            >
              <span>◷</span> Активность
            </p>
            <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.04)" }}>
              <p className="text-[18px] font-black text-white">+{(bal).toLocaleString("ru-RU")}</p>
              <p className="text-[9px] uppercase tracking-widest mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>
                Текущий баланс
              </p>
            </div>
          </div>

          <Link to="/support"
            className="rounded-2xl p-5 block transition-colors group"
            style={{ background: "rgba(12,12,12,0.95)" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"; }}
          >
            <p className="text-[9px] font-bold tracking-widest uppercase mb-2" style={{ color: "rgba(255,255,255,0.3)" }}>Помощь ↗</p>
            <p className="text-[18px] font-black text-white leading-tight">НУЖНА<br/>ПОМОЩЬ?</p>
          </Link>
        </div>
      </div>
    </main>
  );
}
