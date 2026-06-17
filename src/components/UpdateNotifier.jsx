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
    }, 5000); // проверяем через 5 сек после запуска
    return () => clearTimeout(timer);
  }, []);

  const handleInstall = async () => {
    setDownloading(true);
    setError(null);
    try {
      await invoke("install_update");
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
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 40, scale: 0.95 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 9999,
            width: 380,
            background: "rgba(15, 15, 25, 0.95)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(100, 140, 255, 0.3)",
            borderRadius: 16,
            overflow: "hidden",
            boxShadow: "0 8px 32px rgba(0,0,0,0.6), 0 0 60px rgba(80,120,255,0.1)",
          }}
        >
          {/* Header */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 16px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: "rgba(37,99,235,0.2)",
                border: "1px solid rgba(59,130,246,0.3)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 16, color: "#60a5fa",
              }}>
                &#x2191;
              </div>
              <div>
                <div style={{ color: "#fff", fontWeight: 600, fontSize: 13 }}>
                  Доступно обновление
                </div>
                <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, marginTop: 1 }}>
                  v{update.currentVersion} &rarr; v{update.version}
                </div>
              </div>
            </div>
            <button
              onClick={() => setMinimized(true)}
              style={{
                background: "none", border: "none", color: "rgba(255,255,255,0.4)",
                cursor: "pointer", fontSize: 18, padding: 4, lineHeight: 1,
              }}
            >
              &minus;
            </button>
          </div>

          {/* Body */}
          <div style={{ padding: "12px 16px" }}>
            {update.body && (
              <div style={{
                color: "rgba(255,255,255,0.7)",
                fontSize: 12,
                lineHeight: 1.5,
                marginBottom: 12,
                maxHeight: 80,
                overflow: "auto",
              }}>
                {update.body}
              </div>
            )}

            {error && (
              <div style={{
                background: "rgba(239,68,68,0.15)",
                border: "1px solid rgba(239,68,68,0.3)",
                borderRadius: 8,
                padding: "8px 12px",
                color: "#f87171",
                fontSize: 12,
                marginBottom: 12,
              }}>
                {error}
              </div>
            )}

            {downloading ? (
              <div>
                <div style={{
                  display: "flex", justifyContent: "space-between",
                  marginBottom: 6, fontSize: 11, color: "rgba(255,255,255,0.5)",
                }}>
                  <span>Загрузка обновления...</span>
                  <span>Не закрывайте лаунчер</span>
                </div>
                <div style={{
                  height: 4, borderRadius: 2,
                  background: "rgba(255,255,255,0.1)",
                  overflow: "hidden",
                }}>
                  <motion.div
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 30, ease: "linear" }}
                    style={{
                      height: "100%", borderRadius: 2,
                      background: "linear-gradient(90deg, #3b82f6, #8b5cf6)",
                    }}
                  />
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => setMinimized(true)}
                  style={{
                    flex: 1, padding: "8px 0", borderRadius: 8,
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "rgba(255,255,255,0.6)",
                    fontSize: 12, fontWeight: 500, cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={e => {
                    e.target.style.background = "rgba(255,255,255,0.1)";
                    e.target.style.color = "#fff";
                  }}
                  onMouseLeave={e => {
                    e.target.style.background = "rgba(255,255,255,0.06)";
                    e.target.style.color = "rgba(255,255,255,0.6)";
                  }}
                >
                  Позже
                </button>
                <button
                  onClick={handleInstall}
                  style={{
                    flex: 2, padding: "8px 0", borderRadius: 8,
                    background: "linear-gradient(135deg, #2563eb, #3b82f6)",
                    border: "none",
                    color: "#fff",
                    fontSize: 12, fontWeight: 600, cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={e => { e.target.style.opacity = "0.9"; }}
                  onMouseLeave={e => { e.target.style.opacity = "1"; }}
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
            width: 44,
            height: 44,
            borderRadius: 12,
            background: "linear-gradient(135deg, #2563eb, #3b82f6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            boxShadow: "0 4px 16px rgba(59,130,246,0.4)",
            border: "2px solid rgba(255,255,255,0.2)",
            fontSize: 18,
            color: "#fff",
          }}
        >
          &#x2191;
        </motion.div>
      )}
    </AnimatePresence>
  );
}
