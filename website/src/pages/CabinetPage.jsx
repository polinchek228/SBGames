import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { API_URL } from "../lib/api.js";
import { motion } from "framer-motion";
import { Coins, UploadSimple, ArrowCounterClockwise } from "@phosphor-icons/react";
import * as skinview3d from "skinview3d";

export default function CabinetPage({ user }) {
  const canvasRef = useRef(null);
  const viewerRef = useRef(null);
  const fileRef   = useRef(null);
  const wrapRef   = useRef(null);

  const [autoRotate, setAutoRotate] = useState(true);
  const [skinFile,   setSkinFile]   = useState(null);
  const [skinError,  setSkinError]  = useState(false);

  const bal      = user?.balance ?? 0;
  const username = user?.username ?? "—";
  const telegram = user?.telegram ? `@${user.telegram}` : "не привязан";
  const regDate  = user?.createdAt ? new Date(user.createdAt).toLocaleDateString("ru-RU") : "—";
  const skinUnlocked = bal >= 1000;

  // Инициализация 3D вьюера
  useEffect(() => {
    if (!canvasRef.current || !wrapRef.current) return;

    const w = wrapRef.current.offsetWidth  || 280;
    const h = 360;

    // Явно задаём размер канваса в пикселях
    canvasRef.current.width  = w;
    canvasRef.current.height = h;

    const skinUrl = skinFile
      ? URL.createObjectURL(skinFile)
      : `${API_URL}/skin-proxy/${username === "—" ? "Steve" : username}`;

    setSkinError(false);

    const viewer = new skinview3d.SkinViewer({
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
    viewerRef.current      = viewer;

    return () => { viewer.dispose(); viewerRef.current = null; };
  }, [username, skinFile]);

  useEffect(() => {
    if (viewerRef.current) viewerRef.current.autoRotate = autoRotate;
  }, [autoRotate]);

  return (
    <main style={{ background: "#000", minHeight: "100vh", color: "#fff" }}>
      <div style={{ maxWidth: 1060, margin: "0 auto", padding: "28px 24px 80px" }}>

        {/* ── Шапка профиля ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 20, padding: "22px 28px", marginBottom: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{
              width: 52, height: 52, borderRadius: 14, overflow: "hidden",
              border: "1px solid rgba(255,255,255,0.1)", flexShrink: 0,
            }}>
              <img src="/logo.jpg" alt="logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 3 }}>{username}</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>
                {telegram} · с {regDate}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              background: "rgba(37,99,235,0.12)", border: "1px solid rgba(59,130,246,0.2)",
              borderRadius: 12, padding: "10px 18px",
            }}>
              <span style={{ fontSize: 20, fontWeight: 900 }}>{bal.toLocaleString("ru-RU")}</span>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontWeight: 700 }}>SBT</span>
            </div>
            <Link to="/topup" style={{
              display: "flex", alignItems: "center", gap: 7,
              background: "#2563eb", borderRadius: 12, padding: "10px 18px",
              fontSize: 13, fontWeight: 700, color: "#fff", textDecoration: "none",
            }}>
              <Coins size={14} weight="fill" /> Пополнить
            </Link>
          </div>
        </motion.div>

        {/* ── Основная сетка ── */}
        <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 14 }}>

          {/* Левая: 3D скин */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.05 }}
            style={{
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 18, overflow: "hidden",
            }}
          >
            <div style={{ padding: "14px 16px 10px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>Скин</span>
              <label style={{
                display: "flex", alignItems: "center", gap: 5, fontSize: 11,
                color: skinUnlocked ? "#60a5fa" : "rgba(255,255,255,0.25)",
                cursor: skinUnlocked ? "pointer" : "default", fontWeight: 600,
              }}>
                <UploadSimple size={12} />
                {skinUnlocked ? "Загрузить" : "1000 SBT"}
                <input ref={fileRef} type="file" accept="image/png" style={{ display: "none" }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) setSkinFile(f); }}
                />
              </label>
            </div>

            {/* Канвас */}
            <div ref={wrapRef} style={{ background: "#050505", width: "100%", height: 360, position: "relative" }}>
              <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "100%", imageRendering: "pixelated" }} />
              {skinError && (
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
                  Не удалось загрузить скин
                </div>
              )}
            </div>

            {/* Управление */}
            <div style={{ padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  onClick={() => setAutoRotate(v => !v)}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    background: autoRotate ? "rgba(37,99,235,0.15)" : "rgba(255,255,255,0.04)",
                    border: autoRotate ? "1px solid rgba(59,130,246,0.3)" : "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 8, padding: "5px 11px", fontSize: 11, fontWeight: 600,
                    color: autoRotate ? "#60a5fa" : "rgba(255,255,255,0.4)", cursor: "pointer",
                  }}
                >
                  Автоповорот {autoRotate ? "вкл" : "выкл"}
                </button>
              </div>
              {skinFile && (
                <button
                  onClick={() => setSkinFile(null)}
                  style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", fontSize: 11, color: "rgba(255,255,255,0.35)", cursor: "pointer" }}
                >
                  <ArrowCounterClockwise size={12} /> Сброс
                </button>
              )}
            </div>
          </motion.div>

          {/* Правая: инфо + настройки */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.08 }}
            style={{ display: "flex", flexDirection: "column", gap: 12 }}
          >
            {/* Инфо о аккаунте */}
            <div style={{
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 16, padding: "20px 22px",
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 14 }}>
                Аккаунт
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  { label: "Ник",        value: username },
                  { label: "Telegram",   value: telegram },
                  { label: "ID",         value: user?.id ? `#${user.id}` : "—" },
                  { label: "Роль",       value: user?.role === "admin" ? "Администратор" : "Игрок" },
                ].map(({ label, value }) => (
                  <div key={label} style={{
                    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: 10, padding: "12px 14px",
                  }}>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Скин-кастомизация */}
            <div style={{
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 16, padding: "20px 22px", flex: 1,
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 14 }}>
                Кастомизация скина
              </div>

              {!skinUnlocked ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Разблокируй за 1000 SBT</div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
                      Загружай свой PNG-скин 64×64 и он появится в 3D-вьювере и в игре.
                    </div>
                  </div>
                  <Link to="/topup" style={{
                    flexShrink: 0, background: "#2563eb", borderRadius: 10, padding: "10px 18px",
                    fontSize: 13, fontWeight: 700, color: "#fff", textDecoration: "none", whiteSpace: "nowrap",
                  }}>
                    Пополнить
                  </Link>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, color: "#4ade80" }}>Разблокировано</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 14 }}>
                    Загрузи квадратный PNG 64×64 или 128×128. Он появится в 3D-вьювере и в игре.
                  </div>
                  <label style={{
                    display: "inline-flex", alignItems: "center", gap: 8,
                    background: "#2563eb", borderRadius: 10, padding: "10px 18px",
                    fontSize: 13, fontWeight: 700, color: "#fff", cursor: "pointer",
                  }}>
                    <UploadSimple size={14} /> Загрузить скин
                    <input type="file" accept="image/png" style={{ display: "none" }}
                      onChange={e => { const f = e.target.files?.[0]; if (f) setSkinFile(f); }}
                    />
                  </label>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </main>
  );
}
