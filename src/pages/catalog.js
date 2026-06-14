export const RARITIES = {
  common:    { label: "Обычный",   color: "#94a3b8" },
  rare:      { label: "Редкий",    color: "#3b82f6" },
  epic:      { label: "Эпический", color: "#a855f7" },
  legendary: { label: "Легенда",   color: "#f59e0b" },
};

export const LIBRARY_CATALOG = [
  // ── Бесплатные ──
  { id: "frame_basic_gray",  type: "frame",      name: "Torn",                   price: 0,    color: "#6b7280",  rarity: "common",    free: true, image: "/frame.png" },
  { id: "badge_heart",       type: "badge",      name: "Сердце",                 price: 0,    color: "#f43f5e",  rarity: "common",    free: true },

  // ── Рамки ──
  { id: "frame_basic_blue",  type: "frame",      name: "Sketched Memory",        price: 200,  color: "#3b82f6",  rarity: "common",    image: "/frame2.png" },
  { id: "frame_neon",        type: "frame",      name: "Bewitching Frame",       price: 500,  color: "#a855f7",  rarity: "rare",      image: "/frame3.png" },
  { id: "frame_gold",        type: "frame",      name: "oil",                    price: 1500, color: "#facc15",  rarity: "epic",      image: "/frame4.png" },
  { id: "frame_galaxy",      type: "frame",      name: "Элли у окна",            price: 3000, color: "#818cf8",  rarity: "legendary", image: "/frame5.png" },
  { id: "frame_fire",        type: "frame",      name: "Husk Frame",             price: 2000, color: "#f97316",  rarity: "epic",      image: "/frame6.png" },

  // ── Фоны (видео) ──
  { id: "bg_fon1",           type: "background", name: "Lilywhite & Lilyblack",  price: 0,    color: "#3b82f6",  rarity: "common",    free: true, video: "/fon1.mp4" },
  { id: "bg_fon2",           type: "background", name: "Miss Neko 2",            price: 500,  color: "#8b5cf6",  rarity: "rare",      video: "/fon2.mp4" },
  { id: "bg_fon3",           type: "background", name: "Muse Dash",              price: 800,  color: "#ec4899",  rarity: "rare",      video: "/fon3.mp4" },
  { id: "bg_fon4",           type: "background", name: "GetsuClanEstate",        price: 1200, color: "#f97316",  rarity: "epic",      video: "/fon4.mp4" },
  { id: "bg_fon5",           type: "background", name: "Circle of Hell",         price: 1500, color: "#eab308",  rarity: "epic",      video: "/fon5.mp4" },
  { id: "bg_fon6",           type: "background", name: "Black Hole",             price: 2000, color: "#22c55e",  rarity: "legendary", video: "/fon6.mp4" },
  { id: "bg_fon7",           type: "background", name: "noir-anime2",            price: 2500, color: "#06b6d4",  rarity: "legendary", video: "/fon7.mp4" },

  // ── Анимации аватара ──
  { id: "anim_pulse",        type: "avatar_animated", name: "Импульс",   price: 1200, color: "#60a5fa",  rarity: "epic" },
  { id: "anim_flame",        type: "avatar_animated", name: "Пламя",     price: 1200, color: "#f97316",  rarity: "epic" },
  { id: "anim_neon",         type: "avatar_animated", name: "Неон",      price: 1500, color: "#a855f7",  rarity: "legendary" },

  // ── Бейджи ──
  { id: "badge_diamond",     type: "badge",      name: "Бриллиант",      price: 800,  color: "#38bdf8",  rarity: "epic" },
  { id: "badge_flame",       type: "badge",      name: "Пламя",          price: 600,  color: "#f97316",  rarity: "rare" },
  { id: "badge_star",        type: "badge",      name: "Звезда",         price: 500,  color: "#facc15",  rarity: "rare" },
  { id: "badge_skull",       type: "badge",      name: "Череп",          price: 1000, color: "#ef4444",  rarity: "epic" },
];

export const CATALOG_BY_ID = Object.fromEntries(LIBRARY_CATALOG.map((i) => [i.id, i]));
