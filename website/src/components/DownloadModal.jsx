import React, { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  DownloadSimple, WindowsLogo, AppleLogo, LinuxLogo,
  X, Monitor, DeviceMobile,
} from "@phosphor-icons/react";
import { useDeviceDetect } from "../lib/useDeviceDetect.js";

const PLATFORMS = [
  { id: "windows", icon: WindowsLogo, label: "Windows", sub: "Windows 10 / 11",  ext: ".exe",      color: "#60a5fa" },
  { id: "macos",   icon: AppleLogo,   label: "macOS",   sub: "macOS 10.13+",    ext: ".dmg",      color: "#a1a1aa" },
  { id: "linux",   icon: LinuxLogo,   label: "Linux",   sub: "Ubuntu / Debian", ext: ".AppImage", color: "#86efac" },
];

const DEVICE_LABEL = {
  windows: "Windows",
  macos: "macOS",
  linux: "Linux",
  android: "Android",
  ios: "iOS / iPadOS",
  unknown: "Windows",
};

// Платформы, под которые есть реальный билд (android/ios не имеют лаунчера)
const DOWNLOADABLE = ["windows", "macos", "linux"];

export default function DownloadModal({ open, onClose, manifest, loading }) {
  const { platform: detected, isMobile } = useDeviceDetect();
  const dialogRef = useRef(null);

  // По умолчанию подсвечиваем определённую платформу (если под неё есть билд),
  // иначе откат на Windows.
  const defaultPlatform = DOWNLOADABLE.includes(detected) ? detected : "windows";

  const [selected, setSelected] = React.useState(defaultPlatform);

  // Сбрасываем выбор при каждом открытии (подхватываем свежий auto-detect)
  useEffect(() => {
    if (open) setSelected(defaultPlatform);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Esc → закрыть + блокировка прокрутки body
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  const version = manifest?.version || "v1.0.0";
  const date = manifest?.publishedAt
    ? new Date(manifest.publishedAt).toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric" })
    : null;

  const selectedPlatform = PLATFORMS.find(p => p.id === selected);
  const selectedAsset = manifest?.platforms?.[selected] || null;
  const detectedAsset = manifest?.platforms?.[defaultPlatform] || null;

  // Под мобильные лаунчера нет — показываем подсказку
  const mobileNoBuild = isMobile && !DOWNLOADABLE.includes(detected);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onMouseDown={onClose}
          style={{
            position: "fixed", inset: 0, zIndex: 100,
            display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center",
            padding: isMobile ? 0 : 24,
            background: "rgba(0,0,0,0.72)",
            backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Скачать лаунчер SBGames"
        >
          <motion.div
            ref={dialogRef}
            initial={{ opacity: 0, y: isMobile ? 40 : 16, scale: isMobile ? 1 : 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: isMobile ? 40 : 16, scale: isMobile ? 1 : 0.97 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              width: "100%", maxWidth: isMobile ? "100%" : 440,
              background: "#0f0f14",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: isMobile ? "22px 22px 0 0" : 22,
              boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
              padding: 28,
              position: "relative",
              maxHeight: isMobile ? "92vh" : "auto",
              overflowY: "auto",
            }}
          >
            {/* Close */}
            <button
              onClick={onClose}
              aria-label="Закрыть"
              style={{
                position: "absolute", top: 16, right: 16,
                width: 34, height: 34, borderRadius: 10,
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.5)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", transition: "all 0.15s",
              }}
            >
              <X size={16} weight="bold" />
            </button>

            {/* Заголовок */}
            <div style={{ marginBottom: 22 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)" }}>
                SBGames
              </div>
              <h2 style={{ fontSize: 24, fontWeight: 900, margin: "4px 0 0", letterSpacing: "0.01em" }}>
                Скачать лаунчер
              </h2>
            </div>

            {/* Auto-detect строка */}
            {!mobileNoBuild && (
              <div style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "12px 14px", borderRadius: 12, marginBottom: 14,
                background: `${selectedPlatform.color}12`,
                border: `1px solid ${selectedPlatform.color}30`,
              }}>
                {isMobile ? <DeviceMobile size={18} weight="fill" style={{ color: selectedPlatform.color }} /> : <Monitor size={18} weight="fill" style={{ color: selectedPlatform.color }} />}
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                  Ваше устройство: <strong style={{ color: "#fff" }}>{DEVICE_LABEL[detected]}</strong>
                </span>
              </div>
            )}

            {/* Подсказка для мобилок: лаунчера под них нет */}
            {mobileNoBuild ? (
              <div style={{
                padding: "16px 16px", borderRadius: 14, marginBottom: 16,
                background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <DeviceMobile size={18} weight="fill" color="#f59e0b" />
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#f59e0b" }}>Мобильное устройство</span>
                </div>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.55, margin: 0 }}>
                  Лаунчер доступен только для ПК (Windows, macOS, Linux). Открой эту страницу с компьютера, чтобы скачать.
                </p>
              </div>
            ) : (
              <>
                {/* Главная кнопка под определённую ОС */}
                {loading ? (
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    padding: "16px", borderRadius: 14, marginBottom: 14,
                    background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.3)",
                  }}>
                    <span className="animate-spin" style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.15)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block" }} />
                  </div>
                ) : detectedAsset ? (
                  <motion.a
                    href={detectedAsset.url}
                    download
                    whileTap={{ scale: 0.98 }}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                      padding: "16px", borderRadius: 14, marginBottom: 14,
                      background: selectedPlatform.color, color: "#000",
                      fontWeight: 800, fontSize: 14, textDecoration: "none", cursor: "pointer",
                    }}
                  >
                    <DownloadSimple size={18} weight="bold" />
                    Скачать для {DEVICE_LABEL[defaultPlatform]} {PLATFORMS.find(p => p.id === defaultPlatform)?.ext}
                  </motion.a>
                ) : (
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    padding: "16px", borderRadius: 14, marginBottom: 14,
                    background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.3)", fontWeight: 700, fontSize: 13,
                  }}>
                    Скоро
                  </div>
                )}
              </>
            )}

            {/* Метаданные: версия + дата + размер */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
              <Badge>Версия {version}</Badge>
              {date && <Badge>{date}</Badge>}
              {detectedAsset && <Badge>{(detectedAsset.size / 1024 / 1024).toFixed(1)} МБ</Badge>}
            </div>

            {/* Разделитель */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)" }}>
                или выбери платформу
              </span>
              <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
            </div>

            {/* Ручной выбор платформы */}
            <div style={{ display: "flex", gap: 8 }}>
              {PLATFORMS.map(p => {
                const active = selected === p.id;
                const asset = manifest?.platforms?.[p.id] || null;
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelected(p.id)}
                    style={{
                      flex: 1, padding: "14px 8px", borderRadius: 12,
                      background: active ? `${p.color}14` : "rgba(255,255,255,0.04)",
                      border: `1px solid ${active ? `${p.color}40` : "rgba(255,255,255,0.06)"}`,
                      display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                      cursor: "pointer", transition: "all 0.15s",
                    }}
                  >
                    <p.icon size={22} weight="fill" style={{ color: active ? p.color : "rgba(255,255,255,0.4)" }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: active ? "#fff" : "rgba(255,255,255,0.5)" }}>{p.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Кнопка скачать для ручного выбора (если не совпало с auto) */}
            {!mobileNoBuild && selected !== defaultPlatform && (
              selectedAsset ? (
                <motion.a
                  href={selectedAsset.url}
                  download
                  whileTap={{ scale: 0.98 }}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    marginTop: 14, padding: "13px", borderRadius: 12,
                    background: selectedPlatform.color, color: "#000",
                    fontWeight: 800, fontSize: 13, textDecoration: "none", cursor: "pointer",
                  }}
                >
                  <DownloadSimple size={16} weight="bold" />
                  Скачать для {selectedPlatform.label}
                </motion.a>
              ) : (
                <div style={{
                  marginTop: 14, padding: "13px", borderRadius: 12, textAlign: "center",
                  background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.3)", fontWeight: 700, fontSize: 13,
                }}>
                  Скоро для {selectedPlatform.label}
                </div>
              )
            )}

            {/* Дисклеймер */}
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", lineHeight: 1.5, margin: "18px 0 0", textAlign: "center" }}>
              Бесплатно · Без рекламы · Проверено на вирусы
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Badge({ children }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.45)",
      background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 8, padding: "4px 9px",
    }}>
      {children}
    </span>
  );
}
