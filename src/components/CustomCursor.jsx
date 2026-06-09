import React, { useEffect, useRef, useState } from "react";

// SVG-курсоры для каждого сервера
const SERVER_CURSORS = {
  starwars: {
    // Световой меч
    render: (clicking, hovering) => (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg"
        style={{ transform: `rotate(-45deg) scale(${clicking ? 0.8 : hovering ? 1.2 : 1})`, transition: "transform 0.1s", filter: "drop-shadow(0 0 4px #818cf8)" }}
      >
        {/* Рукоять */}
        <rect x="11" y="17" width="6" height="9" rx="1.5" fill="#94a3b8" />
        <rect x="9" y="22" width="10" height="2" rx="1" fill="#64748b" />
        {/* Клинок */}
        <rect x="12.5" y="2" width="3" height="16" rx="1.5"
          fill={hovering ? "#c4b5fd" : "#818cf8"}
          style={{ filter: `drop-shadow(0 0 ${hovering ? 6 : 3}px #818cf8)` }}
        />
        {/* Tip */}
        <ellipse cx="14" cy="2" rx="1.5" ry="2" fill="#e0d7ff"
          style={{ filter: "drop-shadow(0 0 4px #fff)" }}
        />
      </svg>
    ),
    dot: "#818cf8",
  },
  default: null,
};

export default function CustomCursor() {
  const [pos,      setPos]      = useState({ x: -100, y: -100 });
  const [dot,      setDot]      = useState({ x: -100, y: -100 });
  const [clicking, setClicking] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [serverId, setServerId] = useState(null);
  const rafRef    = useRef(null);
  const targetRef = useRef({ x: -100, y: -100 });

  useEffect(() => {
    const onMove  = (e) => { targetRef.current = { x: e.clientX, y: e.clientY }; setDot({ x: e.clientX, y: e.clientY }); };
    const onDown  = () => setClicking(true);
    const onUp    = () => setClicking(false);
    const onEnter = (e) => { if (e.target.closest("button,a,input,textarea,[role=button],label")) setHovering(true); };
    const onLeave = (e) => { if (e.target.closest("button,a,input,textarea,[role=button],label")) setHovering(false); };
    const onServer = (e) => setServerId(e.detail?.id || null);

    window.addEventListener("mousemove",    onMove);
    window.addEventListener("mousedown",    onDown);
    window.addEventListener("mouseup",      onUp);
    document.addEventListener("mouseover",  onEnter);
    document.addEventListener("mouseout",   onLeave);
    window.addEventListener("serverChange", onServer);

    const animate = () => {
      setPos(prev => ({
        x: prev.x + (targetRef.current.x - prev.x) * 0.14,
        y: prev.y + (targetRef.current.y - prev.y) * 0.14,
      }));
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("mousemove",    onMove);
      window.removeEventListener("mousedown",    onDown);
      window.removeEventListener("mouseup",      onUp);
      document.removeEventListener("mouseover",  onEnter);
      document.removeEventListener("mouseout",   onLeave);
      window.removeEventListener("serverChange", onServer);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const theme = SERVER_CURSORS[serverId] || null;

  if (theme) {
    // Тематический курсор (StarWars и т.д.)
    return (
      <>
        <div className="fixed top-0 left-0 pointer-events-none z-[9999]"
          style={{ transform: `translate(${dot.x - 14}px, ${dot.y - 14}px)` }}
        >
          {theme.render(clicking, hovering)}
        </div>
        {/* Trailing ring */}
        <div className="fixed top-0 left-0 pointer-events-none z-[9998]"
          style={{
            transform: `translate(${pos.x - 18}px, ${pos.y - 18}px)`,
            width: 36, height: 36, borderRadius: "50%",
            border: `1px solid ${theme.dot}40`,
            transition: "none",
          }}
        />
      </>
    );
  }

  // Дефолтный курсор (кольцо + точка)
  return (
    <>
      <div className="fixed top-0 left-0 pointer-events-none z-[9999]"
        style={{
          transform: `translate(${pos.x - 16}px, ${pos.y - 16}px) scale(${clicking ? 0.82 : hovering ? 1.3 : 1})`,
          width: 32, height: 32, borderRadius: "50%",
          border: hovering ? "1.5px solid rgba(99,149,255,0.85)" : "1.5px solid rgba(255,255,255,0.4)",
          transition: "transform 0.1s, border-color 0.2s",
          mixBlendMode: "difference",
        }}
      />
      <div className="fixed top-0 left-0 pointer-events-none z-[9999]"
        style={{
          transform: `translate(${dot.x - 3}px, ${dot.y - 3}px)`,
          width: 6, height: 6, borderRadius: "50%",
          background: hovering ? "#6395ff" : "rgba(255,255,255,0.95)",
          transition: "background 0.2s",
        }}
      />
    </>
  );
}
