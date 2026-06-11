import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  User, Palette, Settings,
  Send, Check, ChevronRight, Moon, Bell, Shield, Trash2,
  RefreshCw, Cpu, Monitor, Zap, Download, Loader2,
  Package, SlidersHorizontal, CheckCircle2,
} from "lucide-react";
import {
  Clock, Star, GameController, TelegramLogo, Camera,
} from "@phosphor-icons/react";
import * as skinview3d from "skinview3d";

const TABS = [
  { id: "profile",       label: "Профиль",        icon: User },
  { id: "personalize",   label: "Персонализация",  icon: Palette },
  { id: "settings",      label: "Настройки",       icon: Settings },
];

export default function ProfilePage({ user }) {
  const [tab, setTab] = useState("profile");

  return (
    <div className="flex h-full bg-black overflow-hidden">
      {/* Left tab nav */}
      <div className="w-[180px] flex-shrink-0 flex flex-col pt-5 px-3 gap-0.5"
        style={{ borderRight: "1px solid rgba(255,255,255,0.04)" }}
      >
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              className="relative flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[12px] font-medium transition-colors duration-150 text-left"
              style={{ color: active ? "#fff" : "rgba(255,255,255,0.32)" }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.color = "rgba(255,255,255,0.6)"; }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.color = "rgba(255,255,255,0.32)"; }}
            >
              {active && (
                <motion.div layoutId="tab-bg"
                  className="absolute inset-0 rounded-xl"
                  style={{ background: "rgba(255,255,255,0.06)" }}
                  transition={{ type: "spring", stiffness: 400, damping: 35 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-2.5 w-full">
                <Icon size={14} strokeWidth={active ? 2.2 : 1.8} />
                {label}
                {active && <ChevronRight size={11} className="ml-auto" style={{ color: "rgba(255,255,255,0.25)" }} />}
              </span>
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 relative overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            className="absolute inset-0 overflow-y-auto"
          >
            {tab === "profile"     && <ProfileTab user={user} />}
            {tab === "personalize" && <PersonalizeTab user={user} />}
            {tab === "settings"    && <SettingsTab />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Profile Tab
// ─────────────────────────────────────────────────────────────────────────────
const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.25, 0.1, 0.25, 1] } },
};

function ProfileTab({ user }) {
  const username = user?.username || "Player";
  const [avatar, setAvatar] = useState(null);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);

  const stats = [
    { label: "Часов",    value: "148", icon: Clock,          color: "#818cf8" },
    { label: "Уровень",  value: "37",  icon: Star,           color: "#fbbf24" },
    { label: "Серверов", value: "3",   icon: GameController, color: "#34d399" },
  ];

  const isAdmin = user?.role === "admin";

  return (
    <div className="flex gap-4 p-5">
      {/* Left col */}
      <motion.div
        className="flex flex-col gap-3 min-w-0"
        style={{ flex: 1 }}
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {/* Hero card */}
        <motion.div variants={itemVariants}
          className="relative rounded-3xl overflow-hidden"
          style={{ background: "rgba(255,255,255,0.03)" }}
        >
          {/* Ambient glow */}
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: "radial-gradient(ellipse at 20% 50%, rgba(37,99,235,0.08) 0%, transparent 65%)" }}
          />

          <div className="relative flex items-center gap-4 p-5">
            {/* Avatar */}
            <div className="relative flex-shrink-0 cursor-pointer group" onClick={() => setShowAvatarPicker(true)}>
              <div className="w-[80px] h-[80px] rounded-2xl overflow-hidden transition-all duration-300 group-hover:scale-95"
                style={{ background: "rgba(255,255,255,0.06)", boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}
              >
                <img src={avatar || "/logo.jpg"} alt="avatar"
                  className="w-full h-full object-cover transition-all duration-300 group-hover:brightness-50"
                />
              </div>
              <motion.div
                initial={false}
                className="absolute inset-0 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200"
              >
                <Camera size={22} weight="fill" className="text-white drop-shadow-lg" />
              </motion.div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-green-400"
                style={{ boxShadow: "0 0 0 2px #000, 0 0 8px rgba(74,222,128,0.5)" }}
              />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-[20px] font-black text-white leading-none truncate">{username}</p>
                {isAdmin && (
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full tracking-widest"
                    style={{ background: "rgba(239,68,68,0.15)", color: "rgba(252,165,165,0.9)" }}
                  >ADMIN</span>
                )}
              </div>

              {user?.telegram && (
                <p className="flex items-center gap-1 mt-1.5 text-[12px]" style={{ color: "#60a5fa" }}>
                  <TelegramLogo size={12} weight="fill" />
                  @{user.telegram}
                </p>
              )}

              <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                <span className="text-[10px] font-semibold px-2.5 py-1 rounded-xl tracking-wider"
                  style={{ background: "rgba(37,99,235,0.18)", color: "#93c5fd" }}
                >
                  {isAdmin ? "АДМИНИСТРАТОР" : "ИГРОК"}
                </span>
                <span className="text-[10px] px-2.5 py-1 rounded-xl font-mono"
                  style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.25)" }}
                >
                  #{user?.id?.toString().slice(-6) || "000000"}
                </span>
              </div>
            </div>

            {/* Balance */}
            <div className="flex-shrink-0 flex flex-col items-end gap-1">
              <div className="flex items-center gap-2">
                <img src="/money.png" alt="coin" className="w-5 h-5 object-contain"
                  style={{ filter: "drop-shadow(0 0 6px rgba(37,99,235,0.7))" }}
                />
                <span className="text-[26px] font-black text-white tabular-nums leading-none">
                  {(user?.balance ?? 0).toLocaleString("ru-RU")}
                </span>
              </div>
              <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.2)" }}>СБТ баланс</span>
            </div>
          </div>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2.5">
          {stats.map(({ label, value, icon: Icon, color }, i) => (
            <motion.div key={label} variants={itemVariants}
              className="rounded-2xl p-4 flex flex-col gap-3 relative overflow-hidden"
              style={{ background: "rgba(255,255,255,0.03)" }}
              whileHover={{ scale: 1.02, transition: { duration: 0.15 } }}
            >
              <div className="absolute top-0 right-0 w-16 h-16 rounded-full pointer-events-none"
                style={{ background: `radial-gradient(circle, ${color}12 0%, transparent 70%)`, transform: "translate(20%, -20%)" }}
              />
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: `${color}18` }}
              >
                <Icon size={15} weight="fill" style={{ color }} />
              </div>
              <div>
                <p className="text-[26px] font-black leading-none tabular-nums text-white">{value}</p>
                <p className="text-[10px] mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>{label}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Telegram card */}
        <motion.div variants={itemVariants}
          className="rounded-2xl px-4 py-3 flex items-center gap-3"
          style={{ background: "rgba(255,255,255,0.03)" }}
        >
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(37,99,235,0.15)" }}
          >
            <TelegramLogo size={15} weight="fill" style={{ color: "#60a5fa" }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold text-white">Telegram привязан</p>
            <p className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>
              {user?.telegram ? `@${user.telegram}` : "@sbgamescbot"}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400"
              style={{ boxShadow: "0 0 6px rgba(74,222,128,0.6)" }}
            />
            <span className="text-[10px]" style={{ color: "rgba(74,222,128,0.7)" }}>Активен</span>
          </div>
        </motion.div>
      </motion.div>

      {/* Right col — 3D skin */}
      <motion.div
        className="flex-shrink-0"
        style={{ width: 200 }}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.35, delay: 0.1 }}
      >
        <SkinViewer username={username} />
      </motion.div>

      <AnimatePresence>
        {showAvatarPicker && (
          <FilePicker
            accept="image/*"
            title="Сменить аватар"
            hint="JPG, PNG · рекомендуется квадратное фото"
            onSelect={(_, preview) => { setAvatar(preview); setShowAvatarPicker(false); }}
            onClose={() => setShowAvatarPicker(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3D Skin Viewer — skinview3d (реальные майн-скины с Mojang API)
// ─────────────────────────────────────────────────────────────────────────────
const ANIMATIONS = [
  { label: "Стоя",   anim: null },
  { label: "Ходьба", anim: "walk" },
  { label: "Бег",    anim: "run" },
  { label: "Взмах",  anim: "fly" },
];

// Прокси через allorigins чтобы обойти CORS Mojang
async function fetchSkinUrl(username) {
  try {
    // 1. UUID по нику
    const profileRes = await fetch(
      `https://api.allorigins.win/get?url=${encodeURIComponent(`https://api.mojang.com/users/profiles/minecraft/${username}`)}`
    );
    const profileData = await profileRes.json();
    const profile = JSON.parse(profileData.contents);
    if (!profile?.id) return null;

    // 2. Skin URL по UUID
    const sessionRes = await fetch(
      `https://api.allorigins.win/get?url=${encodeURIComponent(`https://sessionserver.mojang.com/session/minecraft/profile/${profile.id}`)}`
    );
    const sessionData = await sessionRes.json();
    const session = JSON.parse(sessionData.contents);
    const textureProp = session?.properties?.find(p => p.name === "textures");
    if (!textureProp) return null;
    const textures = JSON.parse(atob(textureProp.value));
    return textures?.textures?.SKIN?.url || null;
  } catch {
    return null;
  }
}

function SkinViewer({ username, customSkin }) {
  const canvasRef = useRef(null);
  const viewerRef = useRef(null);
  const [animIdx, setAnimIdx] = useState(1);
  const [loading, setLoading] = useState(true);

  const applyAnimation = (viewer, idx) => {
    viewer.animation = null;
    if (idx === 1) viewer.animation = new skinview3d.WalkingAnimation();
    else if (idx === 2) viewer.animation = new skinview3d.RunningAnimation();
    else if (idx === 3) viewer.animation = new skinview3d.FlyingAnimation();
  };

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      if (!canvasRef.current) return;
      setLoading(true);
      if (viewerRef.current) { viewerRef.current.dispose(); viewerRef.current = null; }

      const viewer = new skinview3d.SkinViewer({
        canvas: canvasRef.current,
        width: 190,
        height: 290,
        background: 0x000000,
      });
      viewer.renderer.setClearColor(0x000000, 0);
      viewer.controls.enableRotate = true;
      viewer.controls.enableZoom = false;
      viewer.controls.autoRotate = true;
      viewer.controls.autoRotateSpeed = 0.7;
      viewer.fov = 65;
      viewer.zoom = 0.85;
      viewerRef.current = viewer;

      try {
        await viewer.loadSkin(customSkin || `https://minotar.net/skin/${username}`);
      } catch {
        await viewer.loadSkin("https://minotar.net/skin/MHF_Steve");
      }

      if (!cancelled) {
        applyAnimation(viewer, animIdx);
        setLoading(false);
      }
    };
    init();
    return () => { cancelled = true; viewerRef.current?.dispose(); };
  }, [username, customSkin]);

  useEffect(() => {
    if (viewerRef.current && !loading) applyAnimation(viewerRef.current, animIdx);
  }, [animIdx, loading]);

  return (
    <div className="rounded-2xl p-4 flex flex-col gap-3 h-full"
      style={{ background: "rgba(255,255,255,0.03)" }}
    >
      <p className="text-[10px] uppercase tracking-[0.14em] font-semibold"
        style={{ color: "rgba(255,255,255,0.18)" }}>3D Скин</p>

      <div className="flex-1 flex items-center justify-center relative min-h-0 rounded-xl overflow-hidden"
        style={{ background: "rgba(0,0,0,0.4)" }}
      >
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10"
            style={{ background: "rgba(0,0,0,0.4)" }}
          >
            <div className="w-5 h-5 border-2 border-white/10 border-t-white/30 rounded-full animate-spin" />
          </div>
        )}
        <motion.canvas
          ref={canvasRef}
          animate={{ opacity: loading ? 0 : 1 }}
          transition={{ duration: 0.4 }}
          style={{ cursor: "grab", display: "block" }}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-[9px] uppercase tracking-widest"
          style={{ color: "rgba(255,255,255,0.18)" }}>Анимация</p>
        <div className="grid grid-cols-2 gap-1">
          {ANIMATIONS.map(({ label }, i) => (
            <motion.button key={label} onClick={() => setAnimIdx(i)} whileTap={{ scale: 0.94 }}
              className="relative text-[10px] py-1.5 rounded-lg transition-colors duration-150 overflow-hidden"
              style={{ color: animIdx === i ? "#93c5fd" : "rgba(255,255,255,0.25)" }}
            >
              {animIdx === i && (
                <motion.div layoutId="anim-bg"
                  className="absolute inset-0 rounded-lg"
                  style={{ background: "rgba(37,99,235,0.18)" }}
                  transition={{ type: "spring", stiffness: 400, damping: 35 }}
                />
              )}
              <span className="relative z-10">{label}</span>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Personalize Tab
// ─────────────────────────────────────────────────────────────────────────────
const CAPE_PRESETS = [
  { id: "none",    label: "Нет",       color: null },
  { id: "blue",    label: "Синий",     color: "#1d4ed8" },
  { id: "dark",    label: "Тёмный",    color: "#1e1b4b" },
  { id: "red",     label: "Красный",   color: "#7f1d1d" },
];

function PersonalizeTab({ user }) {
  const username = user?.username || "Player";
  const [skinFile,    setSkinFile]    = useState(null);
  const [skinPreview, setSkinPreview] = useState(null);
  const [showPicker,  setShowPicker]  = useState(false);
  const [uploaded,    setUploaded]    = useState(false);
  const [cape,        setCape]        = useState("none");
  const [dragging,    setDragging]    = useState(false);

  const handleSkinUpload = () => {
    if (!skinFile) return;
    setUploaded(true);
    setTimeout(() => setUploaded(false), 2500);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (!file || !file.name.endsWith(".png")) return;
    const reader = new FileReader();
    reader.onload = ev => setSkinPreview(ev.target.result);
    reader.readAsDataURL(file);
    setSkinFile(file);
    setUploaded(false);
  };

  return (
    <motion.div
      className="p-5 flex gap-5"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      {/* Left — skin upload */}
      <div className="flex flex-col gap-3 flex-1 min-w-0">

        {/* Drop zone */}
        <motion.div variants={itemVariants}>
          <p className="text-[10px] uppercase tracking-[0.14em] font-semibold mb-2"
            style={{ color: "rgba(255,255,255,0.18)" }}>Скин Minecraft</p>

          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => setShowPicker(true)}
            className="relative rounded-2xl overflow-hidden cursor-pointer transition-all duration-200 flex items-center gap-4 p-4"
            style={{
              background: dragging ? "rgba(37,99,235,0.1)" : "rgba(255,255,255,0.03)",
              outline: dragging ? "1.5px solid rgba(37,99,235,0.4)" : "1.5px solid transparent",
            }}
          >
            {/* Skin preview box */}
            <div className="relative w-16 h-24 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.05)" }}
            >
              {skinPreview ? (
                <img src={skinPreview} alt="skin"
                  className="w-full h-full object-contain"
                  style={{ imageRendering: "pixelated" }}
                />
              ) : (
                <div className="flex flex-col items-center gap-1 opacity-30">
                  <Package size={18} className="text-white" />
                  <span className="text-[8px] text-white font-medium">PNG</span>
                </div>
              )}
              {skinPreview && (
                <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                  style={{ background: "rgba(0,0,0,0.5)" }}
                >
                  <Camera size={16} weight="fill" className="text-white" />
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1.5 min-w-0">
              <p className="text-[13px] font-semibold text-white">
                {skinFile ? skinFile.name : "Загрузить скин"}
              </p>
              <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.3)" }}>
                {dragging ? "Отпусти сюда" : "PNG · 64×64 или 64×32 · перетащи или нажми"}
              </p>
              {skinFile && (
                <span className="text-[10px] px-2 py-0.5 rounded-lg self-start"
                  style={{ background: "rgba(37,99,235,0.15)", color: "#93c5fd" }}
                >
                  Готово к загрузке
                </span>
              )}
            </div>
          </div>
        </motion.div>

        {/* Apply button */}
        <AnimatePresence>
          {skinFile && (
            <motion.button
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              onClick={handleSkinUpload}
              className="flex items-center justify-center gap-2 rounded-2xl py-3 text-[12px] font-semibold transition-all duration-200"
              style={{
                background: uploaded ? "rgba(34,197,94,0.15)" : "rgba(37,99,235,0.2)",
                color: uploaded ? "rgba(74,222,128,0.95)" : "#93c5fd",
              }}
              whileTap={{ scale: 0.97 }}
              onMouseEnter={e => { if (!uploaded) e.currentTarget.style.background = "rgba(37,99,235,0.35)"; }}
              onMouseLeave={e => { if (!uploaded) e.currentTarget.style.background = "rgba(37,99,235,0.2)"; }}
            >
              <AnimatePresence mode="wait">
                {uploaded ? (
                  <motion.span key="done" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center gap-2"
                  >
                    <CheckCircle2 size={14} />Скин применён!
                  </motion.span>
                ) : (
                  <motion.span key="upload" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="flex items-center gap-2"
                  >
                    <Download size={14} />Применить скин
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          )}
        </AnimatePresence>

        {/* Cape */}
        <motion.div variants={itemVariants}>
          <p className="text-[10px] uppercase tracking-[0.14em] font-semibold mb-2"
            style={{ color: "rgba(255,255,255,0.18)" }}>Плащ</p>
          <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ background: "rgba(255,255,255,0.03)" }}>
            <div className="grid grid-cols-4 gap-2">
              {CAPE_PRESETS.map(({ id, label, color }) => (
                <motion.button
                  key={id}
                  onClick={() => setCape(id)}
                  whileTap={{ scale: 0.93 }}
                  className="flex flex-col items-center gap-2 py-3 rounded-xl transition-all duration-150"
                  style={{
                    background: cape === id ? "rgba(37,99,235,0.15)" : "rgba(255,255,255,0.04)",
                  }}
                >
                  <div className="w-6 h-8 rounded-md flex-shrink-0"
                    style={{
                      background: color || "rgba(255,255,255,0.08)",
                      boxShadow: cape === id && color ? `0 0 10px ${color}60` : "none",
                    }}
                  />
                  <span className="text-[9px] font-medium"
                    style={{ color: cape === id ? "#93c5fd" : "rgba(255,255,255,0.3)" }}
                  >{label}</span>
                  {cape === id && (
                    <motion.div layoutId="cape-dot"
                      className="w-1 h-1 rounded-full bg-blue-400"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                </motion.button>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Nickname colour hint */}
        <motion.div variants={itemVariants}
          className="rounded-2xl px-4 py-3 flex items-center gap-3"
          style={{ background: "rgba(255,255,255,0.03)" }}
        >
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(250,204,21,0.1)" }}
          >
            <Star size={14} weight="fill" style={{ color: "#fbbf24" }} />
          </div>
          <div>
            <p className="text-[12px] font-semibold text-white">Цветной ник</p>
            <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>
              Доступен с уровня 10 — откройте в магазине
            </p>
          </div>
          <span className="ml-auto text-[10px] px-2.5 py-1 rounded-xl"
            style={{ background: "rgba(250,204,21,0.1)", color: "rgba(250,204,21,0.7)" }}
          >Скоро</span>
        </motion.div>
      </div>

      {/* Right — live 3D preview */}
      <motion.div
        className="flex-shrink-0"
        style={{ width: 200 }}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.35, delay: 0.1 }}
      >
        <SkinViewer username={skinPreview ? "__custom__" : username} customSkin={skinPreview} />
      </motion.div>

      <AnimatePresence>
        {showPicker && (
          <FilePicker
            accept=".png"
            title="Выбери скин"
            hint="PNG · 64×64 или 64×32 пикселя"
            onSelect={(file, preview) => {
              setSkinFile(file);
              setSkinPreview(preview);
              setShowPicker(false);
              setUploaded(false);
            }}
            onClose={() => setShowPicker(false)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Settings Tab — игровые настройки + Modrinth
// ─────────────────────────────────────────────────────────────────────────────

const RESOLUTIONS = ["1280×720","1366×768","1600×900","1920×1080","2560×1440","3840×2160","Авто (экран)"];

// Все серверы на 1.19.2 — версию не выбираем
const ALLOWED_PROJECTS = {
  mods:    ["sodium","lithium","ferritecore","lazydfu","modernfix","noisium"],
  shaders: ["complementary-reimagined","bsl-shaders","rethinking-voxels"],
};

const SETTINGS_KEY = "sbgames_settings";
function loadSettings() {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; } catch { return {}; }
}
function saveSettings(s) { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); }

// Получить RAM через Tauri invoke, fallback 8
async function fetchSystemRam() {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const gb = await invoke("get_system_ram_gb");
    return Number(gb) || 8;
  } catch {
    return 8;
  }
}

function SettingsTab() {
  const saved = loadSettings();
  // totalRam начинаем с 0 — покажем лоадер пока Tauri не ответит
  const [totalRam,   setTotalRam]   = useState(0);
  const [ram,        setRam]        = useState(saved.ram ?? null); // null = ещё не знаем
  const [resolution, setResolution] = useState(saved.resolution ?? "1920×1080");
  const [notifs,     setNotifs]     = useState(saved.notifs     ?? true);
  const [autoLogin,  setAutoLogin]  = useState(saved.autoLogin  ?? false);
  const [settingTab, setSettingTab] = useState("game");
  const [savedOk,    setSavedOk]    = useState(false);

  useEffect(() => {
    fetchSystemRam().then(gb => {
      setTotalRam(gb);
      setRam(prev => {
        // если уже есть сохранённое — оставить, иначе половина системной
        if (prev !== null && prev >= 1 && prev <= gb) return prev;
        return Math.max(2, Math.floor(gb / 2));
      });
    });
  }, []);

  const handleSaveGame = () => {
    saveSettings({ ...loadSettings(), ram, totalRam, resolution, notifs, autoLogin });
    setSavedOk(true);
    setTimeout(() => setSavedOk(false), 2000);
  };

  // Не рендерим пока не знаем реальный объём
  if (totalRam === 0 || ram === null) {
    return (
      <div className="flex items-center justify-center h-full gap-2 text-white/20 text-[12px]">
        <Loader2 size={14} className="animate-spin" />
        Определяем систему...
      </div>
    );
  }

  const ramWarn = ram < 2
    ? { text: "Слишком мало — игра будет вылетать", color: "rgba(248,113,113,0.8)", bg: "rgba(239,68,68,0.06)" }
    : ram > totalRam * 0.75
    ? { text: `Оставьте ОС минимум ${Math.max(2, totalRam - ram)} ГБ`, color: "rgba(250,204,21,0.8)", bg: "rgba(234,179,8,0.06)" }
    : { text: "Оптимально для игры", color: "rgba(74,222,128,0.8)", bg: "rgba(34,197,94,0.06)" };

  const pct = (ram / totalRam) * 100;

  // Адаптивные метки: 1 ГБ шаг до 8, 2 ГБ до 16, 4 ГБ до 32
  const _step = totalRam <= 8 ? 1 : totalRam <= 16 ? 2 : 4;
  const ramSteps = Array.from(
    { length: Math.floor(totalRam / _step) },
    (_, i) => (i + 1) * _step
  ).filter(v => v <= totalRam);

  return (
    <div className="flex flex-col">
      {/* Sub-tabs */}
      <div className="flex items-center gap-1 px-5 pt-5 pb-0 flex-shrink-0 sticky top-0 z-10" style={{ background: "#000" }}>
        {[
          { id: "game",    label: "Игра",    icon: SlidersHorizontal },
          { id: "mods",    label: "Моды",    icon: Package },
          { id: "shaders", label: "Шейдеры", icon: Zap },
        ].map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setSettingTab(id)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-[11px] font-semibold transition-all duration-150"
            style={settingTab === id
              ? { background: "rgba(255,255,255,0.07)", color: "#fff" }
              : { color: "rgba(255,255,255,0.3)" }
            }
            onMouseEnter={e => { if (settingTab !== id) e.currentTarget.style.color = "rgba(255,255,255,0.6)"; }}
            onMouseLeave={e => { if (settingTab !== id) e.currentTarget.style.color = "rgba(255,255,255,0.3)"; }}
          >
            <Icon size={12} />{label}
          </button>
        ))}
      </div>

      <div className="p-5 flex flex-col gap-5">
        <AnimatePresence mode="wait">
          {settingTab === "game" && (
            <motion.div key="game" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="flex flex-col gap-5 max-w-[520px]"
            >
              {/* RAM */}
              <Section title="Оперативная память">
                <div className="flex flex-col gap-4">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[12px] text-white/55">
                      <Cpu size={13} className="text-white/30" />
                      Выделить Minecraft
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <motion.span
                        key={ram}
                        initial={{ scale: 1.25, color: "#60a5fa" }}
                        animate={{ scale: 1, color: "#ffffff" }}
                        transition={{ duration: 0.25 }}
                        className="text-[20px] font-black tabular-nums"
                      >{ram}</motion.span>
                      <span className="text-[11px] text-white/30">/ {totalRam} ГБ</span>
                    </div>
                  </div>

                  {/* Custom slider */}
                  <RamSlider value={ram} max={totalRam} onChange={setRam} steps={ramSteps} pct={pct} />

                  {/* Warn */}
                  <motion.div
                    key={ramWarn.text}
                    initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 rounded-xl px-3 py-2.5"
                    style={{ background: ramWarn.bg }}
                  >
                    <span className="text-[11px]" style={{ color: ramWarn.color }}>{ramWarn.text}</span>
                  </motion.div>
                </div>
              </Section>

              {/* Resolution */}
              <Section title="Разрешение окна">
                <div className="flex items-center gap-2 flex-wrap">
                  <Monitor size={13} className="text-white/30 flex-shrink-0" />
                  <div className="flex flex-wrap gap-1.5 flex-1">
                    {RESOLUTIONS.map(r => (
                      <button key={r} onClick={() => setResolution(r)}
                        className="text-[11px] px-3 py-1.5 rounded-lg transition-all duration-150"
                        style={resolution === r
                          ? { background: "rgba(37,99,235,0.22)", color: "#93c5fd" }
                          : { background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.28)" }
                        }
                        onMouseEnter={e => { if (resolution !== r) e.currentTarget.style.color = "rgba(255,255,255,0.6)"; }}
                        onMouseLeave={e => { if (resolution !== r) e.currentTarget.style.color = "rgba(255,255,255,0.28)"; }}
                      >{r}</button>
                    ))}
                  </div>
                </div>
              </Section>

              {/* Launcher toggles */}
              <Section title="Лаунчер">
                <Toggle label="Уведомления" icon={Bell} value={notifs} onChange={setNotifs} />
                <Toggle label="Автовход при запуске" icon={Shield} value={autoLogin} onChange={setAutoLogin} />
              </Section>

              <button onClick={handleSaveGame}
                className="self-start flex items-center gap-2 rounded-xl px-5 py-2.5 text-[12px] font-semibold transition-all duration-200 text-white"
                style={{ background: savedOk ? "rgba(34,197,94,0.2)" : "rgba(37,99,235,0.22)", color: savedOk ? "rgba(74,222,128,0.95)" : "#fff" }}
                onMouseEnter={e => { if (!savedOk) e.currentTarget.style.background = "rgba(37,99,235,0.38)"; }}
                onMouseLeave={e => { if (!savedOk) e.currentTarget.style.background = "rgba(37,99,235,0.22)"; }}
              >
                {savedOk ? <><CheckCircle2 size={13} />Сохранено</> : "Сохранить"}
              </button>
            </motion.div>
          )}

          {settingTab === "mods" && (
            <motion.div key="mods" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <ModrinthPanel type="mod" allowedSlugs={ALLOWED_PROJECTS.mods} />
            </motion.div>
          )}

          {settingTab === "shaders" && (
            <motion.div key="shaders" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <ModrinthPanel type="shader" allowedSlugs={ALLOWED_PROJECTS.shaders} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Custom RAM slider ────────────────────────────────────────────────────────
function RamSlider({ value, max, onChange, steps, pct }) {
  const trackRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const calcValue = useCallback((clientX) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    onChange(Math.max(1, Math.round(ratio * max)));
  }, [max, onChange]);

  useEffect(() => {
    if (!dragging) return;
    const onMove = e => calcValue(e.clientX);
    const onUp   = () => setDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [dragging, calcValue]);

  return (
    <div className="flex flex-col gap-2 select-none">
      {/* Track */}
      <div
        ref={trackRef}
        className="relative h-5 flex items-center cursor-pointer group"
        onMouseDown={e => { setDragging(true); calcValue(e.clientX); }}
      >
        {/* Background track */}
        <div className="absolute inset-y-0 flex items-center w-full">
          <div className="w-full h-1.5 rounded-full bg-white/[0.08]" />
        </div>
        {/* Fill */}
        <motion.div
          className="absolute h-1.5 rounded-full bg-blue-600 origin-left"
          style={{ width: `${pct}%` }}
          animate={{ width: `${pct}%` }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        />
        {/* Thumb */}
        <motion.div
          className="absolute w-4 h-4 rounded-full bg-white shadow-[0_0_12px_rgba(37,99,235,0.6)] -translate-x-1/2 cursor-grab active:cursor-grabbing"
          style={{ left: `${pct}%` }}
          animate={{ left: `${pct}%`, scale: dragging ? 1.2 : 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        />
      </div>
      {/* Step labels */}
      <div className="relative h-4">
        {steps.map(v => {
          const pos = (v / max) * 100;
          return (
            <button
              key={v}
              onClick={() => onChange(v)}
              className={`absolute -translate-x-1/2 text-[9px] transition-all duration-150 ${
                value === v ? "text-blue-400 font-bold" : "text-white/20 hover:text-white/45"
              }`}
              style={{ left: `${pos}%` }}
            >{v}Г</button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Описания модов для SB Games ─────────────────────────────────────────────
const MOD_DESCRIPTIONS = {
  "sodium":                   "Заменяет движок рендера Minecraft — убирает лаги и фризы. На сервере SB Games даёт +60–200% FPS без потери качества графики.",
  "lithium":                  "Оптимизирует физику, ИИ мобов и тик-обновления мира. Снижает нагрузку на процессор и делает игру плавнее на нашем сервере.",
  "ferritecore":              "Сокращает потребление оперативной памяти до 40%. Особенно помогает при игре на больших картах SB Games с множеством чанков.",
  "lazydfu":                  "Ускоряет загрузку игры, откладывая инициализацию DataFixerUpper. Вход на сервер становится заметно быстрее.",
  "modernfix":                "Комплексный патч производительности: быстрый старт, меньше вылетов, стабильнее соединение с сервером SB Games.",
  "noisium":                  "Ускоряет генерацию чанков в несколько раз. Новые территории на сервере подгружаются мгновенно без зависания.",
  "complementary-reimagined": "Премиальные шейдеры с реалистичным освещением, тенями и водой. Идеально подчёркивают визуал карт SB Games.",
  "bsl-shaders":              "Популярные шейдеры с мягким светом и приятной цветокоррекцией. Хорошо работают даже на средних видеокартах.",
  "rethinking-voxels":        "Экспериментальные шейдеры с трассировкой лучей на основе вокселей. Максимально реалистичное освещение для топовых ПК.",
};

// ─── Modrinth panel ───────────────────────────────────────────────────────────
function ModrinthPanel({ type, allowedSlugs }) {
  const [projects,   setProjects]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [installed,  setInstalled]  = useState(new Set());
  const [installing, setInstalling] = useState(new Set());
  const [selected,   setSelected]   = useState(null);

  useEffect(() => {
    setLoading(true);
    setProjects([]);
    setSelected(null);
    Promise.all(
      allowedSlugs.map(slug =>
        fetch(`https://api.modrinth.com/v2/project/${slug}`)
          .then(r => r.ok ? r.json() : null)
          .catch(() => null)
      )
    ).then(results => {
      setProjects(results.filter(Boolean));
      setLoading(false);
    });
  }, [allowedSlugs.join(",")]);

  const handleInstall = async (project) => {
    setInstalling(prev => new Set([...prev, project.id]));
    await new Promise(r => setTimeout(r, 1600 + Math.random() * 1200));
    setInstalling(prev => { const s = new Set(prev); s.delete(project.id); return s; });
    setInstalled(prev => new Set([...prev, project.id]));
  };

  if (loading) return (
    <div className="flex flex-col gap-2 pt-2">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="h-[68px] rounded-2xl animate-pulse" style={{ background: "rgba(255,255,255,0.03)" }} />
      ))}
    </div>
  );

  return (
    <div className="flex gap-4">
      {/* List */}
      <div className="flex flex-col gap-1.5" style={{ width: selected ? 240 : "100%", flexShrink: 0, transition: "width 0.25s" }}>
        {projects.map((proj, i) => {
          const isInstalled  = installed.has(proj.id);
          const isActive     = selected?.id === proj.id;
          return (
            <motion.div key={proj.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => setSelected(isActive ? null : proj)}
              className="flex items-center gap-3 rounded-2xl px-3.5 py-3 cursor-pointer transition-all duration-150"
              style={{ background: isActive ? "rgba(37,99,235,0.12)" : "rgba(255,255,255,0.03)" }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.055)"; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
            >
              <div className="w-9 h-9 rounded-xl overflow-hidden flex-shrink-0" style={{ background: "rgba(255,255,255,0.06)" }}>
                {proj.icon_url
                  ? <img src={proj.icon_url} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center"><Package size={14} className="text-white/20" /></div>
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-white truncate leading-tight">{proj.title}</p>
                {!selected && (
                  <p className="text-[10px] truncate mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>{proj.description}</p>
                )}
              </div>
              {isInstalled && <CheckCircle2 size={13} style={{ color: "rgba(74,222,128,0.7)", flexShrink: 0 }} />}
            </motion.div>
          );
        })}
      </div>

      {/* Detail panel */}
      <AnimatePresence>
        {selected && (
          <motion.div
            key={selected.id}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 16 }}
            transition={{ duration: 0.2 }}
            className="flex-1 flex flex-col gap-4 min-w-0"
          >
            {/* Header */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl overflow-hidden flex-shrink-0" style={{ background: "rgba(255,255,255,0.06)" }}>
                {selected.icon_url
                  ? <img src={selected.icon_url} alt="" className="w-full h-full object-cover" />
                  : <Package size={20} className="text-white/20" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-bold text-white leading-tight">{selected.title}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>
                    ⬇ {(selected.downloads || 0).toLocaleString("ru-RU")}
                  </span>
                  {selected.game_versions?.includes("1.19.2") && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-md font-semibold" style={{ background: "rgba(37,99,235,0.18)", color: "#93c5fd" }}>
                      1.19.2 ✓
                    </span>
                  )}
                </div>
              </div>
              <button onClick={() => setSelected(null)}
                className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 text-[14px] transition-all duration-150"
                style={{ color: "rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.05)" }}
                onMouseEnter={e => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.background = "rgba(255,255,255,0.1)"; }}
                onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.3)"; e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
              >✕</button>
            </div>

            {/* SB Games description */}
            <div className="rounded-2xl p-4 flex flex-col gap-2" style={{ background: "rgba(37,99,235,0.08)" }}>
              <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "rgba(37,99,235,0.7)" }}>
                На сервере SB Games
              </p>
              <p className="text-[12px] leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}>
                {MOD_DESCRIPTIONS[selected.slug] || selected.description}
              </p>
            </div>

            {/* Tags */}
            {selected.categories?.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selected.categories.slice(0, 4).map(cat => (
                  <span key={cat} className="text-[10px] px-2 py-0.5 rounded-lg capitalize" style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.3)" }}>
                    {cat}
                  </span>
                ))}
              </div>
            )}

            {/* Install button */}
            {(() => {
              const isInstalled  = installed.has(selected.id);
              const isInstalling = installing.has(selected.id);
              return (
                <button
                  onClick={() => !isInstalled && !isInstalling && handleInstall(selected)}
                  disabled={isInstalled || isInstalling}
                  className="flex items-center justify-center gap-2 rounded-2xl py-2.5 text-[12px] font-semibold transition-all duration-200"
                  style={
                    isInstalled  ? { background: "rgba(34,197,94,0.12)", color: "rgba(74,222,128,0.9)" } :
                    isInstalling ? { background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.3)", cursor: "wait" } :
                                   { background: "rgba(37,99,235,0.22)", color: "#93c5fd" }
                  }
                  onMouseEnter={e => { if (!isInstalled && !isInstalling) e.currentTarget.style.background = "rgba(37,99,235,0.38)"; }}
                  onMouseLeave={e => { if (!isInstalled && !isInstalling) e.currentTarget.style.background = "rgba(37,99,235,0.22)"; }}
                >
                  {isInstalled  ? <><CheckCircle2 size={13} />Установлен</> :
                   isInstalling ? <><Loader2 size={13} className="animate-spin" />Устанавливаем...</> :
                                  <><Download size={13} />Установить</>}
                </button>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Кастомный File Picker в стиле лаунчера ───────────────────────────────────
function FilePicker({ accept, title, hint, onSelect, onClose }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [chosen, setChosen]   = useState(null); // { file, preview }

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
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <motion.div
        initial={{ scale: 0.93, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.93, y: 12 }}
        transition={{ type: "spring", damping: 28, stiffness: 320 }}
        className="relative z-10 w-[400px] rounded-2xl overflow-hidden"
        style={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 24px 80px rgba(0,0,0,0.9)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div>
            <p className="text-[13px] font-bold text-white">{title}</p>
            <p className="text-[10px] text-white/30 mt-0.5">{hint}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg text-white/30 hover:text-white hover:bg-white/[0.07] flex items-center justify-center transition-all">
            ✕
          </button>
        </div>

        {/* Drop zone */}
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

        {/* Actions */}
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

function Section({ title, children }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[10px] uppercase tracking-[0.14em] font-semibold" style={{ color: "rgba(255,255,255,0.18)" }}>{title}</p>
      <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ background: "rgba(255,255,255,0.03)" }}>
        {children}
      </div>
    </div>
  );
}

function Toggle({ label, icon: Icon, value, onChange }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2.5 text-[12px] text-white/55">
        <Icon size={13} className="text-white/30" />
        {label}
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`w-10 h-5 rounded-full transition-all duration-200 relative ${value ? "bg-blue-600" : "bg-white/[0.1]"}`}
      >
        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-200 ${value ? "left-5" : "left-0.5"}`} />
      </button>
    </div>
  );
}
