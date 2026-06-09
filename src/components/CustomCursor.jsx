import { useEffect, useRef } from "react";

// Прямая DOM-манипуляция = 0 React ре-рендеров = идеально плавно
export default function CustomCursor() {
  const dotRef  = useRef(null);
  const ringRef = useRef(null);

  useEffect(() => {
    const dot  = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    let mx = -100, my = -100; // мышь (exact)
    let rx = -100, ry = -100; // кольцо (lag)
    let hovering  = false;
    let clicking  = false;
    let serverId  = null;
    let raf;

    const applyStyles = () => {
      // Кольцо
      const scale = clicking ? 0.75 : hovering ? 1.4 : 1;
      const size  = hovering ? 22 : 18;
      ring.style.transform = `translate(${rx - size/2}px, ${ry - size/2}px) scale(${scale})`;
      ring.style.width  = `${size}px`;
      ring.style.height = `${size}px`;
      ring.style.borderColor = hovering
        ? "rgba(99,149,255,0.9)"
        : "rgba(255,255,255,0.5)";
      ring.style.background = hovering
        ? "rgba(99,149,255,0.06)"
        : "transparent";

      // Точка
      dot.style.transform  = `translate(${mx - 2}px, ${my - 2}px)`;
      dot.style.background = hovering ? "#6395ff" : "#fff";
      dot.style.opacity    = clicking ? "0.5" : "1";
    };

    const loop = () => {
      rx += (mx - rx) * 0.13;
      ry += (my - ry) * 0.13;
      applyStyles();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const onMove = (e) => { mx = e.clientX; my = e.clientY; };
    const onDown = () => { clicking = true; };
    const onUp   = () => { clicking = false; };

    const onOver = (e) => {
      const el = e.target;
      if (el.closest("button,a,input,textarea,select,[role=button],[tabindex],label")) {
        hovering = true;
      }
    };
    const onOut = (e) => {
      const el = e.target;
      if (el.closest("button,a,input,textarea,select,[role=button],[tabindex],label")) {
        hovering = false;
      }
    };
    const onServer = (e) => { serverId = e.detail?.id || null; };

    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup",   onUp);
    document.addEventListener("mouseover",  onOver);
    document.addEventListener("mouseout",   onOut);
    window.addEventListener("serverChange", onServer);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup",   onUp);
      document.removeEventListener("mouseover",  onOver);
      document.removeEventListener("mouseout",   onOut);
      window.removeEventListener("serverChange", onServer);
    };
  }, []);

  return (
    <>
      {/* Trailing ring */}
      <div ref={ringRef}
        style={{
          position: "fixed", top: 0, left: 0,
          width: 18, height: 18,
          borderRadius: "50%",
          border: "1.5px solid rgba(255,255,255,0.5)",
          pointerEvents: "none",
          zIndex: 9998,
          transition: "width 0.15s, height 0.15s, border-color 0.15s, background 0.15s, transform 0.08s",
          willChange: "transform",
        }}
      />
      {/* Exact dot */}
      <div ref={dotRef}
        style={{
          position: "fixed", top: 0, left: 0,
          width: 4, height: 4,
          borderRadius: "50%",
          background: "#fff",
          pointerEvents: "none",
          zIndex: 9999,
          transition: "background 0.15s, opacity 0.1s",
          willChange: "transform",
        }}
      />
    </>
  );
}
