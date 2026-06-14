export const LIBRARY_CATALOG = [
  // ── Рамки ──
  { id: "frame_basic_blue",  type: "frame",      name: "Синяя рамка",     price: 200,  color: "#3b82f6",  desc: "Классическая рамка в синих тонах. Сдержанно и стильно." },
  { id: "frame_neon",        type: "frame",      name: "Неоновая рамка",  price: 500,  color: "#a855f7",  desc: "Светящаяся неоновая рамка — выделяет аватар среди остальных." },
  { id: "frame_gold",        type: "frame",      name: "Золотая рамка",   price: 1500, color: "#facc15",  desc: "Роскошная золотая рамка для истинных ценителей." },
  { id: "frame_galaxy",      type: "frame",      name: "Галактика",       price: 3000, color: "#818cf8",  desc: "Космическая рамка с мерцающими звёздами. Топовый скин." },
  { id: "frame_fire",        type: "frame",      name: "Огненная",        price: 2000, color: "#f97316",  desc: "Пылающая рамка для самых дерзких игроков." },
  { id: "frame_ice",         type: "frame",      name: "Ледяная",         price: 2000, color: "#38bdf8",  desc: "Холодная как лёд — ледяные кристаллы на краях." },

  // ── Фоны ──
  { id: "bg_aurora",         type: "background", name: "Аврора",          price: 400,  color: "#6366f1",  desc: "Северное сияние — переливающиеся цвета на фоне профиля." },
  { id: "bg_ember",          type: "background", name: "Уголёк",          price: 400,  color: "#dc2626",  desc: "Тёплые угли затухающего костра. Атмосферно и уютно." },
  { id: "bg_void",           type: "background", name: "Пустота",         price: 800,  color: "#1e1b4b",  desc: "Бездонная пустота — глубокий тёмный фон с лёгким свечением." },
  { id: "bg_cosmic",         type: "background", name: "Космос",          price: 1200, color: "#7c3aed",  desc: "Звёздное небо туманностей. Самый красивый фон в каталоге." },

  // ── Анимации аватара ──
  { id: "anim_pulse",        type: "avatar_animated", name: "Импульс",   price: 1200, color: "#60a5fa",  desc: "Пульсирующее свечение вокруг аватара — живой эффект." },
  { id: "anim_flame",        type: "avatar_animated", name: "Пламя",     price: 1200, color: "#f97316",  desc: "Пляшущие языки пламени обрамляют аватар огнём." },
  { id: "anim_neon",         type: "avatar_animated", name: "Неон",      price: 1500, color: "#a855f7",  desc: "Неоновая пульсация — аватар в стиле киберпанк." },

  // ── Бейджи ──
  { id: "badge_diamond",     type: "badge",      name: "Бриллиант",      price: 800,  color: "#38bdf8",  desc: "Сияющий бриллиантовый бейдж — знак престижа." },
  { id: "badge_flame",       type: "badge",      name: "Пламя",          price: 600,  color: "#f97316",  desc: "Огненный бейдж для горячих голов." },
  { id: "badge_star",        type: "badge",      name: "Звезда",         price: 500,  color: "#facc15",  desc: "Золотая звезда — классика жанра." },
  { id: "badge_skull",       type: "badge",      name: "Череп",          price: 1000, color: "#ef4444",  desc: "Череп — только для самых опасных игроков сервера." },
];

export const CATALOG_BY_ID = Object.fromEntries(LIBRARY_CATALOG.map((i) => [i.id, i]));
