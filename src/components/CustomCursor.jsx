import { useEffect, useRef } from "react";

const LIGHTSABER_SIZE = 56; // px — размер SVG

// Световой меч SVG — острие в точке (0,0), рукоять вниз-вправо
function LightsaberSVG({ clicking, hovering }) {
  const bladeColor   = hovering ? "#c4b5fd" : "#818cf8";
  const glowColor    = "#818cf8";
  const coreColor    = "#f0ebff";
  const scale        = clicking ? 0.88 : 1;
  const bladeGlow    = hovering ? 10 : 6;

  return (
    <svg
      width={LIGHTSABER_SIZE} height={LIGHTSABER_SIZE}
      viewBox="0 0 56 56"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        transform: `scale(${scale})`,
        transition: "transform 0.1s",
        filter: `drop-shadow(0 0 ${bladeGlow}px ${glowColor}99)`,
        overflow: "visible",
      }}
    >
      <defs>
        {/* Glow для клинка */}
        <filter id="blade-glow" x="-200%" y="-200%" width="500%" height="500%">
          <feGaussianBlur stdDeviation={hovering ? "2.5" : "1.8"} result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Клинок — от острия (4,4) вниз-вправо */}
      {/* Внешнее свечение клинка */}
      <line
        x1="4" y1="4" x2="32" y2="32"
        stroke={bladeColor}
        strokeWidth="5"
        strokeLinecap="round"
        opacity="0.35"
        filter="url(#blade-glow)"
      />
      {/* Основной клинок */}
      <line
        x1="4" y1="4" x2="32" y2="32"
        stroke={bladeColor}
        strokeWidth="2.5"
        strokeLinecap="round"
        filter="url(#blade-glow)"
      />
      {/* Ядро клинка (белый центр) */}
      <line
        x1="4" y1="4" x2="30" y2="30"
        stroke={coreColor}
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.9"
      />

      {/* Гарда */}
      <rect
        x="28" y="28"
        width="10" height="4"
        rx="1.5"
        fill="#94a3b8"
        transform="rotate(45 33 30)"
      />

      {/* Рукоять */}
      <rect
        x="32" y="32"
        width="5" height="16"
        rx="2"
        fill="#64748b"
        transform="rotate(45 34.5 40)"
      />
      {/* Деталь рукояти */}
      <rect
        x="33" y="36"
        width="5" height="2"
        rx="1"
        fill="#475569"
        transform="rotate(45 35.5 37)"
        opacity="0.8"
      />
      {/* Помол */}
      <circle
        cx="44" cy="44"
        r="2.5"
        fill="#475569"
      />

      {/* Острие — маленькая точка в (4,4) как хотспот */}
      <circle cx="4" cy="4" r="1.5" fill={coreColor} opacity="0.95" />
    </svg>
  );
}

