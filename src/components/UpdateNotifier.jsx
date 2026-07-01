import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { invoke } from "../lib/tauri.js";

export default function UpdateNotifier() {
  const [update, setUpdate] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);
  const [minimized, setMinimized] = useState(false);

  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const result = await invoke("check_for_update");
        if (result?.available) setUpdate(result);
      } catch (e) {
        console.warn("[update] check failed:", e);
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  const handleInstall = async () => {
    setDownloading(true);
    setError(null);
    try {
      await invoke("install_update");
      setDownloading(false);
      setUpdate(null);
    } catch (e) {
      setError(e?.toString() || "Ошибка обновления");
      setDownloading(false);
    }
  };

  if (!update) return null;

  return (
    <AnimatePresence>
      {!minimized && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.96 }}
          transition={{ type: "spring", damping: 28, stiffness: 320 }}
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 9999,
            width: 360,
            background: "rgba(12, 12, 18, 0.97)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 14,
            overflow: "hidden",
            boxShadow: "0 12px 40px rgba(0,0,0,0.6)",
          }}
        >
          {/* Header */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 16px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 34, height: 34, borderRadius: 10,
                background: "rgba(255,255,255,0.05)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M8 12V4M8 4L5 7M8 4L11 7" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div>
                <div style={{ color: "rgba(255,255,255,0.9)", fontWeight: 600, fontSize: 13 }}>
                  Доступно обновление
                </div>
                <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, marginTop: 1, fontFamily: "monospace" }}>
                  v{update.currentVersion} → v{update.version}
                </div>
              </div>
            </div>
            <button
              onClick={() => setMinimized(true)}
              style={{
                background: "none", border: "none", color: "rgba(255,255,255,0.25)",
                cursor: "pointer", fontSize: 16, padding: 4, lineHeight: 1,
              }}
            >
              &minus;
            </button>
          </div>

          {/* Body */}
          <div style={{ padding: "0 16px 14px" }}>
            {update.body && (
              <div style={{
                color: "rgba(255,255,255,0.5)",
                fontSize: 11,
                lineHeight: 1.5,
                marginBottom: 12,
                maxHeight: 60,
                overflow: "auto",
              }}>
                {update.body}
              </div>
            )}

            {error && (
              <div style={{
                background: "rgba(239,68,68,0.08)",
                borderRadius: 8,
                padding: "8px 12px",
                color: "rgba(239,68,68,0.8)",
                fontSize: 11,
                marginBottom: 12,
              }}>
                {error}
              </div>
            )}

            {downloading ? (
              <div>
                <div style={{
                  display: "flex", justifyContent: "space-between",
                  marginBottom: 8, fontSize: 10, color: "rgba(255,255,255,0.4)",
                }}>
                  <span>Загрузка...</span>
                  <span>Не закрывайте лаунчер</span>
                </div>
                <div style={{
                  height: 3, borderRadius: 2,
                  background: "rgba(255,255,255,0.06)",
                  overflow: "hidden",
                }}>
                  <motion.div
                    animate={{ x: ["-100%", "200%"] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                    style={{
                      height: "100%", borderRadius: 2, width: "40%",
                      background: "rgba(255,255,255,0.15)",
                    }}
                  />
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={() => setMinimized(true)}
                  style={{
                    flex: 1, padding: "9px 0", borderRadius: 8,
                    background: "rgba(255,255,255,0.04)",
                    border: "none",
                    color: "rgba(255,255,255,0.5)",
                    fontSize: 11, fontWeight: 500, cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={e => {
                    e.target.style.background = "rgba(255,255,255,0.07)";
                    e.target.style.color = "rgba(255,255,255,0.7)";
                  }}
                  onMouseLeave={e => {
                    e.target.style.background = "rgba(255,255,255,0.04)";
                    e.target.style.color = "rgba(255,255,255,0.5)";
                  }}
                >
                  Позже
                </button>
                <button
                  onClick={handleInstall}
                  style={{
                    flex: 2, padding: "9px 0", borderRadius: 8,
                    background: "rgba(255,255,255,0.08)",
                    border: "none",
                    color: "rgba(255,255,255,0.8)",
                    fontSize: 11, fontWeight: 600, cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={e => { e.target.style.background = "rgba(255,255,255,0.12)"; }}
                  onMouseLeave={e => { e.target.style.background = "rgba(255,255,255,0.08)"; }}
                >
                  Обновить
                </button>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Minimized badge */}
      {minimized && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          onClick={() => setMinimized(false)}
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 9999,
            width: 40,
            height: 40,
            borderRadius: 10,
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M8 12V4M8 4L5 7M8 4L11 7" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
