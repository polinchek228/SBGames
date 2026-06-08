import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowClockwise, Megaphone, Eye, ArrowRight, X } from "@phosphor-icons/react";
import { API_URL } from "../lib/api.js";

export default function NewsPage() {
  const [news,       setNews]       = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [detail,     setDetail]     = useState(null);

  const fetchNews = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await fetch(`${API_URL}/news`);
      const data = await res.json();
      if (data.posts) setNews(data.posts);
    } catch {
      // fallback
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchNews(); }, []);

  return (
    <div className="flex flex-col h-full bg-black overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-5 pb-4 flex-shrink-0">
        <div>
          <div className="flex items-center gap-2.5">
            <Megaphone size={20} weight="fill" className="text-white/70" />
            <h1 className="text-[18px] font-display font-black tracking-tight text-white">Новости</h1>
            <span className="text-[9px] font-black tracking-widest text-white bg-red-600 px-2 py-0.5 rounded-md">LIVE</span>
          </div>
          <p className="text-[11px] pl-7 mt-0.5" style={{ color: "rgba(255,255,255,0.25)" }}>
            Из канала @sb7games
          </p>
        </div>
        <button onClick={() => fetchNews(true)}
          className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors"
          style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)" }}
        >
          <ArrowClockwise size={14} className={refreshing ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {loading ? (
          <div className="flex items-center justify-center h-40 gap-2" style={{ color: "rgba(255,255,255,0.25)" }}>
            <ArrowClockwise size={16} className="animate-spin" />
            <span className="text-[12px]">Загрузка новостей...</span>
          </div>
        ) : news.length === 0 ? (
          <NoNews />
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {news.map((item, i) => (
              <NewsCard key={item.id} item={item} i={i} onClick={() => setDetail(item)} />
            ))}
          </div>
        )}
      </div>

      {/* Detail modal */}
      <AnimatePresence>
        {detail && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/75" onClick={() => setDetail(null)} />
            <motion.div
              initial={{ scale: 0.93, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.93 }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              className="relative z-10 w-[520px] max-h-[70vh] flex flex-col rounded-2xl overflow-hidden"
              style={{ background: "#0c0c0c", boxShadow: "0 24px 80px rgba(0,0,0,0.9)" }}
            >
              {detail.photo && (
                <img src={detail.photo} alt="" className="w-full h-48 object-cover flex-shrink-0" />
              )}
              <div className="p-5 overflow-y-auto flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[15px] font-bold text-white leading-snug">{detail.title || "Новость"}</p>
                  <button onClick={() => setDetail(null)}
                    className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}
                  >
                    <X size={12} />
                  </button>
                </div>
                <p className="text-[13px] leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>
                  {detail.text}
                </p>
                <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.2)" }}>{detail.date}</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NewsCard({ item, i, onClick }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.04 }}
      onClick={onClick}
      className="flex flex-col rounded-2xl overflow-hidden transition-all duration-200 cursor-pointer group"
      style={{ background: "#0a0a0a" }}
      onMouseEnter={e => { e.currentTarget.style.background = "#111"; }}
      onMouseLeave={e => { e.currentTarget.style.background = "#0a0a0a"; }}
    >
      {/* Photo or placeholder */}
      <div className="h-36 flex-shrink-0 overflow-hidden" style={{ background: "#111" }}>
        {item.photo ? (
          <img src={item.photo} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Megaphone size={32} style={{ color: "rgba(255,255,255,0.08)" }} />
          </div>
        )}
      </div>

      <div className="p-4 flex flex-col gap-2 flex-1">
        <p className="text-[12px] font-bold text-white leading-snug line-clamp-2 group-hover:text-white/90 transition-colors">
          {item.title || item.text?.slice(0, 60) + "..."}
        </p>
        <p className="text-[10px] leading-relaxed line-clamp-2 flex-1"
          style={{ color: "rgba(255,255,255,0.38)" }}
        >
          {item.text}
        </p>

        <div className="flex items-center justify-between pt-2"
          style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
        >
          <span className="text-[9px]" style={{ color: "rgba(255,255,255,0.2)" }}>{item.date}</span>
          <div className="flex items-center gap-1" style={{ color: "rgba(255,255,255,0.3)" }}>
            <span className="text-[9px] font-semibold tracking-wider">ЧИТАТЬ</span>
            <ArrowRight size={10} />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function NoNews() {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <Megaphone size={36} style={{ color: "rgba(255,255,255,0.07)" }} />
      <p className="text-[13px]" style={{ color: "rgba(255,255,255,0.2)" }}>Нет новостей</p>
      <a href="https://t.me/sb7games" target="_blank" rel="noreferrer"
        className="text-[11px] text-blue-400/60 hover:text-blue-400 transition-colors"
      >
        @sb7games в Telegram
      </a>
    </div>
  );
}
