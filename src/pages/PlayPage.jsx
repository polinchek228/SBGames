import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PlayCircle, Users, Lightning, UsersThree } from "@phosphor-icons/react";

const SERVERS = [
  {
    id: "starwars",
    name: "STARWARS",
    subtitle: "Звёздные Войны",
    version: "1.16.5",
    online: 8420,
    tag: "PvP · Sci-Fi",
    description: "Встань на сторону Ордена Джедаев или Тёмной стороны. Уникальные Force-способности, космические бои и захват планет. Каждый выбор меняет судьбу галактики.",
    bg: "linear-gradient(160deg, #0a0a1f 0%, #050510 60%, #000 100%)",
    accent: "#818cf8",
    emoji: "⚔️",
  },
];

export default function PlayPage({ user, onOpenCommunity }) {
  const [selected, setSelected] = useState(SERVERS[0]);
  const [launching, setLaunching] = useState(false);
  const [launched,  setLaunched]  = useState(false);

  const handlePlay = async () => {
    setLaunching(true);
    await new Promise(r => setTimeout(r, 2500));
    setLaunching(false);
    setLaunched(true);
    setTimeout(() => setLaunched(false), 3000);
  };

  return (
    <div className="relative h-full bg-black overflow-hidden">

      {/* ── Background ── */}
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

      {/* ── Floating sidebar island — centered vertically ── */}
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
                <button key={srv.id} onClick={() => setSelected(srv)} className="w-full text-left focus:outline-none">
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

      {/* ── Main content ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={selected.id + "_c"}
          className="absolute inset-0 flex flex-col justify-end"
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          transition={{ delay: 0.07, duration: 0.3 }}
        >
          <div className="pb-6 pr-8 flex flex-col gap-0" style={{ paddingLeft: 242 }}>
            {/* Tag */}
            <div className="flex items-center gap-2 mb-4">
              <span className="text-[10px] font-bold tracking-widest uppercase px-2.5 py-1 rounded-lg"
                style={{ background: `${selected.accent}18`, color: selected.accent, border: `1px solid ${selected.accent}30` }}
              >{selected.tag}</span>
              <span className="text-[10px] text-white/25 font-mono">{selected.version}</span>
            </div>

            {/* Title */}
            <h1 className="text-[54px] font-display font-black leading-none tracking-tight text-white mb-4" style={{ textShadow: "0 2px 40px rgba(0,0,0,0.8)" }}>
              {selected.name}
            </h1>

            {/* Description */}
            <p className="text-[13px] text-white/55 max-w-[480px] leading-[1.7] mb-7">
              {selected.description}
            </p>

            {/* Bottom bar */}
            <BottomBar
              server={selected}
              launching={launching}
              launched={launched}
              onPlay={handlePlay}
              onCommunity={onOpenCommunity}
            />
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function BottomBar({ server, launching, launched, onPlay, onCommunity }) {
  return (
    <div className="flex items-center gap-2.5">
      {/* Online pill — стилизованный без зелёной хуйни */}
      <div className="flex items-center gap-2.5 rounded-xl px-4 py-2.5"
        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        <span className="text-[15px] font-black text-white tabular-nums leading-none">
          {server.online.toLocaleString("ru-RU")}
        </span>
        <div className="flex flex-col">
          <span className="text-[9px] font-semibold text-white/50 uppercase tracking-wider leading-none">онлайн</span>
        </div>
      </div>

      {/* Community button — рабочая */}
      <button
        onClick={onCommunity}
        className="flex items-center gap-2 rounded-xl px-4 py-2.5 transition-all duration-150"
        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
        onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.09)"; }}
        onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
      >
        <UsersThree size={15} weight="regular" style={{ color: "rgba(255,255,255,0.55)" }} />
        <span className="text-[11px] font-medium text-white/45">Сообщество</span>
      </button>

      <div className="flex-1" />

      {/* Play button */}
      <motion.button
        onClick={onPlay}
        disabled={launching || launched}
        whileTap={{ scale: 0.96 }}
        className="flex items-center gap-2.5 rounded-xl px-7 py-2.5 font-bold text-[13px] tracking-wider transition-all duration-200 disabled:opacity-60"
        style={launched
          ? { background: "#16a34a", color: "#fff", boxShadow: "0 0 20px rgba(22,163,74,0.4)" }
          : { background: "#2563EB", color: "#fff", boxShadow: "0 0 20px rgba(37,99,235,0.4)" }
        }
        onMouseEnter={e => { if (!launching && !launched) e.currentTarget.style.background = "#1d4ed8"; }}
        onMouseLeave={e => { if (!launching && !launched) e.currentTarget.style.background = "#2563EB"; }}
      >
        {launching ? (
          <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Запуск...</>
        ) : launched ? (
          <><Lightning size={15} weight="fill" />Запущено!</>
        ) : (
          <><PlayCircle size={16} weight="fill" />ИГРАТЬ</>
        )}
      </motion.button>
    </div>
  );
}
