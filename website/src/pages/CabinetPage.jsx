import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import * as skinview3d from "skinview3d";

const card = { background: "#0d0d0d", borderRadius: 16 };
const innerCard = { background: "#111", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)" };
const metaLabel = { fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 12 };

export default function CabinetPage({ user }) {
  const canvasRef = useRef(null);
  const viewerRef = useRef(null);
  const [autoRotate, setAutoRotate] = useState(true);

  useEffect(() => {
    if (!canvasRef.current) return;
    const viewer = new skinview3d.SkinViewer({
      canvas: canvasRef.current,
      width: canvasRef.current.offsetWidth || 280,
      height: 360,
      skin: `https://minotar.net/skin/${user?.username || "Steve"}`,
      background: 0x000000,
    });
    viewer.animation = new skinview3d.WalkingAnimation();
    viewer.animation.speed = 0.6;
    viewer.autoRotate = autoRotate;
    viewerRef.current = viewer;
    return () => viewer.dispose();
  }, [user?.username]);

  useEffect(() => {
    if (viewerRef.current) viewerRef.current.autoRotate = autoRotate;
  }, [autoRotate]);

  const bal = user?.balance ?? 0;
  const username = user?.username ?? "—";
  const userId = user?.id ? `#${String(user.id).slice(0, 8)}` : "—";
  const telegram = user?.telegram ? `@${user.telegram}` : "—";

  return (
    <main style={{ background: "#000", minHeight: "100vh", color: "#fff", fontFamily: "inherit" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px 64px" }}>

        {/* TOP USER CARD */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          style={{ ...card, padding: "22px 26px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div style={{
              width: 54, height: 54, borderRadius: 12, flexShrink: 0,
              background: "linear-gradient(135deg,#2563eb,#818cf8)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 22, fontWeight: 900,
            }}>
              {username.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 3 }}>{username}</div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.28)", marginBottom: 7 }}>
                SB GAMES — ТВОЙ ЛЮБИМЫЙ КОМПЛЕКС ИГРОВЫХ МИРОВ
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 15, fontWeight: 700 }}>
                <span style={{ color: "#3b82f6", fontSize: 9 }}>●</span>
                <span>{bal.toLocaleString("ru-RU")}</span>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontWeight: 500 }}>СБТ</span>
              </div>
            </div>
          </div>
          <Link to="/topup" style={{
            border: "1px solid rgba(255,255,255,0.22)", color: "#fff", background: "transparent",
            padding: "11px 22px", borderRadius: 10, fontWeight: 700, fontSize: 12,
            letterSpacing: "0.06em", textDecoration: "none", whiteSpace: "nowrap",
          }}>
            ПОПОЛНИТЬ БАЛАНС ↗
          </Link>
        </motion.div>

        {/* 3-COLUMN GRID */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.1fr 1fr", gap: 16, alignItems: "start" }}>

          {/* LEFT: ПРОФИЛЬ + МИРЫ */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.06 }}
              style={{ ...card, padding: "20px 18px" }}
            >
              <div style={metaLabel}>Профиль</div>
              {[
                { label: "Никнейм",  val: username },
                { label: "ID",       val: userId },
                { label: "Telegram", val: telegram },
              ].map(({ label, val }) => (
                <div key={label} style={{ ...innerCard, padding: "11px 13px", marginBottom: 8 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: 3 }}>
                    {label}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{val}</div>
                </div>
              ))}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              style={{ ...card, padding: "20px 18px" }}
            >
              <div style={metaLabel}>Миры</div>
              <div style={{ ...innerCard, padding: "12px 13px", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: "#3b82f6", fontSize: 9 }}>●</span>
                <span style={{ fontWeight: 600, fontSize: 13 }}>STARWARS</span>
              </div>
            </motion.div>
          </div>

          {/* CENTER: 3D SKIN */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: 0.08 }}
            style={{ ...card, overflow: "hidden", height: 430, position: "relative", display: "flex", flexDirection: "column" }}
          >
            <div style={{
              position: "absolute", top: 13, left: 14, zIndex: 2,
              fontSize: 10, fontWeight: 700, letterSpacing: "0.12em",
              textTransform: "uppercase", color: "rgba(255,255,255,0.3)",
            }}>
              STARWARS MODE
            </div>
            <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#000" }}>
              <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "100%" }} />
            </div>
            <div style={{ padding: "12px 14px", background: "#0d0d0d" }}>
              <button
                onClick={() => setAutoRotate(v => !v)}
                style={{
                  width: "100%", background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.09)",
                  color: "#fff", borderRadius: 10, padding: "11px 0",
                  fontWeight: 700, fontSize: 11, letterSpacing: "0.1em",
                  textTransform: "uppercase", cursor: "pointer",
                }}
              >
                КАСТОМИЗАЦИЯ ДОСТУПНА
              </button>
            </div>
          </motion.div>

          {/* RIGHT: АКТИВНОСТЬ + ПОМОЩЬ */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.06 }}
              style={{ ...card, padding: "20px 18px" }}
            >
              <div style={metaLabel}>Активность</div>
              <div style={{ ...innerCard, padding: "14px 13px" }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#4ade80", marginBottom: 4 }}>
                  +{bal.toLocaleString("ru-RU")}
                </div>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.28)" }}>
                  ПОПОЛНЕНИЕ БАЛАНСА
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <Link to="/support" style={{ ...card, display: "block", padding: "20px 18px", textDecoration: "none", color: "#fff", position: "relative" }}>
                <div style={{ position: "absolute", top: 13, right: 14, fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.22)" }}>
                  ПОМОЩЬ ↗
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6, marginTop: 20 }}>НУЖНА ПОМОЩЬ?</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>
                  Откройте тикет или свяжитесь с поддержкой
                </div>
              </Link>
            </motion.div>
          </div>
        </div>
      </div>
    </main>
  );
}
