import { useEffect, useRef } from "react";

// ── Тематические курсоры для каждого режима ──────────────────────────────
// Минималистичные иконки 24px с мягким glow.
// tipX/tipY — точка клика в координатах SVG (куда наводится острие).
// Кастомные сборки (serverId не из списка) и "ничего не выбрано" → ring+dot.
const THEMES = {
  starwars:     { tipX: 12, tipY: 20, color: "#a78bfa", glow: "rgba(167,139,250,0.6)" },
  minigames:    { tipX: 12, tipY: 12, color: "#4ade80", glow: "rgba(74,222,128,0.6)" },
  gta:          { tipX: 12, tipY: 20, color: "#f87171", glow: "rgba(248,113,113,0.6)" },
  vanilla_plus: { tipX: 12, tipY: 20, color: "#22d3ee", glow: "rgba(34,211,238,0.6)" },
  anarchy:      { tipX: 12, tipY: 20, color: "#fbbf24", glow: "rgba(251,191,36,0.6)" },
};

export default function CustomCursor() {
  const dotRef   = useRef(null);
  const ringRef  = useRef(null);
  const flashRef = useRef(null);
  const wrapRef  = useRef(null);
  // refs для каждого тематического курсора
  const themedRefs = {
    starwars:     useRef(null),
    minigames:    useRef(null),
    gta:          useRef(null),
    vanilla_plus: useRef(null),
    anarchy:      useRef(null),
  };

  useEffect(() => {
    const dot   = dotRef.current;
    const ring  = ringRef.current;
    const flash = flashRef.current;
    const wrap  = wrapRef.current;
    const themed = Object.fromEntries(
      Object.entries(themedRefs).map(([k, r]) => [k, r.current])
    );
    if (!dot || !ring || !flash || !wrap || Object.values(themed).some(r => !r)) return;

    let mx = -300, my = -300;
    let hovering  = false;
    let clicking  = false;
    let serverId  = null;
    let flashAnim = null;
    let raf;

    // Inject style element for toggling cursor:none globally
    const styleEl = document.createElement("style");
    styleEl.id = "custom-cursor-style";
    document.head.appendChild(styleEl);

    function applyCursorState() {
      const active = !!serverId;
      wrap.style.display = active ? "" : "none";
      styleEl.textContent = active ? "* { cursor: none !important; }" : "";
      try {
        if (window.__TAURI_INTERNALS__) {
          import("@tauri-apps/api/window").then(({ getCurrentWindow }) => {
            getCurrentWindow().setCursorVisible(!active).catch(() => {});
          });
        }
      } catch {}
    }

    // Вспышка при клике — короткий burst (цвет зависит от режима)
    function triggerFlash(x, y) {
      const theme = THEMES[serverId];
      if (theme) {
        flash.style.background = `radial-gradient(circle, ${theme.glow} 0%, transparent 70%)`;
      }
      if (flashAnim) clearTimeout(flashAnim);
      flash.style.left    = `${x - 12}px`;
      flash.style.top     = `${y - 12}px`;
      flash.style.opacity = "1";
      flash.style.transform = "scale(1)";
      flashAnim = setTimeout(() => {
        flash.style.opacity   = "0";
        flash.style.transform = "scale(2.2)";
      }, 60);
    }

    const loop = () => {
      const theme = THEMES[serverId];
      const isThemed = !!theme;

      dot.style.opacity   = isThemed ? "0" : "1";
      ring.style.opacity  = isThemed ? "0" : "1";
      flash.style.display = isThemed ? "block" : "none";

      // Скрываем все тематические, показываем активный
      for (const [id, ref] of Object.entries(themed)) {
        ref.style.opacity = (isThemed && id === serverId) ? "1" : "0";
      }

      if (isThemed) {
        const ref = themed[serverId];
        const sc = clicking ? 0.82 : hovering ? 1.18 : 1;
        ref.style.transform = `translate(${mx - theme.tipX}px, ${my - theme.tipY}px) scale(${sc})`;
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
      if (THEMES[serverId]) triggerFlash(e.clientX, e.clientY);
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

    // Initial state
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
  }, []);

  const themedStyle = (opacity = 0) => ({
    position:"fixed", top:0, left:0, zIndex:9999,
    pointerEvents:"none", opacity,
    willChange:"transform",
    transition:"transform 0.04s linear",
  });

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
        width:24, height:24, borderRadius:"50%",
        background:"radial-gradient(circle, rgba(167,139,250,0.7) 0%, transparent 70%)",
        opacity:0, display:"none",
        transition:"none",
        willChange:"transform, opacity",
      }}/>

      {/* ═══════════ STARWARS — звезда-очки (фиолетовый) ═══════════ */}
      <div ref={themedRefs.starwars} style={themedStyle()}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ display:"block", overflow:"visible" }}>
          <defs>
            <filter id="sw-glow" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="2"/>
            </filter>
          </defs>
          {/* glow halo */}
          <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5Z"
            fill="#a78bfa" opacity="0.35" filter="url(#sw-glow)"/>
          {/* star core */}
          <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5Z" fill="#c4b5fd"/>
          {/* bright tip (click point at bottom 12,20) */}
          <circle cx="12" cy="20" r="2.2" fill="#ede9fe" opacity="0.95"/>
          <circle cx="12" cy="20" r="1" fill="#fff"/>
        </svg>
      </div>

      {/* ═══════════ MINIGAMES — ромб-кристалл (зелёный) ═══════════ */}
      <div ref={themedRefs.minigames} style={themedStyle()}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ display:"block", overflow:"visible" }}>
          <defs>
            <filter id="mg-glow" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="2"/>
            </filter>
            <linearGradient id="mg-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#86efac"/>
              <stop offset="100%" stopColor="#22c55e"/>
            </linearGradient>
          </defs>
          {/* glow halo */}
          <path d="M12 2L22 12L12 22L2 12Z" fill="#4ade80" opacity="0.35" filter="url(#mg-glow)"/>
          {/* diamond */}
          <path d="M12 3L21 12L12 21L3 12Z" fill="url(#mg-grad)"/>
          {/* facets */}
          <path d="M12 3L21 12L12 12Z" fill="#bbf7d0" opacity="0.7"/>
          <path d="M12 3L3 12L12 12Z" fill="#4ade80" opacity="0.8"/>
          <line x1="3" y1="12" x2="21" y2="12" stroke="#86efac" strokeWidth="0.6" opacity="0.7"/>
          {/* center highlight */}
          <circle cx="12" cy="12" r="1.6" fill="#fff" opacity="0.55"/>
        </svg>
      </div>

      {/* ═══════════ GTA — мишень/прицел (красный) ═══════════ */}
      <div ref={themedRefs.gta} style={themedStyle()}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ display:"block", overflow:"visible" }}>
          <defs>
            <filter id="gta-glow" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="1.8"/>
            </filter>
          </defs>
          {/* glow */}
          <circle cx="12" cy="12" r="9" stroke="#f87171" strokeWidth="2.4" fill="none" opacity="0.4" filter="url(#gta-glow)"/>
          {/* outer ring */}
          <circle cx="12" cy="12" r="8.5" stroke="#fca5a5" strokeWidth="1.6" fill="none"/>
          <circle cx="12" cy="12" r="8.5" stroke="#ef4444" strokeWidth="2.2" fill="none" opacity="0.5"/>
          {/* crosshair lines (gaps in middle) */}
          <line x1="12" y1="2"  x2="12" y2="6"  stroke="#f87171" strokeWidth="1.8" strokeLinecap="round"/>
          <line x1="12" y1="18" x2="12" y2="22" stroke="#f87171" strokeWidth="1.8" strokeLinecap="round"/>
          <line x1="2"  y1="12" x2="6"  y2="12" stroke="#f87171" strokeWidth="1.8" strokeLinecap="round"/>
          <line x1="18" y1="12" x2="22" y2="12" stroke="#f87171" strokeWidth="1.8" strokeLinecap="round"/>
          {/* center dot */}
          <circle cx="12" cy="12" r="2" fill="#fecaca"/>
          <circle cx="12" cy="12" r="1" fill="#fff"/>
          {/* tip marker at bottom */}
          <circle cx="12" cy="20" r="1.4" fill="#fca5a5"/>
        </svg>
      </div>

      {/* ═══════════ VANILLA+ — капля/семя (cyan) ═══════════ */}
      <div ref={themedRefs.vanilla_plus} style={themedStyle()}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ display:"block", overflow:"visible" }}>
          <defs>
            <filter id="vp-glow" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="2"/>
            </filter>
            <linearGradient id="vp-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#a5f3fc"/>
              <stop offset="100%" stopColor="#06b6d4"/>
            </linearGradient>
          </defs>
          {/* glow */}
          <path d="M12 2C7 8 5 11 5 14.5C5 18.6 8.1 22 12 22C15.9 22 19 18.6 19 14.5C19 11 17 8 12 2Z"
            fill="#22d3ee" opacity="0.35" filter="url(#vp-glow)"/>
          {/* drop shape */}
          <path d="M12 3C7.5 8.5 6 11 6 14.5C6 18.2 8.6 21 12 21C15.4 21 18 18.2 18 14.5C18 11 16.5 8.5 12 3Z" fill="url(#vp-grad)"/>
          {/* highlight */}
          <path d="M12 5C9 9 8 11 8 13.5C8 15.5 9 14 10 12C11 10 12 7 12 5Z" fill="#cffafe" opacity="0.6"/>
          {/* tip dot at bottom */}
          <circle cx="12" cy="20" r="1.6" fill="#cffafe" opacity="0.95"/>
        </svg>
      </div>

      {/* ═══════════ ANARCHY — молния (amber) ═══════════ */}
      <div ref={themedRefs.anarchy} style={themedStyle()}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ display:"block", overflow:"visible" }}>
          <defs>
            <filter id="an-glow" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="2"/>
            </filter>
            <linearGradient id="an-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fde047"/>
              <stop offset="100%" stopColor="#f59e0b"/>
            </linearGradient>
          </defs>
          {/* glow */}
          <path d="M14 2L5 13.5H11L9 22L19 9.5H13L14 2Z"
            fill="#f59e0b" opacity="0.38" filter="url(#an-glow)"/>
          {/* bolt */}
          <path d="M14 2L5 13.5H11L9 22L19 9.5H13L14 2Z" fill="url(#an-grad)"/>
          {/* inner highlight */}
          <path d="M13.5 4L7 12.5H11L10 19L17 10.5H13.5L13.5 4Z" fill="#fef3c7" opacity="0.55"/>
          {/* tip */}
          <circle cx="9" cy="20" r="1.6" fill="#fef3c7" opacity="0.95"/>
        </svg>
      </div>
    </div>
  );
}
