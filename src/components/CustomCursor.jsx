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

      {/* Lightsaber — под углом ~35°, острие вверху-слева */}
      <div ref={saberRef} style={{
        position:"fixed", top:0, left:0, zIndex:9999,
        pointerEvents:"none", opacity:0,
        willChange:"transform",
      }}>
        {/*
          SVG 48×48, всё повёрнуто на -35deg относительно центра.
          Острие меча находится в точке (4, 4) внутри SVG.
        */}
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ display:"block", overflow:"visible", transform:"rotate(-35deg)", transformOrigin:"4px 4px" }}
        >
          <defs>
            <filter id="g1" x="-400%" y="-10%" width="900%" height="120%">
              <feGaussianBlur stdDeviation="2.5"/>
            </filter>
            <filter id="g2" x="-400%" y="-10%" width="900%" height="120%">
              <feGaussianBlur stdDeviation="1.2"/>
            </filter>
          </defs>

          {/* Внешнее свечение */}
          <line x1="4" y1="4" x2="4" y2="34"
            stroke="#818cf8" strokeWidth="9" strokeLinecap="round"
            opacity="0.18" filter="url(#g1)"
          />
          {/* Среднее свечение */}
          <line x1="4" y1="4" x2="4" y2="34"
            stroke="#a5b4fc" strokeWidth="4" strokeLinecap="round"
            opacity="0.55" filter="url(#g2)"
          />
          {/* Клинок */}
          <line x1="4" y1="4" x2="4" y2="34"
            stroke="#a5b4fc" strokeWidth="2" strokeLinecap="round"
          />
          {/* Ядро */}
          <line x1="4" y1="5" x2="4" y2="33"
            stroke="white" strokeWidth="0.8" strokeLinecap="round"
            opacity="0.9"
          />
          {/* Острие */}
          <circle cx="4" cy="4" r="1.5" fill="white" opacity="0.95"/>

          {/* Гарда */}
          <rect x="-2" y="34" width="12" height="3" rx="1.5" fill="#94a3b8"/>

          {/* Рукоять */}
          <rect x="1.5" y="37" width="5" height="13" rx="2" fill="#374151"/>
          <rect x="1.5" y="40" width="5" height="1.5" rx="0.75" fill="#4b5563"/>
          <rect x="1.5" y="44" width="5" height="1.5" rx="0.75" fill="#4b5563"/>
          <ellipse cx="4" cy="50" rx="2.5" ry="1.2" fill="#1f2937"/>
        </svg>
      </div>
    </>
  );
}
