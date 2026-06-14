export const LIBRARY_CATALOG = [
  { id: "frame_basic_blue",  type: "frame",          name: "Синяя рамка",     price: 200,  color: "#3b82f6" },
  { id: "frame_neon",        type: "frame",          name: "Неоновая рамка",  price: 500,  color: "#a855f7" },
  { id: "frame_gold",        type: "frame",          name: "Золотая рамка",   price: 1500, color: "#facc15" },
  { id: "frame_galaxy",      type: "frame",          name: "Галактика",       price: 3000, color: "#818cf8" },
  { id: "frame_fire",        type: "frame",          name: "Огненная",        price: 2000, color: "#f97316" },
  { id: "frame_ice",         type: "frame",          name: "Ледяная",         price: 2000, color: "#38bdf8" },
  { id: "bg_aurora",         type: "background",     name: "Аврора",          price: 400,  color: "#6366f1" },
  { id: "bg_ember",          type: "background",     name: "Уголёк",          price: 400,  color: "#dc2626" },
  { id: "bg_void",           type: "background",     name: "Пустота",         price: 800,  color: "#1e1b4b" },
  { id: "bg_cosmic",         type: "background",     name: "Космос",          price: 1200, color: "#7c3aed" },
  { id: "anim_pulse",        type: "avatar_animated", name: "Импульс",       price: 1200, color: "#60a5fa" },
  { id: "anim_flame",        type: "avatar_animated", name: "Пламя",         price: 1200, color: "#f97316" },
  { id: "anim_neon",         type: "avatar_animated", name: "Неон",          price: 1500, color: "#a855f7" },
  { id: "badge_diamond",     type: "badge",          name: "Бриллиант",       price: 800,  color: "#38bdf8" },
  { id: "badge_flame",       type: "badge",          name: "Пламя",           price: 600,  color: "#f97316" },
  { id: "badge_star",        type: "badge",          name: "Звезда",          price: 500,  color: "#facc15" },
  { id: "badge_skull",       type: "badge",          name: "Череп",           price: 1000, color: "#ef4444" },
];

export const CATALOG_BY_ID = Object.fromEntries(LIBRARY_CATALOG.map((i) => [i.id, i]));
