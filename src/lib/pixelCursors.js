// ═══════════════════════════════════════════════════════════════════════════
//  Пиксельные курсоры в стиле Minecraft item-иконок.
//  Каждый курсор — 24x24 спрайт, отрисованный пиксель-артом.
//  Рендер через canvas с image-rendering: pixelated → чёткие квадратные пиксели.
//
//  Палитра — буквы-коды цветов,legend в PALETTE. Пиксели идут построчно сверху-вниз,
//  слева-направо. "." = прозрачный.
// ═══════════════════════════════════════════════════════════════════════════

export const PALETTE = {
  ".": null, // transparent
  // Нейтральные
  "K": "#0a0a0a", // чёрный контур (outline)
  "D": "#1a1a1a", // тёмно-серый
  "G": "#6b6b6b", // серый (металл)
  "S": "#c8c8c8", // светлый металл
  "W": "#f5f5f5", // белый highlight
  "B": "#3d2817", // коричневый (дерево)
  "b": "#5c3a1e", // светлое дерево
  "R": "#7a4a1a", // рукоять рыжая
  // STARWARS — световой меч (синий клинок)
  "u": "#3b82f6", // синий клинок
  "U": "#60a5fa", // светло-синий блик острия
  "F": "#ffffff", // белое ядро (горячий центр)
  // STARWARS (legacy фиолет — не используется новыми спрайтами)
  "P": "#7c3aed", // фиолетовый насыщенный
  "p": "#a78bfa", // светло-фиолетовый
  "L": "#ede9fe", // бледно-фиолет (ядро клинка)
  // MINIGAMES (зелёный — кровать)
  "E": "#16a34a", // тёмно-зелёный (одеяло)
  "e": "#4ade80", // зелёный
  "y": "#bbf7d0", // светло-зелёный
  "g": "#052e16", // глубокий зелёный
  "M": "#fef3c7", // матрас кремовый
  "m": "#fde68a", // матрас тёплый
  // GTA — пачка купюр (зелёная купюра + красная лента)
  "d": "#15803d", // тёмно-зелёная купюра
  // GTA (красная лента/акцент)
  "X": "#b91c1c", // тёмно-красный
  "x": "#ef4444", // красный
  "r": "#fca5a5", // светло-красный
  // VANILA+ (cyan кирка — гол.руда на гол., дерево на рукояти)
  "C": "#0891b2", // cyan насыщенный
  "c": "#22d3ee", // cyan
  "j": "#a5f3fc", // светло-cyan
  "A": "#67e8f9", // cyan яркий (miner highlight)
  // ANARCHY (сердечко — красное)
  "H": "#dc2626", // сердце насыщенное
  "h": "#ef4444", // сердце
  "Q": "#fca5a5", // сердце светлое
  "I": "#fecaca", // блик
  "T": "#dc2626", // (legacy TNT, не используется)
  "t": "#f87171", // (legacy TNT)
  "N": "#fbbf24", // искра жёлтая
};

// ── STARWARS — световой меч (lightsaber), синий клинок вверх ──
// Клинок: u/U синий glow, F белое ядро. Рукоять: S хром, g тёмные пазы, K контур.
// tip — остриё клинка по центру (колонка 12): (12, 0)
export const SPRITE_STARWARS = [
  "............U...........",  // 12 dots | U | 11 dots  (24)
  "............u...........",
  "...........uFu..........",  // F на колонке 12
  "...........uFu..........",
  "..........uuFuu.........",  // клинок расширяется к основанию
  "..........uuFuu.........",
  "..........uuFuu.........",
  "..........uuFuu.........",
  "..........uuFuu.........",
  "..........uuFuu.........",
  "........GuuuFuuuG.......",  // основание клинка
  "......GGGuuuFuuuGGG.....",  // эмиттер
  ".....KSSSSSSSSSSSSSK....",  // гарда
  ".....KSSSSSSSSSSSSSK....",
  ".....KSSgSSgSSgSSgSK....",  // рукоять с пазами
  ".....KSSgSSgSSgSSgSK....",
  ".....KSSgSSgSSgSSgSK....",
  ".....KSSgSSgSSgSSgSK....",
  ".....KSSSSSSSSSSSSSK....",
  ".....KKKKKKKKKKKKKKK....",  // навершие
  "........................",
  "........................",
  "........................",
  "........................",
];

