import { useEffect, useRef } from "react";

export default function CustomCursor() {
  const dotRef   = useRef(null);
  const ringRef  = useRef(null);
  const saberRef = useRef(null);

  useEffect(() => {
    const dot   = dotRef.current;
    const ring  = ringRef.current;
    const saber = saberRef.current;
    if (!dot || !ring || !saber) return;

    let mx = -300, my = -300;
    let rx = -300, ry = -300;
    let hovering = false;
    let clicking = false;
    let serverId = null;
    let raf;

    const BLADE_TIP_OFFSET_X = 5; // острие внутри SVG
    const BLADE_TIP_OFFSET_Y = 5;

    const loop = () => {
      const isSaber = serverId === "starwars";

      dot.style.opacity   = isSaber ? "0" : "1";
      ring.style.opacity  = isSaber ? "0" : "1";
      saber.style.opacity = isSaber ? "1" : "0";
      saber.style.pointerEvents = "none";

      if (isSaber) {
        const sc = clicking ? 0.92 : 1;
        saber.style.transform = `translate(${mx - BLADE_TIP_OFFSET_X}px, ${my - BLADE_TIP_OFFSET_Y}px) scale(${sc})`;
      } else {
        rx += (mx - rx) * 0.12;
        ry += (my - ry) * 0.12;
        const sz = hovering ? 22 : 18;
        const sc = clicking ? 0.75 : hovering ? 1.4 : 1;
        ring.style.width        = `${sz}px`;
        ring.style.height       = `${sz}px`;
        ring.style.transform    = `translate(${rx - sz/2}px, ${ry - sz/2}px) scale(${sc})`;
        ring.style.borderColor  = hovering ? "rgba(99,149,255,0.9)" : "rgba(255,255,255,0.5)";
        ring.style.background   = hovering ? "rgba(99,149,255,0.06)" : "transparent";
        dot.style.transform     = `translate(${mx - 2}px, ${my - 2}px)`;
        dot.style.background    = hovering ? "#6395ff" : "#fff";
        dot.style.opacity       = clicking ? "0.45" : "1";
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const onMove  = (e) => { mx = e.clientX; my = e.clientY; };
    const onDown  = () => { clicking = true; };
    const onUp    = () => { clicking = false; };
    const onOver  = (e) => { if (e.target.closest("button,a,input,textarea,select,[role=button],label")) hovering = true; };
    const onOut   = (e) => { if (e.target.closest("button,a,input,textarea,select,[role=button],label")) hovering = false; };
    const onSrv   = (e) => { serverId = e.detail?.id || null; };

    window.addEventListener("mousemove",    onMove, { passive: true });
    window.addEventListener("mousedown",    onDown);
    window.addEventListener("mouseup",      onUp);
    document.addEventListener("mouseover",  onOver);
    document.addEventListener("mouseout",   onOut);
    window.addEventListener("serverChange", onSrv);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove",    onMove);
      window.removeEventListener("mousedown",    onDown);
      window.removeEventListener("mouseup",      onUp);
      document.removeEventListener("mouseover",  onOver);
      document.removeEventListener("mouseout",   onOut);
      window.removeEventListener("serverChange", onSrv);
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
        transition:"width .15s, height .15s, border-color .15s, background .15s",
        willChange:"transform",
      }}/>
      {/* Default dot */}
      <div ref={dotRef} style={{
        position:"fixed", top:0, left:0, zIndex:9999,
        width:4, height:4, borderRadius:"50%",
        background:"#fff", pointerEvents:"none",
        transition:"background .15s, opacity .1s",
        willChange:"transform",
      }}/>

      {/* Lightsaber — острие сверху, рукоять снизу */}
      <div ref={saberRef} style={{
        position:"fixed", top:0, left:0, zIndex:9999,
        pointerEvents:"none", opacity:0,
        willChange:"transform",
      }}>
        <svg width="22" height="88" viewBox="0 0 22 88" fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ display:"block", overflow:"visible" }}
        >
          <defs>
            {/* Glow фильтр для клинка */}
            <filter id="lsglow" x="-500%" y="-20%" width="1100%" height="140%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="b1"/>
              <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="b2"/>
              <feMerge>
                <feMergeNode in="b1"/>
                <feMergeNode in="b2"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
            <filter id="lscore" x="-500%" y="-20%" width="1100%" height="140%">
              <feGaussianBlur stdDeviation="0.6"/>
            </filter>
          </defs>

          {/* ── Клинок ── */}
          {/* Дальнее свечение (самый широкий, самый прозрачный) */}
          <rect x="5.5" y="5" width="11" height="54" rx="5.5"
            fill="#7c6be8" opacity="0.18"
            style={{ filter:"blur(5px)" }}
          />
          {/* Среднее свечение */}
          <rect x="7.5" y="5" width="7" height="54" rx="3.5"
            fill="#818cf8" opacity="0.55"
            filter="url(#lsglow)"
          />
          {/* Основной клинок */}
          <rect x="9" y="5" width="4" height="54" rx="2"
            fill="#a5b4fc" opacity="0.95"
          />
          {/* Белое ядро */}
          <rect x="10" y="6" width="2" height="52" rx="1"
            fill="white" opacity="0.9"
          />
          {/* Острие */}
          <ellipse cx="11" cy="5" rx="2" ry="3.5"
            fill="white" opacity="0.95"
          />
          {/* Мягкий конец клинка */}
          <ellipse cx="11" cy="59" rx="2" ry="1.5"
            fill="#818cf8" opacity="0.7"
          />

          {/* ── Гарда ── */}
          <rect x="3" y="59" width="16" height="4" rx="2"
            fill="#94a3b8"
          />
          <rect x="3" y="60" width="16" height="1.5" rx="0.75"
            fill="#cbd5e1" opacity="0.4"
          />

          {/* ── Рукоять ── */}
          {/* Основа */}
          <rect x="7.5" y="63" width="7" height="20" rx="3"
            fill="#374151"
          />
          {/* Металлические кольца */}
          <rect x="7.5" y="66" width="7" height="2" rx="1"
            fill="#4b5563"
          />
          <rect x="7.5" y="71" width="7" height="2" rx="1"
            fill="#4b5563"
          />
          <rect x="7.5" y="76" width="7" height="2" rx="1"
            fill="#4b5563"
          />
          {/* Боковые детали */}
          <rect x="6.5" y="68" width="2" height="5" rx="1"
            fill="#1f2937"
          />
          <rect x="13.5" y="68" width="2" height="5" rx="1"
            fill="#1f2937"
          />
          {/* Помол */}
          <rect x="8" y="83" width="6" height="3" rx="1.5"
            fill="#6b7280"
          />
          <ellipse cx="11" cy="86" rx="3" ry="1.5"
            fill="#374151"
          />
        </svg>
      </div>
    </>
  );
}
