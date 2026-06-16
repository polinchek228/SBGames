export const RARITIES = {
  common:    { label: "Обычный",   color: "#94a3b8" },
  rare:      { label: "Редкий",    color: "#3b82f6" },
  epic:      { label: "Эпический", color: "#a855f7" },
  legendary: { label: "Легенда",   color: "#f59e0b" },
};

// Server URL for streaming assets (not bundled locally)
const CDN = "https://api.hyperionsearch.xyz";

export const LIBRARY_CATALOG = [
  // ── Бесплатные ──
  { id: "frame_basic_gray",  type: "frame",      name: "Torn",                   price: 0,    color: "#6b7280",  rarity: "common",    free: true, image: `${CDN}/frames/frame.png` },
  { id: "badge_cross",       type: "badge",      name: "Cross",                  price: 0,    color: "#f43f5e",  rarity: "common",    free: true, icon: `${CDN}/icons/icon9.png` },

  // ── Рамки ──
  { id: "frame_basic_blue",  type: "frame",      name: "Sketched Memory",        price: 200,  color: "#3b82f6",  rarity: "common",    image: `${CDN}/frames/frame2.png` },
  { id: "frame_neon",        type: "frame",      name: "Bewitching Frame",       price: 500,  color: "#a855f7",  rarity: "rare",      image: `${CDN}/frames/frame3.png` },
  { id: "frame_gold",        type: "frame",      name: "oil",                    price: 1500, color: "#facc15",  rarity: "epic",      image: `${CDN}/frames/frame4.png` },
  { id: "frame_galaxy",      type: "frame",      name: "Элли у окна",            price: 3000, color: "#818cf8",  rarity: "legendary", image: `${CDN}/frames/frame5.png` },
  { id: "frame_fire",        type: "frame",      name: "Husk Frame",             price: 2000, color: "#f97316",  rarity: "epic",      image: `${CDN}/frames/frame6.png` },

  // ── Фоны (видео — стриминг с сервера) ──
  { id: "bg_fon1",           type: "background", name: "Lilywhite & Lilyblack",  price: 0,    color: "#3b82f6",  rarity: "common",    free: true, video: `${CDN}/backgrounds/fon1.mp4` },
  { id: "bg_fon2",           type: "background", name: "Miss Neko 2",            price: 500,  color: "#8b5cf6",  rarity: "rare",      video: `${CDN}/backgrounds/fon2.mp4` },
  { id: "bg_fon3",           type: "background", name: "Muse Dash",              price: 800,  color: "#ec4899",  rarity: "rare",      video: `${CDN}/backgrounds/fon3.mp4` },
  { id: "bg_fon4",           type: "background", name: "GetsuClanEstate",        price: 1200, color: "#f97316",  rarity: "epic",      video: `${CDN}/backgrounds/fon4.mp4` },
  { id: "bg_fon5",           type: "background", name: "Circle of Hell",         price: 1500, color: "#eab308",  rarity: "epic",      video: `${CDN}/backgrounds/fon5.mp4` },
  { id: "bg_fon6",           type: "background", name: "Black Hole",             price: 2000, color: "#22c55e",  rarity: "legendary", video: `${CDN}/backgrounds/fon6.mp4` },
  { id: "bg_fon7",           type: "background", name: "noir-anime2",            price: 2500, color: "#06b6d4",  rarity: "legendary", video: `${CDN}/backgrounds/fon7.mp4` },

  // ── Анимации аватара ──
  { id: "anim_pulse",        type: "avatar_animated", name: "Импульс",   price: 1200, color: "#60a5fa",  rarity: "epic" },
  { id: "anim_flame",        type: "avatar_animated", name: "Пламя",     price: 1200, color: "#f97316",  rarity: "epic" },
  { id: "anim_neon",         type: "avatar_animated", name: "Неон",      price: 1500, color: "#a855f7",  rarity: "legendary" },

  // ── Бейджи ──
  { id: "badge_glitch",      type: "badge",      name: "Glitch",                 price: 500,  color: "#64748b",  rarity: "rare",      icon: `${CDN}/icons/icon.png` },
  { id: "badge_toxic",       type: "badge",      name: "Toxic",                  price: 500,  color: "#84cc16",  rarity: "rare",      icon: `${CDN}/icons/icon1.png` },
  { id: "badge_sans",        type: "badge",      name: "Sans",                   price: 500,  color: "#ef4444",  rarity: "rare",      icon: `${CDN}/icons/icon2.png` },
  { id: "badge_panic",       type: "badge",      name: "Panic",                  price: 500,  color: "#fbbf24",  rarity: "rare",      icon: `${CDN}/icons/icon3.png` },
  { id: "badge_hollow",      type: "badge",      name: "Hollow",                 price: 500,  color: "#e2e8f0",  rarity: "rare",      icon: `${CDN}/icons/icon4.png` },
  { id: "badge_horned",      type: "badge",      name: "Horned",                 price: 500,  color: "#334155",  rarity: "rare",      icon: `${CDN}/icons/icon5.png` },
  { id: "badge_void",        type: "badge",      name: "Void",                   price: 500,  color: "#94a3b8",  rarity: "rare",      icon: `${CDN}/icons/icon6.png` },
  { id: "badge_trigger",     type: "badge",      name: "Trigger",                price: 500,  color: "#f97316",  rarity: "rare",      icon: `${CDN}/icons/icon7.png` },
  { id: "badge_creeper",     type: "badge",      name: "Creeper",                price: 500,  color: "#22c55e",  rarity: "rare",      icon: `${CDN}/icons/icon8.png` },
  { id: "badge_voodoo",      type: "badge",      name: "Voodoo",                 price: 500,  color: "#a855f7",  rarity: "rare",      icon: `${CDN}/icons/icon10.png` },
];

export const CATALOG_BY_ID = Object.fromEntries(LIBRARY_CATALOG.map((i) => [i.id, i]));
