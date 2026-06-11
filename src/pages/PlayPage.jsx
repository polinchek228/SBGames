import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, UsersThree } from "@phosphor-icons/react";
import { invoke, notify, setDiscordPresence, clearDiscordPresence } from "../lib/tauri.js";

const SERVERS = [
  {
    id: "starwars",
    name: "STARWARS",
    subtitle: "Звёздные Войны",
    description: "Встань на сторону Ордена Джедаев или Тёмной стороны. Уникальные Force-способности, космические бои и захват планет. Каждый выбор меняет судьбу галактики.",
    bg: "linear-gradient(160deg, #0a0a1f 0%, #050510 60%, #000 100%)",
    accent: "#818cf8",
  },
];

export default function PlayPage({ user, onOpenCommunity }) {
  const [selected,  setSelected]  = useState(SERVERS[0]);
  const [launching, setLaunching] = useState(false);
  const [launched,  setLaunched]  = useState(false);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("serverChange", { detail: { id: selected.id } }));
    // Discord — смена сервера
    setDiscordPresence(`Выбирает сервер: ${selected.name}`, "В лаунчере", "sbgames");
  }, [selected.id]);

  useEffect(() => {
    // Discord RPC при открытии
    setDiscordPresence("В лаунчере", "Выбирает сервер", "sbgames");
    return () => {
      window.dispatchEvent(new CustomEvent("serverChange", { detail: { id: null } }));
    };
  }, []);

  const handlePlay = async () => {
    setLaunching(true);
    // Discord — запуск
    await setDiscordPresence(`Играет на ${selected.name}`, "В игре · SB Games", "sbgames");
    // Запуск через Tauri (с прогрессом)
    await invoke("launch_minecraft", {
      serverId: selected.id,
      username: user?.username || "Player",
      token: localStorage.getItem("sbgames_token") || "",
    });
    setLaunching(false);
    setLaunched(true);
    // Сохраняем сессию
    saveSession(selected.id, user?.username);
    // Системное уведомление
    await notify("SB Games", `Сервер ${selected.name} запущен! Удачной игры, ${user?.username || "игрок"}`);
    setTimeout(() => setLaunched(false), 4000);
  };

  // ─── 10. Session history ──────────────────────────────────────────────────
  function saveSession(serverId, username) {
    try {
      const sessions = JSON.parse(localStorage.getItem("sbgames_sessions") || "[]");
      sessions.unshift({ serverId, username, time: Date.now() });
      localStorage.setItem("sbgames_sessions", JSON.stringify(sessions.slice(0, 50)));
    } catch {}
  }

  return (
    <div className="relative h-full bg-black overflow-hidden">

      {/* Background */}
      <AnimatePresence mode="wait">
        <motion.div key={selected.id + "_bg"} className="absolute inset-0"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="absolute inset-0" style={{ background: selected.bg }} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/20 to-transparent" />
        </motion.div>
      </AnimatePresence>

      {/* ── Sidebar ── */}
      <div className="absolute left-0 top-0 bottom-0 z-10" style={{ width: 220, padding: "16px 0 16px 16px" }}>
        <div className="h-full rounded-2xl flex flex-col overflow-hidden"
          style={{
            background: "rgba(8,8,8,0.92)",
            border: "1px solid rgba(255,255,255,0.07)",
            boxShadow: "0 8px 48px rgba(0,0,0,0.8)",
            backdropFilter: "blur(24px)",
          }}
        >
          {/* Sidebar header */}
          <div className="px-4 pt-4 pb-3 flex-shrink-0"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div className="flex items-center gap-2 mb-1">
              <div className="w-6 h-6 rounded-md overflow-hidden flex-shrink-0">
                <img src="/logo.jpg" alt="" className="w-full h-full object-cover" />
              </div>
              <p className="text-[13px] font-black tracking-wide">
                <span className="text-white">SB </span>
                <span style={{ color: "#818cf8" }}>GAMES</span>
              </p>
            </div>
            <p className="text-[9px] font-semibold tracking-[0.15em] uppercase"
              style={{ color: "rgba(255,255,255,0.25)" }}
            >
              Выберите сервер
            </p>
          </div>

          {/* Server list */}
          <div className="flex-1 overflow-y-auto p-2.5 flex flex-col gap-2">
            {SERVERS.map(srv => {
              const active = selected.id === srv.id;
              return (
                <button key={srv.id} onClick={() => setSelected(srv)}
                  className="w-full text-left focus:outline-none"
                >
                  <motion.div
                    animate={{ opacity: active ? 1 : 0.45 }}
                    whileHover={{ opacity: active ? 1 : 0.75 }}
                    transition={{ duration: 0.15 }}
                    className="relative rounded-xl overflow-hidden"
                    style={{
                      boxShadow: active
                        ? `0 0 0 1.5px ${srv.accent}60, 0 4px 20px ${srv.accent}20`
                        : "none",
                    }}
                  >
                    <div className="h-[90px] relative"
                      style={{ background: srv.bg }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                      {active && (
                        <div className="absolute inset-0"
                          style={{ background: `radial-gradient(ellipse at 30% 100%, ${srv.accent}20, transparent 65%)` }}
                        />
                      )}
                      {active && (
                        <motion.div layoutId="srv-bar"
                          className="absolute bottom-0 left-3 right-3 h-[2.5px] rounded-full"
                          style={{ background: `linear-gradient(90deg, transparent, ${srv.accent}, transparent)` }}
                          transition={{ type: "spring", stiffness: 400, damping: 35 }}
                        />
                      )}
                      <div className="absolute bottom-2.5 left-3">
                        <p className="text-[12px] font-black text-white tracking-wide leading-none">
                          {srv.name}
                        </p>
                        <p className="text-[9px] mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
                          {srv.subtitle}
                        </p>
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
          key={selected.id}
          className="absolute inset-0 flex flex-col"
          style={{ paddingLeft: 252 }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ delay: 0.06, duration: 0.3 }}
        >
          {/* Title + description — сверху */}
          <div className="pt-8 pr-10 flex flex-col gap-3">
            <h1 className="text-[62px] font-display font-black leading-none tracking-tight text-white"
              style={{ textShadow: "0 2px 40px rgba(0,0,0,0.9)" }}
            >
              {selected.name}
            </h1>
            <p className="text-[13px] leading-[1.8] max-w-[500px]"
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              {selected.description}
            </p>
          </div>

          <div className="flex-1" />

          {/* ── Bottom bar ── */}
          <div className="flex items-center gap-2.5 pb-8 pr-8">

            {/* Сообщество — СЛЕВА, широкая с текстом */}
            <button onClick={onOpenCommunity}
              className="flex items-center gap-2.5 h-[44px] px-5 rounded-2xl transition-all duration-150 flex-shrink-0"
              style={{ background: "rgba(255,255,255,0.08)" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.14)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
            >
              <UsersThree size={17} weight="regular" style={{ color: "rgba(255,255,255,0.7)" }} />
              <span className="text-[12px] font-semibold" style={{ color: "rgba(255,255,255,0.6)" }}>
                Сообщество
              </span>
            </button>

            <div className="flex-1" />

            {/* СБТ баланс — СПРАВА */}
            <div className="flex items-center gap-2 rounded-2xl px-4 h-[44px]"
              style={{ background: "rgba(255,255,255,0.08)" }}
            >
              <div className="w-3 h-3 rounded-full bg-blue-500 flex-shrink-0"
                style={{ boxShadow: "0 0 6px rgba(59,130,246,0.7)" }}
              />
              <span className="text-[14px] font-black text-white tabular-nums">
                {(user?.balance ?? 0).toLocaleString("ru-RU")}
              </span>
              <span className="text-[11px] font-bold" style={{ color: "rgba(255,255,255,0.4)" }}>
                СБТ
              </span>
            </div>

            {/* ИГРАТЬ */}
            <motion.button
              onClick={handlePlay}
              disabled={launching || launched}
              whileTap={{ scale: 0.96 }}
              className="flex items-center gap-3 h-[44px] rounded-2xl font-black text-[14px] tracking-widest uppercase disabled:opacity-60 transition-colors duration-150"
              style={{
                padding: "0 32px",
                background: launched ? "#16a34a" : "#2563EB",
                color: "#fff",
                boxShadow: launched
                  ? "0 0 24px rgba(22,163,74,0.4)"
                  : "0 0 24px rgba(37,99,235,0.4)",
              }}
              onMouseEnter={e => { if (!launching && !launched) e.currentTarget.style.background = "#1d4ed8"; }}
              onMouseLeave={e => { if (!launching && !launched) e.currentTarget.style.background = launched ? "#16a34a" : "#2563EB"; }}
            >
              {launching ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ЗАПУСК...
                </>
              ) : launched ? (
                <>✓ ЗАПУЩЕНО</>
              ) : (
                <>
                  ИГРАТЬ
                  <Play size={16} weight="fill" />
                </>
              )}
            </motion.button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
