import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { listen } from "../lib/tauri.js";

export default function DownloadProgress() {
  const [progress, setProgress] = useState(null);

  useEffect(() => {
    let unlisten;
    listen("download_progress", (e) => {
      setProgress(e.payload);
    }).then(fn => { unlisten = fn; });
    return () => { if (unlisten) unlisten(); };
  }, []);

  const pct = progress ? Math.round((progress.downloaded / progress.total) * 100) : 0;
  const mbDone  = progress ? (progress.downloaded / 1024 / 1024).toFixed(1) : 0;
  const mbTotal = progress ? (progress.total      / 1024 / 1024).toFixed(1) : 0;
  const speed   = progress ? (progress.speed_kbs  / 1024).toFixed(1) : 0;

  return (
    <AnimatePresence>
      {progress && pct < 100 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.2 }}
          className="fixed bottom-4 right-4 z-50 w-[320px] rounded-2xl p-4 flex flex-col gap-3"
          style={{ background: "rgba(10,10,14,0.97)", boxShadow: "0 8px 40px rgba(0,0,0,0.7)" }}
        >
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-semibold text-white">Подготовка игры</p>
            <span className="text-[11px] font-mono" style={{ color: "rgba(255,255,255,0.4)" }}>
              {speed} МБ/с
            </span>
          </div>

          <p className="text-[10px] truncate" style={{ color: "rgba(255,255,255,0.3)" }}>
            {progress.file}
          </p>

          {/* Progress bar */}
          <div className="relative h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
            <motion.div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{ background: "linear-gradient(90deg, #2563eb, #60a5fa)" }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.3, ease: "linear" }}
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>
              {mbDone} / {mbTotal} МБ
            </span>
            <span className="text-[11px] font-bold tabular-nums" style={{ color: "#60a5fa" }}>
              {pct}%
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
