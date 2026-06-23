import { useEffect, useRef, useState } from "react";
import { CURSORS, renderSprite } from "../lib/pixelCursors.js";

// ── Пиксельные курсоры в стиле Minecraft item-иконок ──────────────────────
// Каждый сервер → свой MC-предмет (световой меч, алмаз, мишень, меч, TNT),
// отрисованный пиксель-артом 24x24 через canvas с image-rendering: pixelated.
// Кастомные сборки и "ничего не выбрано" → ring+dot.

const SPRITE_SCALE = 1; // 24px спрайт × 1 = 24px финал (как было). image-rendering: pixelated сохраняет чёткость.

export default function CustomCursor() {
  const dotRef   = useRef(null);
  const ringRef  = useRef(null);
  const flashRef = useRef(null);
  const wrapRef  = useRef(null);
  const themedWrapRef = useRef(null);
  const themedImgRef = useRef(null);
  const themedGlowRef = useRef(null);
  const [spriteUrls, setSpriteUrls] = useState({});

  // Пред-рендерим все спрайты в data-URL один раз.
  useEffect(() => {
    const urls = {};
    for (const [id, cursor] of Object.entries(CURSORS)) {
      urls[id] = renderSprite(cursor.sprite, SPRITE_SCALE);
    }
    setSpriteUrls(urls);
  }, []);

  useEffect(() => {
    const dot   = dotRef.current;
    const ring  = ringRef.current;
    const flash = flashRef.current;
    const wrap  = wrapRef.current;
    const themedWrap = themedWrapRef.current;
    const themedImg  = themedImgRef.current;
    const themedGlow = themedGlowRef.current;
    if (!dot || !ring || !flash || !wrap || !themedWrap || !themedImg || !themedGlow) return;

    let mx = -300, my = -300;
    let hovering  = false;
    let clicking  = false;
    let serverId  = null;
    let flashAnim = null;
    let raf;
    let lastSrc = "";

    const styleEl = document.createElement("style");
    styleEl.id = "custom-cursor-style";
    document.head.appendChild(styleEl);

    function applyCursorState() {
      const active = !!serverId;
      wrap.style.display = active ? "" : "none";
      themedWrap.style.display = active ? "" : "none";
      styleEl.textContent = active ? "* { cursor: none !important; }" : "";
      try {
        if (window.__TAURI_INTERNALS__) {
          import("@tauri-apps/api/window").then(({ getCurrentWindow }) => {
            getCurrentWindow().setCursorVisible(!active).catch(() => {});
          });
        }
      } catch {}
    }

    function triggerFlash(x, y) {
      const cursor = CURSORS[serverId];
      if (cursor && themedGlow) {
        themedGlow.style.background = `radial-gradient(circle, ${cursor.glow} 0%, transparent 70%)`;
      }
      if (flashAnim) clearTimeout(flashAnim);
      flash.style.left    = `${x - 24}px`;
      flash.style.top     = `${y - 24}px`;
      flash.style.opacity = "1";
      flash.style.transform = "scale(1)";
      flashAnim = setTimeout(() => {
        flash.style.opacity   = "0";
        flash.style.transform = "scale(2.2)";
      }, 60);
    }

    const loop = () => {
      if (!serverId) { raf = requestAnimationFrame(loop); return; }
      const cursor = CURSORS[serverId];
      const isThemed = !!cursor && !!spriteUrls[serverId];

      dot.style.opacity   = isThemed ? "0" : "1";
      ring.style.opacity  = isThemed ? "0" : "1";
      flash.style.display = isThemed ? "block" : "none";

      if (isThemed) {
        // Показываем пиксельный курсор-предмет.
        const sc = clicking ? 0.85 : hovering ? 1.15 : 1;
        const drawSize = 24 * SPRITE_SCALE;
        themedWrap.style.transform =
          `translate(${mx - cursor.tipX * SPRITE_SCALE}px, ${my - cursor.tipY * SPRITE_SCALE}px) scale(${sc})`;
        const src = spriteUrls[serverId];
        if (src !== lastSrc) { themedImg.src = src; lastSrc = src; }
        themedGlow.style.opacity = hovering ? "0.5" : "0.25";
      } else {
        const sz = hovering ? 24 : 18;
        const sc = clicking ? 0.75 : hovering ? 1.4 : 1;
        ring.style.width       = `${sz}px`;
        ring.style.height      = `${sz}px`;
        ring.style.transform   = `translate(${mx - sz/2}px, ${my - sz/2}px) scale(${sc})`;
        ring.style.borderColor = hovering ? "rgba(99,149,255,0.9)" : "rgba(255,255,255,0.5)";
        ring.style.background  = hovering ? "rgba(99,149,255,0.06)" : "transparent";
        dot.style.transform    = `translate(${mx - 2}px, ${my - 2}px)`;
        dot.style.background   = hovering ? "#6395ff" : "#fff";
        dot.style.opacity      = clicking ? "0.45" : "1";
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const onMove = (e) => { mx = e.clientX; my = e.clientY; };
    const onDown = (e) => {
      clicking = true;
      if (CURSORS[serverId]) triggerFlash(e.clientX, e.clientY);
    };
    const onUp   = () => { clicking = false; };
    const onOver = (e) => { if (e.target.closest("button,a,input,textarea,select,[role=button],label")) hovering = true; };
    const onOut  = (e) => { if (e.target.closest("button,a,input,textarea,select,[role=button],label")) hovering = false; };
    const onSrv  = (e) => { serverId = e.detail?.id || null; applyCursorState(); };

    window.addEventListener("mousemove",    onMove, { passive: true });
    window.addEventListener("mousedown",    onDown);
    window.addEventListener("mouseup",      onUp);
    document.addEventListener("mouseover",  onOver);
    document.addEventListener("mouseout",   onOut);
    window.addEventListener("serverChange", onSrv);

    applyCursorState();

    return () => {
      cancelAnimationFrame(raf);
      if (flashAnim) clearTimeout(flashAnim);
      styleEl.remove();
      window.removeEventListener("mousemove",    onMove);
      window.removeEventListener("mousedown",    onDown);
      window.removeEventListener("mouseup",      onUp);
      document.removeEventListener("mouseover",  onOver);
      document.removeEventListener("mouseout",   onOut);
      window.removeEventListener("serverChange", onSrv);
      try {
        if (window.__TAURI_INTERNALS__) {
          import("@tauri-apps/api/window").then(({ getCurrentWindow }) => {
            getCurrentWindow().setCursorVisible(true).catch(() => {});
          });
        }
      } catch {}
    };
  }, [spriteUrls]);

  return (
    <div ref={wrapRef} style={{ display: "none" }}>
      {/* Default ring */}
      <div ref={ringRef} style={{
        position:"fixed", top:0, left:0, zIndex:9998,
        width:18, height:18, borderRadius:"50%",
        border:"1.5px solid rgba(255,255,255,0.5)",
        pointerEvents:"none",
        transition:"none",
        willChange:"transform",
      }}/>

      {/* Default dot */}
      <div ref={dotRef} style={{
        position:"fixed", top:0, left:0, zIndex:9999,
        width:4, height:4, borderRadius:"50%",
        background:"#fff", pointerEvents:"none",
        transition:"none",
        willChange:"transform",
      }}/>

      {/* Вспышка при клике */}
      <div ref={flashRef} style={{
        position:"fixed", zIndex:10000, pointerEvents:"none",
        width:48, height:48, borderRadius:"50%",
        background:"radial-gradient(circle, rgba(167,139,250,0.7) 0%, transparent 70%)",
        opacity:0, display:"none",
        transition:"none",
        willChange:"transform, opacity",
      }}/>

      {/* ═══ Пиксельный курсор-предмет (показывается при выборе сервера) ═══ */}
      <div ref={themedWrapRef} style={{
        position:"fixed", top:0, left:0, zIndex:9999,
        pointerEvents:"none",
        display:"none",
        willChange:"transform",
        transition:"transform 0.04s linear",
      }}>
        {/* Glow halo под предметом */}
        <div ref={themedGlowRef} style={{
          position:"absolute",
          top:0, left:0,
          width:48, height:48,
          borderRadius:"50%",
          opacity:0.25,
          pointerEvents:"none",
          filter:"blur(6px)",
          transform:"translate(-12px, -12px)",
        }}/>
        {/* Сам пиксельный спрайт — pixelated рендер */}
        <img ref={themedImgRef} alt="Курсор" style={{
          display:"block",
          width:24 * SPRITE_SCALE,
          height:24 * SPRITE_SCALE,
          imageRendering:"pixelated",
          pointerEvents:"none",
          // drop-shadow для эффекта «парящего» предмета
          filter:"drop-shadow(0 1px 1px rgba(0,0,0,0.6))",
        }}/>
      </div>
    </div>
  );
}