export default function CustomCursor() {
  const dotRef   = useRef(null);
  const ringRef  = useRef(null);
  const saberRef = useRef(null);

  useEffect(() => {
    const dot   = dotRef.current;
    const ring  = ringRef.current;
    const saber = saberRef.current;
    if (!dot || !ring || !saber) return;

    let mx = -200, my = -200;
    let rx = -200, ry = -200;
    let hovering  = false;
    let clicking  = false;
    let serverId  = null;
    let raf;

    const render = () => {
      const isSaber = serverId === "starwars";

      // ── Дефолтный курсор ──
      dot.style.opacity   = isSaber ? "0" : "1";
      ring.style.opacity  = isSaber ? "0" : "1";
      saber.style.opacity = isSaber ? "1" : "0";

      if (isSaber) {
        // Острие точно на мыши
        saber.style.transform = `translate(${mx - 4}px, ${my - 4}px)`;
      } else {
        // Кольцо с лагом
        rx += (mx - rx) * 0.12;
        ry += (my - ry) * 0.12;

        const scale = clicking ? 0.75 : hovering ? 1.45 : 1;
        const size  = hovering ? 22 : 18;
        ring.style.transform = `translate(${rx - size/2}px, ${ry - size/2}px) scale(${scale})`;
        ring.style.width  = `${size}px`;
        ring.style.height = `${size}px`;
        ring.style.borderColor  = hovering ? "rgba(99,149,255,0.9)" : "rgba(255,255,255,0.5)";
        ring.style.background   = hovering ? "rgba(99,149,255,0.07)" : "transparent";

        // Точка — точно на мыши
        dot.style.transform  = `translate(${mx - 2}px, ${my - 2}px)`;
        dot.style.background = hovering ? "#6395ff" : "#fff";
        dot.style.opacity    = clicking ? "0.5" : "1";
      }

      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);

    const onMove  = (e) => { mx = e.clientX; my = e.clientY; };
    const onDown  = () => { clicking = true;  updateSaberState(); };
    const onUp    = () => { clicking = false; updateSaberState(); };
    const onOver  = (e) => {
      if (e.target.closest("button,a,input,textarea,select,[role=button],[tabindex],label")) {
        hovering = true; updateSaberState();
      }
    };
    const onOut   = (e) => {
      if (e.target.closest("button,a,input,textarea,select,[role=button],[tabindex],label")) {
        hovering = false; updateSaberState();
      }
    };
    const onServer = (e) => { serverId = e.detail?.id || null; };

    function updateSaberState() {
      if (!saber) return;
      const bladeColor = hovering ? "#c4b5fd" : "#818cf8";
      const scale      = clicking ? 0.88 : 1;
      const glow       = clicking ? "4" : hovering ? "10" : "6";
      // Обновляем SVG через дата-атрибуты (SVG уже в DOM как static HTML)
      saber.style.filter    = `drop-shadow(0 0 ${glow}px ${bladeColor}99)`;
      saber.style.transform = `translate(${mx - 4}px, ${my - 4}px) scale(${scale})`;
    }

    window.addEventListener("mousemove",    onMove,  { passive: true });
    window.addEventListener("mousedown",    onDown);
    window.addEventListener("mouseup",      onUp);
    document.addEventListener("mouseover",  onOver);
    document.addEventListener("mouseout",   onOut);
    window.addEventListener("serverChange", onServer);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove",    onMove);
      window.removeEventListener("mousedown",    onDown);
      window.removeEventListener("mouseup",      onUp);
      document.removeEventListener("mouseover",  onOver);
      document.removeEventListener("mouseout",   onOut);
      window.removeEventListener("serverChange", onServer);
    };
  }, []);

  return (
    <>
      {/* ── Дефолтный: кольцо с лагом ── */}
      <div ref={ringRef}
        style={{
          position: "fixed", top: 0, left: 0, zIndex: 9998,
          width: 18, height: 18, borderRadius: "50%",
          border: "1.5px solid rgba(255,255,255,0.5)",
          pointerEvents: "none",
          transition: "width 0.15s, height 0.15s, border-color 0.15s, background 0.15s",
          willChange: "transform",
        }}
      />
      {/* Дефолтный: точка */}
      <div ref={dotRef}
        style={{
          position: "fixed", top: 0, left: 0, zIndex: 9999,
          width: 4, height: 4, borderRadius: "50%",
          background: "#fff",
          pointerEvents: "none",
          transition: "background 0.15s, opacity 0.1s",
          willChange: "transform",
        }}
      />

      {/* ── StarWars: световой меч ── */}
      <div ref={saberRef}
        style={{
          position: "fixed", top: 0, left: 0, zIndex: 9999,
          pointerEvents: "none",
          opacity: 0,
          willChange: "transform, filter",
        }}
      >
        {/* Острие в точке 0,0 SVG → offset (4,4) внутри */}
        <svg width={LIGHTSABER_SIZE} height={LIGHTSABER_SIZE} viewBox="0 0 56 56"
          fill="none" overflow="visible"
          style={{ display: "block" }}
        >
          <defs>
            <filter id="sg" x="-300%" y="-300%" width="700%" height="700%">
              <feGaussianBlur stdDeviation="2" result="b"/>
              <feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>
          {/* Внешнее свечение */}
          <line x1="4" y1="4" x2="32" y2="32" stroke="#818cf8" strokeWidth="6" strokeLinecap="round" opacity="0.3" filter="url(#sg)"/>
          {/* Клинок */}
          <line x1="4" y1="4" x2="32" y2="32" stroke="#818cf8" strokeWidth="2.5" strokeLinecap="round" filter="url(#sg)"/>
          {/* Ядро */}
          <line x1="4" y1="4" x2="31" y2="31" stroke="#f0ebff" strokeWidth="1" strokeLinecap="round" opacity="0.95"/>
          {/* Гарда */}
          <rect x="29" y="29" width="9" height="3.5" rx="1.5" fill="#94a3b8" transform="rotate(45 33.5 30.75)"/>
          {/* Рукоять */}
          <rect x="32.5" y="32.5" width="4.5" height="15" rx="2" fill="#64748b" transform="rotate(45 34.75 40)"/>
          <rect x="33" y="37" width="4.5" height="1.8" rx="0.9" fill="#475569" transform="rotate(45 35.25 37.9)" opacity="0.9"/>
          {/* Помол */}
          <circle cx="44" cy="44" r="2.5" fill="#475569"/>
          {/* Хотспот-точка */}
          <circle cx="4" cy="4" r="1.2" fill="#f0ebff" opacity="0.9"/>
        </svg>
      </div>
    </>
  );
}
