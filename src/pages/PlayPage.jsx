import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PlayCircle, Lightning, UsersThree } from "@phosphor-icons/react";

const SERVERS = [
  {
    id: "starwars",
    name: "STARWARS",
    subtitle: "Звёздные Войны",
    version: "1.16.5",
    tag: "PvP · Sci-Fi",
    description: "Встань на сторону Ордена Джедаев или Тёмной стороны. Уникальные Force-способности, космические бои и захват планет. Каждый выбор меняет судьбу галактики.",
    bg: "linear-gradient(160deg, #0a0a1f 0%, #050510 60%, #000 100%)",
    accent: "#818cf8",
  },
];

export default function PlayPage({ user, onOpenCommunity }) {
  const [selected,  setSelected]  = useState(SERVERS[0]);
  const [launching, setLaunching] = useState(false);
  const [launched,  setLaunched]  = useState(false);

  // Оповещаем курсор о смене сервера
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("serverChange", { detail: { id: selected.id } }));
  }, [selected.id]);

  // При размонтировании — сбрасываем курсор
  useEffect(() => () => {
    window.dispatchEvent(new CustomEvent("serverChange", { detail: { id: null } }));
  }, []);

  const handlePlay = async () => {
    setLaunching(true);
    await new Promise(r => setTimeout(r, 2500));
    setLaunching(false);
    setLaunched(true);
    setTimeout(() => setLaunched(false), 3000);
  };

  const selectServer = (srv) => setSelected(srv);

  return (
    <div className="relative h-full bg-black overflow-hidden">

      {/* Background */}
      <AnimatePresence mode="wait">
        <motion.div key={selected.id + "_bg"} className="absolute inset-0"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="absolute inset-0" style={{ background: selected.bg }} />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/30 to-transparent" />
          <div className="absolute inset-0 opacity-[0.05]"
            style={{ background: `radial-gradient(ellipse at 80% 15%, ${selected.accent}, transparent 55%)` }}
          />
        </motion.div>
      </AnimatePresence>

      {/* Sidebar */}
      <div className="absolute left-0 top-0 bottom-0 z-10 flex items-center" style={{ width: 210, paddingLeft: 16 }}>
        <div className="w-full rounded-2xl overflow-hidden flex flex-col"
          style={{
            background: "rgba(8,8,8,0.93)",
            border: "1px solid rgba(255,255,255,0.07)",
            boxShadow: "0 8px 48px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.04)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
          }}
        >
          <div className="p-2.5 flex flex-col gap-2">
            {SERVERS.map(srv => {
              const active = selected.id === srv.id;
              return (
                <button key={srv.id} onClick={() => selectServer(srv)} className="w-full text-left focus:outline-none">
                  <motion.div
                    animate={{ opacity: active ? 1 : 0.4 }}
                    whileHover={{ opacity: active ? 1 : 0.72 }}
                    transition={{ duration: 0.15 }}
                    className="relative rounded-xl overflow-hidden"
                    style={{ boxShadow: active ? `0 0 0 1.5px ${srv.accent}55, 0 4px 16px ${srv.accent}18` : "none" }}
                  >
                    <div className="h-[86px] relative" style={{ background: srv.bg }}>
                      {active && (
                        <div className="absolute inset-0"
                          style={{ background: `radial-gradient(ellipse at 25% 100%, ${srv.accent}25, transparent 60%)` }}
                        />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/65 to-transparent" />
                      {active && (
                        <motion.div
                          layoutId="server-bar"
                          className="absolute bottom-0 left-3 right-3 h-[3px] rounded-full"
                          style={{ background: `linear-gradient(90deg, transparent, ${srv.accent}, transparent)` }}
                          transition={{ type: "spring", stiffness: 400, damping: 35 }}
                        />
                      )}
                      <div className="absolute bottom-3 left-3">
                        <p className="text-[12px] font-black text-white tracking-wide leading-none">{srv.name}</p>
                        <p className="text-[9px] mt-0.5 text-white/35">{srv.subtitle}</p>
                      </div>
                    </div>
                  </motion.div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main content — заголовок ВВЕРХУ, кнопка внизу */}
      <AnimatePresence mode="wait">
        <motion.div
          key={selected.id + "_c"}
          className="absolute inset-0 flex flex-col"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ delay: 0.07, duration: 0.3 }}
          style={{ paddingLeft: 242 }}
        >
          {/* Top — заголовок и описание */}
          <div className="flex flex-col pt-7 pr-8">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] font-bold tracking-widest uppercase px-2.5 py-1 rounded-lg"
                style={{ background: `${selected.accent}18`, color: selected.accent, border: `1px solid ${selected.accent}30` }}
              >{selected.tag}</span>
              <span className="text-[10px] text-white/25 font-mono">{selected.version}</span>
            </div>

            <h1 className="text-[58px] font-display font-black leading-none tracking-tight text-white mb-3"
              style={{ textShadow: "0 2px 40px rgba(0,0,0,0.8)" }}
            >
              {selected.name}
            </h1>

            <p className="text-[13px] text-white/50 max-w-[480px] leading-[1.75]">
              {selected.description}
            </p>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Bottom — только кнопки */}
          <div className="flex items-center gap-3 pb-8 pr-8">
            {/* Сообщество */}
            <button
              onClick={onOpenCommunity}
              className="flex items-center gap-2 rounded-2xl px-5 py-3.5 transition-all duration-150"
              style={{ background: "rgba(255,255,255,0.06)" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
            >
              <UsersThree size={16} weight="regular" style={{ color: "rgba(255,255,255,0.6)" }} />
              <span className="text-[12px] font-medium text-white/50">Сообщество</span>
            </button>

            <div className="flex-1" />

            {/* Play button — большой */}
            <motion.button
              onClick={handlePlay}
              disabled={launching || launched}
              whileTap={{ scale: 0.96 }}
              className="flex items-center gap-3 rounded-2xl font-black text-[15px] tracking-widest transition-all duration-200 disabled:opacity-60"
              style={{
                padding: "14px 40px",
                background: launched ? "#16a34a" : "#2563EB",
                color: "#fff",
                boxShadow: launched
                  ? "0 0 30px rgba(22,163,74,0.45)"
                  : "0 0 30px rgba(37,99,235,0.45)",
              }}
              onMouseEnter={e => { if (!launching && !launched) e.currentTarget.style.background = "#1d4ed8"; }}
              onMouseLeave={e => { if (!launching && !launched) e.currentTarget.style.background = "#2563EB"; }}
            >
              {launching ? (
                <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />ЗАПУСК...</>
              ) : launched ? (
                <><Lightning size={18} weight="fill" />ЗАПУЩЕНО!</>
              ) : (
                <><PlayCircle size={20} weight="fill" />ИГРАТЬ</>
              )}
            </motion.button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
