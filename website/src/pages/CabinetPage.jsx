import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { API_URL } from "../lib/api.js";
import { motion } from "framer-motion";
import {
  Coins, UploadSimple, ArrowCounterClockwise, TelegramLogo,
  IdentificationCard, CalendarBlank, Shield, GameController,
  ArrowRight,
} from "@phosphor-icons/react";
// skinview3d (three.js) грузится динамически в useEffect — ленивая загрузка

export default function CabinetPage({ user }) {
  const canvasRef    = useRef(null);
  const viewerRef    = useRef(null);
  const wrapRef      = useRef(null);

  const [autoRotate, setAutoRotate] = useState(true);
  const [skinFile,   setSkinFile]   = useState(null);

  const bal          = user?.balance ?? 0;
  const username     = user?.username ?? "—";
  const telegram     = user?.telegram ? `@${user.telegram}` : null;
  const regDate      = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric" })
    : "—";
  const isAdmin      = user?.role === "admin";
  const skinUnlocked = bal >= 1000;

  useEffect(() => {
    if (!canvasRef.current || !wrapRef.current) return;
    const w = wrapRef.current.offsetWidth || 240;
    const h = 320;
    canvasRef.current.width  = w;
    canvasRef.current.height = h;

    const skinUrl = skinFile
      ? URL.createObjectURL(skinFile)
      : `${API_URL}/skin-proxy/${username === "—" ? "Steve" : username}`;

    let viewer = null;
    let cancelled = false;
    // Ленивая загрузка тяжёлого three.js/skinview3d — только когда кабинет открыт.
    // UI кабинета рисуется сразу, 3D-модель появляется после подгрузки чанка.
    import("skinview3d").then((skinview3d) => {
      if (cancelled || !canvasRef.current) return;
      viewer = new skinview3d.SkinViewer({
        canvas:     canvasRef.current,
        width:      w,
        height:     h,
        skin:       skinUrl,
        background: 0x000000,
      });
      viewer.animation       = new skinview3d.WalkingAnimation();
      viewer.animation.speed = 0.5;
      viewer.autoRotate      = autoRotate;
      viewer.controls.enableZoom = false;
      viewerRef.current = viewer;
    });

    return () => { cancelled = true; if (viewer) viewer.dispose(); viewerRef.current = null; };
  }, [username, skinFile]);

  useEffect(() => {
    if (viewerRef.current) viewerRef.current.autoRotate = autoRotate;
  }, [autoRotate]);

  return (
    <main className="relative z-10 max-w-4xl mx-auto px-4 pb-16">

      {/* Profile hero */}
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
        className="rounded-2xl mb-4 p-5 flex items-center justify-between flex-wrap gap-4"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
      >
          <div className="flex items-center gap-4">
            {/* Avatar placeholder – first letter of username */}
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-[22px] font-black flex-shrink-0"
              style={{ background: "rgba(37,99,235,0.12)", border: "1px solid rgba(59,130,246,0.2)", color: "#60a5fa" }}>
              {username !== "—" ? username[0].toUpperCase() : "?"}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[22px] font-black text-white leading-none">{username}</span>
                {isAdmin && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded"
                    style={{ background: "#ef4444", color: "#fff" }}>
                    ADMIN
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {telegram && (
                  <span className="flex items-center gap-1 text-[12px]" style={{ color: "rgba(255,255,255,0.4)" }}>
                    <TelegramLogo size={12} color="#60a5fa" />
                    {telegram}
                  </span>
                )}
                {telegram && <span style={{ color: "rgba(255,255,255,0.15)" }}>·</span>}
                <span className="flex items-center gap-1 text-[12px]" style={{ color: "rgba(255,255,255,0.4)" }}>
                  <CalendarBlank size={12} />
                  с {regDate}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-xl px-4 py-2.5"
              style={{ background: "rgba(37,99,235,0.1)", border: "1px solid rgba(59,130,246,0.2)" }}>
              <span className="text-[18px] font-black text-white">{bal.toLocaleString("ru-RU")}</span>
              <span className="text-[11px] font-bold" style={{ color: "rgba(255,255,255,0.4)" }}>SBT</span>
            </div>
            <Link to="/topup"
              className="flex items-center gap-2 rounded-xl px-4 py-2.5 font-bold text-[13px] text-white transition-opacity hover:opacity-90"
              style={{ background: "rgba(37,99,235,0.9)" }}>
              <Coins size={15} weight="fill" />
              Пополнить
            </Link>
          </div>
      </motion.div>

      {/* Main grid */}
      <div className="grid gap-4" style={{ gridTemplateColumns: "240px 1fr" }}>

        {/* Left: skin viewer */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.05 }}
          className="flex flex-col rounded-2xl overflow-hidden"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-[13px] font-bold text-white">Скин</span>
            <label
              className="flex items-center gap-1.5 text-[11px] font-semibold transition-opacity"
              style={{ cursor: skinUnlocked ? "pointer" : "default", color: skinUnlocked ? "#60a5fa" : "rgba(255,255,255,0.2)", opacity: skinUnlocked ? 1 : 0.6 }}>
              <UploadSimple size={12} aria-hidden="true" />
              {skinUnlocked ? "Загрузить" : "1000 SBT"}
              {skinUnlocked && (
                <input type="file" accept="image/png" style={{ display: "none" }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) setSkinFile(f); }} />
              )}
            </label>
          </div>

          <div ref={wrapRef} className="flex-1 relative" style={{ background: "#050505", height: 320 }}>
            <canvas ref={canvasRef}
              style={{ display: "block", width: "100%", height: "100%", imageRendering: "pixelated" }} />
          </div>

          <div className="flex items-center justify-between px-4 py-3"
            style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
            <button onClick={() => setAutoRotate(v => !v)}
              className="flex items-center gap-1.5 text-[11px] font-semibold rounded-lg px-3 py-1.5 transition-all"
              style={autoRotate
                ? { background: "rgba(37,99,235,0.12)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.25)" }
                : { background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.35)", border: "1px solid rgba(255,255,255,0.07)" }
              }>
              Вращение {autoRotate ? "вкл" : "выкл"}
            </button>
            {skinFile && (
              <button onClick={() => setSkinFile(null)}
                className="flex items-center gap-1 text-[11px]"
                style={{ color: "rgba(255,255,255,0.3)", background: "none", border: "none", cursor: "pointer" }}>
                <ArrowCounterClockwise size={12} /> Сброс
              </button>
            )}
          </div>
        </motion.div>

        {/* Right column */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.08 }}
          className="flex flex-col gap-4"
        >
          {/* Account info */}
          <div className="rounded-2xl p-5"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <p className="text-[11px] font-bold tracking-widest uppercase mb-4"
              style={{ color: "rgba(255,255,255,0.3)" }}>Аккаунт</p>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { icon: GameController,    label: "Игровой ник", value: username },
                { icon: TelegramLogo,      label: "Telegram",    value: telegram ?? "не привязан" },
                { icon: IdentificationCard,label: "ID",          value: user?.id ? `#${user.id}` : "—" },
                { icon: Shield,            label: "Роль",        value: isAdmin ? "Администратор" : "Игрок" },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="rounded-xl p-4"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className="flex items-center gap-2 mb-2">
                    <Icon size={13} style={{ color: "rgba(255,255,255,0.3)" }} />
                    <span className="text-[10px] font-bold tracking-wide uppercase"
                      style={{ color: "rgba(255,255,255,0.3)" }}>{label}</span>
                  </div>
                  <span className="text-[14px] font-bold text-white">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Skin customization */}
          <div className="rounded-2xl p-5 flex-1"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <p className="text-[11px] font-bold tracking-widest uppercase mb-4"
              style={{ color: "rgba(255,255,255,0.3)" }}>Скин</p>

            {skinUnlocked ? (
              <div>
                <p className="text-[13px] font-semibold mb-1" style={{ color: "#4ade80" }}>Разблокировано</p>
                <p className="text-[12px] mb-4" style={{ color: "rgba(255,255,255,0.4)" }}>
                  Загрузи квадратный PNG 64×64 или 128×128 — появится в игре.
                </p>
                <label className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 font-bold text-[13px] text-white cursor-pointer hover:opacity-90 transition-opacity"
                  style={{ background: "rgba(37,99,235,0.9)" }}>
                  <UploadSimple size={14} weight="bold" />
                  Загрузить скин
                  <input type="file" accept="image/png" style={{ display: "none" }}
                    onChange={e => { const f = e.target.files?.[0]; if (f) setSkinFile(f); }} />
                </label>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[14px] font-bold text-white mb-1">Разблокируй за 1 000 SBT</p>
                  <p className="text-[12px]" style={{ color: "rgba(255,255,255,0.4)" }}>
                    Загружай свой PNG-скин 64×64 — появится в 3D-вьювере и в игре.
                  </p>
                </div>
                <Link to="/topup"
                  className="flex items-center gap-2 rounded-xl px-4 py-2.5 font-bold text-[13px] text-white flex-shrink-0 hover:opacity-90 transition-opacity"
                  style={{ background: "rgba(37,99,235,0.15)", border: "1px solid rgba(59,130,246,0.3)", color: "#93c5fd" }}>
                  Пополнить <ArrowRight size={13} />
                </Link>
              </div>
            )}
          </div>
        </motion.div>
      </div>

    </main>
  );
}