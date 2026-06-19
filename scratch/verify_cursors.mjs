// Структурный валидатор пиксельных курсоров.
// Запуск: node scratch/verify_cursors.mjs
// Проверяет: спрайт — массив строк; каждый символ — код из PALETTE
// или прозрачный ("." или пробел); hotspot (tipX,tipY) внутри спрайта
// и на непрозрачном (solid) пикселе. Ширину не навязывает — renderSprite
// паддингит короткие строки и трактует не-палетные символы как прозрачные.
import { PALETTE, CURSORS } from "../src/lib/pixelCursors.js";

const TRANSPARENT = new Set([".", " "]);
let errors = 0;

for (const [id, cursor] of Object.entries(CURSORS)) {
  const sprite = cursor.sprite;
  if (!Array.isArray(sprite) || sprite.length === 0) {
    console.error(`[${id}] спрайт не массив строк или пуст`);
    errors++;
    continue;
  }

  let maxW = 0;
  sprite.forEach((row, y) => {
    if (typeof row !== "string") {
      console.error(`[${id}] строка ${y}: не строка`);
      errors++;
      return;
    }
    if (row.length > maxW) maxW = row.length;
    for (let x = 0; x < row.length; x++) {
      const code = row[x];
      if (!TRANSPARENT.has(code) && !(code in PALETTE)) {
        console.error(`[${id}] строка ${y} колонка ${x}: неизвестный код "${code}"`);
        errors++;
      }
    }
  });

  const { tipX, tipY } = cursor;
  const inBounds =
    Number.isInteger(tipX) && Number.isInteger(tipY) &&
    tipY >= 0 && tipY < sprite.length &&
    tipX >= 0 && tipX < (sprite[tipY]?.length ?? 0);
  if (!inBounds) {
    console.error(`[${id}] hotspot вне спрайта: (${tipX},${tipY}) при ${maxW}×${sprite.length}`);
    errors++;
  } else {
    const pixel = sprite[tipY][tipX];
    if (TRANSPARENT.has(pixel) || !(pixel in PALETTE)) {
      console.error(`[${id}] hotspot (${tipX},${tipY}) на прозрачном пикселе "${pixel}"`);
      errors++;
    }
  }
  console.log(`[${id}] ${maxW}×${sprite.length} hotspot(${tipX},${tipY}) — структура OK`);
}

if (errors > 0) {
  console.error(`\nFAIL: ${errors} ошибок`);
  process.exit(1);
}
console.log(`\nOK: все ${Object.keys(CURSORS).length} курсоров валидны`);
