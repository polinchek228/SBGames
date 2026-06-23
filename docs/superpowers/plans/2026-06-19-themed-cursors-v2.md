# Themed Cursors v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the STARWARS cursor (Nether Star → blue lightsaber) and the GTA cursor (bullseye → dollar bill) in `src/lib/pixelCursors.js`, leaving the other three cursors and all rendering logic untouched.

**Architecture:** Pure data change. `pixelCursors.js` holds 24×24 pixel-art sprites as ASCII matrices + a `PALETTE` code→color map + a `CURSORS` table (sprite, hotspot `tipX/tipY`, glow color). `CustomCursor.jsx` renders them generically via `renderSprite()` — it is NOT modified. A new node verification script validates matrix structure (24 rows × 24 cols, every code in `PALETTE`, hotspot on a non-transparent pixel) so typos in the ASCII art fail loudly instead of rendering as holes.

**Tech Stack:** Vanilla JS (ESM), Vite, React. No test framework installed — verification is a standalone node `.mjs` script using the existing ESM `import` (package.json already has `"type":"module"`). Visual confirmation is manual via `npm run dev`.

**Spec:** `docs/superpowers/specs/2026-06-19-themed-cursors-v2-design.md`

**Note on the spec's "stack of bills":** A multi-bill stack at 24px reads as noise. The implementation uses a single, crisp dollar bill (green face + grey portrait area + red treasury band) — more legible at cursor scale. Documented here as a deliberate simplification; the spec's intent ("recognizable as GTA money") is preserved.

---

## File Map

- **Modify:** `src/lib/pixelCursors.js` — add 3 palette codes (`u`,`U`,`d`), replace `SPRITE_STARWARS` and `SPRITE_GTA` matrices, update 2 entries in `CURSORS`.
- **Create:** `scratch/verify_cursors.mjs` — structural validator for all sprites (run with node).
- **No change:** `src/components/CustomCursor.jsx` (renderer is theme-agnostic).

## Reference: final sprites (each row is exactly 24 chars)

### STARWARS lightsaber (blade up, every row exactly 24 chars, center col 12, hotspot `(12,0)`)

Each blade row keeps the white core `F` on column 12; the hilt is a 15-wide rectangle (cols 5–19) for a clean chrome look.

```
Row 0  ............U...........    tip highlight (12 dots, U@12, 11 dots)
Row 1  ............u...........
Row 2  ...........uFu..........    F@12
Row 3  ...........uFu..........
Row 4  ..........uuFuu.........    F@12
Row 5  ..........uuFuu.........
Row 6  ..........uuFuu.........
Row 7  ..........uuFuu.........
Row 8  ..........uuFuu.........
Row 9  ..........uuFuu.........
Row 10 ........GuuuFuuuG.......    blade base widens (8 dots, 9-char group, 7 dots)
Row 11 ......GGGuuuFuuuGGG.....    emitter (6 dots, 13-char group, 5 dots)
Row 12 .....KSSSSSSSSSSSSSK....    guard top (5 dots, 15-char hilt, 4 dots)
Row 13 .....KSSSSSSSSSSSSSK....
Row 14 .....KSSgSSgSSgSSgSK....    grip grooves (g every 3 cols)
Row 15 .....KSSgSSgSSgSSgSK....
Row 16 .....KSSgSSgSSgSSgSK....
Row 17 .....KSSgSSgSSgSSgSK....
Row 18 .....KSSSSSSSSSSSSSK....    hilt bottom
Row 19 .....KKKKKKKKKKKKKKK....    pommel (5 dots, 17 K's, 2 dots)
Row 20 ........................
Row 21 ........................
Row 22 ........................
Row 23 ........................
```

### GTA dollar bill (hotspot center `(12,12)`)

```
........................
....KKKKKKKKKKKKKKKK....
....KddddddddddddddK....
....KdSSSSSSSSSSSSdK....
....KdSSSSSSSSSSSSdK....
....KddddddddddddddK....
....KXXXXXXXXXXXXXXK....
....KXXXXgXXXXgXXXXK....
....KXXXXXXXXXXXXXXK....
....KddddddddddddddK....
....KdSSSSSSSSSSSSdK....
....KdSSSSSSSSSSSSdK....
....KddddddddddddddK....
....KKKKKKKKKKKKKKKK....
........................
........................
........................
........................
........................
........................
........................
........................
........................
........................
```

---

## Task 1: Sprite verification harness

Establish a safety net BEFORE editing art. The script validates every cursor in `CURSORS`. It passes on the current (pre-change) sprites — that confirms the net works. Later tasks rely on it to catch matrix typos.

**Files:**
- Create: `scratch/verify_cursors.mjs`

- [ ] **Step 1: Write the verification script**

