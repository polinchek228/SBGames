import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Settings, X, Cpu, HardDrive, AlertTriangle, ShieldAlert, Info } from "lucide-react";
import { UsersThree } from "@phosphor-icons/react";
import { invoke, notifyDesktop, setDiscordPresence, clearDiscordPresence, getMinecraftStatus, killMinecraft } from "../lib/tauri.js";
import { pushLocalActivity } from "../components/RecentActivityCard.jsx";

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
  const [selected,  setSelected]  = useState(null);
  const [launching, setLaunching] = useState(false);
  const [launched,  setLaunched]  = useState(false);
  const [launchError, setLaunchError] = useState(null);
  const [showSettings, setShowSettings] = useState(() => {
    return localStorage.getItem("sbg_play_showSettings") === "1";
  });
  // Modpack security report
  const [modpackReport, setModpackReport] = useState(() => {
    try { return JSON.parse(localStorage.getItem("sbg_play_modpackReport") || "null"); } catch { return null; }
  });
  const [showModpackModal, setShowModpackModal] = useState(() => {
    return localStorage.getItem("sbg_play_showModpackModal") === "1";
  });
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
  const [guardModal, setGuardModal] = useState(() => {
    try { return JSON.parse(localStorage.getItem("sbg_play_guardModal") || "null"); } catch { return null; }
  });  // {reason, detail} или null
  const pollRef = useRef(null);
  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const status = await getMinecraftStatus();
        if (cancelled) return;
        setMcRunning(!!status?.running);
        // Если Rust сообщил что MC был убит защитой — показываем модалку
        if (!status?.running && status?.guard) {
          setGuardModal(status.guard);
        }
      } catch {}
    };
    poll();
    pollRef.current = setInterval(poll, 2000);
    return () => { cancelled = true; if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  // Persist модалок — не сбрасываем при перезаходе
  useEffect(() => {
    localStorage.setItem("sbg_play_showSettings", showSettings ? "1" : "0");
  }, [showSettings]);
  useEffect(() => {
    localStorage.setItem("sbg_play_showModpackModal", showModpackModal ? "1" : "0");
    if (!showModpackModal) localStorage.removeItem("sbg_play_modpackReport");
  }, [showModpackModal]);
  useEffect(() => {
    if (modpackReport) localStorage.setItem("sbg_play_modpackReport", JSON.stringify(modpackReport));
  }, [modpackReport]);
  useEffect(() => {
    if (guardModal) localStorage.setItem("sbg_play_guardModal", JSON.stringify(guardModal));
    else            localStorage.removeItem("sbg_play_guardModal");
  }, [guardModal]);

  useEffect(() => {
    if (!selected) {
      window.dispatchEvent(new CustomEvent("serverChange", { detail: { id: null } }));
      setDiscordPresence("В лаунчере", "Выбирает сервер", "sbgames");
      return;
    }
    window.dispatchEvent(new CustomEvent("serverChange", { detail: { id: selected.id } }));
    // Discord — смена сервера
    setDiscordPresence(`Выбирает сервер: ${selected.name}`, "В лаунчере", "sbgames");
  }, [selected]);

  useEffect(() => {
    // Discord RPC при открытии
    setDiscordPresence("В лаунчере", "Выбирает сервер", "sbgames");
    return () => {
      window.dispatchEvent(new CustomEvent("serverChange", { detail: { id: null } }));
    };
  }, []);

  const handlePlay = async () => {
    if (!selected) return;
    setLaunching(true);
    setLaunchError(null);
    // Discord — запуск
    await setDiscordPresence(`Играет на ${selected.name}`, "В игре · SB Games", "sbgames");
    const startedAt = Date.now();
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
      sessionStorage.setItem("sbg_last_session", JSON.stringify({ serverId: selected.id, startedAt }));
      await notifyDesktop("SB Games", `${result}`);
      setMcRunning(true);   // сразу блокируем кнопку
      setLaunching(false);
      setLaunched(true);
      setTimeout(() => setLaunched(false), 4000);
    } catch (err) {
      const errStr = String(err);
      // Rust возвращает __MODPACK_REPORT__<json> — показываем красивую модалку
      if (errStr.includes("__MODPACK_REPORT__")) {
        try {
          const json = errStr.split("__MODPACK_REPORT__")[1];
          const report = JSON.parse(json);
          setModpackReport(report);
          setShowModpackModal(true);
        } catch {
          setLaunchError(errStr);
        }
      } else {
        setLaunchError(errStr);
      }
      setLaunching(false);
    }
  };

  // Если пользователь согласился удалить подозрительные моды — повторно пытаемся запустить
  const handleModpackClean = async () => {
    setShowModpackModal(false);
    setModpackReport(null);
    setLaunching(true);
    // Удаляем .rejected моды (Rust уже их удалил, но на всякий случай пройдёмся)
    // Перезапускаем handlePlay — Rust снова попробует синхронизировать
    await handlePlay();
  };

  const handleModpackCancel = () => {
    setShowModpackModal(false);
    setModpackReport(null);
  };

  // Закрыть Minecraft (если висит)
  const handleClose = async () => {
    try {
      const raw = sessionStorage.getItem("sbg_last_session");
      if (raw) {
        const s = JSON.parse(raw);
        const durSec = Math.max(0, Math.floor((Date.now() - s.startedAt) / 1000));
        if (durSec > 5) {
          pushLocalActivity(s.serverId, durSec);
          // отправим в бэкенд (best-effort)
          try {
            const token = localStorage.getItem("sbgames_token");
            if (token) {
              fetch("https://api.sbgames.hyperionsearch.xyz:8443/api/activity", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ serverId: s.serverId, startedAt: s.startedAt, endedAt: Date.now(), durationSec: durSec }),
              }).catch(() => {});
            }
          } catch {}
        }
        sessionStorage.removeItem("sbg_last_session");
      }
      await killMinecraft();
    } catch {}
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
    <div className="relative h-full overflow-hidden" style={{ background: "#000" }}>

      {/* Background */}
      <AnimatePresence mode="wait">
        <motion.div key={selected ? selected.id + "_bg" : "empty_bg"} className="absolute inset-0"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
        >
          {selected ? (
            <>
              <div className="absolute inset-0" style={{ background: selected.bg }} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-r from-black/20 to-transparent" />
            </>
          ) : (
            <>
              <div className="absolute inset-0" style={{ backgroundImage: "url('/hero.jpg')", backgroundSize: "cover", backgroundPosition: "center" }} />
              <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at center, rgba(0,0,0,0.5), rgba(0,0,0,0.85))" }} />
            </>
          )}
        </motion.div>
      </AnimatePresence>

      {/* ── Sidebar ── */}
      <div className="absolute left-0 top-0 bottom-0 z-20" style={{ width: 220, padding: "16px 0 16px 16px" }}>
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
              <p className="text-[13px] font-black tracking-wide" style={{ color: "#2563eb" }}>
                SBGames
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
              const active = selected?.id === srv.id;
              return (
                <button key={srv.id} onClick={() => setSelected(selected?.id === srv.id ? null : srv)}
                  className="w-full text-left focus:outline-none"
                >
                  <motion.div
                    animate={{ opacity: active ? 1 : 0.45 }}
                    whileHover={{ opacity: active ? 1 : 0.75 }}
                    transition={{ duration: 0.15 }}
                    className="relative rounded-xl overflow-hidden"
                    style={{
                      boxShadow: active
                        ? `0 0 0 1.5px #2563eb, 0 0 12px rgba(37,99,235,0.4), 0 4px 20px ${srv.accent}20`
                        : "none",
                    }}
                  >
                    <div className="h-[90px] relative"
                      style={{ background: srv.bg }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                      {active && (
                        <div className="absolute inset-0"
                          style={{ background: `radial-gradient(ellipse at 30% 100%, rgba(37,99,235,0.15), transparent 65%)` }}
                        />
                      )}
                      {active && (
                        <motion.div layoutId="srv-bar"
                          className="absolute bottom-0 left-3 right-3 h-[2.5px] rounded-full"
                          style={{ background: "linear-gradient(90deg, transparent, #2563eb, transparent)" }}
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

      {/* ── Content layer ── */}
      {!selected ? (
        /* Hero (when no server selected) */
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
          <div className="text-[64px] font-display font-black leading-none tracking-tight text-white text-center"
            style={{ textShadow: "0 2px 40px rgba(0,0,0,0.9)" }}
          >
            SB GAMES
          </div>
          <div className="text-[56px] font-display font-black leading-none tracking-tight uppercase text-center"
            style={{ color: "rgba(255,255,255,0.22)" }}
          >
            КОМПЛЕКС<br />СЕРВЕРОВ
          </div>
          <p className="text-[15px] font-bold max-w-[460px] text-center mt-4"
            style={{ color: "rgba(255,255,255,0.5)" }}
          >
            Один аккаунт, быстрый старт и разные режимы.
          </p>
        </div>
      ) : (
        /* Server content (when server selected) */
        <div className="absolute inset-0 flex flex-col" style={{ paddingLeft: 252 }}>
          {/* Title + description */}
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

            {/* SBT balance — RIGHT */}
            <div className="flex items-center gap-2 rounded-2xl px-3.5 h-[44px]"
              style={{ background: "rgba(255,255,255,0.08)" }}
            >
              <img src="/money.png" alt="" className="w-5 h-5 flex-shrink-0"
                style={{ filter: "drop-shadow(0 0 4px rgba(250,204,21,0.6))" }}
                onError={e => { e.currentTarget.style.display = "none"; }} />
              <span className="text-[14px] font-black text-white tabular-nums">
                {(user?.balance ?? 0).toLocaleString("en-US")}
              </span>
              <span className="text-[11px] font-bold tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>
                SBT
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
                disabled={launching || launched || !selected}
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
                onMouseEnter={e => { if (!launching && !launched && selected) e.currentTarget.style.background = "#1d4ed8"; }}
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
        </div>
      )}

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

        {/* ─── Modpack security modal ────────────────────────────────────── */}
        {showModpackModal && modpackReport && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center p-6"
            style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
            onClick={e => { if (e.target === e.currentTarget) handleModpackCancel(); }}
          >
            <motion.div
              initial={{ scale: 0.92, y: 12, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 280, damping: 26 }}
              className="w-full max-w-[520px] rounded-3xl p-6 flex flex-col gap-4"
              style={{
                background: "linear-gradient(160deg, rgba(20,20,28,0.98) 0%, rgba(10,10,14,0.98) 100%)",
                border: "1px solid rgba(239,68,68,0.35)",
                boxShadow: "0 0 80px rgba(239,68,68,0.25), 0 24px 60px rgba(0,0,0,0.7)",
              }}
            >
              {/* Header */}
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)" }}>
                  <AlertTriangle size={22} weight="fill" style={{ color: "#fca5a5" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-black text-white">Обнаружена подозрительная активность</p>
                  <p className="text-[11px] mt-1" style={{ color: "rgba(255,255,255,0.55)" }}>
                    Мод-пак SBGames был скомпрометирован. Запуск Minecraft заблокирован.
                  </p>
                </div>
                <button onClick={handleModpackCancel}
                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)" }}>
                  <X size={14} />
                </button>
              </div>

              {/* Issues list */}
              <div className="rounded-2xl p-3 max-h-[280px] overflow-y-auto"
                style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.05)" }}>
                {modpackReport.rejected?.length > 0 && (
                  <div className="mb-3">
                    <p className="text-[10px] uppercase tracking-widest font-bold mb-2"
                      style={{ color: "#fca5a5" }}>Подменённые / повреждённые моды ({modpackReport.rejected.length})</p>
                    {modpackReport.rejected.map((issue, i) => (
                      <div key={i} className="rounded-lg p-2.5 mb-1.5"
                        style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)" }}>
                        <div className="flex items-center gap-2">
                          <ShieldAlert size={11} style={{ color: "#fca5a5", flexShrink: 0 }} />
                          <span className="text-[11px] font-bold text-white font-mono truncate">{issue.name}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded uppercase font-bold"
                            style={{ background: "rgba(239,68,68,0.2)", color: "#fca5a5" }}>
                            {issue.reason === "tampered" ? "Подменён" : issue.reason === "size_mismatch" ? "Размер" : issue.reason}
                          </span>
                        </div>
                        <p className="text-[10px] mt-1 ml-5" style={{ color: "rgba(255,255,255,0.5)" }}>
                          {issue.detail}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {modpackReport.removed?.length > 0 && (
                  <div className="mb-3">
                    <p className="text-[10px] uppercase tracking-widest font-bold mb-2"
                      style={{ color: "#fcd34d" }}>Удалённые сторонние моды ({modpackReport.removed.length})</p>
                    {modpackReport.removed.slice(0, 8).map((issue, i) => (
                      <div key={i} className="rounded-lg p-2 mb-1 flex items-center gap-2"
                        style={{ background: "rgba(252,211,77,0.06)", border: "1px solid rgba(252,211,77,0.12)" }}>
                        <X size={11} style={{ color: "#fcd34d", flexShrink: 0 }} />
                        <span className="text-[11px] font-mono text-white truncate">{issue.name}</span>
                        <span className="text-[9px] ml-auto" style={{ color: "rgba(255,255,255,0.4)" }}>не из пакета</span>
                      </div>
                    ))}
                    {modpackReport.removed.length > 8 && (
                      <p className="text-[10px] mt-1 ml-5" style={{ color: "rgba(255,255,255,0.4)" }}>
                        и ещё {modpackReport.removed.length - 8}...
                      </p>
                    )}
                  </div>
                )}

                {modpackReport.missing?.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-widest font-bold mb-2"
                      style={{ color: "#93c5fd" }}>Отсутствуют ({modpackReport.missing.length})</p>
                    {modpackReport.missing.map((issue, i) => (
                      <div key={i} className="rounded-lg p-2 mb-1"
                        style={{ background: "rgba(147,197,253,0.06)", border: "1px solid rgba(147,197,253,0.12)" }}>
                        <span className="text-[11px] font-mono text-white">{issue.name}</span>
                        <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
                          {issue.detail}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {(!modpackReport.rejected?.length && !modpackReport.removed?.length && !modpackReport.missing?.length) && (
                  <p className="text-[12px] text-center py-4" style={{ color: "rgba(255,255,255,0.4)" }}>
                    Проблемы с мод-паком
                  </p>
                )}
              </div>

              {/* Info */}
              <div className="rounded-xl p-3 flex gap-2.5"
                style={{ background: "rgba(37,99,235,0.08)", border: "1px solid rgba(37,99,235,0.15)" }}>
                <Info size={14} style={{ color: "#2563eb", flexShrink: 0, marginTop: 1 }} />
                <p className="text-[10px] leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>
                  SBGames защищает сервер от читов и подмены файлов. Подозрительные моды
                  автоматически удаляются при запуске. Подозрительные хеши — заблокированы.
                </p>
              </div>

              {/* Buttons */}
              <div className="flex gap-2">
                <button onClick={handleModpackCancel}
                  className="flex-1 h-11 rounded-xl text-[12px] font-semibold transition-all"
                  style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.7)" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}>
                  Отменить запуск
                </button>
                <button onClick={handleModpackClean}
                  className="flex-1 h-11 rounded-xl text-[12px] font-bold text-white transition-all"
                  style={{ background: "linear-gradient(90deg, #2563eb 0%, #2563eb 100%)", boxShadow: "0 0 20px rgba(37,99,235,0.4)" }}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 0 28px rgba(37,99,235,0.6)"; }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 0 20px rgba(37,99,235,0.4)"; }}>
                  Удалить и продолжить
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* ─── Anti-cheat guard modal ────────────────────────────────────── */}
        {guardModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center p-6"
            style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
            onClick={e => { if (e.target === e.currentTarget) setGuardModal(null); }}
          >
            <motion.div
              initial={{ scale: 0.92, y: 12, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 280, damping: 26 }}
              className="w-full max-w-[480px] rounded-3xl p-6 flex flex-col gap-4"
              style={{
                background: "linear-gradient(160deg, rgba(20,20,28,0.98) 0%, rgba(10,10,14,0.98) 100%)",
                border: "1px solid rgba(239,68,68,0.4)",
                boxShadow: "0 0 80px rgba(239,68,68,0.3), 0 24px 60px rgba(0,0,0,0.7)",
              }}
            >
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)" }}>
                  <ShieldAlert size={22} weight="fill" style={{ color: "#fca5a5" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-black text-white">Защита SB Games</p>
                  <p className="text-[11px] mt-1" style={{ color: "rgba(255,255,255,0.55)" }}>
                    {guardModal.reason === "inject"
                      ? "Обнаружена попытка инжекта DLL в Minecraft"
                      : "Обнаружены изменения в мод-паке"}
                  </p>
                </div>
                <button onClick={() => setGuardModal(null)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)" }}>
                  <X size={14} />
                </button>
              </div>

              <div className="rounded-2xl p-3 max-h-[240px] overflow-y-auto"
                style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(239,68,68,0.15)" }}>
                <p className="text-[10px] uppercase tracking-widest font-bold mb-2"
                  style={{ color: "#fca5a5" }}>
                  {guardModal.reason === "inject" ? "Подозрительная DLL" : "Причина"}
                </p>
                <p className="text-[12px] font-mono text-white break-all whitespace-pre-wrap"
                  style={{ lineHeight: 1.5 }}>
                  {guardModal.detail || "—"}
                </p>
              </div>

              <div className="rounded-xl p-3 flex gap-2.5"
                style={{ background: "rgba(37,99,235,0.08)", border: "1px solid rgba(37,99,235,0.15)" }}>
                <Info size={14} style={{ color: "#2563eb", flexShrink: 0, marginTop: 1 }} />
                <p className="text-[10px] leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>
                  Minecraft был автоматически остановлен, чтобы предотвратить
                  нечестную игру. Удалите подозрительное ПО и попробуйте снова.
                </p>
              </div>

              <button onClick={() => setGuardModal(null)}
                className="w-full h-11 rounded-xl text-[12px] font-bold text-white"
                style={{ background: "rgba(255,255,255,0.08)" }}>
                Понятно
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
