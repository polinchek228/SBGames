# Themed Cursors v2 — Design Spec

**Date:** 2026-06-19
**Status:** Draft — awaiting user review
**Scope:** Replace 2 of 5 server-themed pixel cursors in the launcher.

## Problem

The previous AI made "ugly" themed cursors that don't match their server themes.
The clearest mismatch: the STARWARS server used a generic Nether Star sprite instead
of a lightsaber. This spec replaces the mismatched cursors with theme-appropriate
pixel-art items drawn in the existing Minecraft-item style.

## Goals

- Each server's cursor should be immediately recognizable as belonging to that theme.
- Reuse the existing pixel-art rendering pipeline (no architectural changes).
- Keep what already works: cursors that match their theme stay as-is.

## Non-Goals (out of scope)

- Cursors for custom modpacks (currently the ring+dot fallback — unchanged).
- Cursor animations / Retina-scale sprites.
- Touching `CustomCursor.jsx` rendering logic.

## Current State

Server-themed cursors are 24×24 pixel-art sprites defined as ASCII matrices in
`src/lib/pixelCursors.js`, rendered to PNG data URLs via `renderSprite()`, and
displayed by `src/components/CustomCursor.jsx` when a `serverChange` event fires
with a server id (dispatched from `src/pages/PlayPage.jsx`).

The 5 servers (from `SERVERS` in `PlayPage.jsx`):

| id            | name      | accent    | current cursor   | action     |
|---------------|-----------|-----------|------------------|------------|
| `starwars`    | STARWARS  | `#818cf8` | Nether Star      | **replace**|
| `minigames`   | MINIGAMES | `#22c55e` | bed              | keep       |
| `gta`         | GTA       | `#ef4444` | bullseye target  | **replace**|
| `vanilla_plus`| VANILA+   | `#06b6d4` | pickaxe          | keep       |
| `anarchy`     | АНАРХИЯ   | `#f59e0b` | heart            | keep       |

## New Cursors

### 1. STARWARS — lightsaber (replaces Nether Star)

- Vertical orientation, blade pointing up (tip at top-center).
- Blade: **blue** (`#3b82f6`) with a white hot core (`#ffffff`, existing `F`).
- Blade widens slightly from tip to emitter.
- Hilt: **chrome/steel** — silver metal (`S`/`W`/`G`) with dark grip grooves (`g`),
  black outline (`K`), silver emitter/guard, black pommel cap.
- **Hotspot (tipX, tipY):** the blade tip at the top center — approximately `(11, 0)`.
- **Glow halo color:** `rgba(59,130,246,0.55)`.

### 2. GTA — stack of dollar bills (replaces bullseye target)

- Front view of a rectangular bill stack, slightly stacked/offset to read as a
  "wad" of cash.
- Bills: **dark green** (`#15803d`) to evoke real US currency and stay distinct
  from MINIGAMES' bright-green bed.
- A **red** band/stripe across the middle (reuse `X`/`x`, the GTA accent red)
  with a dark `$` denomination mark on the band.
- Grey portrait/nominal area on each bill (`S`), black outline (`K`).
- **Hotspot (tipX, tipY):** center of the stack — approximately `(12, 12)`.
- **Glow halo color:** `rgba(239,68,68,0.55)` (unchanged from current GTA glow).

### Distinguishing GTA (green bills) from MINIGAMES (green bed)

Both are green, but they differ on three axes:
- **Hue:** GTA bills dark green `#15803d` vs MINIGAMES bed bright green `#4ade80`.
- **Shape:** GTA is a small rectangular stack vs MINIGAMES is a long bed silhouette.
- **Accent:** GTA has a red cross-band vs MINIGAMES has a cream mattress/pillow.

## Palette Changes

`PALETTE` in `src/lib/pixelCursors.js` gains three new codes:

| Code | Color     | Purpose                       |
|------|-----------|-------------------------------|
| `u`  | `#3b82f6` | blue lightsaber blade         |
| `U`  | `#60a5fa` | light-blue blade tip highlight|
| `d`  | `#15803d` | dark green GTA bill           |

Reused existing codes: `F` (white core), `S`/`W`/`G`/`D` (chrome hilt),
`K` (black outline), `X`/`x`/`r` (red GTA band), `g` (dark groove `#052e16`).

## File Changes

### `src/lib/pixelCursors.js`

1. Add three codes (`u`, `U`, `d`) to `PALETTE`.
2. Replace `SPRITE_STARWARS` with the lightsaber 24-row matrix.
3. Replace `SPRITE_GTA` with the dollar-stack 24-row matrix.
4. Update `CURSORS` entries:
   - `starwars`: `tipX: 11, tipY: 0`, `glow: "rgba(59,130,246,0.55)"`,
     `name: "lightsaber"`.
   - `gta`: `tipX: 12, tipY: 12`, `glow: "rgba(239,68,68,0.55)"`,
     `name: "bills"`.

### `src/components/CustomCursor.jsx`

No changes — `renderSprite` and the cursor loop are theme-agnostic.

## Verification

- Open the launcher, select each server on PlayPage, confirm the correct sprite
  appears with the hotspot at the pointer and the glow halo in the right color.
- Confirm MINIGAMES / VANILA+ / АНАРХИЯ sprites are unchanged.
- Confirm clicking a themed server still shows the flash animation.
- Confirm deselecting a server reverts to the ring+dot default cursor.
