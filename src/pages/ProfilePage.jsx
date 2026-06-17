import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  User, Palette, Settings, Package,
  Send, Check, ChevronRight, Moon, Bell, Shield, Trash2,
  RefreshCw, Monitor, Zap, Download, Loader2,
  SlidersHorizontal, CheckCircle2, Images, X,
  LayoutGrid, Pencil, Save, Trophy, FlaskConical, Video,
} from "lucide-react";
import LibraryTab from "./LibraryTab.jsx";
import InventoryTab from "./InventoryTab.jsx";
import { CATALOG_BY_ID, RARITIES } from "./catalog.js";

const TYPE_META = {
  frame:            { label: "Рамка",     color: "#3b82f6" },
  background:       { label: "Фон",       color: "#6366f1" },
  avatar_animated:  { label: "Анимация",  color: "#f59e0b" },
  badge:            { label: "Бейдж",     color: "#ef4444" },
};
import {
  Star, TelegramLogo, Camera, CaretLeft,
} from "@phosphor-icons/react";
import { invoke } from "../lib/tauri.js";
import { API_URL, authedFetch } from "../lib/api.js";
import ScreenshotsModal from "./ScreenshotsPage.jsx";
import SkinViewer from "../components/SkinViewer.jsx";
import FilePicker from "../components/FilePicker.jsx";
import ProfileComments from "../components/ProfileComments.jsx";
import RecentActivityCard, { pushLocalActivity, ACTIVITY_KEY } from "../components/RecentActivityCard.jsx";
import AchievementShowcase, { trackDate, unlockAchievement } from "../components/AchievementShowcase.jsx";
import AchievementSystem from "../components/AchievementSystem.jsx";

function VideoBackground({ src, opacity = 0.5 }) {
  const [failed, setFailed] = React.useState(false);
  if (failed) return null;
  return (
    <video
      src={src}
      autoPlay muted loop playsInline preload="none"
      onError={() => setFailed(true)}
      className="absolute inset-0 w-full h-full object-cover"
      style={{ pointerEvents: "none", opacity, zIndex: 0 }}
    />
  );
}

const TABS = [
  { id: "profile",       label: "Профиль",        icon: User },
  { id: "achievements",  label: "Достижения",     icon: Trophy },
  { id: "inventory",     label: "Инвентарь",       icon: Package },
  { id: "library",       label: "Библиотека",      icon: LayoutGrid },
  { id: "personalize",   label: "Персонализация",  icon: Palette },
  { id: "settings",      label: "Настройки",       icon: Settings },
];