// ── MINIGAMES — кровать (MC bed, вид сбоку, зелёное одеяло) ──
// Каркас дерево, матрас кремовый, одеяло зелёное, подушка слева.
// tip — верхний-левый угол подушки (активная точка): (3, 1)
export const SPRITE_MINIGAMES = [
  "...KKKKKKKKKKKKKKKKKK....",
  "..KMMMMMMMMMMEEEEEEEEK...",
  "..KMmMMMMMMMMeeeeeeeeK...",
  ".KKKKKKKKKKKKKKKKKKKKKK..",
  ".KBbbbbbbBeeeeeeeeeeeK...",
  ".KBbbbbbBeeeeeeeeeeEeK...",
  ".KBbbbbbBeeeeeeeeEEeeK...",
  ".KBbbbbbbBeeeeeeeeeEeK...",
  ".KBbbbbbbbbBeeeeeeEEEK...",
  ".KBbbbbbbbbbbbBeeeeeeK...",
  ".KBbbbbbbbbbbbbbBeeeeK...",
  ".KBbbbbbbbbbbbbbbbbB K...",
  "KBbbbbbbbbbbbbbbbbbbBK...",
  "KBbbbbbbbbbbbbbbbbbbBK...",
  "KBbbbbbbbbbbbbbbbbbbBK...",
  ".K....................K..",
  ".KBK................B K..",
  "..KKBK..............KBK..",
  "...KKBK............KBK...",
  "....KKK............KKK...",
  ".........................",
  ".........................",
  ".........................",
  ".........................",
];

// ── GTA — прицел/мишень (bullseye target, красный) ──
// tip — центр мишени: (12, 12)
export const SPRITE_GTA = [
  ".........................",
  ".........................",
  ".......KKKK..KKKK........",
  "......K....KK....K.......",
  ".....K..KKKKKKKK..K......",
  "....K.KKxxxxxxxxKK.K.....",
  "...K.KxxrrrrrrrrxxK.K....",
  "..K.KxrrrrrrrrrrrrxK.K...",
  "..K.KxrrXXXXXXXXXXrxK.K..",
  "..K.KxrXXXXXXXXXXXrxK.K..",
  "..K.KxrXXXXXXXXXXXrxK.K..",
  "KKK.KxrXXXXXXXXXXXrxK.KKK",
  "..K.KxrXXXXXXXXXXXrxK.K..",
  "..K.KxrXXXXXXXXXXXrxK.K..",
  "..K.KxrXXXXXXXXXXXrxK.K..",
  "..K.KxrrXXXXXXXXXXrxK.K..",
  "...K.KxxrrrrrrrrxxK.K....",
  "....K.KKxxxxxxxxKK.K.....",
  ".....K..KKKKKKKK..K......",
  "......K....KK....K.......",
  ".......KKKK..KKKK........",
  ".........................",
  ".........................",
  ".........................",
];

// ── VANILA+ — кирка (pickaxe, диагональ, гол.руда cyan + дерево) ──
// Гол.руда сверху-справа (cyan), деревянная рукоять снизу-слева.
// tip — остриё кирки вверху-справа: (19, 1)
export const SPRITE_VANILLA = [
  "...................KjAAK.",
  "..................KjAcAK.",
  ".................KjAccAK.",
  "................KjAcccAK.",
  "...............KjAcccAK..",
  "..............KjAcCcAK...",
  ".............KjACCCAK....",
  "............KjACCCAK.....",
  "...........KjACCCAK......",
  "..........KjACCCAK.......",
  ".........KjACCCAK........",
  "........KjACCCAK.........",
  ".......KjACCCAK..........",
  "......KjACCAK............",
  ".....KjACCAK.............",
  "....KjACAKK..............",
  "...KBbbBK................",
  "..KBbbbBK................",
  ".KBbbbbBK...............",
  "KBbbbbbbK...............",
  "KKKKKKKKK................",
  ".........................",
  ".........................",
  ".........................",
];

