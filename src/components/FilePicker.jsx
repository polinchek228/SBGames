import React, { useState, useRef } from "react";
import { motion } from "framer-motion";

export default function FilePicker({ accept, title, hint, onSelect, onClose }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [chosen, setChosen] = useState(null);

  const processFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => setChosen({ file, preview: e.target.result });
    reader.readAsDataURL(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const handleInput = (e) => {
    const file = e.target.files[0];
    if (file) processFile(file);
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <motion.div
        initial={{ scale: 0.93, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.93, y: 12 }}
        transition={{ type: "spring", damping: 28, stiffness: 320 }}
        className="relative z-10 w-[400px] rounded-2xl overflow-hidden"
        style={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 24px 80px rgba(0,0,0,0.9)" }}
      >
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div>
            <p className="text-[13px] font-bold text-white">{title}</p>
            <p className="text-[10px] text-white/30 mt-0.5">{hint}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg text-white/30 hover:text-white hover:bg-white/[0.07] flex items-center justify-center transition-all">
            ✕
          </button>
        </div>

        <div className="p-5">
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className="flex flex-col items-center justify-center gap-3 rounded-xl cursor-pointer transition-all duration-200"
            style={{
              height: 160,
              background: dragging ? "rgba(37,99,235,0.08)" : "rgba(255,255,255,0.02)",
              border: `1.5px dashed ${dragging ? "rgba(37,99,235,0.5)" : "rgba(255,255,255,0.1)"}`,
            }}
          >
            {chosen ? (
              <>
                <img src={chosen.preview} alt="" className="h-16 rounded-lg object-contain" style={{ imageRendering: "pixelated" }} />
                <p className="text-[11px] text-white/50">{chosen.file.name}</p>
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
                  style={{ background: "rgba(255,255,255,0.04)" }}
                >
                  📁
                </div>
                <div className="text-center">
                  <p className="text-[12px] text-white/50">Перетащи файл сюда</p>
                  <p className="text-[10px] text-white/25 mt-0.5">или нажми для выбора</p>
                </div>
              </>
            )}
          </div>
          <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={handleInput} />
        </div>

        <div className="flex items-center gap-2 px-5 pb-5">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-[12px] font-semibold text-white/40 hover:text-white/60 transition-colors"
            style={{ background: "rgba(255,255,255,0.04)" }}
          >
            Отмена
          </button>
          <button
            onClick={() => chosen && onSelect(chosen.file, chosen.preview)}
            disabled={!chosen}
            className="flex-1 py-2.5 rounded-xl text-[12px] font-bold transition-all duration-150 disabled:opacity-30"
            style={{ background: chosen ? "#2563EB" : "rgba(37,99,235,0.3)", color: "#fff" }}
          >
            Применить
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