export default function ProfilePage({ user, viewUserId, onBack }) {
  if (viewUserId && viewUserId !== user?.id) {
    return <PublicProfileView viewer={user} targetId={viewUserId} onBack={onBack} />;
  }

  const [tab, setTab] = useState(() => localStorage.getItem("sbg_profile_tab") || "profile");
  useEffect(() => { localStorage.setItem("sbg_profile_tab", tab); }, [tab]);

  const [equip, setEquipRaw] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("sbgames_user") || "null");
      const e = saved?.equip;
      return e && typeof e === "object" ? e : (user?.equip && typeof user.equip === "object" ? user.equip : {});
    } catch { return user?.equip && typeof user.equip === "object" ? user.equip : {}; }
  });

  const setEquip = useCallback((updater) => {
    setEquipRaw(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      try {
        const current = JSON.parse(localStorage.getItem("sbgames_user") || "{}");
        current.equip = next;
        localStorage.setItem("sbgames_user", JSON.stringify(current));
        window.dispatchEvent(new Event("sbgames_equip_changed"));
      } catch {}
      return next;
    });
  }, []);

  const bgItem = CATALOG_BY_ID[equip?.background];

  // When globalBg is enabled, skip local video — GlobalBackground in MainLayout handles it
  const [globalBgActive, setGlobalBgActive] = useState(() => {
    try { return !!JSON.parse(localStorage.getItem("sbgames_settings"))?.globalBg; } catch { return false; }
  });
  useEffect(() => {
    const check = () => {
      try { setGlobalBgActive(!!JSON.parse(localStorage.getItem("sbgames_settings"))?.globalBg); } catch {}
    };
    window.addEventListener("storage", check);
    return () => { window.removeEventListener("storage", check); };
  }, []);

  const showLocalVideo = bgItem?.video && !globalBgActive;

  return (
    <div className="flex h-full overflow-hidden bg-transparent w-full relative">
      {showLocalVideo && (
        <VideoBackground src={bgItem.video} opacity={0.55} />
      )}
      
      {/* Heavy overlay gradient to block bright colors of the video behind text sections */}
      <div className="absolute inset-0 z-[1] pointer-events-none"
        style={{
          background: "linear-gradient(to bottom, rgba(7,7,10,0.5) 0%, rgba(10,10,15,0.78) 50%, rgba(10,10,15,0.95) 100%)"
        }}
      />

      {/* Left tab nav */}
      <div className="w-[180px] flex-shrink-0 flex flex-col pt-4 px-3 gap-0.5 relative z-10"
        style={{ background: "rgba(10,10,15,0.45)", borderRight: "1px solid rgba(255,255,255,0.12)" }}
      >
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              className="relative flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[12px] font-medium transition-colors duration-150 text-left"
              style={{ color: active ? "#fff" : "rgba(255,255,255,0.55)" }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.color = "rgba(255,255,255,0.8)"; }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.color = "rgba(255,255,255,0.55)"; }}
            >
              {active && (
                <motion.div layoutId="tab-bg"
                  className="absolute inset-0 rounded-xl"
                  style={{ background: "rgba(255,255,255,0.1)" }}
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

      {/* Content — ленивый монтаж: рендерим таб только при первом посещении */}
      <div className="flex-1 min-h-0 relative overflow-hidden z-10">
        <LazyTabs tab={tab} user={user} equip={equip} setEquip={setEquip} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Lazy Tab Renderer — монтирует компонент таба только при первом посещении
// ─────────────────────────────────────────────────────────────────────────────
function LazyTabs({ tab, user, equip, setEquip }) {
  const [visited, setVisited] = React.useState(() => new Set([tab]));
  React.useEffect(() => {
    setVisited(prev => { if (prev.has(tab)) return prev; const n = new Set(prev); n.add(tab); return n; });
  }, [tab]);

  return (
    <>
      {TABS.map(({ id }) => {
        if (!visited.has(id)) return null;
        const active = tab === id;
        return (
          <div
            key={id}
            className="absolute inset-0 overflow-y-auto"
            style={{
              opacity: active ? 1 : 0,
              pointerEvents: active ? "auto" : "none",
              transition: "opacity 0.15s",
              zIndex: active ? 1 : 0,
            }}
          >
            {id === "profile"     && <ProfileTab user={user} equip={equip} />}
            {id === "achievements" && <div className="p-5"><AchievementSystem user={user} /></div>}
            {id === "inventory"   && <InventoryTab user={user} />}
            {id === "library"     && <LibraryTab user={user} equip={equip} setEquip={setEquip} />}
            {id === "personalize" && <PersonalizeTab user={user} />}
            {id === "settings"    && <SettingsTab />}
          </div>
        );
      })}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Profile Tab
// ─────────────────────────────────────────────────────────────────────────────
const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04, delayChildren: 0.02 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" } },
};

function ProfileTab({ user, equip }) {
  const username = user?.username || "Player";
  const [avatar, setAvatar] = useState(null);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [showScreenshots, setShowScreenshots] = useState(false);
  const [savedBio, setSavedBio] = useState(user?.bio || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [editingBio, setEditingBio] = useState(false);
  const [bioSaving, setBioSaving] = useState(false);

  useEffect(() => {
    authedFetch(`/api/user/${user?.id}`).then(d => {
      if (d?.bio !== undefined) {
        setSavedBio(d.bio);
        setBio(d.bio);
        try { const u = JSON.parse(localStorage.getItem("sbgames_user") || "{}"); u.bio = d.bio; localStorage.setItem("sbgames_user", JSON.stringify(u)); } catch {}
      }
    }).catch(() => {});
  }, [user?.id]);

  const isAdmin = user?.role === "admin";

  const equippedItems = Object.entries(equip || {})
    .map(([type, id]) => ({ ...CATALOG_BY_ID[id], equipType: type }))
    .filter(Boolean);

  const frameItem  = CATALOG_BY_ID[equip?.frame];
  const bgItem     = CATALOG_BY_ID[equip?.background];
  const badgeItem  = CATALOG_BY_ID[equip?.badge];

  const frameColor = frameItem?.color || null;
  const bgColor    = bgItem?.color || null;
  const badgeColor = badgeItem?.color || null;

  return (
    <div className="relative flex flex-col h-full overflow-y-auto">
      <div className="relative z-10 flex-1 flex flex-col h-full overflow-y-auto w-full px-8 pt-8 pb-6 gap-6">
        {/* ═══ HEADER ═══ */}
        <div className="relative flex-shrink-0 px-6 pt-8 pb-6">
          <div className="flex items-end gap-5">
            {/* Avatar — larger */}
            <div className="relative cursor-pointer group flex-shrink-0" onClick={() => setShowAvatarPicker(true)}>
              {frameColor && frameItem?.image ? (
                <img
                  src={frameItem.image}
                  alt={frameItem.name}
                  className="absolute inset-0 w-[104px] h-[104px] rounded-[20px] pointer-events-none object-cover"
                  style={{ zIndex: 10 }}
                />
              ) : frameColor && (
                <div className="absolute -inset-[3px] rounded-[22px] pointer-events-none"
                  style={{ border: `2.5px solid ${frameColor}`, boxShadow: `0 0 24px ${frameColor}30` }} />
              )}
              <div className="relative w-[104px] h-[104px] rounded-[20px] overflow-hidden transition-all duration-300 group-hover:scale-95"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: frameColor ? `2px solid ${frameColor}55` : "2px solid rgba(255,255,255,0.08)",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
                }}>
                <img src={avatar || "/logo.jpg"} alt="avatar"
                  className="w-full h-full object-cover transition-all duration-300 group-hover:brightness-50 group-hover:scale-110" />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera size={24} className="text-white drop-shadow-lg" />
                </div>
              </div>
              {/* Online dot */}
              <div className="absolute -bottom-0.5 -right-0.5 w-[16px] h-[16px] rounded-full"
                style={{ background: "#22c55e", border: "2.5px solid #0d0d12", zIndex: 15 }} />
            </div>

            {/* Name + info */}
            <div className="flex-1 min-w-0 pb-1">
              {/* Name row */}
              <div className="flex items-center gap-2.5 flex-wrap">
                <p className="text-[26px] font-black text-white leading-none tracking-tight truncate"
                  style={{ textShadow: "0 2px 20px rgba(0,0,0,0.6)" }}>{username}</p>
                {isAdmin && (
                  <span className="text-[7px] font-black px-2 py-0.5 rounded text-white tracking-[0.15em] uppercase"
                    style={{ background: "#ef4444" }}>ADMIN</span>
                )}
                {badgeItem && (
                  badgeItem.icon ? (
                    <img src={badgeItem.icon} alt={badgeItem.name}
                      className="h-5 w-5 object-contain drop-shadow-lg"
                      title={badgeItem.name}
                      onError={e => { e.currentTarget.style.display = "none"; }} />
                  ) : (
                    <span className="text-[8px] font-black px-2 py-0.5 rounded tracking-wider"
                      style={{ background: `${badgeColor}20`, color: badgeColor, border: `1px solid ${badgeColor}35` }}>
                      {badgeItem.name}
                    </span>
                  )
                )}
              </div>

              {/* Sub-row: role + id + telegram */}
              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.55)" }}>
                  {isAdmin ? "Администратор" : "Игрок"}
                </span>
                <span className="text-[9px] font-mono" style={{ color: "rgba(255,255,255,0.35)" }}>
                  #{user?.id?.toString().slice(-6) || "000000"}
                </span>
                {user?.telegram && (
                  <span className="flex items-center gap-1.5 text-[11px]" style={{ color: "#60a5fa" }}>
                    <TelegramLogo size={11} weight="fill" />
                    @{user.telegram}
                  </span>
                )}
              </div>

              {/* Balance + Level — under the name */}
              <div className="flex items-center gap-2 mt-3">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.09)" }}>
                  <img src="/money.png" alt="" className="w-4 h-4 object-contain"
                    onError={(e) => { e.currentTarget.style.display = "none"; }} />
                  <span className="text-[15px] font-bold text-white tabular-nums leading-none">
                    {(user?.balance ?? 0).toLocaleString("ru-RU")}
                  </span>
                  <span className="text-[10px] font-semibold tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>SBT</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
                  style={{ background: "rgba(37,99,235,0.1)", border: "1px solid rgba(59,130,246,0.15)" }}>
                  <Zap size={12} style={{ color: "#60a5fa" }} />
                  <span className="text-[15px] font-bold tabular-nums leading-none" style={{ color: "#60a5fa" }}>1</span>
                  <span className="text-[10px] font-semibold tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>LVL</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bio */}
          <div className="mt-4 max-w-[480px]">
            {editingBio ? (
              <div className="flex flex-col gap-2">
                <textarea value={bio} onChange={e => setBio(e.target.value)} maxLength={200} rows={2}
                  placeholder="Расскажи о себе..."
                  className="rounded-xl px-3 py-2 text-[11px] outline-none resize-none transition-all duration-200"
                  style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.8)", border: "1px solid rgba(255,255,255,0.08)" }}
                  onFocus={e => e.currentTarget.style.borderColor = "rgba(37,99,235,0.5)"}
                  onBlur={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"}
                  autoFocus />
                <div className="flex items-center gap-2">
                  <span className="text-[9px]" style={{ color: "rgba(255,255,255,0.5)" }}>{bio.length}/200</span>
                  <div className="flex-1" />
                  <button onClick={() => { setEditingBio(false); setBio(savedBio); }}
                    className="text-[10px] px-3 py-1 rounded-lg transition-all"
                    style={{ color: "rgba(255,255,255,0.55)", background: "rgba(255,255,255,0.08)" }}>Отмена</button>
                  <button onClick={async () => { setBioSaving(true); try { await authedFetch("/api/user/bio", { method: "PUT", body: JSON.stringify({ bio: bio.trim() }) }); setSavedBio(bio.trim()); setEditingBio(false); try { const u = JSON.parse(localStorage.getItem("sbgames_user") || "{}"); u.bio = bio.trim(); localStorage.setItem("sbgames_user", JSON.stringify(u)); } catch {} } catch {} setBioSaving(false); }}
                    disabled={bioSaving} className="text-[10px] px-3 py-1 rounded-lg font-bold disabled:opacity-40 transition-all"
                    style={{ background: "rgba(37,99,235,0.2)", color: "#93c5fd" }}>
                    {bioSaving ? "..." : "Сохранить"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <p className="text-[11px] leading-relaxed flex-1"
                  style={{ color: savedBio ? "rgba(255,255,255,0.65)" : "rgba(255,255,255,0.3)" }}>
                  {savedBio || "Нет описания"}
                </p>
                <button onClick={() => setEditingBio(true)} className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-all"
                  style={{ color: "rgba(255,255,255,0.4)" }}
                  onMouseEnter={e => e.currentTarget.style.color = "rgba(255,255,255,0.7)"}
                  onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.4)"}>
                  <Pencil size={10} />
                </button>
              </div>
            )}
          </div>
        </div>

      {/* ═══ CONTENT ═══ */}
      <div className="flex-1 flex flex-col gap-5 px-6 py-5 min-h-0"
        style={{ paddingTop: 20 }}>

        {/* ── Achievement showcase ── */}
        <motion.div variants={itemVariants}>
          <p className="text-[9px] font-bold uppercase tracking-[0.16em] mb-2.5" style={{ color: "rgba(255,255,255,0.28)" }}>Достижения</p>
          <AchievementShowcase user={user} equip={equip} inventory={equippedItems} />
        </motion.div>

        {/* Recent activity */}
        <motion.div variants={itemVariants}>
          <p className="text-[9px] font-bold uppercase tracking-[0.16em] mb-2.5" style={{ color: "rgba(255,255,255,0.28)" }}>Активность</p>
          <RecentActivityCard />
        </motion.div>

        {/* Comments */}
        <motion.div variants={itemVariants}>
          <ProfileComments targetId={user?.id} viewer={user} />
        </motion.div>
      </div>

      <AnimatePresence>
        {showAvatarPicker && (
          <FilePicker accept="image/*" title="Сменить аватар" hint="JPG, PNG · рекомендуется квадратное фото"
            onSelect={(_, preview) => { setAvatar(preview); setShowAvatarPicker(false); }}
            onClose={() => setShowAvatarPicker(false)} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showScreenshots && <ScreenshotsModal onClose={() => setShowScreenshots(false)} />}
      </AnimatePresence>
    </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Session History
// ─────────────────────────────────────────────────────────────────────────────
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
      {/* Left — live 3D preview (sticky) */}
      <motion.div
        className="flex-shrink-0 sticky top-5 self-start"
        style={{ width: 180 }}
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.35, delay: 0.1 }}
      >
        <SkinViewer username={skinPreview ? "__custom__" : username} customSkin={skinPreview} />
      </motion.div>

      {/* Right — skin upload + cape + nickname */}
      <div className="flex flex-col gap-3 flex-1 min-w-0">

        {/* Drop zone */}
        <motion.div variants={itemVariants}>
          <p className="text-[10px] uppercase tracking-[0.14em] font-semibold mb-2"
            style={{ color: "rgba(255,255,255,0.55)" }}>Скин Minecraft</p>

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
              <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.55)" }}>
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
            style={{ color: "rgba(255,255,255,0.55)" }}>Плащ</p>
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
                    style={{ color: cape === id ? "#93c5fd" : "rgba(255,255,255,0.55)" }}
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
            <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.55)" }}>
              Доступен с уровня 10 — откройте в магазине
            </p>
          </div>
          <span className="ml-auto text-[10px] px-2.5 py-1 rounded-xl"
            style={{ background: "rgba(250,204,21,0.1)", color: "rgba(250,204,21,0.7)" }}
          >Скоро</span>
        </motion.div>
      </div>

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

