import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { invoke } from "../lib/tauri.js";
import { Images, X, Download, Clock } from "lucide-react";

const containerVariants = {
  hidden: {},
  show:  { transition: { staggerChildren: 0.04 } },
};
const itemVariants = {
  hidden: { opacity: 0, scale: 0.92 },
  show:   { opacity: 1, scale: 1, transition: { duration: 0.2 } },
};

function fmt(ts) {
  const d = new Date(ts * 1000);
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit" })
       + " " + d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function fmtSize(bytes) {
  if (bytes < 1024) return bytes + " Б";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " КБ";
  return (bytes / 1024 / 1024).toFixed(1) + " МБ";
}

export default function ScreenshotsPage() {
  const [shots,    setShots]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState(null); // { ...screenshot, b64 }
  const [loadingImg, setLoadingImg] = useState(false);

  useEffect(() => {
    invoke("get_screenshots").then(data => {
      setShots(data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const openShot = async (shot) => {
    setLoadingImg(true);
    setSelected({ ...shot, b64: null });
    const b64 = await invoke("read_screenshot_b64", { path: shot.path });
    setSelected({ ...shot, b64 });
    setLoadingImg(false);
  };

  const downloadShot = () => {
    if (!selected?.b64) return;
    const a = document.createElement("a");
    a.href = selected.b64;
    a.download = selected.name;
    a.click();
  };

  return (
    <div className="flex flex-col h-full" style={{ background: "#050505" }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 flex-shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
      >
        <div className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ background: "rgba(99,102,241,0.12)" }}>
          <Images size={15} style={{ color: "#818cf8" }} />
        </div>
        <div>
          <p className="text-[14px] font-bold text-white">Скриншоты</p>
          <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.25)" }}>
            {loading ? "Загрузка..." : shots.length ? `${shots.length} скриншотов из .minecraft/screenshots` : "Скриншотов не найдено"}
          </p>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-5">
        {loading ? (
          <div className="grid grid-cols-4 gap-3">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="aspect-video rounded-xl animate-pulse"
                style={{ background: "rgba(255,255,255,0.04)" }} />
            ))}
          </div>
        ) : shots.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 opacity-40">
            <Images size={40} className="text-white" />
            <p className="text-[13px] text-white">Скриншоты не найдены</p>
            <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.4)" }}>
              Сделай F2 в игре чтобы сохранить скриншот
            </p>
          </div>
        ) : (
          <motion.div
            className="grid grid-cols-4 gap-3"
            variants={containerVariants}
            initial="hidden"
            animate="show"
          >
            {shots.map(shot => (
              <motion.div key={shot.name} variants={itemVariants}
                onClick={() => openShot(shot)}
                className="group relative aspect-video rounded-xl overflow-hidden cursor-pointer"
                style={{ background: "rgba(255,255,255,0.04)" }}
                whileHover={{ scale: 1.03 }}
                transition={{ duration: 0.15 }}
              >
                {/* Placeholder — реальный превью грузится по клику */}
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 opacity-60 group-hover:opacity-40 transition-opacity">
                  <Images size={20} className="text-white" />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
                  <p className="text-[9px] font-medium text-white truncate">{shot.name}</p>
                  <p className="text-[8px]" style={{ color: "rgba(255,255,255,0.4)" }}>{fmt(shot.modified)}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.92)" }}
            onClick={e => { if (e.target === e.currentTarget) setSelected(null); }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="relative max-w-[85vw] max-h-[85vh] flex flex-col gap-3"
            >
              {/* Toolbar */}
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <p className="text-[12px] font-semibold text-white">{selected.name}</p>
                  <span className="text-[10px] px-2 py-0.5 rounded-lg"
                    style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)" }}>
                    {fmtSize(selected.size)}
                  </span>
                  <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>
                    {fmt(selected.modified)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <motion.button onClick={downloadShot} whileTap={{ scale: 0.9 }}
                    className="w-7 h-7 rounded-xl flex items-center justify-center transition-all"
                    style={{ background: "rgba(37,99,235,0.15)", color: "#60a5fa" }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(37,99,235,0.3)"}
                    onMouseLeave={e => e.currentTarget.style.background = "rgba(37,99,235,0.15)"}
                  >
                    <Download size={13} />
                  </motion.button>
                  <motion.button onClick={() => setSelected(null)} whileTap={{ scale: 0.9 }}
                    className="w-7 h-7 rounded-xl flex items-center justify-center transition-all"
                    style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "#fff"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "rgba(255,255,255,0.5)"; }}
                  >
                    <X size={13} />
                  </motion.button>
                </div>
              </div>

              {/* Image */}
              <div className="rounded-2xl overflow-hidden flex items-center justify-center"
                style={{ minWidth: 400, minHeight: 200, background: "rgba(255,255,255,0.03)" }}>
                {selected.b64 ? (
                  <img src={selected.b64} alt={selected.name}
                    className="max-w-full max-h-[75vh] object-contain"
                    style={{ imageRendering: "pixelated" }}
                  />
                ) : (
                  <div className="flex items-center justify-center w-[640px] h-[360px]">
                    <div className="w-6 h-6 border-2 border-white/10 border-t-white/40 rounded-full animate-spin" />
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