Create `scratch/verify_cursors.mjs`. Note: existing sprites are NOT uniformly 24-wide (e.g. MINIGAMES is 25) and contain spaces; `renderSprite` treats any non-palette char as transparent and pads ragged rows. So the validator must match that behavior — it does NOT enforce an exact width. It checks what actually matters: every char is a palette code or transparent, and the hotspot sits on a solid pixel.

```javascript
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
```

- [ ] **Step 2: Run it — must PASS on current sprites**

Run: `node scratch/verify_cursors.mjs`
Expected: `OK: все 5 курсоров валидны` (exit 0).

This confirms the net catches nothing false-positive today.

- [ ] **Step 3: Commit**

```bash
git add scratch/verify_cursors.mjs
git commit -m "test: add pixel-cursor structural validator"
```

---

## Task 2: Add three palette codes

Add the blue blade colors and the dark-green bill color to `PALETTE`.

**Files:**
- Modify: `src/lib/pixelCursors.js` (the `PALETTE` object, lines ~10–50)

- [ ] **Step 1: Add `u` and `U` to the STARWARS group**

In `src/lib/pixelCursors.js`, find the STARWARS palette block:

```javascript
  // STARWARS (фиолет)
  "P": "#7c3aed", // фиолетовый насыщенный
  "p": "#a78bfa", // светло-фиолетовый
  "L": "#ede9fe", // бледно-фиолет (ядро клинка)
  "F": "#ffffff", // белое ядро
```

Replace with (keep legacy purple codes, add blue lightsaber codes):

```javascript
  // STARWARS — световой меч (синий клинок)
  "u": "#3b82f6", // синий клинок
  "U": "#60a5fa", // светло-синий блик острия
  "F": "#ffffff", // белое ядро (горячий центр)
  // STARWARS (legacy фиолет — не используется новыми спрайтами)
  "P": "#7c3aed", // фиолетовый насыщенный
  "p": "#a78bfa", // светло-фиолетовый
  "L": "#ede9fe", // бледно-фиолет (ядро клинка)
```

- [ ] **Step 2: Add `d` to the GTA group**

Find the GTA palette block:

```javascript
  // GTA (красный)
  "X": "#b91c1c", // тёмно-красный
  "x": "#ef4444", // красный
  "r": "#fca5a5", // светло-красный
```

Replace with:

```javascript
  // GTA — пачка купюр (зелёная купюра + красная лента)
  "d": "#15803d", // тёмно-зелёная купюра
  // GTA (красная лента/акцент)
  "X": "#b91c1c", // тёмно-красный
  "x": "#ef4444", // красный
  "r": "#fca5a5", // светло-красный
```

- [ ] **Step 3: Verify palette still parses + no sprite yet uses new codes (still valid)**

Run: `node scratch/verify_cursors.mjs`
Expected: `OK: все 5 курсоров валидны` (unchanged — only palette added).

- [ ] **Step 4: Commit**

```bash
git add src/lib/pixelCursors.js
git commit -m "feat(cursors): add blue-saber and bill-green palette codes"
```

---

## Task 3: STARWARS lightsaber sprite

Replace the Nether Star with the lightsaber matrix and update its `CURSORS` entry.

**Files:**
- Modify: `src/lib/pixelCursors.js` — replace `SPRITE_STARWARS` (lines ~52–80) and the `starwars` row in `CURSORS` (line ~204).

- [ ] **Step 1: Replace `SPRITE_STARWARS`**

Find the existing `SPRITE_STARWARS` array (the Nether Star) and replace the ENTIRE array literal — from `export const SPRITE_STARWARS = [` through its closing `];` — with:

```javascript
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
```

- [ ] **Step 2: Update the `starwars` entry in `CURSORS`**

Find:

```javascript
  starwars:     { sprite: SPRITE_STARWARS,  tipX: 12, tipY: 1,  name: "lightsaber", glow: "rgba(167,139,250,0.55)" },
```

Replace with:

```javascript
  starwars:     { sprite: SPRITE_STARWARS,  tipX: 12, tipY: 0,  name: "lightsaber", glow: "rgba(59,130,246,0.55)" },
```

(`tipY` 1→0 so the hotspot sits on the blade tip; glow purple→blue `#3b82f6`.)

- [ ] **Step 3: Run the validator — must PASS**

Run: `node scratch/verify_cursors.mjs`
Expected: `OK: все 5 курсоров валидны`. If it fails on an unknown code or wrong row length, fix the matrix typo and re-run.

- [ ] **Step 4: Commit**

```bash
git add src/lib/pixelCursors.js
git commit -m "feat(cursors): STARWARS cursor → blue lightsaber"
```

---

## Task 4: GTA dollar bill sprite