function SettingsTab() {
  const saved = loadSettings();
  const [resolution, setResolution] = useState(saved.resolution ?? "1920×1080");
  const [notifs,     setNotifs]     = useState(saved.notifs     ?? true);
  const [notifSound, setNotifSound] = useState(saved.notifSound ?? true);
  const [autoLogin,  setAutoLogin]  = useState(saved.autoLogin  ?? false);
  const [settingTab, setSettingTab] = useState("game");
  const [savedOk,    setSavedOk]    = useState(false);
  const [globalBg,   setGlobalBg]   = useState(saved.globalBg ?? false);

  // Auto-save globalBg toggle immediately (no Save button needed)
  useEffect(() => {
    if (saved.globalBg !== globalBg) {
      saveSettings({ ...loadSettings(), globalBg });
    }
  }, [globalBg]);

  const handleSaveGame = () => {
    saveSettings({ ...loadSettings(), resolution, notifs, notifSound, autoLogin, globalBg });
    setSavedOk(true);
    setTimeout(() => setSavedOk(false), 2000);
  };

  return (
    <div className="flex flex-col">
      {/* Sub-tabs */}
      <div className="flex items-center gap-1 px-5 pt-5 pb-0 flex-shrink-0 sticky top-0 z-10" style={{ background: "transparent" }}>
        {[
          { id: "game",         label: "Игра",              icon: SlidersHorizontal },
          { id: "mods",         label: "Моды",              icon: Package },
          { id: "shaders",      label: "Шейдеры",           icon: Zap },
          { id: "experimental", label: "Экспериментальное", icon: FlaskConical },
        ].map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setSettingTab(id)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-[11px] font-semibold transition-all duration-150"
            style={settingTab === id
              ? { background: "rgba(255,255,255,0.1)", color: "#fff" }
              : { color: "rgba(255,255,255,0.55)" }
            }
            onMouseEnter={e => { if (settingTab !== id) e.currentTarget.style.color = "rgba(255,255,255,0.75)"; }}
            onMouseLeave={e => { if (settingTab !== id) e.currentTarget.style.color = "rgba(255,255,255,0.55)"; }}
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
                          : { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }
                        }
                        onMouseEnter={e => { if (resolution !== r) e.currentTarget.style.color = "rgba(255,255,255,0.75)"; }}
                        onMouseLeave={e => { if (resolution !== r) e.currentTarget.style.color = "rgba(255,255,255,0.5)"; }}
                      >{r}</button>
                    ))}
                  </div>
                </div>
              </Section>

              {/* Launcher toggles */}
              <Section title="Лаунчер">
                <Toggle label="Уведомления" icon={Bell} value={notifs} onChange={setNotifs} />
                <Toggle label="Звук уведомлений" icon={Bell} value={notifSound} onChange={setNotifSound} />
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

          {settingTab === "experimental" && (
            <motion.div key="experimental" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="flex flex-col gap-5 max-w-[520px]"
            >
              <Section title="Глобальный фон">
                <Toggle label="Распространить фон из библиотеки на все страницы" icon={Video} value={globalBg} onChange={setGlobalBg} />
                <p className="text-[10px] leading-relaxed" style={{ color: "rgba(255,255,255,0.25)" }}>
                  Установленный видео-фон из библиотеки будет отображаться на страницах Восхождение, Магазин, Новости и Помощь.
                </p>
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
        </AnimatePresence>
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
                  <p className="text-[10px] truncate mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>{proj.description}</p>
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
                  <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.5)" }}>
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
                  <span key={cat} className="text-[10px] px-2 py-0.5 rounded-lg capitalize" style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" }}>
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
                    isInstalling ? { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", cursor: "wait" } :
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

function PublicProfileView({ viewer, targetId, onBack }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const d = await authedFetch(`/api/user/${targetId}`);
        setProfile(d);
      } catch {}
      setLoading(false);
    })();
  }, [targetId]);

  const equip = profile?.equip || {};
  const frameItem  = CATALOG_BY_ID[equip.frame];
  const bgItem     = CATALOG_BY_ID[equip.background];
  const badgeItem  = CATALOG_BY_ID[equip.badge];

  const frameColor = frameItem?.color || null;
  const bgColor    = bgItem?.color || null;
  const badgeColor = badgeItem?.color || null;

  const equippedItems = Object.entries(equip)
    .map(([type, id]) => ({ ...CATALOG_BY_ID[id], equipType: type }))
    .filter(Boolean);

  const ownedItems = (profile?.inventory || [])
    .map(id => CATALOG_BY_ID[id])
    .filter(Boolean);

  const globalBgOn = (() => { try { return !!loadSettings().globalBg; } catch { return false; } })();

  const DEFAULT_BG = CATALOG_BY_ID["bg_fon1"];
  const activeBg = bgItem || DEFAULT_BG;


  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="w-5 h-5 border-2 border-white/10 border-t-white/40 rounded-full animate-spin" />
    </div>
  );

  if (!profile) return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3">
      <p className="text-[12px]" style={{ color: "rgba(255,255,255,0.55)" }}>Профиль не найден или отсутствует подключение к сети</p>
      <button onClick={onBack} className="text-[11px] text-blue-400/60 hover:text-blue-400 transition-colors">← Назад</button>
    </div>
  );

  const CARD_BG = "rgba(10,10,18,0.88)";
  const CARD_BORDER = "none";
  const SECTION_LABEL = { fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)" };

  return (
    <div className="relative flex-1 flex h-full overflow-hidden">
      {activeBg?.video && !globalBgOn && (
        <VideoBackground src={activeBg.video} opacity={0.45} />
      )}

      {/* Dark overlay */}
      <div className="absolute inset-0 z-[1] pointer-events-none"
        style={{ background: "linear-gradient(180deg, rgba(6,6,12,0.7) 0%, rgba(8,8,14,0.88) 40%, rgba(8,8,14,0.96) 100%)" }}
      />

      {/* Scrollable */}
      <div className="relative z-10 flex-1 overflow-y-auto w-full">
        <div className="max-w-[960px] mx-auto px-6 py-6 lg:px-10 lg:py-8 flex flex-col gap-6">

          {/* ── Back ── */}
          <button onClick={onBack}
            className="self-start flex items-center gap-2 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all"
            style={{ color: "rgba(255,255,255,0.5)", background: "rgba(255,255,255,0.05)" }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "#fff"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "rgba(255,255,255,0.5)"; }}
          >
            <CaretLeft size={13} weight="bold" /> Назад
          </button>

          {/* ═══════════════════════════════════════════════════════════════════
              HEADER — avatar + name (left), level/balance chips (right)
             ═══════════════════════════════════════════════════════════════════ */}
          <div className="flex items-start justify-between gap-5">
            <div className="flex items-start gap-5">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              {frameColor && frameItem?.image ? (
                <img src={frameItem.image} alt={frameItem.name}
                  className="absolute -inset-[8px] w-[120px] h-[120px] rounded-[20px] pointer-events-none object-cover"
                  style={{ zIndex: 10 }} />
              ) : frameColor && (
                <>
                  <div className="absolute -inset-4 rounded-[24px] pointer-events-none"
                    style={{ background: `radial-gradient(ellipse, ${frameColor}35, transparent 70%)`, filter: "blur(12px)" }} />
                  <div className="absolute -inset-[3px] rounded-[20px] pointer-events-none"
                    style={{ border: `2.5px solid ${frameColor}`, boxShadow: `0 0 24px ${frameColor}30` }} />
                </>
              )}
              <div className="relative w-[104px] h-[104px] rounded-[18px] overflow-hidden"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: frameColor ? `2.5px solid ${frameColor}55` : "2.5px solid rgba(255,255,255,0.1)",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
                }}>
                <img src="/logo.jpg" alt="avatar" className="w-full h-full object-cover" />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-[18px] h-[18px] rounded-full"
                style={{ background: profile.online ? "#22c55e" : "#6b7280", border: "3px solid #0a0a14", zIndex: 15 }} />
            </div>

            {/* Name + meta + bio */}
            <div className="min-w-0 pt-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <p className="text-[22px] font-black text-white leading-none tracking-tight truncate"
                  style={{ textShadow: "0 2px 16px rgba(0,0,0,0.5)" }}>
                  {profile.username}
                </p>
                {profile.role === "admin" && (
                  <span className="text-[7px] font-black px-2 py-0.5 rounded text-white tracking-[0.14em]"
                    style={{ background: "#ef4444" }}>ADMIN</span>
                )}
                {badgeItem && (
                  badgeItem.icon ? (
                    <img src={badgeItem.icon} alt={badgeItem.name}
                      className="h-5 w-5 object-contain drop-shadow-lg" title={badgeItem.name}
                      onError={e => { e.currentTarget.style.display = "none"; }} />
                  ) : (
                    <span className="text-[8px] font-black px-2 py-0.5 rounded tracking-wider"
                      style={{ background: `${badgeColor}20`, color: badgeColor }}>
                      {badgeItem.name}
                    </span>
                  )
                )}
              </div>
              <div className="flex items-center gap-3 mt-1.5">
                <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.5)" }}>
                  {profile.role === "admin" ? "Администратор" : "Игрок"}
                </span>
                <span className="text-[9px] font-mono" style={{ color: "rgba(255,255,255,0.3)" }}>
                  #{profile.id?.toString().slice(-6) || "000000"}
                </span>
              </div>
              {profile.bio && (
                <p className="text-[11px] leading-relaxed mt-2 max-w-[420px]"
                  style={{ color: "rgba(255,255,255,0.5)" }}>
                  {profile.bio}
                </p>
              )}
            </div>
            </div>

            {/* Balance + Level chips */}
            <div className="flex items-center gap-2 flex-shrink-0 mt-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg"
                style={{ background: "rgba(255,255,255,0.06)" }}>
                <img src="/money.png" alt="" className="w-3.5 h-3.5 object-contain"
                  onError={(e) => { e.currentTarget.style.display = "none"; }} />
                <span className="text-[13px] font-black text-white tabular-nums leading-none">
                  {(profile?.balance ?? 0).toLocaleString("ru-RU")}
                </span>
                <span className="text-[8px] font-semibold" style={{ color: "rgba(255,255,255,0.45)" }}>SBT</span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg"
                style={{ background: "rgba(59,130,246,0.08)" }}>
                <Zap size={11} style={{ color: "#60a5fa" }} />
                <span className="text-[13px] font-black tabular-nums leading-none" style={{ color: "#60a5fa" }}>1</span>
                <span className="text-[8px] font-semibold" style={{ color: "rgba(255,255,255,0.45)" }}>LVL</span>
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════════
              TWO-COLUMN LAYOUT — main (left) + sidebar (right)
             ═══════════════════════════════════════════════════════════════════ */}
          <div className="flex gap-5 items-start">

            {/* ─── LEFT: Main content ─── */}
            <div className="flex-1 min-w-0 flex flex-col gap-4">

              {/* Achievement Showcase */}
              <div className="rounded-2xl p-5" style={{ background: CARD_BG, border: CARD_BORDER }}>
                <p style={SECTION_LABEL} className="mb-3">Витрина достижений</p>
                <AchievementShowcase user={profile} equip={equip} inventory={equippedItems} />
              </div>

              {/* Recent Activity */}
              <div className="rounded-2xl p-5" style={{ background: CARD_BG, border: CARD_BORDER }}>
                <p style={SECTION_LABEL} className="mb-3">Недавняя активность</p>
                <RecentActivityCard userId={targetId} />
              </div>

              {/* Comments */}
              <ProfileComments targetId={targetId} viewer={viewer} />
            </div>

            {/* ─── RIGHT: Sidebar ─── */}
            <div className="w-[220px] flex-shrink-0 flex flex-col gap-4 sticky top-6">

              {/* Online status + meta combined */}
              <div className="rounded-2xl p-4 flex flex-col gap-2.5" style={{ background: CARD_BG, border: CARD_BORDER }}>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full" style={{ background: profile.online ? "#22c55e" : "#6b7280" }} />
                  <span className="text-[11px] font-bold" style={{ color: profile.online ? "#22c55e" : "rgba(255,255,255,0.45)" }}>
                    {profile.online ? "В сети" : "Не в сети"}
                  </span>
                </div>
                {profile.createdAt && (
                  <div className="flex justify-between text-[11px]">
                    <span style={{ color: "rgba(255,255,255,0.4)" }}>Регистрация</span>
                    <span style={{ color: "rgba(255,255,255,0.65)" }}>
                      {new Date(profile.createdAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-[11px]">
                  <span style={{ color: "rgba(255,255,255,0.4)" }}>Предметов</span>
                  <span style={{ color: "rgba(255,255,255,0.65)" }}>{ownedItems.length}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span style={{ color: "rgba(255,255,255,0.4)" }}>Друзей</span>
                  <span style={{ color: "rgba(255,255,255,0.65)" }}>{profile.friendCount ?? 0}</span>
                </div>
              </div>

              {/* Equipped items */}
              {equippedItems.length > 0 && (
                <div className="rounded-2xl p-4 flex flex-col gap-2" style={{ background: CARD_BG, border: CARD_BORDER }}>
                  <p style={SECTION_LABEL}>Экипировано</p>
                  {equippedItems.map((item) => (
                    <div key={item.id}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg"
                      style={{ background: `${item.color}10` }}>
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: item.color }} />
                       {item.name && <span className="text-[10px] font-semibold truncate" style={{ color: "rgba(255,255,255,0.7)" }}>{item.name}</span>}
                    </div>
                  ))}
                </div>
              )}

              {/* Skin viewer */}
              <SkinViewer username={profile.username} />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[10px] uppercase tracking-[0.14em] font-semibold" style={{ color: "rgba(255,255,255,0.55)" }}>{title}</p>
      <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ background: "rgba(255,255,255,0.03)" }}>
        {children}
      </div>
    </div>
  );
}

function Toggle({ label, icon: Icon, value, onChange }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2.5 text-[12px] text-white/70">
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
