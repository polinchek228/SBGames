import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Settings, X, Cpu, HardDrive } from "lucide-react";
import { UsersThree } from "@phosphor-icons/react";
import { invoke, notify, setDiscordPresence, clearDiscordPresence, getMinecraftStatus, killMinecraft } from "../lib/tauri.js";

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
  const [launchError, setLaunchError] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [ramGb, setRamGb] = useState(() => {
    return parseInt(localStorage.getItem("sbg_ram_gb") || "4");
  });
  const [javaPath, setJavaPath] = useState(() => {
    return localStorage.getItem("sbg_java_path") || "";
  });

  useEffect(() => {
    localStorage.setItem("sbg_ram_gb", String(ramGb));
  }, [ramGb]);
  useEffect(() => {
    if (javaPath) localStorage.setItem("sbg_java_path", javaPath);
  }, [javaPath]);

  // Прогресс скачивания показывается глобальным DownloadProgress в MainLayout

  // ─── Minecraft running state (single-launch lock) ──────────────────────
  const [mcRunning, setMcRunning] = useState(false);
  const pollRef = useRef(null);
  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const status = await getMinecraftStatus();
        if (!cancelled) setMcRunning(!!status?.running);
      } catch {}
    };
    poll();
    pollRef.current = setInterval(poll, 2000);
    return () => { cancelled = true; if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

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
    setLaunchError(null);
    // Discord — запуск
    await setDiscordPresence(`Играет на ${selected.name}`, "В игре · SB Games", "sbgames");
    try {
      // Реальный запуск через Tauri
      const result = await invoke("launch_minecraft", {
        serverId: selected.id,
        username: user?.username || "Player",
        token: localStorage.getItem("sbgames_token") || "0",
        ramGb,
        javaPath,
      });
      saveSession(selected.id, user?.username);
      await notify("SB Games", `${result}`);
      setMcRunning(true);   // сразу блокируем кнопку
      setLaunching(false);
      setLaunched(true);
      setTimeout(() => setLaunched(false), 4000);
    } catch (err) {
      setLaunchError(String(err));
      setLaunching(false);
    }
  };

  // Закрыть Minecraft (если висит)
  const handleClose = async () => {
    try { await killMinecraft(); } catch {}
    setMcRunning(false);
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

            {/* ИГРАТЬ / В ИГРЕ */}
            {mcRunning ? (
              /* Minecraft запущен — показываем статус + кнопку завершить */
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2.5 h-[44px] px-6 rounded-2xl font-black text-[13px] tracking-widest uppercase"
                  style={{ background: "rgba(22,163,74,0.15)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.2)" }}>
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  В ИГРЕ
                </div>
                <motion.button
                  onClick={handleClose}
                  whileTap={{ scale: 0.95 }}
                  className="h-[44px] px-4 rounded-2xl font-bold text-[11px] tracking-wider uppercase transition-all"
                  style={{ background: "rgba(239,68,68,0.12)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.2)" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.25)"; e.currentTarget.style.color = "#fff"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(239,68,68,0.12)"; e.currentTarget.style.color = "#fca5a5"; }}
                  title="Завершить игру"
                >
                  <X size={14} />
                </motion.button>
              </div>
            ) : (
              <motion.button
                onClick={handlePlay}
                data-launch-btn
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
            )}

            {/* Шестерёнка настроек запуска */}
            <motion.button
              onClick={() => setShowSettings(true)}
              whileTap={{ scale: 0.9 }}
              className="absolute top-4 right-4 w-9 h-9 rounded-xl flex items-center justify-center transition-all"
              style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "#fff"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "rgba(255,255,255,0.4)"; }}
              title="Настройки запуска"
            >
              <Settings size={15} />
            </motion.button>

            {/* Ошибка запуска */}
            <AnimatePresence>
              {launchError && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                  className="absolute bottom-6 left-1/2 -translate-x-1/2 max-w-[480px] rounded-xl px-4 py-3 text-[12px]"
                  style={{ background: "rgba(220,38,38,0.15)", color: "#fca5a5", border: "1px solid rgba(220,38,38,0.3)" }}
                >
                  <p className="font-bold mb-1">Не удалось запустить</p>
                  <p className="text-[11px] opacity-80">{launchError}</p>
                  <button onClick={() => setLaunchError(null)}
                    className="absolute top-1 right-2 text-[14px] opacity-50 hover:opacity-100"
                    style={{ color: "#fca5a5" }}
                  >×</button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Модал настроек запуска */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}
            onClick={e => { if (e.target === e.currentTarget) setShowSettings(false); }}
          >
            <motion.div
              initial={{ scale: 0.94, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.94, y: 12 }}
              transition={{ duration: 0.18 }}
              className="w-[420px] rounded-2xl p-5 flex flex-col gap-4"
              style={{ background: "rgba(10,10,14,0.98)", boxShadow: "0 8px 40px rgba(0,0,0,0.7)" }}
            >
              <div className="flex items-center justify-between">
                <p className="text-[14px] font-bold text-white">Настройки запуска</p>
                <button onClick={() => setShowSettings(false)}
                  className="w-6 h-6 rounded-lg flex items-center justify-center"
                  style={{ color: "rgba(255,255,255,0.3)" }}
                  onMouseEnter={e => e.currentTarget.style.color = "#fff"}
                  onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.3)"}>
                  <X size={12} />
                </button>
              </div>

              {/* RAM */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-widest font-semibold flex items-center gap-2"
                    style={{ color: "rgba(255,255,255,0.4)" }}>
                    <HardDrive size={11} />Оперативная память
                  </span>
                  <span className="text-[12px] font-bold text-white tabular-nums">{ramGb} ГБ</span>
                </div>
                <input type="range" min="1" max="16" step="1" value={ramGb}
                  onChange={e => setRamGb(parseInt(e.target.value))}
                  className="w-full accent-blue-500"
                />
                <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.25)" }}>
                  Рекомендуется 4–8 ГБ. Меньше = меньше FPS, больше = больше FPS но требует RAM.
                </p>
              </div>

              {/* Java path */}
              <div className="flex flex-col gap-2">
                <span className="text-[11px] uppercase tracking-widest font-semibold flex items-center gap-2"
                  style={{ color: "rgba(255,255,255,0.4)" }}>
                  <Cpu size={11} />Путь к Java (опционально)
                </span>
                <input
                  value={javaPath}
                  onChange={e => setJavaPath(e.target.value)}
                  placeholder="C:\Program Files\Java\jdk-17\bin\java.exe"
                  className="w-full rounded-xl text-[12px] px-3 py-2 outline-none"
                  style={{ background: "rgba(255,255,255,0.05)", color: "#fff", fontFamily: "monospace" }}
                />
                <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.25)" }}>
                  Оставь пустым — автодетект (JAVA_HOME, PATH).
                </p>
              </div>

              <button onClick={() => setShowSettings(false)}
                className="w-full h-9 rounded-xl text-[12px] font-semibold text-white"
                style={{ background: "rgba(37,99,235,0.7)" }}
              >
                Сохранить
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
