import React from "react";
import { motion } from "framer-motion";
import { DownloadSimple } from "@phosphor-icons/react";

/**
 * Универсальная кнопка «Скачать», открывает модалку скачивания.
 *
 * @param {function} onDownloadClick — колбэк открытия модалки (из DownloadPage)
 * @param {string}   variant        — "primary" | "ghost"
 * @param {string}   label          — текст кнопки (по умолчанию «Скачать»)
 */
export default function DownloadTrigger({
  onDownloadClick,
  variant = "primary",
  label = "Скачать",
  full = false,
}) {
  const base = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: "14px 28px",
    borderRadius: 12,
    fontWeight: 800,
    fontSize: 13,
    letterSpacing: "0.04em",
    cursor: "pointer",
    textDecoration: "none",
    whiteSpace: "nowrap",
    ...(full ? { width: "100%" } : {}),
  };

  const variants = {
    primary: {
      background: "#fff", color: "#000",
    },
    ghost: {
      background: "rgba(255,255,255,0.05)", color: "#fff",
      border: "1px solid rgba(255,255,255,0.08)",
    },
  };

  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={onDownloadClick}
      aria-label={`Скачать ${label}`}
      style={{ ...base, ...variants[variant], border: variant === "ghost" ? "1px solid rgba(255,255,255,0.08)" : "1px solid transparent" }}
    >
      <DownloadSimple size={16} weight="bold" />
      {label}
    </motion.button>
  );
}