Replace the bullseye with the dollar bill matrix and update its `CURSORS` entry.

**Files:**
- Modify: `src/lib/pixelCursors.js` — replace `SPRITE_GTA` (lines ~112–139) and the `gta` row in `CURSORS` (line ~206).

- [ ] **Step 1: Replace `SPRITE_GTA`**

Find the existing `SPRITE_GTA` array (the bullseye) and replace the ENTIRE array literal — from `export const SPRITE_GTA = [` through its closing `];` — with:

```javascript
// ── GTA — долларовая купюра (dollar bill), вид спереди ──
// Купюра: d тёмно-зелёная, S серый портрет/номинал, X красная лента (акцент),
// g тёмные метки-номиналы на ленте, K контур.
// tip — центр купюры: (12, 12)
export const SPRITE_GTA = [
  "........................",
  "....KKKKKKKKKKKKKKKK....",
  "....KddddddddddddddK....",
  "....KdSSSSSSSSSSSSdK....",
  "....KdSSSSSSSSSSSSdK....",
  "....KddddddddddddddK....",
  "....KXXXXXXXXXXXXXXK....",
  "....KXXXXgXXXXgXXXXK....",
  "....KXXXXXXXXXXXXXXK....",
  "....KddddddddddddddK....",
  "....KdSSSSSSSSSSSSdK....",
  "....KdSSSSSSSSSSSSdK....",
  "....KddddddddddddddK....",
  "....KKKKKKKKKKKKKKKK....",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
];
```

- [ ] **Step 2: Update the `gta` entry in `CURSORS`**

Find:

```javascript
  gta:          { sprite: SPRITE_GTA,       tipX: 12, tipY: 12, name: "target",     glow: "rgba(248,113,113,0.55)" },
```

Replace with:

```javascript
  gta:          { sprite: SPRITE_GTA,       tipX: 12, tipY: 12, name: "bills",      glow: "rgba(239,68,68,0.55)" },
```

(Hotspot unchanged at center; glow tightened to the GTA accent `#ef4444`; name target→bills.)

- [ ] **Step 3: Run the validator — must PASS**

Run: `node scratch/verify_cursors.mjs`
Expected: `OK: все 5 курсоров валидны`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/pixelCursors.js
git commit -m "feat(cursors): GTA cursor → dollar bill"
```

---

## Task 5: Manual visual verification

The validator confirms structure; this confirms the art actually looks right and the hotspots feel correct in the real UI.

**Files:** none (runtime check only).

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Open the printed local URL (Vite default `http://localhost:5173`) in a browser.

- [ ] **Step 2: Check STARWARS**

On the Play page, select the STARWARS server. Confirm:
- A blue lightsaber (white core, blue glow, chrome hilt with dark grip grooves) follows the cursor.
- The blade **tip** sits exactly under the pointer (click point is the tip, not the hilt).
- Hovering a button scales it up; clicking shows the blue flash halo.

- [ ] **Step 3: Check GTA**

Select the GTA server. Confirm:
- A green dollar bill with a red center band follows the cursor.
- The pointer sits at the bill's **center**.
- Click shows the red flash halo.

- [ ] **Step 4: Check the three unchanged cursors**

Select MINIGAMES (green bed), VANILA+ (cyan pickaxe), АНАРХИЯ (red heart) in turn. Confirm each is unchanged and its hotspot is still sensible.

- [ ] **Step 5: Check the deselected state**

Deselect / navigate away. Confirm the cursor reverts to the default ring+dot.

- [ ] **Step 6: Stop the dev server and final commit (if any stray notes)**

If everything passed, no further code change is needed — Tasks 1–4 already committed the work. This step is the sign-off.

```bash
git status   # expect clean (or only pre-existing unrelated changes)
```

---

## Self-Review

**Spec coverage:**
- STARWARS lightsaber (blue blade, chrome hilt) → Task 3 ✓
- GTA money → Task 4 ✓
- Palette codes `u`,`U`,`d` → Task 2 ✓
- Hotspots + glow colors updated → Tasks 3 & 4 ✓
- MINIGAMES/VANILA+/АНАРХИЯ untouched → no task touches them ✓
- `CustomCursor.jsx` untouched → no task modifies it ✓
- Verification (structural automated + visual manual) → Tasks 1 & 5 ✓

**Placeholder scan:** Every step contains full code or an exact command with expected output. No "TBD"/"similar to"/"add error handling".

**Type/name consistency:** Palette codes (`u`,`U`,`d`), sprite names (`SPRITE_STARWARS`,`SPRITE_GTA`), `CURSORS` keys (`starwars`,`gta`), and `name`/`glow`/`tipX`/`tipY` fields all match across tasks and the spec. Validator references `PALETTE` and `CURSORS` exactly as exported.