// ── ANARCHY — сердечко (MC heart, красное с бликом) ──
// Две дуги сверху, сужение к острому низу. Блик в левом "куполе".
// tip — центр-верх сердца (углубление между дугами): (11, 4)
export const SPRITE_ANARCHY = [
  ".........................",
  ".........................",
  ".........................",
  ".....KKK....KKK..........",
  "....KHHQK..KHhQK.........",
  "...KHQQQKKKHQQQK.........",
  "..KHQQQQQQQQQQQK.........",
  "..KQQQQQQQQQQQQK.........",
  "..KQQQQQQQQQQQQK.........",
  "..KQQQQQQQQQQQQK.........",
  "..KQQQQQQQQQQQQK.........",
  "..KQQQQQQQQQQQQK.........",
  "...KQQQQQQQQQQK..........",
  "...KQQQQQQQQQQK..........",
  "....KQQQQQQQQK...........",
  "....KQQQQQQQQK...........",
  ".....KQQQQQQK............",
  "......KQQQQK.............",
  ".......KQQK..............",
  "........KK...............",
  ".........................",
  ".........................",
  ".........................",
  ".........................",
];

// ── Таблица курсоров: id сервера → { sprite, tipX, tipY, name } ──
// tipX/tipY — точка клика в координатах спрайта (куда наводится острие/активная точка).
export const CURSORS = {
  starwars:     { sprite: SPRITE_STARWARS,  tipX: 12, tipY: 0,  name: "lightsaber", glow: "rgba(59,130,246,0.55)" },
  minigames:    { sprite: SPRITE_MINIGAMES, tipX: 3,  tipY: 1,  name: "bed",        glow: "rgba(74,222,128,0.55)" },
  gta:          { sprite: SPRITE_GTA,       tipX: 12, tipY: 12, name: "target",     glow: "rgba(248,113,113,0.55)" },
  vanilla_plus: { sprite: SPRITE_VANILLA,   tipX: 19, tipY: 1,  name: "pickaxe",    glow: "rgba(34,211,238,0.55)" },
  anarchy:      { sprite: SPRITE_ANARCHY,   tipX: 11, tipY: 4,  name: "heart",      glow: "rgba(248,113,113,0.6)" },
};

// ═══════════════════════════════════════════════════════════════════════════
//  Рендер пиксельного спрайта в <canvas>, возвращает data URL.
//  scale = во сколько раз увеличить (24px спрайт × scale = финальный размер).
//  image-rendering: pixelated даст чёткие квадратные пиксели.
// ═══════════════════════════════════════════════════════════════════════════
const spriteCache = new Map();

export function renderSprite(sprite, scale = 1) {
  // Ключ кэша учитывает хэш содержимого, т.к. спрайты могут меняться.
  const contentKey = sprite.map(r => r.length).join(",") + "_" + scale;
  if (spriteCache.has(contentKey)) return spriteCache.get(contentKey);

  // Нормализуем: все строки → одинаковая ширина = максимальная.
  // Спрайты писаны вручную, возможны расхождения в 1 символ.
  const w = Math.max(...sprite.map(r => r.length));
  const h = sprite.length;
  const canvas = document.createElement("canvas");
  canvas.width = w * scale;
  canvas.height = h * scale;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  for (let y = 0; y < h; y++) {
    const row = sprite[y];
    for (let x = 0; x < w; x++) {
      const code = row[x] || "."; // недостающие символы = прозрачные
      const color = PALETTE[code];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  }

  const url = canvas.toDataURL("image/png");
  spriteCache.set(contentKey, url);
  return url;
}

// Сброс кэша (например при смене темы). Пока не нужно.
export function invalidateSpriteCache() {
  spriteCache.clear();
}
