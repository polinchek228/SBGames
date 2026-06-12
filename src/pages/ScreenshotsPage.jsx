import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { invoke } from "../lib/tauri.js";
import { Images, X, Download, ChevronLeft } from "lucide-react";

const gridVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.03 } },
};
const cellVariants = {
  hidden: { opacity: 0, scale: 0.9 },
  show:   { opacity: 1, scale: 1, transition: { duration: 0.18 } },
};

function fmt(ts) {
  const d = new Date(ts * 1000);
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit" })
       + " " + d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}
function fmtSize(b) {
  if (b < 1024 * 1024) return (b / 1024).toFixed(0) + " КБ";
  return (b / 1024 / 1024).toFixed(1) + " МБ";
}

export default function ScreenshotsModal({ onClose }) {
  const [shots,    setShots]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState(null);
  const [loadingImg, setLoadingImg] = useState(false);

  useEffect(() => {
    invoke("get_screenshots").then(data => {
      setShots(data || []);
      setLoading(false);
    }).catch(() => {
      setShots([]);
      setLoading(false);
    });
  }, []);

  const openShot = async (shot) => {
    setSelected({ ...shot, b64: null });
    setLoadingImg(true);
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
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        className="relative z-10 flex flex-col rounded-3xl overflow-hidden"
        style={{
          width: "75vw", height: "78vh",
          background: "rgba(8,8,10,0.98)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.9)",
        }}
        initial={{ scale: 0.94, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.94, y: 16 }}
        transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 flex-shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
        >
          {selected ? (
            <motion.button
              onClick={() => setSelected(null)}
              whileTap={{ scale: 0.9 }}
              className="w-7 h-7 rounded-xl flex items-center justify-center transition-all duration-150 flex-shrink-0"
              style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "#fff"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "rgba(255,255,255,0.5)"; }}
            >
              <ChevronLeft size={14} />
            </motion.button>
          ) : (
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(99,102,241,0.12)" }}>
              <Images size={15} style={{ color: "#818cf8" }} />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-bold text-white">
              {selected ? selected.name : "Скриншоты"}
            </p>
            <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.25)" }}>
              {selected
                ? `${fmtSize(selected.size)} · ${fmt(selected.modified)}`
                : loading ? "Загрузка..." : `${shots.length} скриншотов`
              }
            </p>
          </div>

          <div className="flex items-center gap-2">
            {selected && (
              <motion.button
                onClick={downloadShot}
                whileTap={{ scale: 0.9 }}
                className="w-7 h-7 rounded-xl flex items-center justify-center transition-all duration-150"
                style={{ background: "rgba(37,99,235,0.15)", color: "#60a5fa" }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(37,99,235,0.3)"}
                onMouseLeave={e => e.currentTarget.style.background = "rgba(37,99,235,0.15)"}
              >
                <Download size={13} />
              </motion.button>
            )}
            <motion.button
              onClick={onClose}
              whileTap={{ scale: 0.9 }}
              className="w-7 h-7 rounded-xl flex items-center justify-center transition-all duration-150"
              style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "#fff"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "rgba(255,255,255,0.4)"; }}
            >
              <X size={14} />
            </motion.button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          <AnimatePresence mode="wait">
            {selected ? (
              /* Single image view */
              <motion.div
                key="image"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.18 }}
                className="flex items-center justify-center h-full"
              >
                {loadingImg || !selected.b64 ? (
                  <div className="w-10 h-10 border-2 border-white/10 border-t-white/30 rounded-full animate-spin" />
                ) : (
                  <img
                    src={selected.b64}
                    alt={selected.name}
                    className="max-w-full max-h-full rounded-2xl object-contain"
                    style={{ imageRendering: "pixelated", boxShadow: "0 8px 40px rgba(0,0,0,0.6)" }}
                  />
                )}
              </motion.div>
            ) : loading ? (
              /* Skeleton */
              <motion.div key="skeleton" className="grid grid-cols-4 gap-3">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="aspect-video rounded-xl animate-pulse"
                    style={{ background: "rgba(255,255,255,0.04)" }} />
                ))}
              </motion.div>
            ) : shots.length === 0 ? (
              /* Empty state */
              <motion.div
                key="empty"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center h-full gap-4"
                style={{ opacity: 0.4 }}
              >
                <Images size={40} className="text-white" />
                <p className="text-[13px] text-white">Скриншоты не найдены</p>
                <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.5)" }}>
                  Нажми F2 в игре чтобы сделать скриншот
                </p>
              </motion.div>
            ) : (
              /* Grid */
              <motion.div
                key="grid"
                className="grid grid-cols-4 gap-3"
                variants={gridVariants}
                initial="hidden"
                animate="show"
              >
                {shots.map(shot => (
                  <motion.button
                    key={shot.name}
                    variants={cellVariants}
                    onClick={() => openShot(shot)}
                    className="group relative aspect-video rounded-xl overflow-hidden text-left"
                    style={{ background: "rgba(255,255,255,0.04)" }}
                    whileHover={{ scale: 1.03 }}
                    transition={{ duration: 0.12 }}
                  >
                    <div className="absolute inset-0 flex items-center justify-center opacity-30">
                      <Images size={20} className="text-white" />
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex flex-col justify-end p-2.5">
                      <p className="text-[9px] font-medium text-white truncate leading-tight">{shot.name}</p>
                      <p className="text-[8px] mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
                        {fmt(shot.modified)}
                      </p>
                    </div>
                  </motion.button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}
