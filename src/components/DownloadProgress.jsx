import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { listen } from "../lib/tauri.js";

export default function DownloadProgress() {
  const [progress, setProgress] = useState(null);
  const unlistenRef = useRef(null);

  useEffect(() => {
    listen("download_progress", (e) => {
      setProgress(e.payload);
    }).then(fn => { unlistenRef.current = fn; });
    return () => { unlistenRef.current?.(); unlistenRef.current = null; };
  }, []);

  const formatSize = (bytes) => {
    if (!bytes) return "0 КБ";
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} КБ`;
    }
    return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
  };

  const formatSpeed = (kbs) => {
    if (!kbs) return "0 КБ/с";
    if (kbs < 1024) {
      return `${kbs.toFixed(1)} КБ/с`;
    }
    return `${(kbs / 1024).toFixed(1)} МБ/с`;
  };

  const hasTotal = progress && progress.total > 0;
  const pct = progress && hasTotal ? Math.round((progress.downloaded / progress.total) * 100) : 0;
  const doneStr = progress ? formatSize(progress.downloaded) : "0 КБ";
  const totalStr = progress ? formatSize(progress.total) : "0 КБ";
  const speedStr = progress ? formatSpeed(progress.speed_kbs) : "0 КБ/с";

  return (
    <AnimatePresence>
      {progress && pct < 100 && (
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 380, damping: 26 }}
          className="fixed bottom-5 right-5 z-50 w-[340px] rounded-2xl p-4 flex flex-col gap-3 overflow-hidden border"
          style={{ 
            background: "rgba(10,10,16,0.65)", 
            backdropFilter: "blur(20px)",
            borderColor: "rgba(255,255,255,0.06)",
            boxShadow: "0 20px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)" 
          }}
        >
          {/* Ambient Glow */}
          <div className="absolute -inset-10 bg-blue-500/10 rounded-full blur-[40px] pointer-events-none" />

          <div className="relative z-10 flex items-center justify-between">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-white/90">Загрузка ресурсов</p>
            <span className="text-[10px] font-black tracking-wider uppercase text-blue-400 font-mono px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/15">
              {speedStr}
            </span>
          </div>

          <div className="relative z-10 flex flex-col gap-1">
            <p className="text-[11px] font-bold text-white/80 truncate">
              {progress.file || "Синхронизация файлов..."}
            </p>
            <div className="flex items-center justify-between text-[9px] font-medium text-white/30">
              <span>{hasTotal ? `${doneStr} из ${totalStr}` : doneStr}</span>
              {hasTotal && <span className="font-bold text-white/50">{pct}%</span>}
            </div>
          </div>

          {/* Progress bar */}
          {hasTotal && (
            <div className="relative h-1.5 w-full rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{ background: "linear-gradient(90deg, #3b82f6, #60a5fa)" }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              />
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
