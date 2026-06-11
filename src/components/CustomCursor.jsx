import { useEffect, useRef } from "react";

export default function CustomCursor() {
  const dotRef   = useRef(null);
  const ringRef  = useRef(null);
  const saberRef = useRef(null);

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
    if (!dot || !ring || !saber) return;

    let mx = -300, my = -300;
    let rx = -300, ry = -300;
    let hovering = false;
    let clicking = false;
    let serverId = null;
    let raf;

    // Острие клинка внутри SVG — точка (7, 7)
    const TIP_X = 7;
    const TIP_Y = 7;

    const loop = () => {
      const isSaber = serverId === "starwars";

      dot.style.opacity   = isSaber ? "0" : "1";
      ring.style.opacity  = isSaber ? "0" : "1";
      saber.style.opacity = isSaber ? "1" : "0";
      saber.style.pointerEvents = "none";

      if (isSaber) {
        const sc = clicking ? 0.88 : 1;
        saber.style.transform = `translate(${mx - TIP_X}px, ${my - TIP_Y}px) scale(${sc})`;
      } else {
        rx += (mx - rx) * 0.12;
        ry += (my - ry) * 0.12;
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
    const onDown = () => { clicking = true; };
    const onUp   = () => { clicking = false; };
    const onOver = (e) => { if (e.target.closest("button,a,input,textarea,select,[role=button],label")) hovering = true; };
    const onOut  = (e) => { if (e.target.closest("button,a,input,textarea,select,[role=button],label")) hovering = false; };
    const onSrv  = (e) => { serverId = e.detail?.id || null; };

    window.addEventListener("mousemove",   onMove, { passive: true });
    window.addEventListener("mousedown",   onDown);
    window.addEventListener("mouseup",     onUp);
    document.addEventListener("mouseover", onOver);
    document.addEventListener("mouseout",  onOut);
    window.addEventListener("serverChange", onSrv);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove",   onMove);
      window.removeEventListener("mousedown",   onDown);
      window.removeEventListener("mouseup",     onUp);
      document.removeEventListener("mouseover", onOver);
      document.removeEventListener("mouseout",  onOut);
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

      {/* ── Lightsaber ── */}
      <div ref={saberRef} style={{
        position:"fixed", top:0, left:0, zIndex:9999,
        pointerEvents:"none", opacity:0,
        willChange:"transform",
      }}>
        {/*
          SVG 26×90, повёрнут на -40deg.
          Острие клинка → точка (7, 7) в координатах SVG.
          transformOrigin совпадает с этой точкой.
        */}
        <svg
          width="26" height="90"
          viewBox="0 0 26 90"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{
            display: "block",
            overflow: "visible",
            transform: "rotate(-38deg)",
            transformOrigin: "7px 7px",
          }}
        >
          <defs>
            {/* Самое широкое внешнее свечение */}
            <filter id="sb-glow-far" x="-600%" y="-4%" width="1300%" height="108%">
              <feGaussianBlur stdDeviation="6" result="blur"/>
            </filter>
            {/* Среднее свечение */}
            <filter id="sb-glow-mid" x="-300%" y="-3%" width="700%" height="106%">
              <feGaussianBlur stdDeviation="3" result="blur"/>
            </filter>
            {/* Близкое свечение */}
            <filter id="sb-glow-near" x="-150%" y="-2%" width="400%" height="104%">
              <feGaussianBlur stdDeviation="1.4" result="blur"/>
            </filter>
            {/* Свечение кончика */}
            <filter id="sb-tip" x="-400%" y="-400%" width="900%" height="900%">
              <feGaussianBlur stdDeviation="3"/>
            </filter>
            {/* Свечение кнопки */}
            <filter id="sb-btn" x="-200%" y="-200%" width="500%" height="500%">
              <feGaussianBlur stdDeviation="1.5"/>
            </filter>
          </defs>

          {/* ════ КЛИНОК ════ */}

          {/* Слой 1 — ультра-широкий фиолетовый ореол */}
          <line x1="7" y1="7" x2="7" y2="55"
            stroke="#4c1d95" strokeWidth="22" strokeLinecap="round"
            opacity="0.13" filter="url(#sb-glow-far)"
          >
            <animate attributeName="opacity" values="0.13;0.2;0.13" dur="1.8s" repeatCount="indefinite"/>
          </line>

          {/* Слой 2 — фиолетовый */}
          <line x1="7" y1="7" x2="7" y2="55"
            stroke="#6d28d9" strokeWidth="11" strokeLinecap="round"
            opacity="0.28" filter="url(#sb-glow-mid)"
          >
            <animate attributeName="opacity" values="0.28;0.42;0.28" dur="1.8s" repeatCount="indefinite"/>
          </line>

          {/* Слой 3 — индиго близкое */}
          <line x1="7" y1="7" x2="7" y2="55"
            stroke="#818cf8" strokeWidth="5.5" strokeLinecap="round"
            opacity="0.7" filter="url(#sb-glow-near)"
          >
            <animate attributeName="opacity" values="0.7;0.9;0.7" dur="1.8s" repeatCount="indefinite"/>
          </line>

          {/* Слой 4 — светло-индиго клинок */}
          <line x1="7" y1="7" x2="7" y2="55"
            stroke="#c4b5fd" strokeWidth="2.2" strokeLinecap="round"
          />

          {/* Слой 5 — белое ядро */}
          <line x1="7" y1="8" x2="7" y2="54"
            stroke="white" strokeWidth="0.85" strokeLinecap="round"
            opacity="0.95"
          />

          {/* Свечение кончика */}
          <circle cx="7" cy="7" r="4"
            fill="#818cf8" opacity="0.35" filter="url(#sb-tip)"
          >
            <animate attributeName="opacity" values="0.35;0.55;0.35" dur="1.8s" repeatCount="indefinite"/>
          </circle>
          {/* Яркая точка острия */}
          <circle cx="7" cy="7" r="1.6" fill="white" opacity="0.98"/>

          {/* ════ ЭМИТТЕР (переход клинок→рукоять) ════ */}
          {/* Воротник эмиттера */}
          <rect x="3.5" y="55" width="7" height="2.5" rx="1.2"
            fill="url(#collar-grad)" stroke="#334155" strokeWidth="0.3"
          />
          <defs>
            <linearGradient id="collar-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#64748b"/>
              <stop offset="100%" stopColor="#334155"/>
            </linearGradient>
            <linearGradient id="hilt-grad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%"   stopColor="#1e293b"/>
              <stop offset="40%"  stopColor="#293548"/>
              <stop offset="100%" stopColor="#1e293b"/>
            </linearGradient>
          </defs>

          {/* ════ ГАРДА ════ */}
          {/* Основа гарды */}
          <rect x="0.5" y="57.5" width="13" height="3.5" rx="1.75"
            fill="#475569"
          />
          {/* Блик на гарде */}
          <rect x="1" y="57.8" width="12" height="1.2" rx="0.6"
            fill="#94a3b8" opacity="0.6"
          />
          {/* Нижняя тень гарды */}
          <rect x="1" y="60.2" width="12" height="0.6" rx="0.3"
            fill="#1e293b" opacity="0.5"
          />

          {/* ════ РУКОЯТЬ ════ */}
          {/* Основной корпус */}
          <rect x="4" y="61" width="6" height="24" rx="3"
            fill="url(#hilt-grad)"
          />

          {/* Текстура намотки (5 полос) */}
          <rect x="4" y="63.5" width="6" height="1.8" rx="0.9"   fill="#293548"/>
          <rect x="4" y="67"   width="6" height="1.8" rx="0.9"   fill="#293548"/>
          <rect x="4" y="70.5" width="6" height="1.8" rx="0.9"   fill="#293548"/>
          <rect x="4" y="74"   width="6" height="1.8" rx="0.9"   fill="#293548"/>

          {/* Блики между полосами */}
          <rect x="4.5" y="65.5" width="5" height="0.8" rx="0.4" fill="#334155" opacity="0.7"/>
          <rect x="4.5" y="69"   width="5" height="0.8" rx="0.4" fill="#334155" opacity="0.7"/>
          <rect x="4.5" y="72.5" width="5" height="0.8" rx="0.4" fill="#334155" opacity="0.7"/>

          {/* Блок активации */}
          <rect x="4.2" y="77" width="5.6" height="5" rx="1.2"
            fill="#0f172a" stroke="#334155" strokeWidth="0.4"
          />
          {/* Кнопка с подсветкой */}
          <circle cx="7" cy="79.5" r="1.5"
            fill="#818cf8" opacity="0.9" filter="url(#sb-btn)"
          >
            <animate attributeName="opacity" values="0.9;1;0.9" dur="2.4s" repeatCount="indefinite"/>
          </circle>
          <circle cx="7" cy="79.5" r="0.9" fill="#e0e7ff"/>

          {/* ════ ПОМЕЛ (навершие) ════ */}
          <ellipse cx="7" cy="85.5" rx="4" ry="2.2" fill="#334155"/>
          <ellipse cx="7" cy="85" rx="3" ry="1.5" fill="#475569"/>
          <ellipse cx="7" cy="84.7" rx="1.8" ry="0.8" fill="#64748b" opacity="0.8"/>
        </svg>
      </div>
    </>
  );
}
