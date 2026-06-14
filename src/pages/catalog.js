export const RARITIES = {
  common:    { label: "Обычный",   color: "#94a3b8" },
  rare:      { label: "Редкий",    color: "#3b82f6" },
  epic:      { label: "Эпический", color: "#a855f7" },
  legendary: { label: "Легенда",   color: "#f59e0b" },
};

export const LIBRARY_CATALOG = [
  // ── Бесплатные ──
  { id: "frame_basic_gray",  type: "frame",      name: "Серая рамка",     price: 0,    color: "#6b7280",  rarity: "common",    desc: "Базовая рамка — бесплатно для всех.", free: true },
  { id: "bg_stars",          type: "background", name: "Звёзды",          price: 0,    color: "#475569",  rarity: "common",    desc: "Простой звёздный фон. Стартовый подарок.", free: true },
  { id: "badge_heart",       type: "badge",      name: "Сердце",          price: 0,    color: "#f43f5e",  rarity: "common",    desc: "Сердечко — подарок за регистрацию.", free: true },

  // ── Рамки ──
  { id: "frame_basic_blue",  type: "frame",      name: "Синяя рамка",     price: 200,  color: "#3b82f6",  rarity: "common",    desc: "Классическая рамка в синих тонах. Сдержанно и стильно." },
  { id: "frame_neon",        type: "frame",      name: "Неоновая рамка",  price: 500,  color: "#a855f7",  rarity: "rare",      desc: "Светящаяся неоновая рамка — выделяет аватар среди остальных." },
  { id: "frame_gold",        type: "frame",      name: "Золотая рамка",   price: 1500, color: "#facc15",  rarity: "epic",      desc: "Роскошная золотая рамка для истинных ценителей." },
  { id: "frame_galaxy",      type: "frame",      name: "Галактика",       price: 3000, color: "#818cf8",  rarity: "legendary", desc: "Космическая рамка с мерцающими звёздами. Топовый скин." },
  { id: "frame_fire",        type: "frame",      name: "Огненная",        price: 2000, color: "#f97316",  rarity: "epic",      desc: "Пылающая рамка для самых дерзких игроков." },
  { id: "frame_ice",         type: "frame",      name: "Ледяная",         price: 2000, color: "#38bdf8",  rarity: "epic",      desc: "Холодная как лёд — ледяные кристаллы на краях." },

  // ── Фоны ──
  { id: "bg_aurora",         type: "background", name: "Аврора",          price: 400,  color: "#6366f1",  rarity: "rare",      desc: "Северное сияние — переливающиеся цвета на фоне профиля." },
  { id: "bg_ember",          type: "background", name: "Уголёк",          price: 400,  color: "#dc2626",  rarity: "rare",      desc: "Тёплые угли затухающего костра. Атмосферно и уютно." },
  { id: "bg_void",           type: "background", name: "Пустота",         price: 800,  color: "#1e1b4b",  rarity: "epic",      desc: "Бездонная пустота — глубокий тёмный фон с лёгким свечением." },
  { id: "bg_cosmic",         type: "background", name: "Космос",          price: 1200, color: "#7c3aed",  rarity: "legendary", desc: "Звёздное небо туманностей. Самый красивый фон в каталоге." },

  // ── Анимации аватара ──
  { id: "anim_pulse",        type: "avatar_animated", name: "Импульс",   price: 1200, color: "#60a5fa",  rarity: "epic",      desc: "Пульсирующее свечение вокруг аватара — живой эффект." },
  { id: "anim_flame",        type: "avatar_animated", name: "Пламя",     price: 1200, color: "#f97316",  rarity: "epic",      desc: "Пляшущие языки пламени обрамляют аватар огнём." },
  { id: "anim_neon",         type: "avatar_animated", name: "Неон",      price: 1500, color: "#a855f7",  rarity: "legendary", desc: "Неоновая пульсация — аватар в стиле киберпанк." },

  // ── Бейджи ──
  { id: "badge_diamond",     type: "badge",      name: "Бриллиант",      price: 800,  color: "#38bdf8",  rarity: "epic",      desc: "Сияющий бриллиантовый бейдж — знак престижа." },
  { id: "badge_flame",       type: "badge",      name: "Пламя",          price: 600,  color: "#f97316",  rarity: "rare",      desc: "Огненный бейдж для горячих голов." },
  { id: "badge_star",        type: "badge",      name: "Звезда",         price: 500,  color: "#facc15",  rarity: "rare",      desc: "Золотая звезда — классика жанра." },
  { id: "badge_skull",       type: "badge",      name: "Череп",          price: 1000, color: "#ef4444",  rarity: "epic",      desc: "Череп — только для самых опасных игроков сервера." },
];

export const CATALOG_BY_ID = Object.fromEntries(LIBRARY_CATALOG.map((i) => [i.id, i]));
