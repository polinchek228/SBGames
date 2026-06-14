import { useEffect, useRef } from "react";

export default function CustomCursor() {
  const dotRef   = useRef(null);
  const ringRef  = useRef(null);
  const saberRef = useRef(null);
  const flashRef = useRef(null); // вспышка при клике

  useEffect(() => {
    async function hideCursor() {
      try {
        if (window.__TAURI_INTERNALS__) {
          const { getCurrentWindow } = await import("@tauri-apps/api/window");
          await getCurrentWindow().setCursorVisible(false);
        }
      } catch {}
    }
    hideCursor();

    const dot   = dotRef.current;
    const ring  = ringRef.current;
    const saber = saberRef.current;
    const flash = flashRef.current;
    if (!dot || !ring || !saber || !flash) return;

    let mx = -300, my = -300;
    let rx = -300, ry = -300;
    let hovering  = false;
    let clicking  = false;
    let serverId  = null;
    let flashAnim = null;
    let raf;

    // Острие в SVG: (5, 5)
    const TIP_X = 5;
    const TIP_Y = 5;

    // Вспышка при клике — короткий burst
    function triggerFlash(x, y) {
      if (flashAnim) clearTimeout(flashAnim);
      flash.style.left    = `${x - 10}px`;
      flash.style.top     = `${y - 10}px`;
      flash.style.opacity = "1";
      flash.style.transform = "scale(1)";
      flashAnim = setTimeout(() => {
        flash.style.opacity   = "0";
        flash.style.transform = "scale(2.2)";
      }, 60);
    }

    const loop = () => {
      const isSaber = serverId === "starwars";

      dot.style.opacity   = isSaber ? "0" : "1";
      ring.style.opacity  = isSaber ? "0" : "1";
      saber.style.opacity = isSaber ? "1" : "0";
      flash.style.display = isSaber ? "block" : "none";

      if (isSaber) {
        saber.style.transform = `translate(${mx - TIP_X}px, ${my - TIP_Y}px)`;
      } else {
        rx = mx;
        ry = my;
        const sz = hovering ? 24 : 18;
        const sc = clicking ? 0.75 : hovering ? 1.4 : 1;
        ring.style.width       = `${sz}px`;
        ring.style.height      = `${sz}px`;
        ring.style.transform   = `translate(${rx - sz/2}px, ${ry - sz/2}px) scale(${sc})`;
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
      if (serverId === "starwars") triggerFlash(e.clientX, e.clientY);
    };
    const onUp   = () => { clicking = false; };
    const onOver = (e) => { if (e.target.closest("button,a,input,textarea,select,[role=button],label")) hovering = true; };
    const onOut  = (e) => { if (e.target.closest("button,a,input,textarea,select,[role=button],label")) hovering = false; };
    const onSrv  = (e) => { serverId = e.detail?.id || null; };

    window.addEventListener("mousemove",    onMove, { passive: true });
    window.addEventListener("mousedown",    onDown);
    window.addEventListener("mouseup",      onUp);
    document.addEventListener("mouseover",  onOver);
    document.addEventListener("mouseout",   onOut);
    window.addEventListener("serverChange", onSrv);

    return () => {
      cancelAnimationFrame(raf);
      if (flashAnim) clearTimeout(flashAnim);
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

  return (
    <>
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
        width:20, height:20, borderRadius:"50%",
        background:"radial-gradient(circle, rgba(196,181,253,0.9) 0%, rgba(129,140,248,0.5) 40%, transparent 70%)",
        opacity:0, display:"none",
        transition:"none",
        willChange:"transform, opacity",
      }}/>

      {/* ── Lightsaber ── */}
      <div ref={saberRef} style={{
        position:"fixed", top:0, left:0, zIndex:9999,
        pointerEvents:"none", opacity:0,
        willChange:"transform",
      }}>
        {/*
          Компактный меч: острие → (5, 5), клинок ~28px, рукоять ~18px.
          Повёрнут на -38deg вокруг острия.
        */}
        <svg
          width="20" height="60"
          viewBox="0 0 20 60"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{
            display:"block",
            overflow:"visible",
            transform:"rotate(-38deg)",
            transformOrigin:"5px 5px",
          }}
        >
          <defs>
            <filter id="sb-far" x="-600%" y="-6%" width="1300%" height="112%">
              <feGaussianBlur stdDeviation="4.5"/>
            </filter>
            <filter id="sb-mid" x="-250%" y="-4%" width="600%" height="108%">
              <feGaussianBlur stdDeviation="2"/>
            </filter>
            <filter id="sb-near" x="-120%" y="-2%" width="340%" height="104%">
              <feGaussianBlur stdDeviation="1"/>
            </filter>
            <filter id="sb-tip-glow" x="-500%" y="-500%" width="1100%" height="1100%">
              <feGaussianBlur stdDeviation="2.5"/>
            </filter>
            <filter id="sb-btn-glow" x="-300%" y="-300%" width="700%" height="700%">
              <feGaussianBlur stdDeviation="1.2"/>
            </filter>
            <linearGradient id="hilt-g" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%"  stopColor="#1a2236"/>
              <stop offset="45%" stopColor="#263044"/>
              <stop offset="100%" stopColor="#1a2236"/>
            </linearGradient>
          </defs>

          {/* ─ КЛИНОК ─ */}

          {/* Ореол — самый широкий */}
          <line x1="5" y1="5" x2="5" y2="33"
            stroke="#4c1d95" strokeWidth="14" strokeLinecap="round"
            opacity="0.14" filter="url(#sb-far)">
            <animate attributeName="opacity" values="0.14;0.22;0.14" dur="2s" repeatCount="indefinite"/>
          </line>

          {/* Средний */}
          <line x1="5" y1="5" x2="5" y2="33"
            stroke="#7c3aed" strokeWidth="6" strokeLinecap="round"
            opacity="0.32" filter="url(#sb-mid)">
            <animate attributeName="opacity" values="0.32;0.48;0.32" dur="2s" repeatCount="indefinite"/>
          </line>

          {/* Близкий */}
          <line x1="5" y1="5" x2="5" y2="33"
            stroke="#818cf8" strokeWidth="3" strokeLinecap="round"
            opacity="0.75" filter="url(#sb-near)">
            <animate attributeName="opacity" values="0.75;0.95;0.75" dur="2s" repeatCount="indefinite"/>
          </line>

          {/* Клинок */}
          <line x1="5" y1="5" x2="5" y2="33"
            stroke="#c4b5fd" strokeWidth="1.8" strokeLinecap="round"/>

          {/* Белое ядро */}
          <line x1="5" y1="6" x2="5" y2="32"
            stroke="white" strokeWidth="0.7" strokeLinecap="round" opacity="0.95"/>

          {/* Острие — блик */}
          <circle cx="5" cy="5" r="3"
            fill="#818cf8" opacity="0.4" filter="url(#sb-tip-glow)">
            <animate attributeName="opacity" values="0.4;0.6;0.4" dur="2s" repeatCount="indefinite"/>
          </circle>
          <circle cx="5" cy="5" r="1.2" fill="white" opacity="0.98"/>

          {/* ─ ЭМИТТЕР ─ */}
          <rect x="2.5" y="33" width="5" height="2" rx="1"
            fill="#475569"/>
          <rect x="2.8" y="33.1" width="4.4" height="0.9" rx="0.45"
            fill="#64748b" opacity="0.8"/>

          {/* ─ ГАРДА ─ */}
          <rect x="0.5" y="35" width="9" height="2.5" rx="1.25"
            fill="#334155"/>
          <rect x="1" y="35.2" width="8" height="1" rx="0.5"
            fill="#64748b" opacity="0.55"/>

          {/* ─ РУКОЯТЬ ─ */}
          <rect x="3" y="37.5" width="4" height="17" rx="2"
            fill="url(#hilt-g)"/>

          {/* Полосы намотки */}
          <rect x="3" y="39.5" width="4" height="1.3" rx="0.65" fill="#1e293b"/>
          <rect x="3" y="42.2" width="4" height="1.3" rx="0.65" fill="#1e293b"/>
          <rect x="3" y="44.9" width="4" height="1.3" rx="0.65" fill="#1e293b"/>

          {/* Кнопка активации */}
          <circle cx="5" cy="48.5" r="1.2"
            fill="#818cf8" opacity="0.85" filter="url(#sb-btn-glow)">
            <animate attributeName="opacity" values="0.85;1;0.85" dur="2.6s" repeatCount="indefinite"/>
          </circle>
          <circle cx="5" cy="48.5" r="0.65" fill="#e0e7ff"/>

          {/* ─ НАВЕРШИЕ ─ */}
          <ellipse cx="5" cy="55.5" rx="3" ry="1.6" fill="#293548"/>
          <ellipse cx="5" cy="55" rx="2.2" ry="1.1" fill="#3d4f6b"/>
        </svg>
      </div>
    </>
  );
}
