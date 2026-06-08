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
      <div className="w-[200px] flex-shrink-0 border-r border-white/[0.05] flex flex-col pt-5 px-3 gap-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[12px] font-medium transition-all duration-150 text-left ${
              tab === id
                ? "bg-white/[0.07] text-white"
                : "text-white/35 hover:text-white/60 hover:bg-white/[0.04]"
            }`}
          >
            <Icon size={14} strokeWidth={tab === id ? 2.2 : 1.8} />
            {label}
            {tab === id && <ChevronRight size={12} className="ml-auto text-white/30" />}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.18 }}
            className="h-full"
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
function ProfileTab({ user }) {
  const username = user?.username || "Player";
  const [avatar, setAvatar]         = useState(null);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);

  const stats = [
    { label: "Часов в игре", value: "148", icon: Clock },
    { label: "Уровень",      value: "37",  icon: Star },
    { label: "Серверов",     value: "3",   icon: GameController },
  ];

  return (
    <div className="flex gap-5 p-5 h-full overflow-hidden">
      {/* Left col */}
      <div className="flex-1 flex flex-col gap-4 min-w-0 overflow-y-auto">
        {/* User card */}
        <div className="rounded-2xl p-5" style={{ background: "#0d0d0d" }}>
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="relative flex-shrink-0 group cursor-pointer" onClick={() => setShowAvatarPicker(true)}>
              <div className="w-[72px] h-[72px] rounded-2xl overflow-hidden"
                style={{ background: "#111" }}
              >
                <img
                  src={avatar || "/logo.jpg"}
                  alt="avatar"
                  className="w-full h-full object-cover transition-all duration-200 group-hover:brightness-50"
                />
              </div>
              <div className="absolute inset-0 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera size={20} weight="fill" className="text-white" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-green-500 border-2 border-black" />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-[17px] font-black text-white truncate leading-tight">{username}</p>
              {user?.telegram && (
                <p className="text-[12px] text-blue-400/80 flex items-center gap-1 mt-1">
                  <TelegramLogo size={12} weight="fill" />
                  @{user.telegram}
                </p>
              )}
              <div className="flex items-center gap-1.5 mt-2">
                <span className="text-[10px] bg-blue-600/20 text-blue-400 px-2 py-0.5 rounded-md font-bold tracking-wider">
                  ИГРОК
                </span>
                <span className="text-[10px] text-white/20 bg-white/[0.04] border border-white/[0.06] px-2 py-0.5 rounded-md">
                  ID {user?.id || "12345"}
                </span>
              </div>
            </div>

            <div className="text-right flex-shrink-0">
              <div className="flex items-center gap-1.5 justify-end">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="text-[22px] font-black text-white tabular-nums">{user?.balance ?? 0}</span>
              </div>
              <p className="text-[10px] text-white/20 mt-0.5">СБТ</p>
            </div>
          </div>
        </div>

        {/* Stats — три карточки */}
        <div className="grid grid-cols-3 gap-2.5">
          {stats.map(({ label, value, icon: Icon }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              className="rounded-xl p-4 flex flex-col gap-2.5" style={{ background: "#0d0d0d" }}
            >
              <div className="w-8 h-8 rounded-xl bg-blue-600/10 flex items-center justify-center">
                <Icon size={15} weight="fill" className="text-blue-400" />
              </div>
              <p className="text-[24px] font-black text-white leading-none tabular-nums">{value}</p>
              <p className="text-[10px] text-white/30">{label}</p>
            </motion.div>
          ))}
        </div>

        {/* TG badge */}
        <div className="rounded-xl px-4 py-3 flex items-center gap-3" style={{ background: "#0d0d0d" }}>
          <div className="w-7 h-7 rounded-lg bg-blue-600/10 flex items-center justify-center flex-shrink-0">
            <TelegramLogo size={14} weight="fill" className="text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold text-white">Telegram привязан</p>
            <p className="text-[10px] text-white/30 mt-0.5">@sbgamessupport_bot</p>
          </div>
          <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
        </div>
      </div>

      {/* Right col — 3D skin */}
      <div className="w-[210px] flex-shrink-0">
        <SkinViewer username={username} />
      </div>

      {/* Avatar picker */}
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

function SkinViewer({ username }) {
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
        background: 0x000000,   // чёрный фон
      });
      viewer.renderer.setClearColor(0x000000, 0);  // прозрачный рендер
      viewer.controls.enableRotate = true;
      viewer.controls.enableZoom = false;
      viewer.controls.autoRotate = true;
      viewer.controls.autoRotateSpeed = 0.7;
      viewer.fov = 65;
      viewer.zoom = 0.85;
      viewerRef.current = viewer;

      // Грузим скин пользователя через minotar (не нужен CORS-прокси)
      const skinUrl = `https://minotar.net/skin/${username}`;
      try {
        await viewer.loadSkin(skinUrl);
      } catch {
        await viewer.loadSkin("https://minotar.net/skin/MHF_Steve");
      }

      if (!cancelled) {
        applyAnimation(viewer, 1);
        setLoading(false);
      }
    };
    init();
    return () => { cancelled = true; viewerRef.current?.dispose(); };
  }, [username]);

  useEffect(() => {
    if (viewerRef.current && !loading) applyAnimation(viewerRef.current, animIdx);
  }, [animIdx, loading]);

  return (
    <div
      className="rounded-2xl border border-white/[0.06] p-4 flex flex-col gap-3 h-full"
      style={{ background: "#080808" }}
    >
      <p className="text-[11px] font-semibold text-white/50">3D Скин</p>

      {/* Canvas — чёрный фон снаружи тоже */}
      <div
        className="flex-1 flex items-center justify-center relative min-h-0 rounded-xl overflow-hidden"
        style={{ background: "#000" }}
      >
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-black">
            <div className="w-5 h-5 border-2 border-white/10 border-t-white/40 rounded-full animate-spin" />
          </div>
        )}
        <canvas
          ref={canvasRef}
          style={{ opacity: loading ? 0 : 1, transition: "opacity 0.4s", cursor: "grab", display: "block" }}
        />
      </div>

      {/* Animations */}
      <div className="flex flex-col gap-1.5">
        <p className="text-[9px] text-white/20 uppercase tracking-widest">Анимация</p>
        <div className="grid grid-cols-2 gap-1">
          {ANIMATIONS.map(({ label }, i) => (
            <button
              key={label}
              onClick={() => setAnimIdx(i)}
              className={`text-[10px] py-1.5 rounded-lg transition-all duration-150 border ${
                animIdx === i
                  ? "bg-blue-600/20 text-blue-400 border-blue-500/25"
                  : "border-transparent text-white/25 hover:text-white/50"
              }`}
              style={{ background: animIdx === i ? undefined : "rgba(255,255,255,0.03)" }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Personalize Tab — только смена скина
// ─────────────────────────────────────────────────────────────────────────────
function PersonalizeTab({ user }) {
  const username = user?.username || "Player";
  const [skinFile, setSkinFile] = useState(null); // File object
  const [skinPreview, setSkinPreview] = useState(null); // dataURL
  const [showPicker, setShowPicker] = useState(false);
  const [uploaded, setUploaded] = useState(false);

  const handleSkinUpload = () => {
    if (!skinFile) return;
    setUploaded(true);
    setTimeout(() => setUploaded(false), 2500);
  };

  return (
    <div className="p-5 flex flex-col gap-5 max-w-[480px]">
      <div>
        <p className="text-[15px] font-bold text-white">Персонализация</p>
        <p className="text-[12px] text-white/30 mt-0.5">Смена скина персонажа</p>
      </div>

      <Section title="Скин Minecraft">
        <div className="flex items-center gap-4">
          {/* Preview */}
          <div className="w-16 h-24 rounded-xl overflow-hidden bg-black flex items-center justify-center flex-shrink-0"
            style={{ border: "1px solid rgba(255,255,255,0.07)" }}
          >
            {skinPreview ? (
              <img src={skinPreview} alt="skin" className="w-full h-full object-contain" style={{ imageRendering: "pixelated" }} />
            ) : (
              <div className="text-[10px] text-white/20 text-center px-1">Нет скина</div>
            )}
          </div>
          <div className="flex-1 flex flex-col gap-2">
            <p className="text-[11px] text-white/50">
              {skinFile ? skinFile.name : "Файл не выбран"}
            </p>
            <p className="text-[10px] text-white/20">PNG, 64×64 или 64×32</p>
            <button
              onClick={() => setShowPicker(true)}
              className="flex items-center gap-2 text-[11px] font-semibold px-3.5 py-2 rounded-xl transition-all duration-150 self-start"
              style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)" }}
            >
              Выбрать файл
            </button>
          </div>
        </div>

        {skinFile && (
          <button
            onClick={handleSkinUpload}
            className={`flex items-center justify-center gap-2 w-full rounded-xl py-2.5 text-[12px] font-bold transition-all duration-200 ${
              uploaded ? "bg-green-600 text-white" : "bg-blue-600 hover:bg-blue-500 text-white"
            }`}
          >
            {uploaded ? <><Check size={13} />Загружено!</> : "Применить скин"}
          </button>
        )}
      </Section>

      {/* Custom file picker modal */}
      <AnimatePresence>
        {showPicker && (
          <FilePicker
            accept=".png"
            title="Выбери скин"
            hint="PNG файл · 64×64 или 64×32 пикселя"
            onSelect={(file, preview) => {
              setSkinFile(file);
              setSkinPreview(preview);
              setShowPicker(false);
            }}
            onClose={() => setShowPicker(false)}
          />
        )}
      </AnimatePresence>
    </div>
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
  const ramSteps = [...new Set([
    1,
    ...Array.from({ length: Math.floor(totalRam / _step) }, (_, i) => (i + 1) * _step),
    totalRam,
  ])].filter(v => v >= 1 && v <= totalRam).sort((a, b) => a - b);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Sub-tabs */}
      <div className="flex items-center gap-1 px-5 pt-5 pb-0 flex-shrink-0">
        {[
          { id: "game",    label: "Игра",    icon: SlidersHorizontal },
          { id: "mods",    label: "Моды",    icon: Package },
          { id: "shaders", label: "Шейдеры", icon: Zap },
        ].map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setSettingTab(id)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-semibold transition-all duration-150 ${
              settingTab === id
                ? "bg-white/[0.08] text-white"
                : "text-white/35 hover:text-white/60 hover:bg-white/[0.04]"
            }`}
          >
            <Icon size={12} />{label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
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
                        className={`text-[11px] px-3 py-1.5 rounded-lg transition-all duration-150 border ${
                          resolution === r
                            ? "bg-blue-600/20 text-blue-400 border-blue-500/25"
                            : "bg-white/[0.03] text-white/30 border-transparent hover:text-white/55"
                        }`}
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
                className={`self-start flex items-center gap-2 rounded-xl px-5 py-2.5 text-[12px] font-bold transition-all duration-200 ${
                  savedOk ? "bg-green-600 text-white" : "bg-blue-600 hover:bg-blue-500 text-white"
                }`}
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

// ─── Modrinth panel ───────────────────────────────────────────────────────────
function ModrinthPanel({ type, allowedSlugs }) {
  const [projects,   setProjects]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [installed,  setInstalled]  = useState(new Set());
  const [installing, setInstalling] = useState(new Set());

  useEffect(() => {
    setLoading(true);
    setProjects([]);
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
    <div className="flex items-center gap-2 text-white/30 text-[12px] py-6">
      <Loader2 size={14} className="animate-spin" />
      Загрузка...
    </div>
  );

  return (
    <div className="flex flex-col gap-2.5 max-w-[580px]">
      {projects.map(proj => {
        const isInstalled  = installed.has(proj.id);
        const isInstalling = installing.has(proj.id);
        return (
          <motion.div key={proj.id}
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 rounded-2xl bg-[#0c0c0c] border border-white/[0.06] p-4 hover:border-white/[0.1] transition-colors"
          >
            <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 bg-white/[0.04]">
              {proj.icon_url
                ? <img src={proj.icon_url} alt="" className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center"><Package size={16} className="text-white/20" /></div>
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-white truncate">{proj.title}</p>
              <p className="text-[11px] text-white/40 truncate mt-0.5">{proj.description}</p>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-[9px] text-white/20">⬇ {(proj.downloads||0).toLocaleString("ru-RU")}</span>
              </div>
            </div>
            <button
              onClick={() => !isInstalled && !isInstalling && handleInstall(proj)}
              disabled={isInstalled || isInstalling}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-bold transition-all duration-200 border ${
                isInstalled  ? "bg-green-600/20 text-green-400 border-green-500/20 cursor-default" :
                isInstalling ? "bg-white/[0.05] text-white/35 border-white/[0.06] cursor-wait" :
                               "bg-blue-600/20 hover:bg-blue-600/35 text-blue-400 border-blue-500/20"
              }`}
            >
              {isInstalled  ? <><CheckCircle2 size={12} />Установлен</> :
               isInstalling ? <><Loader2 size={12} className="animate-spin" />Скачка...</> :
                              <><Download size={12} />Установить</>}
            </button>
          </motion.div>
        );
      })}
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
      <p className="text-[10px] text-white/20 uppercase tracking-[0.14em] font-semibold">{title}</p>
      <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: "#0d0d0d" }}>
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
